# MACHINE_DURATION_SERVICE — Service Context

## Overview

| Property | Value |
|---|---|
| **File** | `shared/services/machine-duration.service.ts` |
| **Class** | `MachineDurationService` |
| **Provided in** | `root` (singleton — deliberately, so totals survive route navigation between `/production` and `/production/mco`) |
| **Purpose** | Tracks each machine's live per-state elapsed time — dynamic, one bucket per `machine_states.id` actually observed, not a fixed Active/Idle/Inactive/Maintenance/Fault set. Seeds today's totals from `MachineStateEvents` on load, then keeps them live primarily from the `machine_status_runtime` socket stream (server-computed, pushed once per actual state transition — not the raw `to_frontend` telemetry tick). **Also** subscribes to `to_frontend` directly (batched, every tick) for `lastSeenAt` (the epoch ms its PLC last actually responded) **and** as a self-heal fallback for `current` — see "Known Gaps" fix below. |

---

## Exported Types

```ts
interface MachineDurations {
  perState: Partial<Record<number, number>>; // today's full accumulated seconds, keyed by machine_state_id
  current: number | null;                    // current machine_state_id
  currentSeconds: number;                    // live seconds since *this* transition only — resets each time
  total: number;                             // sum across every observed state
  lastSeenAt: number | null;                 // epoch ms this machine's PLC last actually responded, or null until seen
}

interface MachineStateEventRow {
  machine_id: number | string; machine_state_id: number | null;
  started_at: string; ended_at: string | null; duration_seconds: number | null;
}
```

`MachineStateEventRow` is exported solely so `MachineRuntimeHistoryService` can reuse the exact shape of an OData `MachineStateEvents` row instead of redefining it — it plays no role in this service's own live-tracking logic beyond typing the seed query's response. It carries `machine_state_id` (the FK), not the old `state` ENUM string.

---

## Internal Model

```ts
interface MachineDurationEntry {
  state: number | null;              // current machine_state_id
  since: number;                     // epoch ms when current state began
  base: Record<number, number>;      // accumulated ms of *closed* intervals today, by machine_state_id
}
```

One `MachineDurationEntry` per machine key (`String(MNR)` / `String(machine_id)`), stored in a private `Map<string, MachineDurationEntry>` (`states`).

---

## Public API

| Member | Type | Purpose |
|---|---|---|
| `tick` | `Signal<number>` | Increments every second — subscribe/read to force reactive recompute in consumers (e.g. via `computed()` or manual read in a template that also reads `tick()`) |
| `snapshot(key)` | `(key: string \| null \| undefined) => MachineDurations` | Computes live seconds per observed `machine_state_id` + current + total + `lastSeenAt` for one machine. Returns a shared `ZERO_SNAPSHOT` constant (`{ perState: {}, current: null, currentSeconds: 0, total: 0, lastSeenAt: null }`) if `key` is falsy or unknown — except `lastSeenAt` itself, which is looked up independently of whether a `states` entry exists (a machine can have live telemetry before its first state transition is seeded) |

---

## Construction Sequence

1. `seedDate = todayKey()` (today's `Date().toDateString()`).
2. Start a `interval(1000)` (`takeUntilDestroyed`) that calls `rolloverIfNewDay()` then increments `tick`.
3. Call `seed()` (async), and **only after it resolves**, call `subscribeSocket()` — this ordering is deliberate: a live socket tick must never arrive and get overwritten by a slower-resolving seed fetch, so seeding is fully awaited first (`.finally()`).

---

## `seed()` — Initial State from `MachineStateEvents`

Two **independent, parallel** (`Promise.allSettled`) queries — this split is deliberate, not incidental:

| Query | Filter | Purpose |
|---|---|---|
| "open" | `ended_at eq null` | The currently-open state row per machine — anchors `entry.since` to the DB's `started_at` so the live counter is correct even after a page reload (not reset to "now") |
| "closed" | `started_at ge {midnightIso} and ended_at ne null` | All of today's already-closed intervals — summed into `entry.base[state]` |

Each row's `machine_state_id` is used directly (a real FK, not a string to validate) — rows with `machine_state_id === null` (a custom state with no legacy ENUM match, from before the FK column existed, or genuinely unresolvable) are skipped.

If either query rejects (`Promise.allSettled`), that half is simply skipped — a failed "closed" fetch does not prevent the "open" anchor from seeding, and vice versa.

---

## `subscribeSocket()` — Live Updates

**Changed:** the original `to_frontend`-based subscription (deriving status client-side via `deriveActivity()`) is commented out in place, not deleted. It's superseded by a subscription to `SocketService.on('machine_status_runtime')` — a dedicated event the node-server emits once per **persisted** state transition (see node-server's `machine-state-tracker.service.ts` and `docs/CONTEXT.md` §7/§9/§15), for `{machine_id, machine_state_id, status, status_started_at, elapsed_seconds}`. `machine_state_id` was added to this payload specifically so this service (and `MachineRuntimeHistoryService`) can key durations by the numeric FK rather than fragile name matching. On each message: resolve `since` from `Date.parse(status_started_at)` (fallback to `Date.now()` if unparseable), then call `apply(key, machine_state_id, since)`.

