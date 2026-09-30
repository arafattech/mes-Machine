# STORAGE_LOCATION_LIST_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| TSX file | `Frontend/src/app/modules/base-data-management/storage-management/storage-location/location-list/location-list.component.tsx` |
| HTML file | `Frontend/src/app/modules/base-data-management/storage-management/storage-location/location-list/location-list.component.html` |
| Selector | `app-location-list` |
| Component type | List |
| Table component | `app-ag-grid-table` (`AgGridTableComponent`) |
| Purpose | Renders a paginated, filterable OData-backed AG Grid table of Storage Locations. Role-gated create, edit, delete. Create/edit delegates to `StorageLocationFormComponent` (saveMode and storageLocation set imperatively on form ref); delete to `app-delete-entity`. |

---

## Inputs (@Input)

No `@Input()` properties.

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `refreshTable` | `EventEmitter<void>` | Emitted after any successful mutation. |
| `IsDelete` | `EventEmitter<string>` | Emits OData path (e.g. `StorageLocations/5`) to `app-delete-entity`. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `agGridRef` | `AgGridTableComponent<StorageLocation>` | `@ViewChild` | `refreshGridData()` after mutations. |
| `storageLocationFormRef` | `StorageLocationFormComponent` | `@ViewChild` | Opens form; sets `open`, `saveMode`, `storageLocation` imperatively. |
| `Permissions` | `typeof Permissions` | `Permissions` | Exposed to template for `[showEditButton]`/`[showDeleteButton]` bindings. |
| `saveMode` | `string` | `saveMode.POST` | Component-level form mode tracking. |
| `gridId` | `string` | `'base-data-storage-location-list'` | AG Grid state persistence key. |
| `columns` | `AgGridTableColumn<any>[]` | Built in constructor | Column definitions. |
| `dataSource` | `AgGridTableODataSourceConfig<StorageLocation>` | endpoint `StorageLocations`, searchFields `['name', 'custom_id']`, pageSize 40 | OData source. |
| `toolbarConfig` | `AgGridTableToolbarConfig` | headerTitle "Location List", showSearch, showRowCount, showSegmentButton, showNewButton gated on `BASE_DATA_STORAGE_LOCATION_CREATE` | Toolbar config. |
| `displayConfig` | `AgGridTableDisplayConfig` | `{ gridHeight: 'calc(100vh - 118px)' }` | Grid height. |

---

## Key Design Note

`StorageLocationFormComponent` does NOT have Angular `@Input` bindings for `saveMode` or `storageLocation` — these are set directly on the ViewChild reference (`storageLocationFormRef.saveMode`, `storageLocationFormRef.storageLocation`).

The `Permissions` property is capitalized (matches original) and exposed as `public` for use in `[showEditButton]`/`[showDeleteButton]` template bindings.

---

## Methods

### `buildColumns(): AgGridTableColumn<any>[]`
Returns: `is_active` (boolean renderer), `custom_id`, `name` ("Location Name"), `created_at` (date formatted).

### `processData(_event?): void`
Emits `refreshTable` + calls `agGridRef.refreshGridData(true)`. Called by form's `(RefreshTable)` and delete entity's `(isSuccess)`.

### `newLocation(): void`
Opens form, sets `storageLocationFormRef.saveMode = POST`.

### `editLocation(data): void`
Opens form, sets `storageLocationFormRef.storageLocation = data`, sets `storageLocationFormRef.saveMode = PUT`.

### `deleteClick(id): void`
Emits `IsDelete` with `StorageLocations/${id}`.

---

## Template Structure

```
<div class="h-[calc(100vh-55px)]">
  <app-ag-grid-table #agGridRef ...>
<app-delete-entity ...>
<app-storage-location-form #storageLocationForm (RefreshTable)="processData($event)">
```

### `app-ag-grid-table` key bindings

| Binding | Value |
|---|---|
| `[dataSource]` | OData: `StorageLocations` |
| `[showEditButton]` | `Permissions.BASE_DATA_STORAGE_LOCATION_EDIT` |
| `[showDeleteButton]` | `Permissions.BASE_DATA_STORAGE_LOCATION_DELETE` |
| `(newButtonClick)` | `newLocation()` |
| `(editClick)` | `editLocation($event)` |
| `(deleteClick)` | `deleteClick($event.id)` |
| `(rowClick)` | `editLocation($event)` |

---

## API Calls

| Method | Endpoint | Delegated to |
|---|---|---|
| GET | `StorageLocations` | `AgGridTableComponent` |
| POST | `StorageLocations` | `StorageLocationFormComponent` |
| PUT | `StorageLocations({id})` | `StorageLocationFormComponent` |
| DELETE | `StorageLocations/{id}` | `app-delete-entity` |

---

## Services Injected

| Service | Visibility | Methods used |
|---|---|---|
| `RolePermissionService` | `public` | `hasPermission()` |

---

## Enums / Models Used

| Name | Source | Usage |
|---|---|---|
| `StorageLocation` | `@app/shared/model/storage_location` | Grid row model |
| `saveMode` | `@app/shared/enums/saveMode` | Set imperatively on form ref |
| `Permissions` | `@app/shared/enums/permissions` | `BASE_DATA_STORAGE_LOCATION_CREATE`, `EDIT`, `DELETE` |
| `Localization` | `@app/shared/utilities/localization` | `Localization.CreatedAt` |
| `AgGridBooleanCellRendererComponent` | `@shared/components/ag-grid-table/cell-renderers/` | `is_active` column |
