# Machine Module — Changes, Last 5 Days (2026-07-02 → 2026-07-06)

Covers `node-server/src/module/machine/` only (cross-references to `Backend/` and `Frontend/` noted where a change required a schema/model change there). See [`CONTEXT.md`](CONTEXT.md) for the current, authoritative module reference — this doc is the *history* of how it got there.

## Commits in range

| Date | Commit | Subject |
|---|---|---|
| 2026-07-02 | `53640069` | Update node server and gpio mapping |
| 2026-07-05 | `064fe16e` (Backend) | Update api for gpios |
| 2026-07-05 | `b46b202f` | Update the node server for pulling data using mqtt,modbus,api |
| 2026-07-06 | `3fb11074` | Fixed all protocol data fetching |
| 2026-07-06 | *(uncommitted, this session)* | Shared state-transition persistence + legacy-mode parity fix |

The net effect across these five days: a fixed, single-transport (HTTP) GPIO-index status poller was generalized into a configurable, multi-transport (API/MODBUS/MQTT) **channel mapping** system, made production-reliable, and — as of the uncommitted work — extended so both machine acquisition modes (channel mapping *and* the legacy per-machine worker) persist state history identically instead of only one of them doing so.

---

## Day 1 — 2026-07-02: GPIO mapping prototype (`53640069`)

First cut at replacing "poll every machine individually" with "poll once per PLC." New `runtime/gpio-mapping.service.ts` (206 lines):

- Opt-in via `GPIO_MAPPING_ENABLED=true` (off by default — the legacy per-machine worker, `machine.worker.ts`, remained the default pipeline).
- **Fixed** PLC-input-index → physical-GPIO mapping baked into the code: `const GPIO_INDEX_TO_GPIO = [46, 53, 27, 47, 45, 1, 33, 54, 26, 48]`.
- Groups machines by PLC IP, fetches each PLC's `/api/status` once per tick (`GPIO_MAPPING_INTERVAL_MS`, default 2000ms), derives `ACTIVE`/`IDLE`/`INACTIVE`/`MAINTENANCE` per machine from its configured GPIO(s), broadcasts over the existing Socket.IO gateway (`MachineService.broadcastData`).
- HTTP/API transport only — no MODBUS or MQTT support yet.
- Backend companion: `machine_has_configs.gpio_status_map` JSON column added (migration `2026_07_02_122210_add_gpio_status_map_to_machine_has_configs_table.php`) to store each machine's GPIO→status mapping.
- `machine-runtime.service.ts` updated to skip spawning per-machine workers when GPIO mapping is enabled; `machine-config.service.ts` extended to resolve the new mapping; `machine-runtime.types.ts` gained `GpioStatusEntry`.

This was a working prototype scoped to one specific hardware wiring (fixed GPIO index list) and one transport — superseded the next commit.

---

## Day 2 — 2026-07-05: Channel mapping rewrite (`b46b202f`, + Backend `064fe16e`)

The prototype's fixed-GPIO/API-only model was replaced with a fully data-driven, transport-agnostic **channel mapping** system. This is the single largest change in the 5-day window (1209 insertions / 281 deletions across 11 files).

**Removed:** `gpio-mapping.service.ts` (206 lines) — deleted outright, not deprecated in place.

**Added:**
- `runtime/channel-mapping.service.ts` (464 lines) — the replacement poller. Per machine, channel meaning (`active`/`idle`/`maintenance`) is now looked up from a DB table (`config_has_channels`, renamed from an intermediate `config_has_gpios` — see Backend `064fe16e`) instead of a hardcoded array. Each machine's `read_from` field selects which transport acquires its channel `inputs`: `API`, `MODBUS`, or `MQTT` — independent of the legacy worker's own `transport` field (shot-counting pipeline, untouched). `deriveStatus()` priority: Maintenance channel HIGH overrides everything; Active+Idle both HIGH → `ACTIVE`; Active LOW + Idle HIGH → `IDLE`; else → `INACTIVE`.
- `runtime/mqtt-channel-source.ts` (109 lines, first version) — single shared MQTT broker connection with **one** wildcard subscription covering every MQTT-mode machine (not one subscription per machine), initially keyed by `id_iot`.
- `runtime/channel-lookup.util.ts` — shared `buildChannelLookup(inputs)` helper (`inputs[i]` → `{i: boolean}`), used by both the channel poller and the MQTT source.
- `runtime/machine-config.service.ts` gained the config-loading path for channels (`config_has_channels` join), on top of its existing legacy-worker config loader.
- **`machine_state_events` table** (new, migration `2026_07_05_070000_create_machine_state_events_table.php`) — the first time this module persisted *state history* rather than just live/current values. Written by `ChannelMappingService.recordTransition`: closes the machine's open row (`ended_at` + `duration_seconds`) and opens a new one, only on an actual state change (fast-path `lastState` Map avoids a DB round-trip when steady).
- `CLAUDE.md` (374 lines) — the module's engineering guidance doc (performance/scalability/DB/realtime principles for this module specifically).

