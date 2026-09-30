# LOG_WASTAGE — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `production-plan-log/wastage-logs/log-wastage/log-wastage.component.ts` |
| **HTML file** | `production-plan-log/wastage-logs/log-wastage/log-wastage.component.html` |
| **Selector** | `app-log-wastage` |
| **Component type** | Non-standalone (declared in `ProductionModule`) |
| **Used by** | `WastageLogListComponent`'s toolbar: `<app-log-wastage #wastageFormRef>`, opened via the grid's new-button ("Log Wastage") → `(newButtonClick)="openForm()"` → `wastageFormRef.openDialog()`. See [WASTAGE_LOG_LIST_COMPONENT_CONTEXT.md](WASTAGE_LOG_LIST_COMPONENT_CONTEXT.md) |
| **Purpose** | "Log Wastage" dialog — pick a work order, a wastage type (scoped to types actually assigned to at least one of that work order's machines), optionally a shift, a date, and a total quantity in kg. The backend distributes that total across every eligible machine proportional to its production share for the same scope — see [work-order-and-log-production.md](../work-order-and-log-production.md) for the sibling manual-entry flows this complements, and `PRODUCTION_LOG_SERVICE_CONTEXT.md`'s "Backend — `WorkOrderController::logWastage`" section for the distribution algorithm itself |

---

## Outputs (@Output)

| Output | Type | Purpose |
|---|---|---|
| `logged` | `EventEmitter<void>` | Emitted after a successful submit — `WastageLogListComponent` listens (`(logged)="refresh()"`) to refresh its grid so the new entry shows up immediately, same idiom as `ProductionLogFormComponent.RefreshTable` |

---

## State Properties

| Property | Type | Source |
|---|---|---|
| `open` / `submitting` | `boolean` | Dialog visibility / submit-in-flight (disables Submit/Cancel) |
| `workOrders` | `{id, customId, productName}[]` | `WorkOrders?$filter=status ne 'cancelled'&$expand=product` — same source/query `ProductionLogFormComponent` uses |
| `wastageTypes` | `EligibleWastageType[]` | `ProductionLogService.getEligibleWastageTypes(workOrderId)` — re-fetched every time the Work Order selection changes, cleared immediately on change so a stale list never shows against the newly-picked WO |
| `shifts` | `ShiftOption[]` | `MachineOverviewDataService.getActiveShifts()` — reused, not duplicated |
| `workOrderId` / `wastageTypeId` / `shiftId` / `date` / `qtyKg` | form fields | `shiftId` is the only optional one; `date` defaults to today (`yyyy-MM-dd`); all reset on every `openDialog()` |

---

## Methods

| Method | Description |
|--------|-------------|
| `openDialog()` | Opens the dialog, resets the form, loads the work-order picker and shift master |
| `closeDialog()` | Closes the dialog |
| `onWorkOrderChange(event)` | Reads the combobox selection, resets `wastageTypeId`/`wastageTypes`, fetches the new WO's eligible wastage types |
| `onWastageTypeChange(event)` / `onShiftChange(event)` | Same `ui5-combobox` `(selectionChange)` coercion idiom as `LogProductionEntryComponent` |
| `onQtyKgChange(event)` | Reads `event.target.value` from the `ui5-input` `(input)` event, `Number`/`null` coercion |
| `isValid` (getter) | `true` only when `workOrderId`/`wastageTypeId`/`date` are set and `qtyKg > 0` — gates the Submit button |
| `submit()` | No-ops if `!isValid`. Calls `ProductionLogService.submitWastage(...)`; on success shows a toast, closes the dialog, emits `logged`; on error shows an error toast (surfacing the backend's message when present, e.g. "No machine on this work order has this wastage type assigned") and leaves the dialog open with the entered values intact |

---

## Template Structure

```
ui5-dialog "Log Wastage"
├── Work Order combobox
├── Wastage Type combobox (disabled until a Work Order is picked; empty-state hint if the WO has none)
├── Shift combobox (optional) + Date picker, 2-col grid
└── Quantity (kg) ui5-input (type="Number")
Footer: Submit (Emphasized, disabled unless valid) / Cancel
```

No grid in this dialog, unlike its `ProductionLogFormComponent` sibling — there is nothing per-machine to enter here; the per-machine split is entirely server-computed (see `WorkOrderController::logWastage`) and visible afterward both on `WastageLogListComponent`'s own grid (info-icon per row) and on `WorkOrderDetailComponent`'s "Wastage by Type" section (info-icon drill-down per type).

---

## Known Gaps
- Does not preview the computed per-machine distribution before submit — an operator only sees it afterward, via `WastageLogListComponent`'s info-icon drill-down or `WorkOrderDetailComponent`'s Wastage by Type section.
- No client-side upper bound on `qtyKg` beyond `> 0`, same "trust the shop floor's manual entry" convention as `LogProductionEntryComponent`'s good/scrap counts.
- Always additive, no edit/delete UI — matches this module's existing append-only convention for manual production/wastage entries.
