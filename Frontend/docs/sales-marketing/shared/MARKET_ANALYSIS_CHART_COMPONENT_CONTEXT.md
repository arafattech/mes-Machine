# MARKET_ANALYSIS_CHART_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| TS file | `src/app/modules/sales-management/shared/components/market-analysis-chart/market-analysis-chart.component.ts` |
| HTML file | `src/app/modules/sales-management/shared/components/market-analysis-chart/market-analysis-chart.component.html` |
| SCSS file | `src/app/modules/sales-management/shared/components/market-analysis-chart/market-analysis-chart.component.scss` |
| Selector | `app-market-analysis-chart` |
| Component type | Reusable chart |

## Purpose
Renders an amCharts 4 line chart for market analysis data. The parent controls input data, chart height, category field, and value field.

## Inputs

| Input | Type | Default | Purpose |
|---|---|---|---|
| `data` | `any[]` | `[]` | Chart data rows |
| `chartHeight` | `string` | `320px` | Template-controlled chart height |
| `categoryField` | `string` | `date` | Date/category field used on X axis |
| `valueField` | `string` | `averagePrice` | Numeric field used on Y axis |

## Lifecycle
- `ngAfterViewInit()` creates the chart after the DOM element is available.
- `ngOnChanges()` updates `chart.data` when `data` changes after chart creation.
- `ngOnDestroy()` disposes the amCharts instance.

## Chart Behavior
- Uses `am4charts.XYChart` with `DateAxis` and `ValueAxis`.
- Uses a smoothed `LineSeries`.
- Formats large numbers with `K`, `L`, and `Cr` suffixes.
- Disables the amCharts logo when present.
- Keeps a cursor enabled and hides the Y cursor line.

## Future Add Notes
- Source has a commented scrollbar block marked for future use. Re-enable only after checking layout and touch behavior.
- If more series are added, document each series input contract here.
