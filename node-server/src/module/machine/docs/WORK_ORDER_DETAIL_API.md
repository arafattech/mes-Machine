# Work Order Detail API (`/api/work-orders/:id/detail`)

This document outlines the architecture and calculation logic behind the Work Order Detail endpoint. This read-heavy endpoint aggregates production data and computes Overall Equipment Effectiveness (OEE) for a specific work order.

## Overview

The endpoint is served by `WorkOrderDetailController` and implemented in `WorkOrderDetailService`. It performs an execution rollup: aggregating production counts across all machines and shifts that logged production for the given work order, and computing accurate OEE metrics (Availability, Performance, Quality, and overall Efficiency).

### Caching
The results of this calculation are cached in Redis using a short Time-To-Live (TTL), configured by `MACHINE_CALC_CACHE_TTL_MS` (defaulting to 8 seconds). This absorbs repeated dashboard polling without serving stale data during active production.

---

## Data Rollup Strategy

### 1. Machine & Shift Rollup
The service fetches all `machine_production_counts` buckets tied to the `work_order_id`. It groups these buckets by a composite key of `machine_id` + `shift_id`.
For each combination, it calculates:
- **Good / Scrap / Total Counts:** Summed up across all buckets.
- **Start / End Times:** The earliest `bucket_started_at` and latest `bucket_ended_at` across the buckets.

These grouped rows form the `machines` array in the JSON response, representing exactly what ran and when.

### 2. Machine Engagement Window
Independently of shifts, the service computes a continuous "engagement window" for each machine involved. This is the absolute earliest start time to the absolute latest end time that the machine spent working on this work order. This window is crucial for accurately clipping machine state events during OEE calculation.

---

## OEE Calculation Logic

The `computeOee` method calculates both **Overall OEE** (aggregated across all machines) and **Per-Machine OEE**.

### 1. Fetching State Events
Using the overall earliest and latest timestamps across all machine windows, the service queries `machine_state_events`. It splits this into two queries for index optimization:
- **Open events:** `ended_at IS NULL` and `started_at < overallEnd`
- **Closed events:** `ended_at > overallStart` and `started_at < overallEnd`

### 2. Clipping Event Durations
Instead of taking the raw duration of an event, the service **clips** each state event to the specific machine's engagement window. If an event started before the work order began on that machine, only the portion of time overlapping with the work order's window is counted.
- **Active Seconds:** Sum of clipped durations where the state is flagged as `counts_as_productive`.
- **Total Seconds:** Sum of all clipped durations inside the window.

### 3. Metric Computations

#### Availability
The percentage of total time the machine(s) spent in a productive state.
- **Formula:** `(Active Seconds / Total Seconds) * 100`

#### Performance
The speed at which the machine(s) operated compared to the ideal cycle time.
- **Per-Machine:** Uses the specific machine's `ideal_cycle_seconds` from `machine_has_configs`.
- **Overall:** Uses the **average** `ideal_cycle_seconds` across all involved machines.
- **Formula:** `((Total Count * Ideal Cycle Seconds) / Active Seconds) * 100`
*(Capped at 100%)*

#### Quality
Good output versus total output, where the total includes kg logged via the Wastage Log against this work order (`machine_wastage_allocations` → `machine_wastage_entries.work_order_id`, fetched in parallel with the count buckets). This is the same rule as `/api/machine/:id/overview`, so the work-order and machine screens agree.
- **Formula:** `(Good Count / (Total Count + Logged Wastage kg)) * 100`. The same applies per machine using that machine's allocation.
- `totals.logged_wastage_kg` reports the logged kg.

#### Efficiency (Overall OEE)
The overall effectiveness score.
- **Formula:** `(Availability * Performance * Quality) / 10000`

---

## Response Structure

The endpoint returns a structured JSON object containing:
- `work_order`: Core WO details (target quantity, scheduled/actual start, planned machines).
- `machines`: The execution rollup array (grouped by machine and shift).
- `totals`: Aggregated good/scrap/total counts and percentage complete.
- `oee`: The Overall OEE metrics object.
- `oee_by_machine`: A dictionary mapping `machine_id` to its specific OEE metrics.
