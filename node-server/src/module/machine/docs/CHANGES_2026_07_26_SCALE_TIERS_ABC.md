# Machine Module — 1000+ Machine Perf Pass, Tiers A/B/C (2026-07-26)

Implements Tier A, Tier B, and 1 of 2 Tier C items from the session plan at
`~/.claude/plans/do-you-have-any-woolly-hopper.md` ("Machine Module —
Performance Optimization Plan (1000+ machines, minimum latency)"). That plan
was independently re-verified against the code this session (not sourced from
[`SCALE_AND_PERFORMANCE.md`](SCALE_AND_PERFORMANCE.md), an earlier separate
audit) — targets the acquisition → status-derivation → broadcast → persistence
path plus the read-heavy OEE/calculation endpoints. No Socket.IO payload
shape, DB schema semantics, or debounce/priority status-derivation logic was
changed. Not yet committed as of this writing; not yet deployed or measured
against real traffic.

Touches `node-server/src/module/machine/`, `node-server/src/config/`,
`node-server/prisma/schema.prisma`, and (for the new production-counts index)
`Backend/database/migrations/`.

---

## Summary table

| Tier | Item | Fix | Files |
|---|---|---|---|
| A.1 | No keep-alive on API-transport PLC polling → fresh TCP handshake every tick | Module-level `http.Agent`/`https.Agent({keepAlive:true})`, wired into `fetchPlc`'s axios call; destroyed on module teardown | `channel-mapping.service.ts` |
| A.2 | `emitToRoom` fires even with zero subscribers | `SocketService.roomHasClients(room)` gate before `broadcastData`/`broadcastPlcStatus` emit | `socket.config.ts`, `machine.service.ts` |
| A.3 | `sync.machine.ts`'s `syncOnce` did up to 2 `findFirst` + 1 `create` **per message**, serialized, up to 200 msgs/cycle | One batch `findMany` (`resolveMachineIds`) + one `createMany` per cycle | `sync.machine.ts` |
| A.4 | Dead duplicate `PrismaService` (unused, zero importers) | Deleted | `config/services/prisma/prisma.service.ts` (removed) |
| A.5 | `CHANNEL_POLL_DEBUG_LOG` prod-default check | Found **on** (`true`) in prod `.env` — flagged, deliberately left as-is (your call) | — |
| B.6 | Blocking `XREADGROUP ... BLOCK 2000` shared one Redis connection with hot-path config-cache GET/SET → up to 2s front-of-line block | New `CreateRedisConnection()` factory; `sync.machine.ts` moves only the blocking read onto a dedicated connection | `config.redis.ts`, `sync.machine.ts` |
| B.7 | `/overview`, `/shift-breakdown` had no `from`/`to` span limit → unbounded row fetch for a wide range | `assertRangeWithinLimit` rejects (400) ranges wider than `MACHINE_CALC_MAX_RANGE_DAYS` (default 400d) | `machine-calculations.service.ts` |
| B.8 | No caching on `/overview`, `/shift-breakdown`, `/detail` — every dashboard poll re-runs full query + aggregation | New `CacheAside()` helper, short TTL (`MACHINE_CALC_CACHE_TTL_MS`, default 8s), Redis-failure-resilient (falls through to live compute) | `config.redis.ts`, `machine-calculations.service.ts`, `work-order-detail.service.ts` |
| B.9 | MQTT ingest allocated a new cache-entry object + new `inputs`/`counts` arrays on **every** message | Mutate existing entry's arrays in place on ingest; `getLatest()` now returns defensive copies so tick-held references can't see later mutation | `mqtt-channel-source.ts` |
| C.10 | `machine_production_counts` only indexed `[machine_id, bucket_started_at]`, but `overview()` also filters `bucket_ended_at`; `computeOee`'s single OR-branch query couldn't use either `machine_state_events` composite index cleanly | New index `[machine_id, bucket_ended_at]` (migration); `computeOee` query split into two indexed queries (open/closed events) instead of one OR, concatenated | `Backend/.../2026_07_26_000001_...php` (new), `schema.prisma`, `work-order-detail.service.ts` |
| C.11 | Prisma `connection_limit` unsized | **Not done** — the plan itself gates this behind real query-timing metrics, which don't exist yet (no prod deployment of this session's changes). Guessing a number risks moving contention, not fixing it | — |

