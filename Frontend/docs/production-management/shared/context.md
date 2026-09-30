# Production Management — Shared Resources

## Module Alias
`@production-module/*` → `src/app/modules/production-management/*`

## Files
```
shared/
├── components/
│   ├── status-card/                  ← summary tile (overall/active/idle/inactive/maintenance/fault)
│   ├── machine-status-card/          ← per-machine tile (compact + detailed layouts)
│   ├── machine-overview/             ← /mco page body (tabs: Overview / Work Order)
│   ├── machine-details/              ← machine info sub-card (dumb, presentational; currently commented out on /mco)
│   ├── machine-work-orders/          ← Work Order tab — list of a machine's open work orders + selected one's (machine-scoped) overview
│   ├── machine-work-order-overview/  ← this machine's own good/scrap/wastage on the selected WO (not cross-machine)
│   ├── work-order-detail/            ← FULL cross-machine WO dashboard — header + WO-wide OEE + progress + execution rollup grid + wastage; used by WorkOrderListComponent's info dialog, not per-machine pages
│   ├── log-production-entry/         ← "Log Production" button + manual-entry dialog (per-machine, on /mco)
│   ├── quality-efficiency/           ← single OEE-style metric tile
│   ├── production-overview/          ← target-vs-achieved production tile
│   ├── bar-chart/                    ← generic Chart.js bar/line wrapper
│   └── line-chart/                   ← generic Chart.js line wrapper (day-of-month runtime)
├── services/
│   ├── production.service.ts               ← hall/machine list loading
│   ├── machine-duration.service.ts         ← live per-state duration tracker (today only)
│   ├── machine-runtime-history.service.ts  ← historical MachineStateEvents reporting (arbitrary date range)
│   ├── machine-overview-data.service.ts    ← machine specs, production/OEE, shift breakdown, work-order data for /mco (Laravel + node-server split)
│   ├── machine-maintenance.service.ts      ← machine-maintenance CRUD write client (REST); reads go through AG Grid OData
│   └── production-log.service.ts           ← work-order machines lookup + batch production-count submit for production-log-form
├── interface/interface.ts            ← shared interfaces
├── utils/
│   ├── types.ts                      ← shared type unions
│   ├── machine-status.ts             ← deriveActivity() — telemetry → status
│   └── work-order-status.util.ts     ← getWorkOrderStatusColor/Tint/Label() — shared WO status → color/label mapping
├── enums/viewMode.ts                 ← COMPACT / DETAILED / FULL_SCREEN
└── pipes/
    ├── duration.pipe.ts              ← seconds → HH:mm:ss
    └── time-ago.pipe.ts              ← epoch ms → "Just now" / "Xm ago" / "Xh ago" / "Xd ago"
```

`ProductionLogListComponent`/`ProductionLogFormComponent` (the global "Log Production" page + its entry modal, `production-plan-log/Production-logs/`) and `WastageLogListComponent`/`LogWastageComponent` (the global "Wastage Log" page + its entry modal, sibling folder `production-plan-log/wastage-logs/`) live outside `shared/components/` — routed pages/modals opened from a route, not reusable presentational pieces shared across this module's other pages. See [production-plan-log/context.md](../production-plan-log/context.md). `ProductionLogService` (below) and `ProductionLogEntryRow`/`EligibleWastageType`/`WastageTypeBreakdown`/`WastageAllocationRow`/`WorkOrderWastageDetail` (interfaces, below) stay in `shared/` — those genuinely are shared data-access/types.

## Components

