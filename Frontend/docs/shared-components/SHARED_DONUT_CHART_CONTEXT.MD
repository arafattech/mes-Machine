# SharedDonutChartComponent

**Selector:** `app-shared-donut-chart`
**File:** `src/app/shared/components/shared-donut-chart/shared-donut-chart.component.ts`
**Standalone:** Yes
**Chart library:** amCharts 4

## What It Does

Configurable donut/pie chart with customizable colors, legend positioning, label/tick visibility, and tooltip modes. Handles both flat array and object data formats. Slices scale on hover. Lifecycle: creates in `ngAfterViewInit`, updates on `ngOnChanges`, disposes in `ngOnDestroy`.

## Inputs

| Input | Type | Default | Purpose |
|---|---|---|---|
| `data` | `any[]` | `[]` | Chart data objects |
| `labels` | `string[]` | `[]` | Labels for flat array data |
| `valueField` | `string` | `'amount'` | Property name for slice values |
| `labelField` | `string` | `'category'` | Property name for labels |
| `chartHeight` | `string` | `'300px'` | CSS height |
| `colors` | `string[]` | `[]` | Hex color per slice |
| `innerRadius` | `number\|string` | `60` | Donut hole size (% or number) |
| `showLegend` | `boolean` | `true` | Show/hide legend |
| `legendPosition` | `'right'\|'bottom'` | `'bottom'` | Legend placement |
| `tooltipMode` | `'percent'\|'label'` | `'percent'` | Tooltip content |
| `legendFontSize` | `number` | `12` | Legend text size |
| `legendItemPaddingTop` | `number` | `10` | Legend item spacing |
| `legendMarkerCornerRadius` | `number` | `2` | Legend marker corner radius |
| `showSliceLabels` | `boolean` | `true` | Labels on slices |
| `showSliceTicks` | `boolean` | `true` | Tick lines on slices |
| `showCenterOverlay` | `boolean` | `false` | Overlay a centered TOTAL/value label inside the ring (sums `valueField` across `data`) |
| `centerOverlayLabel` | `string` | `'TOTAL'` | Small label above the center value |
| `centerOverlayValueSuffix` | `string` | `'%'` | Suffix appended to the center total (e.g. `%`) |
| `showSideList` | `boolean` | `false` | Render a built-in scrollable colored legend list beside the ring instead of using amCharts' native legend (pair with `[showLegend]="false"`) |
| `sideListValueSuffix` | `string` | `'%'` | Suffix appended to each side-list row's value |
| `noDataMessage` | `string` | `'No data available'` | Shown in place of the side list when `data` is empty |

If `colors` is omitted, an internal 8-color default palette is used (cycled by index) for both the chart slices and the side-list markers — consumers no longer need to define their own color array for standard usage.

## Outputs

None.

## Key Methods

| Method | Purpose |
|---|---|
| `createChart()` | Creates amCharts `PieChart` with slice series, legend, colors |
| `resolveData()` | Converts flat array or object array → chart data format |
| `parseRadius()` | Converts `innerRadius` string/number → percentage string |
| `ngOnDestroy()` | Calls `chart.dispose()` |

## Usage Pattern

```html
<!-- Object data -->
<app-shared-donut-chart
  [data]="departmentData"
  [valueField]="'headcount'"
  [labelField]="'dept'"
  [colors]="['#3B82F6','#22C55E','#F59E0B']"
  [legendPosition]="'right'"
></app-shared-donut-chart>

<!-- Flat array data -->
<app-shared-donut-chart
  [data]="[40, 35, 25]"
  [labels]="['HR', 'Finance', 'IT']"
  [tooltipMode]="'label'"
></app-shared-donut-chart>

<!-- "Distribution" style — ring + center total% + scrollable colored legend list -->
<!-- (used by purchese-home "Department Distribution" and store-home "Department-wise SR Ratio") -->
<app-shared-donut-chart
  [data]="departmentDistribution"
  [labelField]="'department_name'"
  [valueField]="'percentage'"
  [innerRadius]="'50%'"
  [showSliceLabels]="false"
  [showSliceTicks]="false"
  [showLegend]="false"
  [showCenterOverlay]="true"
  [showSideList]="true"
></app-shared-donut-chart>
```

The distribution-mode inputs exist because amCharts' native outer slice labels have no overlap/collision threshold — with several small-percentage categories they visually collide. Turning them off and using the built-in side list (driven by the same resolved `data`) avoids that entirely, and centralizes the ring+list markup/color-cycling that was previously duplicated per consuming component.
