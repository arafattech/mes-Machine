# Production Management Module — Overview

## Module Path
`src/app/modules/production-management/` — alias `@production-module/*`

## Module File
`production.module.ts` — declares non-standalone dashboard components; imports standalone ones directly where used.

```typescript
declarations: [
  MachineBoardComponent,
  StatusCardComponent,
  MachineStatusCardComponent,
  MachineOverviewComponent,
  MachineDetailsComponent,
  WorkOrderDetailComponent,
  LogProductionEntryComponent,
  QualityEfficiencyComponent,
  ProductionOverviewComponent,
]
imports: [CommonModule, ProductionRoutingModule, SharedModule, DurationPipe]
schemas: [CUSTOM_ELEMENTS_SCHEMA]
```

`LayoutComponent`, `BarChartComponent`, `LineChartComponent` are **standalone** — not in `declarations`, imported directly by whichever component uses them (`LayoutComponent` by the routing module's route `component:`, charts by `MachineOverviewComponent`'s own standalone imports... note: `MachineOverviewComponent` itself is non-standalone and declared in `ProductionModule`, which re-exports nothing, so the charts must be available via `SharedModule` or direct import in the component decorator — verify `imports` array in `machine-overview.component.ts` if adding new standalone deps here).

## Routing Module (`production-routing.module.ts`)

Base route: `/production` (mounted by the app shell). All routes guarded by `PermissionGuard`.

| Path | Component | Permission |
|------|-----------|------------|
| `` (index) | `LayoutComponent` → `MachineBoardComponent` (child) | `PRODUCTION_ADMIN` (layout) / `PRODUCTION_DASHBOARD` (board) |
| `production-log` | `LayoutComponent` → `ProductionLogListComponent` (child) | `PRODUCTION_ADMIN` (layout) / `PRODUCTION_LOG` (page) |
| `wastage-log` | `LayoutComponent` → `WastageLogListComponent` (child) | `PRODUCTION_ADMIN` (layout) / `WASTAGE_LOG` (page) |
| `work-orders` | `LayoutComponent` → `WorkOrderListComponent` (child) | `PRODUCTION_ADMIN` (layout) / `BASE_DATA_WORK_ORDER` (page) |
| `machine-maintenance` | `LayoutComponent` → `MachineMaintenanceListComponent` (child) | `PRODUCTION_ADMIN` (layout) / `PRODUCTION_ADMIN` (page) |
| `mco` | `MachineOverviewComponent` | `PRODUCTION_ADMIN` |

