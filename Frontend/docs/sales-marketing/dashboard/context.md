# Sales Management — Sales Analytics Dashboard

## Files
- `dashboard/sales-analytics.component.ts` — main dashboard component
- `dashboard/sales-analytics.component.html` — template
- `dashboard/sales-analytics.component.scss` — styles

## Selector
- `app-hrm-dashboard`

## Route
`sales-analytics` — guarded by `SALES_ANALYTICS` permission

## Purpose
Analytics overview for the Sales Management module. Displays 6 KPI tiles, 3 charts (Monthly Sales bar, Order Status donut, Market Analysis line), and a bottom tab section with Latest Orders, Overdue Orders, Top Clients list, and Recent Audit Trail. A filter dialog lets users narrow results by date range, client, status, and product.

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `kpiData` | `{ totalOrders, totalSales, totalRejection, totalOrderAmount, totalApprovedAmount, totalDraftAmount }` | all `0` | KPI tile values from API |
| `monthlySales` | `any[]` | `[]` | Bar chart data — `{ month, amount }` |
| `expenseBreakdown` | `any[]` | `[]` | Donut chart data — `{ category, amount, color }` mapped with `statusColors` |
| `donutColors` | `string[]` | `[]` | Hex color array for donut segments, same order as `expenseBreakdown` |
| `topClients` | `any[]` | `[]` | Top clients with `name`, `custom_id`, `total_amount`, `initials` |
| `filteredTopClients` | `any[]` | `[]` | Search-filtered copy of `topClients` |
| `overdueOrders` | `any[]` | `[]` | Overdue orders for grid — `{ custom_id, client, expected_delivery_date, status, subtotal }` |
| `activityLogs` | `ActivityLog[]` | `[]` | Recent 7 sales order audit entries |
| `marketAnalysisData` | `any[]` | `[]` | Market price chart data — `{ date, averagePrice }` |
| `itemList` | `any[]` | `[]` | Sellable products for market analysis item filter |
| `clientList` | `any[]` | `[]` | Clients for filter dialog |
| `showFilter` | `boolean` | `false` | Filter dialog open/close |
| `loading` | `boolean` | `false` | Global busy indicator (covers dashboard + filter dialog) |
| `auditLoading` | `boolean` | `false` | Audit trail loading state |
| `start` | `string` | 6 months ago | Date range start in `YYYY-MM-DD` format |
| `end` | `string` | today | Date range end in `YYYY-MM-DD` format |
| `dateRangeValue` | `string` | `''` | Display value for `ui5-daterange-picker` in `DD/MM/YYYY - DD/MM/YYYY` format |
| `currentDate` | `string` | today `DD-MM-YYYY` | Max-date bound for date picker |
| `selectedClientId` | `number \| null` | `null` | Selected client ID for filter |
| `statusTitle` | `string` | `''` | Selected status display value for filter |
| `selectedMarketItemId` | `string \| null` | `null` | Selected product ID for Market Analysis chart |
| `clientSearchText` | `string` | `''` | Top Client search input value |
| `isClientSearchOpen` | `boolean` | `false` | Toggles search bar in Top Clients card |
| `model` | `string` | `'App\\Models\\SalesOrder'` | Laravel model class used as OData filter for audit logs |
| `statusColors` | `{ [key: string]: string }` | see class | Map of status → hex color for donut chart |

---

## Column Definitions

### `latestOrderColumns` (Latest Orders AG Grid)

| Header | Field/ColId | Notes |
|--------|-------------|-------|
| Order No | `custom_id` | — |
| Client | `client_name` (colId) | `valueGetter` → `client.name` |
| Status | `status` | `renderStatusCell()` HTML badge, `filter: false` |
| Amount | `subtotal` | `dataType: Number` |

### `overdueOrderColumns` (Overdue Orders AG Grid)

| Header | Field/ColId | Notes |
|--------|-------------|-------|
| Order No | `custom_id` | — |
| Client | `client_name` (colId) | `valueGetter` → `client.name` |
| Delivery Date | `expected_delivery_date` | `DateFormatterService.formatDate()` valueFormatter |
| Status | `status` | `renderStatusCell()` HTML badge, `filter: false` |
| Amount | `subtotal` | `dataType: Number` |

