# SharedLineChartComponent

**Selector:** `app-shared-line-chart`
**File:** `src/app/shared/components/shared-line-chart/shared-line-chart.component.ts`
**Standalone:** Yes
**Chart library:** amCharts 4

## What It Does

Line chart with hover tooltips, interactive cursor, filled area under the primary line, and auto-formatted number labels (K = thousands, L = lakhs, Cr = crores). Data-driven via inputs. Lifecycle: creates chart in `ngAfterViewInit`, updates on `ngOnChanges`, disposes in `ngOnDestroy`.

Supports an optional set of extra named series (e.g. inbound/outbound) plotted alongside the primary `valueField`/`lineColor` line, all reading from the same `data` array by different value fields on each data point.

## Inputs

| Input | Type | Default | Purpose |
|---|---|---|---|
| `data` | `any[]` | `[]` | Chart data objects — one object per category, with a field per series |
| `categoryField` | `string` | `'category'` | Property name for X-axis categories |
| `valueField` | `string` | `'value'` | Property name for the primary line's Y-axis values |
| `chartHeight` | `string` | `'450px'` | CSS height of chart container |
| `lineColor` | `string` | `'#3B82F6'` | Primary line stroke/fill color |
| `valueName` | `string` | `undefined` (falls back to `valueField`) | Legend label for the primary line — only visible once `series` makes the legend appear |
| `series` | `LineChartSeriesConfig[]` | `[]` | Extra series: `{valueField, color, name}[]`. Leave empty for the original single-line look (no legend, filled area under the line). Non-empty adds a bottom legend and renders every extra series as an unfilled colored line (primary line keeps its area fill) |

`LineChartSeriesConfig` is exported from this file: `{ valueField: string; color: string; name: string }`.

## Outputs

None.

## Key Methods

| Method | Purpose |
|---|---|
| `createChart()` | Creates amCharts `XYChart`, `CategoryAxis`, `ValueAxis`; one primary series plus one per `series` entry; adds a legend only when `series` is non-empty |
| `createSeries()` | Builds one `LineSeries` (stroke, tooltip, circle bullet, optional area fill) |
| `setChartData()` | Updates chart data binding |
| `ngOnDestroy()` | Calls `chart.dispose()` |

Changing `categoryField`, `valueField`, or `series` disposes and recreates the whole chart (these reshape the series list); changing `data` just calls `setChartData()`; changing `lineColor` alone re-colors the primary series in place.

## Number Formatting

Values formatted automatically: `≥1Cr` → `XCr`, `≥1L` → `XL`, `≥1K` → `XK`, else raw value.

## Usage Pattern

Single line (original behavior, e.g. `purchese-home`):

```html
<app-shared-line-chart
  [data]="monthlySales"
  [categoryField]="'month'"
  [valueField]="'count'"
  [lineColor]="'#3B82F6'"
  [chartHeight]="'240px'"
></app-shared-line-chart>
```

Multi-series (e.g. `store-home`'s Purchase Trend card — PO count plus inbound/outbound):

```ts
readonly purchaseTrendSeries: LineChartSeriesConfig[] = [
  { valueField: 'inbound_count', color: '#22c55e', name: $localize`Inbound` },
  { valueField: 'outbound_count', color: '#ef4444', name: $localize`Outbound` },
];
```

```html
<app-shared-line-chart
  [data]="monthlySales"
  [categoryField]="'month'"
  [valueField]="'count'"
  [valueName]="'Total P/O'"
  [series]="purchaseTrendSeries"
  [lineColor]="sapChartColors[0]"
></app-shared-line-chart>
```

Data format: `[{ month: 'Jan', count: 12, inbound_count: 8, outbound_count: 5 }, ...]`