`mco` = **M**achine **C**onfig/**O**verview detail page. It is a sibling route, not nested under `LayoutComponent`, so it renders full-page without the sidenav shell — `MachineOverviewComponent.ngOnInit()` explicitly calls `commonService.sidenavHidden.emit(true)` to match, and its own charts/tiles/tabs render inline instead.

`MachineOverviewComponent`'s calculation endpoints (OEE overview, shift breakdown, current work order, work-order execution rollup) are served by **node-server** (NestJS/Prisma), not Laravel — node-server already owns the write side of `machine_state_events`/`machine_production_counts`. Work-order CRUD and manual production-count logging stay in Laravel. See [shared/MACHINE_OVERVIEW_DATA_SERVICE_CONTEXT.md](../shared/MACHINE_OVERVIEW_DATA_SERVICE_CONTEXT.md#backend-split-laravel-vs-node-server) and [work-order-and-log-production.md](../work-order-and-log-production.md).

Navigation to `mco` is **query-param driven**, not route-param driven — see [machine-board/context.md](../machine-board/context.md).

`production-log` is nested under `LayoutComponent` (unlike `mco`) — it's a plain browsable page, not a per-machine deep-dive, so the sidenav stays visible. It's the "Log Production" item under the sidebar's **Plan & Production Log** group (see `LayoutComponent.buildNavItems()`) — every work-order/shift production log across the whole plant (grouped by work order/shift/day, not one row per machine), plus the entry point into `ProductionLogFormComponent`'s multi-machine batch-entry modal. See [production-plan-log/context.md](../production-plan-log/context.md).

`wastage-log` is the same sidebar group's own page, "Wastage Log" — every logged wastage entry across the whole plant (flat, one row per real `machine_wastage_entries` row — not grouped, unlike `production-log`'s grid), plus the entry point into `LogWastageComponent`'s dialog. Its own permission (`WASTAGE_LOG`), separate from `PRODUCTION_LOG`, since logging wastage and logging production counts are distinct capabilities an admin may want to grant independently. See [production-plan-log/context.md](../production-plan-log/context.md).

`work-orders` is the same sidebar group's second item, "Work Orders" — the multi-machine work-order planning CRUD (`WorkOrderListComponent`/`WorkOrderFormComponent`), moved here from `@base-data-module` (its OData entity, model, and backend controller stayed put — only the Angular UI moved). Kept its original `Permissions.BASE_DATA_WORK_ORDER*` permission strings unchanged to avoid invalidating already-granted role permissions in a live DB, despite the naming no longer matching the module it lives in. See [production-plan-log/context.md](../production-plan-log/context.md).

## Feature Areas

| Area | Purpose |
|------|---------|
| **layout** | Persistent shell: sidenav (All Machines + per-hall groups + Plan & Production Log) + `<router-outlet>` |
| **machine-board** | Default `/production` view — status summary tiles + live grid of machine cards, compact/card/full-screen view modes |
| **machine-maintenance** | Machine-maintenance CRUD page (`/production/machine-maintenance`) — AG Grid + New/Edit dialog + per-row Activate/End/Delete — see [machine-maintenance/MACHINE_MAINTENANCE_LIST_CONTEXT.md](../machine-maintenance/MACHINE_MAINTENANCE_LIST_CONTEXT.md) |
| **production-plan-log** | Global "Log Production" page + its multi-machine entry modal, "Wastage Log" page + its entry modal, plus Work Order planning CRUD (list + form) — own feature folder, see [production-plan-log/context.md](../production-plan-log/context.md) for why it isn't under `shared/` |
| **shared** | Presentational components, services, models, utils reused by the pages above |

## Data Flow (module-wide)

1. `ProductionService` (root singleton, extends `CommonService`) loads the hall list on construction and exposes `hallList$` / `machines$` as `BehaviorSubject`s.
2. `LayoutComponent` builds the sidenav from `hallList$`; clicking a hall or "All Machines" calls `loadMachines(type)`. The **Plan & Production Log** group's "Log Production" item is a plain `routerLink` nav entry with no `type` — `toggleExpand()` only calls `loadMachines(item.type)` when `item.type` is defined, specifically so this item doesn't fire a bogus `Halls(undefined)/machines` request and clear the board's machine list.
3. `MachineBoardComponent` renders `machines$` and overlays live telemetry from `SocketService.on('to_frontend')` (status badge, temp/rpm, shot count).
4. `MachineDurationService` (separate root singleton) tracks per-machine per-state elapsed time, seeded from `MachineStateEvents` on load, then kept live from a **dedicated** `machine_status_runtime` socket event — server-computed, pushed once per persisted state transition (not every `to_frontend` telemetry tick). It does not depend on `ProductionService`'s machine list.
5. Status classification for the board's own status badge is centralized in `shared/utils/machine-status.ts: deriveActivity()` (used only by `MachineBoardComponent` now). The node-server independently derives and persists the same classification server-side for `machine_status_runtime`, for both machine acquisition modes (`ChannelMappingService`/`MachineRuntimeService` — see node-server's `docs/CONTEXT.md`).

See [shared/context.md](../shared/context.md) for full service/model/util reference.

## Common Services Injected Across Module

| Service | Purpose |
|---------|---------|
| `CommonService` | OData/HTTP base class — `ProductionService` extends it directly |
| `ProductionService` | Hall/machine list loading, exposed as observables |
| `MachineDurationService` | Live per-state duration tracking (root singleton) |
| `SocketService` | `to_frontend` event stream (status badge/temp/rpm/shot count) + `machine_status_runtime` event stream (server-computed state-transition timestamps, consumed by `MachineDurationService` only) |
| `RolePermissionService` | Sidenav item visibility (`getAllPermissionsStatus()`) |
| `CommonService.sidenavToggle` / `sidenavHidden` | `EventEmitter`s coordinating collapse/hide across layout + board (full-screen mode) |

## Key Enums & Types (module-global)

```typescript
enum ViewMode { FULL_SCREEN, DETAILED, COMPACT }
type MachineActivityType = 'ACTIVE' | 'IDLE' | 'MAINTENANCE' | 'INACTIVE' | 'FAULT'
type StatusType = 'overall' | 'active' | 'idle' | 'maintenance' | 'inactive' | 'fault'
```

`FAULT` = Active-channel HIGH **and** Idle-channel LOW — a sensor contradiction the node-server's `ChannelMappingService.deriveStatus` treats as a distinct status (see node-server's `docs/CONTEXT.md`), not folded into `INACTIVE`. Persisted to `machine_state_events.state` (DB enum, MySQL) as `fault`.

## Common Patterns Across This Module

### Live-data-over-OData
Machine status/temp/load are **not** re-fetched via OData polling. `Machines`/`Halls` OData calls only supply static metadata (name, custom_id, has_temperature, has_rpm, hall/group membership via `$expand=machinegroups,machinehalls`, `oee`). Status/temp/rpm/shot-count come from the `to_frontend` socket stream, matched to a `Machine` record by id/custom_id (see `MachineBoardComponent.getMachineData()`). Live per-state durations instead come from the separate `machine_status_runtime` event (see `MachineDurationService`).

### View-mode-driven layout, not routing
Compact/Card/Full-Screen is a component-level `viewType` field (`ViewMode` enum), not a route — switching modes never navigates, it toggles CSS grid classes and the `CommonService.sidenavHidden` emitter.

### Root-singleton services for cross-route continuity
Both `ProductionService` and `MachineDurationService` are `providedIn: 'root'` specifically so hall selection and live duration counters survive navigating to `/production/mco` and back — a route-scoped service would reset state on each visit.

### Technology Mix
Pure Angular throughout (no React/TSX, unlike `base-data-management`). Mix of standalone (`LayoutComponent`, charts) and `NgModule`-declared (dashboard tiles) components — no strict rule enforced yet on which pattern new components should follow; standalone is the repo-wide default per `.claude/rules/angular.md`.

## Known Gap: Module `CLAUDE.md`
`production-management/CLAUDE.md` is backend (Node.js/MES machine-service) engineering guidance — channel mapping, MQTT/API/MODBUS transports, polling, database batching. It does **not** describe this Angular module. Do not use it as the frontend contract for this folder; treat `.claude/rules/angular.md` and `Frontend/CLAUDE.md` as authoritative here instead.
