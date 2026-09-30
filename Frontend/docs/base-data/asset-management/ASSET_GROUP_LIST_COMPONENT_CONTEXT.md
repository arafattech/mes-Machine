# ASSET_GROUP_LIST_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| TSX file | `Frontend/src/app/modules/base-data-management/asset-management/asset-group/asset-group-list/asset-group-list.component.tsx` |
| HTML file | `Frontend/src/app/modules/base-data-management/asset-management/asset-group/asset-group-list/asset-group-list.component.html` |
| Selector | `app-asset-group-list` |
| Component type | List |
| Table component | `app-ag-grid-table` (`AgGridTableComponent`) |
| Purpose | Renders a paginated, filterable, sortable OData-backed AG Grid table of Asset Groups. Provides role-gated create, edit, and delete. Opens `AssetGroupFormComponent` dialog for create/edit; delegates delete to `app-delete-entity`. |

---

## Inputs (@Input)

No `@Input()` properties.

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `refreshTable` | `EventEmitter<void>` | Emitted after any successful mutation. |
| `IsDelete` | `EventEmitter<string>` | Emits OData path (e.g. `AssetGroups/5`) to `app-delete-entity`. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `agGridRef` | `AgGridTableComponent<AssetGroup>` | `@ViewChild` | Calls `refreshGridData()` after mutations. |
| `assetsFormRef` | `AssetGroupFormComponent` | `@ViewChild` | Controls form dialog open state and data. |
| `permissions` | `typeof Permissions` | `Permissions` | Exposes permissions enum to template. |
| `saveMode` | `string` | `saveMode.POST` | Tracks form mode. |
| `gridId` | `string` | `'base-data-asset-group-list'` | AG Grid state persistence key. |
| `columns` | `AgGridTableColumn<any>[]` | Built in constructor | Column definitions. |
| `dataSource` | `AgGridTableODataSourceConfig<AssetGroup>` | endpoint `AssetGroups`, searchFields `['name', 'custom_id']`, pageSize 40 | OData source config. |
| `toolbarConfig` | `AgGridTableToolbarConfig` | headerTitle "Assets Group List", showSearch, showRowCount, showSegmentButton, showNewButton gated on `BASE_DATA_ASSET_GROUP_CREATE` | Toolbar config. |
| `displayConfig` | `AgGridTableDisplayConfig` | `{ gridHeight: 'calc(100vh - 118px)' }` | Grid height. |

---

## ViewChild / ViewChildren

| Ref | Type | Purpose |
|---|---|---|
| `agGridRef` (`#agGridRef`) | `AgGridTableComponent<AssetGroup>` | `refreshGridData(true)` after mutations |
| `assetsFormRef` (`#assetsGroupForm`) | `AssetGroupFormComponent` | Opens dialog; calls `assetGroup.deserialize(data)` on edit |

---

## Methods

### `buildColumns(): AgGridTableColumn<any>[]`
Returns: `is_active` (boolean renderer), `custom_id`, `name`, `created_at` (date formatted).

### `processData(_event?): void`
Emits `refreshTable` + calls `agGridRef.refreshGridData(true)`.

### `newAssetGroup(): void`
Opens `assetsFormRef` in POST mode.

### `editAssetGroup(data): void`
Opens `assetsFormRef`, calls `assetsFormRef.assetGroup.deserialize(data)`, sets PUT mode.

### `deleteClick(id): void`
Emits `IsDelete` with `AssetGroups/${id}`.

---

## Template Structure

```
<div class="h-[calc(100vh-55px)]">
  <app-ag-grid-table #agGridRef ...>
<app-asset-group-form #assetsGroupForm ...>
<app-delete-entity ...>
```

### `app-ag-grid-table` key bindings

| Binding | Value |
|---|---|
| `[dataSource]` | OData: `AssetGroups` |
| `[showEditButton]` | `BASE_DATA_ASSET_GROUP_EDIT` |
| `[showDeleteButton]` | `BASE_DATA_ASSET_GROUP_DELETE` |
| `(newButtonClick)` | `newAssetGroup()` |
| `(editClick)` | `editAssetGroup($event)` |
| `(deleteClick)` | `deleteClick($event.id)` |
| `(rowClick)` | `editAssetGroup($event)` |

---

## API Calls

| Method | Endpoint | Delegated to |
|---|---|---|
| GET | `AssetGroups` | `AgGridTableComponent` |
| POST | `AssetGroups` | `AssetGroupFormComponent` |
| PUT | `AssetGroups({id})` | `AssetGroupFormComponent` |
| DELETE | `AssetGroups/{id}` | `app-delete-entity` |

---

## Services Injected

| Service | Visibility | Methods used |
|---|---|---|
| `RolePermissionService` | `public` | `hasPermission()` |

---

## Enums / Models Used

| Name | Source | Usage |
|---|---|---|
| `AssetGroup` | `@app/shared/model/assetGroup` | Grid row model |
| `saveMode` | `@shared/enums/saveMode` | `POST` / `PUT` |
| `Permissions` | `@app/shared/enums/permissions` | `BASE_DATA_ASSET_GROUP_CREATE`, `EDIT`, `DELETE` |
| `Localization` | `@app/shared/utilities/localization` | `Localization.CreatedAt` |
| `AgGridBooleanCellRendererComponent` | `@shared/components/ag-grid-table/cell-renderers/` | `is_active` column |