**Backend companion (`064fe16e`, same day):** `config_has_gpios` table + `ConfigHasGpio` model added, then renamed to `config_has_channels` / `ConfigHasChannel` before this landed (visible as a migration file rename in the same diff) — the "channel," not "GPIO," terminology was settled here. `machine_has_configs.gpio_status_map` (added Day 1) was superseded by `read_from` + the `config_has_channels` relation; its drop migration (`2026_07_05_060000_drop_gpio_status_map_from_machine_has_configs_table.php`) was authored the same day.

**Net architectural shift this day:** from "one fixed hardware wiring, one transport" to "any machine, any transport, configured per-machine from the DB" — matching the module's `CLAUDE.md` principle that channel logic must be data-driven, never hardcoded.

---

## Day 3 — 2026-07-06: Protocol reliability fixes (`3fb11074`)

Title: "Fixed all protocol data fetching." This day's diff is entirely hardening/bugfixes on top of Day 2's rewrite — no new transports or DB tables, but several real correctness bugs closed:

- **MQTT grouping key bug fixed:** `MqttChannelSource` was keyed by `id_iot`; `ChannelMappingService.acquireMqtt` was calling `this.mqtt.getLatest(config.id_iot)` while every other transport groups by `ip_plc`. Both the cache key and the topic-template placeholder were changed from `{id_iot}`/`id_iot` to `{ip}`/`ip`, so MQTT now groups identically to API/MODBUS (machines sharing one PLC share one cached reading).
- **MQTT topic flexibility:** default `MQTT_TOPIC_TEMPLATE` changed from a mandatory per-machine pattern (`machines/{id_iot}/status`) to a **flat shared topic** (`machine/status`) as the default — the common case where every machine's ESP32/PLC publishes to the same topic and `ip` is read from the JSON payload instead of the topic path. A per-machine `{ip}`-templated topic is still supported for setups that need it.
- **MQTT connection hardening:** `mqtt.connect()` throwing synchronously on a malformed broker URL no longer crashes the process (wrapped in try/catch, logs and disables MQTT instead); broker URL missing a protocol is auto-prefixed with `mqtt://`.
- **Redis-cached channel config loading:** `machine-config.service.ts` gained `loadChannelConfigs()` (+137 lines) — `ChannelMappingService` was hitting a 4-table MySQL join every poll tick (as fast as every 2s); this adds a Redis-cached lean config path (`machine:channel_configs`, TTL `MACHINE_CONFIG_CACHE_TTL_MS`, default 10s) so ticks read from Redis instead of MySQL except on a cache miss. `machines.json` file overrides are still applied fresh on top of cached rows, never cached themselves.
- **Logging overhaul across all three transports** (API/MODBUS/MQTT): failures upgraded from `warn` to `error` and given a consistent `"<Transport> poll failed: ..."` prefix; successful reads now also log the raw `inputs` array (`"<Transport> poll OK: ..."`) — this is what made the day's underlying bugs (the MQTT key mismatch above) diagnosable in the first place.
- Types: `ChannelRuntimeConfig` (a lean subset of `MachineRuntimeConfig` — excludes invert flags, legacy shot-counting fields, `heating_start`) introduced and threaded through `ChannelMappingService` in place of the full `MachineRuntimeConfig`, so the channel poller's hot path only carries the fields it actually needs.

