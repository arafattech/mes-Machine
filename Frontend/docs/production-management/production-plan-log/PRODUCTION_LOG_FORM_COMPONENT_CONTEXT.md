# PRODUCTION_LOG_FORM — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `production-plan-log/Production-logs/production-log-form/production-log-form.component.ts` |
| **HTML file** | `production-plan-log/Production-logs/production-log-form/production-log-form.component.html` |
| **Selector** | `app-production-log-form` |
| **Component type** | Non-standalone (declared in `ProductionModule`) |
| **Used by** | `ProductionLogListComponent` — `<app-production-log-form #logFormRef (RefreshTable)="refresh()">` |
| **Purpose** | Multi-machine production-count entry: pick a work order, shift, and date, then enter a good count per machine planned against that work order in one submission. Second tab shows that work order's full log history. |

Distinct from `LogProductionEntryComponent` (`/mco`'s "Log Production" dialog), which is per-machine, has no date field, and logs good+scrap for exactly one machine at a time. This component is work-order-centric and batch — see [work-order-and-log-production.md](../work-order-and-log-production.md) for the original per-machine flow this one complements, not replaces.

---

## Outputs (@Output)

| Output | Type | Purpose |
|---|---|---|
| `RefreshTable` | `EventEmitter<void>` | Emitted after a successful submit — parent refreshes its grid, same idiom as `WorkOrderFormComponent`/`WorkOrderListComponent` |

## Public method

| Method | Purpose |
|---|---|
| `openDialog()` | Opens the dialog, resets form state, loads the work-order picker options and active shifts |

---

## State Properties

| Property | Type | Source |
|---|---|---|
| `workOrders` | `{id, customId, productName}[]` | `WorkOrders?$filter=status eq 'in_progress'&$expand=product` (OData, direct `CommonService` call — not scoped to a machine, unlike `MachineOverviewDataService.getAssignedWorkOrders()`) |
| `shifts` | `ShiftOption[]` | Delegates to `MachineOverviewDataService.getActiveShifts()` — reused, not duplicated |
| `workOrderId` / `shiftId` / `date` | selection state | `date` defaults to today (`yyyy-MM-dd`), bound via `ui5-date-picker [(ngModel)]` |
| `entryRows` | `ProductionLogEntryRow[]` | `ProductionLogService.getWorkOrderMachines(workOrderId)` — one row per machine assigned to the selected work order (`WorkOrders(id)?$expand=machines`), `goodCount` starts `null` |
| `entryDataSource` | `AgGridTableODataSourceConfig<ProductionLogEntryRow>` | `staticData: true`, shallow-copied from `entryRows` on every change — same "editable grid backed by a plain array" pattern as `PurchaseOrderComponent.itemsDataSource`/`syncItemsGrid()`. The `goodCount` column is `editable: true`; AG Grid mutates the row objects in place **once an edit is actually committed** — see Key Behavior below, this does *not* happen automatically on every key the user might expect |
| `historyDataSource` | `AgGridTableODataSourceConfig<any>` | `type: 'api'`, `customEndpoint: 'work-orders/{id}/production-logs'` (rebuilt on every work-order change) — a plain Eloquent REST endpoint, **not** the `MachineProductionCounts` OData entity (see `PRODUCTION_LOG_SERVICE_CONTEXT.md` for why) — one row per real submission (see Known Gaps on why this isn't `WorkOrderDetailComponent`'s grid). This same backend endpoint, with `shift_id`/`date` query params added, is also what `ProductionLogListComponent`'s per-group info-icon drill-down calls (via `ProductionLogService.getGroupDetail()`) — see [../PRODUCTION_LOG_LIST_COMPONENT_CONTEXT.md](../PRODUCTION_LOG_LIST_COMPONENT_CONTEXT.md) |
| `selectedTab` | `'entry' \| 'history'` | `ui5-tabcontainer` `(tab-select)` — same idiom as `MachineOverviewComponent` |

---

## Key behavior

- **Partial entry is expected.** Submit only requires at least one row with a non-null `goodCount`; rows left blank are filtered out before the request is built. Not every machine assigned to a work order necessarily ran that shift.
- **Submit force-commits any in-progress cell edit first** (`entryGridRef.stopEditing()`, called at the top of `submit()` and also on tab switch) — confirmed via live testing that the shared `AgGridCellEditorComponent`'s custom keyboard handling doesn't stop editing on **Enter** (only on Tab / clicking elsewhere), so a user who types a value and immediately clicks Submit without tabbing away would otherwise have that edit silently discarded (the row object never gets mutated, `entryRows` still shows `null`). This is a real gap in the shared `ag-grid-table` component, out of scope to fix globally here — `stopEditing()` is a documented public method on `AgGridTableComponent` and this workaround is fully local to this component. Submit's `[disabled]` binding is deliberately just `submitting`, **not** a reactive "is the form valid" getter, precisely because a stale reactive check would hit this same trap (disabled button, mid-edit value never seen) — validation instead happens inside `submit()` itself, after the forced commit, with a specific toast message per failure reason.
- **Always additive, never an upsert.** Resubmitting for the same work order/machine/shift/date creates a new `machine_production_counts` row rather than updating a prior one — matches `LogProductionEntryComponent`'s existing audit-trail semantics. Confirmed deliberately with the requester rather than assumed.
- **Scrap is not collected here.** Only a good count per machine — confirmed with the requester that scrap wasn't needed for this batch-entry flow (unlike the per-machine `/mco` dialog, which still collects both). Backend always writes `scrap_count: 0` for rows created through this path.
- **Date + shift define the bucket window directly**, unlike `MachineController::logProductionCount`'s "continue from this machine's last bucket, end at now" logic (that endpoint has no date input at all). Here, `WorkOrderController::logProductionCounts` computes `bucket_started_at`/`bucket_ended_at` from the selected shift's own `start_time`/`end_time` combined with the picked date (rolling the end forward a day for an overnight shift) — see `PRODUCTION_LOG_SERVICE_CONTEXT.md`.
- Switching the work order re-fetches both `entryRows` and the `historyDataSource` filter — both tabs always reflect the currently selected work order.

---

## Template Structure

Takes PO's field/card styling conventions (`Frontend/src/app/modules/store-management/purchase-order/`) — labeled `flex flex-col` fields, bordered-card grids — but **not** its fixed-height dialog, at least not verbatim. An earlier version copied PO's `ui5-dialog` `h-[86vh]` + `ui5-busy-indicator` `h-[72vh]` directly; live-testing showed `ui5-busy-indicator` centers shorter content vertically within a height that tall, producing large dead gaps above and below (very visible here since this dialog's content — one combobox row, a Shift/Date row, a 5-row grid — is nowhere near as tall as PO's full form + line-items grid).

Two other sizing dead-ends tried and dropped along the way:
- The shared `ui5-xl-without-tab` global utility class (`src/styles.sass`, `width: 20%`) — far too narrow for a dialog containing a 2-column field grid *and* an embedded AG Grid with 2 columns; caused fields to stack into one narrow column and forced both a vertical *and* horizontal scrollbar inside the grid.
- `min-h-[70vh]` alone on the dialog with no matching height on `ui5-tabcontainer` — the tabcontainer stayed at its own smaller fixed height, leaving a dead gap between it and the dialog's footer (the "floor, not fixed height" idea was sound, but only the *outer* container had it, so nothing forced the inner content to actually fill that floor).

A third dead-end, found by inspecting the *live* rendered DOM (headless Chrome via CDP, since this class of bug isn't visible from source alone): a fixed `h-[700px]` on `ui5-busy-indicator`/`section` caused a **native scrollbar inside `ui5-dialog`'s own shadow DOM**. `ui5-dialog`'s host element caps at `max-height: 94%` of the viewport, and its shadow `[part="content"]` div has its own built-in `overflow-y: auto`. 700px (plus header/footer/tab-strip chrome) exceeded that 94%-of-viewport budget, so *UI5's own dialog content wrapper* scrolled — not anything in our own markup. Confirmed by walking the live DOM tree: every element under our control (`ag-grid-table-shell`, the bordered-card `div`, `.ag-grid-table-grid`) reported `scrollHeight === clientHeight` (no overflow); only `ui5-dialog`'s shadow `[part="content"]` did.

Shrinking `ui5-busy-indicator`/`section`'s declared height alone did **not** fix it — every element in the chain down to `ui5-tab` has `overflow-y: visible` by default, so a smaller declared height doesn't clip anything; the browser still measures the full, unclipped content extent when deciding whether the dialog's shadow content wrapper needs to scroll. The declared height only need to actually clip if paired with `overflow-hidden` on that same element.

Current approach: `ui5-dialog` is `w-[70vw]` (width only, no height — UI5's own `max-height: 94%` governs the ceiling). `ui5-busy-indicator` is `h-[calc(94vh-220px)] overflow-hidden` and `section` is `h-full overflow-hidden` — the `calc` offset was tuned against the live-measured gap between `94vh` and the dialog's actual usable content height (header + footer + shadow-content padding ≈ 220px), and `overflow-hidden` is what actually makes that height enforceable rather than just advisory. `ui5-tabcontainer` (and both `ui5-tab`s, and their `col-span-2` wrapper `div`) are `h-full`, cascading down from `section`'s now-*enforced* height — CSS Grid's default `align-items: stretch` makes the wrapper `div` fill `section`'s row height, and each `h-full` down the chain resolves against a real, clipped parent height. Live-verified: the History tab's card fills its tab with a 0px gap, and `ui5-dialog`'s own shadow `[part="content"]` reports zero overflow on both tabs.

Both `entryDisplayConfig.gridHeight` (`350px`) and `historyDisplayConfig.gridHeight` (`580px`) still leave the shared `showIllustratedMessage`/`IllustratedName="NoEntries"` empty-state graphic slightly taller than its allotted box (live-measured: the graphic wants ~570-680px depending on the tab's available width) — but that overflow is contained by AG Grid's own internal wrapper (`.ag-grid-table-grid` has `overflow: hidden`), so it never reaches a visible scrollbar; the graphic is just very slightly cropped at the bottom on both tabs. Accepted trade-off — the alternative (shrinking the dialog further to fully fit the graphic) would reopen the "not full" dead-gap complaint this fix was for.

Both tabs are **always visible** (not gated behind picking a work order first) — the Work Order combobox lives inside the "Log Production" tab itself, at the top, above Shift/Date. The grid's own built-in empty state (`showIllustratedMessage`/`IllustratedName="NoEntries"`) covers "nothing to show yet" instead of a separate custom illustrated-message gate.

```
ui5-dialog (w-[70vw])
└── ui5-busy-indicator (loading, h-[calc(94vh-220px)] overflow-hidden)
    └── section (grid-cols-2, h-full overflow-hidden)
        └── div.col-span-2 (h-full)
            └── ui5-tabcontainer (h-full)
                ├── ui5-tab "Log Production" (id: entry, h-full)
                │   ├── Work Order combobox (col-span-2)
                │   ├── Shift combobox + Date picker (grid-cols-2 row)
                │   └── bordered card → app-ag-grid-table (entryColumns/entryDataSource — Machine, editable Good Count; gridHeight 350px)
                └── ui5-tab "History" (id: history, h-full)
                    └── bordered card → app-ag-grid-table (historyColumns/historyDataSource; gridHeight 580px)
Footer: Submit (entry tab only, once a work order is picked) + Close.
```

**Nested-`app-ag-grid-table`-inside-`ui5-busy-indicator` sizing gotcha** (found while building `ProductionLogListComponent`'s detail dialog, applies here too): `ui5-busy-indicator` centers/shrink-wraps its slotted content rather than stretching it — a wrapping `<div>` with no explicit width collapses to its own content's intrinsic size instead of the busy-indicator's full width, even when the busy-indicator itself is `w-full`. This component's own `<section class="w-full ...">` already has an explicit width so it doesn't hit this, but any *new* direct child added straight under `ui5-busy-indicator` here should keep an explicit `w-full` (or equivalent) rather than assuming block elements always stretch.

---

## Known Gaps
- History tab has no live polling — refreshes on work-order change and right after a submit, same convention as the rest of this module (`work-order-and-log-production.md` §8).
- The work-order picker is now scoped to `status eq 'in_progress'` only (previously `status ne 'cancelled'`, which also surfaced `pending`/`completed` work orders) — matches `MachineController::assignedWorkOrders`'s stricter filter for the per-machine flow.