This means status derivation itself (`deriveActivity()` from raw `A`/`P`/`STATUS` flags) is a backend responsibility for this service's purposes — the backend derives and persists transitions for **both** machine acquisition modes (legacy worker mode included, closing a former gap; see node-server docs). `MachineBoardComponent`'s own status-badge logic is unrelated and still reads `to_frontend` directly (and still works by state *name*, via `MachineStatesService.getByName()` — see its own context doc).

**`lastSeenAt` + self-heal `current` (one subscription, `to_frontend`):** `subscribeSocket()` also subscribes to `to_frontend` (array or single object, normalized the same way `MachineBoardComponent` does). Per item: `lastSeenAt` (when present — never overwritten with `null`) updates the `lastSeen: Map<string, number>` as before. **Additionally**, `STATUS` (channel-mapping mode only — the exact state name node-server resolved this tick, same field the board's own status tiles read) is resolved to a `machine_state_id` via `MachineStatesService.getByName(item.STATUS)?.id` and, when found, passed through `apply()` alongside the transition-driven call from `machine_status_runtime`. `apply()` already no-ops when `entry.state` already matches, so this is a cheap correction, not a duplicate write, on every in-sync tick — it only actually changes anything when `current` has drifted from the live per-tick truth. Fixes a real staleness bug: `machine_status_runtime` fires once, edge-triggered, on a *change* — a missed emission (socket reconnect gap, node-server restart resetting its in-memory last-state so it never re-fires for an already-applied transition) previously left `current` stuck on a stale value **forever**, visible only as "board shows the correct status, `MachineOverviewComponent`'s header badge still shows the old one, until a full page reload re-seeds from the DB." `to_frontend`'s STATUS is the same continuous, self-correcting signal the board already relies on for exactly this reason.

`apply()`:
- New key → seed `{state: stateId, since: now, base: {}}`.
- Same state as before → no-op (avoid pointless writes).
- State changed → close the previous interval into `base[oldStateId] += now - since`, then set `state = newStateId, since = now`.

**Maintenance verification-window correction (`machine_maintenance_recount`, separate subscription, same method):** this service knows nothing about `machine_maintenance_schedules` — it purely mirrors `machine_state_events`/`machine_status_runtime`, so a machine going Maintenance → confirmed Active → re-faulted within the post-maintenance verification window (see `Frontend/docs/production-management/MACHINE_MAINTENANCE_STATUS_DURATION_PLAN.md`) gets recorded here exactly as it happened: a genuine Active interval, then Maintenance again. That's correct for the board's real-time display, but once the recovery turns out false the whole span should count as Maintenance in today's totals too (same attribution as the maintenance session's own `duration_seconds`). node-server (`ChannelMappingService.applyPendingConfirmationBuffer` / `MachineStateTrackerService.emitMaintenanceRecount`) emits `machine_maintenance_recount` — `{machine_id, from_state_id, to_state_id, since, until}` — strictly *after* the corresponding `machine_status_runtime` MAINTENANCE transition for the same tick (Socket.IO preserves per-connection emit order), so by the time this arrives the span is already baked into `base[from_state_id]` via `apply()` above. On receipt: `base[from_state_id] -= (until - since)` (floored at 0), `base[to_state_id] += (until - since)` — a pure post-hoc correction, `entry.state`/`entry.since` untouched. A window that finalizes instead (holds the full verification window) needs no correction — it genuinely was Active, which is exactly what's already recorded.

---

## `snapshot(key)` — Read Path

For the requested key's entry, `perState` is built by converting every `base` entry to floored seconds, **then adding** the current state's live elapsed time on top of its own `base` entry (not replacing it). That same live delta is also returned separately, unmodified, as `currentSeconds`:
```
perState[stateId] = floor(base[stateId] / 1000)               // every closed-interval state
currentSeconds = floor(max(0, now - since) / 1000)             // live delta since the current transition
perState[current] += currentSeconds                            // current state's *today total* also gets it added
```
`total` = sum of every value in `perState`. `lastSeenAt` is read straight from the `lastSeen` map for the given key (not derived from `entry`/`base` at all) — `key ? (lastSeen.get(key) ?? null) : null`.

