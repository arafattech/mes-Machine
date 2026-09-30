# Production Management Module — Overview

Angular 17 feature module for real-time machine monitoring dashboards. Path alias `@production-module/*` → `src/app/modules/production-management/*`.

## Purpose

Shows live status of factory machines (Active / Idle / Inactive / Maintenance), grouped by hall, with per-machine detail drilldown (runtime, temperature, load, quality/efficiency metrics). Data comes from OData REST (`Halls`, `Machines`, `MachineStateEvents`) plus a live Socket.IO stream (`to_frontend`) for telemetry.

## Routing (`production-routing.module.ts`)

Registered under `LayoutComponent` (guarded by `Permissions.PRODUCTION_ADMIN`):

| Path | Component | Permission |
|---|---|---|
| `` (index) | `MachineBoardComponent` | `PRODUCTION_DASHBOARD` |
| `mco` | `MachineOverviewComponent` | `PRODUCTION_ADMIN` |

`mco` (Machine Config/Overview detail page) is fed via query params (`id`, `machineId`, `name`, `status`) set by `MachineBoardComponent.detailsPage()` — no route param, no resolver.

## Module wiring (`production.module.ts`)

Declares non-standalone components (`MachineBoardComponent`, `StatusCardComponent`, `MachineStatusCardComponent`, `MachineOverviewComponent`, `MachineDetailsComponent`, `QualityEfficiencyComponent`, `ProductionOverviewComponent`) and imports `DurationPipe` (standalone). `LayoutComponent`, `BarChartComponent`, `LineChartComponent` are standalone, imported directly where used. `CUSTOM_ELEMENTS_SCHEMA` set (UI5 web components).

## Structure

```
layout/                         Sidenav shell + router-outlet
machine-board/                  Main dashboard (grid of machine cards + status summary)
shared/
  components/
    status-card/                Top summary tiles (overall/active/idle/inactive/maintenance %)
    machine-status-card/        Per-machine tile (compact + detailed view modes)
    machine-overview/           /mco detail page (charts + metrics + machine info)
    machine-details/            Machine info card (id, name, min/max RPM & temp) — dumb, presentational
    quality-efficiency/         Single metric tile (OEE-style: value + delta)
    production-overview/        Target vs achieved production tile
    bar-chart/, line-chart/     Generic Chart.js (ng2-charts) wrappers
  services/
    production.service.ts       Hall/machine list loading (OData)
    machine-duration.service.ts Live per-state duration tracker (root singleton)
  interface/interface.ts        Shared interfaces (menu, cards, metrics, tiles)
  utils/types.ts                Shared type unions (MachineActivityType, StatusType, etc.)
  utils/machine-status.ts       deriveActivity() — telemetry → status
  enums/viewMode.ts             COMPACT / DETAILED / FULL_SCREEN
  pipes/duration.pipe.ts        seconds → HH:mm:ss
```

## Core data flow

1. **`LayoutComponent`** builds sidenav from `ProductionService.hallList$` (all-machines + one entry per hall). On item click → `productionService.loadMachines(type)`.
2. **`ProductionService`** (extends `CommonService`, `providedIn: 'root'`):
   - `loadHallList()` → `GET Halls?$expand=machines&$filter=is_active eq true or is_active eq 1`, pushes to `hallList$`.
   - `loadMachines(type)` → `all-machines` → `GET Machines?$filter=...`; else `GET Halls(id)/machines?$filter=...`, pushes to `machines$`.
3. **`MachineBoardComponent`**: subscribes to `machines$` + `hallList$`, and to `SocketService.on('to_frontend')` for live telemetry (`{MNR, P, A, T, S, STATUS}`). Telemetry indexed into `machineDataMap` by `MNR` (string). `checkStatus()` recomputes `results` (machines + live status/temp/rpm/durations) on every machine list update or socket tick. A 1s `interval` refreshes durations independently (`refreshDurations()`) so elapsed-time counters tick without waiting on socket data.
4. **Status derivation** (`utils/machine-status.ts: deriveActivity`): if payload has explicit `STATUS` (new channel-mapping mode) use it directly; else legacy fallback from flags — `A===1` → ACTIVE, `P===1` → IDLE, else INACTIVE. Comment in code notes MAINTENANCE is a supported status but has no legacy-flag derivation path (must come via explicit `STATUS`).
5. **`MachineDurationService`** (root singleton, independent of route lifecycle so totals persist across navigation):
   - Seeds today's accumulated per-state totals from `MachineStateEvents` (two parallel queries: open row `ended_at eq null` for current-state anchor timestamp, closed rows since midnight for accumulated totals).
   - Subscribes to the same `to_frontend` socket stream, tracks state transitions per machine key (`String(MNR)`), accumulates closed-interval durations into `base`, keeps `since` for the currently active state.
   - `snapshot(key)` computes live seconds for active/idle/inactive/maintenance + `current` + `total`; current state = `now - since`, others = accumulated `base`.
   - Midnight rollover (`rolloverIfNewDay`) resets `base` but keeps `since` continuous.
   - Ticks a `signal(0)` every second via `takeUntilDestroyed()` for reactive consumers.

