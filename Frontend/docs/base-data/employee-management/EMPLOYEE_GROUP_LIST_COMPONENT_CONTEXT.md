# EMPLOYEE_GROUP_LIST_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| TS file | `Frontend/src/app/modules/base-data-management/employees-management/employee-group-list/employee-group-list.component.ts` |
| HTML file | `Frontend/src/app/modules/base-data-management/employees-management/employee-group-list/employee-group-list.component.html` |
| Selector | `app-employee-group-list` |
| Component type | List + Detail (split-pane master/detail layout) |
| Grid library | AG Grid (`app-ag-grid-table`) — OData server-side for both panes |

### Purpose

`EmployeeGroupListComponent` is a split-pane master/detail view for managing employee groups and their member employees. The left pane shows a paginated, filterable AG Grid of all employee groups. Clicking a group row loads the employees belonging to that group in the right pane.

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `IsDelete` | `EventEmitter<any>` | Emits to `app-delete-entity` to trigger deletion confirmation. |
| `refreshTable` | `EventEmitter<void>` | Emits after a group is saved (POST or PUT). |
| `refreshGroupEmployeeTable` | `EventEmitter<void>` | Declared for parent notification; not currently emitted. |

---

## Data Sources

### `groupDataSource: AgGridTableODataSourceConfig`

```typescript
{
  type: "odata",
  endpoint: "EmployeeGroups",
  pageSize: 50,
  sortBy: "custom_id",
  sortDirection: "desc",
  searchFields: ['name', 'custom_id'],
}
```

### `employeeDataSource: AgGridTableODataSourceConfig`

```typescript
{
  type: "odata",
  endpoint: "",              // empty until a group is selected
  expand: "department,designation,employeeType,employeeSection",
  pageSize: 50,
  filter: "",                // set to `group_id eq <id>` on row select
  searchFields: ['first_name', 'last_name', 'employee_no'],
}
```

`employeeDataSource` is spread-updated in `applyGroupSelection()` and `clearGroupSelection()` to set `endpoint` and `filter`.

---

## Toolbar / Display Configs

### `groupToolbarConfig: AgGridTableToolbarConfig`

```typescript
{
  headerTitle: GroupHeaderTitle,   // "Group List"
  showSearch: true,
  showRowCount: true,
  showNewButton: <permission guarded>,
  showDownload: false,
  showScanner: false,
  showSegmentButton: true,
  button1Text: "All",
  button2Text: "Inactive",
  button3Text: "Active",
}
```

### `employeeToolbarConfig: AgGridTableToolbarConfig`

```typescript
{
  headerTitle: "Employee",
  addButtonText: "Assign",
  showSearch: true,
  showRowCount: true,
  showNewButton: false,    // toggled true when a group is selected
  showDownload: false,
  showScanner: false,
  showExtraButton: false,        // toggled true when >=1 row selected
  extraButtonText: "Remove",     // becomes "Remove (N)" while rows are selected
  extraButtonDesign: "Negative",
  extraButtonDisable: true,
}
```

---

## Column Definitions

### `groupColumns: AgGridTableColumn<any>[]`

| Field / colId | Header | Notes |
|---|---|---|
| `is_active` | Active | `AgGridBooleanCellRendererComponent`; filter/sort/floatingFilter disabled |
| `custom_id` | Custom ID | `sort: "desc"` |
| `name` | Name | — |
| `is_permanent` | Permanent | `AgGridBooleanCellRendererComponent`; filter/sort/floatingFilter disabled |

### `employeeColumns: AgGridTableColumn<any>[]`

| Field | Header | Notes |
|---|---|---|
| `is_active` | Active | `AgGridBooleanCellRendererComponent`; filter/sort/floatingFilter disabled |
| `employee_no` | Employee ID | — |
| `first_name` | First Name | — |
| `last_name` | Last Name | — |
| `designation.name` | Designation | `valueGetter: params.data?.designation?.name ?? ''`; `sortable: false` |
| `department.name` | Department | `valueGetter: params.data?.department?.name ?? ''`; `sortable: false` |
| `employeeType.name` | Type | `valueGetter: params.data?.employeeType?.name ?? ''`; `sortable: false`. Header is just "Type" (not "Employee Type") per explicit instruction. |
| `employeeSection.name` | Section | `valueGetter: params.data?.employeeSection?.name ?? ''`; `sortable: false`. **Naming trap:** the `Employee` model's relation is `employeeSection`, NOT `section` — using `section` here would silently return nothing. |

