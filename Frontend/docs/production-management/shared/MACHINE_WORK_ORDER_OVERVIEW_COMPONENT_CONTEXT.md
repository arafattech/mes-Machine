# MACHINE_WORK_ORDER_OVERVIEW_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `shared/components/machine-work-order-overview/machine-work-order-overview.component.ts` |
| **HTML file** | `shared/components/machine-work-order-overview/machine-work-order-overview.component.html` |
| **Selector** | `app-machine-work-order-overview` |
| **Component type** | Non-standalone (declared in `ProductionModule`) |
| **Used by** | `MachineWorkOrdersComponent` (the per-machine `/mco` Work Order tab's detail panel): `<app-machine-work-order-overview [workOrderId]="selectedWorkOrderId" [machineKey]="machineKey">` |
| **Purpose** | Answers "what did **this machine** do on this work order" — its own good/scrap/total counts (per shift) and its own wastage allocation, nothing about any other machine on the same WO. Added 2026-08-02 to replace `WorkOrderDetailComponent` in this slot, which showed the full cross-machine dashboard — that view moved to `WorkOrderListComponent`'s info action instead. See [WORK_ORDER_DETAIL_COMPONENT_CONTEXT.md](WORK_ORDER_DETAIL_COMPONENT_CONTEXT.md) for the page this replaced here, and [../production-plan-log/WORK_ORDER_LIST_COMPONENT_CONTEXT.md](../production-plan-log/WORK_ORDER_LIST_COMPONENT_CONTEXT.md) for where the full view lives now. |

---

## Why a new component instead of adding a `machineId` input to `WorkOrderDetailComponent`

`WorkOrderDetailComponent` stays exactly as it was (still fully cross-machine) because
`WorkOrderListComponent`'s info dialog needs that unfiltered view verbatim. Bolting a
machine-filter mode onto the same component would mean every template block gets an
`*ngIf` fork between "WO-wide" and "this machine only" — two genuinely different pages
sharing one component. A separate, purpose-built component reading the same underlying
data is simpler than one component doing two jobs.

**No new backend calls** — this component reuses `MachineOverviewDataService.getWorkOrderDetail()`
and `.getWorkOrderWastageDetail()` (the exact same two calls `WorkOrderDetailComponent` makes)
and filters the response client-side to the current machine. `WorkOrderDetail.machines[]`
already has one row per (machine, shift); `WorkOrderWastageDetail.allocationsByType[typeId]`
already has one row per machine per type — both are just filtered down to
`row.machineId === Number(machineKey)`.

---

## Inputs (@Input)

| Input | Type | Purpose |
|---|---|---|
| `workOrderId` | `number \| null` | The work order to show this machine's contribution to |
| `machineKey` | `string \| null` | Same string machine key `MachineWorkOrdersComponent`/`MachineOverviewComponent` already hold — converted to `Number(machineKey)` internally to compare against `WorkOrderMachineBreakdownRow.machineId`/`WastageAllocationRow.machineId` (both numbers) |

---

## State Properties

| Property | Type | Source |
|---|---|---|
| `workOrder` | `WorkOrderDetailHeader \| null` | `detail.workOrder` from `getWorkOrderDetail()` — header context (customId, status, productName) |
| `woTotals` | `{goodCount, totalCount, quantityTarget, percentComplete} \| null` | `detail.totals` — **WO-wide**, shown only as a thin "WO Progress" context strip in the header, not this component's focus |
| `machineShiftRows` | `MachineShiftRow[]` (local interface) | `detail.machines` filtered to this machine — one row per shift this machine has logged against this WO |
| `machineTotals` | `{goodCount, scrapCount, totalCount}` | Reduced sum of `machineShiftRows` |
| `machineWastageRows` | `(WastageAllocationRow & {wastageTypeName})[]` | For each `wastageDetail.byType` entry, the one allocation row (if any) belonging to this machine — built by looking up `allocationsByType[typeId]` and filtering to `machineId` |
| `machineWastageTotal` | `number` | Sum of `machineWastageRows[].allocatedQtyKg` |
| `oeeMetrics` | `Metric[]` | `detail.oeeByMachine[machineId]` — this machine's own Availability/Performance/Quality/Efficiency scoped to this WO, `[]` until this machine has logged production against it |

---

## Per-machine OEE

Node-server's `WorkOrderDetailService.computeOee()` returns a per-machine breakdown
(`oee_by_machine`, keyed by `machine_id`) alongside the WO-wide aggregate — the per-machine
engagement windows were already computed internally to build that aggregate, so no extra
query was needed to also expose them individually. `MachineOverviewDataService.getWorkOrderDetail()`
maps `oee_by_machine` into `WorkOrderDetail.oeeByMachine: Record<number, Metric[]>`, and this
component reads its own slot (`oeeByMachine[machineId]`) — **no new backend call**, same
`getWorkOrderDetail()` request this component already made. Rendered via the same
`app-quality-efficiency` tiles `WorkOrderDetailComponent` uses for the WO-wide figure, as a
second row inside the compact WO context header card (border-top divider) — not a separate
boxed box at the header-card level, since both rows describe "this machine, this WO" at a
glance. That second row is a 40/60 `grid grid-cols-1 sm:grid-cols-[4fr_6fr]`:
- Left: Good / Total Wastage / Total tiles, wrapped in a small outer card
  (`rounded-lg p-3 bg-[var(--sapGroup_ContentBackground)] border`) — `machineTotals.goodCount`
  / `machineWastageTotal` / `machineTotals.totalCount` — always shown, no `*ngIf`, since these
  numbers exist independent of whether OEE has been computed. Note: the middle tile reads
  **Total Wastage** (`machineWastageTotal`, in kg), not `machineTotals.scrapCount` — scrap
  count itself isn't shown in this row. Each of the 3 tiles is *also* individually boxed
  (`rounded-2xl p-3 bg-[var(--sapTile_Background,#fff)] border border-[var(--sapTile_BorderColor,#d9d9d9)]`)
  — the exact colors `quality-efficiency.component.scss`'s `.tile-standard` uses, copied here
  rather than referenced since this is a separate component's template with its own view
  encapsulation — so each stat reads as its own tile against the gray outer card, matching
  the right side's per-tile look (each `app-quality-efficiency` tile already boxes itself).
- Right (`*ngIf="oeeMetrics.length"`): all 4 OEE tiles (Product Availability, M/C
  Performance, Quality, M/C Efficiency) in a single-row 4-col grid, wrapped in the same small
  outer card style — hidden entirely when this machine has no OEE for this WO yet,
  independent of the always-visible left side. Each tile's own per-tile box comes from
  `app-quality-efficiency`'s `variant="compact"` styling, not this template.

These stat tiles intentionally live here (header card, next to OEE) rather than above the
production grid below — grouping "this machine's headline numbers" in one place.

This is scoped to the WO's own engagement window on this machine — distinct from this
machine's date-range-windowed OEE on the Overview tab (`getOverview()`,
`MachineOverviewComponent`), which is not duplicated here.