| Component | Context file |
|---|---|
| `StatusCardComponent` | [STATUS_CARD_COMPONENT_CONTEXT.md](STATUS_CARD_COMPONENT_CONTEXT.md) |
| `MachineStatusCardComponent` | [MACHINE_STATUS_CARD_COMPONENT_CONTEXT.md](MACHINE_STATUS_CARD_COMPONENT_CONTEXT.md) |
| `MachineOverviewComponent` | [MACHINE_OVERVIEW_COMPONENT_CONTEXT.md](MACHINE_OVERVIEW_COMPONENT_CONTEXT.md) |
| `MachineDetailsComponent` | [MACHINE_DETAILS_COMPONENT_CONTEXT.md](MACHINE_DETAILS_COMPONENT_CONTEXT.md) |
| `MachineWorkOrdersComponent` | [MACHINE_WORK_ORDERS_COMPONENT_CONTEXT.md](MACHINE_WORK_ORDERS_COMPONENT_CONTEXT.md) |
| `WorkOrderDetailComponent` | [WORK_ORDER_DETAIL_COMPONENT_CONTEXT.md](WORK_ORDER_DETAIL_COMPONENT_CONTEXT.md) — full cross-machine dashboard incl. "Wastage by Type"; used by `WorkOrderListComponent`'s info dialog |
| `MachineWorkOrderOverviewComponent` | [MACHINE_WORK_ORDER_OVERVIEW_COMPONENT_CONTEXT.md](MACHINE_WORK_ORDER_OVERVIEW_COMPONENT_CONTEXT.md) — this machine's own contribution to a WO, used on `/mco`'s Work Order tab |
| `LogProductionEntryComponent` | [LOG_PRODUCTION_ENTRY_COMPONENT_CONTEXT.md](LOG_PRODUCTION_ENTRY_COMPONENT_CONTEXT.md) |
| `QualityEfficiencyComponent` | [QUALITY_EFFICIENCY_COMPONENT_CONTEXT.md](QUALITY_EFFICIENCY_COMPONENT_CONTEXT.md) |
| `ProductionOverviewComponent` | [PRODUCTION_OVERVIEW_COMPONENT_CONTEXT.md](PRODUCTION_OVERVIEW_COMPONENT_CONTEXT.md) |
| `BarChartComponent` | [BAR_CHART_COMPONENT_CONTEXT.md](BAR_CHART_COMPONENT_CONTEXT.md) |
| `LineChartComponent` | [LINE_CHART_COMPONENT_CONTEXT.md](LINE_CHART_COMPONENT_CONTEXT.md) |

## Services

| Service | Context file |
|---|---|
| `ProductionService` | [PRODUCTION_SERVICE_CONTEXT.md](PRODUCTION_SERVICE_CONTEXT.md) |
| `MachineDurationService` | [MACHINE_DURATION_SERVICE_CONTEXT.md](MACHINE_DURATION_SERVICE_CONTEXT.md) |
| `MachineRuntimeHistoryService` | [MACHINE_RUNTIME_HISTORY_SERVICE_CONTEXT.md](MACHINE_RUNTIME_HISTORY_SERVICE_CONTEXT.md) |
| `MachineOverviewDataService` | [MACHINE_OVERVIEW_DATA_SERVICE_CONTEXT.md](MACHINE_OVERVIEW_DATA_SERVICE_CONTEXT.md) |
| `MachineMaintenanceService` | [MACHINE_MAINTENANCE_SERVICE_CONTEXT.md](MACHINE_MAINTENANCE_SERVICE_CONTEXT.md) |
| `ProductionLogService` | [PRODUCTION_LOG_SERVICE_CONTEXT.md](PRODUCTION_LOG_SERVICE_CONTEXT.md) |

---

## Interfaces (`interface/interface.ts`)

