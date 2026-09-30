# EMPLOYEE_LIST_COMPONENT — Component Context

## Overview

| Attribute | Value |
|---|---|
| TypeScript/TSX file | `Frontend/src/app/modules/base-data-management/employees-management/employee-list/employee-list.component.tsx` |
| HTML template | `Frontend/src/app/modules/base-data-management/employees-management/employee-list/employee-list.component.html` |
| Stylesheet | `employee-list.component.scss` |
| Selector | `app-employee-list` |
| Component type | List (with inline side-panel log) |

**Purpose:** Renders the full employee data table in the Base Data Management and HR Management modules. Manages employee creation, editing, deletion, bulk status changes, per-employee log viewing (payroll snapshot + activity audit trail), and Excel import/export. A collapsible side-panel shows an overview, billing, and activity log for the currently selected row. The panel's open/closed state is persisted across sessions via `localStorage`.

> **Grid migration (current state):** The data table now uses **`<app-ag-grid-table>`** (the AG Grid wrapper — see `AG_GRID_TABLE_CONTEXT.MD`). The old `<app-custom-grid-table>` block is **commented out** in the template but left in place for reference. Columns are now `AgGridTableColumn<any>[]` built by `buildColumns()`; the legacy `tableColum()` is commented out. See `AG_GRID_TABLE_CONTEXT.MD` for all grid `@Input`/`@Output` semantics.

---

## Inputs (@Input)

This component declares no `@Input` properties. All data originates internally or is passed downward to child components.

---

## Outputs (@Output)

