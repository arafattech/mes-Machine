# MACHINE_WORK_ORDERS_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `shared/components/machine-work-orders/machine-work-orders.component.ts` |
| **HTML file** | `shared/components/machine-work-orders/machine-work-orders.component.html` |
| **Selector** | `app-machine-work-orders` |
| **Component type** | Non-standalone (declared in `ProductionModule`) |
| **Used by** | `MachineOverviewComponent`'s Work Order tab: `<app-machine-work-orders [machineKey]="machineKey" [refreshToken]="workOrderRefreshToken">` |
| **Purpose** | A machine can have several work orders open at once (`work_order_machines` is a genuine many-to-many pivot — `Machine::workOrders()`/`WorkOrder::machines()`). This component lists all of a machine's open work orders and shows the selected one's detail scoped to **this machine only** via `MachineWorkOrderOverviewComponent` — this machine's own good/scrap/total and wastage allocation on that WO, not the full cross-machine dashboard. Replaces what used to be a single hardcoded "current work order" binding. |

See [work-order-and-log-production.md](../work-order-and-log-production.md) for the full process this component is part of.

---

## Inputs (@Input)

| Input | Type | Purpose |
|---|---|---|
| `machineKey` | `string \| null` | Same key `MachineOverviewComponent` holds — key into `getAssignedWorkOrders`/`getCurrentWorkOrderShift` |
| `refreshToken` | `number` (default `0`) | Bumped by the parent (`MachineOverviewComponent.onProductionLogged()`) after a manual production-count log — a fresh log can resolve a new "current" work order or change an existing one's status/progress. `ngOnChanges` reacts to a change on this input the same way it reacts to a `machineKey` change; the parent's `onProductionLogged()` simply increments it |

---

## State Properties

