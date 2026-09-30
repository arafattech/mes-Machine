# LOG_PRODUCTION_ENTRY_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `shared/components/log-production-entry/log-production-entry.component.ts` |
| **HTML file** | `shared/components/log-production-entry/log-production-entry.component.html` |
| **Selector** | `app-log-production-entry` |
| **Component type** | Non-standalone (declared in `ProductionModule`) |
| **Used by** | `MachineOverviewComponent`'s header: `<app-log-production-entry [machineKey]="machineKey" (logged)="onProductionLogged()">` |
| **Purpose** | "Log Production" button + `ui5-dialog` for manually entering good/scrap counts against a work order + shift on the current machine — the manual data-collection entry point this plant's PLCs can't fill in automatically (state-only PLC feed, no piece counter) |

See [work-order-and-log-production.md](../work-order-and-log-production.md) for the full process (§4, "Log production (manual entry)").

---

## Inputs / Outputs

| Member | Type | Purpose |
|---|---|---|
| `@Input() machineKey` | `string \| null` | The machine to log against — forwarded straight from `MachineOverviewComponent.machineKey`. If `null`, `openDialog()` / `submit()` no-op |
| `@Output() logged` | `EventEmitter<void>` | Emitted after a successful submit — parent (`MachineOverviewComponent.onProductionLogged()`) uses this to re-fetch "current work order" |

---

## State Properties

| Property | Type | Source |
|---|---|---|
| `open` | `boolean` | Dialog visibility |
| `loading` | `boolean` | `true` while the submit POST is in flight — also disables the Submit/Cancel toolbar buttons |
| `workOrders` | `AssignedWorkOrder[]` | Fetched from `getAssignedWorkOrders(machineKey)` on dialog open — only WOs planned for this machine (`work_order_machines`) with status `pending`/`in_progress` |
| `shifts` | `ShiftOption[]` | Fetched from `getActiveShifts()` on dialog open — the plant-wide `EmployeeShifts` master, not machine-specific |
| `workOrderId` / `shiftId` / `goodCount` / `scrapCount` | `number \| null` | Form fields, reset on every `openDialog()` via `resetForm()` |

---

## Methods

| Method | Description |
|--------|-------------|
| `openDialog()` | No-ops if `machineKey` is falsy. Sets `open = true`, resets the form, fires both list fetches (work orders + shifts) independently — not `forkJoin`'d, each populates its own dropdown as it resolves |
| `closeDialog()` | `open = false` |
| `onWorkOrderChange(event)` / `onShiftChange(event)` | Reads `event.detail.item.value`, coerces to `Number`, falls back to `null` if not finite — backing the `ui5-combobox` `(selectionChange)` handlers |
| `onGoodCountChange(event)` / `onScrapCountChange(event)` | Reads `event.target.value` from the `ui5-input` `(input)` event, same `Number`/`null` coercion |
| `isValid` (getter) | `true` only when `workOrderId`/`shiftId` are non-null and `goodCount`/`scrapCount` are non-null and `>= 0` — gates the Submit button's `[disabled]` |
| `submit()` | No-ops if `machineKey` falsy or `!isValid`. Calls `logProductionCount(machineKey, {...})`; on success shows a toast (`ToastService.show('add')`), closes the dialog, emits `logged`; on error shows an error toast, leaves the dialog open with the entered values intact so the operator can retry without re-entering everything |
| `resetForm()` (private) | Nulls all 4 form fields |

---

## Template Structure

```
ui5-button "Log Production" (Transparent) → opens dialog
ui5-dialog
├── ui5-busy-indicator (loading)
│   ├── Work Order combobox (workOrders, empty-state hint if none)
│   ├── Shift combobox (shifts)
│   └── Good Count / Scrap Count ui5-input (type="Number"), 2-col grid
└── footer: Submit (Emphasized, disabled unless valid) / Cancel
```

---

## Known Gaps
- `onWorkOrderChange`/`onShiftChange`/`onGoodCountChange`/`onScrapCountChange` all type their `event` param as `any` — UI5 web-component custom events (`ui5-combobox`'s `selectionChange`, `ui5-input`'s native `input`) don't have first-class Angular typings in this codebase yet; matches the existing pattern elsewhere in the module rather than introducing a one-off typed wrapper here.
- No client-side upper bound on `goodCount`/`scrapCount` beyond `>= 0` — an operator can log an arbitrarily large count; the backend doesn't reject unreasonable values either (see `MachineController::logProductionCount`), by design (manual entry is trusted input from the shop floor, not validated against any expected-throughput ceiling).
- Work order and shift lists are re-fetched from scratch on every `openDialog()` call — acceptable given both lists are small and scoped (one machine's open WOs; the shift master), not cached between opens.