| Output name | Event type | Purpose |
|---|---|---|
| `IsInsertXls` | `EventEmitter<void>` | Fires when the toolbar Upload button is clicked; consumed by `<excel-upload-download>` to open the import dialog |
| `IsExportXls` | `EventEmitter<void>` | Fires when the toolbar Download button is clicked; consumed by `<excel-upload-download>` to trigger the export |
| `refreshTable` | `EventEmitter<void>` | Fires after a successful save/delete to signal parent components that the table data should be refreshed |
| `IsDelete` | `EventEmitter<string>` | Emits a REST path string (e.g. `Employees/42`) received by the `<app-delete-entity>` child |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `EmployList` | `typeof Employee` | `Employee` (class reference) | Holds a reference to the Employee class (type reference in template context) |
| `EmployeeData` | `Employee` | `new Employee()` | Employee object passed as `[employeeData]` to `<app-employee-form>` |
| `EmployeeID` | `any` | `undefined` | Declared, not actively used |
| `columns` | `AgGridTableColumn<any>[]` | `buildColumns()` in constructor | Column definitions passed to `<app-ag-grid-table>` `[columns]` |
| `gridId` | `string` | `"employee-list"` | localStorage state-persistence key passed to `[gridId]` |
| `isDelete` | `boolean` | `false` | Declared, not actively used |
| `isLoading` | `boolean` | `false` | Declared, not actively used |
| `ToastType` | `string` | `""` | Declared, not actively used |
| `insertTitle` | `string` | i18n `"New"` | Add-new button label |
| `localization` | `typeof Localization` | `Localization` | Shared localization constant object |
| `headerTitle` | `string` | i18n `"Employee List"` | Header text. **Note:** `toolbarConfig.headerTitle` is the literal `"Employees"`, so this class property value is not actually displayed. |
| `dataSource` / `toolbarConfig` / `displayConfig` | config objects | see binding table | AG Grid config-object inputs (replace the old flat data/toolbar/display inputs). `showNewButton` permission resolved in the `toolbarConfig` field initializer. |
| `saveMode` | `string` | `saveMode.POST` | Form mode (`POST` new / `PUT` edit); passed to `<app-employee-form>` |
| `permissions` | `typeof Permissions` | `Permissions` | Permissions enum for template-level checks |
| `selectedEmployees` | `any[]` | `[]` | Full row objects of currently selected employees |
| `selectedEmployeeIds` | `number[]` | `[]` | `id` values extracted from `selectedEmployees` |
| `selectedEmployeeCount` | `number` | `0` | Count of selected employees; drives extra-action button label/visibility |
| `isBulkStatusDialogOpen` | `boolean` | `false` | Visibility of bulk-status `<ui5-dialog>` |
| `isBulkStatusLoading` | `boolean` | `false` | Busy indicator inside bulk status dialog |
| `bulkEmployeeStatus` | `boolean` | `true` | Target `is_active` value chosen in dialog; bound to `<ui5-switch>` |
| `showEmployeeLog` | `boolean` | restored from `localStorage` | Toggles the side-panel log column |
| `selectedEmployeeLogTab` | `"overview" \| "payroll" \| "activity"` | `"overview"` | Active tab in the log side-panel |
| `selectedEmployeeForLog` | `any \| null` | `null` | Full row object of the employee whose log is shown |
| `employeePayrollStatusInfo` | `any` | `null` | Response from `employePayrollStatus/{id}/{start}/{end}` |
| `employeeActivityLogs` | `ActivityLog[]` | `[]` | Most recent 5 activity log entries |
| `employeeLogDateRange` | `string` | formatted range | Human-readable range bound to `<ui5-daterange-picker>` |
| `employeeLogStart` | `string` | 1 month ago (ISO) | Start boundary for log query |
| `employeeLogEnd` | `string` | today end-of-day (ISO) | End boundary for log query |
| `employeeLogMaxDate` | `string` | today (`DD-MM-YYYY`) | Max date constraint for the picker |
| `isEmployeeLogExporting` | `boolean` | `false` | Disables Export button during PDF export |
| `isEmployeeLogLoading` | `boolean` | `false` | Skeleton loader gate in the log panel |
| `employeeLogError` | `string` | `""` | Error banner text when payroll fetch fails |
| `selectedRowIndexes` | `Record<number, boolean>` | `{}` | Row-index → selected map; passed to `[selectedRowsId]` |
| `DesignationLists` | `[]` | `[]` | Options for the Designation column `multiSelect` filter; from `GET Designations` |
| `DepartmentLists` | `[]` | `[]` | Options for the Department column `multiSelect` filter; from `GET Departments` |
| `employeeLogSwitchStorageKey` | `string` (private) | `"employee-list-show-employee-log"` | localStorage key for the log toggle |
| `employeeLogCache` | `Map<string, {...}>` (private) | empty Map | In-memory cache keyed by `"employeeId\|start\|end"` |
| `EmployeeLogCheck` | `string` (private) | `""` | Cache key of most recently initiated load; race-condition guard |
| `employeeLogLoaded` | `string` (private) | `""` | Cache key of last completed load; checked in `canExportEmployeeLog()` |

---

## ViewChild / ViewChildren

| Ref name | Type | Template variable | Purpose |
|---|---|---|---|
| `employeeForm` / `employeeFormRef` | `EmployeeFormComponent` | `#employeeForm` | Imperatively reset/populate/open the form for new/edit |
| `employeeAssetTableEdit` | `AnalyticalTableComponent` | — | Reserved; actual usage delegates to `employeeFormRef.employeeAssetTableEdit` |
| `childComponentRef` | `CustomGridTableComponent` | `#childComponentRef` | **Legacy.** Bound to the now-commented `<app-custom-grid-table>`, so it resolves to **`undefined`**. Calls use `?.` and are no-ops. |
| `agGridTable` | `AgGridTableComponent` | `#agGridTable` | The active AG Grid table. Used to call `refreshGridData(true)`, `clearSelection()` after mutations. |
| `selectedEmployeesTableRef` | `CustomGridTableComponent` | `#selectedEmployeesTableRef` | The `<app-custom-grid-table>` inside the bulk status dialog showing the selected employees list. Driven imperatively by `syncSelectedEmployeesTable()`. |

---

## Lifecycle Hooks

No explicit lifecycle hooks. All init runs in the **constructor**:

