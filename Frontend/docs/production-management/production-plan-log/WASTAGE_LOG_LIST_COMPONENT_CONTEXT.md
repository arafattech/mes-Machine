# WASTAGE_LOG_LIST — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `production-plan-log/wastage-logs/wastage-log-list/wastage-log-list.component.ts` |
| **HTML file** | `production-plan-log/wastage-logs/wastage-log-list/wastage-log-list.component.html` |
| **Selector** | `app-wastage-log-list` |
| **Component type** | Non-standalone (declared in `ProductionModule`) |
| **Route** | `/production/wastage-log` — child of `LayoutComponent` (renders inside the sidenav shell, same as `ProductionLogListComponent`), guarded by `Permissions.WASTAGE_LOG` |
| **Sidebar entry** | "Plan & Production Log" group → "Wastage Log" item, `LayoutComponent.buildNavItems()` |
| **Purpose** | Every logged wastage entry across the whole plant — one row per real `machine_wastage_entries` row, plus the entry point into `LogWastageComponent`'s dialog |

See [work-order-and-log-production.md](../work-order-and-log-production.md) and [../shared/WORK_ORDER_DETAIL_COMPONENT_CONTEXT.md](../shared/WORK_ORDER_DETAIL_COMPONENT_CONTEXT.md) for the two other places wastage data surfaces (per-machine allocation feed and the single-work-order "Wastage by Type" report, respectively).

---

## Grid — flat, one row per entry, not grouped

Unlike `ProductionLogListComponent`'s grid (which groups `machine_production_counts` rows by (work order, shift, day) because a single submission there can write several rows, one per machine), a `machine_wastage_entries` row **already is** one submission — work order + wastage type + optional shift + date + total kg. So this grid lists them flat, no grouping needed:

- **Work Order** / **Wastage Type** / **Shift** (nav-property `valueGetter`s, `colId` set to the dotted nav path)
- **Date** (`entry_date`) / **Qty (kg)** (`qty_kg`)
- **Machines** — icon + `allocations.length` (`AgGridIconTextCellRendererComponent`, same icon-count idiom as `ProductionLogListComponent`'s own Machines column) — how many machines this entry's total got distributed across
- **Logged At** (`created_at`)

Every column is `sortable: false, filter: false` — same trade-off as `ProductionLogListComponent`'s grid, see Backend section for why.

## Per-machine drill-down — the row's info action, no extra request

Each row has a read-only **info** action (`[showAction]="true" [showInfoButton]="true"`, `(infoClick)="viewAllocations($event)"`) opening a small dialog with a nested `app-ag-grid-table` (Machine / Allocated (kg), `staticData: true`) listing that entry's `machine_wastage_allocations` rows.

**No second HTTP call needed** — the list endpoint (`GET /api/wastage-logs`) already eager-loads `allocations.machine`, so `viewAllocations(row)` reads `row.allocations` directly off the already-fetched row. This is the opposite of `ProductionLogListComponent`'s info action, which genuinely needs a second request (`ProductionLogService.getGroupDetail()`) — that grid is grouped/aggregated and has lost the per-machine rows its groups were built from; this grid never aggregates anything, so nothing is lost.

---

## State Properties

| Property | Type | Source |
|---|---|---|
| `dataSource` | `AgGridTableODataSourceConfig<any>` | `type: 'api'`, `customEndpoint: 'wastage-logs'`, `fromCustomPaginator: true` — a plain Eloquent REST endpoint (see Backend section) |
| `toolbarConfig` | `AgGridTableToolbarConfig` | Row count + a "Log Wastage" new-button (opens `LogWastageComponent`'s dialog) |
| `columns` | `AgGridTableColumn<any>[]` | See Grid section above |
| `detailOpen` / `detailSubtitle` / `detailRows` / `detailColumns` / `detailDataSource` / `detailDisplayConfig` | dialog state | Set by `viewAllocations()` |

## Methods

| Method | Description |
|--------|-------------|
| `openForm()` | `(newButtonClick)` handler — calls `LogWastageComponent.openDialog()` via `#wastageFormRef` |
| `refresh()` | `(logged)` handler from `LogWastageComponent` — `agGridRef?.refreshGridData(true)` |
| `viewAllocations(row)` | `(infoClick)` handler — reads `row.allocations` (already present on the fetched row), builds a subtitle (`WO · wastage type · date`), opens the drill-down dialog |
| `closeDetail()` | Closes the drill-down dialog |

---

## Backend — `MachineController::wastageLogs` (Laravel)

Placed on `MachineController` next to `productionLogs()` — same "system-wide log listing" home already established there, even though this list isn't machine-scoped either (matches existing convention rather than introducing a new controller for one method).

```php
MachineWastageEntry::with([
  'workOrder:id,custom_id',
  'wastageType:id,name',
  'shift:id,name',
  'allocations.machine:id,machine_name',
])->orderByDesc('entry_date')->orderByDesc('id')
  ->skip($skip)->take($top)->get();
```

Plain Eloquent, not OData/Lodata — same rationale as `productionLogs()`'s own doc comment (this app has confirmed `$expand` + `$orderby`/`$count` bugs on at least one adjacent entity; a plain REST list sidesteps the question entirely rather than risking it on a new entity). `{data, total}` response shape, manually paginated via `$top`/`$skip`, matching `fromCustomPaginator: true`.

Route: `GET wastage-logs` in `Backend/routes/api.php`, same `auth:sanctum` group as the other production-log/work-order routes — no additional backend permission check (matches this module's existing pattern; `Permissions.WASTAGE_LOG` is enforced by the frontend route guard only, same as `PRODUCTION_LOG`).

---

## Known Gaps
- No server-side sort/search on this endpoint (every column is `sortable: false, filter: false`) — same accepted trade-off as `ProductionLogListComponent`'s grid.
- No live polling — refreshes only on load and after a submit from `LogWastageComponent`.
- No date-range/shift toolbar filter yet (unlike `ProductionLogListComponent`, which has a date-range picker) — every entry is always listed; add one if the entry volume grows enough to need it.
