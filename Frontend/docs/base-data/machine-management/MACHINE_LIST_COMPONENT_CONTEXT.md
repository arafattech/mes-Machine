# MACHINE_LIST_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| TS file | `Frontend/src/app/modules/base-data-management/machine-management/machine-list/machine-management.component.ts` |
| HTML file | `Frontend/src/app/modules/base-data-management/machine-management/machine-list/machine-management.component.html` |
| Selector | `app-machine-management` |
| Component type | List + Master-Detail Layout |
| Table component | `app-ag-grid-table` (`AgGridTableComponent`) |
| Purpose | Two-panel split layout: left panel is an AG Grid of all machines (OData, with states/groups/halls expanded); right panel is `MachineFormComponent` for create/edit. Panels collapse/expand independently. `app-delete-entity` handles delete confirmations. |

---

## Inputs (@Input)

No `@Input()` properties.

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `refreshTable` | `EventEmitter<void>` | Emitted inside `processData()` to notify any parent listener of a data change. |
| `IsDelete` | `EventEmitter<string>` | Emits `Machines(${id})` to `app-delete-entity`. OData parentheses format required by the delete endpoint. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `agGridRef` | `AgGridTableComponent<Machine>` | `@ViewChild` | `refreshGridData(true)` after mutations. |
| `machineFormRef` | `MachineFormComponent` | `@ViewChild` | Imperatively controls all form state (no template bindings on the form element). |
| `permissions` | `typeof Permissions` | `Permissions` | Exposes permissions to the template for RBAC checks. |
| `isLoading` | `boolean` | `false` | Bound to the loading overlay `ui5-dialog` (currently never set to `true`). |
| `isListCollapsed` | `boolean` | `false` | Hides the left (grid) panel when `true`. |
| `isTabCollapsed` | `boolean` | `true` | Hides the right (form) panel when `true`. Form starts hidden. |
| `showPanelToggleIcons` | `boolean` | `false` | Shows collapse arrows only after a form operation starts. |
| `gridId` | `string` | `'base-data-machine-list'` | AG Grid column/filter/sort state persistence key. |
| `columns` | `AgGridTableColumn<any>[]` | Built in constructor | Column definitions. |
| `dataSource` | `AgGridTableODataSourceConfig<Machine>` | endpoint `Machines`, expand `states,machinegroups,machinehalls,machinewastagetypes`, searchFields `['machine_name','custom_id']`, pageSize 40, scrollPagination true | OData source. Expansion provides related data consumed by `editMachine()`. |
| `toolbarConfig` | `AgGridTableToolbarConfig` | headerTitle "Machine List", showSearch, showScanner, showRowCount, showSegmentButton, showNewButton gated on `BASE_DATA_MACHINE_CREATE` | Toolbar config. |

---

## ViewChild / ViewChildren

| Ref | Type | Purpose |
|---|---|---|
| `agGridRef` (`#agGridRef`) | `AgGridTableComponent<Machine>` | `refreshGridData(true)` after mutations |
| `machineFormRef` (`#machineForm`) | `MachineFormComponent` | Calls `resetForm()`, sets `machine`, `saveMode`, `SelectedGroup`, `machineTitleGroup`, `open`; calls `setMachineHall()`, `setMachineState()`, `LoadMachineGroup()` |

---

## Methods

### `buildColumns(): AgGridTableColumn<any>[]`
Returns: `is_active` (boolean renderer), `custom_id`, `machine_name`, `oee` (numeric), `created_at` (date formatted).

### `processData(_event?): void`
Emits `refreshTable` + calls `agGridRef?.refreshGridData(true)`.

### `newMachine(): void`
1. `isTabCollapsed = false`, `showPanelToggleIcons = true`.
2. `machineFormRef.resetForm()` — clears all form state including associate ref `bindingData` arrays.
3. `machineFormRef.machine = new Machine().deserialize({})`.
4. `machineFormRef.saveMode = saveMode.POST`.
5. `machineFormRef.open = true`.

### `editMachine(data: any): void`
1. `isTabCollapsed = false`, `showPanelToggleIcons = true`.
2. `machineFormRef.resetForm()`.
3. `machineFormRef.machine = new Machine().deserialize(data)`.
4. `machineFormRef.saveMode = saveMode.PUT`.
5. `machineFormRef.SelectedGroup = new MachineGroup().deserialize(data.machinegroups?.[0] ?? {})`.
6. `machineFormRef.machineTitleGroup = data.machinegroups?.[0]?.name ?? ''`.
7. `machineFormRef.setMachineHall(data.machinehalls ?? [])` — populates hall sub-grid.
8. `machineFormRef.setMachineState(data.states ?? [])` — populates state sub-grid.
9. `machineFormRef.setMachineWastageType(data.machinewastagetypes ?? [])` — populates wastage-type sub-grid.
10. `machineFormRef.LoadMachineGroup()` — refreshes group combobox.
11. `machineFormRef.open = true`.

