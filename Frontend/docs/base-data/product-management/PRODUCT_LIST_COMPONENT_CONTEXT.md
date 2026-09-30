# PRODUCT_LIST_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| TS file | `product-list.component.ts` |
| HTML file | `product-list.component.html` |
| Selector | `app-product-list` |
| Type | List / Master-Detail split-panel |
| Implements | `OnInit`, `AfterViewInit` |
| Grid | `app-ag-grid-table` — flat-input API |

**Purpose:** Primary entry point for Item (Product) management. Left = AG Grid product list. Right = `ItemFormComponent` for create/edit/clone. Orchestrates CRUD, permission gating, barcode PDF, Excel export, delete confirmation.

---

## @Inputs

None. Self-contained feature component.

---

## @Outputs

| Output | Type | Description |
|---|---|---|
| `refreshTable` | `EventEmitter<void>` | Emitted after any CRUD success |
| `IsDelete` | `EventEmitter<any>` | OData delete path `Products/<id>` — passed to `app-delete-entity` |
| Others | Reserved | `IsOpenToastAlert`, `triggerLoading`, `refreshVariantTable*`, `IsInsertVariant` |

---

## State

| Property | Type | Default | Purpose |
|---|---|---|---|
| `permissions` | `typeof Permissions` | `Permissions` | Enum ref for template checks |
| `product` | `Product` | `new Product()` | Active product passed to form |
| `SelectedProduct` | `Product` | `new Product().deserialize({id:0})` | Currently selected row |
| `clone` | `boolean` | `false` | Clone mode flag |
| `isLoading` | `boolean` | `false` | Download (Excel export) busy indicator — shown via `ui5-dialog`, not grid `[isBusy]` |
| `saveMode` | `string` | `saveMode.POST` | `POST` (new/clone) or `PUT` (edit) |
| `isListCollapsed` | `boolean` | `false` | Hides left panel |
| `isTabCollapsed` | `boolean` | `true` | Hides right panel — starts collapsed |
| `gridId` | `string` | `'base-data-product-list'` | State key for AG Grid |
| `rowIdField` | — | `'id'` (default) | Products have `id` PK — no override needed |
| `columns` | `AgGridTableColumn<any>[]` | Built in constructor | Rebuilt after categories load |
| `categoryOptions` | `AgGridTableFilterOptionInput[]` (private) | `[]` | Loaded async — populates category multiselect filter |
| `rowActions` | `AgGridTableRowAction<Product>[]` | 3 actions with `visible()` | Clone / Print / Delete |
| `variantData` | `Variant[]` | `[]` | Reserved |

---

## AG Grid Template Bindings

Config-object API. The fetch/toolbar/display surfaces are passed as `dataSource` / `toolbarConfig` / `displayConfig` objects (built in the component class); selection, state, action column and illustrated message stay flat.

**Component fields:**

```typescript
dataSource: AgGridTableODataSourceConfig<Product> = {
  type: 'odata',
  endpoint: 'Products',
  expand: 'suppliers,productTypes,category,clients,plants,variants,uom',
  searchFields: ['item_code','product_name','part_number','model_number','rack_no'],
  pageSize: 40,
  scrollPagination: true,
};
toolbarConfig: AgGridTableToolbarConfig = {
  headerTitle: 'Items',
  showSearch: true,
  showScanner: true,
  showRowCount: true,
  showDownload: true,
  showSegmentButton: true,
  addButtonText: 'New',
  showNewButton: this.rolePermissionService.hasPermission(Permissions.BASE_DATA_ITEM_CREATE),
};
displayConfig: AgGridTableDisplayConfig = { gridHeight: 'calc(100vh - 118px)' };
```

**Template:**

