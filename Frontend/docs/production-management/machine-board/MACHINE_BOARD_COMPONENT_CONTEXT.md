# MACHINE_BOARD_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `src/app/modules/production-management/machine-board/machine-board.component.ts` |
| **HTML file** | `src/app/modules/production-management/machine-board/machine-board.component.html` |
| **Selector** | `app-all-machines` |
| **Component type** | Non-standalone dashboard page (declared in `ProductionModule`), `ChangeDetectionStrategy.OnPush` |
| **Purpose** | Default `/production` view. Shows one status-summary tile per active `machine_states` row (plus the fixed Overall tile) + a live grid of per-machine status cards. Supports Compact / Card / Full-Screen view modes and hall filtering (full-screen only). |

All dependencies (`ProductionService`, `CommonService`, `SocketService`, `MachineDurationService`, `MachineStatesService`, `Router`, `DestroyRef`) are wired via `inject()`, not constructor params.

---

## State — Signals

| Signal | Type | Purpose |
|---|---|---|
| `viewType` | `Signal<ViewMode>` | Current layout mode, default `ViewMode.COMPACT` |
| `machines` | `Signal<Machine[]>` | Raw list from `productionService.machines$` |
| `halls` | `Signal<Hall[]>` | From `productionService.hallList$` — populates the Full-Screen hall combobox |
| `results` | `Signal<MachineBoardResult[]>` | Derived per-render array — see [Local Types](#local-types) below. `...machine` also carries `oee`, `machinehalls[]`, `machinegroups[]` from the `$expand`-ed `ProductionService.machines$` |
| `totalMachines` | `Signal<number>` (`computed`) | `results().length` — denominator for every non-overall tile |
| `cards` | `Signal<StatusCardData[]>` (`computed`) | `buildCards(results())` — one fixed `'overall'` entry + one entry per `MachineStatesService.getAll()` row. Because this is a `computed()`, it also automatically re-derives the moment `MachineStatesService`'s internal state signals populate (e.g. `machine_states` finishing its load after `results` already arrived) — no manual "reload cards when states resolve" wiring needed |

`localization` (`typeof Localization`) and `viewModeEnum` (`typeof ViewMode`) are plain (non-signal) readonly fields — static template lookups, not reactive state.

Template bindings read every signal as a call — `cards()`, `totalMachines()`, `viewType()`, `machines()`, `halls()`, `results()`.

**Removed as dead code** (were unused/no-op): `loading` field, `@ViewChild('statusCard') statusCardRef` (no matching template ref existed), `machineData` (written once from the socket handler, never read), and unused `status`/`hours`/`temp` class fields (not to be confused with the same-named fields on each `results()` row, which are live).

---

## Local Types

```ts
type SocketMachineData = {
  MNR: string | number;
  P?: number;   // production flag (legacy) — also read as shotCount, see checkStatus()
  A?: number;   // active flag (legacy)
  T?: number;   // used for both temp and hours in this component (see Known Gaps)
  S?: number;   // used for both rpm and load
  STATUS?: string; // explicit status, channel-mapping mode only
  lastSeenAt?: number | null; // epoch ms PLC last responded — read by MachineDurationService, not this component
};

// Omit<Machine, ...> rather than `extends Machine`: rows are plain object-spread copies,
// not Machine class instances, so they never carry its deserialize()/toOdata() methods.
type MachineBoardResult = Omit<Machine, 'deserialize' | 'toOdata'> & {
  status: string;
  hours: number | null;
  temp: number | null;
  rpm: number | null;
  load: number | null;
  shotCount: number | null;
  durations: MachineDurations; // from MachineDurationService
};
```

`getMachineData()` only needs `id`/`custom_id`, so it's typed to accept `Pick<Machine, 'id' | 'custom_id'>` — lets it take both a raw `Machine` (from `checkStatus`) and a `MachineBoardResult` row (from `refreshDurations`) without a cast.

---

## Lifecycle

`ngOnInit()`:
1. Subscribe `machines$` → `this.machines.set(data)`, calls `checkStatus(data)`.
2. Subscribe `hallList$` → `this.halls.set(data)`.
3. Subscribe `SocketService.on('to_frontend')` → normalizes to array, updates `machineDataMap`, calls `checkStatus(this.machines())`.
4. `interval(1000)` → `refreshDurations()` — keeps live per-state counters ticking even with no new socket data.
5. `productionService.loadMachines('all-machines')` — re-fetches on every mount. `LayoutComponent`'s constructor only loads machines once app-wide (see [layout/context.md](../layout/context.md)), so without this call, re-entering this route after the first visit (no full browser reload) replayed the stale cached `machines$` value instead of current data.

All subscriptions piped through `takeUntilDestroyed(this.destroyRef)` — no manual `Subject`/`ngOnDestroy` teardown.

`MachineStatesService.loadAll()` is **not** called here — `ProductionModule`'s own constructor already triggers it once (`this.stateService.loadAll().subscribe()`), before any of the module's routed components (including this one) can mount. Calling it again here would just replay the same cached (`shareReplay(1)`) result.

---

## Methods

| Method | Description |
|--------|-------------|
| `detailsPage(machine)` | Navigates to `/production/mco` with query params (see [context.md](context.md#machine-key--navigation-contract)) |
| `onSegmentChange(event)` | Switches `viewType` (Card/Compact/Full-Screen); toggles `commonService.sidenavHidden` (`true` only for Full-Screen). `event: any` — UI5's `selection-change` output types as a plain `Event` in this project's Angular wrapper, not `CustomEvent`; typing it any tighter breaks strict-template AOT compilation (confirmed via `ng build`) |
| `hallChange(event)` | Full-Screen-only hall combobox handler → `productionService.loadMachines(hallId)`. Same `event: any` reasoning as `onSegmentChange` |
| `trackByMachine(index, machine)` | `custom_id ?? machine_name ?? index` |
| `checkStatus(dataArray)` | Maps each machine to a `MachineBoardResult` row: derives status via `getMachineStatus`, adds `shotCount: liveData?.P ?? null`, snapshots durations, then `this.results.set(rows)` — `cards`/`totalMachines` re-derive on their own since they're `computed()` off `results` |
| `refreshDurations()` | `this.results.update(...)` — re-snapshots `durations` on every row via a fresh `.map()` (new row objects), without recomputing status. Runs every 1s. Rows must be replaced, not mutated in place — `machine-status-card` is `OnPush` too, so its `[durations]` input only re-renders on a reference change |
| `buildCards(results)` | (was `updateCardsFromResults()`, now takes `results` as a param and returns `StatusCardData[]` instead of writing `this.cards`/`this.totalMachines` as side effects) Resolves each row's `status` string to a `machine_states` row via `MachineStatesService.getByName()`, tallies counts per `machine_state_id` into a `Map`, sums counts across every `counts_as_productive` id for the Overall tile's efficiency, then returns `[overallCard, ...one per MachineStatesService.getAll()]` — fully dynamic, no fixed active/idle/inactive/maintenance/fault filters |
| `toPercent(count, total)` | `total === 0 → 0`, else `round(count/total*100)` |
| `getMachineData(machine)` | Resolves socket telemetry for a machine via id → custom_id → digits-only custom_id fallback chain |
| `getMachineStatus(data)` | Delegates to `deriveActivity()` (`shared/utils/machine-status.ts`) — returns a plain `string` (an admin-defined state name), not a fixed union |

---

## Template Structure

```
<status-card *ngFor="cards()">          ← Overall tile + one tile per active machine_states row (dynamic count)
<ui5-bar>                              ← toolbar: title + hall combobox (full-screen only) + view-mode segmented button
<ui5-busy-indicator [active]="productionService.isMachinesLoading">
  @if(machines().length > 0) {
    <machine-status-card *ngFor="results(); trackBy: trackByMachine"
      [activity] [temp] [id] [rpm] [maxRate]="3000" [maxTemp]="50"
      [has_temperature]="machine.has_temperature ?? false" [has_rpm]="machine.has_rpm ?? false"
      [label] [viewMode]="viewType()" [runTime]="machine.hours ?? 0"
      [oee] [hallName]="machine.machinehalls?.[0]?.name" [groupName]="machine.machinegroups?.[0]?.name"
      [shotCount] [durations]="machine.durations"
      (click)="detailsPage(machine)">
  } @else {
    <ui5-illustrated-message>  ← "no data" empty state
  }
```

`has_temperature`/`has_rpm`/`runTime` fall back to `false`/`0` in the template — `Machine.has_temperature`/`has_rpm` are optional (`boolean | undefined`) and `hours` is `number | null` on `MachineBoardResult`, but `machine-status-card`'s inputs are non-optional; this is a type-safety fix only (`results` used to be typed `any[]`, silently hiding the mismatch), not a behavior change — `Machine`'s own class fields already default `has_temperature`/`has_rpm` to `false`.

`[durations]="machine.durations"` is bound — `machine-status-card`'s live current-status timer and Availability KPI work on the board grid, not just on `/mco`. `oee`/`hallName`/`groupName`/`shotCount` are also bound, though the card's OEE/Shot-Count/location-badge template blocks are currently commented out on the card side (see [MACHINE_STATUS_CARD_COMPONENT_CONTEXT.md](../shared/MACHINE_STATUS_CARD_COMPONENT_CONTEXT.md)).

---

## API / Data Sources

| Source | What |
|--------|------|
| `ProductionService.machines$` | Static machine metadata (name, ids, has_temperature/has_rpm, hall) |
| `ProductionService.hallList$` | Hall list for combobox |
| `SocketService` event `to_frontend` | Live telemetry: `MNR`, `A`/`P` (legacy) or `STATUS` (channel-mapping), `T`, `S` |
| `MachineDurationService.snapshot(key)` | Live per-state elapsed seconds |
| `MachineStatesService` | State list/lookups for `cards` — loaded by `ProductionModule`, not this component |

---

## Known Gaps

- **`temp`/`hours` both read from `T`, `rpm`/`load` both read from `S`** in `checkStatus()` — same telemetry field feeds two semantically different UI values. Confirm with backend telemetry schema before treating `T`/`S` as literally "temperature" and "speed" — they may currently be overloaded placeholders. (Left as-is by design — out of scope for the runtime-timer work; see node-server's `docs/CONTEXT.md` §13 for the authoritative field mapping.)
- `shotCount` (from socket `P`) is only ever non-null in legacy-worker mode — channel-mapping-mode machines will always show it as `null` (card hides the tile).
- `maxRate={3000}` / `maxTemp={50}` are hardcoded per-card in the template, identical for every machine regardless of `has_rpm`/`has_temperature` capability differences.
- `onSegmentChange`/`hallChange` keep `event: any` — deliberate (see [Methods](#methods)), not an oversight.
