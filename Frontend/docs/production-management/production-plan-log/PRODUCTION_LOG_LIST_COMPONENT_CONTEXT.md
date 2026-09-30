# PRODUCTION_LOG_LIST — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `production-plan-log/Production-logs/production-log-list/production-log-list.component.ts` |
| **HTML file** | `production-plan-log/Production-logs/production-log-list/production-log-list.component.html` |
| **Selector** | `app-production-log-list` |
| **Component type** | Non-standalone (declared in `ProductionModule`) |
| **Route** | `/production/production-log` — child of `LayoutComponent` (renders inside the sidenav shell, same as `MachineBoardComponent`), guarded by `Permissions.PRODUCTION_LOG` |
| **Sidebar entry** | "Plan & Production Log" group → "Log Production" item, `LayoutComponent.buildNavItems()` |
| **Purpose** | Every work-order/shift production log across the whole plant — not scoped to one machine, unlike everything else in this module (`MachineBoardComponent`, `/mco`) |

See [work-order-and-log-production.md](../work-order-and-log-production.md) for the process this page is the global-list counterpart of (that doc covers the original per-machine flow on `/mco`).

---

## Grid grouping — one row per (work order, shift, day), not per machine

A single "Log Production" submission (`ProductionLogFormComponent`) can write one `machine_production_counts` row per machine at once. The list deliberately does **not** show one row per machine — it groups by `(work_order_id, shift_id, DATE(bucket_started_at))` and shows:
- a **Machines** column: a machine icon + `COUNT(DISTINCT machine_id)` for that group (`AgGridIconTextCellRendererComponent`, `cellRendererParams: { icon: 'machine' }` — the count itself comes from the `machine_count` field via the column's `field`, which lands in the renderer's `params.value`)
- Good/Scrap/Total as **`SUM(...)`** across every machine in the group, not one machine's own counts
- Logged At as `MAX(created_at)` across the group

This was a deliberate redesign — the requester wanted the list to read as "what got logged for this work order/shift" rather than "which machine", with per-machine detail moved behind a drill-down instead of cluttering the main list with one row per machine.

## Per-machine drill-down — the row's info action

