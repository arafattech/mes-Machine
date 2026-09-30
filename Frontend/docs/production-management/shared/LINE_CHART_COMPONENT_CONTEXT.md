# LINE_CHART_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `shared/components/line-chart/line-chart.component.ts` |
| **HTML file** | `shared/components/line-chart/line-chart.component.html` |
| **Selector** | `app-line-chart` |
| **Component type** | **Standalone**, imports `NgChartsModule` |
| **Purpose** | Single-series runtime chart (hours run per day, 0–24) over an arbitrary caller-supplied set of dates, with an optional dashed target-hours reference line |
| **Used by** | `MachineOverviewComponent` ("Runtime – {periodLabel}" chart, real daily Active hours from `MachineRuntimeHistoryService`) |

**Rewritten 2026-07-07** to drop its original day-of-month (1–31, single calendar month) assumption in favor of plotting whatever dated points the caller passes — needed once the page gained an arbitrary date-range filter that can span multiple months. `daysInMonth` input and the old `DayHours{day:number}` shape are gone.

---

## Inputs (@Input)

| Input | Type | Default | Purpose |
|---|---|---|---|
| `title` | `string` | `'Machine Runtime (Hours per Day)'` | Not rendered inside this component's own template — parent wraps it in a header |
| `data` | `DateHours[]` (via setter) | `[]` | Normalized on set: clamps `hoursRun` to `[0,24]` and rounds, sorts by actual `date` ascending. **No padding/gap-filling** — the component plots exactly the points it's given, in date order; the caller is responsible for supplying one point per day if a continuous line is wanted (`MachineRuntimeHistoryService.getDailyBreakdown` already does this) |
| `targetHoursPerDay` | `number \| undefined` (via setter) | `undefined` | Clamped `[0, 24]`; adds a second dashed dataset spanning the same number of points as `data` |
| `lineLabel` | `string` | `'Hours Run'` | Primary series legend label |
| `lineColor` / `fillColor` / `targetColor` | `string` (rgba) | blue / translucent blue / red | Series colors |
| `showPoints` | `boolean` | `true` | Point radius 3 vs 0 |

## Outputs (@Output)

| Output | Type | Fired when |
|---|---|---|
| `dayClicked` | `EventEmitter<DateHours>` (`{date: Date; hoursRun: number}`) | Chart.js click resolves to a point — emits the real `Date`, not a day-of-month number |

---

## Fixed Chart Options (`chartOptions`, not computed/reactive)
- X: "Date" (was "Day of Month"), no grid, `autoSkip: true` (was `false` — needed once a range can have many more than ~31 points, otherwise labels overlap illegibly).
- Y: "Hours (0–24)", `min: 0, max: 24, stepSize: 4` — hardcoded, unlike `BarChartComponent` where Y-bounds are inputs.
- Tooltip title: the point's formatted date label directly (was `Day {label}`); value: `{y}h`.

Unlike `BarChartComponent`, this component has no `customChartOptions` escape hatch — options are a static object, not `computed()`.

---

## Reactive Internals (signals)

| Signal | Purpose |
|---|---|
| `_data` (private) | Backing store for `data` setter, normalized (clamp + sort by date) |
| `_target` (private) | Backing store for `targetHoursPerDay` setter, clamped |
| `chartData` (`computed<ChartConfiguration<'line'>['data']>`) | Labels = `_data().map(formatDate)` (`"Jul 5"` style, `toLocaleDateString('en-US',{month:'short',day:'numeric'})`); series = `_data().map(hoursRun)`; appends target dataset (length-matched) if set |

---

## Methods

| Method | Description |
|--------|-------------|
| `onChartClick(evt)` | Resolves clicked index directly against `_data()[idx]` → emits `dayClicked` with the real `DateHours` row |
| `formatDate(date)` (private) | `date.toLocaleDateString('en-US', {month:'short', day:'numeric'})` — used for both axis labels and tooltip title |
| `normalize(rows)` (private) | Clamps `hoursRun` to `[0,24]` and rounds, sorts by `date.getTime()` ascending. No longer dedupes/pads/clamps a day-of-month range (`pad()`/`resolveDays()` removed entirely) |

---

## Notes
- The target-line dataset's legend previously rendered a visibly corrupted icon (missing `fill`/`pointStyle`, so Chart.js fell back to an undefined-fill checkered swatch). Fixed by adding `backgroundColor: 'transparent'`, `fill: false`, `pointStyle: 'line'` — confirmed clean dashed-line swatch in the legend now. Still typed via a cast (`as ChartConfiguration<'line'>['data']['datasets'][number]`) since Chart.js's line dataset typing doesn't cleanly accept this shape inline.
- Only one real consumer (`MachineOverviewComponent`) — free to keep evolving this component's contract without a cross-module compatibility check, but confirm via `grep -rl "<app-line-chart"` before assuming that stays true.
- Fully decoupled from the production-management domain otherwise — same reuse caveat as `BarChartComponent`: check `@shared/components` before duplicating this pattern elsewhere.