1. `this.columns = this.buildColumns()` — builds the initial AG Grid column array.
2. `this.initDepartements()` — `GET Departments`, populates `DepartmentLists`, then reassigns `this.columns = this.buildColumns()`.
3. `this.initDesignations()` — `GET Designations`, populates `DesignationLists`, then reassigns `this.columns = this.buildColumns()`.
4. `this.restoreEmployeeLogSwitchState()` — restore log-panel toggle from localStorage.
5. `this.initEmployeeLogDateRange()` — default date range = last full month up to today.

`initDepartements()`/`initDesignations()` both reassign `this.columns = this.buildColumns()` after the async response, so the `multiSelect` filter options for Designation/Department are populated once the data arrives.

---

## Methods — DETAILED

### `buildColumns(): AgGridTableColumn<any>[]` (private)
Builds and returns the AG Grid column definitions. Columns:

| Header (i18n) | field / colId | Notes |
|---|---|---|
| Active | `field: is_active` | `cellRenderer: AgGridBooleanCellRendererComponent`, `width:90`, `sortable/filter/floatingFilter: false` |
| Employee ID | `field: employee_no` | `minWidth:130`, `pinned: "left"` |
| First Name | `field: first_name` | `editor: {type:"text"}` |
| Last Name | `field: last_name` | `editor: {type:"text"}` |
| Email | `field: email` | `minWidth:220`, `editor: {type:"text"}` |
| Contact Number | `field: contact_number` | `editor: {type:"text"}` |
| Designation | `colId: designation.id` | `valueGetter` → `designation.name`; `filterControl: {type:"multiSelect", options: DesignationLists}` |
| Department | `colId: department.id` | `valueGetter` → `department.name`; `filterControl: {type:"multiSelect", options: DepartmentLists}` |
| Group | `colId: group.id` | `valueGetter` → `group.name` |
| Supervisor | `colId: supervisor.id` | `valueGetter` → `supervisor.first_name` |
| Total Salary | `field: salary.total_salary` | `type:"numericColumn"`, `filter:"agNumberColumnFilter"`, `valueGetter` → `salary.total_salary ?? 0` |
| Created On | `field: created_at` | `filter/floatingFilter: false`; `valueFormatter` → `new Intl.DateTimeFormat().format(...)` |

The legacy `tableColum()` (react-analytical-table style, with JSX `Cell` renderers and `GridTableColumnDataType`) is **commented out** in the source.

> **Inline cell editing:** `first_name`, `last_name`, `email`, `contact_number` are editable via `editor: {type:"text"}`. Commits flow through `(cellEdited)` → `onCellEdited()`.

---

### `initDepartements()`
`GET Departments` (OData). Maps `.value` → `{ value: name, text: name }` into `DepartmentLists`, then reassigns `this.columns = this.buildColumns()` so the Department multiSelect filter options populate.

### `initDesignations()`
Same pattern targeting `GET Designations` → `DesignationLists`, also reassigns `this.columns = this.buildColumns()`.

### `initEmployeeLogDateRange()`
Sets default range: `employeeLogStart` = 1 month ago start-of-day ISO; `employeeLogEnd` = today end-of-day ISO; `employeeLogMaxDate` = today `DD-MM-YYYY`; `employeeLogDateRange` = `"DD-MM-YYYY - DD-MM-YYYY"`.

### `restoreEmployeeLogSwitchState()` (private)
Reads localStorage key; `showEmployeeLog = (stored === "true")`. Any exception → `false`.

### `persistEmployeeLogSwitchState()` (private)
Writes `String(showEmployeeLog)` to the key. Failures swallowed.

### `onEmployeeLogSwitchChange(checked: boolean)`
Sets `showEmployeeLog`, persists, and (if open + employee selected) resets tab to `"overview"` and loads log data.

### `onEmployeeLogTabChange(tab)`
Sets `selectedEmployeeLogTab`. No fetch — tabs share loaded data.

### `onEmployeeLogDateRangeChange(event)`
Reads `event.detail.value`, splits on `" - "`, exits if a date missing. Converts to start/end-of-day ISO. Reloads log data if panel open + employee selected.

