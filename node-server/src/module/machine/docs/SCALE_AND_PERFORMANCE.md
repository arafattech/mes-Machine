# Machine Module — Scale & Performance Refactor Opportunities

Audit of `node-server/src/module/machine/` against the module's own stated target (`CLAUDE.md`): 200+ machines today, 1000+ in the future, high concurrency, minimal DB/network load. Findings are ranked by how hard they block scaling past a few hundred machines, not by how easy they are to fix. See [`CONTEXT.md`](CONTEXT.md) for how the module currently works and [`CHANGES_LAST_5_DAYS.md`](CHANGES_LAST_5_DAYS.md) for how it got here.

---

## Critical — hard ceilings on scale

### 1. Legacy worker mode: one `worker_thread` + one `PrismaClient` per machine
`runtime/machine.worker.ts:44` — `const prisma = new PrismaClient();` — every worker thread opens its **own** connection pool (Prisma defaults to `num_cpus*2+1` connections per client). At 200 machines in legacy mode that's already 200 independent pools; at 1000+ it's not viable — MySQL's `max_connections` will be exhausted long before machine count does. `MachineRuntimeService.spawnWorker` also spawns one OS thread per machine (`worker_threads`), each with its own event loop, GC, and (for Modbus) its own persistent TCP socket. This is the module's hardest scaling wall.

**Fix direction:** legacy mode should follow the same "poll once per PLC, one process, no per-machine thread" model `ChannelMappingService` already proved out for status derivation — extend it to also acquire raw 5-signal telemetry (not just channel booleans) so `machine.worker.ts`/per-machine threads can eventually be retired for anything beyond hardware that genuinely needs an isolated persistent connection. Short of a full rewrite: at minimum, share **one** `PrismaClient` across all worker threads (Prisma supports this via a shared pool proxy) instead of one per thread, and cap concurrent worker threads with a pool/queue rather than one-per-machine.

### 2. `to_frontend` is a global, unscoped broadcast
`machine.service.ts:80` — `socketService.emit('to_frontend', payload)` sends **every** machine's every tick to **every** connected socket, regardless of which dashboard/hall that client is looking at. `emitToRoom(machine_<id>, 'message', payload)` right above it is the room-scoped alternative that already exists but the frontend board (`MachineBoardComponent`) doesn't use it — it listens to the global `to_frontend` firehose instead (see Frontend docs). At 1000 machines × N telemetry ticks/sec × M connected dashboards, message volume is `machines × ticks × clients` — this is the term that grows fastest with scale.

**Fix direction:** either (a) move dashboard consumption onto room-scoped `message` events per hall/machine-group instead of one global event, or (b) batch: accumulate a tick's worth of machine payloads server-side and emit one array per broadcast interval (e.g. every 1s) instead of one `emit` call per machine per tick — cuts socket frame overhead by the machine count factor.

### 3. Global single-cadence poll loop in `ChannelMappingService`
`runtime/channel-mapping.service.ts:168-175` (`resolveCadence`) — the **entire** poll loop runs at `min(poll_interval_ms across every configured machine)`. One machine configured for a 250ms cadence forces every other machine's PLC group to be re-polled every 250ms too, even if the rest are configured for 2-5s. At scale this multiplies HTTP/Modbus request volume across the whole factory floor by whatever the single fastest-configured machine demands.

**Fix direction:** bucket machines by cadence (e.g. group configs by `poll_interval_ms` rounded to a small set of tiers) and run independent `setTimeout` chains per tier, so a fast machine only makes the *other machines in its tier* poll faster — not the entire plant.

---

## High — real cost/latency at scale, not yet a hard wall

### 4. MODBUS channel reads open a fresh TCP connection every tick
`runtime/channel-mapping.service.ts:372-411` (`readModbusInputs`) — connect, read 10 discrete inputs, `socket.destroy()`, every single tick, per PLC IP. Comment even flags this: *"Stateless per tick — NOT the persistent connection the legacy worker keeps."* Modbus is typically the dominant transport on a factory floor; at thousands of PLCs on a fast cadence this is constant TCP handshake/teardown churn — CPU, ephemeral port pressure, and more surface for transient connection failures than a kept-alive socket.