---

## Uncommitted (this session) — Shared state-transition persistence + legacy-mode parity

Not yet committed as of this writing (`git status` shows modified/untracked files under `node-server/src/module/machine/`). Motivated by a gap found while building a frontend live-runtime-timer feature: `machine_state_events` (Day 2) was **only ever written by `ChannelMappingService`** — machines running the legacy per-machine worker (`CHANNEL_MAPPING_ENABLED=false`) had no server-side record of "current status" at all, so a frontend page refresh couldn't recover how long a legacy-mode machine had been in its current state.

- **New `runtime/machine-state-tracker.service.ts`** — the `machine_state_events` read-modify-write transaction (open-row check → close old row → insert new row) extracted out of `ChannelMappingService.recordTransition` into a shared, injectable service. Same idempotent-across-restarts behavior as before (read from DB, not memory, so no duplicate row for an unchanged state). Also now emits a new Socket.IO event, **`machine_status_runtime`** (`{machine_id, status, status_started_at, elapsed_seconds:0}`), once per persisted transition — a low-frequency, transition-only event distinct from the high-frequency `to_frontend` telemetry stream, letting the frontend derive live per-state durations without deriving status itself from raw telemetry (see `Frontend/.../machine-duration.service.ts`).
- **`ChannelMappingService`** now calls the shared tracker instead of its own private method; its `poll()`/`deriveStatus()` control flow is otherwise untouched. Its now-unused direct `PrismaService` injection was removed.
- **`MachineRuntimeService` (legacy worker mode) — new:** derives a status from the worker payload's raw `A`/`P` flags (`deriveLegacyState`: `A===1→active`, `P===1→idle`, else `inactive` — no `maintenance`, since that signal doesn't exist in the legacy telemetry stream), tracks it with the same fast-path `lastState` Map pattern as `ChannelMappingService`, and calls the shared tracker on a real change (`trackLegacyState`). This runs alongside the existing `broadcastData` call in the worker's `'data'` message handler — the `to_frontend`/`message` telemetry broadcast is completely unchanged.
- `machine.module.ts` registers `MachineStateTrackerService` as a provider.
- **Result:** `machine_state_events` and `machine_status_runtime` are no longer channel-mapping-exclusive — both acquisition modes now persist and broadcast state transitions identically.
- Docs reorg (also uncommitted / staged): `CONTEXT.md` moved from the module root into `docs/CONTEXT.md`; `docs/PROTOCOLS_DATA.md` added (ESP32-P4 device's HTTP/WebSocket/MQTT/Modbus protocol reference — the physical-layer counterpart to `CONTEXT.md`'s software-layer description). `CONTEXT.md` itself updated throughout to describe the new shared tracker service and event.

---

## Cumulative database changes, this window

| Change | When | Table/Column |
|---|---|---|
| Add | 07-02 | `machine_has_configs.gpio_status_map` (JSON) |
| Add | 07-05 | `config_has_gpios` (renamed to `config_has_channels` same day) |
| Drop | 07-05 | `machine_has_configs.gpio_status_map` (superseded by `read_from` + `config_has_channels`) |
| Add | 07-05 | `machine_state_events` (`machine_id, state, started_at, ended_at, duration_seconds`) |

Net: the module now has exactly one channel-mapping table (`config_has_channels`) and one state-history table (`machine_state_events`); the short-lived GPIO-specific column/table from Day 1 was fully retired by end of Day 2.

## What to verify before this uncommitted work ships
1. A legacy-mode (`CHANNEL_MAPPING_ENABLED=false`) machine's `A`/`P` flip actually opens/closes a `machine_state_events` row (manual test or log review — no automated test coverage exists in this module currently).
2. `machine_status_runtime` fires exactly once per transition, for both modes, and doesn't regress `to_frontend`'s existing frequency/shape.
3. `MachineStateTrackerService`'s thrown errors are still caught and logged per-caller (both `ChannelMappingService.persistTransitions` and `MachineRuntimeService.trackLegacyState` drop their own cache entry on failure so a transition retries next tick/signal — verify this still holds after the extraction).