| Interface | Fields | Used by |
|---|---|---|
| `SubItem` | `text`, `permission?`, `routerLink` | Sidenav sub-items (currently unused — no component populates `subItems`) |
| `MenuItem` | `text`, `icon`, `slot?`, `type?`, `expanded`, `permission?`, `routerLink?`, `subItems?` | `LayoutComponent.sidebarMenu` |
| `SidebarGroup` | `text`, `expanded`, `items: MenuItem[]` | `LayoutComponent.sidebarMenu` |
| `StatusCardData` | `percent`, `progress`, `counts?`, `label`, `type: StatusType` | `MachineBoardComponent.cards` |
| `Metric` | `label`, `value`, `unit?`, `delta?`, `icon?: MetricIcon`, `color?: MetricColor` | `QualityEfficiencyComponent`, `MachineOverviewComponent.metrics` |
| `OverviewTile` | `title`, `value`, `unit?`, `icon?`, `accent?: Accent`, `variant?`, `denom?`, `valueColor?` | Declared, not currently consumed by any component in this module (candidate for `ProductionOverviewComponent` internal tiles, or dead) |
| `MachineSpecs` | `maxRpm`, `minRpm`, `maxTemp`, `minTemp` | `MachineOverviewDataService.getSpecs()` return type, feeds `MachineDetailsComponent.machine` (currently unused while that component is commented out — see [MACHINE_DETAILS_COMPONENT_CONTEXT.md](MACHINE_DETAILS_COMPONENT_CONTEXT.md)) |
| `ProductionSummary` | `periodLabel`, `productionTarget`, `productionAchieved`, `machineOk`, `machineTotal`, `wastage`, `unit` | `MachineOverviewDataService.getOverview()` return type, feeds `ProductionOverviewComponent` 1:1 |
| `CurrentWorkOrder` / `CurrentShift` / `CurrentWorkOrderShift` | WO id/customId/productName/quantity/status; shift id/name/startTime/endTime/color; wrapper of both | `MachineOverviewDataService.getCurrentWorkOrderShift()` return type, feeds the header chip on `MachineOverviewComponent` |
| `PlannedMachine` / `WorkOrderDetailHeader` / `WorkOrderMachineBreakdownRow` / `WorkOrderDetail` | WO header incl. `plannedMachines`; per (machine × shift) execution row; wrapper with `totals` | `MachineOverviewDataService.getWorkOrderDetail()` return type, feeds `WorkOrderDetailComponent` |
| `EligibleWastageType` | `id`, `name` | `ProductionLogService.getEligibleWastageTypes()` return type, feeds `LogWastageComponent`'s type picker |
| `WastageAllocationRow` | `machineId`, `machineName`, `allocatedQtyKg` | One machine's share of one wastage type's total — feeds `WorkOrderDetailComponent`'s per-machine drill-down dialog |
| `WastageTypeBreakdown` | `wastageTypeId`, `wastageTypeName`, `totalQtyKg`, `percentOfTotal` | One row of `WorkOrderWastageDetail.byType` — feeds `WorkOrderDetailComponent`'s Wastage grid + chart |
| `WorkOrderWastageDetail` | `totalQtyKg`, `byType: WastageTypeBreakdown[]`, `allocationsByType: Record<number, WastageAllocationRow[]>` | `MachineOverviewDataService.getWorkOrderWastageDetail()` return type, feeds `WorkOrderDetailComponent`'s Wastage by Type section |
| `AssignedWorkOrder` | `id`, `customId`, `productName`, `quantity`, `status` | `MachineOverviewDataService.getAssignedWorkOrders()` return type, feeds `LogProductionEntryComponent`'s Work Order dropdown |
| `ShiftOption` | `id`, `name`, `startTime`, `endTime`, `color` | `MachineOverviewDataService.getActiveShifts()` return type, feeds `LogProductionEntryComponent`'s Shift dropdown |
| `ShiftBreakdownRow` | `date`, `shiftId`, `shiftName`, `shiftColor`, `activeHours`, `idleHours`, `inactiveHours`, `maintenanceHours`, `totalHours` | `MachineOverviewDataService.getShiftBreakdown()` return type, feeds the Shift Breakdown grid on `MachineOverviewComponent` |
| `ProductionLogEntryRow` | `machineId`, `machineName`, `goodCount` (`null` until typed) | `ProductionLogService.getWorkOrderMachines()` return type, feeds `ProductionLogFormComponent`'s editable entry grid — one row per machine assigned to the selected work order |
| `MachineMaintenanceSchedule` | `id`, `machineId`, `scheduledStartAt`, `reason`, `activatedAt`, `endedAt`, `endedBy: 'manual' \| 'auto' \| null` | Machine-maintenance CRUD page + `MachineMaintenanceFormComponent` (raw OData rows power the AG Grid; the interface is used for the edit form) |

## Types (`utils/types.ts`)

```ts
type MachineData = { machine_name: string; active: boolean; tempC?: number | null; hours: number };  // declared, unused
type MachineActivityType = 'ACTIVE' | 'IDLE' | 'MAINTENANCE' | 'INACTIVE' | 'FAULT';
type StatusType = 'overall' | 'active' | 'idle' | 'maintenance' | 'inactive' | 'fault';
type MetricIcon = 'box' | 'cog' | 'sparkles' | 'wrench';
type MetricColor = 'green' | 'purple' | 'orange' | 'rose';
type Accent = 'purple' | 'teal' | 'amber' | 'rose';
type DateHours = { date: Date; hoursRun: number };
```

`DateHours` replaced `DayHours` (`{day: number, hoursRun}`) on 2026-07-07 when `LineChartComponent` dropped its single-calendar-month assumption in favor of plotting arbitrary caller-supplied dates — see [LINE_CHART_COMPONENT_CONTEXT.md](LINE_CHART_COMPONENT_CONTEXT.md).

## `deriveActivity()` (`utils/machine-status.ts`)

Single source of truth for telemetry → status, used by `MachineBoardComponent`'s own status-badge logic. **No longer used by `MachineDurationService`** — that service now derives status transitions from the server-computed `machine_status_runtime` socket event instead of deriving them client-side (see [MACHINE_DURATION_SERVICE_CONTEXT.md](MACHINE_DURATION_SERVICE_CONTEXT.md)). The node-server now runs the equivalent derivation logic itself for both machine acquisition modes (`ChannelMappingService.deriveStatus` / `MachineRuntimeService.deriveLegacyState` — see node-server's `docs/CONTEXT.md`).

```
input: { STATUS?: string; A?: number; P?: number } | null | undefined
  no data              → 'INACTIVE'
  STATUS present        → uppercased, validated against ['ACTIVE','IDLE','MAINTENANCE','INACTIVE'], else 'INACTIVE'
  A === 1 (legacy)       → 'ACTIVE'
  P === 1 (legacy)       → 'IDLE'
  else                   → 'INACTIVE'
```
Note: legacy flag path (`A`/`P`) has **no way to produce `'MAINTENANCE'`** — that status only reaches the frontend via explicit `STATUS` from channel-mapping-mode machines.