### `loadEmployeeLogData(employeeId)` (private)
Core log fetch orchestrator. Cache key `"employeeId|start|end"`. Cache hit → populate from cache, return. Miss → `GET employePayrollStatus/{id}/{DD-MM-YYYY}/{DD-MM-YYYY}` (non-OData), then nested `GET ActivityLogs?$expand=user&$filter=model_type eq 'App\Models\Employee' and model_id eq {id}&$orderby=created_at desc&$top=5` (OData). Writes cache on completion. Race guard: every callback discards its result if `EmployeeLogCheck !== cacheKey`.

### `getEmployeeLogCacheKey(employeeId)` (private)
Returns `"${employeeId}|${start}|${end}"`.

### `canExportEmployeeLog(): boolean`
`false` if: no selected id, no start/end, currently loading, already exporting, or `employeeLogLoaded !== current cacheKey`. Else `true`.

### `exportEmployeeLog()`
Guards with `canExportEmployeeLog()`. `POST employee-log/export-pdf` `{employee_id, start, end}` → Blob → programmatic `<a>` download `employee-log-{start}-to-{end}.pdf`.

### `onRowSelect(clickedEmployee: any)`
Bound to grid `(rowClick)` — receives a single `TData` object (the clicked row). Sets `selectedEmployeeForLog = clickedEmployee`. If the log panel is open and `clickedEmployee.id` is set, resets tab to `"overview"` and loads log data. **Does not** update `selectedEmployees` / `selectedEmployeeIds` / `selectedEmployeeCount` — that is handled by `onSelectionChanged`.

### `onSelectionChanged(rows: any[])`
Bound to grid `(selectionChanged)` — receives all currently selected rows as `TData[]`. Updates:
- `selectedEmployees = rows`
- `selectedEmployeeIds = rows.map(e => e.id)`
- `selectedEmployeeCount = rows.length`
- `selectedEmployeeForLog`: set to `rows[0]` if none selected yet, or updated when the current log employee is no longer in the selection.
- `toolbarConfig`: **spread-reassigned** (`{ ...toolbarConfig, showExtraButton, extraButtonText, extraButtonDisable }`) so Angular detects the change and the Action button appears/disappears reactively.

### `resetSelection()`
**Public.** Clears all component selection state (`clearSelectedEmployees()`), calls `agGridTable?.clearSelection()` (clears ag-grid checkboxes + `_persistedSelectionIds`), then syncs the selected-employees dialog table. Call after bulk work is done instead of relying on `updateSelectedEmployeesStatus()` to clean up.

### `isEmployeeLogTabSelected(tab)`
Returns `selectedEmployeeLogTab === tab`.

### `getSelectedEmployeeLogDisplayName()`
`"First Last (EMP001)"`; fallback `"Employee"` / `"Select an employee"`.

### `getSelectedEmployeePayrollLogSummary()`
12-item `{label, value}` array for the Billing tab, resolved from `employeePayrollStatusInfo` with multiple fallback paths per field. All through `formatMoneyValue()`.

### `getSelectedEmployeeOverviewSummary()`
8 items (Department, Designation, Status, Supervisor, Joined Date, Email, Phone, Salary) via individual getters.

### `getSelectedEmployeeLeaveStatusSummary()`
5 leave items from `leaveStatus`; Medical/Casual matched case-insensitively in `leaveTypes[]`. `leaveInYear`/`leaveInMonth` handle numeric or array.

### `getSelectedEmployeeActivityLogs()`
Maps `employeeActivityLogs` → `{title, subtitle}`. Title `"Created/Updated/Deleted - {model_custom_id|model_id|-}"`; subtitle `created_at` as `"DD-MM-YYYY hh:mm A"`.

### `formatMoneyValue(value)` (private)
`"-"` for null/undefined/`""`, else `String(value)`. Generic null-safe formatter.

### `getActivityLogActionLabel(actionType)` (private)
`"insert"`→`"Created"`, `"delete"`→`"Deleted"`, else `"Updated"`.

### Overview getters
`getSelectedEmployeeDepartment/Designation/Supervisor/Status/JoinedDate/Email/Phone/Salary()` — each reads `selectedEmployeeForLog` with fallbacks, default `"-"`.

