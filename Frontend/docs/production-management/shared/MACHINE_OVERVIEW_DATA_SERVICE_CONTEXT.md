# MACHINE_OVERVIEW_DATA_SERVICE — Service Context

## Overview

| Property | Value |
|---|---|
| **File** | `shared/services/machine-overview-data.service.ts` |
| **Class** | `MachineOverviewDataService` |
| **Provided in** | `root` |
| **Purpose** | Consumption-side abstraction for everything `MachineOverviewComponent` needs: machine specs, production/OEE summary, shift-wise state breakdown, current work-order/shift, work-order execution rollup, assigned-work-orders pick-list, shift master, and manual production-count logging. Every method hits a real backend endpoint — split across Laravel and node-server (see below). |

Originally scaffolded as a mock-backed placeholder (per the enhancement plan's "isolate the mock behind a service so swapping to real data is a method-body change, not a component rewrite" design). All methods are now real; the scaffold's purpose has been fulfilled.

---

## Backend split: Laravel vs node-server

This service is the one place that reflects the deliberate architecture split made this session: **all read-heavy calculation endpoints for the machine-overview page moved from Laravel to node-server (NestJS/Prisma)**, since node-server already owns the write-side of `machine_state_events`/`machine_production_counts` (MQTT/API/MODBUS ingestion). **CRUD stays in Laravel** — work-order create/update, the assigned-work-orders pick-list, and the manual production-count POST are unaffected.

| Method | Backend | `isv8` flag | Endpoint |
|---|---|---|---|
| `getSpecs` | Laravel (OData/Lodata) | omitted (OData default) | `MachineHasConfigs?$filter=...` |
| `getOverview` | **node-server** | `true` | `GET /api/machine/{id}/overview` |
| `getShiftBreakdown` | **node-server** | `true` | `GET /api/machine/{id}/shift-breakdown` |
| `getCurrentWorkOrderShift` | **node-server** | `true` | `GET /api/machine/{id}/current-work-order` |
| `getWorkOrderDetail` | **node-server** | `true` | `GET /api/work-orders/{id}/detail` |
| `getWorkOrderWastageDetail` | **node-server** | `true` | `GET /api/work-orders/{id}/wastage-detail` |
| `getAssignedWorkOrders` | Laravel (REST) | `false` | `GET /api/machine/{id}/work-orders` |
| `getActiveShifts` | Laravel (OData/Lodata) | omitted | `EmployeeShifts?$filter=is_active eq true&...` |
| `logProductionCount` | Laravel (REST) | `false` | `POST /api/machine/{id}/production-count` |

`isv8=true` routes through `CommonService.get()`'s `v8Prefix + '/odata/v8'` branch — despite the name, node-server's calculation routes are mounted under this same prefix on the reverse proxy, not literally OData v8; see `CommonService.get()`'s third-parameter contract before adding a new node-server call here. Node-server routes are behind `AuthMiddleWare` for `'api/machine/*path'` and `'api/work-orders/*path'` (`node-server/src/app.module.ts`), same Sanctum-token auth as Laravel.

---

## Public API

### `getSpecs(machineKey)`
`(string) => Observable<MachineSpecs>` — real, `MachineHasConfigs?$filter=machine_id eq {key} and is_active eq true&$select=max_rpm,min_rpm,max_temp,min_temp`. Falls back to `{maxRpm:0,minRpm:0,maxTemp:0,minTemp:0}` on empty result or error.

### `getOverview(machineKey, from, to)`
`(string, Date, Date) => Observable<{production: ProductionSummary, oeeMetrics: Metric[]}>` — **node-server**, `GET /api/machine/{id}/overview?from&to`. Backend returns:
```ts
{
  target: number; achieved: number; ok: number; total: number; waste: number;
  oee: { availability: number|null; performance: number|null; quality: number|null; efficiency: number|null; }
}
```
Mapped to `production: ProductionSummary` (`periodLabel` formatted client-side from `from`/`to`, `unit: 'kg'` hardcoded) and `oeeMetrics: Metric[]` — **all 4** in fixed order `[Availability, Performance, Quality, Efficiency]`, each via `toMetric(label, value)` mapping `null → 0` and attaching presentational `icon`/`color` from `OEE_TILE_META`.

**Deliberate design point**: all 4 OEE metrics come from this one call, over the one window the caller passes — Availability is intentionally **not** computed independently/live elsewhere on the frontend (an earlier version did this and drifted from the Efficiency tile's baked-in value; confirmed as a real inconsistency and removed). See [MACHINE_OVERVIEW_COMPONENT_CONTEXT.md](MACHINE_OVERVIEW_COMPONENT_CONTEXT.md).

### `getShiftBreakdown(machineKey, from, to)`
`(string, Date, Date) => Observable<ShiftBreakdownRow[]>` — **node-server**, `GET /api/machine/{id}/shift-breakdown?from&to`. One row per (day × shift) inside `[from, to)` — reconstructs each active `EmployeeShifts` row's real datetime window per calendar day (same overnight-wraparound idiom used elsewhere in the codebase: `if (end <= start) end.addDay()`), clips the range's `machine_state_events` into that window, and accumulates Active/Idle/Inactive/Maintenance seconds per row (`fault` excluded). Backend returns seconds; this method converts to hours (`/3600`) at the service boundary. Empty array on error or no active shifts.

### `getCurrentWorkOrderShift(machineKey)`
`(string) => Observable<CurrentWorkOrderShift>` — **node-server**, `GET /api/machine/{id}/current-work-order`. The single latest `machine_production_counts` bucket for this machine — **not** windowed by the page's date-range filter ("what's running now" isn't a historical-report concept). Returns `{workOrder: null, shift: null}` (rendered as an empty state) until at least one bucket has been logged for this machine.

### `getWorkOrderDetail(workOrderId)`
`(number) => Observable<WorkOrderDetail>` — **node-server**, `GET /api/work-orders/{id}/detail`. The execution rollup: groups every `machine_production_counts` row logged against this work order by `(machine, shift)`, sums good/scrap/total, plus first/last-logged timestamps, plus the WO's `planned_machines` (from `work_order_machines`, independent of whether anything's been logged yet) and a `totals` block with `percentComplete` (`good / quantityTarget × 100`, clamped server-side at 100 — `WorkOrderDetailService.detail()`'s `Math.min(100, ...)`). Planned vs executed machines can diverge — see [work-order-and-log-production.md](../work-order-and-log-production.md#2-data-model).

Also returns `oee_by_machine` (per-machine Availability/Performance/Quality/Efficiency, keyed by `machine_id`) alongside the WO-wide `oee` aggregate — mapped here to `WorkOrderDetail.oeeByMachine: Record<number, Metric[]>` via the same `toMetric()`/`OEE_TILE_META` used for `oeeMetrics`. Unlike the WO-wide figure (which averages `ideal_cycle_seconds` across every machine on the WO), each machine's own Performance uses its own configured `ideal_cycle_seconds` — exact, not averaged. Consumed by `MachineWorkOrderOverviewComponent` for its "This Machine's OEE" tiles — see [MACHINE_WORK_ORDER_OVERVIEW_COMPONENT_CONTEXT.md](MACHINE_WORK_ORDER_OVERVIEW_COMPONENT_CONTEXT.md).

### `getWorkOrderWastageDetail(workOrderId, filter?)`
`(number, {shiftId?, date?}) => Observable<WorkOrderWastageDetail>` — **node-server**, `GET /api/work-orders/{id}/wastage-detail?shift_id=&date=`. Rollup over `machine_wastage_entries`/`machine_wastage_allocations` for this work order: `byType` (one row per wastage type — `totalQtyKg`, `percentOfTotal`) and `allocationsByType` (that type's per-machine split, keyed by `wastageTypeId`). Both `shiftId`/`date` are optional filters — omitting both gives the whole-work-order total; either or both narrow to "per shift per WO" / "per day per WO". Writes (and the proportional-to-output-share distribution across machines) live in Laravel — see `ProductionLogService.submitWastage()`; this method is read-only. `{totalQtyKg: 0, byType: [], allocationsByType: {}}` on error or a falsy `workOrderId`.

### `getAssignedWorkOrders(machineKey)`
`(string) => Observable<AssignedWorkOrder[]>` — **Laravel REST**, `GET /api/machine/{id}/work-orders`. Work orders planned for this machine (via `work_order_machines`) with status `pending`/`in_progress` — the pick-list `LogProductionEntryComponent` populates its Work Order dropdown from.

### `getActiveShifts()`
`() => Observable<ShiftOption[]>` — **Laravel OData**, `EmployeeShifts?$filter=is_active eq true&$select=id,name,start_time,end_time,color`. The plant-wide shift master, reused as-is (not duplicated) for the Log Production dialog's Shift dropdown.

### `logProductionCount(machineKey, payload)`
`(string, {workOrderId, shiftId, goodCount, scrapCount}) => Observable<void>` — **Laravel REST**, `POST /api/machine/{id}/production-count`. Forwards the operator's inputs as snake_case; the backend computes `total_count` and the bucket's time window server-side (never trusts a client-supplied total) — see `MachineController::logProductionCount`.

On any HTTP error, every read method falls back to a zeroed/null/empty shape rather than propagating the error — the page always renders, just with 0s or an empty grid.

---

## Consumers

| Consumer | Usage |
|---|---|
| `MachineOverviewComponent` | `getSpecs`, `getOverview`, `getShiftBreakdown` — all 3 called once per `loadOverviewData()` (page load, filter change, or Reset); `getCurrentWorkOrderShift` — called from `ngOnInit` and after a manual log (`onProductionLogged`) |
| `WorkOrderDetailComponent` | `getWorkOrderDetail`, called from `ngOnChanges` whenever `[workOrderId]` changes; `getWorkOrderWastageDetail`, called from the same `ngOnChanges` and again on every shift/date filter change in the "Wastage by Type" section; `getActiveShifts`, called once from the constructor for that section's shift filter |
| `LogProductionEntryComponent` | `getAssignedWorkOrders`, `getActiveShifts` (both on dialog open), `logProductionCount` (on submit) |

---

## Known Gaps
- `unit: 'kg'` is hardcoded in both the real response mapping and the empty fallback — no product-level unit-of-measure is wired in yet.
- Backend `oee.availability`/`performance`/`quality`/`efficiency` return `null` (not just a low number) until their prerequisite data exists — see [MISSING_INPUTS.md](../../../src/app/modules/production-management/shared/components/machine-overview/MISSING_INPUTS.md) for exactly what's missing per metric.
- No live polling — every method here is called on-demand (page load / filter change / dialog open / post-submit), never on an interval. Two operators logging against the same work order from different machines only see each other's update after their own next fetch.
