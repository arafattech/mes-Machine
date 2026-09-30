# MACHINE_GROUP_LIST_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| TSX file | `Frontend/src/app/modules/base-data-management/machine-management/machine-group/machine-group-list/machine-group-list.component.tsx` |
| HTML file | `Frontend/src/app/modules/base-data-management/machine-management/machine-group/machine-group-list/machine-group-list.component.html` |
| Selector | `app-machine-group-list` |
| Component type | List |
| Table component | `app-ag-grid-table` (`AgGridTableComponent`) |
| Purpose | Renders a paginated, filterable, sortable OData AG Grid table of Machine Groups. Role-gated create, edit, and delete. Coordinates `MachineGroupFormComponent` dialog and delegates delete to `app-delete-entity`. |

---

## Inputs (@Input)

No `@Input()` properties.

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `IsDelete` | `EventEmitter<string>` | Emits OData path (e.g. `MachineGroups/5`) to `app-delete-entity`. |
| `refreshTable` | `EventEmitter<void>` | Emitted after any successful mutation. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `agGridRef` | `AgGridTableComponent<MachineGroup>` | `@ViewChild` | `refreshGridData()` after mutations. |
| `machineGroupFormRef` | `MachineGroupFormComponent` | `@ViewChild` | Opens form dialog. |
| `permissions` | `typeof Permissions` | `Permissions` | Exposes permissions enum to template. |
| `saveMode` | `string` | `saveMode.POST` | Form mode. |
| `machineGroup` | `MachineGroup` | `new MachineGroup().deserialize({})` | Current group data passed to form. |
| `gridId` | `string` | `'base-data-machine-group-list'` | AG Grid state persistence key. |
| `columns` | `AgGridTableColumn<any>[]` | Built in constructor | Column definitions. |
| `dataSource` | `AgGridTableODataSourceConfig<MachineGroup>` | endpoint `MachineGroups`, searchFields `['name', 'custom_id']`, pageSize 40 | OData source config. |
| `toolbarConfig` | `AgGridTableToolbarConfig` | headerTitle "Machine Group", showSearch, showRowCount, showSegmentButton, `showNewButton: true` | Toolbar config. Note: `showNewButton` is hardcoded `true` to match original behaviour. |
| `displayConfig` | `AgGridTableDisplayConfig` | `{ gridHeight: 'calc(100vh - 118px)' }` | Grid height. |

---

## ViewChild / ViewChildren

| Ref | Type | Purpose |
|---|---|---|
| `agGridRef` (`#agGridRef`) | `AgGridTableComponent<MachineGroup>` | `refreshGridData(true)` after mutations |
| `machineGroupFormRef` (`#machineGroupForm`) | `MachineGroupFormComponent` | Sets `open = true`; receives `[machineGroup]` and `[saveMode]` via bindings |

---

## Methods

### `buildColumns(): AgGridTableColumn<any>[]`
Returns: `is_active` (boolean renderer), `custom_id`, `name` (Group Name), `created_at` (date formatted).

### `processData(_event?): void`
Emits `refreshTable` + calls `agGridRef.refreshGridData(true)`.

### `newMachineGroup(): void`
Resets `machineGroup` to blank, opens form in POST mode.

### `editMachineGroup(data): void`
Deserializes `data` into `machineGroup`, opens form in PUT mode.

### `deleteClick(id): void`
Emits `IsDelete` with `MachineGroups/${id}`.

---

## Template Structure

```
<div class="h-[calc(100vh-55px)]">
  <app-ag-grid-table #agGridRef ...>
<app-machine-group-form #machineGroupForm ...>
<app-delete-entity ...>
```

### `app-ag-grid-table` key bindings

| Binding | Value |
|---|---|
| `[dataSource]` | OData: `MachineGroups` |
| `[showEditButton]` | `BASE_DATA_MACHINE_GROUP_EDIT` |
| `[showDeleteButton]` | `BASE_DATA_MACHINE_GROUP_DELETE` |
| `(newButtonClick)` | `newMachineGroup()` |
| `(editClick)` | `editMachineGroup($event)` |
| `(deleteClick)` | `deleteClick($event.id)` |
| `(rowClick)` | `editMachineGroup($event)` |

---

## API Calls

| Method | Endpoint | Delegated to |
|---|---|---|
| GET | `MachineGroups` | `AgGridTableComponent` |
| POST | `MachineGroups` | `MachineGroupFormComponent` |
| PUT | `MachineGroups({id})` | `MachineGroupFormComponent` |
| DELETE | `MachineGroups/{id}` | `app-delete-entity` |

---

## Services Injected

| Service | Visibility | Methods used |
|---|---|---|
| `RolePermissionService` | `public` | `hasPermission()` — template edit/delete bindings |

---

## Enums / Models Used

| Name | Source | Usage |
|---|---|---|
| `MachineGroup` | `@app/shared/model/machineGroup` | Grid row model; form data |
| `saveMode` | `@shared/enums/saveMode` | `POST` / `PUT` |
| `Permissions` | `@app/shared/enums/permissions` | `BASE_DATA_MACHINE_GROUP_EDIT`, `DELETE` |
| `Localization` | `@app/shared/utilities/localization` | `Localization.CreatedAt` |
| `AgGridBooleanCellRendererComponent` | `@shared/components/ag-grid-table/cell-renderers/` | `is_active` column |