`field: 'designation.name'` and `field: 'department.name'` use dot notation so the query builder converts them to OData navigation paths (`designation/any(...)`, `department/any(...)`) for column filtering. `employeeType.name`/`employeeSection.name` follow the same dot-notation pattern; all four nav-property columns depend on `employeeDataSource.expand: "department,designation,employeeType,employeeSection"` to have the related data available client-side.

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `employeeGroup` | `EmployeeGroup` | `new EmployeeGroup()` | Holds form data for create/edit dialog. |
| `isListCollapsed` | `boolean` | `false` | Hides right (employee) pane when `true`. |
| `isTabCollapsed` | `boolean` | `false` | Hides left (group list) pane when `true`. |
| `open` | `boolean` | `false` | Group create/edit dialog visibility. |
| `isopen` | `boolean` | `false` | `EmployeeGroupFormComponent` (assign dialog) visibility. |
| `loading` | `boolean` | `false` | Busy-indicator inside group form dialog. |
| `IsLoading` | `boolean` | `false` | Busy-indicator inside remove-employee dialog. |
| `isRemoveEmplyee` | `boolean` | `false` | Remove-employee confirmation dialog visibility. |
| `ToastType` | `"add" \| "edit" \| "error"` | `"add"` | Toast type after save. |
| `saveMode` | `string` | `saveMode.POST` | `POST` = create, `PUT` = edit. |
| `selectedGroupId` | `number \| null` | `null` | Currently selected group; drives `employeeDataSource.filter`. |
| `selectedEmployeeIds` | `number[]` | `[]` | IDs of employees currently checked (multi-select) in the employee grid. |
| `pendingRemoveEmployeeIds` | `number[]` | `[]` | ID(s) awaiting confirmation in the remove-employee dialog (single row or bulk). |
| `employeeShifts` | `EmployeeShift[]` | `[]` | Active shifts for the shift combobox in group form. |
| `selectedShiftName` | `string` | `""` | Display value bound to shift combobox. |
| `valueStateOptions` | `{ name: ValueState }` | `{ name: ValueState.None }` | Validation state for group name field. |
| `validationMessage` | `string` | `Localization.requiredField` | Shown in value-state slot when name fails validation. |

---

## ViewChild / ViewChildren

| Ref name | Type | Purpose |
|---|---|---|
| `employeegroupAssociate` | `EmployeeGroupFormComponent` | Receives `selectedGroupId`; `refreshTable.emit()` called after employee removal. |
| `groupTableRef` | `AgGridTableComponent<any>` | `refreshGridData(true)` called in `refreshGroupTable()`. |

---

## Lifecycle Hooks

### `constructor`
- Injects `CommonService`, `ToastService`, `RolePermissionService`.
- Calls `initEmployeeShifts()` to load active shifts for the form combobox.

---

## Methods

### `initEmployeeShifts()`
GET `EmployeeShifts?$filter=is_active eq true` (OData). Deserializes into `EmployeeShift[]`. Resolves `selectedShiftName` from current `employeeGroup.shift_id`.

### `getShiftName(shiftId)`
Finds shift by ID in `employeeShifts`; returns its `name` or `""`.

### `onShiftChange(event)`
Extracts `event.detail.item`; sets `employeeGroup.shift_id` and `selectedShiftName`.

### `onPermanentChange()`
If toggled to non-permanent, clears `shift_id` and `selectedShiftName`.

### `processData(data)`
Called from `(processData)` output of group grid. If rows exist, auto-selects first row via `applyGroupSelection(rows[0])`; else calls `clearGroupSelection()`.

### `selectedRowData(row)`
Called from `(rowClick)` of group grid. Calls `applyGroupSelection(row)` if `row.id` exists.

### `applyGroupSelection(group)`
Sets `selectedGroupId`, pushes to `employeegroupAssociate.selectedGroupId`, updates `employeeDataSource` with `endpoint: "Employees"` and `filter: "group_id eq <id>"`. Shows "Assign" button.

### `clearGroupSelection()`
Resets `selectedGroupId`, clears `employeeDataSource` endpoint/filter, hides "Assign" button and the "Remove" extra button.

### `onEmployeeSelectionChanged(rows)`
Bound to the employee grid's `(selectionChanged)` (grid uses `selectionMode="Multiple"`). Stores checked row IDs in `selectedEmployeeIds` and toggles/labels the toolbar "Remove (N)" extra button accordingly.

