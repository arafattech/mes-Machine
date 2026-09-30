# WORK_ORDER_DETAIL_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `shared/components/work-order-detail/work-order-detail.component.ts` |
| **HTML file** | `shared/components/work-order-detail/work-order-detail.component.html` |
| **Selector** | `app-work-order-detail` |
| **Component type** | Non-standalone (declared in `ProductionModule`) |
| **Used by** | `WorkOrderListComponent`'s info action (`/production/work-orders`): `<app-work-order-detail [workOrderId]="detailWorkOrderId">` inside a `ui5-dialog` — see [WORK_ORDER_LIST_COMPONENT_CONTEXT.md](../production-plan-log/WORK_ORDER_LIST_COMPONENT_CONTEXT.md#full-work-order-detail-info-action--added-2026-08-02). **Changed 2026-08-02**: previously embedded in `MachineWorkOrdersComponent`'s Work Order tab (per-machine `/mco` page) — moved here since this is the full cross-machine dashboard, and a single machine's page shouldn't show every other machine's data. That page now uses the lighter, machine-scoped [MACHINE_WORK_ORDER_OVERVIEW_COMPONENT_CONTEXT.md](MACHINE_WORK_ORDER_OVERVIEW_COMPONENT_CONTEXT.md) instead. |
| **Purpose** | Renders a work order's header (status badge, schedule-variance badge, planned-vs-active machine count, quick stats) always visible, then 3 tabs for everything else: **Overview** (OEE scoped to this WO + overall progress bar), **Machines & Shifts** (execution rollup grid, one row per machine+shift that has logged against this WO), **Wastage** (bar chart + breakdown grid + per-machine drill-down, optionally filtered by shift/date). Tabbed 2026-08-02 — this is the full cross-machine dashboard (see "Used by" above), enough information that one long scroll stopped being the right layout. |

See [work-order-and-log-production.md](../work-order-and-log-production.md) for the full process this component is the read-side of.

---

## Inputs (@Input)

| Input | Type | Purpose |
|---|---|---|
| `workOrderId` | `number \| null` | The work order to display. `null` when the current machine has no resolved "current work order" — component shows an empty state, not an error |

---

## State Properties

