# PRODUCTION_LOG_SERVICE — Service Context

## Overview

| Property | Value |
|---|---|
| **File** | `shared/services/production-log.service.ts` |
| **Class** | `ProductionLogService` |
| **Provided in** | `root` |
| **Purpose** | Data access for the global "Plan & Production Log" page (`ProductionLogListComponent`) and its two entry modals: `ProductionLogFormComponent` (batch good-count entry) and `LogWastageComponent` (wastage-by-type entry, distributed across machines) — work-order-centric, multi-machine, distinct from `MachineOverviewDataService`'s per-machine `/mco` methods |

Shift options are deliberately **not** duplicated here — the form injects `MachineOverviewDataService` directly and calls its existing `getActiveShifts()` (the shared `EmployeeShifts` OData lookup).

---

## Public API

| Member | Type | Purpose |
|---|---|---|
| `getWorkOrderMachines(workOrderId)` | `Observable<ProductionLogEntryRow[]>` | `GET /odata/WorkOrders(${id})?$expand=machines` — every machine planned against the work order (via `work_order_machines`), mapped to one row each with `goodCount: null`. Feeds the entry tab's editable grid. Single-entity fetch (no `$orderby`/`$count`), confirmed unaffected by the Lodata bug described below — live-tested, `machines[]` comes through fine |
| `submitProductionLog(workOrderId, {date, shiftId, entries})` | `Observable<void>` | `POST /api/work-orders/{id}/production-counts` (Laravel, `isLodata=false`) — batch write, one `machine_production_counts` row per entry |
| `getGroupDetail(workOrderId, shiftId, date)` | `Observable<any[]>` | `GET /api/work-orders/{id}/production-logs?shift_id=&date=` — the per-machine rows behind one (work order, shift, day) group on `ProductionLogListComponent`'s grid (that grid shows a machine *count*, not a machine per row — see `PRODUCTION_LOG_LIST_COMPONENT_CONTEXT.md`). Same endpoint the History tab calls with no filters; here scoped down to exactly one group. Returns `[]` on error or a falsy `workOrderId` |
| `getEligibleWastageTypes(workOrderId)` | `Observable<EligibleWastageType[]>` | `GET /api/work-orders/{id}/eligible-wastage-types` — wastage types shared by at least one machine currently assigned to the work order (`Machine::machinewastagetypes()`, unioned + deduped server-side). Populates `LogWastageComponent`'s type picker once a work order is chosen; `[]` on error or a falsy `workOrderId` |
| `submitWastage(workOrderId, {wastageTypeId, shiftId, date, qtyKg})` | `Observable<void>` | `POST /api/work-orders/{id}/wastages` — logs one total-kg wastage entry for one type against the work order, optionally scoped to a shift. Forwards the operator's inputs as snake_case; the backend does the actual work (see below) |

The list grid (`ProductionLogListComponent`) itself does **not** go through this service for its main data — it wires `AgGridTableODataSourceConfig` directly to `MachineController::productionLogs`. `getGroupDetail()` above is what its info-icon drill-down uses.

---

## Backend — `WorkOrderController::logProductionCounts` (Laravel)

New method alongside the existing `store`/`update` (work-order planning CRUD stays in this controller; this is execution logging, kept here rather than `MachineController` because it's naturally work-order-scoped — symmetric to node-server's `GET /api/work-orders/{id}/detail`).

Request body: `{ date: string, shift_id: number, entries: [{ machine_id: number, good_count: number }] }`.

1. Validates `date`, `shift_id` (`exists:employee_shifts,id`), `entries` (min 1), each `entries.*.machine_id`/`entries.*.good_count`.
2. Confirms every `machine_id` in `entries` is actually assigned to this work order (`$workOrder->machines()->pluck('machines.id')`) — `422` otherwise, same guard shape as `MachineController::logProductionCount`'s single-machine assignment check.
3. Resolves the bucket window from the shift's own `start_time`/`end_time` combined with the picked `date` (`resolveShiftWindow()`) — rolls the end forward a day if `end <= start` (overnight shift). This is a deliberate difference from `MachineController::logProductionCount`, which has no date input and always chains from "this machine's last bucket end (or 1h ago) to now" — that logic only makes sense for live, undated entry.
4. Inside a `DB::transaction()`, creates one `MachineProductionCount` row per entry: `scrap_count` always `0`, `total_count` = `good_count` (scrap isn't collected by this flow — confirmed with the requester, unlike the per-machine `/mco` dialog which still collects both).
5. Always additive — no upsert lookup by `(work_order_id, machine_id, shift_id, date)`. Resubmitting the same combination creates another row, matching `MachineController::logProductionCount`'s existing audit-trail semantics (confirmed deliberately, not assumed).

Route: `POST work-orders/{id}/production-counts` in `Backend/routes/api.php`, same `auth:sanctum` group as the other work-order/machine routes.

---

## Backend — `WorkOrderController::logWastage` + `::eligibleWastageTypes` (Laravel)

New tables: `machine_wastage_entries` (the append-only ledger — one row per manually-entered total) and `machine_wastage_allocations` (the computed per-machine split, stored rather than recomputed on read). Two new models, `App\Models\MachineWastageEntry`/`MachineWastageAllocation`.

Request body (`logWastage`): `{ wastage_type_id: number, shift_id?: number, date: string, qty_kg: number }`.

1. Validates `wastage_type_id` (`exists:machine_wastage_types,id`), `shift_id` (nullable, `exists:employee_shifts,id`), `date` (required), `qty_kg` (`min:0.01`).
2. Resolves eligible machines: this work order's assigned machines (`work_order_machines`) that also carry this wastage type (`Machine::machinewastagetypes()`, via `whereHas`) — `422` if none.
3. Computes each eligible machine's share of `machine_production_counts.total_count` within the same scope (`work_order_id` + `whereDate('bucket_started_at', date)`, optionally narrowed by `shift_id`). Falls back to an equal split (`production_share: null`) when the scope has zero production logged yet — there's no output to weight by.
4. Inside a `DB::transaction()`: inserts one `MachineWastageEntry` row (the source-of-truth total), then one `MachineWastageAllocation` row per eligible machine — `allocated_qty_kg` per machine rounded to 2dp, with the **last** machine absorbing the rounding remainder so the allocations sum **exactly** to `qty_kg` (never silently drifts from what was actually entered).
5. Always additive, same audit-trail convention as `logProductionCounts` — no edit/delete endpoint exists.

`eligibleWastageTypes($id)` — plain read helper: the distinct `machine_wastage_types` shared by at least one of this work order's assigned machines, feeding `LogWastageComponent`'s type picker so an operator can't pick a type nothing on this WO can absorb. Deliberately a custom endpoint rather than nested OData `$expand=machines.machinewastagetypes` (a 2-level expand, on top of this app's already-confirmed Lodata expand quirks on adjacent entities).