Each row has a read-only **info** action (`[showAction]="true" [showInfoButton]="true" [showEditButton]="false" [showDeleteButton]="false"`, `(infoClick)="viewGroupDetail($event)"` — the shared grid's standard info-icon convention, same as e.g. `EmployeeBonusesComponent`). Clicking it opens a small `ui5-dialog` ("Production Log Detail") with a **second, nested** `app-ag-grid-table` (`detailColumns`/`detailDataSource`, `staticData: true`) listing the individual machines that made up that group — Machine / Good / Scrap / Total / Logged At, one row per real `machine_production_counts` record, fetched via `ProductionLogService.getGroupDetail(workOrderId, shiftId, date)`.

**Layout gotcha, fixed:** the nested grid's wrapping `<div class="p-2">` had no explicit width. `ui5-busy-indicator` centers/shrink-wraps its slotted content by default rather than stretching it to fill available width — a plain block child with no declared width shrinks to its own content's intrinsic size instead of the busy-indicator's full width, even though the busy-indicator itself was correctly `w-full`. Fixed by adding `w-full` to that wrapper div directly (`<div class="w-full p-2">`) — matches why `ProductionLogFormComponent`'s own busy-indicator-wrapped content works fine: its immediate child (`<section class="w-full ...">`) already had an explicit width.

---

## State Properties

| Property | Type | Source |
|---|---|---|
| `columns` | `AgGridTableColumn<any>[]` | Work Order / Shift (nav-property `valueGetter`s) / Date / **Machines** (icon+count) / Good / Scrap / Total / Logged At. Every column is `sortable: false, filter: false` — see Backend section. **The Work Order column reads `data.work_order`, not `data.workOrder`** — Eloquent snake-cases relation keys in JSON output (`workOrder()` → `work_order`); `shift` is a single word so this was masked until this column specifically |
| `dataSource` | `AgGridTableODataSourceConfig<any>` | `type: 'api'`, `customEndpoint: 'production-logs'`, `fromCustomPaginator: true` — a plain Eloquent grouped-aggregate REST endpoint, **not** the `MachineProductionCounts` OData entity. See Backend section for why |
| `toolbarConfig` | `AgGridTableToolbarConfig` | Row count + a "Log Production" new-button (opens the entry modal, doesn't create a grid row directly). `showSearch: false` — deliberate, see Backend section |
| `detailOpen` / `detailLoading` / `detailSubtitle` / `detailRows` | dialog state | Set by `viewGroupDetail()`. `detailSubtitle` is `"WO-xxxx · <shift> · <date>"`, built from the clicked row |
| `detailColumns` / `detailDataSource` | grid config | `staticData: true`, populated from `getGroupDetail()`'s response — Machine / Good / Scrap / Total / Logged At, all `sortable: false, filter: false` (small, single-purpose read-only view) |

---

## Methods

| Method | Description |
|--------|-------------|
| `openForm()` | `(newButtonClick)` handler — calls `ProductionLogFormComponent.openDialog()` via `#logFormRef` |
| `refresh()` | `(RefreshTable)` handler from the form — `agGridRef?.refreshGridData(true)` |
| `viewGroupDetail(row)` | `(infoClick)` handler — reads `row.work_order.id` / `row.shift.id` / `row.log_date` off the clicked group row, opens the detail dialog, and fetches its per-machine rows via `ProductionLogService.getGroupDetail()` |
| `closeDetail()` | Closes the detail dialog |

---

## Backend — confirmed Lodata bug, worked around, now a grouped aggregate query

**Original approach (superseded twice):**
1. `MachineProductionCounts` OData entity with `$expand=machine,workOrder,shift` — abandoned: combining `$expand` with **either** `$orderby` **or** `$count=true` on this entity silently drops the expanded objects (200 OK, nested keys just gone; confirmed via live-testing, reproduces even ordering by plain `id`, and is specific to this entity — `WorkOrders?$expand=...&$orderby=...` works fine elsewhere in the app). The grid's infinite-scroll mode always sends both, so OData was never usable here.
2. A flat, one-row-per-machine Eloquent `with()` endpoint — worked, but the requester then asked for the grouped-by-(work order, shift, day) redesign described above.

**Current:** `GET /api/production-logs` (`MachineController::productionLogs`) — a grouped aggregate query:
```php
MachineProductionCount::select('work_order_id', 'shift_id')
  ->selectRaw('DATE(bucket_started_at) as log_date')
  ->selectRaw('COUNT(DISTINCT machine_id) as machine_count')
  ->selectRaw('SUM(good_count) as good_count')
  ->selectRaw('SUM(scrap_count) as scrap_count')
  ->selectRaw('SUM(total_count) as total_count')
  ->selectRaw('MAX(created_at) as logged_at')
  ->groupBy('work_order_id', 'shift_id', DB::raw('DATE(bucket_started_at)'))
  ->orderByDesc('log_date')->orderByDesc('logged_at')
  ->skip($skip)->take($top)
  ->with(['workOrder:id,custom_id', 'shift:id,name'])
  ->get();
```
`with()` still works after a grouped/aggregate `select()` — Eloquent eager-loads off whatever `work_order_id`/`shift_id` values end up on the hydrated (partial-attribute) models, which are still present since they're part of the `groupBy`/`select`. No synthetic row `id` is added — there isn't a single real PK per group — and none is needed: `AgGridTableComponent`'s `rowIdGetter` gracefully falls back to a per-object-reference local key (`WeakMap`) when `data.id` is missing, so AG Grid still tracks these rows correctly without collisions.

**Pagination total, deliberate compromise:** `MachineProductionCount::select(...)->groupBy(...)->get()->count()` — fetches every distinct group key and counts them in PHP rather than a single SQL `COUNT(*)` (which isn't meaningful over a grouped query without wrapping it in a subquery). Acceptable because the *number of distinct groups* is bounded by work orders × shifts × days, a much smaller space than the raw log-row count; revisit if this becomes slow.

**Trade-off, still deliberate:** this endpoint doesn't parse `$filter`/`$orderby` from the grid — sort is fixed server-side (newest group first) and there's no server-side search. Every column is `sortable: false, filter: false` and the toolbar's `showSearch` is `false` so nothing looks interactive and silently no-ops.

The `discoverRelationship()` additions in `AppServiceProvider` (from the OData attempt) were left in place (harmless, and `WorkOrders`' own relations were already exposed the same way) even though this list doesn't depend on them.

---

## Known Gaps
- No live polling — same convention as the rest of this module's list views. Refresh only on load and after a submit from the modal.
- `machine_production_counts` has no index leading with `work_order_id` or a date column alone (see `PRODUCTION_LOG_SERVICE_CONTEXT.md`) — this endpoint's `GROUP BY`/`orderByDesc('log_date')` will not use an index at scale; acceptable for current data volume, worth revisiting if this becomes slow.
- No sort/search on this grid or the detail dialog (see Backend section) — a real regression versus a first-class OData list, accepted as the cost of the Lodata workaround.
- The detail dialog's data isn't refreshed if the underlying group changes while it's open (e.g., another operator logs against the same work order/shift/day) — it's a one-shot fetch on open, same "no live polling" convention as everything else here.