| Property | Type | Source |
|---|---|---|
| `selectedTab` | `'overview' \| 'machines' \| 'wastage'` | Which tab is showing; reset to `'overview'` whenever `[workOrderId]` changes so switching work orders doesn't leave you stranded on a tab you weren't looking at |
| `loading` | `boolean` | `true` while `getWorkOrderDetail()` is in flight |
| `detail` | `WorkOrderDetail \| null` | `MachineOverviewDataService.getWorkOrderDetail(workOrderId)` — `null` until first fetch resolves or `workOrderId` is `null`. Includes `detail.oeeMetrics: Metric[]` (Availability/Performance/Quality/Efficiency), rendered via 4 `app-quality-efficiency` compact tiles — OEE scoped to this one work order (not a machine, not a date range), computed server-side, see Known Gaps for the approximation involved |
| `breakdownDataSource` | `AgGridTableODataSourceConfig<WorkOrderMachineBreakdownRow>` | Static-mode data source (`staticData: true`), whole-object reassigned on refetch — same pattern as `MachineOverviewComponent`'s `drillDownDataSource`, so change detection doesn't reset the grid needlessly |
| `breakdownColumns` | `AgGridTableColumn<WorkOrderMachineBreakdownRow>[]` | Machine / Shift / Good / Scrap / Total / First Logged / Last Logged — the latter two `valueFormatter`'d via `new Date(value).toLocaleString()` |
| `toolbarConfig` / `displayConfig` | — | `headerTitle: 'Machines & Shifts'`, fixed `gridHeight: '260px'` |
| `wastageDetail` | `WorkOrderWastageDetail \| null` | `MachineOverviewDataService.getWorkOrderWastageDetail(workOrderId, {shiftId, date})` — `null` until first fetch resolves. `byType` feeds both the bar chart and the breakdown grid; `allocationsByType` (keyed by `wastageTypeId`) feeds the per-machine drill-down dialog |
| `wastageChartDatasets` | `ChartDataset[]` (from `bar-chart.component`) | Single dataset, one point per wastage type: `{x: wastageTypeName, y: totalQtyKg}` — feeds `<app-bar-chart chartType="bar">` |
| `wastageColumns` / `wastageDataSource` / `wastageToolbarConfig` / `wastageDisplayConfig` | — | Wastage Type / Total (kg) / % of Total grid, `gridId="work-order-wastage-breakdown"`, `staticData: true` reassigned on every fetch (same "stable reference, only reassigned on a real fetch" pattern as `breakdownDataSource`) |
| `wastageShiftOptions` | `ShiftOption[]` | `MachineOverviewDataService.getActiveShifts()`, loaded once in the constructor — feeds the section's own Shift filter combobox (independent of any shift selected elsewhere on the page) |
| `wastageFilterShiftId` / `wastageFilterDate` | `number \| null` / `string \| null` | Both optional; reset to `null` whenever `[workOrderId]` changes. Passed straight through to `getWorkOrderWastageDetail`'s `filter` param — this is what gives the "per shift per WO" / "per day per WO" / whole-WO (both `null`) reporting scopes from one section |
| `machineAllocationsOpen` / `machineAllocationsSubtitle` / `machineAllocations` / `machineAllocationsDataSource` | dialog state | Set by `viewMachineAllocations(row)` — the wastage-type row's info-icon drill-down, `WastageAllocationRow[]` (Machine / Allocated kg) |
| `plannedMachinesDialogOpen` | `boolean` | Default `false`. Drives the "Planned Machines" `ui5-dialog` — the header banner no longer shows planned-machine chips inline at all; they're only ever seen inside this dialog, opened by clicking the "Machines Active" KPI card. Opened/closed by `openPlannedMachinesDialog()`/`closePlannedMachinesDialog()` |
| `machines` (private) | `Machine[]` | Mirrors `ProductionService.machines$` — the same app-wide list `MachineBoardComponent`'s "All Machines" page reads, populated by `LayoutComponent`'s `loadMachines('all-machines')` call on module entry. **Not re-fetched here** — this component only subscribes, so it never clobbers a hall-filtered list some other page set via `loadMachines(hallId)`. Used to resolve each planned machine's live status (see `plannedMachinesWithStatus`) |
| `machineDataMap` (private) | `Map<string, SocketTelemetry>` | Latest `to_frontend` socket telemetry per machine, keyed by `MNR` — same live-status source `MachineBoardComponent`/`machine-status-card` read from the one shared `SocketService` connection. Both this and `machines` are populated via constructor subscriptions torn down with `takeUntilDestroyed(destroyRef)` |

### Header getters (always visible, not tab-scoped)

