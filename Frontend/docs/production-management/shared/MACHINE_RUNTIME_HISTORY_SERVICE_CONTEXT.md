# MACHINE_RUNTIME_HISTORY_SERVICE — Service Context

## Overview

| Property | Value |
|---|---|
| **File** | `shared/services/machine-runtime-history.service.ts` |
| **Class** | `MachineRuntimeHistoryService` |
| **Provided in** | `root` |
| **Purpose** | Historical reporting over `MachineStateEvents` for an arbitrary caller-supplied date range — per-day, per-`machine_state_id` hours breakdown, and raw event rows for drill-down. |

Deliberately separate from `MachineDurationService`, which is a live "today only" singleton tracker fed by a socket stream — this service is a stateless, on-demand range-query service. Mixing the two would conflate a live cache with reporting; see [MACHINE_DURATION_SERVICE_CONTEXT.md](MACHINE_DURATION_SERVICE_CONTEXT.md).

Injects `MachineStatesService` — needed to resolve `counts_as_productive` (for `toActiveHours`) and per-state label/color (for `toStateDatasets`).

---

## Exported Type

```ts
interface DailyStateBreakdown {
  date: Date;
  hoursByState: Record<number, number>; // hours, keyed by machine_state_id
}
```

**No more fixed Active/Idle/Inactive fields, and no more Maintenance/Fault exclusion.** The old version hardcoded `active`/`idle`/`inactive` fields and silently dropped any event row whose state wasn't one of those three (so Maintenance/Fault never appeared on the Activity bar chart at all — a real, previously undocumented gap). `hoursByState` includes every state actually observed in the range — one entry per `machine_state_id` — and nothing is excluded.

---

## Public API

| Member | Signature | Purpose |
|---|---|---|
| `getEventsInRange(machineKey, start, end)` | `(string, Date, Date) => Promise<MachineStateEventRow[]>` | Raw rows overlapping `[start, end)` — OData query: `MachineStateEvents?$filter=machine_id eq {key} and started_at le {end} and (ended_at eq null or ended_at ge {start})&$orderby=started_at asc`. Used directly for drill-down and internally by `getDailyBreakdown` |
| `getDailyBreakdown(machineKey, from, to)` | `(string, Date, Date) => Promise<DailyStateBreakdown[]>` | One entry per calendar day in `[from, to)`, including zero-activity days (no gaps) — per-state hours computed by clipping+splitting each event row |
| `toActiveHours(breakdown)` | `(DailyStateBreakdown[]) => DateHours[]` | Pure sync mapper: `{date, hoursRun}`, where `hoursRun` sums `hoursByState[id]` across every `id` in `MachineStatesService.getProductiveIds()` — feeds `LineChartComponent`. Generalized from a hardcoded "active" field to "any productive state" |
| `toStateDatasets(breakdown)` | `(DailyStateBreakdown[]) => ChartDataset[]` | Pure sync mapper: one series per distinct `machine_state_id` actually observed across `breakdown` (sorted by id), each `{x: formattedDateLabel, y: hours}`, colored via `MachineStatesService.getColor(stateId)` and labeled via `getLabel(stateId)` — feeds `BarChartComponent`. Replaces the old hardcoded 3-series `BAR_SERIES` constant (Tailwind green/orange/red) entirely |

`MachineStateEventRow` is imported from `machine-duration.service.ts` (exported there) rather than redefined here.

---

## Core Algorithm

1. **`clip(row, start, end)`** (private) — clips one event's `[started_at, ended_at ?? now]` interval to the query window; returns `null` if there's no overlap. Uses `Math.max`/`Math.min` on epoch ms, not Carbon-style date objects (this is the frontend/TS side; the equivalent Laravel-side clip lives in node-server's `machine-calculations.service.ts`, using `moment.max()`/`min()` — same logic, different language).
2. **`splitByDay(fromMs, toMs)`** (private) — walks the clipped interval in local-midnight-aligned chunks, so an event crossing midnight is correctly attributed to both days instead of miscounted into one.
3. **`getDailyBreakdown`** — for each event row in range: skip if `machine_state_id == null`, clip to window, split by day, accumulate ms per `(dayKey, machine_state_id)`. Then walks every calendar day from `from` to `to` (inclusive of zero-activity days) building the final array — this is what guarantees charts show a continuous date axis with no gaps even when a machine was fully idle/off for a stretch. If a day's summed state time exceeds 24h (overlapping/duplicate `MachineStateEvents` rows), every state's ms for that day is scaled down proportionally (`MS_PER_DAY / totalRawMs`) so the bar still totals 24h — states are never dropped. (A prior version capped greedily per state in ascending `machine_state_id` order, which always gave Active — id 1 — the full 24h budget first and silently zeroed every other state for that day.)

---

## Consumers

| Consumer | Usage |
|---|---|
| `MachineOverviewComponent` | `getDailyBreakdown` (feeds both charts via the two mapper methods) + `getEventsInRange` directly (drill-down dialog rows) |

---

## Known Gaps
- No hard cap on requested range size — a multi-year date-range-filter selection will fetch and render every day in that span (no server page cap either — Lodata's `pagination.max` is `null`). Not guarded; flag if a UI safeguard is wanted.
- `toStateDatasets`'s date-label formatting (`"Jul 5"`, no year) is ambiguous across a range spanning more than one year — acceptable today since the date-range picker's practical use is weeks/months, not multi-year spans.
