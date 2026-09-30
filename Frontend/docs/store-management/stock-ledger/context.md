# Store Management — Stock Ledger

## Files
```
stock-ledger/
├── stock-ledger.component.ts
└── stock-ledger.component.html
```

## Route
`/store/stock-ledger` — **no permission guard** (deliberately left open per explicit instruction: "you can skip the permission, for now dont integrate the permission, keep that open").
Sidebar entry in `StoreLayoutComponent` (icon `sales-order-item`) — also unguarded.

## Concept
Read-only per-product ledger report: one row per product, columns spanning name/code/unit through opening/received/issued/rejected/current stock, rate, amount, rack. REST-backed (`type: 'api'`), not OData — pageSize 40, scroll pagination.

## Backend
- `App\Http\Controllers\Store\StockLedgerController` — `GET store/stock-ledger/report` (paginated JSON for the grid), `POST store/stock-ledger/export` (returns `.xlsx` blob via `App\Exports\StockLedgerExport`).
- Adds two migrations: `opening_stock` on `products` (static value, set once, not derived), `rejected_quantity` on `material_receipt_items` (rejected on receipt / QA).
- `baseQuery()`'s `last_activity` computed column — a raw `GREATEST()` over three nested `MAX()` subqueries (`material_receipt_items.created_at`, `purchase_requisition_items.updated_at` joined to `purchase_requisitions` where `type = 'SR'`, `mrr_return_items.created_at`), each `COALESCE`d to an epoch date so a product missing activity in one or two of the three sources still resolves rather than nulling the whole `GREATEST()`. `resolveSort()`'s default (no `$orderby` given) is `last_activity desc` — "products would appear based on last activity" — replacing the old default of `product_name asc`. `last_activity` is in `ALLOWED_SORT_COLUMNS` so an explicit `$orderby=last_activity asc` also works, but it's a computed alias, not a real `products` column.

## Column meanings (clarified with user during design)
| Column | Source / meaning |
|--------|-------------------|
| Name of Ladger | `category.name` (product category) |
| Material Code | `item_code` (existing item code field) |
| Name of the Material with size | `product_name` + `(model_number)` if present |
| Unit | `uom.name` |
| Opening Stock | `products.opening_stock` — static, set once per product |
| MRR | total quantity received for that product across all Material Receipts |
| SR | Store Requisition issued qty |
| SRM | **placeholder — hardcoded 0**, not yet defined/wired (flagged as open follow-up, deliberately not built) |
| Rejected | rejected on receipt (QA/MRR) — `material_receipt_items.rejected_quantity` |
| Returned Qty | total quantity returned back to the supplier for that product across all MRR Returns — `SUM(mrr_return_items.returned_quantity)` (see `Frontend/docs/store-management/return-mrr/context.md`) |
| Current Stock | `products.current_stock` |
| Rate Per Unit / Amount / Rack No | existing product fields |

## Frontend (`StockLedgerComponent`)
Single list component, `app-ag-grid-table` only (no dialog/form — pure report). `downloadData()` POSTs to the export endpoint and downloads the returned blob as `stock-ledger.xlsx`. `dataSource.sortBy/sortDirection` = `last_activity`/`desc` — matches the backend's default so the grid opens already sorted most-recently-active-product-first, rather than sending an explicit `product_name asc` that would override it.

## Open follow-ups (flagged, not started)
- SRM is not yet defined or wired — currently a hardcoded `0` placeholder in the report response.
- `rejected_quantity` is stored/reported but not yet editable in the MRR receiving UI.