### AG Grid Data Sources

Both tables use `staticData: true` — data pushed by reassigning the datasource object when `fetchDashboardData()` completes.

```typescript
latestOrdersDataSource = { type: 'odata', staticData: true, data: [] };
overdueDataSource      = { type: 'odata', staticData: true, data: [] };
```

On data arrival:
```typescript
this.latestOrdersDataSource = { ...this.latestOrdersDataSource, data: data.latest_orders || [] };
this.overdueDataSource      = { ...this.overdueDataSource,      data: data.overdue_orders || [] };
```

---

## Lifecycle

### `constructor()`
Stores `odata`/`api` flags from `CommonService`.

### `ngOnInit()`
1. `setDefaultDateRange()` — start = 6 months ago (start-of-month), end = today
2. `getClients()` → `clientList`
3. `getProductList()` → `itemList`, auto-selects first product, triggers `fetchMarketAnalysis()`
4. `fetchDashboardData()` → KPI + charts + orders
5. `getInitialActiveLog()` → audit trail

---

## Methods — Detailed

### `fetchDashboardData()`
GETs `sales/analytics-data?startDate&endDate[&clientId][&status]` (REST).
Maps response:
- `data.kpi.*` → `kpiData`
- `data.charts.monthly_sales` → `monthlySales`
- `data.top_clients` → `topClients` + `filteredTopClients` (with `getInitials()` fallback)
- `data.overdue_orders` → `overdueOrders`
- `data.charts.status_breakdown` → `expenseBreakdown` + `donutColors` (merged with `statusColors`)
- `data.latest_orders` → pushed to `CustomGridTableComponent.data` + `render()`; uses `setTimeout(100)` fallback if ViewChild not ready

### `applyFilter()`
Sets `loading = true`, waits 500ms, then calls `fetchDashboardData()`, `getInitialActiveLog()`, `fetchMarketAnalysis()`, closes dialog.

### `resetFilter()`
Resets `start`/`end` via `setDefaultDateRange()`, clears `selectedClientId` and `statusTitle`, manually sets DOM `value` on `ui5-daterange-picker` and client/status comboboxes via `document.querySelector`.

### `getInitialActiveLog()`
GETs `ActivityLogs?$expand=user&$filter=model_type eq '...' and created_at ge ... and created_at le ...&$orderby=created_at desc&$top=7` (OData). Maps to `ActivityLog.deserialize()`.

### `fetchMarketAnalysis()`
GETs `sales/market-prices?product_id=&start_date=&end_date=` (REST) → `marketAnalysisData`. No-op when `selectedMarketItemId` is null.

### `getProductList()`
GETs active sellable `Products` (OData). Sets `itemList`. Auto-selects first product and calls `fetchMarketAnalysis()` on first load.

### `filterTopClients()`
Filters `topClients` by `clientSearchText` against `name` and `custom_id` (case-insensitive).

### `getNotificationTitle(log)` / `getNotificationMessage(log)`
Build human-readable audit notification text. Parse `log.new_value` / `log.old_value` JSON strings for status extraction.

### `mapStatusToBackend(displayStatus)`
Uppercases and maps display text to `SalesStatus` enum. Returns empty string for unmatched values.

---

## Template Structure

```
<div class="h-screen ...">
  ├── background gradient strip (top 380px)
  └── content (relative z-10)
      ├── header row: "Sales Analytics" + Filter button
      ├── KPI tiles grid (6 cards, xl:grid-cols-6)
      │   Total Orders | Total Sales | Total Amount | Draft Amount | Approved Amount | Rejections
      ├── charts grid (lg:grid-cols-3)
      │   app-shared-bar-chart (monthlySales)
      │   app-shared-donut-chart (expenseBreakdown)
      │   app-market-analysis-chart (marketAnalysisData)
      └── ui5-tabcontainer
          ├── "Orders" tab
          │   ├── app-custom-grid-table [customData]="true" [columns]="column"     — Latest Orders
          │   └── app-custom-grid-table [data]="overdueOrders" [columns]="overdueColumn" — Overdue Orders
          └── "Clients & Audit" tab
              ├── ui5-card: Top Client List
              │   ├── search toggle (isClientSearchOpen / ui5-input → filterTopClients())
              │   └── ui5-list of filteredTopClients (ui5-avatar initials + name + badge amount)
              └── ui5-card: Recent Audit Trail
                  └── ui5-list of activityLogs (ui5-li-notification with title/message/state/importance)

<ui5-dialog [open]="showFilter">
  Date Range (ui5-daterange-picker)
  Clients (ui5-combobox → clientList)
  Status (ui5-combobox → SalesStatus enum values)
  Item (ui5-combobox → itemList for market analysis)
  footer: Apply (applyFilter) | Cancel
```

