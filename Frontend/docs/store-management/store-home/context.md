# Store Management — Store Home (Analytics)

## Files

```
store-home/
├── store-home.component.tsx   ← analytics + latest POs
├── store-home.component.html
└── store-home.component.scss
```

## Route
`/store/store-analytics` — guard: `STORE_ANALYTICS`

---

## StoreHomeComponent

### Selector
`app-store-home`

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `purchaseInfo` | `any` | Raw analytics data from API — `total_purchases`, `total_amount`, `total_spr`, `received_orders`, `department_wise_total`, `sr_department_wise`, `top_suppliers`, `monthly_trends`, `latest_pos` |
| `monthlySales` | `{month, count, inbound_count, outbound_count}[]` | Derived from `purchaseInfo.monthly_trends`/`res.data.monthly_trends`, `month` formatted `DD MMM` (via moment) — feeds the "Purchase Trend" line chart: `count` (PO order-count, primary line/`valueField`) plus `inbound_count`/`outbound_count` rendered as extra series (see `purchaseTrendSeries`) |
| `purchaseTrendSeries` | `LineChartSeriesConfig[]` (readonly) | `[{valueField:'inbound_count', color:'#22c55e', name:'Inbound'}, {valueField:'outbound_count', color:'#ef4444', name:'Outbound'}]` — passed as `[series]` (alongside `[valueName]="'Total P/O'"` for the primary line's legend label) to `app-shared-line-chart` so the Purchase Trend card plots PO/Inbound/Outbound on one timeline; green/red is a deliberate in/out convention, not the SAP palette. See `Frontend/docs/shared-components/SHARED_LINE_CHART_CONTEXT.MD` |
| `departmentWiseTotal` | `{department_name, total_amount, percentage}[]` | `purchaseInfo.department_wise_total` — raw PO-amount-by-department data (kept on the model; not currently rendered — donut card now shows SR ratio, see `srDepartmentWise`) |
| `srDepartmentWise` | `{department_name, total_requests, percentage}[]` | `purchaseInfo.sr_department_wise`, zero-percentage rows filtered — passed straight (no reshaping) to `app-shared-donut-chart` with `[labelField]="'department_name'" [valueField]="'percentage'"` for the "Department-wise SR Ratio" card. Chart's own `showCenterOverlay`/`showSideList` inputs render the ring-with-center-% + scrollable colored legend list — no per-component color array, `getColor()` helper, or hand-rolled list markup here; see `Frontend/docs/shared-components/SHARED_DONUT_CHART_CONTEXT.MD` |
| `latestPoColumns` | `AgGridTableColumn[]` | Columns for latest POs mini-grid |
| `latestPoDataSource` | `AgGridTableODataSourceConfig` | Static data source for latest POs |
| `latestPoToolbarConfig` | `AgGridTableToolbarConfig` | No search, no new button |
| `latestPoDisplayConfig` | `AgGridTableDisplayConfig` | `gridHeight: 'calc(35vh - 60px)'` |
| `start` / `end` | `string` | Date range — default: last 90 days |
| `dateRangeValue` | `string` | Formatted range string for date-range picker |

### Key Methods

| Method | Description |
|--------|-------------|
| `ngOnInit()` | Sets default date range, loads departments, suppliers, purchase info |
| `initPurchaseInfo()` | GET `purchase/analysis-data?startDate=...&endDate=...` (REST); sets `purchaseInfo` + `latestPoDataSource.data` + derives `monthlySales` + `departmentWiseTotal` + `srDepartmentWise` |
| `getSuppliers()` | GET `Suppliers` (OData) |
| `getDepartments()` | GET `Departments` (OData) |
| `applyFilter()` | Re-fetches `initPurchaseInfo()` — filter bar is now inline in the header (no modal to close) |
| `dateRangePickerChange(event)` | Parses DD/MM/YYYY range from input event, updates `start`/`end`/`dateRangeValue` |

### Latest PO Grid Columns

| Field | Header |
|-------|--------|
| `custom_id` | Item Code |
| `department_name` | Department Name |
| `supplier_name` | Supplier Name |
| `amount` | Amount |

### Stat Cards (all dynamic, backed by `purchaseInfo`)

| Card | Field |
|------|-------|
| Total P/O | `total_purchases` |
| Total SPR | `total_spr` (count of `type=SPR` requisitions in range/department) |
| Orders Received | `received_orders` (POs with `status=RECEIVED`) |
| Stock Value | `total_amount` |

### Filter Bar

Inline in the header (not a modal dialog) — matches `hrm-dashboard`'s layout convention: `grid md:grid-cols-12` with title (`col-span-3`) + a bordered/blurred bar (`col-span-9`) containing date-range picker, department combobox, supplier combobox, Apply/Reset buttons. `showFilter`/`toggleFilter()` were removed (no longer applicable — there's no panel to open/close).

### API Calls

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `purchase/analysis-data?startDate=...&endDate=...` | REST (`false`); returns `{ data: { total_purchases, total_amount, total_spr, received_orders, department_wise_total, sr_department_wise, top_suppliers, monthly_trends, latest_pos } }` — filters: `startDate`, `endDate`, `department_id`, `supplier_id` (`supplier_id` has no effect on `sr_department_wise`/`total_spr` since requisitions have no supplier column). Each `monthly_trends` row is now `{month, order_count, inbound_count, outbound_count}` — `inbound_count` from `material_receipts.receipt_date`, `outbound_count` from `purchase_requisitions` where `type='SR'` (`.request_date`), merged in by day alongside the existing PO `order_count` |
| GET | `Suppliers` | OData |
| GET | `Departments` | OData |

### Backend

`PurchaseController::getAnalysisData` → `PurchaseService::getPurchaseAnalysis` (`Backend/app/Services/Purchase/PurchaseService.php`). PO-based metrics query `purchase_orders`; `total_spr` and `sr_department_wise` query `purchase_requisitions` where `type='SR'`/`'SPR'` respectively, filtered by `request_date`/`department_id` (own cloned base query, not shared with the PO query). `monthly_trends`' `inbound_count`/`outbound_count` come from two more grouped-by-day queries (`material_receipts` by `receipt_date`/`supplier_id`/`department_id`; a clone of the SR query by `request_date`) merged into the PO trend by date key. No N+1 — each metric is one flat aggregate query.