| Property | Type | Source |
|---|---|---|
| `loading` | `boolean` | `true` while `getAssignedWorkOrders`/`getCurrentWorkOrderShift` are in flight |
| `workOrders` | `AssignedWorkOrder[]` | `MachineOverviewDataService.getAssignedWorkOrders(machineKey)` — every `pending`/`in_progress` work order planned for this machine via `work_order_machines`. Laravel, unchanged endpoint (previously only consumed by `LogProductionEntryComponent`'s pick-list) |
| `selectedWorkOrderId` | `number \| null` | Which work order's detail is currently shown below the list — see default-selection resolution below |

---

## Lifecycle

`ngOnChanges(changes)` fires on either `machineKey` or `refreshToken` changing:
1. If `machineKey` is falsy → clear `workOrders`/`selectedWorkOrderId`, return.
2. `refresh()`: fetch `getAssignedWorkOrders(machineKey)` → `workOrders`.
3. `resolveDefaultSelection(machineKey)`: fetch `getCurrentWorkOrderShift(machineKey)`
   (node-server, the same "latest logged bucket" endpoint the old header chip used) —
   if its `workOrder.id` is present in the just-fetched `workOrders` list, select it;
   otherwise select `workOrders[0]?.id ?? null` (falls back gracefully when the
   previously-"current" WO has since been marked `completed`/`cancelled` and dropped out
   of the open list).

The two fetches are **sequential**, not parallel (`getCurrentWorkOrderShift` is only
called from inside `getAssignedWorkOrders`'s success callback) — the default-selection
check needs `this.workOrders` populated first; racing them risks resolving a selection
against an empty array.

No `error` callback on either subscribe — both service methods already `catchError` internally
to an empty/zeroed shape and never error out to their subscribers (confirmed in
`MachineOverviewDataService`), so an `error` branch here would be unreachable dead code.

---

## Methods

| Method | Description |
|--------|-------------|
| `onSelectionChange(event)` | Reads `event.detail.selectedItems[0].value` (a whole `AssignedWorkOrder`, bound via `[value]="wo"` on each `ui5-li` — same binding/read-back idiom as the only other `ui5-list` selection consumer in this codebase, `assosiate.component.ts`), sets `selectedWorkOrderId` to its `id` |
| `trackByWorkOrderId` | `(_, wo) => wo.id` — `trackBy` for the list's `*ngFor` |
| `refresh()` (private) | Guards `machineKey`, kicks off `getAssignedWorkOrders` |
| `resolveDefaultSelection(machineKey)` (private) | The fallback logic described above |

---

## Template Structure

Side-by-side master-detail (`flex flex-col lg:flex-row` — stacks vertically below the
`lg` breakpoint):

```
├── Master list — lg:w-80 shrink-0, own card
│   ├── Header: "Open Work Orders" + count badge
│   ├── *ngIf !workOrders.length → ui5-illustrated-message "No open work orders"
│   └── *ngIf workOrders.length → ui5-list (selection-mode="Single", (selection-change) handler)
│       one ui5-li per WO — [value]="wo", [selected]="wo.id === selectedWorkOrderId"
│       row: icon chip (tinted by status) + customId/"WO-"+id + status badge + productName/qty
│       (reuses getWorkOrderStatusColor/Tint/Label from work-order-status.util.ts —
│       same shared util WorkOrderDetailComponent already uses, not re-implemented)
└── Detail — flex-1
    app-machine-work-order-overview [workOrderId]="selectedWorkOrderId" [machineKey]="machineKey"
    (unconditional — that component already renders its own "No active work order"
    illustrated-message empty state when workOrderId is null, so no outer gate is
    needed here). See [MACHINE_WORK_ORDER_OVERVIEW_COMPONENT_CONTEXT.md](MACHINE_WORK_ORDER_OVERVIEW_COMPONENT_CONTEXT.md).
```

**Changed 2026-08-02**: this slot used to render the full cross-machine `WorkOrderDetailComponent` (WO-wide OEE, overall progress, every machine's Machines & Shifts row, wastage across every machine). That full dashboard moved to `WorkOrderListComponent`'s info action (a dialog, reusing `WorkOrderDetailComponent` unchanged) — per-machine pages now show only what this one machine did on the selected WO, not the whole work order's cross-machine picture. See [WORK_ORDER_LIST_COMPONENT_CONTEXT.md](../production-plan-log/WORK_ORDER_LIST_COMPONENT_CONTEXT.md).

`selection-mode="Single"` (not `"SingleStart"`, which `assosiate.component.html` uses) —
`SingleStart`'s leading radio/checkbox affordance fits a dialog picker; this is a compact
master list embedded in a tab, where plain row-highlight selection reads better. The
`(selection-change)` event shape is identical either way.

Side-by-side (rather than the original stacked list-above-detail layout) reads more like
a conventional ERP master-detail view and gives the execution rollup grid more horizontal
room — the list only needs to show WO code/product/status, not the full detail.

---

## Known Gaps
- **Open work orders only.** This component — and by extension the Work Order tab —
  only ever shows `pending`/`in_progress` work orders. A `completed`/`cancelled` WO that
  was previously "current" is no longer viewable here once it drops out of
  `getAssignedWorkOrders`'s result. This is a deliberate scope choice (see
  [work-order-and-log-production.md](../work-order-and-log-production.md)), not an
  oversight — surfacing completed-WO history isn't part of this feature.
- **Theoretical stale-response race.** Two rapid `refreshToken` bumps (back-to-back manual
  logs) could have an older `getAssignedWorkOrders`/`getCurrentWorkOrderShift` response
  resolve after a newer one, briefly clobbering `selectedWorkOrderId` with stale data.
  Not realistically reachable today — `LogProductionEntryComponent.submit()` already
  disables its submit button while `loading` is true and closes the dialog before
  emitting `logged` — so no `switchMap`/cancellation was added; flag if this ever becomes
  reachable from a different caller.
- Selecting a different work order while `WorkOrderDetailComponent` is still fetching the
  previous selection has the same no-cancellation behavior `WorkOrderDetailComponent`
  already had before this component existed (pre-existing, not a new risk).
- No live polling — the list and the selected detail refresh only on `machineKey` change
  or a manual-log completion, same as every other data source on this page.
