# Store Management — Item Inventory

## Files

```
item-inventory/
├── item-inventory.component.tsx   ← item/product list
├── item-inventory.component.html
├── item-inventory.component.scss
└── item-details/
    ├── item-details.component.tsx   ← item detail view (tabs; all tables = ag-grid)
    └── item-details.component.html
```

## Route
`/store/item-inventory` — guard: `STORE_ITEM_INVENTORY`

---

## ItemInventoryComponent

### Selector
`app-item-inventory`

### Purpose
Lists all products/items with stock status indicator. Supports viewing/editing item details and Excel export.

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `dataSource` | `AgGridTableODataSourceConfig` | OData `Products` |
| `product` | `Product` | Current item — passed to `ItemDetailsComponent` |
| `clone` | `boolean` | Clone mode flag — always `false` (no clone in list view) |
| `saveMode` | `string` | `saveMode.PUT` after clicking info |
| `agGridRef` | `AgGridTableComponent` | `#agGridRef` |
| `itemFormRef` | `ItemDetailsComponent` | `#itemForm` |

### OData Config

| Key | Value |
|-----|-------|
| endpoint | `Products` |
| expand | `suppliers,productTypes,category,clients,plants,variants,uom` |
| searchFields | `['item_code', 'product_name', 'model_number', 'category.name', 'unit_price', 'current_stock', 'minimum_stock']` |
| sortBy | `id` desc |

### Toolbar
- Download button visible (`showDownload: true`) — triggers Excel export
- No New button (`showNewButton: false`)

### Permissions

| Permission | Effect |
|------------|--------|
| `STORE_ITEM_INVENTORY_VIEW` | Shows info action button |

### Columns

| Field/ColId | Header | Notes |
|-------------|--------|-------|
| `item_code` | Item Code | plain field |
| `product_name` | Item Name | `flex: 1` |
| `category.name` | Category | `colId` dot notation → OData filter works; `valueGetter: category.name` |
| `model_number` | Model | plain field |
| `rack_no` | Rack Number | plain field |
| `current_stock` | Current Stock | `width: 130` |
| `minimum_stock` | Minimum Stock | `width: 130` |
| `stock_status` | Status | `cellRenderer: AgGridStatusBadgeComponent`; `valueGetter` returns `"Critical"` or `"Normal"` |
| `unit_price` | Unit Price | `width: 120` |
| `created_at` | Created On | `valueFormatter: toLocaleDateString()` |
| `actions` | Actions | info icon → `ItemDetails()`; pinned right |

### Stock Status Logic
```typescript
valueGetter: (p) => p.data?.current_stock < p.data?.minimum_stock ? "Critical" : "Normal"
```
`"Critical"` / `"Normal"` (mixed case) — matches `statusStyles` keys exactly.

### Key Methods

| Method | Description |
|--------|-------------|
| `ItemDetails(data)` | Opens `ItemDetailsComponent`; populates all form fields; calls `getAssociateData()` |
| `processData(event)` | `agGridRef?.refreshGridData(true)` — called on `(RefreshTable)` and `(isSuccessChange)` events |
| `downloadData(_event?)` | POST `item/export` as blob; downloads `Exported Item.xlsx` |
| `getAssociateData(data)` | Deferred (`setTimeout`) — calls `itemFormRef.setAssociateData(data)` to feed the detail tables |

### getAssociateData Detail
```typescript
setTimeout(() => this.itemFormRef?.setAssociateData(data));
```
`setAssociateData` (on `ItemDetailsComponent`) reassigns the static `dataSource` objects from `data.suppliers/clients/plants` and sets the variant OData `filter` to `parent_id eq <product.id>`.

### Important Caveats
- `downloadData` uses `_event?: any` parameter — `(downloadButtonClick)` always emits an event so the signature must accept it.
- `gridId="item-inventory-list"` — column state localStorage key.
- `searchFields` includes `unit_price` and `current_stock` — both `string` columns on `products` (per `2025_06_19_081209_add_columns_to_products_table` / `2025_10_19_113322_add_rack_to_products_table`), safe for lodata's `contains(tolower())`. `minimum_stock` is `integer` (per `2025_11_10_064736_add_minimum_stock_to_products_table`) — added too, but **unverified against a live lodata request**; `contains(tolower())` wrapping a non-string OData property can throw a parser error on some lodata versions. If search 500s specifically when a numeric term is typed, drop `minimum_stock` from searchFields first. See `purchase-order`'s `total_amount` (a `decimal` column, deliberately left OUT of searchFields for this exact reason) for the same caveat.

---

## ItemDetailsComponent

### Selector
`app-item-details`

### Type
Read-only detail dialog (`saveMode = PUT`) with tabs: Core Data (form), Variant, Supplier, Client, Plant, Compliance/Attachments.

### Detail tables — `app-ag-grid-table` (migrated from `react-analytical-table`)
All five tables are read-only (`selectionMode='None'`, `showAction=false`).

| Tab | dataSource | Columns |
|-----|-----------|---------|
| Variant (POST) | `variantStaticDataSource` — static from `product.variants` | `variantColumnsDef` |
| Variant (PUT) | `variantOdataDataSource` — OData `Products`, `filter: parent_id eq <id>`, `sortBy id desc` | `variantColumnsDef` |
| Supplier | `supplierDataSource` — static from `product.suppliers` | `supplierColumns` |
| Client | `clientDataSource` — static from `product.clients` | `clientColumns` |
| Plant | `plantDataSource` — static from `product.plants` | `plantColumns` |

- `variantColumnsDef`: `is_active` (`AgGridBooleanCellRendererComponent`), `product_name` (`valueGetter: product_name || variant_value`), `unit_price` (`valueGetter: unit_price || variant_unit_price`).
- Associate columns (`supplier`/`client`/`plant`): `is_active` (boolean renderer), `custom_id` (ID), `name`, `created_at` (date formatter).
- Built in `buildDetailColumns()` (called from `ngOnInit`); `detailGridDisplayConfig.gridHeight = 'calc(100vh - 340px)'`.

### Migration notes
- React `Icon` accept/decline cell renderers → shared `AgGridBooleanCellRendererComponent`; the `.tsx` no longer contains JSX.
- Removed dead `AnalyticalTableComponent` ViewChilds (`variantTable`, `variantEditTableRef`, `suppliersTable`, `clientTable`, `plantTable`) and the unused assosiate/remove helpers (`getSupplierFromAssosiate`, `removeSupplierData`, `getClientFromAssosiate`, `removeClientData`, `getPlantFromAssosiate`).
- Parent feeds data via `setAssociateData(data)` instead of `*.staticData.emit()` + `render()`.

### Logs — `logsDataSource` (SR issuance history for this product)
Separate from the 5 detail tabs above. OData `PurchaseRequisitions`, filter:
```
type eq 'SR' and status eq 'FINAL_APPROVAL' and sprItems/any(i:i/product_id eq <product.id>)
```
`searchFields: ['custom_id', 'requestBy.name', 'department.name', 'urgency']` — `urgency` was missing (a plain visible `string` column, not date/badge/action) and has been added.
**Must be `FINAL_APPROVAL`, not `APPROVED`** — per the two-level SR approval flow (see
`store-management/INDEX.md`'s "Two-Level Requisition Approval" section), `APPROVED` is only the
Level-1 (GM) intermediate state; `FINAL_APPROVAL` is the only status meaning the SR is fully
approved and stock was actually decremented. Filtering on `APPROVED` would show SRs still awaiting
final approval as if they were completed issuance history — this was a live bug, now fixed.