`currentSeconds` exists as its own field specifically because `perState[current]` and "time since the current state was entered" are different, both-needed quantities: the State Durations panel (`MachineOverviewComponent`) wants today's full accumulated total per state (`perState`), while `MachineStatusCardComponent`'s board-card timer wants only the live delta since the last transition (`currentSeconds`) — it must reset to 0 on every state change, not keep counting today's cumulative time in that state.

**Note on behavior vs. the pre-rework version:** the original 5-fixed-key implementation read `entry.state === state ? live : base[state]` (either/or, not additive) for the current state, which under-counted a state's same-day total once the machine re-entered it a second time (investigated 2026-07-07, a fix was written/reverted at the time — see prior git history). This rewrite's dynamic `Record<number, number>` model naturally accumulates additively instead (`perState[entry.state] = (perState[entry.state] ?? 0) + liveSeconds`), which incidentally fixes that under-count as a side effect of the generalization — not a deliberately separate fix.

---

## `rolloverIfNewDay()`
Runs every tick (cheap string compare against `seedDate`). On a day boundary: resets every entry's `base` to zero, but **keeps `since`** — so a machine that has been continuously `ACTIVE` across midnight keeps counting Active time uninterrupted into the new day's total, rather than resetting to 0 at midnight.

---

## Consumers

| Consumer | Usage |
|---|---|
| `MachineBoardComponent` | `snapshot(key)` per machine in `checkStatus()`/`refreshDurations()`, refreshed on its own local 1s `interval` (does not use the `tick` signal) — `durations` (incl. `lastSeenAt`) is bound straight through to `machine-status-card`'s `[durations]` input |
| `MachineOverviewComponent` | `snapshot(machineKey)` via its own `timer(0, 1000)` (also does not use the `tick` signal) — feeds the left "today · live" panel, unrelated to the page's date-range-filtered charts/OEE tiles, **and** the header's "Last seen" text (`durations.lastSeenAt`) |
| `MachineStatusCardComponent` | Reads `lastSeenAt` off its bound `[durations]` input (whichever surface bound it — board or overview) via its own `lastSeenAt` getter — Detailed branch only, see [MACHINE_STATUS_CARD_COMPONENT_CONTEXT.md](MACHINE_STATUS_CARD_COMPONENT_CONTEXT.md) |
| `MachineRuntimeHistoryService` | Reuses only the exported `MachineStateEventRow` interface (not `snapshot()` or the live tracker) for its own historical range queries over `MachineStateEvents` — see [MACHINE_RUNTIME_HISTORY_SERVICE_CONTEXT.md](MACHINE_RUNTIME_HISTORY_SERVICE_CONTEXT.md) |

Neither `snapshot()` consumer actually reads the `tick` signal reactively (both poll independently on their own timers) — `tick` exists as a public reactive hook for future `computed()`-based consumers but is not exercised by the current codebase.

There is no more `toActivity()`/`normalizeActivity()` string-normalization step anywhere in this service — `machine_state_id` arrives as a real number on both the seed query and the socket payload, so there's nothing to parse or validate against a fixed vocabulary.

---

## Known Gaps
- The `machine_maintenance_recount` correction only fires for a *broken* verification window. While a window is still pending (unconfirmed), the live-ticking portion of `perState`/`total` shows Active in real time, same as the board — no "provisional Maintenance" overlay exists for the in-progress waiting period. If that's ever wanted (attribute live pending time to Maintenance *before* the outcome is known, not just retroactively on a break), it needs a second signal (window started) and a live overlay in `snapshot()`, not just this one-shot correction.
- This service now listens to `machine_status_runtime` (transition-only, low-frequency) **and** `to_frontend` (every telemetry tick — `lastSeenAt` plus, now, a `current` self-heal from `STATUS`) while `MachineBoardComponent` separately listens to `to_frontend` again (for its own status badge + temp/rpm/shot-count) — two consumers of the same batched event, each reading different fields; this is an accepted duplicate subscription (Socket.IO client tolerates multiple listeners on one event cheaply) rather than a shared-state refactor, to keep this service decoupled from the board component. Requires `MachineStatesService`'s name→id map (`getByName`) to already be loaded — loaded once by `ProductionModule`'s own constructor before any routed component mounts (see `MachineOverviewComponent`'s own context doc) — but is safely a no-op (silently skipped) on any tick where it isn't yet, self-healing on the next tick once it is.
- `tick` signal is unused by current consumers — either wire real consumers to it (removing their redundant local timers) or drop it if it stays unused.
- `MachineStateEvents` uses raw string interpolation for the `started_at` datetime filter in the seed query (`ge ${midnightIso}`) — `midnightIso` is generated locally (`new Date().toISOString()`), not user input, so this is not an injection risk, but confirm OData filter value quoting conventions if this pattern is copied elsewhere with user-controlled input.