### `handleEmployeeTableData(event)`
Bound to grid `(processData)`. Reads `event[0]` (visible rows). If no employee is selected for the log yet, and rows exist, and the log panel is open → sets `selectedEmployeeForLog = visibleRows[0]` and loads log data. No longer rebuilds `selectedRowIndexes` (ag-grid manages its own visual selection state).

### `columnFilter(event)`
Empty stub. (Not wired to the AG Grid table in the current template.)

### `activeInactiveFunction()`
Exits if `selectedEmployeeCount === 0`. Else defaults switch to Active and opens bulk status dialog.

### `updateSelectedEmployeesStatus()`
Exits (closes dialog) if no ids. `PUT employee/bulk-status-update` `{employee_ids, is_active}`. On success: toast, close, `clearSelectedEmployees()`, `agGridTable?.clearSelection()` (clears persisted selection IDs so they won't re-appear on next load), `agGridTable?.refreshGridData(true)`, `syncSelectedEmployeesTable()`. On error: toast, close.

### `closeBulkStatusDialog()`
Sets both dialog flags `false`.

### `newEmployee()`
Imperatively prepares + opens `employeeFormRef`: reset `EmployeeSalary`, `generateCode({model:"employees", field:"employee_no", length:1})`, `GetEmployees()`, tab `"coreData"`, fresh `Employee`, clear attachments, `open=true`, `resEmployeeId=null`, `assetSaveMode=POST`. Sets `saveMode=POST`.

### `editEmployee(data)`
Strips null/undefined from `data`, deserialises into form, deserialises `data.salary`. Opens form, sets edit/preview attachments, resolves shift/department/designation/type/section names, `saveMode=PUT`, loads image, supervisor name, `resEmployeeId`. Deferred `RefreshAssetTable` emit via `setTimeout(...,0)`.

> **Known quirk (pre-existing):** `sameAsPresentAddress = data.present_address === data.present_address` compares a value with itself → always `true`. Likely intended `present_address === permanent_address`.

### `processData(event)`
Post-mutation callback. Emits `refreshTable`, calls `this.agGridTable?.refreshGridData(true)` to hard-reload the grid. Called by `<app-delete-entity (isSuccess)>` and `<app-employee-form (RefreshTable)/(isSuccessChange)>`.

### `deleteClick(data)`
Emits `IsDelete` with `"Employees/${data.id}"`.

> ⚠️ **Bug:** template binds `(deleteClick)="deleteClick($event.id)"`, passing the numeric `id` as `data`. Then `data.id` is `undefined` → emits `"Employees/undefined"`. Either bind `deleteClick($event)` or change the method to `Employees/${data}`.

### `uploadButtonClick(event)` / `downloadButtonClick(event)`
Emit `IsInsertXls` / `IsExportXls`.

### `onCellEdited(event: AgGridTableCellEditEvent<Employee>)`
Bound to grid `(cellEdited)`. If `row.id` exists, `PUT Employees({id})` with `{ [event.field]: event.newValue }`. On success: toast `"edit"`. On error: toast `"error"` + `agGridTable?.refreshGridData(true)` to revert optimistic display.

---

## Template Bindings & Structure

Two-column CSS grid (`grid-cols-4` when log open, `grid-cols-1` when hidden).

### Left column — `<app-ag-grid-table #agGridTable>` (spans 3 cols when log visible)

Config-object API — `[dataSource]` / `[toolbarConfig]` / `[displayConfig]`; selection/state/action/illustrated stay flat.

| Binding | Value |
|---|---|
| `[columns]` | `columns` |
| `[dataSource]` | `dataSource` → `endpoint:'Employees'`, `expand:'media,assets,salary,department,supervisor,designation,employeeType,employeeSection,group'`, `searchFields:['employee_no','first_name','last_name','email','contact_number']`, `pageSize:50` |
| `[toolbarConfig]` | `toolbarConfig` → `headerTitle:'Employees'` (hardcoded literal, ≠ class `headerTitle`), `showSearch:true`, `showRowCount:true`, `showDownload:true`, `showSegmentButton:true`, `showNewButton: hasPermission(BASE_DATA_EMPLOYEE_ADD ‖ HR_EMPLOYEE_CREATE)` |
| `[displayConfig]` | `displayConfig` → `gridHeight:'calc(100vh - 118px)'` |
| `[isBase]` | `true` (flat) |
| `[gridId]` | `gridId` (`"employee-list"`, flat) |
| `selectionMode` | `"Multiple"` (flat) — triggers automatic checkbox column in ag-grid-table |
| `[selectionRowBehavior]` | `"'RowOnly'"` — only checkbox triggers selection, row click does not |
| `[showAction]` | `true` |
| `[editPermission]` | `true` |
| `[showEditButton]` | permission: `BASE_DATA_EMPLOYEE_UPDATE` or `HR_EMPLOYEE_EDIT` |
| `[showDeleteButton]` | permission: `BASE_DATA_EMPLOYEE_REMOVE` or `HR_EMPLOYEE_DELETE` |
| `[showIllustratedMessage]` | `true` |
| `(newButtonClick)` | `newEmployee()` |
| `(editClick)` | `editEmployee($event)` |
| `(deleteClick)` | `deleteClick($event.id)` (see bug note) |
| `(extraButtonClick)` | `activeInactiveFunction()` — opens bulk status dialog |
| `(rowClick)` | `onRowSelect($event)` — single clicked row for log sidebar |
| `(selectionChanged)` | `onSelectionChanged($event)` — all currently selected rows |
| `(downloadButtonClick)` | `downloadButtonClick($event)` |
| `(processData)` | `handleEmployeeTableData($event)` |
| `(cellEdited)` | `onCellEdited($event)` |

The **Action (N)** button visibility is driven reactively: `onSelectionChanged` spreads a new `toolbarConfig` object with `showExtraButton: rows.length > 0`, `extraButtonText: 'Action (N)'`, `extraButtonDisable: rows.length === 0`. Angular detects the reference change and shows/hides the button dynamically.

The toolbar **Report switch** (`[showSwitch]="true"`, `[switchLabel]="'Report'"`, `[selectedSwitchValue]="showEmployeeLog"`, `(onSwitchChange)="onEmployeeLogSwitchChange($event)"`) is wired directly on `<app-ag-grid-table>` and toggles the right-hand side-panel (`showEmployeeLog`, persisted to localStorage).

### Right column — `<ui5-card>` (Employee Report side-panel)
Visibility via CSS classes (`opacity-0 translate-x-3 max-w-0 pointer-events-none` hidden / `opacity-100 translate-x-0` shown). Always in DOM. Contains `<ui5-daterange-picker>` (bound to `employeeLogDateRange`, `maxDate`, `(change)`), an Export button gated by `canExportEmployeeLog()`, a red error banner `*ngIf="employeeLogError"`, and `*ngIf="selectedEmployeeForLog; else noEmployeeSelected"`. Inside: skeleton loader while `isEmployeeLogLoading`, else display name + `<ui5-segmented-button>` (Overview/Billing/Activity) + three conditionally-rendered `<ui5-card>` blocks.

### Child components

| Tag | Purpose |
|---|---|
| `<app-delete-entity>` | Delete confirmation dialog; `[IsDelete]` EventEmitter in, `(isSuccess)="processData($event)"` |
| `<app-employee-form #employeeForm>` | Create/edit form; `[saveMode]`, `[employeeData]`; `(RefreshTable)` + `(isSuccessChange)` → `processData()` |
| `<excel-upload-download>` | XLS import/export; `apiUrl='import/employees'`, `exportApiUrl='employees/export'`, `[IsInsertXls]`/`[IsExportXls]`, `[isv8]="true"`; `(isSuccessChange)="processData($event)"`. Import runs as a background job on `node-server` (BullMQ) — dialog closes immediately, live sync progress shown via a persistent toast (socket-driven), grid refresh (`isSuccessChange`) only fires once the job actually completes. See `EXCEL_IMPORT_EXPORT_CONTEXT.MD` "Async job import". |
| `<ui5-dialog>` | Bulk status dialog; `[open]="isBulkStatusDialogOpen"` with `<ui5-switch [(ngModel)]="bulkEmployeeStatus">` |

---

## API Calls

| HTTP Method | Endpoint | When called | Payload / Query | Response handling |
|---|---|---|---|---|
| GET | `Departments` | constructor → `initDepartements()` | OData | Maps `.value` → `{value,text}`; `this.columns = this.buildColumns()` |
| GET | `Designations` | constructor → `initDesignations()` | OData | Maps `.value` → `{value,text}`; `this.columns = this.buildColumns()` |
| GET | `employePayrollStatus/{id}/{DD-MM-YYYY}/{DD-MM-YYYY}` | log panel open + employee selected / date change | path params | Stores `employeePayrollStatusInfo`; triggers second call |
| GET | `ActivityLogs?$expand=user&$filter=model_type eq 'App\Models\Employee' and model_id eq {id}&$orderby=created_at desc&$top=5` | nested in payroll success | OData top 5 | Deserialise → `ActivityLog[]`; write cache |
| POST | `employee-log/export-pdf` | Export button + `canExportEmployeeLog()` true | `{employee_id, start, end}`, `responseType:"blob"` | Object URL → programmatic download |
| PUT | `employee/bulk-status-update` | Submit in bulk status dialog | `{employee_ids, is_active}` | Toast, clear selection, `agGridTable.clearSelection()`, `agGridTable.refreshGridData(true)` |
| PUT | `Employees({id})` | inline cell edit commit → `onCellEdited()` | `{ [field]: newValue }` | Toast `"edit"`; on error toast + reload |

Note: the main employee table data (`GET Employees`) is fetched and managed internally by `<app-ag-grid-table>` via `dataSource.endpoint` + `dataSource.expand` (OData Infinite Row Model), not directly by this component.

---

## Validation Logic

No form validation here (delegated to `<app-employee-form>`). Guard logic present:
- `activeInactiveFunction`: exits if `selectedEmployeeCount === 0`.
- `updateSelectedEmployeesStatus`: exits if no ids.
- `canExportEmployeeLog`: returns `false` under five conditions.
- `onEmployeeLogDateRangeChange`: exits if a parsed date missing.
- `loadEmployeeLogData`: discards async responses when `EmployeeLogCheck !== cacheKey`.
- `onCellEdited`: exits if `row.id` falsy.

---

## Services Injected

| Service | Access | Why | Methods used |
|---|---|---|---|
| `RolePermissionService` | `public` | Permission-gating toolbar/action buttons | `hasPermission(key): boolean` |
| `CommonService` | `private` | All direct HTTP | `get(url, isOdata)`, `post(url, body, isOdata, headers, responseType)`, `put(url, body, isOdata?)` |
| `ToastService` | `private` | Feedback after bulk update / cell edit | `show("edit")`, `show("error")` |

---

## Inter-component Communication

| Direction | Mechanism | Detail |
|---|---|---|
| List → Form | ViewChild (`employeeFormRef`) + direct mutation | `newEmployee()`/`editEmployee()` set props + call methods |
| Form → List | `(RefreshTable)`/`(isSuccessChange)` → `processData()` | Refresh after save |
| List → Delete | `@Output IsDelete` → `<app-delete-entity [IsDelete]>` | EventEmitter passed in; delete subscribes |
| Delete → List | `(isSuccess)` → `processData()` | Refresh after delete |
| List → Excel | `IsInsertXls`/`IsExportXls` → `<excel-upload-download>` | Trigger open/export |
| Excel → List | `(isSuccessChange)` → `processData()` | Refresh after import |
| Grid → List | `(rowClick)` → `onRowSelect()` | Selected row data for log panel |
| Grid → List | `(processData)` → `handleEmployeeTableData()` | Visible rows for selection reconciliation |
| Grid → List | `(cellEdited)` → `onCellEdited()` | Inline edit commit |
| List → Grid | `agGridTable.refreshGridData(true)` | Force reload after mutations |

---

## Enums / Models Used

| Name | Type | Source | Usage |
|---|---|---|---|
| `saveMode` | Enum | `@shared/enums/saveMode` | `POST` new / `PUT` edit |
| `Permissions` | Enum | `@app/shared/enums/permissions` | `BASE_DATA_EMPLOYEE_ADD/UPDATE/REMOVE/UPLOAD`, `HR_EMPLOYEE_CREATE/EDIT/DELETE/UPLOAD` |
| `Employee` | Class | `@shared/model/employee` | Employee data; `Deserializable` |
| `EmployeeSalary` | Class | `@app/modules/hr-management/shared/models/EmployeeSalary` | `total_salary`; resets/populates form salary |
| `ActivityLog` | Class | `@shared/model/activitylog` | From OData ActivityLogs |
| `Localization` | Const | `@app/shared/utilities/localization` | `CreatedAt`, `Submit`, `Cancel` |
| `AgGridTableColumn` | Type | `@app/shared/components/ag-grid-table/types/ag-grid-table.types` | Column definition type for `columns` |
| `AgGridTableCellEditEvent` | Type | same path | Payload type for `onCellEdited` |
| `AgGridTableComponent` | Class | `@app/shared/components/ag-grid-table/ag-grid-table.component` | `#agGridTable` ViewChild |
| `AgGridBooleanCellRendererComponent` | Class | `@app/shared/components/ag-grid-table/cell-renderers/...` | `is_active` cell renderer |
| `CustomGridTableComponent` | Class | `@app/shared/components/custom-grid-table/...` | **Legacy** `childComponentRef` (now `undefined`) |
| `GridTableColumnDataType` / `ColumnFilterType` | Enum | `@app/shared/components/custom-table/custom-table.component` | Imported; only referenced by the **commented-out** legacy `tableColum()` |

---

## Key Business Logic

### Grid migrated to AG Grid
The data table is `<app-ag-grid-table>` (OData Infinite Row Model). Columns are `AgGridTableColumn<any>[]` from `buildColumns()`. Designation/Department use in-header `multiSelect` filters; First/Last/Email/Contact are inline-editable (`editor:{type:"text"}`) committing via `onCellEdited()` → `PUT Employees({id})`. State persistence is on (`isBase=true`, `gridId="employee-list"`).

### Multi-row selection
`selectionMode="Multiple"` + `selectionRowBehavior="'RowOnly'"` → ag-grid-table auto-prepends a 50px checkbox column (pinned left). Row checkboxes survive filter/search/sort/cache-purge via `_persistedSelectionIds` inside the shared ag-grid-table component (re-selected per block in `successCallback`). Selecting rows triggers `onSelectionChanged` → `toolbarConfig` spreads `showExtraButton=true` → "Action (N)" button appears → `activeInactiveFunction()` → bulk dialog.

### Deactivation clears employee group (backend)
Setting `is_active` to `false` — via `bulk-status-update` from this component, or `EmployeeController::employeeBlacklist()` — nulls the employee's `group_id` server-side. Enforced centrally in `Employee::booted()`'s `updating` hook (`Backend/app/Models/Employee.php`): `if ($employee->isDirty('is_active') && !$employee->is_active) { $employee->group_id = null; }`. Fires on any `$employee->save()` path (single or bulk), so a deactivated employee always drops out of their group and must be re-assigned to a group after reactivation.

### Side-panel report (unchanged logic)
Two-phase nested fetch (payroll status → activity logs), in-memory cache keyed by `employeeId|start|end`, race-condition guard via `EmployeeLogCheck`, session-persistent toggle in localStorage. Panel header title reads "Employee Report"; toolbar toggle label reads "Report" (internal state/method names — `showEmployeeLog`, `onEmployeeLogSwitchChange`, etc. — are unchanged, only user-facing text was renamed).

### Known issues to be aware of (see inline ⚠️ notes)
1. `(deleteClick)="deleteClick($event.id)"` + `Employees/${data.id}` → `"Employees/undefined"`.
2. `editEmployee()` `sameAsPresentAddress` self-comparison (pre-existing).