**Fix direction:** maintain one persistent Modbus TCP connection per PLC IP (same pattern `machine.worker.ts`'s `createModbusTransport` already implements for the legacy path), read-on-tick instead of connect-on-tick.

### 5. No backoff/quarantine for persistently-dead PLCs
`acquireApi`/`readModbusInputs` (`channel-mapping.service.ts`) retry every PLC at full tick cadence forever — a PLC that's been offline for hours still gets a fresh connection attempt (and a full timeout wait) every single tick. At factory scale, some non-trivial fraction of PLCs are realistically down at any given time (decommissioned lines, maintenance, wiring faults) — every one of them burns a full `request_timeout_ms` wait on every tick, competing with healthy PLCs for the same tick window. The legacy worker already has this pattern right (`MAX_RETRIES` + exponential backoff, `onDead`) — the channel poller has no equivalent.

**Fix direction:** track consecutive-failure count per PLC IP; back off polling frequency (or skip entirely) for PLCs past a failure threshold, with periodic health-check retries at a slower cadence.

### 6. Unbounded, un-batched write fan-out on mass state transitions
`machine-state-tracker.service.ts: recordTransition` does one `findFirst` + one `$transaction` (update + create) **per machine**, and `ChannelMappingService.persistTransitions` fires all of a tick's transitions via `Promise.all` with no batching or concurrency cap. A real-world "shift start" (hundreds of machines going `ACTIVE` within the same poll tick) sends hundreds of simultaneous, uncoordinated round trips at the DB pool at once.

**Fix direction:** batch the "find all currently-open rows for these machine IDs" into one query, and the "close N rows + open N rows" into `updateMany`/`createMany` calls instead of N individual transactions. Add a concurrency cap (e.g. `p-limit`) if batching alone isn't enough headroom.

### 7. No debounce on channel-derived status → risk of transition storms
`deriveStatus()` (`channel-mapping.service.ts:437-456`) reacts to the raw channel reading on every tick with no minimum-dwell-time filter. A single flickering/bouncing digital input (common on real industrial wiring — contact bounce, electrical noise) can flip a machine's derived status back and forth every tick, and **every** flip is a `machine_state_events` write + a `machine_status_runtime` broadcast (item #6's write amplification, plus unnecessary socket traffic). This is also a correctness issue, not just a performance one — flickery data pollutes uptime/OEE calculations that this table is meant to feed.

**Fix direction:** require a candidate state to be observed for N consecutive ticks (or a minimum wall-clock dwell time) before it's treated as a real transition — classic debounce, same shape as `machine.worker.ts`'s `faultEdge` rising-edge detection already does for one signal.

### 8. Success-path logging is unconditional and per-tick
`channel-mapping.service.ts` and `mqtt-channel-source.ts` (added 2026-07-06, see `CHANGES_LAST_5_DAYS.md`) now log `"<Transport> poll OK: ... inputs=" + JSON.stringify(inputs)` on **every successful poll**, for every PLC, every tick. At 1000+ machines on a 2s cadence this is a large, constant log line volume — directly against the module's own `CLAUDE.md` guidance: *"Avoid logging entire payloads unless debugging."* It was added deliberately to diagnose the MQTT key-mismatch bug that day, but nothing gates it back down.

**Fix direction:** move success-path payload logging behind a debug/verbose flag (env var or log-level check), keep failure logging (`"poll failed"`) at its current always-on level — that's the half that's actually actionable in production.

---

## Medium — hygiene, correctness-adjacent, or scale-relevant but not urgent

### 9. Config hot-reload re-fetches and re-diffs the entire fleet every cycle
`MachineRuntimeService.syncWorkerConfigs` (every `MACHINE_WATCH_MS`, default 30s) calls `machineConfigService.loadConfigs()` — a full 4-table fetch + full in-memory rebuild for **every** machine — then diffs every field of every machine against its previous config, even though in steady state almost nothing changes between cycles. At 1000+ machines this is a recurring, mostly-wasted full-fleet computation every 30 seconds.

