# Machine Module — Improvement Roadmap & Production Readiness (200–500 Machines)

Two things in one doc: (A) what's still worth fixing beyond [`CHANGES_THIS_SESSION.md`](CHANGES_THIS_SESSION.md)'s 12 fixes, in priority order, with exact locations and proposed fixes; (B) concrete tuning/ops guidance for running this at 200–500 machines specifically. Nothing here is implemented yet — this is a plan, not a changelog.

See [`CONTEXT.md`](CONTEXT.md) for current architecture, [`CHANGES_THIS_SESSION.md`](CHANGES_THIS_SESSION.md) for what was just fixed, [`SCALE_AND_PERFORMANCE.md`](SCALE_AND_PERFORMANCE.md) for the original 13-item audit this session worked through (12/13 done, #13 archival deferred — covered again below with more detail now that it's the last open item from that list).

---

## Part A — Remaining improvements, priority order

### A1. No read-timeout on persistent Modbus connections (reliability, fix before scaling)

**Where:** `channel-mapping.service.ts` `connectModbus` (channel-mapping mode) and `machine.worker.ts` `createModbusTransport` (legacy mode) both do:
```ts
socket.setTimeout(timeoutMs);   // guards the connect only
socket.on('connect', () => {
  socket.setTimeout(0);          // disabled once connected — never re-armed
  ...
});
```
This is deliberate — the comment even says "idle gap between polls never trips this." But it means once connected, a PLC that accepts the TCP handshake and then **stops responding to reads** (firmware hang, half-open network path) causes `readDiscreteInputs`/`client.readDiscreteInputs` to hang **indefinitely**. No timeout fires, so:
- The tick that triggered the read never resolves — in channel-mapping mode, `Promise.all` for that whole tier's acquisition batch never settles, stalling every other machine on the same tier's tick.
- `recordPlcResult`/quarantine (#5) never triggers, because the call never rejects — a hung PLC is *worse* than a failing one under the current quarantine design, since quarantine only activates on rejected promises.

**Fix:** re-arm a read-specific timeout around each read call (not the shared connection-level guard), e.g. wrap `client.readDiscreteInputs(...)` in a `Promise.race` against a timeout that rejects and evicts the connection (`evictModbusConnection`) on expiry — same failure path as an explicit socket error, so quarantine picks it up correctly. Needs doing in both files (the pattern is duplicated, not shared — worth a shared helper if fixing both).

**Effort:** small, self-contained, no schema/config changes. Do this first — it's a correctness gap that undermines #4 and #5 both.

### A2. No concurrency cap on the PLC-acquisition fan-out

**Where:** `acquireApi`/`acquireModbus` in `channel-mapping.service.ts` — `Promise.all` over every distinct PLC group in a tier, unbounded.

At today's scale this is fine (I/O-bound, Node handles hundreds of concurrent sockets without issue). At 500 machines with many on a fast tier, an unbounded burst of simultaneous connects/reads is still worth capping defensively — not because Node can't handle it, but because a sudden burst competing for outbound ephemeral ports / the OS's own connection-tracking table is a real, if distant, failure mode, and an explicit cap makes the system's behavior predictable under a config mistake (e.g. someone accidentally sets `server_call_sec` low fleet-wide).

**Fix:** add `p-limit` (or equivalent — not currently a dependency) around the group-fetch `Promise.all` calls, capped by a new `CHANNEL_ACQUIRE_CONCURRENCY` env var (suggested default: 50–100, tune from a load test — see Part B).

**Effort:** small, one new dependency, two call sites.

### A3. `machine_sensor_data` persistence path is dead/broken

**Where:** documented as a known issue already (`CONTEXT.md` §9/§13) but never acted on. `sync.machine.ts`'s `socketToRedis`/`insertToMysql` expect `{machineId, status, value, timestamp}`; the actual live payload (`to_frontend`/`message`) has none of those keys. Net effect: `machine_sensor_data` either never receives real data, or receives `temperature: 0` if something forwards the relay-shaped payload through it.

**Decision needed, not just a fix:** either (a) map real fields into this table if something downstream actually reads it, or (b) delete the ingest path and the table if nothing does. Left un-triaged, it's silently misleading — a table that looks populated (or empty) doesn't tell you whether it's *supposed* to be. Worth 30 minutes to grep for any consumer of `machine_sensor_data` before deciding.

### A4. Zero test coverage on this module

**Current state:** `find src/module/machine -iname "*.spec.ts"` returns nothing. Jest + ts-jest are already configured at the repo level (`package.json`), just never pointed at this module.

**What to test first, in priority order** (highest-value, lowest-effort — pure logic, no DB/network mocking needed for most of these):
1. `debounceStatus` (`channel-mapping.service.ts`) — confirmed/candidate/wall-clock transitions, the exact bug class (tick vs time) found this session.
2. `resolveTierMs`/`buildIpCadenceMs` — the PLC-group-cadence-consistency invariant (two machines sharing an IP must land in the same tier) is exactly the kind of thing a refactor could silently break again.
3. `recordPlcResult`/`isPlcQuarantined` — quarantine trip/clear state machine.
4. `MachineStateTrackerService.recordTransitions` — mock Prisma, assert the batched SQL produces the same `duration_seconds` as `recordTransition`'s `Math.round` for a table of inputs (this is precisely the class of bug this session found manually; a test would have caught it before it shipped).
5. `deriveStatus` — channel priority logic (maintenance override, active/idle combinations).
6. `MachineRuntimeService.serializeWrite` — same-machine ordering under interleaved async completions.

**Lower priority / harder:** integration tests against a real or mocked Modbus/HTTP PLC endpoint, worker-thread message-relay tests (needs actual `worker_threads`, slower to run). Fine to defer.

### A5. No observability — can't verify any of this session's fixes are working in production

No metrics anywhere in this module, only `Logger` lines (this was flagged in the original audit and never built). No `prom-client`/Prometheus/Grafana found anywhere in the repo — introducing real metrics means introducing a whole stack, not just a library.

**Pragmatic first step (no new infra):** a periodic (e.g. every 60s) structured log line per service, e.g.:
```
ChannelMappingService summary: tiers=[250ms:12, 1000ms:180, 2000ms:308] avgTickMs={250:4, 1000:11, 2000:19} quarantined=3 cacheHitRate=0.97
```
Cheap, no dependency, immediately useful for `grep`/log-aggregator dashboards if one already exists.

**If you want real dashboards:** add `prom-client`, expose a `/metrics` endpoint, stand up Prometheus + Grafana (or point at existing infra if the ops team already runs something). Bigger lift — infra decision, not just code — flagging it as the "if you're serious about this long-term" option rather than defaulting into it.

Minimum metrics worth having before 500 machines depend on this: tick duration per tier, per-transport success/failure counts, PLC quarantine count (gauge), config-cache hit rate, worker-thread count + restart rate (legacy mode only, if kept), DB write batch size + duration.

### A6. Legacy worker mode — confirm retirement

Already discussed: `CHANNEL_MAPPING_ENABLED=true` in prod `.env`, no `machines.json` override forcing legacy transport. If no machine genuinely needs an isolated persistent connection outside the shared-PLC-group model, delete `machine.worker.ts` and most of `machine-runtime.service.ts` (worker spawn/restart/pool-cap machinery, the whole DB-relay message protocol, `deriveLegacyState`) rather than continuing to maintain two acquisition pipelines. This is the single biggest complexity-reduction available and it's currently unused code, not a hard call — just needs someone to confirm no machine config anywhere sets a non-default transport before deleting.

### A7. Dead code / cosmetic cleanup (low priority, do during A6 if that lands)

- Commented-out demo/log blocks in worker, runtime, config service (pre-existing, flagged in `CONTEXT.md` §13).
- `handleGetStats()` stub (`TZ`/`Total`/`Bad` hardcoded) — either implement or remove the fields from the payload/frontend.
- Frontend field mislabeling (`temp`/`hours`←`T`, `rpm`/`load`←`S` in `machine-board.component.ts`) — cosmetic but user-facing wrong numbers on the live dashboard.

### A8. #13 — `machine_state_events` archival (deferred last session, still open)

Now the last open item from the original 13-point audit. Two viable designs, need a decision (not a default) on retention window:

| Approach | What | Tradeoff |
|---|---|---|
| Archive table | New `machine_state_events_archive` (same columns), nightly job moves closed rows older than N days | Preserves raw transition-level data for later re-analysis; bigger storage footprint long-term |
| Daily rollup | New `machine_state_daily_summary` (`machine_id, date, state, total_seconds`), nightly job pre-aggregates + deletes raw rows past N days | Much smaller footprint; loses individual transition timestamps for old data — can't re-derive exact durations later |

Recommendation if forced to pick one: archive table, not rollup — OEE/KPI work later may want to re-slice historical data in ways a pre-aggregated rollup can't support (e.g. shift-boundary-aware totals, different bucket definitions). Suggested retention: 30–90 days live in `machine_state_events`, archive beyond that — but this is a business call (how far back does OEE reporting actually need to query "live"?), not a technical one.

---

## Part B — Production readiness at 200–500 machines

### B1. Resource sizing

Earlier estimate for the current architecture was 300–500 machines on 2 vCPU / 2GB, assuming Redis stays local/light and nothing else heavy shares the box. 200–500 sits right at or inside that estimate — workable, but with less margin than is comfortable for a "cannot get this wrong" system. Concrete recommendations:

- **Don't colocate** this Node process with other heavy services (node-backend, python-server per the repo map) on the same 2GB box at this scale — if they currently share a box, budget a dedicated instance or bump to 4GB.
- MySQL is already remote (`192.168.100.216`) — good, keep it that way; don't let DB and app compute compete.
- Redis is local — fine at this scale (small JSON config blobs only), but confirm it isn't also running something else memory-hungry on the same instance.
- **Explicitly set Prisma's connection pool size** in `DATABASE_URL` (`?connection_limit=N`) rather than relying on the default `num_cpus*2+1` formula — on a 2 vCPU production box that default resolves to 5, which is fine for today's batched-write pattern but is an *implicit*, easy-to-forget number. Make it explicit (e.g. 10) and documented, so a future move to a bigger/smaller box doesn't silently change DB concurrency behavior.

### B2. Env var tuning for this scale specifically

| Var | Current default | Recommendation at 200–500 |
|---|---|---|
| `CHANNEL_CADENCE_TIERS_MS` | `250,500,1000,2000,5000` | Keep the buckets, but **audit `server_call_sec` fleet-wide** — most machines should sit at 1–2s; reserve sub-second tiers for genuinely fast-cycling equipment only. A few machines on 250ms is fine; hundreds on 250ms is a different capacity conversation (see A2). |
| `CHANNEL_PLC_MAX_FAILURES` / `CHANNEL_PLC_QUARANTINE_MS` | 3 / 30000 | If the factory network is flaky (WiFi-connected PLCs, long cable runs), consider raising quarantine to 60000–120000 to cut retry noise — tradeoff is a longer blind window before a recovered PLC is re-checked. Keep the default if network is a stable wired LAN. |
| `CHANNEL_STATUS_DEBOUNCE_MS` | 1000 | Keep at 1000 unless OEE reporting needs tighter transition timestamps (lower it, accept more flicker risk) or the factory's contacts are especially noisy (raise it). This is the one knob directly trading OEE precision against noise rejection — pick with whoever owns OEE reporting, not unilaterally. |
| `MACHINE_CONFIG_CACHE_TTL_MS` | 10000 | Fine as-is. |
| `MACHINE_FRONTEND_BROADCAST_MS` | 1000 | Fine as-is — dashboard freshness, not data accuracy. |
| `CHANNEL_ACQUIRE_CONCURRENCY` (proposed, A2) | — | If built, start at 50–100 and tune from load-test tick duration. |

### B3. Load testing — do this before go-live, not after

1. Simulate 200–500 fake Modbus/API PLC endpoints (a small script standing up dummy TCP/HTTP servers is enough — doesn't need real hardware).
2. Watch tick duration per tier under load — it must stay comfortably under that tier's own cadence, or ticks start backing up (a tier's `tierTick` won't overlap itself, but a slow tick delays every subsequent one — an early warning sign worth alerting on once A5's metrics exist).
3. Run for 24h+, watch RSS/heap — specifically verify the #12 pruning logic (this session) actually keeps `lastState`/`statusDebounce`/`plcHealth`/`modbusConnections` bounded under simulated machine churn (add/remove fake machines mid-run), not just under steady state.
4. Fix A1 (Modbus read-timeout) **before** this load test — otherwise a simulated hung PLC will falsely look like "the system handles it fine" (it'll just silently stall that PLC's group forever without anyone noticing, exactly the failure mode A1 describes).

### B4. Ops checklist before flipping on 200–500 machines

- [ ] A1 (Modbus read-timeout) fixed.
- [ ] A6 (legacy mode) explicitly confirmed retired or explicitly kept + tested at real scale — don't leave it in an unconfirmed state at this scale.
- [ ] A5 minimum observability in place (tick duration, quarantine count, cache hit rate) — you need to *see* the system before this many machines depend on it.
- [ ] A4 minimum tests in place for debounce, tiering, batched-write rounding, quarantine — the exact bug classes found this session.
- [ ] A8 retention decision made — don't let `machine_state_events` accumulate unbounded through a scale-up.
- [ ] Alerting defined: who gets paged on Redis unreachable (both caches fail open to MySQL — fine, but means every tick hits MySQL until Redis recovers, worth knowing), MySQL write failures spiking, a tier's tick duration exceeding its own cadence, worker restart-loop (if legacy mode kept).
- [ ] Staged rollout, not a flip-the-switch cutover: add machines in batches (e.g. 50 at a time), watch metrics between batches, rather than connecting 500 machines simultaneously on day one.

### B5. What *doesn't* need more work at this scale

Worth being explicit about what's already solid, so effort doesn't get spent re-solving it:
- Connection-pool exhaustion (#1) — fixed, one shared pool regardless of machine count.
- Cadence coupling (#3) — fixed, tiers are independent.
- DB write volume (#6) — fixed, batched per tick regardless of transition count.
- Config-reload DB load (#9/#10) — fixed, Redis-cached + event-invalidated.
- Socket broadcast volume (#2) — fixed, batched regardless of machine count.

200–500 is comfortably within what those fixes were designed for — the open items above are about *closing remaining gaps*, not re-litigating the scale work already done this session.
