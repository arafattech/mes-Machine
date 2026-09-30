# Production Management — Documentation Index

This folder contains AI context files for every component group in the `production-management` module.

## Module Root
- [module-overview/context.md](module-overview/context.md) — routing table, module wiring, data flow, tech stack
- [work-order-and-log-production.md](work-order-and-log-production.md) — work order planning (multi-machine) + manual production-count entry, full process.
- [machine-maintenance-implementation-plan.md](machine-maintenance-implementation-plan.md) — executable build plan for manual machine-maintenance scheduling (Roadmap Phase 7, item D5). Source design: `node-server/src/module/machine/docs/MAINTENANCE_SCHEDULING_PLAN.md`. Covers the original per-machine flow on `/mco`; the global, work-order-centric multi-machine flow (sidebar → **Plan & Production Log** → **Log Production**) is documented in [production-plan-log/context.md](production-plan-log/context.md)

## Feature Areas

| Folder | Description |
|--------|-------------|
| [layout/](layout/context.md) | Shell layout — sidenav (halls + all-machines + Plan & Production Log) + router-outlet |
| [machine-board/](machine-board/context.md) | Main dashboard — status summary tiles + live machine grid |
| [machine-maintenance/](machine-maintenance/MACHINE_MAINTENANCE_LIST_CONTEXT.md) | Machine-maintenance CRUD page (`/production/machine-maintenance`) — AG Grid + New/Edit dialog + per-row Activate/End/Delete |
| [production-plan-log/](production-plan-log/context.md) | Global "Log Production" page (grouped by work order/shift/day) + its multi-machine entry modal, plus "Log Wastage" (per-type, auto-distributed across machines by output share) and Work Order planning CRUD (moved here from `base-data-management`) |
| [shared/](shared/context.md) | Reusable components, services, models, utils shared across the module |

## Quick Reference

### Adding a new machine metric/card
1. Extend `Metric` / `StatusCardData` / `OverviewTile` in `shared/interface/interface.ts` if a new shape is needed.
2. Build the presentational component under `shared/components/` (standalone, `OnPush`).
3. Declare it in `production.module.ts` (unless standalone-imported directly by its parent).
4. Wire real data — `MachineOverviewComponent` (`/mco`) is a good reference for the pattern now: page component holds only route/UI state, a dedicated service (`MachineOverviewDataService`, `MachineRuntimeHistoryService`) owns the backend calls and returns typed shapes matching the presentational components' inputs 1:1. See [shared/context.md](shared/context.md#known-gaps) for what's still incomplete and why.

### Technology Stack
- Angular 17 standalone/module-declared mix (`LayoutComponent`, `BarChartComponent`, `LineChartComponent` are standalone; board + shared dashboard tiles are declared in `ProductionModule`).
- SAP UI5 Web Components (`@ui5/webcomponents-ngx`, raw `ui5-*` custom elements via `CUSTOM_ELEMENTS_SCHEMA`).
- `ng2-charts` / `chart.js` for bar/line charts.
- OData (`CommonService`) for `Halls`, `Machines`, `MachineStateEvents`.
- Socket.IO (`SocketService`, event `to_frontend`) for live telemetry — no OData polling for machine status.
- Tailwind utility classes for layout/spacing (per repo-wide frontend rule).
