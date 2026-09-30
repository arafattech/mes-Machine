# WORK_ORDER_LIST — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `production-plan-log/work-order-management/work-order-list/work-order-list.component.ts` |
| **HTML file** | `production-plan-log/work-order-management/work-order-list/work-order-list.component.html` |
| **Selector** | `app-work-order-list` |
| **Component type** | Non-standalone (declared in `ProductionModule`) |
| **Route** | `/production/work-orders` — child of `LayoutComponent` (sidenav stays visible), guarded by `Permissions.BASE_DATA_WORK_ORDER` |
| **Sidebar entry** | "Plan & Production Log" group → "Work Orders" item, `LayoutComponent.buildNavItems()` |
| **Purpose** | Work order **planning** master list — create/edit a work order and assign it across N machines. Distinct from `ProductionLogListComponent`, which is the **execution** log of production actually recorded against a work order |

Moved verbatim from `base-data-management/work-order-management/work-order-list/` — see [context.md](context.md#work-order-management--moved-here-from-base-data-module) for what did and didn't change in the move. Full process doc: [work-order-and-log-production.md](../work-order-and-log-production.md).

---

## Grid

`app-ag-grid-table` over the `WorkOrders` OData entity (`type: 'odata'`, `expand: 'product,machines'`), `gridId: 'production-work-order-list'` (renamed from `base-data-work-order-list` at move time — grid column-state persistence key changed, so users see default column layout once).

Columns: Active (boolean renderer, not sortable/filterable) · WO Number (`custom_id`) · Product (`product.product_name` via `valueGetter`) · Machines (`machines.machine_name`, joined, via `valueGetter` — **not** included in `searchFields`, see below) · Quantity · Status (badge renderer) · Scheduled Start · Created At.

**`searchFields: ['custom_id', 'product.product_name']` deliberately excludes `machines.machine_name`**: combining a to-many nav `any()` (machines) with the existing to-one `any()` (product) in one OR'd Lodata `$filter` expression breaks Lodata's SQL generation (confirmed — produces a dangling `OR )` and a MySQL syntax error). Filtering by machine still works via the Machines column's own floating filter; only the global toolbar search excludes it.

`toolbarConfig.showNewButton` is gated by `Permissions.BASE_DATA_WORK_ORDER_CREATE` (kept as the original permission constant — see the move's permission-naming note in [context.md](context.md)).

---

## Methods

| Method | Description |
|--------|-------------|
| `newWorkOrder()` | Resets `workOrder` to an empty `WorkOrder`, sets `saveMode = POST`, opens `WorkOrderFormComponent` via `#workOrderForm` |
| `editWorkOrder(data)` | Deserializes the clicked/edited row into `workOrder`, sets `saveMode = PUT`, opens the form |
| `deleteClick(id)` | Emits `IsDelete` (`WorkOrders/{id}`) — consumed by the shared `app-delete-entity` component in the template |
| `viewDetail(row)` | `(infoClick)` handler — sets `detailWorkOrderId`/`detailSubtitle`, opens the detail dialog |
| `closeDetail()` | Closes the detail dialog, clears `detailWorkOrderId` |
| `processData()` | `(RefreshTable)`/`(isSuccess)` handler from the form/delete-entity — refreshes the grid |

`showEditButton`/`showDeleteButton` on the grid are gated by `Permissions.BASE_DATA_WORK_ORDER_EDIT`/`_DELETE` respectively (template-level, via `rolePermissionService.hasPermission(...)`); `showInfoButton` is ungated (read-only view action, same convention as this app's other info-drill-down grids).

---

## Full work order detail (info action) — added 2026-08-02

Clicking a row's info icon opens a `ui5-dialog` (`w-[95vw] max-w-[1600px]`) hosting `<app-work-order-detail [workOrderId]="detailWorkOrderId">` — reused **unchanged**. This is the full cross-machine dashboard (WO-wide OEE, overall progress, every machine's Machines & Shifts row, wastage-by-type across every machine) that used to live on the per-machine `/mco` Work Order tab. It moved here because that page now shows only the current machine's own contribution to a WO (`MachineWorkOrderOverviewComponent`) — "how's the whole work order doing across every machine" is this list's question to answer, not something to repeat on every single machine's page. See [../shared/WORK_ORDER_DETAIL_COMPONENT_CONTEXT.md](../shared/WORK_ORDER_DETAIL_COMPONENT_CONTEXT.md) and [../shared/MACHINE_WORK_ORDER_OVERVIEW_COMPONENT_CONTEXT.md](../shared/MACHINE_WORK_ORDER_OVERVIEW_COMPONENT_CONTEXT.md).

---

## Known Gaps
Same as pre-move: no server-side machine-name search (Lodata limitation above); no live polling — list refreshes on load and after create/edit/delete only.