Routes: `POST work-orders/{id}/wastages`, `GET work-orders/{id}/eligible-wastage-types` in `Backend/routes/api.php`, same `auth:sanctum` group. Reporting reads (per-type, per-machine-within-type, optionally shift/date-scoped) live in node-server — `WorkOrderWastageService`/`WorkOrderWastageController`, alongside `WorkOrderDetailService` — see `MACHINE_OVERVIEW_DATA_SERVICE_CONTEXT.md#getworkorderwastagedetailworkorderid-filter`.

## Backend — OData relationship exposure (superseded for listing, kept for the entity itself)

`MachineProductionCount` was already `Lodata::discover()`'d in `AppServiceProvider::boot()` but had zero `discoverRelationship()` calls — `$expand=machine,workOrder,shift` returned nothing useful before this feature. Three lines were added right after the existing `Lodata::discover(MachineProductionCount::class);` call to expose all three `belongsTo` relations.

**This turned out not to be usable for the list/history grids.** Live-testing (direct requests against the running app, not just reading the code) found combining `$expand` with **either** `$orderby` **or** `$count=true` on `MachineProductionCounts` silently drops the expanded objects — 200 OK, but `machine`/`workOrder`/`shift` are just missing from the response. Reproduces with a single relation, and even ordering by the plain `id` column — not specific to a relation or sort field. Confirmed specific to this entity: `WorkOrders?$expand=product,machines&$orderby=...` (already used elsewhere in the app) returns nested objects fine. Since the grid's infinite-scroll mode always sends both, OData was a dead end for anything wanting expanded names in a sorted/counted list. The `discoverRelationship()` calls were left in `AppServiceProvider` regardless (harmless) in case a future non-listing use case needs them.

## Backend — the actual fix: plain Eloquent REST endpoints

Two new read endpoints, both deliberately **not** OData, both manually paginated via `$top`/`$skip` (the same param names the grid already sends), `{data, total}` response for `fromCustomPaginator: true`:

| Endpoint | Controller method | Scope |
|---|---|---|
| `GET /api/production-logs` | `MachineController::productionLogs()` | Every log, system-wide, **grouped** by `(work_order_id, shift_id, DATE(bucket_started_at))` — `ProductionLogListComponent`'s grid. A raw `MachineProductionCount::with([...])->orderByDesc(...)` list originally; redesigned per the requester to group and roll up (`COUNT(DISTINCT machine_id)`, `SUM(good_count)`, etc.) — see `PRODUCTION_LOG_LIST_COMPONENT_CONTEXT.md` for the full query and why |
| `GET /api/work-orders/{id}/production-logs` | `WorkOrderController::productionLogs($id)` | One work order, raw per-machine rows (`with(['machine:...', 'shift:...'])`, no grouping) — `ProductionLogFormComponent`'s History tab (no extra filters) **and** `ProductionLogListComponent`'s per-group drill-down (`?shift_id=&date=`, added when this endpoint started serving double duty) |

Both live in the controller that already owns a related concern (`MachineController` already writes `MachineProductionCount` via `logProductionCount`; `WorkOrderController` already owns everything else under `work-orders/{id}/...`) rather than a new dedicated controller, per this module's "match local convention, don't introduce a new layer for one method" precedent.

Neither endpoint parses `$filter`/`$orderby` from the grid — see the components' own Known Gaps for the resulting no-sort/no-search trade-off. `WorkOrderController::productionLogs`'s `shift_id`/`date` params are plain query params it reads itself (`$request->filled(...)`), unrelated to the grid's own (unparsed) `$filter`.

---

## Known Gaps
- `machine_production_counts` has indexes on `[machine_id, bucket_started_at]` and `[machine_id, bucket_ended_at]` only (plus single-column FK indexes on `work_order_id`/`shift_id`) — no composite index leads with `work_order_id` or a bare date column. The global list endpoint and the per-WO history endpoint will not use an index as efficiently as the machine-scoped queries elsewhere in this module at high row counts. Not addressed here — flagging for if/when this page's dataset grows large enough to matter.
- The work-order picker in the form queries `WorkOrders?$filter=status eq 'in_progress'`, matching `MachineController::assignedWorkOrders`'s scoping for the per-machine flow.
- No server-side sort/search on either new REST endpoint (see above) — a real capability regression versus a first-class OData list, accepted as the cost of working around the Lodata bug.
