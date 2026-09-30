# SharedBarChartComponent

**Selector:** `app-shared-bar-chart`
**File:** `src/app/shared/components/shared-bar-chart/shared-bar-chart.component.ts`
**Standalone:** Yes
**Chart library:** amCharts 4

## What It Does

Vertical bar chart with hover tooltips, interactive cursor, and auto-formatted number labels (K = thousands, L = lakhs, Cr = crores). Data-driven via inputs. Lifecycle: creates chart in `ngAfterViewInit`, updates on `ngOnChanges`, disposes in `ngOnDestroy`.

## Inputs

| Input | Type | Default | Purpose |
|---|---|---|---|
| `data` | `any[]` | `[]` | Chart data objects |
| `datasets` | `any[]` | `[]` | Alternative Chart.js-style data |
| `categoryField` | `string` | `'category'` | Property name for X-axis categories |
| `valueField` | `string` | `'value'` | Property name for Y-axis values |
| `chartHeight` | `string` | `'450px'` | CSS height of chart container |
| `barColor` | `string` | `'#3B82F6'` | Bar fill color |

## Outputs

None.

## Key Methods

| Method | Purpose |
|---|---|
| `createChart()` | Creates amCharts `XYChart`, `CategoryAxis`, `ValueAxis`, column series |
| `setChartData()` | Updates chart data binding |
| `resolveData()` | Resolves from `data` or `datasets` input |
| `ngOnDestroy()` | Calls `chart.dispose()` |

## Number Formatting

Values formatted automatically: `≥1Cr` → `XCr`, `≥1L` → `XL`, `≥1K` → `XK`, else raw value.

## Usage Pattern

```html
<app-shared-bar-chart
  [data]="salesData"
  [categoryField]="'month'"
  [valueField]="'revenue'"
  [barColor]="'#22C55E'"
  [chartHeight]="'300px'"
></app-shared-bar-chart>
```

Data format: `[{ month: 'Jan', revenue: 150000 }, ...]`