```html
<app-ag-grid-table
  #agGridRef
  [columns]="columns"
  [dataSource]="dataSource"
  [toolbarConfig]="toolbarConfig"
  [displayConfig]="displayConfig"
  selectionMode="Single"
  [isBase]="true"
  [gridId]="gridId"
  [showAction]="false"
  [editPermission]="true"
  [showEditButton]="rolePermissionService.hasPermission(permissions.BASE_DATA_ITEM_EDIT)"
  [showDeleteButton]="rolePermissionService.hasPermission(permissions.BASE_DATA_ITEM_DELETE)"
  [showIllustratedMessage]="true"
  IllustratedName="NoData"
  IllustratedTitle="No Items Found"
  IllustratedSubtitle="Try adjusting your search, filters, or active status."
  (newButtonClick)="newItem()"
  (editClick)="handleRowSelect($event)"
  (deleteClick)="deleteClick($event.id)"
  (rowClick)="handleRowSelect($event)"
  (downloadButtonClick)="downloadData()"
  (processData)="onGridDataLoaded($event)"
  (cellEdited)="onCellEdited($event)"
></app-ag-grid-table>
<!-- rowIdField defaults to 'id' — Products.id is the PK, no override needed -->
```

---

## Column Definitions

Built in `buildColumns()`. Rebuilt when `loadCategoryOptions()` completes.

| Column | Field | Filter | Editor |
|---|---|---|---|
| Active | `is_active` | none | — |
| Category | `valueGetter` → `custom_id + ' - ' + name` | **multiSelect** (loaded from API) | — |
| Item Code | `item_code` | text | `text` if EDIT permission |
| Item Name | `product_name` | text | `text` if EDIT permission |
| Model | `model_number` | text | `text` if EDIT permission |
| Part Number | `part_number` | text | `text` if EDIT permission |
| Has Variant | `has_variant` | none | — (VARIANTS permission only) |
| Rack No | `rack_no` | text | `text` if EDIT permission |
| Current Stock | `current_stock` | number | `number` min=0 dec=2 if EDIT |
| Min Stock | `minimum_stock` | number | `number` min=0 dec=2 if EDIT |
| Unit Price | `unit_price` | number | `number` min=0 dec=4 if EDIT |
| Created On | `created_at` | none | — |

---

## Row Actions

All 3 are always in the `rowActions` array. `visible()` checked at row-render time — avoids empty column on init.

| Action | Icon | `visible()` | Handler |
|---|---|---|---|
| Clone | `copy` | `hasPermission(BASE_DATA_ITEM_CLONE)` | `cloneItem(row)` |
| Print Barcode | `print` | `hasPermission(BASE_DATA_ITEM_EDIT)` | `printBarcode(row.id)` |
| Delete | `delete` | `hasPermission(BASE_DATA_ITEM_DELETE)` | `deleteClick(row.id)` |

**Why `visible()` not constructor check:** `rolePermissionService.permissions` starts empty. At constructor time, all `hasPermission()` return `false` → empty array → no action column rendered. Using `visible()` arrow functions evaluates permissions at row render time when permissions ARE loaded.

---

## ViewChild References

| Ref | Type | Purpose |
|---|---|---|
| `agGridRef` | `AgGridTableComponent<Product>` | `refreshGridData(true)` after CRUD |
| `itemFormRef` | `ItemFormComponent` | Mutated directly for all form state |

---

## Lifecycle

### `constructor`
`this.columns = this.buildColumns()` — initial columns (category filter empty).

### `ngOnInit`
`this.loadCategoryOptions()` → GET `ItemCategories?$filter=is_active eq true&$select=id,name,custom_id&$orderby=name asc` → on success: builds options as `{ value: c.id, label: 'custom_id - name' }`, then `this.columns = this.buildColumns()` with populated category filter.

---

## Key Methods

### ⚠️ `processData` vs `onGridDataLoaded` — Critical

| Method | Called by | Does |
|---|---|---|
| `processData(_event?)` | form `(RefreshTable)` / `(isSuccessChange)` / delete `(isSuccess)` | `refreshTable.emit()` + `agGridRef.refreshGridData(true)` |
| `onGridDataLoaded(_rows)` | `app-ag-grid-table (processData)` | No-op. **Never calls `refreshGridData`** |
| `reloadGrid()` (private) | `processData()` only | `agGridRef.refreshGridData(true)` |

Calling `refreshGridData` inside `onGridDataLoaded` → infinite loop: data loads → event fires → grid purged → data loads again.

### `handleRowSelect(row: Product)`
Called by `(rowClick)` and `(editClick)`. Sets `SelectedProduct`, opens form panel, calls `editItem(row)`.

### `onCellEdited(event)`
Auto-saves via `PUT Products(id)` with `{ [field]: newValue }`.
- Success → `toastService.show('edit')`
- Error → `toastService.show('error')` + `agGridRef.refreshGridData(true)` to revert

