# PLANT_LIST_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| TSX file | `Frontend/src/app/modules/base-data-management/plant-management/plant-list/planning-management.component.tsx` |
| HTML file | `Frontend/src/app/modules/base-data-management/plant-management/plant-list/planning-management.component.html` |
| Selector | `app-planning-management` |
| Component type | List |
| Table component | `app-ag-grid-table` (`AgGridTableComponent`) |
| Purpose | Renders a paginated, filterable OData-backed AG Grid table of Plants. Role-gated create, edit, delete. Delegates to `PlantFormComponent` dialog; delete to `app-delete-entity`. Note: selector/class name says "planning" — existing naming inconsistency, not a bug. |

---

## Inputs (@Input)

No `@Input()` properties.

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `refreshTable` | `EventEmitter<void>` | Emitted after any successful mutation. |
| `IsDelete` | `EventEmitter<string>` | Emits OData path (e.g. `Plants/5`) to `app-delete-entity`. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `agGridRef` | `AgGridTableComponent<Plant>` | `@ViewChild` | `refreshGridData()` after mutations. |
| `plantFormrtRef` | `PlantFormComponent` | `@ViewChild('plantForm')` | Opens form dialog. Note: typo in property name (`Formrt`) preserved from original. |
| `permissions` | `typeof Permissions` | `Permissions` | Exposes permissions to template. |
| `saveMode` | `string` | `saveMode.POST` | Form mode. |
| `plant` | `Plant` | `new Plant().deserialize({})` | Current form data, bound to `[plant]` input. |
| `gridId` | `string` | `'base-data-plant-list'` | AG Grid state persistence key. |
| `columns` | `AgGridTableColumn<any>[]` | Built in constructor | Column definitions. |
| `dataSource` | `AgGridTableODataSourceConfig<Plant>` | endpoint `Plants`, searchFields `['name', 'custom_id']`, pageSize 40 | OData source. |
| `toolbarConfig` | `AgGridTableToolbarConfig` | headerTitle "Plant List", showSearch, showRowCount, showSegmentButton, showNewButton gated on `BASE_DATA_PLANT_CREATE` | Toolbar config. |
| `displayConfig` | `AgGridTableDisplayConfig` | `{ gridHeight: 'calc(100vh - 118px)' }` | Grid height. |

---

## Methods

### `buildColumns(): AgGridTableColumn<any>[]`
Returns: `is_active` (boolean renderer), `custom_id`, `name` (headerName "Plant Name"), `created_at` (date formatted).

### `processData(_event?): void`
Emits `refreshTable` + calls `agGridRef.refreshGridData(true)`.

### `newPlant(): void`
Resets `plant`, opens form in POST mode.

### `editPlant(data): void`
Deserializes data into `plant`, opens form in PUT mode.

### `deleteClick(id): void`
Emits `IsDelete` with `Plants/${id}`.

---

## Template Structure

```
<div class="h-[calc(100vh-55px)]">
  <app-ag-grid-table #agGridRef ...>
<app-delete-entity (isSuccess)="processData($event)" [IsDelete]="IsDelete">
<app-plant-form #plantForm [saveMode]="saveMode" [plant]="plant" ...>
```

### `app-ag-grid-table` key bindings

| Binding | Value |
|---|---|
| `[dataSource]` | OData: `Plants` |
| `[showEditButton]` | `BASE_DATA_PLANT_EDIT` |
| `[showDeleteButton]` | `BASE_DATA_PLANT_DELETE` |
| `(newButtonClick)` | `newPlant()` |
| `(editClick)` | `editPlant($event)` |
| `(deleteClick)` | `deleteClick($event.id)` |
| `(rowClick)` | `editPlant($event)` |

---

## API Calls

| Method | Endpoint | Delegated to |
|---|---|---|
| GET | `Plants` | `AgGridTableComponent` |
| POST | `Plants` | `PlantFormComponent` |
| PUT | `Plants({id})` | `PlantFormComponent` |
| DELETE | `Plants/{id}` | `app-delete-entity` |

---

## Services Injected

| Service | Visibility | Methods used |
|---|---|---|
| `RolePermissionService` | `public` | `hasPermission()` |

---

## Enums / Models Used

| Name | Source | Usage |
|---|---|---|
| `Plant` | `@app/shared/model/plant` | Grid row model; form binding |
| `saveMode` | `@app/shared/enums/saveMode` | `POST` / `PUT` |
| `Permissions` | `@app/shared/enums/permissions` | `BASE_DATA_PLANT_CREATE`, `EDIT`, `DELETE` |
| `Localization` | `@app/shared/utilities/localization` | `Localization.CreatedAt` |
| `AgGridBooleanCellRendererComponent` | `@shared/components/ag-grid-table/cell-renderers/` | `is_active` column |