> `data.machinehalls`, `data.states`, and `data.machinewastagetypes` are available without extra API calls because `dataSource.expand = 'states,machinegroups,machinehalls,machinewastagetypes'` includes them in every row.

### `handleRowSelect(row: any): void`
Called by `(rowClick)`. Sets `isTabCollapsed = false` and delegates to `editMachine(row)`.

### `deleteClick(id: any): void`
Emits `IsDelete` with `Machines(${id})` — OData parentheses notation required.

### `onCLickTabCollapsed() / onCLickListCollapsed()`: void
Toggle `isTabCollapsed` / `isListCollapsed`.

### `cancelEdit(): void`
Sets `isTabCollapsed = true`, `showPanelToggleIcons = false`. Bound to form's `(closeFrom)` output.

---

## Template Structure

```
<div class="relative grid gap-2" [ngClass]="grid-cols-1 or grid-cols-2">
  <div [class.hidden]="isListCollapsed">          ← LEFT PANEL
    <app-ag-grid-table #agGridRef ...>
    <div *ngIf="showPanelToggleIcons">            ← right-side collapse arrow
  </div>
  <div [class.hidden]="isTabCollapsed">           ← RIGHT PANEL
    <div *ngIf="showPanelToggleIcons">            ← left-side collapse arrow
    <app-machine-form #machineForm
      (closeFrom)="cancelEdit()"
      (isSuccessChange)="processData($event)"
      (RefreshTable)="processData($event)">
  </div>
</div>
<app-delete-entity [IsDelete]="IsDelete" (isSuccess)="processData($event)">
<ui5-dialog [open]="isLoading">   ← loading overlay (inactive)
```

> The `app-machine-form` element has **no `[saveMode]` or `[machine]` template bindings**. All form state is set imperatively via `machineFormRef` ViewChild calls in `newMachine()` and `editMachine()`.

### `app-ag-grid-table` key bindings

| Binding | Value |
|---|---|
| `[dataSource]` | OData: `Machines`, expand `states,machinegroups,machinehalls,machinewastagetypes` |
| `[showEditButton]` | `BASE_DATA_MACHINE_EDIT` |
| `[showDeleteButton]` | `BASE_DATA_MACHINE_DELETE` |
| `(newButtonClick)` | `newMachine()` |
| `(editClick)` | `editMachine($event)` |
| `(deleteClick)` | `deleteClick($event.id)` |
| `(rowClick)` | `handleRowSelect($event)` |

---

## API Calls

| Method | Endpoint | Delegated to |
|---|---|---|
| GET | `Machines?$expand=states,machinegroups,machinehalls,machinewastagetypes` | `AgGridTableComponent` |
| POST | `Machines` | `MachineFormComponent` |
| PUT | `Machines(${id})` | `MachineFormComponent` |
| DELETE | `Machines(${id})` | `app-delete-entity` |

---

## Services Injected

| Service | Visibility | Methods used |
|---|---|---|
| `RolePermissionService` | `public` | `hasPermission()` — toolbar new button + template edit/delete |

---

## Key Business Logic

### Split-Panel with Lazy Form
Form panel (`isTabCollapsed = true`) and toggle arrows (`showPanelToggleIcons = false`) are hidden until a New/Edit is initiated. `cancelEdit()` restores the full-width list view. `cancelEdit()` is triggered by the form's `(closeFrom)` output, which `CloseDialog()` emits after `resetForm()`.

### OData Expansion for Edit Population
`dataSource.expand = 'states,machinegroups,machinehalls,machinewastagetypes'` ensures every row carries related entity arrays. `editMachine()` uses `setMachineState()`, `setMachineHall()`, and `setMachineWastageType()` — public setters on `MachineFormComponent` — to push this data into the form's static sub-grids without any additional API calls.

### `handleRowSelect` vs `editClick`
Both `(rowClick)` → `handleRowSelect()` and `(editClick)` → `editMachine()` open the form. There is no difference in behavior — `handleRowSelect` simply sets `isTabCollapsed = false` and delegates to `editMachine`.

### Enums / Models Used

| Name | Source | Usage |
|---|---|---|
| `Machine` | `@shared/model/machine` | Grid row model; form binding |
| `MachineGroup` | `@shared/model/machineGroup` | Deserialized from `data.machinegroups[0]` in `editMachine()` |
| `saveMode` | `@shared/enums/saveMode` | `POST` / `PUT` |
| `Permissions` | `@app/shared/enums/permissions` | `BASE_DATA_MACHINE_CREATE`, `EDIT`, `DELETE` |
| `Localization` | `@app/shared/utilities/localization` | `Localization.CreatedAt` |
| `AgGridBooleanCellRendererComponent` | `@shared/components/ag-grid-table/cell-renderers/` | `is_active` column |