### `newItem()`
Opens form in POST mode. Null-guards `itemFormRef` and `itemAttachmentsTab`.

### `editItem(data)` / `cloneItem(data)`
Populate all `ItemFormComponent` state from row. Clone: `saveMode=POST`, triggers `itemCodeLoad`. Edit: `saveMode=PUT`.

### `deleteClick(id)`
`IsDelete.emit(`Products/${id}`)` → `app-delete-entity` handles confirmation + HTTP call.

### `printBarcode(productId)`
POST to `product-barcode` API → Blob → open in new tab or download fallback.

### `downloadData()`
POST to `item/export` API → Blob → download `Exported Items.xlsx`.

---

## API Calls (direct)

| Endpoint | When | Notes |
|---|---|---|
| GET `ItemCategories?$filter=is_active eq true&$select=id,name,custom_id&$orderby=name asc` | `ngOnInit` | Populates category multiselect filter. Label format: `"name - custom_id"`. Filter value = category `id`. Column `colId` is the scalar FK `item_category_id` (not the nav path), so OData filter produced: `(item_category_id eq 17 or item_category_id eq 8 ...)` (integer, unquoted) — no `$expand` traversal needed. |
| POST `product-barcode` | Print action | Blob PDF |
| POST `item/export` | Download | Blob xlsx |
| PUT `Products(id)` | Inline cell edit | Partial update `{ [field]: value }` |

**OData products** (handled by `app-ag-grid-table`):
`GET /odata/Products?$top=40&$skip=0&$count=true&$expand=suppliers,...&$filter=...`

`$count=true` is sent only on the first page (`$skip=0`). Subsequent scroll pages omit `$count` — total row count is cached from the first response and reused until the next hard datasource reset (`refreshGridData(true)`).

**On-scroll pagination:** grid runs with `dataSource.scrollPagination = true` — the scrollbar thumb stays large and grows as the user scrolls more pages, instead of being hair-thin against the full 1991-row virtual height. Toolbar still shows the real total. Blocks still load on demand. See `AG_GRID_TABLE_CONTEXT.MD` → Scrollbar Behavior / `emitRows`.

---

## Permissions

| Constant | Gates |
|---|---|
| `BASE_DATA_ITEM_CREATE` | `[showNewButton]` binding |
| `BASE_DATA_ITEM_EDIT` | Edit action `visible()` + column inline editors |
| `BASE_DATA_ITEM_DELETE` | Delete action `visible()` |
| `BASE_DATA_ITEM_CLONE` | Clone action `visible()` |
| `BASE_DATA_ITEM_VARIANTS` | Has Variant column |

---

## Inter-component Communication

### `app-ag-grid-table (#agGridRef)`
Inputs: all flat flags. Outputs: `(editClick)` → `handleRowSelect`, `(deleteClick)` → `deleteClick`, `(rowClick)` → `handleRowSelect`, `(newButtonClick)` → `newItem`, `(downloadButtonClick)` → `downloadData`, `(processData)` → `onGridDataLoaded` (no-op), `(cellEdited)` → `onCellEdited`.
Direct calls: `agGridRef.refreshGridData(true)` from `reloadGrid()`.

### `ItemFormComponent (#itemForm)`
Inputs: `[saveMode]`, `[isclone]`, `[product]`.
Outputs: `(RefreshTable)` / `(isSuccessChange)` → `processData()`, `(closeFrom)` → `cancelEdit()`.
Direct mutations: `open`, `saveMode`, `isclone`, `product`, `selectedTab`, `selectedProductType`, `selectedCategory`, `catagoryTitle`, `selectedSubCategory`, `selectedSubCategoryIds`, `selectedItemTypeName`, `selectedItemUomName`, `itemAttachmentsTab.*`, `variantEditTableRef.*`, `Suppliers`, `supplierDataSource`, `Clients`, `Plants`, `plantDataSource`.
`getAssociateData(data)` populates supplier/plant via AG Grid object-spread (`supplierDataSource = {..., data:[...]}`, `plantDataSource = {..., data:[...]}`). Client still uses legacy `clientTable.staticData.emit()` / `render()` (not yet migrated).

### `app-delete-entity`
Input: `[IsDelete]="IsDelete"`.
Output: `(isSuccess)="processData($event)"` → reload grid.