---

## Template Structure

```
Empty state (workOrderId or machineKey falsy) → ui5-illustrated-message "No active work order"
Busy-indicator
└── *ngIf workOrder
    ├── Compact header card — 2 rows in one card:
    │   ├── WO id/status/product (left) + "Overall Progress" context (right, `w-64`):
    │   │   label/value row (goodCount / quantityTarget (percentComplete%)) + a
    │   │   `ui5-progress-indicator` bar beneath (`valueState: 'Positive'` at 100%,
    │   │   `'None'` otherwise)
    │   └── Stat tiles + OEE row — border-top divider, same card (not a separate box);
    │       40/60 grid: left = Good / Total Wastage / Total tiles (always shown), right
    │       (*ngIf oeeMetrics.length) = all 4 compact app-quality-efficiency tiles
    └── "This Machine's Production" / "This Machine's Wastage" — 60/40 grid (`grid-cols-1
        md:grid-cols-[6fr_4fr]`), one card each, **no card title / heading** (removed —
        was redundant with the grid's own toolbar, which also no longer shows a title):
        ├── Production card: app-ag-grid-table, full width (Shift / Good / Scrap / Total /
        │   Last Logged)
        └── Wastage card: app-ag-grid-table, full width (Wastage Type / Allocated (kg))
Error state (!loading && !workOrder) → ui5-illustrated-message "Work order details unavailable"
```

Both breakdowns use `app-ag-grid-table` (`gridId="machine-work-order-production"` /
`"machine-work-order-wastage"`), `staticData: true` sources (`productionDataSource`/
`machineWastageDataSource`) reassigned client-side after each fetch — same pattern
`WorkOrderDetailComponent` uses for its own grids. Toolbar/display config are **separate
per grid**, not shared:
- `gridToolbarProductionConfig` / `gridToolbarConfig` — both `showRowCount: true`, no
  search/segment/new button, no `headerTitle` (the outer card heading and the grid's own
  toolbar title were both dropped as duplicates of each other).
- `gridDisplayproductionConfig` / `gridDisplayConfig` — both `gridHeight: '350px'`.

Row counts here are still small (1–5), but reusing the shared grid component (rather than a
bespoke `<table>`) matches this repo's AG Grid standard and gives each breakdown a
`noRowsMessage` empty state for free instead of a hand-rolled `ui5-illustrated-message`.

---

## Known Gaps
- No live polling — refreshes only when `[workOrderId]`/`[machineKey]` change, same convention as every other data source on this page.
- If this machine logged good/scrap or wastage against this WO under a *different* machine key in the past (shouldn't happen — machine identity doesn't change), it would silently not show; not a realistic scenario, not guarded against.
