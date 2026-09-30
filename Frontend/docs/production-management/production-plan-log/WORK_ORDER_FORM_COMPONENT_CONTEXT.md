# WORK_ORDER_FORM — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `production-plan-log/work-order-management/work-order-form/work-order-form.component.ts` |
| **HTML file** | `production-plan-log/work-order-management/work-order-form/work-order-form.component.html` |
| **Selector** | `app-work-order-form` |
| **Component type** | Non-standalone (declared in `ProductionModule`) |
| **Opened from** | `WorkOrderListComponent` via `#workOrderForm` (`newWorkOrder()` / `editWorkOrder()`) |
| **Purpose** | Create/edit a work order — product, quantity, status, scheduled/actual start, and the multi-machine assignment (`work_order_machines` pivot) |

Moved verbatim from `base-data-management/work-order-management/work-order-form/` — no logic changes. See [context.md](context.md#work-order-management--moved-here-from-base-data-module) for the move itself, and [work-order-and-log-production.md](../work-order-and-log-production.md) for the full planning process this dialog drives.

---

## Inputs / Outputs

| Member | Direction | Type | Notes |
|---|---|---|---|
| `saveMode` | `@Input` | `'POST' \| 'PUT'` | Set by the parent list before opening — controls create vs update |
| `workOrder` | `@Input` | `WorkOrder` | The row being edited, or a blank `new WorkOrder().deserialize({})` for create |
| `RefreshTable` | `@Output` | `EventEmitter<any>` | Emitted after a successful save — parent refreshes its grid |

`open` (dialog visibility) is a plain component field toggled by the parent (`workOrderFormRef.open = true`), not an `@Input`.

---

## Key Methods

| Method | Description |
|--------|-------------|
| `ngOnInit()` | Loads `Products` option list (OData `$select` read) and `Machines` option list (REST `GET /api/machines`), both via `CommonService` |
| `onProductSelection(event)` | Combobox change handler — sets `product_id`/`product_name`, clears the field's value-state error |
| `onMachinesSelectionChange(event)` | Multi-combobox change handler — sets `machine_ids[]`/`machine_names[]` |
| `validateForm()` | Required: `product_id`, `quantity > 0` — sets `ValueState.Negative` on the offending field(s) |
| `SaveWorkOrder()` | Validates, then POSTs `work-orders` or PUTs `work-orders/{id}` (custom REST, not OData — a many-to-many `machines` sync isn't a plain OData field write) with `workOrder.toPayload()` |
| `CloseDialog()` | Resets `open`, `loading`, value-states, and `workOrder` back to a blank instance |

---

## Known Gaps
Same as pre-move: no client-side duplicate/overlap validation across machine+schedule (server doesn't enforce it either); `Machines` option list is unfiltered (`GET /api/machines` — no active/inactive filter), unlike `Products` (`is_active eq true`).
