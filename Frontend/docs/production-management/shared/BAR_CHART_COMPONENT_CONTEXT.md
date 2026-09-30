# BAR_CHART_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `shared/components/bar-chart/bar-chart.component.ts` |
| **HTML file** | `shared/components/bar-chart/bar-chart.component.html` |
| **Selector** | `app-bar-chart` |
| **Component type** | **Standalone**, imports `NgChartsModule` |
| **Purpose** | Generic reusable Chart.js wrapper for bar/line-style multi-series `{x,y}` data. Despite the name, `chartType` is configurable (default `'line'`) — genuinely generic, not bar-only |
| **Used by** | `MachineOverviewComponent` ("Recent – Activity" chart, real daily Active/Idle/Inactive hours over the page's date-range filter, from `MachineRuntimeHistoryService.toStateDatasets()`) |

---

## Exported Types

```ts
interface ChartDataPoint { x: string | number; y: number; }
interface ChartDataset {
  label: string; data: ChartDataPoint[];
  borderColor?: string; backgroundColor?: string; pointBackgroundColor?: string;
  fill?: boolean; borderDash?: number[]; pointRadius?: number; pointHoverRadius?: number;
}
```

---

## Inputs (@Input)

| Input | Type | Default | Purpose |
|---|---|---|---|
| `title` | `string` | `'Chart Title'` | **Is** rendered inside this component's own template (`<div class="chart-title...">{{ title }}</div>`, above the canvas) — always pass a real value; the literal default `'Chart Title'` visibly renders otherwise (confirmed live — a caller that forgets this input gets a placeholder-looking heading on screen) |
| `chartType` | `ChartType` (chart.js) | `'line'` | Passed to `ng2-charts` canvas |
| `xAxisLabel` / `yAxisLabel` | `string` | `'X Axis'` / `'Y Axis'` | Axis titles + tooltip label prefixes |
| `yMin` / `yMax` / `yStepSize` | `number \| undefined` | `undefined` | Y-scale bounds |
| `datasets` | `ChartDataset[]` (via setter) | `[]` | Normalized on set (see below) |
| `showPoints` | `boolean` | `true` | Point radius 3 vs 0 |
| `showLegend` | `boolean` | `true` | Chart.js legend plugin toggle |
| `responsive` | `boolean` | `true` | Chart.js `responsive` |
| `maintainAspectRatio` | `boolean` | `false` | Chart.js option |
| `customChartOptions` | `ChartOptions` | `{}` | Spread last into computed `chartOptions` — caller can override any default |

## Outputs (@Output)

| Output | Type | Fired when |
|---|---|---|
| `dataPointClicked` | `EventEmitter<{datasetIndex, dataIndex, value: ChartDataPoint}>` | Chart.js click event resolves to a point |
| `dataPointHovered` | `EventEmitter<{datasetIndex, dataIndex, value: ChartDataPoint}>` | Chart.js hover event resolves to a point |

---

## Reactive Internals (signals)

| Signal | Purpose |
|---|---|
| `_datasets` (private, `signal<ChartDataset[]>`) | Backing store for the `datasets` input setter — normalized via `normalize()` on every set |
| `chartOptions` (`computed<ChartOptions>`) | Rebuilds Chart.js options object from current inputs + `customChartOptions` spread last (caller wins conflicts) |
| `chartData` (`computed<ChartConfiguration['data']>`) | Rebuilds `{ labels, datasets }` for `ng2-charts` from `_datasets()` + `generateLabels()` |

---

## Methods

| Method | Description |
|--------|-------------|
| `onChartClick(evt)` | Reads `evt.active[0]`, resolves the underlying `ChartDataPoint`, emits `dataPointClicked` |
| `onChartHover(evt)` | Same, emits `dataPointHovered` |
| `normalize(datasets)` (private) | Per dataset: clamps `y` to `≥0` and rounds it. **Does not re-sort** (see Notes — sorting was removed) |
| `generateLabels()` (private) | Union of all datasets' `x` values, deduped by first occurrence, stringified — used as the shared category axis labels across all series. **Does not re-sort** |

---

## Notes
- **Fixed 2026-07-07**: both `normalize()` and `generateLabels()` used to `.sort((a,b) => a.x < b.x ? -1 : 1)` — a lexicographic **string** sort. This silently corrupted chronological order for any real-world x-axis spanning more than 9 same-prefix labels: `"Jun 10"` sorts before `"Jun 2"` as strings. Confirmed live with the production-management page's date-range filter (`Jun 1, Jun 10, Jun 11, ..., Jun 2, Jun 3, ...`). Removed both sorts entirely — the component now preserves whatever order the caller supplies. This is safe because the only real consumer (`MachineRuntimeHistoryService.toStateDatasets()`) already builds its arrays in correct chronological order; if a future caller needs the component to do the ordering itself, that caller must supply real orderable values (e.g. timestamps) and the sort would need to be reintroduced comparing those, not the display strings.
- `y` values are **destructively rounded and floored at 0** by `normalize()` — do not feed this component negative or fractional values expecting them to render as-is.
- Because sorting was removed, **order is now entirely the caller's responsibility** — mixing datasets with different x-orderings, or relying on this component to sort a differently-ordered input, will render in insertion order, not corrected order.
- Y-axis `ticks.autoSkip` is now `true` (was `false`) — needed once a chart can have many more categories than a fixed 7-weekday set.
- Fully decoupled from the production-management domain — safe to reuse in other modules if a generic Chart.js bar/line wrapper is needed elsewhere (check `@shared/components` first in case an equivalent already exists there before duplicating). Note: `app-bar-chart` is currently only actually rendered in `machine-overview.component.html` despite `BarChartComponent` being imported into `store-management`/`purchese-management`/`sales-management` modules — those are unused/dead imports as of this writing, confirmed via `grep -rl "<app-bar-chart"`.