---

## API Calls

| Method | Endpoint | OData | Purpose |
|--------|----------|-------|---------|
| GET | `sales/analytics-data?startDate=&endDate=[&clientId][&status]` | `false` (REST) | KPI + charts + latest/overdue orders + top clients |
| GET | `ActivityLogs?$expand=user&$filter=...&$orderby=created_at desc&$top=7` | `true` | Recent audit trail |
| GET | `sales/market-prices?product_id=&start_date=&end_date=` | `false` (REST) | Market analysis chart data |
| GET | `Products?$filter=is_active eq true and is_sellable eq true` | `true` | Product list for market item filter |
| GET | `Clients` | `true` | Client list for filter dialog |

---

## Chart Components Used

| Component | Selector | Data | Purpose |
|-----------|----------|------|---------|
| Shared Bar Chart | `app-shared-bar-chart` | `monthlySales` | Monthly sales trend |
| Shared Donut Chart | `app-shared-donut-chart` | `expenseBreakdown` | Order status breakdown |
| Market Analysis Chart | `app-market-analysis-chart` | `marketAnalysisData` | Market price trend for selected product |

---

## Services Injected

| Service | Usage |
|---------|-------|
| `CommonService` | All API calls via `get(url, false)` (REST) and `get(url, true)` (OData) |
| `RolePermissionService` | Permission checks (injected, available for template guards) |
| `DatePipe` | `formatDate()` for audit log `created_at` timestamps |
| `ToastService` | Injected; not currently called in code |
| `DateFormatterService` | `overdueColumn` Cell date formatting |

---

## Key Business Logic

### Data Flow
`ngOnInit` fires 5 parallel calls. `fetchDashboardData` is the primary call — it returns everything except audit logs and market analysis. Market analysis is product-scoped, fetched after `getProductList` selects the first product. Audit logs are independently filtered by date range.

### Latest Orders Grid Push
`CustomGridTableComponent` data is set imperatively via `ViewChild`: `this.gridTable.data = data.latest_orders; this.gridTable.render()`. This is intentional — `[customData]="true"` tells the grid to skip its own OData fetch. A `setTimeout(100)` fallback handles timing if the ViewChild is not ready on first render.

### Filter Apply Pattern
`applyFilter()` wraps in `setTimeout(500)` to show the busy indicator before fetching. This is a UI responsiveness pattern — not debounce.

### Overdue vs Latest
Latest orders come from the analytics API endpoint. Overdue orders are also returned by the same API (`data.overdue_orders`) and bound directly to `[data]` on the CustomGridTable (not via imperative push).

---

## Known Technical Debt

| Issue | Location | Impact |
|-------|----------|--------|
| `resetFilter()` uses `document.querySelector` to reset DOM state | `resetFilter()` method | Brittle — DOM dependency; prefer driving state via bound variables |
| `ToastService` injected but never called | constructor | Dead injection |
| Selector is `app-hrm-dashboard` | `@Component` | Misnamed — should be `app-sales-dashboard` or `app-sales-analytics` |

---

## Future Update Checklist
- If `sales/analytics-data` response shape changes (new KPI field, renamed chart key), update `fetchDashboardData()` mapping and the KPI tiles in the template together.
- If the market analysis product filter is removed, remove `selectedMarketItemId`, `getProductList()`, `fetchMarketAnalysis()`, and the Item filter row in the filter dialog.
- If date range format changes (currently `DD/MM/YYYY` in picker, `YYYY-MM-DD` for API), verify `dateRangePickerChange()` and `setDefaultDateRange()` are both updated.
