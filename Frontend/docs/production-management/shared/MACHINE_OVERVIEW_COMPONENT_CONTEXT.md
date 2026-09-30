# MACHINE_OVERVIEW_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `shared/components/machine-overview/machine-overview.component.ts` |
| **HTML file** | `shared/components/machine-overview/machine-overview.component.html` |
| **Selector** | `app-machine-overview` |
| **Component type** | Non-standalone page body (declared in `ProductionModule`) |
| **Route** | `/production/mco` (routed directly — this component IS the page, not a child) |
| **Purpose** | Machine detail page: status banner, live state durations, shift-wise state breakdown, activity/runtime charts, OEE tiles, production overview tile, date-range filter, state-event drill-down, manual production-count logging, and a Work Order tab listing every open work order assigned to this machine with the selected one's full execution rollup |

Companion docs: [ENHANCEMENT_PLAN.md](../../../src/app/modules/production-management/shared/components/machine-overview/ENHANCEMENT_PLAN.md) (the phased plan this page was built from), [MISSING_INPUTS.md](../../../src/app/modules/production-management/shared/components/machine-overview/MISSING_INPUTS.md) (exactly which DB fields/forms still need to be filled in before every tile is real), and [work-order-and-log-production.md](../work-order-and-log-production.md) (full process doc for the work-order planning + manual log-production feature this page's header/tab surface).

---

## Inputs (@Input)

| Input | Type | Default | Purpose |
|---|---|---|---|
| `status` | `string` | `'ACTIVE'` | Overwritten immediately in `ngOnInit` from query params — the `@Input` is effectively vestigial given this route is never used with an input binding (it's a routed page, not embedded via template) |

---

## Query Params Read (`route.queryParams`)

| Param | Maps to |
|---|---|
| `id` | `machineData.id` (fallback `'N/A'`) |
| `name` | `machineData.name` (fallback `'N/A'`) |
| `status` | `machineData.status` → also sets `this.status` (fallback `'N/A'`) |
| `machineId` | `this.machineKey` (`String(machineId)`, or `null`; **public**, not private — also passed straight through as `[machineKey]` to `app-log-production-entry`) — key into `MachineDurationService.snapshot()` and every real-data fetch on this page |

Set by `MachineBoardComponent.detailsPage()` — see [machine-board/context.md](../machine-board/context.md#machine-key--navigation-contract).

---

## State Properties

| Property | Type | Source |
|---|---|---|
| `durations` | `MachineDurations` | `{ perState: {}, current: null, total: 0 }` default, replaced every 1s by `durationService.snapshot(machineKey)` — **real**, today-only, always live regardless of the date filter below. `perState` is a `Partial<Record<machine_state_id, seconds>>` — dynamic, not a fixed Active/Idle/Inactive/Maintenance/Fault set (see [MACHINE_DURATION_SERVICE_CONTEXT.md](MACHINE_DURATION_SERVICE_CONTEXT.md)) |
| `machineData` | `{ id, name, status, maxRpm, minRpm, maxTemp, minTemp } \| null` | id/name/status from query params; `maxRpm/minRpm/maxTemp/minTemp` merged in from `MachineOverviewDataService.getSpecs()` — **real**, reads `MachineHasConfigs`. Currently only feeds `machineData` state — `MachineDetailsComponent`, the card that used to render these, is commented out on this page (see Template Structure) |
| `rangeFrom` / `rangeTo` | `Date` | Default: start of current month → now. Set explicitly by `onDateRangeChange()`, reset by `resetDateRange()`. Also drives `getShiftBreakdown`'s window |
| `dateRangeValue` | `string` | `"DD/MM/YYYY - DD/MM/YYYY"`, bound to `ui5-daterange-picker` |
| `maxDate` | `string` | `moment().format('DD-MM-YYYY')` — prevents picking a future end date |
| `isFiltered` | `boolean` | `true` once the user explicitly picks a range via the picker; `false` after `resetDateRange()`. Purely drives the "showing a snapshot" vs "current month to date" hint text and the Reset button's disabled state |
| `pageLoading` | `boolean` | `true` while any request kicked off by `loadOverviewData()` is in flight — drives the page-level busy-indicator overlay. Backed by a private `pendingRequests` counter (`beginLoading()`/`endLoading()`) rather than a single boolean, since 4 independent fetches run per load and the overlay must stay up until the *last* one finishes, not the first |
| `dailyBreakdown` | `DailyStateBreakdown[]` | From `MachineRuntimeHistoryService.getDailyBreakdown(machineKey, rangeFrom, rangeTo)` — **real**, per-day hours over the selected range, keyed dynamically by `machine_state_id` (`hoursByState: Record<number, number>`) — backs both charts below |
| `runtime` | `DateHours[]` | `runtimeHistoryService.toActiveHours(dailyBreakdown)` — **real**, fed to `LineChartComponent`. Sums hours across every state flagged `counts_as_productive` (via `MachineStatesService`), not a hardcoded "Active" bucket |
| `datasets` | `ChartDataset[]` | `runtimeHistoryService.toStateDatasets(dailyBreakdown)` — **real**, one series per distinct state actually observed in the range (colored via `MachineStatesService.getColor()`), fed to `BarChartComponent` — no more fixed 3-of-5 hardcoding that silently dropped Maintenance/Fault |
| `target`, `achieved`, `ok`, `total`, `waste` | `number` | From `MachineOverviewDataService.getOverview()` → **node-server** `GET /api/machine/{id}/overview` — **real query, but will read 0 until `machine_production_counts`/`machine_production_targets` have data** (see MISSING_INPUTS.md #3/#4) |
| `metrics` | `Metric[]` | Same `getOverview()` call, 4 entries in order `[Availability, Performance, Quality, Efficiency]` — **all 4 real, same backend call/window**, so `Efficiency = Availability × Performance × Quality` always holds on screen |
| `shiftBreakdownDataSource` | `AgGridTableODataSourceConfig<ShiftBreakdownRow>` | From `MachineOverviewDataService.getShiftBreakdown(machineKey, rangeFrom, rangeTo)` — **real**, node-server, one row per (day × shift) inside the selected range, in the left column's grid. Static-mode data source (`staticData: true`), whole-object reassigned on refetch (same pattern as `drillDownDataSource`) so change detection doesn't reset the grid needlessly |
| `shiftBreakdownColumns` / `shiftBreakdownToolbarConfig` / `shiftBreakdownDisplayConfig` | — | `shiftBreakdownColumns` starts `[]` and is (re)built by `buildShiftBreakdownColumns()` once `MachineStatesService.loadAll()` resolves (called from `ngOnInit`): Date / Shift / one `state_{id}` column per active `machine_states` row / Total(h) — dynamic, not a fixed Active/Idle/Inactive/Maintenance set. Each numeric column `valueFormatter: (p) => (p.value ?? 0).toFixed(1)`. Fixed `gridHeight: '418px'` — percentage heights don't resolve against `ag-grid-table`'s internally `auto`-height shell (see Known Gaps / Errors history) |
| `selectedTab` | `'overview' \| 'workOrder'` | Backs the `ui5-tabcontainer`'s two tabs; set by `onTabSelect(event)` reading `event.detail.tab.id` |
| `workOrderRefreshToken` | `number` | Bumped by `onProductionLogged()` after a manual production-count log; passed as `[refreshToken]` to `app-machine-work-orders` so it re-fetches its open-work-order list + default selection. A machine can have several open work orders at once — this page no longer picks one "current" WO for itself; see [MACHINE_WORK_ORDERS_COMPONENT_CONTEXT.md](MACHINE_WORK_ORDERS_COMPONENT_CONTEXT.md) |
| `menuItems` | `string[]` | `['Machine Board', 'Configuration']` — "Machine Board" routes to `/production`; "Configuration" routes to `/base-data/machine-config`, disabled unless `canConfigureMachines` |
| `canConfigureMachines` | `boolean` | `rolePermissionService.hasPermission(Permissions.BASE_DATA_MACHINE_CONFIG)` |
| `drillDownOpen` / `drillDownTitle` / `drillDownRows` / `drillDownColumns` / `drillDownSummary` | — | Backing state for the state-event drill-down dialog (see below) |

`period` no longer exists — replaced by `rangeFrom`/`rangeTo` + a `periodLabel` getter (`"MMM D, YYYY – MMM D, YYYY"`, via `moment`, using `rangeToDisplay` — see below).

`rangeToDisplay` exists because `rangeTo` is an **exclusive** query boundary (pushed one day forward by `onDateRangeChange` so the picked end date is inclusive server-side); `rangeToDisplay` holds the actual inclusive end date so `periodLabel` doesn't show an off-by-one date to the user.

---

## Lifecycle

`ngOnInit()`:
1. `commonService.sidenavHidden.emit(true)` — hides the `LayoutComponent` sidenav since this route renders full-page.
2. Sets `canConfigureMachines` and the initial `dateRangeValue` string.
3. Subscribes `route.queryParams` → populates `machineData`/`status`/`machineKey`, then calls `loadOverviewData()`.
4. `timer(0, 1000)` subscription → `durations = durationService.snapshot(machineKey)` every second — this is the **only** recurring timer on the page.

**No periodic auto-refresh of charts/OEE/shift-breakdown/production data** — a 30s polling timer existed briefly during development and was removed (it caused visible tile flicker even after a `trackBy` fix; removed outright rather than fought further). The date-range panel, charts, OEE/Production Overview tiles, and shift breakdown grid load once on page load and again only when the user changes the filter or clicks Reset. `app-machine-work-orders`' own open-WO list additionally re-fetches right after a manual production-count log, via `workOrderRefreshToken` (see `onProductionLogged()` below and [MACHINE_WORK_ORDERS_COMPONENT_CONTEXT.md](MACHINE_WORK_ORDERS_COMPONENT_CONTEXT.md)) — independent of the date-range filter.

`ngOnDestroy()`: unsubscribes the `timer` subscription. The `queryParams` subscription is **not** torn down (leak risk if this component is ever reused without full destroy/recreate — currently mitigated because it's routed, so Angular destroys/recreates it fully on navigation away).

---

## Methods

| Method | Description |
|--------|-------------|
| `pct(seconds)` | `seconds / durations.total * 100`, rounded, `0` if `total` is falsy — used for the state-duration progress bars (left panel only) |
| `onTabSelect(event)` | `this.selectedTab = event.detail.tab.id` — switches between `overview`/`workOrder` |
| `onDateRangeChange(event)` | Parses the picker's `"DD/MM/YYYY - DD/MM/YYYY"` string via `moment`, sets `rangeFrom`/`rangeTo`/`rangeToDisplay`, sets `isFiltered = true`, calls `loadOverviewData()` |
| `resetDateRange()` | `isFiltered = false`, `resetRangeToCurrentMonth()`, updates `dateRangeValue`, reloads |
| `resetRangeToCurrentMonth()` (private) | `rangeFrom` = start of current month, `rangeTo`/`rangeToDisplay` = now |
| `onProductionLogged()` | Handler for `app-log-production-entry`'s `(logged)` output — increments `workOrderRefreshToken`, which `app-machine-work-orders` picks up via its own `[refreshToken]` input to re-fetch its open-WO list + default selection |
| `onDay(e: DateHours)` | Line-chart click — `e.date` is already a real `Date`; opens the drill-down for that calendar day |
| `onPointClick(event)` | Bar-chart click — resolves `event.dataIndex` directly against `dailyBreakdown[dataIndex].date` (no label-parsing) and opens the drill-down for that day |
| `onPointHover(event)` | No-op — left as-is; Chart.js's own tooltip already covers hover feedback |
| `closeDrillDown()` | Sets `drillDownOpen = false` (also fires from `ui5-dialog`'s `before-close`, e.g. Escape key) |
| `openDrillDown(start, end, title)` (private) | Fetches `runtimeHistoryService.getEventsInRange(machineKey, start, end)`, maps to `DrillDownRow[]`, opens the dialog |
| `toDrillDownRow(row)` (private) | Maps a raw `MachineStateEventRow` to `{machineStateId, started_at, ended_at, duration_seconds}` — computes `duration_seconds` live (`now - started_at`) for the still-open row. `machineStateId` is resolved to a name/color for display via `MachineStatesService` in `drillDownColumns`' `valueFormatter`/`cellStyle`, not rendered as a raw string |
| `loadOverviewData()` (private) | Fires 4 independent fetches for the current `rangeFrom`/`rangeTo`, each wrapped in `beginLoading()`/`endLoading()`: `getDailyBreakdown` (charts, Promise-based, `.finally()`), `getSpecs` (machine thresholds), `getOverview` (production + OEE), `getShiftBreakdown` (the new shift-wise grid) — the latter 3 Observable-based, `.pipe(finalize(...))` |
| `beginLoading()` / `endLoading()` (private) | Increment/decrement `pendingRequests`; `pageLoading` flips back to `false` only when the counter reaches 0, so the overlay doesn't disappear after the first of 4 concurrent fetches completes |
| `trackByMetricLabel` | `(_, m) => m.label` — `trackBy` for the OEE tiles' `*ngFor`. Without this, replacing `metrics` on every reload destroyed and recreated all 4 tile components instead of just updating their bound values — visible as a flicker |

---

## Template Structure

```
Header (status banner + identity + app-log-production-entry + menu buttons)
Main content: relative wrapper
├── busy-indicator overlay (*ngIf="pageLoading", absolutely positioned sibling — NOT wrapping the tabcontainer)
└── ui5-tabcontainer (Overview / Work Order)
    ├── Overview tab — grid-cols-12
    │   ├── col-span-3: state-durations card (live) + shift-breakdown app-ag-grid-table
    │       (app-machine-details is commented out here, not removed — see Known Gaps)
    │   ├── col-span-5: app-bar-chart ("Recent – Activity") + app-line-chart ("Runtime – {periodLabel}")
    │   └── col-span-4: date-range panel + OEE tiles + app-production-overview
    └── Work Order tab — <app-machine-work-orders [machineKey]="machineKey" [refreshToken]="workOrderRefreshToken">
+ ui5-dialog (state-event drill-down, app-ag-grid-table with static in-memory rows)
```

- Status banner background/icon/label is driven live by `durations.current` (the machine's current `machine_state_id`) resolved through `MachineStatesService.getColor()/getIcon()/getLabel()/getTint()` — not a hardcoded per-status map, and not the route's `status` query param (which is no longer used for display). Any admin-defined state renders correctly, including ones added after this page was written.
- A small "Last seen {{ durations.lastSeenAt | timeAgo }}" line sits under the ID line in the header (`*ngIf="durations.lastSeenAt != null"`), fed by the same `durations = durationService.snapshot(machineKey)` refresh as everything else in the left panel — `MachineDurationService.MachineDurations.lastSeenAt` (see [MACHINE_DURATION_SERVICE_CONTEXT.md](MACHINE_DURATION_SERVICE_CONTEXT.md)). This exists specifically because `durations.current` resolving to "Inactive" doesn't distinguish a legitimately idle-but-connected machine from a genuinely silent/offline PLC — this line tells the two apart. Uses `TimeAgoPipe` (`shared/pipes/time-ago.pipe.ts`), registered alongside `DurationPipe` in `production.module.ts`.
- The header used to also show a single "current work order/shift" chip (fed by `getCurrentWorkOrderShift`) — **removed**, since a machine can have several open work orders at once and highlighting just one was misleading. That concept moved entirely into `app-machine-work-orders` (Work Order tab), which now lists every open WO and lets the user pick which one to view — see [MACHINE_WORK_ORDERS_COMPONENT_CONTEXT.md](MACHINE_WORK_ORDERS_COMPONENT_CONTEXT.md).
- Live duration bars are an `*ngFor` over `machineStates.getAll()` (one row per active `machine_states` row, priority order) — each shows `duration | duration` pipe text + a width-bound progress bar via `pct()`, colored via `machineStates.getColor(state.id)`. Not a fixed 4-row block.
- OEE section deliberately gives `M/C Efficiency` visual weight (large gradient hero tile) with Availability/Performance/Quality as 3 smaller "contributing factor" tiles beneath it, via `QualityEfficiencyComponent`'s `variant` input — see its own context doc.
- Drill-down dialog's `[dataSource]` uses the AG Grid **static** mode (`{ type: 'odata', endpoint: '', staticData: true, data: drillDownRows }`) — a small in-memory row set, not a real OData source. `shiftBreakdownDataSource` uses the same static-mode pattern.
- Busy-indicator overlay pattern: `<ui5-busy-indicator>` does **not** propagate flex/percentage height through its default slot — nesting `<ui5-tabcontainer>` inside one collapsed the whole page's height. Fixed by making the overlay an absolutely-positioned `*ngIf` sibling of the tabcontainer instead (`class="absolute inset-0 z-10 ..."`), both inside a shared `relative` wrapper.

---

## Known Gaps

- **`MachineDetailsComponent` is commented out, not removed**, in the Overview tab's left column — the Shift Breakdown grid now occupies that spot instead. Re-enable by uncommenting the block in the template if Machine Details needs to come back; see [MACHINE_DETAILS_COMPONENT_CONTEXT.md](MACHINE_DETAILS_COMPONENT_CONTEXT.md).
- All charts/tiles wired to real backend data — the *values* they show are 0/N/A for reasons documented precisely in [MISSING_INPUTS.md](../../../src/app/modules/production-management/shared/components/machine-overview/MISSING_INPUTS.md), summarized:

| Shows | Real data source | Why still 0/N/A |
|---|---|---|
| M/C Performance | `machine_has_configs.ideal_cycle_seconds` + `machine_production_counts` | Column not yet in the config form/validation |
| Quality / Wastage | `machine_production_counts.good_count/scrap_count` | Populated only where operators have logged production manually — see [work-order-and-log-production.md](../work-order-and-log-production.md) |
| Production Target | `machine_production_targets` | Table has zero UI to populate it anywhere in the app — biggest remaining gap |

- `onPointHover` is intentionally still a no-op (Chart.js's built-in tooltip covers it) — this is a decision, not an oversight.
- Overlapping shifts (two `EmployeeShifts` definitions covering the same clock minutes) will double-count that machine's seconds across two shift-breakdown rows — inherent to shifts not being stored per-event, not a bug to fix in this component.
- No live polling anywhere on this page — `currentWorkOrderShift`, the shift breakdown, and every OEE/production figure refresh only on page load, filter change, or (for `currentWorkOrderShift` only) right after a manual log.