## Machine key matching quirk

`MachineBoardComponent.getMachineData()` matches socket telemetry to a `Machine` by trying, in order: `machine.id`, `machine.custom_id`, then `custom_id` with non-digits stripped. Needed because socket `MNR` may be a bare numeric id while `custom_id` can carry a prefix (e.g. `"M-12"` → `"12"`).

## View modes (`ViewMode` enum)

`MachineBoardComponent.viewType` drives layout + sidenav visibility (`CommonService.sidenavHidden` emitter):
- `COMPACT` — default grid, sidenav visible.
- `DETAILED` ("card") — larger cards, sidenav visible.
- `FULL_SCREEN` — sidenav hidden, hall combobox appears in toolbar for switching context without leaving the page.

`MachineStatusCardComponent` template branches entirely on `viewMode` (COMPACT vs everything else) — two independent markup blocks, not shared partials.

## Status/threshold logic (`MachineStatusCardComponent`)

- `has_temperature` / `has_rpm` flags (from `Machine` model) gate whether those metrics render at all — some machines don't report them.
- `isOverTemp` / `isOverLoad` computed against `maxTemp`/`maxRate` inputs (currently hardcoded in `machine-board.component.html`: `maxRate=3000`, `maxTemp=50`) → drives alert icon + popover + red styling.
- Label truncation logic duplicated: `ngOnInit` truncates to 10 chars if temp/rpm present, `checkScreenWidth` (on resize, threshold 1420px) truncates to 5 chars — two different truncation rules coexist.
- `MAINTENANCE`/`IDLE` states force metric display to `"--"` regardless of underlying value (temp still shows for MAINTENANCE only in some branches — check template before assuming symmetry).

## `/mco` detail page (`MachineOverviewComponent`)

Reads `id`/`name`/`status`/`machineId` from query params. Live durations wired to `MachineDurationService` via `machineKey = machineId`. **Everything else on this page is mock/placeholder data** — `target`, `achieved`, `ok`, `total`, `waste`, `runtime` (30 fake days), `datasets` (fake weekly active/idle/inactive), `metrics` (fake OEE numbers), `menuItems`. `MachineDetailsComponent` gets a `machineData` object with `id`/`name`/`status` real but `maxRpm`/`minRpm`/`maxTemp`/`minTemp` hardcoded (3000/2500/100/20) — not sourced from actual machine config. This page is a UI shell awaiting real backend wiring for production KPIs.

## Shared chart components

`BarChartComponent` / `LineChartComponent` wrap `ng2-charts` (`NgChartsModule`), standalone, reusable outside this module. Both use Angular `signal`/`computed` for reactive chart data/options, normalize/clamp incoming data (`Math.max(0, ...)`, sort by x), and emit typed click/hover events. `LineChartComponent` supports an optional dashed target-line dataset.

## Known gaps / risks for future work

- **`node-server/src/module/machine/CONTEXT.md`** (deleted per git status) held backend architecture rules (channel mapping, MQTT/API/MODBUS transports, polling) — this frontend module's `CLAUDE.md` is actually a copy of that backend guidance and doesn't describe the Angular code itself; treat it as stale/misplaced context, not frontend-specific rules.
- `/mco` page ships fake data for target/achieved/quality/efficiency/runtime history — do not assume these reflect real machine state.
- Two independent label-truncation rules in `MachineStatusCardComponent` (content-based vs viewport-based) — consolidate if touching that logic.
- `maxRate`/`maxTemp` thresholds hardcoded in `machine-board.component.html` template bindings rather than sourced per-machine from config — every machine currently shares the same alert thresholds regardless of `has_temperature`/`has_rpm` capability differences.
- `ProductionService` and `MachineDurationService` both listen to the same `to_frontend` socket independently (no shared telemetry store) — duplicate parsing/subscription per consumer.
- Types use `any` in several places (`SidebarGroup` building, `onSegmentChange`, `hallChange`, `checkStatus` inputs) despite repo-wide strict-typing rule.