**Fix direction:** if the DB schema can support it, add an `updated_at`/version column to the config tables and only fetch+diff rows that changed since the last cycle, or move to an event-driven invalidation (see #10) instead of blind polling.

### 10. Config cache invalidation is TTL-only, not event-driven
`MachineConfigService.loadChannelConfigs`'s Redis cache (`MACHINE_CONFIG_CACHE_TTL_MS`, default 10s) and the legacy path's 30s `MACHINE_WATCH_MS` poll are both time-based. A config edit made through the Laravel backend (new channel mapping, PLC IP change, read_from switch) takes up to that full window to reach the poller. At factory scale, this lag compounds during commissioning of new lines when configs change frequently.

**Fix direction:** have the Laravel backend publish a lightweight "machine config changed" event (Redis pub/sub, or just `DEL` the `machine:channel_configs` cache key on save) so changes propagate on the next tick instead of waiting out the TTL — cache-invalidation-on-write, not just time-based expiry.

### 11. PLC reachability check spawns an OS subprocess per machine
`MachineRuntimeService.pingAndUpdate` (`exec(cmd, ...)`, every `MACHINE_PING_MS`) forks a native `ping` process per Modbus machine with no concurrency limit. At hundreds/thousands of machines this is real process-creation overhead every cycle, and it's redundant with information the Modbus transport already has (a live socket's own connect success/failure is a stronger reachability signal than a separate ICMP probe).

**Fix direction:** drop the separate ping subprocess in favor of the transport's own connection state where a persistent Modbus connection exists (see #4); where a real ICMP check is still wanted, use a native ping library instead of shelling out, and cap concurrency.

### 12. Long-lived in-memory maps are never pruned on machine removal
`ChannelMappingService.lastState`, `MachineService.machineState`/`plcState`, and the frontend's `MachineDurationService.states` all key off `machine_id` and grow for the lifetime of the process — only `MachineRuntimeService.workers` is explicitly cleaned up (`syncWorkerConfigs` stops+removes workers for machines no longer in config). On a factory system meant to run for months/years with machines being decommissioned and IDs reused or renumbered over time, these maps accumulate stale entries indefinitely.

**Fix direction:** when `syncWorkerConfigs`/the channel poller's config refresh detects a machine no longer present, actively delete its entry from every one of these maps, not just the worker registry.

### 13. `machine_state_events` has no archival/retention strategy
Every transition, for every machine, forever, in one table with no partitioning or archival job mentioned anywhere in the module. Combined with #7 (no debounce), a noisy fleet could generate a very large number of rows quickly. Even with debounce, a table growing without bound eventually affects the `findFirst(... ended_at: null)` index scan performance this module's own live-status recovery path (`MachineDurationService.seed()`, frontend) depends on at every page load.

**Fix direction:** a periodic archival/rollup job (e.g. move closed rows older than N days to a `machine_state_events_archive` table, or pre-aggregate into daily per-machine-per-state totals) before this becomes a live-path performance problem.

---

## Observability gap (can't optimize what isn't measured)

Nothing in this module currently emits metrics — only `Logger` text lines. At 1000+ machines, the operationally important numbers (tick duration per transport, per-PLC-group latency, DB round-trip time for `recordTransition`, Redis cache hit rate, worker-thread count/restart rate) are not surfaced anywhere structured. Recommend adding lightweight counters/histograms (even simple periodic log-summaries, or a real metrics client if one exists elsewhere in the codebase) before further scaling work — several items above (especially #3, #5, #6) are much easier to size correctly with real tick-duration data than by inspection alone.

---

## Suggested order of attack

1. **#2 (unscoped broadcast) and #8 (unconditional per-tick logging)** — both are pure config/wiring changes, no architecture risk, immediate reduction in network/IO load at any scale.
2. **#7 (debounce) and #6 (batched writes)** — closely related (debounce reduces the volume #6 needs to handle), fix correctness and cost together.
3. **#3 (cadence tiering) and #5 (dead-PLC backoff)** — both live inside `ChannelMappingService.poll()`, worth doing in the same pass.
4. **#4 (persistent Modbus connections)** — larger change, highest payoff if Modbus is the dominant transport on the real factory floor.
5. **#1 (per-machine worker threads)** — the biggest structural change; only worth it once channel mapping mode is confirmed to be the permanent default and legacy worker mode is a shrinking minority of machines, or budget a real rewrite if it isn't.