## `DurationPipe` (`pipes/duration.pipe.ts`)
Standalone pipe `duration`. `seconds → HH:mm:ss`, hours not capped at 24, negative/NaN input clamped to `00:00:00`.

## `TimeAgoPipe` (`pipes/time-ago.pipe.ts`)
Standalone pipe `timeAgo`. `epoch ms → "Just now"` (< 60s) / `"Xm ago"` (< 60min) / `"Xh ago"` (< 24h) / `"Xd ago"`. `null`/`undefined` → `''`. Pure pipe — safe because its only real consumer, `MachineDurationService.snapshot()`, returns a new object reference every second, so Angular's default change detection re-evaluates it without needing `pure: false`. Feeds the "last seen" text on the machine board's Detailed-view status card and the `/mco` overview page header — see [MACHINE_DURATION_SERVICE_CONTEXT.md](MACHINE_DURATION_SERVICE_CONTEXT.md#exported-types)'s `lastSeenAt` field. Registered in `production.module.ts`'s `imports` (standalone pipe, same pattern as `DurationPipe`).

## `ViewMode` enum (`enums/viewMode.ts`)
`FULL_SCREEN`, `DETAILED`, `COMPACT` — see [module-overview/context.md](../module-overview/context.md#view-mode-driven-layout-not-routing).

---

## Common Patterns Across These Files

### Machine key normalization
Every service/component that correlates socket telemetry to a machine record uses `String(machine.id)` or `String(MNR)` as the map key — never raw numbers — because socket payloads may send `MNR` as either a string or number. `ProductionService`/`MachineBoardComponent` additionally fall back to `custom_id` and a digits-stripped `custom_id` (see [machine-board/context.md](../machine-board/context.md)).

### Root-singleton services, not route-scoped
Both `ProductionService` and `MachineDurationService` are `providedIn: 'root'` so state (hall selection, live duration counters) survives route changes between `/production` and `/production/mco`.

### `any` usage
`ProductionService.hallList$`/`machines$` are typed `Observable<any[]>` rather than `Hall[]`/`Machine[]` despite both models existing in `@shared/model/*` and being used as the typed consumption side in `LayoutComponent`/`MachineBoardComponent`. Tightening this is a non-breaking cleanup opportunity.

## Known Gaps

- `MachineOverviewComponent` (the `/mco` page) is now wired end-to-end to real backend data (`MachineStateEvents`, `MachineHasConfigs`, `machine_production_counts/targets`) — it is **no longer a mock-data shell**. The read-heavy calculation endpoints (`overview`, `shift-breakdown`, `current-work-order`, work-order `detail`) are served by **node-server**, not Laravel — see [MACHINE_OVERVIEW_DATA_SERVICE_CONTEXT.md](MACHINE_OVERVIEW_DATA_SERVICE_CONTEXT.md#backend-split-laravel-vs-node-server). Several values still read 0/N/A because their underlying tables are empty or their config forms don't have the needed fields yet, not because the component is faking anything — see [MACHINE_OVERVIEW_COMPONENT_CONTEXT.md](MACHINE_OVERVIEW_COMPONENT_CONTEXT.md#known-gaps) and [MISSING_INPUTS.md](../../../src/app/modules/production-management/shared/components/machine-overview/MISSING_INPUTS.md) for the precise, per-field breakdown.
- `OverviewTile` interface and `MachineData`/`SubItem` types are declared but have no current consumer — confirm before removing (may be intended for near-term work) or wire them up if adding new tiles.
- `machine-status-card`'s `[durations]` input **is now bound** from `MachineBoardComponent`'s template — both the board grid and `/mco` drive live duration data end-to-end. The card itself no longer shows a Run/Idle/Inactive breakdown though; it shows a single "current status" timer plus an Availability % KPI (see [MACHINE_STATUS_CARD_COMPONENT_CONTEXT.md](MACHINE_STATUS_CARD_COMPONENT_CONTEXT.md)).
- `machine-status-card`'s OEE, Shot Count, and location (hall/group) badge template blocks are wired end-to-end but currently commented out in the card's HTML — data flows all the way from `ProductionService`'s `$expand` and the socket `P` field, but isn't rendered.
- Machine maintenance is a **standalone CRUD page** (`/production/machine-maintenance`): AG Grid table over OData `MachineMaintenanceSchedules` + a New/Edit dialog (machine, date-time, reason) + per-row Activate/End actions + delete. Laravel persists `machine_maintenance_schedules` and node-server forces the MAINTENANCE state from a Redis override set. See [machine-maintenance-implementation-plan.md](../machine-maintenance-implementation-plan.md). The board cards carry **no** maintenance UI — scheduling happens only on that page.
