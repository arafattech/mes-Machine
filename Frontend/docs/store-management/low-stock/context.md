# Store Management — Low Stock

## Files

```
low-stock/
├── low-stock.component.ts   ← .ts extension (not .tsx)
└── low-stock.component.html
```

## Route
`/store/low-stock` — guard: `STORE_LOW_STOCK`

---

## LowStockComponent

### Selector
`app-low-stock`

### Purpose
Read-only list of items where `current_stock >= 0 AND current_stock < minimum_stock`. Out-of-stock (`current_stock = 0`) counts as low stock as long as `minimum_stock > 0`; only the `0 / 0` case (no minimum set) and negative-`current_stock` data anomalies are excluded. Server-side loading, search, sort, and pagination via `type: 'api'` (REST, not OData — a raw `$filter` comparing two entity properties isn't supported by lodata, so this is a dedicated REST endpoint instead of the `Products` OData set), same pattern as `PromotionManagementComponent`.

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `dataSource` | `AgGridTableODataSourceConfig` | `{ type: 'api', endpoint: '', customEndpoint: 'store/low-stock/report', sortBy: 'current_stock', sortDirection: 'asc', pageSize: 40, scrollPagination: true, searchFields: ['item_code','product_name','model_number','rack_no','category.name','unit_price','current_stock','minimum_stock'] }` |
| `columns` | `AgGridTableColumn[]` | Defined inline (no `ngOnInit` needed) |

### Data Fetch Pattern
`app-ag-grid-table` drives fetching itself (infinite scroll, block cache) — no manual `commonService.get` call in the component. Each block request hits:
```
GET store/low-stock/report?$top=&$skip=&$filter=&$orderby=&$count=true
→ response: { value: Product[], '@count': number }
```
`$filter` carries `contains(tolower(field),'term')` fragments built from the search box / column filters; the backend extracts search words from any `contains(...)` clause (field-agnostic) rather than parsing per-column.

### Template
No `#agGridRef`, no date range picker, no segment buttons, no new/download button, no row actions.

### Columns

| Field/ColId | Header | Notes |
|-------------|--------|-------|
| `item_code` | Item Code | searchable |
| `product_name` | Item Name | `flex: 1`; searchable |
| `category.name` | Category | `valueGetter: p.data?.category?.name`; `sortable: false`; searchable |
| `model_number` | Model | searchable |
| `rack_no` | Rack Number | searchable |
| `current_stock` | Current Stock | default sort column, `asc` |
| `minimum_stock` | Minimum Stock | |
| `stock_status` | Status | `AgGridStatusBadgeComponent`; always renders `'Low Stock'` (every row returned by the endpoint already satisfies `current_stock >= 0 AND current_stock < minimum_stock`) |
| `unit_price` | Unit Price | |
| `created_at` | Created On | `dataType: GridTableColumnDataType.Date` |

### API Call

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `store/low-stock/report` | REST (`type: 'api'`, `isOdata: false`); backend: `Product::where('current_stock', '>=', 0)->whereColumn('current_stock', '<', 'minimum_stock')`, paginated via `$top`/`$skip`, sorted via whitelisted `$orderby` columns, searched via `$filter`/`search` |

### Backend — `LowStockController::report`
- Base filter: `current_stock >= 0 AND current_stock < minimum_stock` — out-of-stock rows (`current_stock = 0`) now count as low stock (as long as a minimum is actually set); only the `0 / 0` case (`current_stock < minimum_stock` fails when both are 0) and negative `current_stock` are excluded. Equal-to-minimum rows (`current_stock == minimum_stock`) are still excluded — strict `<`, not `<=`.
- `current_stock` is a nullable **string** column (see `2025_10_19_113322_add_rack_to_products_table` migration), not an integer — the `>=0`/`whereColumn` comparisons rely on MySQL's implicit numeric coercion of numeric-looking strings. The `>=0` guard exists specifically to keep any anomalous negative-string value from ever appearing as "low stock."
- `ALLOWED_SORT_COLUMNS` whitelist for `$orderby` (prevents arbitrary column injection).
- Search terms extracted from `$filter` (`contains(...)` regex) and/or `search` param, matched (AND across words) against `item_code`, `product_name`, `model_number`, `rack_no`, `category.name`, `unit_price`, `current_stock`, `minimum_stock` — raw SQL `like`, which (unlike lodata's `contains(tolower())`) is safe on both string and integer columns, so `minimum_stock` (`integer`) needed no special handling here. The controller's search is field-agnostic (extracts the typed term, then always runs this fixed column list) — `searchFields` on the Angular side exists for documentation/consistency, not to target specific backend columns.
- Returns `{ value, '@count' }` — matches the shape `resolveRows()` expects for `type: 'api'`.

### Important Caveats
- `gridId="low-stock-list"` — column state localStorage key.
- `statusStyles['Low Stock']` (in `@shared/utilities/statusStyles`) reuses the `Critical` badge color.
- No `ngOnInit`/`OnInit` — columns and dataSource defined directly in class body; view-only, no actions, no `CommonService` injection needed in the component.
