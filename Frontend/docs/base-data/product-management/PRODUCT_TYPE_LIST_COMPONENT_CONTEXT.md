# PRODUCT_TYPE_LIST_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| TSX file | `Frontend/src/app/modules/base-data-management/product-management/product-type/product-type-list/product-type-list.component.tsx` |
| HTML file | `Frontend/src/app/modules/base-data-management/product-management/product-type/product-type-list/product-type-list.component.html` |
| Selector | `app-oparation-management-list` |
| Component type | List |
| Table component | `app-ag-grid-table` (`AgGridTableComponent`) |
| Purpose | Renders a paginated, filterable OData-backed AG Grid table of Product Types (Item Types). Role-gated create, edit, delete. Delegates to `ProductFormComponent` dialog; delete to `app-delete-entity`. |

---

## Inputs (@Input)

No `@Input()` properties.

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `refreshTable` | `EventEmitter<void>` | Emitted after any successful mutation. |
| `IsDelete` | `EventEmitter<string>` | Emits OData path (e.g. `ProductTypes/5`) to `app-delete-entity`. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `agGridRef` | `AgGridTableComponent<ProductType>` | `@ViewChild` | `refreshGridData()` after mutations. |
| `productFormRef` | `ProductFormComponent` | `@ViewChild` | Opens form dialog. |
| `permissions` | `typeof Permissions` | `Permissions` | Exposes permissions to template. |
| `saveMode` | `string` | `saveMode.POST` | Form mode. |
| `productType` | `ProductType` | `new ProductType().deserialize({})` | Current form data, bound to `[productType]` input. |
| `gridId` | `string` | `'base-data-product-type-list'` | AG Grid state persistence key. |
| `columns` | `AgGridTableColumn<any>[]` | Built in constructor | Column definitions. |
| `dataSource` | `AgGridTableODataSourceConfig<ProductType>` | endpoint `ProductTypes`, searchFields `['name', 'custom_id']`, pageSize 40 | OData source. |
| `toolbarConfig` | `AgGridTableToolbarConfig` | headerTitle "Item Type", showSearch, showRowCount, showSegmentButton, showNewButton gated on `BASE_DATA_ITEM_TYPE_CREATE` | Toolbar config. |
| `displayConfig` | `AgGridTableDisplayConfig` | `{ gridHeight: 'calc(100vh - 118px)' }` | Grid height. |

---

## Methods

### `buildColumns(): AgGridTableColumn<any>[]`
Returns: `is_active` (boolean renderer), `custom_id`, `name`, `created_at` (date formatted).

### `processData(_event?): void`
Emits `refreshTable` + calls `agGridRef.refreshGridData(true)`.

### `newProductType(): void`
Resets `productType`, opens form in POST mode.

### `editProductType(data): void`
Deserializes data into `productType`, opens form in PUT mode.

### `deleteClick(data): void`
Emits `IsDelete` with `ProductTypes/${data.id}`.

---

## Template Structure

```
<div class="h-[calc(100vh-55px)]">
  <app-ag-grid-table #agGridRef ...>
<app-delete-entity ...>
<app-product-form #productForm [saveMode]="saveMode" [productType]="productType" ...>
```

### `app-ag-grid-table` key bindings

| Binding | Value |
|---|---|
| `[dataSource]` | OData: `ProductTypes` |
| `[showEditButton]` | `BASE_DATA_ITEM_TYPE_EDIT` |
| `[showDeleteButton]` | `BASE_DATA_ITEM_TYPE_DELETE` |
| `(newButtonClick)` | `newProductType()` |
| `(editClick)` | `editProductType($event)` |
| `(deleteClick)` | `deleteClick($event)` |
| `(rowClick)` | `editProductType($event)` |

---

## API Calls

| Method | Endpoint | Delegated to |
|---|---|---|
| GET | `ProductTypes` | `AgGridTableComponent` |
| POST | `ProductTypes` | `ProductFormComponent` |
| PUT | `ProductTypes({id})` | `ProductFormComponent` |
| DELETE | `ProductTypes/{id}` | `app-delete-entity` |

---

## Services Injected

| Service | Visibility | Methods used |
|---|---|---|
| `RolePermissionService` | `public` | `hasPermission()` |

---

## Enums / Models Used

| Name | Source | Usage |
|---|---|---|
| `ProductType` | `@app/shared/model/productType` | Grid row model; form binding |
| `saveMode` | `@app/shared/enums/saveMode` | `POST` / `PUT` |
| `Permissions` | `@app/shared/enums/permissions` | `BASE_DATA_ITEM_TYPE_CREATE`, `EDIT`, `DELETE` |
| `Localization` | `@app/shared/utilities/localization` | `Localization.CreatedAt` |
| `AgGridBooleanCellRendererComponent` | `@shared/components/ag-grid-table/cell-renderers/` | `is_active` column |