Not attempted this session (per plan's explicit "Advanced/architectural options" gate — evaluate only after Tier A/B ship *and are measured* in prod): adaptive polling cadence, Redis-backed Socket.IO adapter, sharded acquisition tier, write-behind + retention for `machine_state_events`, separate Prisma client/pool for calc endpoints.

---

## New/changed environment variables

| Var | Default | Purpose |
|---|---|---|
| `MACHINE_CALC_CACHE_TTL_MS` | `8000` | Short-TTL cache-aside window for `/overview`, `/shift-breakdown`, `/detail` — kept short enough to never visibly disagree with a just-broadcast `machine_status_runtime` transition |
| `MACHINE_CALC_MAX_RANGE_DAYS` | `400` | Reject (400 Bad Request) a `from`/`to` span wider than this instead of unbounded-fetching |

Added to both `.env` and `.env.example`. `CHANNEL_POLL_DEBUG_LOG=true` in prod `.env` was found on (high-volume success-path poll logging) and flagged — left untouched, not part of this change set.

**New Redis keys:** `machine:calc:overview:<machineId>:<from>:<to>`, `machine:calc:shift-breakdown:<machineId>:<from>:<to>`, `machine:calc:wo-detail:<workOrderId>` — all short-TTL (`MACHINE_CALC_CACHE_TTL_MS`), cache-aside, no explicit invalidation (TTL-only expiry, deliberate per plan — see B.8 detail below).

**New DB index:** `machine_production_counts_machine_id_bucket_ended_at_index` on `[machine_id, bucket_ended_at]` (migration written, **not yet run** — `--pretend` verified the generated SQL only; user runs migrations).

---

## Per-item detail

### A.1 — Axios keep-alive
`ChannelMappingService` now holds one `http.Agent`/`https.Agent({keepAlive: true})` for the lifetime of the module, passed to every `fetchPlc` axios call via `httpAgent`/`httpsAgent`. Previously every API-transport poll tick paid a fresh TCP handshake per PLC — at 1000+ machines this is the single largest fixed per-request cost on that path. Agents are destroyed in `onModuleDestroy` alongside the existing Modbus socket teardown.

### A.2 — Skip empty-room emits
`SocketService.roomHasClients(room)` checks `server.sockets.adapter.rooms.get(room)?.size`. `MachineService.broadcastData`/`broadcastPlcStatus` now check this before calling `emitToRoom` — `machineState`/`plcState` (used for the `snapshot` payload on new connections) are still updated unconditionally; only the redundant emit-to-nobody is skipped.

### A.3 — Batched `syncOnce`
`resolveMachineIds(customIds[])` does one `findMany` with `custom_id IN (...) OR id IN (...)` (numeric-parseable ids only for the second branch), returning a `Map<string, bigint>` — same priority as the old per-message lookup (`custom_id` match wins, numeric `id` fallback). Sensor rows are collected and inserted via one `createMany`. Ack semantics: unresolved-machine messages are still dropped + acked (same as before); a `createMany` failure now leaves the **whole batch** unacked for retry (was per-message before — batch-granularity is the accepted tradeoff for removing per-message round trips).

### A.4 — Dead code removal
`config/services/prisma/prisma.service.ts` had zero importers (confirmed via grep before deletion) — a near-duplicate of the actually-used `src/prisma/prisma.service.ts`. Pure hygiene, no behavior change.

### B.6 — Isolated blocking Redis connection
`CreateRedisConnection()` (new export, `config.redis.ts`) returns a fresh `ioredis` instance using the same `REDIS_URL` resolution as the shared singleton. `SyncMachine` uses it only for the `XREADGROUP ... BLOCK 2000` call; `socketToRedis`'s `xadd`/`zadd` multi, `xack`, `xtrim`, and `xgroup CREATE` stay on the original shared client (`GetRedisClient()`) since they're quick non-blocking commands and were never the identified bottleneck. Disconnected in `onModuleDestroy`.

### B.7 — Range guard
`assertRangeWithinLimit(from, to)` throws `BadRequestException` when the resolved (post-default) span exceeds `MACHINE_CALC_MAX_RANGE_DAYS`. Placed in the service (which already owns `from`/`to` parsing via `moment`) rather than duplicating date parsing in the controller — same effect (reject before the expensive query runs), no duplicated parsing logic.

### B.8 — Short-TTL cache-aside
`CacheAside<T>(redis, cacheKey, ttlMs, compute, onError?)` (new export, `config.redis.ts`) — cache-aside, unconditional (not gated by the unrelated `USE_REDIS_CACHE`/`ODATA_CACHE_DURATION` OData-cache knobs). A Redis read or write failure is logged via `onError` and never blocks the request — always falls through to `compute()`. Wrapped around the expensive portion of `overview()`/`shiftBreakdown()` (after machine-existence check and range validation, so those never get cached as a side effect) and the whole of `WorkOrderDetailService.detail()`'s computation (extracted into `computeDetail(id)`, with the 404 path staying outside the cache so a not-found result is never cached). TTL-only invalidation — no active invalidation hook wired into the write path (`MachineStateTrackerService`), deliberate per plan scope (schema-adjacent wiring, bigger than a Tier B change) and safe given the 8s default TTL.

### B.9 — MQTT in-place mutation
`handleMessage` now reuses the existing `CacheEntry`'s `inputs`/`counts` arrays (index-assignment mutation) when the incoming message's array length matches, only reallocating on a length mismatch. This matters because `handleMessage` fires at the device's raw publish rate, which can exceed the tier read rate (`getLatestForMachine`, capped at the fastest tier bucket, default 250ms) — allocation is now bounded by consumption rate instead of production rate. Safety-critical detail: `getLatest()` was changed to return `entry.inputs.slice()`/`entry.counts.slice()` (copies) instead of the live arrays, because `MachineService.machineState`/`pendingFrontendUpdates` hold a tick's acquisition object by reference for up to `MACHINE_FRONTEND_BROADCAST_MS` (default 1s) — without the copy, a later in-place mutation would silently corrupt an already-broadcast or pending payload.

### C.10 — Index + `computeOee` reshape
New composite index `[machine_id, bucket_ended_at]` on `machine_production_counts` (Laravel migration, since Laravel — not Prisma migrate — is this repo's schema-of-record for this table; `schema.prisma`'s `@@index` list updated to match, `prisma validate` passes). `WorkOrderDetailService.computeOee` previously ran one `machine_state_events.findMany` with `machine_id IN (...) AND started_at < end AND (ended_at IS NULL OR ended_at > start)` — the OR branch can't cleanly use either existing `[machine_id, started_at]`/`[machine_id, ended_at]` composite index. Split into two parallel queries (`ended_at: null` / `ended_at: {gt: overallStart}`), mutually exclusive on `ended_at` so the results are concatenated with no dedup needed.

### C.11 — Deferred
`connection_limit` sizing needs real pool-wait-time metrics to size correctly — none exist for this session's changes yet (nothing deployed/measured). Explicitly deferred rather than guessed, per the plan's own "do NOT do yet" list.

---

## Verification status

- `tsc --noEmit` — clean (one pre-existing, unrelated error in `test/app.e2e-spec.ts`, not touched).
- `npx prisma validate` — schema valid after the new index.
- Laravel migration — `php artisan migrate --pretend` confirmed generated SQL matches the intended index; **migration not run** (user runs migrations).
- Lint (`eslint`, no `--fix`) — flagged pre-existing quote-style drift across entire touched files (confirmed by checking untouched lines in the same files, e.g. unrelated imports) and a few pre-existing `any`-unsafe warnings in `machine.service.ts`'s `from_pie` handler — none introduced by this change set; not auto-fixed (would reformat unrelated code).
- **Not yet done:** real runtime smoke test against a running `node-server` (hitting `/overview`, `/shift-breakdown`, `/detail` once each) and the plan's own before/after verification approach (byte-diff Socket.IO payloads, TCP TIME_WAIT counts, Redis GET/SET p99 latency, row-for-row DB write diffs) — all require a running/deployed instance and real traffic, neither available in this session.
