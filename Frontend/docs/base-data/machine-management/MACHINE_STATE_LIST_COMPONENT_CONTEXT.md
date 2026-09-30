# MACHINE_STATE_LIST_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| TSX file | `Frontend/src/app/modules/base-data-management/machine-management/machine-state/machine-state-list/machine-state-list.component.tsx` |
| HTML file | `Frontend/src/app/modules/base-data-management/machine-management/machine-state/machine-state-list/machine-state-list.component.html` |
| Selector | `app-machine-state-list` |
| Component type | List |
| Table component | `app-ag-grid-table` (`AgGridTableComponent`) |
| Purpose | Renders the master list view for Machine States. OData-backed AG Grid table with role-gated create, edit, and delete. Coordinates `MachineStateFormComponent` dialog and delegates delete to `app-delete-entity`. |

---

## Inputs (@Input)

No `@Input()` properties.

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `IsDelete` | `EventEmitter<string>` | Emits OData path (e.g. `MachineStates/42`) to `app-delete-entity`. |
| `refreshTable` | `EventEmitter<void>` | Emitted after any successful mutation. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `agGridRef` | `AgGridTableComponent<MachineState>` | `@ViewChild` | `refreshGridData()` after mutations. |
| `machineStateFormRef` | `MachineStateFormComponent` | `@ViewChild` | Imperatively opens form dialog. |
| `permissions` | `typeof Permissions` | `Permissions` | Exposes permissions enum to template. |
| `saveMode` | `string` | `saveMode.POST` | Form mode. |
| `MachineState` | `MachineState` | `new MachineState().deserialize({})` | Current form data instance. |
| `gridId` | `string` | `'base-data-machine-state-list'` | AG Grid state persistence key. |
| `columns` | `AgGridTableColumn<any>[]` | Built in constructor | Column definitions. |
| `dataSource` | `AgGridTableODataSourceConfig<MachineState>` | endpoint `MachineStates`, searchFields `['name', 'custom_id']`, pageSize 40 | OData source config. |
| `toolbarConfig` | `AgGridTableToolbarConfig` | headerTitle "Machine State", showSearch, showRowCount, showSegmentButton, showNewButton gated on `BASE_DATA_MACHINE_STATE_CREATE` | Toolbar config. |
| `displayConfig` | `AgGridTableDisplayConfig` | `{ gridHeight: 'calc(100vh - 118px)' }` | Grid height. |

---

## ViewChild / ViewChildren

| Ref | Type | Purpose |
|---|---|---|
| `agGridRef` (`#agGridRef`) | `AgGridTableComponent<MachineState>` | `refreshGridData(true)` after mutations |
| `machineStateFormRef` (`#machineStateForm`) | `MachineStateFormComponent` | Sets `open = true`; form receives `[machineState]` and `[saveMode]` via bindings |

---

## Methods

### `buildColumns(): AgGridTableColumn<any>[]`
Returns: `is_active` (boolean renderer), `custom_id`, `name`, `created_at` (date formatted).

### `processData(_event?): void`
Emits `refreshTable` + calls `agGridRef.refreshGridData(true)`.

### `newMachineState(): void`
Resets `MachineState` to blank, opens form in POST mode.

### `editMachineState(data): void`
Deserializes `data` into `MachineState`, opens form in PUT mode.

### `deleteClick(id): void`
Emits `IsDelete` with `MachineStates/${id}`.

---

## Template Structure

```
<div class="h-[calc(100vh-55px)]">
  <app-ag-grid-table #agGridRef ...>
<app-delete-entity ...>
<app-machine-state-form #machineStateForm ...>
```

### `app-ag-grid-table` key bindings

| Binding | Value |
|---|---|
| `[dataSource]` | OData: `MachineStates` |
| `[showEditButton]` | `BASE_DATA_MACHINE_STATE_EDIT` |
| `[showDeleteButton]` | `BASE_DATA_MACHINE_STATE_DELETE` |
| `(newButtonClick)` | `newMachineState()` |
| `(editClick)` | `editMachineState($event)` |
| `(deleteClick)` | `deleteClick($event.id)` |
| `(rowClick)` | `editMachineState($event)` |

---

## API Calls

| Method | Endpoint | Delegated to |
|---|---|---|
| GET | `MachineStates` | `AgGridTableComponent` |
| POST | `MachineStates` | `MachineStateFormComponent` |
| PUT | `MachineStates({id})` | `MachineStateFormComponent` |
| DELETE | `MachineStates/{id}` | `app-delete-entity` |

---

## Services Injected

| Service | Visibility | Methods used |
|---|---|---|
| `RolePermissionService` | `public` | `hasPermission()` |

---

## Enums / Models Used

| Name | Source | Usage |
|---|---|---|
| `MachineState` | `@app/shared/model/machineState` | Form data model; `MachineState` property passed to `[machineState]` |
| `saveMode` | `@app/shared/enums/saveMode` | `POST` / `PUT` |
| `Permissions` | `@app/shared/enums/permissions` | `BASE_DATA_MACHINE_STATE_CREATE`, `EDIT`, `DELETE` |
| `Localization` | `@app/shared/utilities/localization` | `Localization.CreatedAt` |
| `AgGridBooleanCellRendererComponent` | `@shared/components/ag-grid-table/cell-renderers/` | `is_active` column |
