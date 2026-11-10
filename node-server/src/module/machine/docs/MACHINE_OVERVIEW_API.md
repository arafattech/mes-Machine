# Machine Overview API (`/api/machine/:id/overview`)

This document outlines the architecture and calculation logic behind the Machine Overview endpoint. This endpoint serves the primary dashboard for a specific machine, providing aggregated production statistics and Overall Equipment Effectiveness (OEE) over a specific date range.

## Overview

The endpoint is served by `MachineCalculationsController` and implemented in `MachineCalculationsService`. It computes aggregations over the specified `[from, to)` date range for a single machine.

### Caching
The results are cached in Redis with a short TTL, `MACHINE_CALC_CACHE_TTL_MS` (default 8 seconds). The key embeds the machine's **calc version** (`machine:calc:ver:machine:{id}`). That version is bumped:
- on every production, wastage, config, target or work-order write (`ProductionRealtimeService`, via the `mes:production-events` Redis channel);
- on every persisted state transition (`MachineStateTrackerService`).

A refetch triggered by a realtime push therefore never gets a pre-change result. Overview queries run in parallel (`Promise.all`). See `Frontend/docs/production-management/REALTIME_PRODUCTION_EVENTS.md`.

---

## OEE Calculation Logic

The OEE displayed on the Machine Overview dashboard (Efficiency, Availability, Performance, Quality) is computed dynamically over the exact date range requested by the user.

### 1. Fetching State Events
The service fetches all `machine_state_events` for the specific machine that overlap with the `[from, to)` date window.
- **Open events:** `ended_at IS NULL` or `ended_at > from`
- **Bounds:** `started_at < to`

### 2. Clipping Event Durations (`productiveSecondsInRange`)
Each fetched state event is **clipped** to the exact `[from, to)` window to ensure that time spent outside the selected date range is not counted.
- **Total Seconds:** The sum of all clipped durations of every recorded state event within the window.
- **Active Seconds:** The sum of clipped durations specifically for states flagged as `counts_as_productive` in the `machine_states` table.

### 3. Aggregating Production Counts
The service aggregates (`_sum`) `good_count`, `scrap_count`, and `total_count` from `machine_production_counts` buckets that fall within the `[from, to)` date window. 

### 4. Metric Computations

#### Availability (Product Availability)
The percentage of the total elapsed machine time that was spent in a productive state.
- **Formula:** `(Active Seconds / Total Seconds) * 100`
*(Note: Total Seconds is the sum of all recorded states. If the machine was offline or lacked data, that time is excluded from the denominator.)*

#### Performance (M/C Performance)
The speed at which the machine operated compared to its configured ideal cycle time.
- **Ideal Cycle Time:** Fetched from `machine_has_configs.ideal_cycle_seconds`.
- **Formula:** `((Total Count * Ideal Cycle Seconds) / Active Seconds) * 100`
*(Capped at a maximum of 100%)*

#### Quality
The percentage of good output versus total output, where the total includes kg logged in the Wastage Log (`machine_wastage_allocations` by `entry_date`).
- **Formula:** `(Good Count / (Total Count + Logged Wastage kg)) * 100`

#### Efficiency (M/C Efficiency / Overall OEE)
The overall effectiveness score for the machine over the date range.
- **Formula:** `(Availability * Performance * Quality) / 10000`

---

## Practical Example Calculation

If an API request like `GET /api/machine/1/overview?from=2026-07-31T18:00...` returns the following OEE block:

```json
"oee": {
    "availability": 97.1,
    "performance": 25.4,
    "quality": 93,
    "efficiency": 22.9
}
```

Here is exactly how the backend calculated these numbers:

1. **Availability (97.1%)**: The machine spent 97.1% of its total recorded time in a productive/active state, while 2.9% of the time was spent in non-productive states (like Idle or Fault).
2. **Performance (25.4%)**: During the active time, the machine was running at 25.4% of its maximum ideal speed (`ideal_cycle_seconds`). Meaning, it could have produced almost 4 times more items during that time if running at optimal speed.
3. **Quality (93%)**: Out of all the items produced, 93% were good (`good_count`), and the remaining 7% were scrap (`scrap_count`).
4. **Efficiency (22.9%)**: Overall Equipment Effectiveness (OEE) is calculated by multiplying the three factors together:
   - `(97.1 * 25.4 * 93.0) / 10000 = 22.937...`
   - Rounded to one decimal place (`round1`), this gives exactly **22.9%**.

---

## Other Overview Metrics

Along with OEE, the endpoint provides:
- **Target:** The production target (`target_qty`) fetched from the most recently effective row in `machine_production_targets`.
- **Achieved / Total:** The sum of `total_count`. This is the machine's own counts; logged wastage is not included.
- **Ok (Good):** The sum of `good_count`.
- **Waste:** `scrap_count` sum + logged wastage kg. `logged_wastage_kg` reports the logged part on its own.
- **`live`** (realtime OEE inputs): `{computed_at, age_ms, active_seconds, total_seconds, open_state_productive, ideal_cycle_seconds, total_count, good_count, quality_total}`.
  - `open_state_productive` is `null` when no state is open or the window ended in the past.
  - `age_ms` is added outside the cache: how old the snapshot is, on the server clock.
  - The frontend (`MachineOverviewDataService.liveOeeMetrics`) advances the OEE tiles every second from these inputs, using the same formulas. **Keep both in sync.**