### `refreshEmployeeTable()`
Spread-updates `employeeDataSource` to re-trigger AG Grid data fetch (uses Angular change detection via object spread).

### `refreshGroupTable()`
`setTimeout(() => this.groupTableRef?.refreshGridData(true))`.

### `onRemoveFromGroup(data)`
Row-level delete action. Sets `pendingRemoveEmployeeIds = [data.id]`, opens remove confirmation dialog.

### `onBulkRemoveFromGroup()`
Bound to the toolbar's `(extraButtonClick)`. Copies `selectedEmployeeIds` into `pendingRemoveEmployeeIds`, opens remove confirmation dialog.

### `removeFromGroup()`
`forkJoin`s a `PUT Employees(<id>) { group_id: null }` per ID in `pendingRemoveEmployeeIds` (covers both single-row and bulk removal). On success: clears selection state, resets the extra button, refreshes assign-form table and employee grid.

### `onCLickListCollapsed()` / `onCLickTabCollapsed()`
Toggle `isListCollapsed` / `isTabCollapsed`.

### `checkValidation(event, field)`
Real-time validation; only `name` field handled.

### `validateForm(): boolean`
Guards `employeeGroup.name` non-empty.

### `editGroup(data)` / `newGroup()`
Populate/reset `employeeGroup`, set `saveMode`, open dialog.

### `newEmployee()`
Sets `isopen = true` to open `EmployeeGroupFormComponent`.

### `saveGroup()`
POST `EmployeeGroups` or PUT `EmployeeGroups(<id>)` with `employeeGroup.toOdata()`. On success: emits `refreshTable`, calls `refreshGroupTable()`, shows toast.

### `closeDialog()`
Resets `open`, `loading`, `employeeGroup`, `selectedShiftName`.

---

## API Calls

| HTTP | Endpoint | When | Payload |
|---|---|---|---|
| GET | `EmployeeShifts?$filter=is_active eq true` | Constructor | — |
| GET | `EmployeeGroups` (via AG Grid) | Group grid load | OData server-side |
| GET | `Employees?$filter=group_id eq <id>&$expand=department,designation` | Group row select | OData server-side |
| POST | `EmployeeGroups` | `saveGroup()` POST mode | `employeeGroup.toOdata()` |
| PUT | `EmployeeGroups(<id>)` | `saveGroup()` PUT mode | `employeeGroup.toOdata()` |
| PUT | `Employees(<id>)` (one call per selected employee, via `forkJoin`) | `removeFromGroup()` | `{ group_id: null }` |

---

## Validation

| Field | Rule | Trigger | Failure State |
|---|---|---|---|
| `employeeGroup.name` | Non-empty | `checkValidation` (real-time) + `validateForm()` (submit) | `ValueState.Negative` on input |

---

## Services Injected

| Service | Methods Used |
|---|---|
| `CommonService` | `get()`, `post()`, `put()` |
| `ToastService` | `show("add" \| "edit" \| "error")` |
| `RolePermissionService` | `hasPermission()` — guards New button visibility |

---

## Key Business Logic

- **searchFields** enable the toolbar search box. `groupDataSource` searches `name` and `custom_id`. `employeeDataSource` searches `first_name`, `last_name`, and `employee_no`.
- **Employee table guard:** `employeeDataSource.endpoint` is `""` until a group is selected — AG Grid makes no request when endpoint is empty.
- **Remove uses PUT:** Unlinking uses `PUT Employees(<id>) { group_id: null }` (not a dedicated disassociation endpoint).
- **Multi-select bulk remove:** Employee grid uses `selectionMode="Multiple"`; checking rows shows a "Remove (N)" toolbar button (`extraButtonClick` → `onBulkRemoveFromGroup()`) that removes all checked employees from the group in one confirmation, alongside the existing per-row delete icon.
- **Shift conditional:** Shift combobox shown only when `employeeGroup.is_permanent` is truthy; toggling off clears `shift_id`.
- **Auto-select first group:** `processData()` selects the first row on data load for immediate right-pane population.
- **Remove dialog close:** Uses `(ui5BeforeClose)="isRemoveEmplyee = false"` — does NOT call `closeDialog()` to avoid resetting the group form state.
- **Navigation column fields:** `designation.name` and `department.name` use dot-notation `field` (not `colId`) so AG Grid filter model entries get converted to OData navigation path queries by the query builder.
