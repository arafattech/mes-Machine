# Production Management — Layout

## Files
```
layout/
├── layout.component.ts
├── layout.component.html
└── layout.component.scss
```

## Routes
Wraps all `/production` routes as the parent shell (see [module-overview/context.md](../module-overview/context.md)). `MachineBoardComponent`, `ProductionLogListComponent` (`production-log`), `WastageLogListComponent` (`wastage-log`) and `WorkOrderListComponent` (`work-orders`) are nested under it; `mco` is a sibling route rendered full-page instead.

## Component
[LAYOUT_COMPONENT_CONTEXT.md](LAYOUT_COMPONENT_CONTEXT.md)

## Key Relationships
- Depends on `ProductionService.hallList$` to build sidebar groups — one entry per active hall plus a fixed "All Machines" entry, plus a static **Plan & Production Log** group (four items: "Log Production" → `production-log`, "Wastage Log" → `wastage-log`, "Work Orders" → `work-orders`, "Machine Maintenance" → `machine-maintenance`).
- Emits into `ProductionService.loadMachines(type)` on sidenav item click/expand — this is how `MachineBoardComponent` gets hall-filtered data (the layout owns hall *selection*, the board owns hall *rendering*). `toggleExpand()` skips this call when the clicked item has no `type` (all four Plan & Production Log items), since they're plain nav links, not hall filters.
- Listens to `CommonService.sidenavToggle` / `sidenavHidden` — the latter is driven by `MachineBoardComponent`'s Full-Screen view mode, letting a child route hide the parent's sidenav.

## Notes
- `onLoad()` (Dashboard sidenav item click) does a hard `window.location.href` redirect using `localStorage.getItem('preferred_language')` — not an Angular route navigation. Intentional: leaves the SPA entirely.
- Responsive collapse threshold is a hardcoded `1020px` (`checkScreenWidth`), duplicated logic pattern also seen in `MachineStatusCardComponent` at a different threshold (`1420px`) — not shared/configurable.
