# ASSET_LIST_COMPONENT — Component Context

---

## Overview

| Field | Value |
|---|---|
| TSX file | `Frontend/src/app/modules/base-data-management/asset-management/asset-list/asset-list.component.tsx` |
| HTML file | `Frontend/src/app/modules/base-data-management/asset-management/asset-list/asset-list.component.html` |
| Selector | `app-asset-list` |
| Component type | List (master list with inline form and delete dialog) |
| Table component | `app-ag-grid-table` (`AgGridTableComponent`) |
| Purpose | Displays a paginated, filterable, sortable OData table of all Asset records via AG Grid. Provides role-gated create, edit, and delete actions. Create/edit is delegated to the embedded `AssetFormComponent` dialog; delete is delegated to a shared `app-delete-entity` dialog. |

---

## Inputs (@Input)

This component defines **no `@Input()` properties**.

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `refreshTable` | `EventEmitter<void>` | Emitted after a successful create, edit, or delete. |
| `IsDelete` | `EventEmitter<string>` | Emits the OData resource path (e.g. `Assets/42`) when delete is triggered. Passed to `app-delete-entity`. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `agGridRef` | `AgGridTableComponent<Asset>` | `@ViewChild` | Direct reference to the AG Grid table. Used to call `refreshGridData()`. |
| `assetsFormRef` | `AssetFormComponent` | `@ViewChild` | Reference to the embedded asset form dialog. |
| `saveMode` | `string` | `saveMode.POST` | Tracks form operation mode (`POST` or `PUT`). |
| `permissions` | `typeof Permissions` | `Permissions` | Exposes the `Permissions` enum to the template. |
| `gridId` | `string` | `'base-data-asset-list'` | Unique ID for AG Grid column state persistence. |
| `columns` | `AgGridTableColumn<any>[]` | Built in constructor | Column definitions for AG Grid. |
| `dataSource` | `AgGridTableODataSourceConfig<Asset>` | See below | OData source config: endpoint `Assets`, expand `employeeHasAssets($expand=employee)`, searchFields `['name', 'custom_id']`, pageSize 40. |
| `toolbarConfig` | `AgGridTableToolbarConfig` | See below | Toolbar: headerTitle "Assets List", showSearch, showRowCount, showSegmentButton, addButtonText "New", showNewButton gated on `BASE_DATA_ASSET_CREATE`. |
| `displayConfig` | `AgGridTableDisplayConfig` | `{ gridHeight: 'calc(100vh - 118px)' }` | Grid height config. |

---

## ViewChild / ViewChildren

| Ref name | Type | Purpose |
|---|---|---|
| `agGridRef` (`#agGridRef`) | `AgGridTableComponent<Asset>` | Calls `refreshGridData(true)` after mutations. |
| `assetsFormRef` (`#assetsForm`) | `AssetFormComponent` | Imperatively sets `asset` and `open` to control the form dialog. |

---

## Methods

### `buildColumns(): AgGridTableColumn<any>[]`
Returns column definitions: `is_active` (boolean renderer), `custom_id`, `name` (Asset Name), `created_at` (date formatted).

### `processData(_event?): void`
Emits `refreshTable` and calls `agGridRef.refreshGridData(true)`. Called by form's `(RefreshTable)` and delete dialog's `(isSuccess)`.

### `newAsset(): void`
Sets `saveMode = POST`, opens `assetsFormRef`.

### `editAsset(data): void`
Sets `saveMode = PUT`, assigns `assetsFormRef.asset = data`, opens form.

### `deleteClick(id): void`
Emits `IsDelete` with `Assets/${id}`.

---

## Template Structure

```
<div class="h-[calc(100vh-55px)]">
  <app-ag-grid-table #agGridRef ...>   ← main grid
  </app-ag-grid-table>
</div>
<app-asset-form #assetsForm ...>        ← create/edit dialog
<app-delete-entity ...>                 ← delete confirmation
```

### `app-ag-grid-table` key bindings

| Binding | Value |
|---|---|
| `[columns]` | `columns` |
| `[dataSource]` | `dataSource` (OData: `Assets`, expand employee) |
| `[toolbarConfig]` | `toolbarConfig` |
| `[displayConfig]` | `displayConfig` |
| `selectionMode` | `Single` |
| `[isBase]` | `true` |
| `[gridId]` | `gridId` |
| `[showAction]` | `true` |
| `[showEditButton]` | `BASE_DATA_ASSET_EDIT` permission |
| `[showDeleteButton]` | `BASE_DATA_ASSET_DELETE` permission |
| `(newButtonClick)` | `newAsset()` |
| `(editClick)` | `editAsset($event)` |
| `(deleteClick)` | `deleteClick($event.id)` |
| `(rowClick)` | `editAsset($event)` |
| `[showIllustratedMessage]` | `true` |

---

## API Calls

| Method | Endpoint | Delegated to |
|---|---|---|
| GET | `Assets?$expand=employeeHasAssets($expand=employee)` | `AgGridTableComponent` (OData infinite scroll) |
| POST | `Assets` | `AssetFormComponent` |
| PUT | `Assets({id})` | `AssetFormComponent` |
| DELETE | `Assets/{id}` | `app-delete-entity` |

---

## Services Injected

| Service | Visibility | Methods used |
|---|---|---|
| `RolePermissionService` | `public` | `hasPermission()` — toolbar new button + template edit/delete bindings |

---

## Enums / Models Used

| Name | Source | Usage |
|---|---|---|
| `Asset` | `@app/shared/model/asset` | Data model for grid rows |
| `saveMode` | `@shared/enums/saveMode` | Form mode control |
| `Permissions` | `@app/shared/enums/permissions` | `BASE_DATA_ASSET_CREATE`, `EDIT`, `DELETE` |
| `Localization` | `@app/shared/utilities/localization` | `Localization.CreatedAt` column header |
| `AgGridBooleanCellRendererComponent` | `@shared/components/ag-grid-table/cell-renderers/` | Renders `is_active` as accept/decline icon |
