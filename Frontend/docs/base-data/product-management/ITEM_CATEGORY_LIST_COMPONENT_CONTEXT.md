# ITEM_CATEGORY_LIST_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| TSX file | `Frontend/src/app/modules/base-data-management/product-management/item-category/item-category-list/item-category-list.component.tsx` |
| HTML file | `Frontend/src/app/modules/base-data-management/product-management/item-category/item-category-list/item-category-list.component.html` |
| Selector | `app-item-category-list` |
| Component type | List |
| Table component | `app-ag-grid-table` (`AgGridTableComponent`) |
| Purpose | Renders a paginated, filterable, sortable OData-backed AG Grid table of Item Categories. Role-gated create, edit, delete. Delegates create/edit to `CategoryFormComponent` dialog; delete to `app-delete-entity`. |

---

## Inputs (@Input)

No `@Input()` properties.

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `refreshTable` | `EventEmitter<void>` | Emitted after any successful mutation. |
| `IsDelete` | `EventEmitter<string>` | Emits OData path (e.g. `ItemCategories/5`) to `app-delete-entity`. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `agGridRef` | `AgGridTableComponent<ItemCategory>` | `@ViewChild` | `refreshGridData()` after mutations. |
| `categoryFormRef` | `CategoryFormComponent` | `@ViewChild('categoryForm')` | Opens form dialog imperatively. |
| `permissions` | `typeof Permissions` | `Permissions` | Exposes permissions enum to template. |
| `saveMode` | `string` | `saveMode.POST` | Form mode. |
| `itemCategory` | `ItemCategory` | `new ItemCategory().deserialize({})` | Current form data, bound to `[itemCategory]` input. |
| `gridId` | `string` | `'base-data-item-category-list'` | AG Grid state persistence key. |
| `columns` | `AgGridTableColumn<any>[]` | Built in constructor | Column definitions. |
| `dataSource` | `AgGridTableODataSourceConfig<ItemCategory>` | endpoint `ItemCategories`, searchFields `['name', 'custom_id']`, pageSize 40 | OData source. |
| `toolbarConfig` | `AgGridTableToolbarConfig` | headerTitle "Item Category", showSearch, showRowCount, showSegmentButton, showNewButton gated on `BASE_DATA_ITEM_CATEGORY_CREATE` | Toolbar config. |
| `displayConfig` | `AgGridTableDisplayConfig` | `{ gridHeight: 'calc(100vh - 118px)' }` | Grid height. |

---

## Methods

### `buildColumns(): AgGridTableColumn<any>[]`
Returns: `is_active` (boolean renderer), `custom_id`, `name`, `prefix`, `created_at` (date formatted).

### `processData(_event?): void`
Emits `refreshTable` + calls `agGridRef.refreshGridData(true)`. Called by form's `(RefreshTable)` and delete entity's `(isSuccess)`.

### `newCategory(): void`
Resets `itemCategory`, opens form in POST mode.

### `editCatogry(data): void`
Sets `itemCategory = data`, opens form in PUT mode. (Note: typo in method name preserved from original.)

### `deleteClick(id): void`
Emits `IsDelete` with `ItemCategories/${id}`.

---

## Template Structure

```
<div class="h-[calc(100vh-55px)]">
  <app-ag-grid-table #agGridRef ...>
<app-category-form #categoryForm [saveMode]="saveMode" [itemCategory]="itemCategory" ...>
<app-delete-entity [IsDelete]="IsDelete" (isSuccess)="processData($event)">
```

### `app-ag-grid-table` key bindings

| Binding | Value |
|---|---|
| `[dataSource]` | OData: `ItemCategories` |
| `[showEditButton]` | `BASE_DATA_ITEM_CATEGORY_EDIT` |
| `[showDeleteButton]` | `BASE_DATA_ITEM_CATEGORY_DELETE` |
| `(newButtonClick)` | `newCategory()` |
| `(editClick)` | `editCatogry($event)` |
| `(deleteClick)` | `deleteClick($event.id)` |
| `(rowClick)` | `editCatogry($event)` |

---

## API Calls

| Method | Endpoint | Delegated to |
|---|---|---|
| GET | `ItemCategories` | `AgGridTableComponent` |
| POST | `ItemCategories` | `CategoryFormComponent` |
| PUT | `ItemCategories({id})` | `CategoryFormComponent` |
| DELETE | `ItemCategories/{id}` | `app-delete-entity` |

---

## Services Injected

| Service | Visibility | Methods used |
|---|---|---|
| `RolePermissionService` | `public` | `hasPermission()` |

---

## Model: `ItemCategory`
Path: `src/app/shared/model/itemCategory.ts`

| Field | Type | Notes |
|---|---|---|
| `id` | `number?` | Primary key |
| `is_active` | `boolean` | Rendered as accept/decline icon |
| `name` | `string` | Required; display name |
| `prefix` | `string` | Optional; column hidden by default |
| `custom_id` | `string?` | Human-readable ID |
| `created_at` | `string?` | ISO date; formatted via `toLocaleDateString()` |

---

## Enums / Models Used

| Name | Source | Usage |
|---|---|---|
| `ItemCategory` | `@app/shared/model/itemCategory` | Grid row model; form binding |
| `saveMode` | `@app/shared/enums/saveMode` | `POST` / `PUT` |
| `Permissions` | `@app/shared/enums/permissions` | `BASE_DATA_ITEM_CATEGORY_CREATE`, `EDIT`, `DELETE` |
| `Localization` | `@app/shared/utilities/localization` | `Localization.CreatedAt` |
| `AgGridBooleanCellRendererComponent` | `@shared/components/ag-grid-table/cell-renderers/` | `is_active` column |
