# PURCHASE_HOME_DASHBOARD_COMPONENT — Component Context

## Component Identity

| Field | Value |
|---|---|
| Component name | `PurcheseHomeComponent` |
| Selector | `app-purchese-home` |
| TypeScript | `src/app/modules/purchese-management/purchese-home/purchese-home.component.ts` |
| HTML | `src/app/modules/purchese-management/purchese-home/purchese-home.component.html` |
| SCSS | `src/app/modules/purchese-management/purchese-home/purchese-home.component.scss` |
| Component type | Dashboard / analytics component |
| Route | `purchase-analytics` |
| Permission | `PURCHESE_ANALYTICS` |

## Purpose
Displays purchase analytics for a selected date range, department, and supplier. Loads summary data from the purchase analysis API and feeds shared chart/table data.

## Key Data

| Property | Purpose |
|---|---|
| `purchaseInfo` | Main analytics response |
| `departmentDistribution` | `{department_name, percentage}[]`, zero-value rows filtered — donut chart source, passed straight to `app-shared-donut-chart` |
| `barChartInfo` | Monthly purchase bar chart source |
| `SuppliersList` | Supplier filter options |
| `DepartmentList` | Department filter options |
| `start` / `end` | Current date range in `YYYY-MM-DD` |
| `latestPOColumns` | AG Grid column definitions for Latest PO grid |
| `latestPODataSource` | AG Grid static data source — updated via `syncLatestPOGrid()` after API load |
| `latestPOToolbarConfig` | AG Grid toolbar config for Latest PO grid |
| `latestPODisplayConfig` | AG Grid display config for Latest PO grid |

## API Calls

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `purchase/analysis-data?startDate=<start>&endDate=<end>` | Purchase analytics |
| GET | `Suppliers` | Supplier filter options |
| GET | `Departments` | Department filter options |

## Latest PO Grid

Uses `app-ag-grid-table` with `staticData: true`. Data flows:
1. `initPurchaseInfo()` fetches API → sets `purchaseInfo`
2. `intPieChartInfo()` processes department data → calls `syncLatestPOGrid()`
3. `syncLatestPOGrid()` spreads `purchaseInfo.latest_pos` into `latestPODataSource.data`

Columns: `custom_id` (Item Code), `department_name`, `supplier_name`, `amount` (Number).

## Dashboard Widgets

| Widget | Source |
|---|---|
| Total P/O card | `purchaseInfo.total_purchases` |
| Stock Value card | `purchaseInfo.total_amount` |
| Bar chart (Monthly Purchases) | `barChartInfo` — currently static mock data; replace with real API data when available |
| Department Distribution donut | `departmentDistribution` from `intPieChartInfo()` — rendered via `app-shared-donut-chart`'s built-in `showCenterOverlay`/`showSideList` (ring + center %  + scrollable colored legend list), no per-component color array or list markup needed |
| Latest PO grid | `purchaseInfo.latest_pos` via AG Grid static data |
| Top Suppliers list | `purchaseInfo.top_suppliers` |

## Filter Dialog
Filters: date range, department (combobox), supplier (combobox). Apply triggers `initPurchaseInfo()` with updated `start`/`end`. Filters `selectedDeptId` / `selectedSupplierId` are stored but not yet wired to the API call — future work.

## Future Add Notes
- Wire `selectedDeptId` / `selectedSupplierId` to the `purchase/analysis-data` API call.
- Replace `loadStaticBarData()` mock with real monthly purchase data from API.
- Total SPR and Orders stat cards are currently hardcoded (560, 1120) — connect to API.
- If dashboard widgets are split into child components, add separate component context files.