| Getter | Returns | Purpose |
|---|---|---|
| `machinesTabLabel` / `wastageTabLabel` | `string` | Tab text with a live count suffix, e.g. `"Machines & Shifts (3)"` / `"Wastage (2)"` — built from `detail?.machines.length`/`wastageDetail?.byType.length` so the tab strip itself is informative before you even click into it |
| `activeMachineIds` (private) | `Set<number>` | Distinct `machineId`s from `detail.machines` — used only by `activeMachineCount`. *Not* used by `plannedMachinesWithStatus` (that reads live socket/board status instead, see below) — this set means "logged production against this WO", a different question from "is this machine currently running" |
| `activeMachineCount` | `number` | `activeMachineIds.size` — how many *distinct* machines have actually logged against this WO |
| `plannedMachineCount` | `number` | `detail.workOrder.plannedMachines.length` — shown as "`activeMachineCount` / `plannedMachineCount` planned" so planned-vs-executed divergence (see [work-order-and-log-production.md](../work-order-and-log-production.md#2-data-model)) is visible at a glance, not just in the Machines & Shifts grid |
| `plannedMachinesWithStatus` | `(PlannedMachine & {statusLabel: string; statusColor: string; statusTint: string})[]` | Each planned machine's **live** status — same source the "All Machines" board shows, not WO-logged-production. For each `PlannedMachine` (`{id, machineName}` — `id` confirmed to be the machine's own PK, node-server's `work-order-detail.service.ts` maps it from the joined `machines` row, not the `work_order_machines` pivot row), finds the matching `machines` entry, resolves its telemetry via `getMachineLiveData()`, runs it through `deriveActivity()` (`@production-module/shared/utils/machine-status`), then looks up display info via `MachineStatesService.getByName()`/`.getTint()`. Feeds the per-machine status badge in the Planned Machines dialog. Falls back to `'INACTIVE'`/`'#6a6d70'` when no telemetry has arrived yet for that machine this session — same behavior as a fresh load of the "All Machines" board |
| `getMachineLiveData(machine)` (private) | `SocketTelemetry \| undefined` | Matches a `Machine` to its `machineDataMap` entry by `id`, then `custom_id`, then digits-only `custom_id` — identical fallback chain to `MachineBoardComponent.getMachineData()`, since telemetry's `MNR` key can be either depending on machine config |
| `startVariance` | `{label, tone: 'positive'\|'warning'\|'neutral'} \| null` | `null` when `scheduledStart` or `actualStart` is missing (nothing to compare — deliberately not shown rather than faking a "0 days" reading). Otherwise a plain-language "Started on schedule" / "Started N day(s) late" / "Started N day(s) early" badge next to the status badge, `moment().startOf('day').diff(...)` in whole days |

---

## Lifecycle

`ngOnChanges(changes)` — the component's only lifecycle hook (no `ngOnInit`, since everything depends on `workOrderId` which may arrive as `null` first and change later without a full destroy/recreate, as the parent's `currentWorkOrderShift` resolves or a new log changes which WO is "current"):
1. Ignore if `workOrderId` wasn't the changed input.
2. If `workOrderId` is falsy: reset `detail` to `null`, clear the grid, return.
3. Otherwise: `loading = true`, fetch `getWorkOrderDetail(workOrderId)`, populate `detail` + `breakdownDataSource`, `loading = false`.

---

## Methods

| Method | Description |
|--------|-------------|
| `formatDate(value)` | `moment(value).format('MMM D, YYYY')` or an em-dash (`$localize`'d `'—'`) if `null` — used for scheduled/actual start dates in the header |
| `trackByMetricLabel` | `(_, m) => m.label` — `trackBy` for the OEE tiles' `*ngFor`, same idiom `MachineOverviewComponent` uses for its own OEE tiles |
| `fetchWastageDetail()` (private) | Calls `getWorkOrderWastageDetail` with the current `wastageFilterShiftId`/`wastageFilterDate`, rebuilds `wastageDataSource`/`wastageChartDatasets` from the response. Called from `ngOnChanges` and every filter-change handler below |
| `onWastageFilterShiftChange(event)` / `onWastageFilterDateChange()` | Update `wastageFilterShiftId`/`wastageFilterDate`, then re-run `fetchWastageDetail()` |
| `clearWastageFilter()` | Resets both filter fields to `null` and re-fetches — back to the whole-work-order total |
| `viewMachineAllocations(row)` | Reads `wastageDetail.allocationsByType[row.wastageTypeId]`, opens the per-machine drill-down dialog — same "info icon → nested grid" idiom as `PRODUCTION_LOG_LIST_COMPONENT_CONTEXT.md`'s per-group drill-down |
| `closeMachineAllocations()` | Closes the drill-down dialog |
| `openPlannedMachinesDialog()` / `closePlannedMachinesDialog()` | Open/close the Planned Machines dialog — the "Machines Active" KPI card is `role="button"`/`tabindex="0"` and wired to `(click)`/`(keydown.enter)` → `openPlannedMachinesDialog()`; the dialog's own `(before-close)` calls `closePlannedMachinesDialog()`, same idiom as `closeMachineAllocations()` |
| `onTabSelect(event)` | `(tab-select)` handler on the `ui5-tabcontainer` — `this.selectedTab = event.detail.tab.id`, same idiom `ProductionLogFormComponent` already uses for its own two-tab dialog |

Also re-exports `getWorkOrderStatusColor`/`getWorkOrderStatusTint`/`getWorkOrderStatusLabel` from `@production-module/shared/utils/work-order-status.util` as readonly instance fields, so the template can call them directly (same pattern `MachineOverviewComponent` uses for its header chip's status badge — both consume the same shared util rather than duplicating the status→color/label mapping).

---

## Live machine status dependency (added alongside the Planned Machines dialog)

There is no persisted "current status" field on `Machine` — it only exists as live `to_frontend`
socket telemetry, resolved client-side via `deriveActivity()`. Showing a real Active/Idle/
Inactive/Maintenance/Fault badge per planned machine (rather than a WO-scoped "has it logged
production" boolean) therefore requires this component to plug into the same realtime pipeline
`MachineBoardComponent` ("All Machines" page) uses: `ProductionService.machines$` +
`SocketService.on('to_frontend')` + `MachineStatesService`. This was a deliberate scope call
(vs. a lighter status-badge-less version) — chosen so the dialog shows real status instead of a
WO-specific proxy for it.

Kept as small as reasonably possible:
- **No new HTTP/socket connections.** `ProductionService`/`SocketService`/`MachineStatesService`
  are all `providedIn: 'root'` singletons already populated elsewhere (`LayoutComponent`'s
  `loadMachines('all-machines')` on module entry, `ProductionModule`'s `MachineStatesService.loadAll()`,
  one shared `socket.io` connection) — this component only *subscribes*, via constructor-time
  `takeUntilDestroyed(destroyRef)` subscriptions, same lifecycle idiom `MachineBoardComponent` uses.
- **Deliberately does not call `loadMachines()` itself** — doing so would overwrite the shared
  `machines$` BehaviorSubject for every other consumer (e.g. if another page had scoped it to one
  Hall via `loadMachines(hallId)`, this dialog would silently reset it back to all-machines).
  Reading whatever is already there avoids that cross-component side effect entirely.
- **No uptime timer.** `MachineDurationService` (the piece that drives `machine-status-card`'s
  running-time display) was deliberately left out — badge + color only, per explicit scope
  decision, since this dialog's job is "which machines, what state", not a live dashboard.

---

## Template Structure (as a separate, non-inline component)

```
Empty state (workOrderId null → ui5-illustrated-message "No active work order") OR:
├── Header (always visible, above the tabs): icon chip + custom_id/WO-id, status badge,
│   startVariance badge (only if both dates present), product name — no planned-machine
│   chips inline here anymore (moved to a dialog, see below)
│   └── Quick-info tiles: Target Quantity · Machines Active (X/Y planned) — clickable
│       (`role="button"`), opens the Planned Machines dialog via
│       `openPlannedMachinesDialog()` · Scheduled Start · Actual Start · Total Wastage
│       (red-tinted)
└── ui5-tabcontainer (tab-select → onTabSelect)
    ├── "Overview" tab
    │   └── grid-cols-12 row
    │       ├── col-span-7: Work Order OEE — 4 app-quality-efficiency compact tiles
    │       └── col-span-5: Progress bar — achieved/target (capped visually at 100%)
    ├── "Machines & Shifts (N)" tab [machinesTabLabel]
    │   └── app-ag-grid-table — execution rollup (breakdownColumns/breakdownDataSource)
    └── "Wastage (N)" tab [wastageTabLabel]
        ├── Header row: "Wastage Breakdown" + "Total: X kg" badge, Shift/Date filters + Clear
        ├── app-bar-chart (chartType="bar") — qty_kg per wastage type, hidden if none logged
        └── app-ag-grid-table — Wastage Type / Total (kg) / % of Total, info icon → per-machine allocation dialog
Detail-unavailable state → ui5-illustrated-message "Work order details unavailable"

Two more ui5-dialogs, both siblings of the busy-indicator:
- Opened via `machineAllocationsOpen` — the per-machine drill-down grid (Machine / Allocated kg)
  for whichever wastage-type row's info icon was clicked.
- Opened via `plannedMachinesDialogOpen` — the Planned Machines list, opened from the header's
  "Machines Active" KPI card. Renders `plannedMachinesWithStatus` as a card grid
  (`grid-cols-2 sm:grid-cols-3`), not a `app-ag-grid-table` — deliberately, since this is a
  small (≤ dozens) glanceable list, not tabular data needing sort/filter/paging. Each card
  shows the machine name plus its **live** status badge (`statusLabel`, colored via
  `[style.color]`/`[style.background]`/`[style.borderColor]` bound to `statusColor`/
  `statusTint` — not Tailwind classes, since the color is data-driven per admin-configured
  `machine_states`, not one of a fixed set).
```

Uses raw Tailwind `bg-[var(--sapXxx,#fff)]`-style arbitrary-value classes for card backgrounds rather than the `.panel`/`.panel-title` classes `MachineOverviewComponent` uses — those are defined in `machine-overview.component.scss` and are view-encapsulated to that component, so they're unusable from this separate component's template. If a shared card style is wanted across both, it would need promoting to a shared SCSS/Tailwind utility rather than copied ad hoc.

Both empty states use `ui5-illustrated-message` (`name="NoData"` / `name="UnableToLoad"`) rather than plain text — matches the illustrated-message convention already used elsewhere in this app (`work-order-list.component.html`'s ag-grid empty state, `machine-board.component.html`'s `NoEntries`), replacing this component's original plain-text empty states.

---

## Known Gaps
- No live polling — refreshes only when `[workOrderId]` changes (parent's `MachineWorkOrdersComponent` re-fetches its list/selection on machine change or after a manual log). Two operators logging simultaneously against the same WO from different machines won't see each other's rows until their own next fetch.
- `percentComplete` **is** clamped server-side at 100 (`node-server`'s `WorkOrderDetailService.detail()`: `Math.min(100, (totalGood / quantity) * 100)`) — a WO logged past its target quantity still reports exactly `100`, not a number above it. The frontend's `[style.width.%]="totals.percentComplete ?? 0"` binding has no clamp of its own, but doesn't need one given the guarantee upstream.
- **Work Order OEE is an approximation, same class as `MachineCalculationsService.overview()`'s per-machine version:**
  - Availability/Performance are computed per machine over that machine's *overall engagement window* for this WO (earliest bucket start → latest bucket end), not per individual bucket — buckets chain end-to-end per machine with no gaps, so this is a close approximation, not exact if a machine was reassigned to other work between two of its buckets for this WO.
  - Performance uses the AVERAGE `ideal_cycle_seconds` across the machines involved, not a per-machine-weighted figure — same documented simplification as the per-machine and fleet-wide OEE calculations elsewhere in this module.
  - `oeeMetrics` comes back as 4 zeroed `Metric`s (not an empty array) when no machine has logged against this WO yet — `availability`/`performance`/`quality`/`efficiency` are all `null` server-side, mapped to `0` for display, same convention as every other OEE tile in this app.
- **Wastage entry itself doesn't happen here.** This section is read-only — logging a new wastage entry is `LogWastageComponent`, opened from the dedicated "Wastage Log" page (`production-plan-log/wastage-logs/`, see [WASTAGE_LOG_LIST_COMPONENT_CONTEXT.md](../production-plan-log/WASTAGE_LOG_LIST_COMPONENT_CONTEXT.md)). This component doesn't refresh automatically after such a submit (no shared event bus between the two pages); the user has to re-navigate (or re-select the work order) to see a just-logged entry reflected.
- The Shift filter here is this section's own combobox, independent of any shift picked elsewhere on the page (there is no page-wide shift context to inherit) — clearing it only resets this section, not the Machines & Shifts grid above.
