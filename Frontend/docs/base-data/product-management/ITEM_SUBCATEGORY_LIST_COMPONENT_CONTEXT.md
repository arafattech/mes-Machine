# ITEM_SUBCATEGORY_LIST_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| TSX file | `Frontend/src/app/modules/base-data-management/product-management/item-sub-category/sub-category-list/sub-category-list.component.tsx` |
| HTML file | `Frontend/src/app/modules/base-data-management/product-management/item-sub-category/sub-category-list/sub-category-list.component.html` |
| Selector | `app-sub-category-list` |
| Component type | List |
| Table component | `app-ag-grid-table` (`AgGridTableComponent`) |
| Purpose | Renders a paginated OData-backed AG Grid table of Item Sub-Categories. Expands category relation for display. Role-gated create, edit, delete. Delegates to `SubCategoryFormComponent` dialog; delete to `app-delete-entity`. |

---

## Inputs (@Input)

No `@Input()` properties.

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `refreshTable` | `EventEmitter<void>` | Emitted after any successful mutation. |
| `IsDelete` | `EventEmitter<string>` | Emits OData path (e.g. `ItemSubCategories/5`) to `app-delete-entity`. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `agGridRef` | `AgGridTableComponent<ItemSubCategory>` | `@ViewChild` | `refreshGridData()` after mutations. |
| `subCategoryFormRef` | `SubCategoryFormComponent` | `@ViewChild` | Opens form dialog; sets `itemSubCategory`, `categoryTitle` imperatively. |
| `permissions` | `typeof Permissions` | `Permissions` | Exposes permissions to template. |
| `saveMode` | `string` | `saveMode.POST` | Form mode. |
| `gridId` | `string` | `'base-data-item-sub-category-list'` | AG Grid state persistence key. |
| `columns` | `AgGridTableColumn<any>[]` | Built in constructor | Column definitions. |
| `dataSource` | `AgGridTableODataSourceConfig<ItemSubCategory>` | endpoint `ItemSubCategories`, expand `category($select=id,name)`, searchFields `['name', 'custom_id']`, pageSize 40 | OData source. Expand provides category name for grid display. |
| `toolbarConfig` | `AgGridTableToolbarConfig` | headerTitle "SubCategory List", showSearch, showRowCount, showSegmentButton, showNewButton gated on `BASE_DATA_ITEM_SUBCATEGORY_CREATE` | Toolbar config. |
| `displayConfig` | `AgGridTableDisplayConfig` | `{ gridHeight: 'calc(100vh - 118px)' }` | Grid height. |

---

## Methods

### `buildColumns(): AgGridTableColumn<any>[]`
Returns: `is_active` (boolean renderer), `custom_id`, `category.name` (via valueGetter), `name` (sub-category name), `created_at` (date formatted).

### `processData(_event?): void`
Emits `refreshTable` + calls `agGridRef.refreshGridData(true)`.

### `newSubCategory(): void`
Opens form in POST mode, clears `categoryTitle`.

### `editSubCategory(data): void`
Calls `subCategoryFormRef.itemSubCategory.deserialize(data)`, opens form in PUT mode, sets `subCategoryFormRef.categoryTitle = data.category?.name ?? ''`.

### `deleteClick(id): void`
Emits `IsDelete` with `ItemSubCategories/${id}`.

---

## Template Structure

```
<div class="h-[calc(100vh-55px)]">
  <app-ag-grid-table #agGridRef ...>
<app-delete-entity ...>
<app-sub-category-form #subCategoryForm [saveMode]="saveMode" ...>
```

### `app-ag-grid-table` key bindings

| Binding | Value |
|---|---|
| `[dataSource]` | OData: `ItemSubCategories`, expand `category($select=id,name)` |
| `[showEditButton]` | `BASE_DATA_ITEM_SUBCATEGORY_EDIT` |
| `[showDeleteButton]` | `BASE_DATA_ITEM_SUBCATEGORY_DELETE` |
| `(newButtonClick)` | `newSubCategory()` |
| `(editClick)` | `editSubCategory($event)` |
| `(deleteClick)` | `deleteClick($event.id)` |
| `(rowClick)` | `editSubCategory($event)` |

---

## API Calls

| Method | Endpoint | Delegated to |
|---|---|---|
| GET | `ItemSubCategories?$expand=category($select=id,name)` | `AgGridTableComponent` |
| POST | `ItemSubCategories` | `SubCategoryFormComponent` |
| PUT | `ItemSubCategories({id})` | `SubCategoryFormComponent` |
| DELETE | `ItemSubCategories/{id}` | `app-delete-entity` |

---

## Services Injected

| Service | Visibility | Methods used |
|---|---|---|
| `RolePermissionService` | `public` | `hasPermission()` |

---

## Enums / Models Used

| Name | Source | Usage |
|---|---|---|
| `ItemSubCategory` | `@shared/model/itemSubCategory` | Grid row model |
| `saveMode` | `@shared/enums/saveMode` | `POST` / `PUT` |
| `Permissions` | `@app/shared/enums/permissions` | `BASE_DATA_ITEM_SUBCATEGORY_CREATE`, `EDIT`, `DELETE` |
| `Localization` | `@shared/utilities/localization` | `Category`, `subCatagoryName`, `CreatedAt` |
| `AgGridBooleanCellRendererComponent` | `@shared/components/ag-grid-table/cell-renderers/` | `is_active` column |
