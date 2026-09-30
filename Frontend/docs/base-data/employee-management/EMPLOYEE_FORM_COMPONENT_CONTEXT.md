# EMPLOYEE_FORM_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| **TSX file** | `src/app/modules/base-data-management/employees-management/employee-form/employee-form.component.tsx` |
| **HTML file** | `src/app/modules/base-data-management/employees-management/employee-form/employee-form.component.html` |
| **SCSS file** | `src/app/modules/base-data-management/employees-management/employee-form/employee-form.component.scss` |
| **Selector** | `app-employee-form` |
| **Component type** | Form / Dialog |
| **Implements** | `OnInit` |

**Purpose:** A modal dialog form for creating and editing employee records. It is a multi-tab UI5 dialog covering Core Data, Personal Data, Salary, Bank information, Asset assignments, Leave summary (edit mode only), and Attachments. In POST mode it collects data locally and persists everything in a single coordinated save. In PUT mode it loads live data from the server, allows direct API updates to sub-entities (bank info, assets), and renders the Leave summary tab.

---

## Inputs (@Input)

| Input name | Type | Default | Purpose |
|---|---|---|---|
| `saveMode` | `string` (`"POST"` \| `"PUT"`) | `"POST"` | Controls whether the form is in create or edit mode. Drives API URL selection, tab visibility (Leave tab is PUT-only), and sub-entity persistence strategy (local list vs. direct API call). |
| `employee` | `Employee` | `new Employee()` | The employee record being created or edited. Two-way data flows via `[(ngModel)]` bindings in the template. |

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `IsOpenToastAlert` | `EventEmitter<void>` | Declared but not explicitly emitted in the visible code; reserved for toast alert notification to parent. |
| `isOpenAssetAssociate` | `EventEmitter<void>` | Reserved for signalling the parent to open an asset associate panel. |
| `RefreshTable` | `EventEmitter<any>` | Emitted after a successful employee save, salary save, or bulk asset/bank POST to trigger the parent list table to reload. |
| `RefreshAssetTable` | `EventEmitter<any>` | Emitted after a successful asset add/update/delete in PUT mode to reload the asset table. |
| `RefreshBankTable` | `EventEmitter<any>` | Passed as `[refreshTrigger]` to the static bank table in POST mode. |
| `isPlantAssosiate` | `EventEmitter<void>` | Reserved for parent-level plant association workflow. |
| `SelectedAssets` | `EventEmitter<any>` | Reserved for bubbling selected asset data up to the parent. |
| `IsDelete` | `EventEmitter<string>` | Emits an OData entity path string (e.g. `"EmployeeBankInfos(5)"` or `"EmployeeHasAssets/12"`) to the `app-delete-entity` child component to trigger a delete API call. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `headerTitleAssets` | `string` | `"Assets List"` (i18n) | Header text passed to the assets analytical table. |
| `headerTitleBank` | `string` | `"Bank Info"` (i18n) | Header text passed to the bank analytical table. |
| `employeeHasAsset` | `typeof EmployeeHasAsset` | `EmployeeHasAsset` (class ref) | Model class reference passed to the PUT-mode asset table for deserialization. |
| `employeeHasAssets` | `EmployeeHasAsset` | `new EmployeeHasAsset()` | Working copy of the asset currently being added or edited in the asset sub-dialog. |
| `employeeHasAssetsList` | `EmployeeHasAsset[]` | `[]` | Local buffer of assets staged for creation alongside a new employee in POST mode. |
| `employeeBankInfo` | `typeof EmployeeBank` | `EmployeeBank` (class ref) | Model class reference passed to the PUT-mode bank `CustomGridTable`. |
| `EmployeeBank` | `EmployeeBank` | `new EmployeeBank()` | Working copy of the bank record currently being added or edited in the bank sub-dialog. |
| `employeeBankInfoList` | `EmployeeBank[]` | `[]` | Local buffer of bank records staged for creation alongside a new employee in POST mode. |
| `tempAssets` | `EmployeeHasAsset[]` | `[]` | Declared but not actively used in current code. |
| `isAssetOpen` | `boolean` | `false` | Controls visibility of the asset sub-dialog. |
| `isBankOpen` | `boolean` | `false` | Controls visibility of the bank sub-dialog. |
| `insertTitle` | `string` | `"New"` (i18n) | Label for the insert button on analytical tables. |
| `odata` | `boolean` | from `commonService.odata` | Whether OData mode is active — used to select the correct base URL for most GET requests. |
| `api` | `boolean` | from `commonService.api` | Whether API mode is active — used for the `generate-id` POST call. |
| `open` | `boolean` | `false` | Controls visibility of the main employee dialog. Parent must set this to `true` to open the form. |
| `loading` | `boolean` | `false` | Drives the `ui5-busy-indicator` on the main dialog and disables Submit/Cancel buttons during async operations. |
| `ToastType` | `"add" \| "edit" \| "error"` | `"add"` | Type of toast notification shown after save; set to `"edit"` in PUT mode. |
| `validationMessage` | `string` | `Localization.requiredField` | Default validation message shown in `valueStateMessage` slots. Overridden to `"Employee ID already exists"` when a duplicate ID is detected. |
| `validationContactMessage` | `string` | `""` | Message shown specifically for contact/emergency number fields; changes between "required" and "must be 11 digits". |
| `valueState` | `typeof ValueState` | `ValueState` (class ref) | Exposed to template for inline reference if needed. |
| `responseType` | `saveMode` | `saveMode.POST` | Declared but not used beyond initialization in visible code. |
| `localization` | `typeof Localization` | `Localization` | Utility object providing localized string constants (Active, New, Edit, Submit, Cancel, etc.) to the template. |
| `employeeTypeName` | `string` | `""` | Display text of the selected employee type; bound to the combobox `[value]`. |
| `designationName` | `string` | `""` | Display text of the selected designation. |
| `employeeSectionName` | `string` | `""` | Display text of the selected employee section. |
| `employeeTypes` | `EmployeeType[]` | `[]` | List of active employee types fetched on init for the dropdown. |
| `employeeSections` | `EmployeeSection[]` | `[]` | List of active employee sections fetched on init. |
| `designations` | `Designation[]` | `[]` | List of active designations fetched on init. |
| `employeeShifts` | `EmployeeShift[]` | `[]` | List of active shifts fetched on init; rendered only when `employee.is_shift_fixed` is true. |
| `religions` | `string[]` | `Object.values(Religion)` | Static list of religion enum values for the select dropdown. |
| `bloodGroups` | `string[]` | `Object.values(BloodGroups)` | Static list of blood group enum values. |
| `genders` | `string[]` | `Object.values(Gender)` | Static list of gender enum values. |
| `sameAsPresentAddress` | `boolean` | `false` | When `true`, the permanent address is kept in sync with the present address and the permanent address textarea is read-only. |
| `isCheckboxEnabled` | `boolean` | `false` | Becomes `true` once the present address has any non-whitespace content; gates the "Same as Present Address" checkbox `[disabled]` binding. |
| `message_strip` | `boolean` | `false` | When `true`, shows the `ui5-message-strip` in Core Data tab displaying the `duplicate_email` error message from the API. |
| `duplicate_email` | `string` | `""` | Error message text received from the API when a duplicate email exception is thrown. |
| `resEmployeeId` | `number \| null` | `null` | Stores the `id` returned by the server after a POST employee save. Used to associate sub-entities (assets, banks) with the newly created employee. |
| `valueStateOptions` | `object` | all `ValueState.None` | Object holding individual UI5 value-state values for each validated field; keys: `first_name`, `employee_no`, `contact_number`, `email`, `employee_type`, `employee_type_id`, `employee_section_id`, `shift_id`, `emeergency_number`, `emgerency_contact_relation`, `emgerency_contact_person_name`, `blood_group`, `present_address`, `genders`, `religions`, `selectAssets`, `bankName`. |
| `selectedTab` | `string` | `"coreData"` | Tracks the currently active tab ID. Used to force-navigate to an invalid tab on validation failure. |
| `permissions` | `typeof Permissions` | `Permissions` | Exposed to template for permission checks in `*ngIf` and `[isInsertData]` bindings. |
| `AllRoles` | `any` | `undefined` | Declared but not populated or used in current code. |
| `EmployeeImage` | `string \| null` | `null` | Full URL of the employee's standard media image, displayed in PUT mode only. |
| `leaveTypes` | `any[]` | `[]` | Declared but not populated in current code; likely reserved for future use. |
| `leaveQuota` | `{ [key: number]: number }` | `{}` | Declared but not used in current code. |
| `totalYearlyLeave` | `number` | `0` | Updated by `onTotalLeaveEdit()`; declared but not displayed in current template. |
| `manualTotalEdit` | `boolean` | `false` | Set to `true` when the user manually edits `totalYearlyLeave`; not used for any branching logic currently. |
| `selectedLeaveTypes` | `any` | `undefined` | Declared but not used. |
| `leaveTypeList` | `any` | `undefined` | Declared but not used. |
| `salaryTypes` | `any[]` | `[]` | Declared but not used in current code. |
| `salaryAmounts` | `{ [key: number]: number }` | `{}` | Declared but not used. |
| `netSalary` | `number` | `0` | Declared but not used. |
| `selectedShift` | `EmployeeShift` | `new EmployeeShift()` | Declared but not actively bound in current template. |
| `assets` | `Asset[]` | `[]` | List of active assets fetched on init for the asset combobox. |
| `assetTitle` | `string` | `""` | Display text of the currently selected asset in the asset sub-dialog combobox. |
| `shiftTitle` | `string` | `""` | Display text of the selected shift combobox. |
| `departmentName` | `string` | `""` | Display text of the selected department combobox. |
| `employeeList` | `Employee[]` | `[]` | Server-filtered (debounced search) active employees for the Supervisor combobox. |
| `EmployeeName` | `string` | `""` | Display text for the Supervisor combobox. |
| `isSupervisorSearchLoading` | `boolean` | `false` | Drives the Supervisor combobox's `ui5-busy-indicator` while a search request is in flight. |
| `EmployeeSalary` | `EmployeeSalary` | `new EmployeeSalary()` | Working copy of the salary record being created or edited. |
| `departments` | `Department[]` | `[]` | List of active departments fetched on init. |
| `isServerSideRequest` | `boolean` | `false` | Declared but not used in current code. |
| `assetSaveMode` | `saveMode` | `saveMode.POST` | Whether the asset sub-dialog is in create or edit mode. |
| `bankSaveMode` | `saveMode` | `saveMode.POST` | Whether the bank sub-dialog is in create or edit mode. |
| `bankEditIndex` | `number` | `-1` | Index of the bank record being edited within `employeeBankInfoList` in POST mode; `-1` means not editing. |
| `employeeIdExists` | `boolean` | `false` | Set to `true` by the async duplicate-check when `employee_no` already exists in the database. Blocks save. |
| `currentDate` | `string` | `moment().format("DD-MM-YYYY")` | Today's date as a formatted string; declared but not used in current template. |
| `moment` | `typeof moment` | `moment` | Exposed to template for potential date formatting use. |
| `EmployeeStatus` | `any` | `undefined` | Response object from the `employePayrollStatus` API; drives the Leave tab display. |
| `leaveList` | `{ name: string; total: number }[]` | `[]` | Derived from `EmployeeStatus.leaveStatus.leaveInYear`; each entry is a leave type name + count pair. |
| `totalLeaves` | `number` | `0` | Sum of all `leaveList` totals; displayed on the Leave tab. |
| `bankTableColumns` | `any` | initialized in constructor | Column definitions for the bank tables; built by `tableColumnBank()` in constructor and stored for `CustomGridTable`. |
| `isBankLoading` | `boolean` | `false` | Set to `true` when `handleEmployeeBankAPI()` starts; prevents duplicate submit clicks. Reset by `closeEmployeeBank()`. |

---

## ViewChild / ViewChildren

| Ref name | Type | Purpose |
|---|---|---|
| `itemAttachmentsTab` | `AttachmentUploadComponent` | Accessed in `onTabSelect()` to set `isEdit`, `isPreview` flags and call `loadInputImages()` when the Attachments tab is selected in PUT mode. Also accessed in `CloseDialog()` to reset `fileCount`. |
| `employeeAssetTableEdit` | `AnalyticalTableComponent` | The PUT-mode OData-backed asset table. Not used directly in the current methods beyond being declared. |
| `employeeAssetTable` | `AnalyticalTableComponent` | The POST-mode static asset table. Used in `handleEmployeeAssetLocal()` and `deleteEmployeeAsset()` to push updated data via `staticData.emit()` and `render()`. Also used in `resetAssets()`. |
| `employeeBankTableEdit` | `CustomGridTableComponent` | The PUT-mode server-side bank table. Called with `onFilterAndSorting()` after a bank add/update/delete to refresh the live data. |
| `employeeBankTable` | `AnalyticalTableComponent` | The POST-mode static bank table. Used in `handleEmployeeBankLocal()` and `deleteEmployeeBank()` to push updated data and re-render. Also used in `resetBanks()`. |
| `assetsTableRef` | `AnalyticalTableComponent` | Declared with `#assetTable`; not actively used in current methods. |
| `assetsAssociateRef` | `AssosiateComponent` | Declared with `#assetsAssociate`; not actively used in current methods. |

---

## Lifecycle Hooks

### `ngOnInit()`
Runs immediately after the component is initialized. Calls all data-loading methods in parallel (no explicit ordering dependency):
1. `getAssets()` — loads active assets for the asset combobox.
2. `getEmployeeShifts()` — loads active shifts.
3. `getSupervisorEmployees()` — initial (unfiltered) load of active employees for the Supervisor combobox.
4. `initDepartment()` — loads active departments.
5. `initEmployeeType()` — loads active employee types.
6. `initDesignation()` — loads active designations.
7. `initEmployeeSection()` — loads active employee sections.

No `ngOnDestroy` or `ngAfterViewInit` hooks are implemented.

---

## Methods — Detailed

### `constructor(commonService, toastService, mediaService, cdr, rolePermissionService)`
- Sets `this.odata` from `commonService.odata` and `this.api` from `commonService.api`.
- Calls `this.tableColumnBank()` to pre-build and store bank column definitions in `this.bankTableColumns`.

---

### `ngOnInit(): void`
See Lifecycle Hooks section above.

---

### `initEmployeeType(): void`
- GET `EmployeeTypes?$filter=is_active eq true` (OData mode).
- On success: populates `this.employeeTypes`.
- On error: logs to console.

---

### `getEmployeeTypes(items: any): void`
- Triggered by `(selectionChange)` on the Employee Type combobox.
- Reads `items.detail.item`; if truthy, sets `this.employee.employee_type_id` (cast to `Number`) and `this.employeeTypeName`.

---

### `initDesignation(): void`
- GET `Designations?$filter=is_active eq true` (OData mode).
- On success: populates `this.designations`.

---

### `getDesignations(items: any): void`
- Triggered by `(selectionChange)` on the Designation combobox.
- Sets `this.employee.designation_id` and `this.designationName` from the selected item.

---

### `initEmployeeSection(): void`
- GET `EmployeeSections?$filter=is_active eq true` (OData mode).
- On success: populates `this.employeeSections`.

---

### `getEmployeeSections(items: any): void`
- Triggered by `(selectionChange)` on the Employee Section combobox.
- Sets `this.employee.employee_section_id` and `this.employeeSectionName`.

---

### `onShiftChange(event: any): void`
- Triggered by `(selectionChange)` on the Employee Shift combobox (visible only when `employee.is_shift_fixed` is true).
- Sets `this.employee.shift_id` and `this.shiftTitle` from the selected item.

---

### `getDepartment(items: any): void`
- Triggered by `(selectionChange)` on the Department combobox.
- Sets `this.employee.department_id` and `this.departmentName`.

---

### `initDepartment(): void`
- GET `Departments?$filter=is_active eq true` (non-OData, uses default `commonService.get`).
- On success: populates `this.departments`.

---

### `onSalaryChange(): void`
- Triggered by `(input)` on the Total Salary field (and also wired to Other Allowance field, though that is read-only — effectively only the total field matters).
- Reads `this.EmployeeSalary.total_salary`.
- Applies fixed breakdown rules:
  - `basic = total_salary * 0.5` (50%)
  - `house_rent = total_salary * 0.3` (30%)
  - `medical_allowance = 750` (fixed constant)
  - `transport_allowance = 400` (fixed constant)
  - `other_allowance = total_salary - basic - house_rent - 750 - 400`
- All derived fields are displayed as read-only in the template.

---

### `hasSalaryData(salary: EmployeeSalary): boolean` (private)
- Checks if any of `total_salary`, `basic`, `house_rent`, `medical_allowance`, `transport_allowance`, `other_allowance` is greater than zero.
- Returns `true` if at least one has a positive numeric value.
- Used in `saveEmployee()` to decide whether to persist salary data.

---

### `onSalarySave(employeeId: number): void`
- Called from within the `saveEmployee()` success handler, only if `this.employee.salary` is truthy or `hasSalaryData()` returns true.
- Creates `salaryPayload` via `new EmployeeSalary().deserialize(this.EmployeeSalary)` and sets `salaryPayload.employee_id = employeeId`.
- **In PUT mode + existing salary (`this.employee.salary` is truthy):** PUT `EmployeeSalaries/{salaryPayload.id}` with `salaryPayload.toOdata()`. On success: calls `CloseDialog()`, emits `RefreshTable`, shows toast.
- **In PUT mode + no existing salary:** POST `EmployeeSalaries` with `salaryPayload`. Same success actions.
- **In POST mode:** POST `EmployeeSalaries` with `salaryPayload`. Same success actions.
- Note: When salary data is present, `onSalarySave` is responsible for calling `CloseDialog()` and `RefreshTable.emit()` — these are NOT called by the `saveEmployee()` main flow in that case. When there is no salary data, `saveEmployee()` calls them directly.

---

### `getEmployeeImageData(): void`
- GET `Employees/${this.employee.id}?$expand=media`.
- Finds the media entry where `is_standard === true`.
- If found, builds `this.EmployeeImage` as `${environment.ServerApi}/storage/${id}/${fileName}`.
- If not found, sets `this.EmployeeImage = null`.
- Calls `this.cdr.detectChanges()` to force Angular change detection after update.
- Note: This method is defined but **not called anywhere within this component**. It is intended to be called by the parent after opening the dialog in PUT mode.

---

### `setSupervisor(event: any): void`
- Triggered by `(selection-change)` on the Supervisor combobox.
- Reads `event?.detail?.item` (optional-chained — no longer called with a bare `Employee` object from `ngOnInit`, so this guard is now the only line of defense against a stale/empty event).
- If `selectedItem` is present: sets `this.employee.supervisor_id` and `this.EmployeeName` (`selectedItem.text`, the full combobox label).

---

### `onSupervisorSearchInput(event: any): void`
- Triggered by `(input)` on the Supervisor combobox (keystroke).
- Debounces 300ms (`setTimeout`/`clearTimeout` on `supervisorSearchTimer`) then calls `getSupervisorEmployees(value)` — same manual-debounce pattern as the Leave Calendar's employee search (`calender-management.component.ts`).

---

### `checkValidation(event: any, field: string): void`
- General-purpose inline validation triggered on `(input)` or `(change)` events.
- Extracts `value = event.target.value || ""`.
- Dispatches on `field`:

| field | Empty rule | Non-empty rule |
|---|---|---|
| `employee_id` | `employee_no = Negative` | Assigns `employee.employee_no`, then calls `checkEmployeeIdExists()` (POST mode only) or sets `None` (PUT). |
| `first_name` | `first_name = Negative` | Assigns value, sets `None`. |
| `employee_type` | `employee_type = Negative` | Assigns value, sets `None`. |
| `contact_number` | `contact_number = Negative`, message = required | If `length !== 11`: `Negative`, message = "must be exactly 11 digits". Else: assigns value, `None`, resets message. |
| `blood_group` | `blood_group = Negative` | Assigns value, `None`. |
| `emgerency_contact_relation` | `emgerency_contact_relation = Negative` | Assigns value, `None`. |
| `emgerency_contact_person_name` | `emgerency_contact_person_name = Negative` | Assigns value, `None`. |
| `present_address` | `present_address = Negative` | Assigns value, `None`. |
| `genders` | `genders = Negative` | Assigns to `employee.gender`, `None`. |
| `religions` | `religions = Negative` | Assigns to `employee.religion`, `None`. |
| `selectAssets` | `selectAssets = Negative` | Calls `onAssetChange(event)`, sets `None`. |
| `bankName` | `bankName = Negative` | Assigns to `EmployeeBank.bank_name`, `None`. |

- Fields `email`, `shift_id`, and `emgerency_number` cases are commented out in code.

---

### `coreDataValidation(): boolean`
- Full validation run for the Core Data tab, called by `saveEmployee()`.
- Validates:
  1. `employee_no`: must be non-empty AND `employeeIdExists` must be false. If `employeeIdExists` is true, sets `Negative` and returns false.
  2. `first_name`: must be non-empty.
  3. `contact_number`: must be non-empty AND exactly 11 characters.
- Returns `false` and sets appropriate `valueStateOptions` on any failure; returns `true` if all pass.
- `email` and `shift_id` validations are commented out.

---

### `personalDataValidation(): boolean`
- Full validation for Personal Data tab, called by `saveEmployee()`.
- Currently only validates `present_address` (must be non-empty).
- All other field validations (`emgerency_contact_number`, `emgerency_contact_person_name`, `emgerency_contact_relation`, `blood_group`, `gender`, `religion`) are commented out.
- Returns `false` if present address is empty, `true` otherwise.

---

### `assetValidation(): boolean`
- Validates that `employeeHasAssets.asset_id` is not falsy.
- Sets `selectAssets = Negative` if invalid.
- Returns `true` / `false`.

---

### `bankValidation(): boolean`
- Validates that `EmployeeBank.bank_name?.trim()` is non-empty.
- Sets `bankName = Negative` if invalid.
- Returns `true` / `false`.

---

### `generateCode(data?: any): void`
- POST `generate-id` (API mode) with optional `data` payload.
- On success: sets `this.employee.employee_no = response.code`, calls `checkValidation()` twice with a synthetic event (appears to be a copy-paste artifact — the field value `"code"` would fall to the `default` case and do nothing useful; the intent was likely `"employee_id"`).
- Calls `this.cdr.detectChanges()` to update the UI.
- Note: This method is defined but not called from within this component; it is expected to be called by the parent.

---

### `checkEmployeeIdExists(employeeNo: string): void`
- Guard: returns immediately if `employeeNo` is falsy.
- GET `Employees?$filter=employee_no eq '${employeeNo}'` (OData mode, hardcoded `true`).
- If response contains any records: sets `this.employeeIdExists = true`, `employee_no = Negative`, `validationMessage = "Employee ID already exists"`.
- If no records: sets `this.employeeIdExists = false`, `employee_no = None`.
- On error: resets state to `None`.

---

### `getEmployeeShifts(): void`
- GET `EmployeeShifts?$filter=is_active eq true` (OData mode).
- On success: maps response to `EmployeeShift[]` via `deserialize`, populates `this.employeeShifts`.

---

### `onTotalLeaveEdit(event: any): void`
- Reads `event.target.value`, coerces to number, sets `this.totalYearlyLeave`.
- Sets `this.manualTotalEdit = true`.
- This method is declared but no template binding currently calls it.

---

### `associateTableColum(): any[]`
- Returns a static column definition array with `custom_id` and `name` accessors.
- Not used in the current template; likely reserved for an associate panel.

---

### `getAssets(): void`
- GET `Assets?$filter=is_active eq true` (OData mode).
- Maps response to `Asset[]` via `deserialize`, populates `this.assets`.

---

### `onAssetChange(event: any): void`
- Triggered by `(selectionChange)` on the asset combobox in the asset sub-dialog.
- Sets `this.employeeHasAssets.asset_id = event.detail.item.id`.
- Sets `this.assetTitle = event.detail.item?.text`.
- Calls `this.assetValidation()` to immediately update validation state.

---

### `tableColumnBank(): any[]`
- Builds and returns the column configuration array for bank tables.
- Columns: `is_active` (icon), `bank_name`, `branch_name`, `account_number`, `account_holder_name`, `swift_code`, `is_primary` (Switch, disabled).
- If the user has `HR_EMPLOYEE_EDIT` OR `HR_EMPLOYEE_DELETE` permission: appends an `actions` column with Edit and Delete buttons.
  - Edit button calls `this.editEmployeeBank(row.original)`.
  - Delete button: in POST mode calls `this.deleteEmployeeBank(row.original)`; in PUT mode emits `IsDelete` with `"EmployeeBankInfos(${row.original.id})"`.
- Stores result in `this.bankTableColumns` AND returns the array.

---

### `tableColumnnAssets(): any[]`
- Builds and returns the column configuration for asset tables.
- Columns: `is_active` (icon), `asset_id` (resolved to asset name via `this.assets` lookup), `remarks`, `note`, `issued_date`, `return_date`.
- If user has `HR_EMPLOYEE_ASSET_EDIT` OR `HR_EMPLOYEE_ASSET_DELETE` permission: appends `actions` column.
  - Edit calls `this.editEmployeeAsset(row.original)`.
  - Delete: POST mode calls `this.deleteEmployeeAsset(row.original)`; PUT mode emits `IsDelete` with `"EmployeeHasAssets/${row.original.id}"`.
- Returns the array (does NOT store it on a property; called inline in template).

---

### `addStaticEmployeeAsset(): void`
- Triggered by the `(isInsertDataChange)` event on the POST-mode asset table.
- Resets `employeeHasAssets` to a fresh instance, clears `assetTitle`, sets `assetSaveMode = POST`, opens asset dialog (`isAssetOpen = true`).

---

### `newEmployeeAsset(): void`
- Triggered by `(isInsertDataChange)` on the PUT-mode asset table.
- Identical behavior to `addStaticEmployeeAsset()`.

---

### `editEmployeeAsset(data: any): void`
- Triggered by `(onEditSelectData)` event on either asset table (row click) or the Edit action button.
- Sets `this.employeeHasAssets = data` (direct reference, not a copy).
- Resolves the asset name from `this.assets` by `data.asset_id` and sets `assetTitle`.
- Sets `assetSaveMode = PUT` if `data.id` exists, else `POST`.
- Opens asset dialog.

---

### `addStaticEmployeeBank(): void`
- Triggered by `(isInsertDataChange)` on the POST-mode bank table.
- Resets `EmployeeBank`, sets `bankSaveMode = POST`, resets `bankEditIndex = -1`, opens bank dialog.

---

### `newEmployeeBank(): void`
- Triggered by `(newButtonClick)` on the PUT-mode `CustomGridTable`.
- Identical behavior to `addStaticEmployeeBank()`.

---

### `editEmployeeBank(data: any): void`
- Triggered by the Edit action button in the bank table.
- In POST mode: finds the edit index via `findIndex` (reference equality) and stores in `bankEditIndex`.
- Deserializes `data` into `this.EmployeeBank` (creates a copy).
- Sets `bankSaveMode = PUT` if `data.id` exists, else `POST`.
- Opens bank dialog.

---

### `saveEmployee(): void`
- Main form submission handler, triggered by the global Submit button.
- Step 1: `coreDataValidation()` — if false, forces `selectedTab = "coreData"` and returns.
- Step 2: `personalDataValidation()` — if false, forces `selectedTab = "personalData"` and returns.
- Step 3: If `employee.is_supervisor` is true, clears `employee.supervisor_id` (a supervisor cannot report to another supervisor).
- Step 4: If `employee.email` is empty string or null, sets it to `undefined` (prevents empty string being sent to API).
- Step 5: Sets `this.loading = true`.
- Step 6: Builds the HTTP request based on `saveMode`:
  - POST: `POST Employees` with `employee.toOdata()`. Sets `ToastType = "add"`.
  - PUT: `PUT Employees(${employee.id})` with `employee.toOdata()`. Sets `ToastType = "edit"`.
- Step 7 (on success):
  - Stores `res.id` in `this.resEmployeeId`.
  - Calls `this.mediaService.setId(res.id)`.
  - If salary data exists (`employee.salary` truthy OR `hasSalaryData()` true): calls `onSalarySave(res.id)` which handles dialog close and refresh internally.
  - If `employeeHasAssetsList` has items: maps each to a POST `EmployeeHasAssets` call, runs via `forkJoin`, clears the list, emits `RefreshTable` on completion.
  - If `employeeBankInfoList` has items: maps each to a POST `EmployeeBankInfos` call, runs via `forkJoin`, clears the list, emits `RefreshTable` on completion.
  - Emits `RefreshTable` unconditionally.
  - Calls `CloseDialog()`.
  - Shows toast via `toastService.show(this.ToastType)`.
- Step 8 (on error):
  - Logs error.
  - If `err.error.exception === "Exception"`: sets `message_strip = true`, sets `duplicate_email = err.error.message`, forces tab to `"coreData"`.
  - Resets `loading = false`.
  - Shows error toast.

---

### `saveEmployeeHasAsset(): void`
- Submit handler for the asset sub-dialog.
- If `assetValidation()` fails: forces `selectedTab = "assetData"`, keeps `isAssetOpen = true`, returns.
- If `assetSaveMode === POST`: calls `handleEmployeeAssetLocal()`.
- If `assetSaveMode === PUT`: calls `handleEmployeeAssetAPI()`.

---

### `saveEmployeeBankInfo(): void`
- Submit handler for the bank sub-dialog.
- If `bankValidation()` fails: forces `selectedTab = "bank"`, keeps `isBankOpen = true`, returns.
- If `bankSaveMode === POST`: calls `handleEmployeeBankLocal()`.
- If `bankSaveMode === PUT`: calls `handleEmployeeBankAPI()`.

---

### `handleEmployeeBankLocal(): void`
- Deserializes `this.EmployeeBank` into a new `EmployeeBank` instance.
- **If `resEmployeeId` is null (employee not yet saved to server):**
  - If `bankEditIndex > -1`: replaces the item at that index in `employeeBankInfoList`.
  - Else: appends the new bank to `employeeBankInfoList`.
  - Updates the static table via `staticData.emit()` and `render()`.
  - Resets `EmployeeBank`, `bankEditIndex`, closes bank dialog.
- **If `resEmployeeId` is set (employee already saved, e.g. was just created):**
  - Sets `bank.employee_id = this.resEmployeeId`.
  - POST `EmployeeBankInfos` with `bank.toOdata()`.
  - On success: refreshes the PUT-mode bank table via `onFilterAndSorting()`, closes dialog, shows "add" toast.
  - On error: closes dialog, shows "error" toast.

---

### `handleEmployeeBankAPI(): void`
- Direct API update for an existing bank record in PUT mode.
- Sets `isBankLoading = true`.
- PUT `EmployeeBankInfos(${EmployeeBank.id})` with `EmployeeBank.toOdata()`.
- On success: refreshes the PUT-mode bank table, closes dialog, shows "edit" toast.
- On error: closes dialog, shows "error" toast.
- `isBankLoading` is reset by `closeEmployeeBank()`.

---

### `deleteEmployeeBank(bank: EmployeeBank): void`
- Local delete for POST mode only (PUT mode routes through `IsDelete` emitter).
- Filters out the matching item (by reference) from `employeeBankInfoList`.
- Updates the static table `staticDataList`, emits new data, re-renders.

---

### `handleEmployeeAssetLocal(): void`
- Deserializes `this.employeeHasAssets` into a new `EmployeeHasAsset`.
- Ensures `asset_id` is cast to `Number`.
- **If `resEmployeeId` is null:**
  - Checks if current `this.employeeHasAssets` reference already exists in list (`findIndex` by reference).
  - If found (edit): replaces the item at that index.
  - If not found (new): appends.
  - Updates static asset table via `staticData.emit()` and `render()`.
  - Resets `employeeHasAssets`, `assetTitle`, closes asset dialog.
- **If `resEmployeeId` is set:**
  - Sets `asset.employee_id = this.resEmployeeId`.
  - POST `EmployeeHasAssets` with `asset.toOdata()`.
  - On success: emits `RefreshAssetTable`, closes dialog, shows "add" toast.
  - On error: closes dialog, shows "error" toast.

---

### `handleEmployeeAssetAPI(): void`
- Direct API update for an existing asset assignment in PUT mode.
- PUT `EmployeeHasAssets(${employeeHasAssets.id})` with `employeeHasAssets.toOdata()`.
- On success: emits `RefreshAssetTable`, closes dialog, shows "edit" toast.
- On error: closes dialog, shows "error" toast.

---

### `deleteEmployeeAsset(asset: EmployeeHasAsset): void`
- Local delete for POST mode only.
- Filters out the matching item (by reference) from `employeeHasAssetsList`.
- Updates static asset table `staticDataList`, emits data, re-renders.

---

### `getSupervisorEmployees(search?: string): void`
- Sets `isSupervisorSearchLoading = true`.
- GET `Employees?$filter=is_active eq true` plus, when `search` is non-empty, an appended `and (contains(tolower(employee_no),'<term>') or contains(tolower(first_name),'<term>') or contains(tolower(last_name),'<term>'))` (OData mode via `this.odata`).
- On success: deserializes `response.value` into `this.employeeList`, sets `isSupervisorSearchLoading = false`.
- On error: logs error, sets `isSupervisorSearchLoading = false`.
- Replaces the old `GetEmployees()` (which loaded up to 10,000 employees once via the shared `EmployeeFormDataService` batch call, with no server-side search — the combobox filtered client-side over that whole list, which is what made typing feel slow). This method instead re-queries the backend per debounced keystroke (`onSupervisorSearchInput`), keeping `employeeList` small — same pattern as the Leave Calendar's employee search.

---

### `onPresentAddressChange(event?: any): void`
- Triggered by `(input)` on the Present Address textarea.
- Computes `hasData` based on whether `employee.present_address` has non-whitespace content.
- Calls `checkValidation(event, "present_address")`.
- Sets `isCheckboxEnabled = hasData`.
- If `sameAsPresentAddress` is true AND there is data: copies `present_address` to `permanent_address`.
- If `!hasData`: forces `sameAsPresentAddress = false`.

---

### `initEmployeeStatus(employeeId: number | undefined): void`
- Computes `startDate` from `employee.created_at` (formatted as `DD-MM-YYYY`) and `endDate` as today.
- GET `employePayrollStatus/${employeeId}/${startDate}/${endDate}` (non-OData, `false`).
- On success: sets `this.EmployeeStatus`, sets `loading = false`, calls `this.leaveCount()`.
- On error: logs, sets `loading = false`.
- Note: This method is not called within this component — the parent must call it after opening the dialog in PUT mode.

---

### `leaveCount(): void`
- Called by `initEmployeeStatus()` after data is loaded.
- If `EmployeeStatus.leaveStatus.leaveInYear` exists: maps to `leaveList` array with `{ name, total }` entries.
- Computes `totalLeaves` as the sum of all totals.

---

### `toggleSameAddress(): void`
- Triggered by `(change)` on the "Same as Present Address" checkbox.
- If `sameAsPresentAddress` is true: copies `employee.present_address` to `employee.permanent_address`.

---

### `onTabSelect(event: any): void`
- Triggered by `(tab-select)` on the tab container.
- Reads the selected tab ID from `event.detail.tab.id` and stores in `this.selectedTab`.
- If tab is `"attachments"` AND `saveMode === PUT`:
  - Sets `itemAttachmentsTab.isEdit = true` and `isPreview = true`.
  - Calls `itemAttachmentsTab.loadInputImages()` to fetch existing attachment images.
  - Returns early.
- If tab is `"bank"` AND `saveMode === PUT`: calls `employeeBankTableEdit.onFilterAndSorting()` to refresh the bank grid.

---

### `onDeleteSuccess(): void`
- Called by `(isSuccess)` event from the `app-delete-entity` child component after a delete API call succeeds.
- Emits `RefreshAssetTable`.
- Calls `employeeBankTableEdit.onFilterAndSorting()` to refresh both tables regardless of which entity was deleted.

---

### `closeEmployeeAsset(): void`
- Closes the asset sub-dialog (`isAssetOpen = false`), resets `loading = false`.

---

### `closeEmployeeBank(): void`
- Closes the bank sub-dialog (`isBankOpen = false`), resets `bankEditIndex = -1`, `loading = false`, `isBankLoading = false`.

---

### `resetAssets(): void`
- Clears `employeeHasAssetsList`, resets `employeeHasAssets` and `assetTitle`.
- If `employeeAssetTable` ViewChild exists: clears its `staticDataList` and calls `render()`.

---

### `resetBanks(): void`
- Clears `employeeBankInfoList`, resets `EmployeeBank`, resets `bankEditIndex = -1`.
- If `employeeBankTable` ViewChild exists: clears its `staticDataList` and calls `render()`.

---

### `SalaryFormReset(): void`
- Creates a new `EmployeeSalary` instance and sets all salary fields (`basic`, `house_rent`, `medical_allowance`, `transport_allowance`, `other_allowance`, `total_salary`) to `0`.

---

### `CloseDialog(): void`
- Comprehensive reset of all form state for re-use.
- Steps:
  1. `loading = false`, `open = false`, `message_strip = false`, `resEmployeeId = null`.
  2. Resets `employee` to a fresh deserialized `Employee`.
  3. Clears display name strings: `EmployeeName`, `departmentName`, `designationName`, `employeeTypeName`, `employeeSectionName`.
  4. Resets all `valueStateOptions` to `ValueState.None`.
  5. Resets `itemAttachmentsTab.fileCount = 0`.
  6. Calls `resetAssets()`, `resetBanks()`, `SalaryFormReset()`.

---

## Template Bindings & Structure

The template is a single `ui5-dialog` element containing a tab container. The dialog width is `1000px`, height `780px`.

### Dialog Header
- `[open]="open"` — controlled externally.
- Header text switches between `localization.New` (POST) and `localization.Edit` (PUT).
- `(before-close)="CloseDialog()"` — resets state when the dialog is dismissed.

### Global Busy Indicator
- `[active]="loading"` — covers the entire dialog content during async operations.

### Tab: Core Data (`id="coreData"`)
- **Message Strip:** shown when `message_strip` is true; displays `duplicate_email` error. Closeable via `(ui5Close)`.
- **Active switch:** two-way bound to `employee.is_active`.
- **Is Shift Fixed switch:** shown only when `!employee.group_id`; bound to `employee.is_shift_fixed`.
- **Employee Image:** shown in PUT mode. If `EmployeeImage` is set, shows `<img>`; else shows a "No Image Preview" placeholder div.
- **Employee ID input:** required; read-only in PUT mode; `(input)` calls `checkValidation($event, 'employee_id')`; value-state from `valueStateOptions.employee_no`.
- **First Name input:** required; `(input)` calls `checkValidation($event, 'first_name')`.
- **Last Name input:** optional; no validation.
- **Email input:** optional; `(input)` calls `checkValidation($event, 'email')` (state tracked but validation not enforced on save).
- **Contact Number input:** required; type Number; 11-digit rule enforced both inline and on save.
- **Department combobox:** populated from `departments`; `(selectionChange)` calls `getDepartment()`.
- **Designation combobox:** populated from `designations`; `(selectionChange)` calls `getDesignations()`.
- **Employee Type combobox:** populated from `employeeTypes`; value-state tracks `employee_type_id`.
- **Supervisor combobox:** populated from `employeeList` (debounced server search, `onSupervisorSearchInput`); item text is `"employee_no - first_name"` + `" last_name"` only when `last_name` is present (avoids rendering `"null"`/`"undefined"`); busy state via `isSupervisorSearchLoading`.
- **Employee Section combobox:** populated from `employeeSections`.
- **Employee Shift combobox:** rendered only when `employee.is_shift_fixed` is true; populated from `employeeShifts`.

### Tab: Personal Data (`id="personalData"`)
- **Gender select:** `[(ngModel)]` bound; options from `genders` enum.
- **Religion select:** `[(ngModel)]` bound; options from `religions` enum.
- **NID/Birth Certificate input:** type Number; no validation.
- **Referred By input:** text; no validation.
- **Emergency Contact Person Name input:** optional; value-state shown but not validated on save.
- **Emergency Contact Person Number input:** type Number; optional; not validated on save.
- **Emergency Contact Person Relation input:** optional; not validated on save.
- **Blood Group select:** options from `bloodGroups` enum; inline validation only.
- **Date of Joining date-picker:** format `dd-MM-yyyy`.
- **Date of Birth date-picker:** format `dd-MM-yyyy`.
- **Present Address textarea:** required; `(input)` calls `onPresentAddressChange()` which both validates and manages the "same address" logic.
- **Same as Present Address checkbox:** disabled when `employee.present_address` is falsy; `(change)` calls `toggleSameAddress()`.
- **Permanent Address textarea:** `[readonly]="sameAsPresentAddress"`.

### Tab: Salary (`id="salary"`)
- Six fields: Basic (readonly), House Rent (readonly), Medical Allowance (readonly), Transport Allowance (readonly), Other Allowance (readonly), Total Salary (editable).
- `(input)="onSalaryChange()"` on Total Salary triggers auto-calculation of all other fields.
- Other Allowance also has `(input)="onSalaryChange()"` but is `readonly`, so the event never fires.

### Tab: Bank (`id="bank"`)
- **POST mode:** `react-analytical-table#employeeBankTable` with static data from `employeeBankInfoList`.
  - `(isInsertDataChange)="addStaticEmployeeBank()"`.
  - `(onEditSelectData)="editEmployeeBank($event)"`.
- **PUT mode:** `app-custom-grid-table#employeeBankTableEdit` with server-side data.
  - URL: `/EmployeeBankInfos`, filtered by `employee_id eq ${employee.id}`.
  - `(newButtonClick)="newEmployeeBank()"`.
- **Bank Sub-Dialog:** shown when `isBankOpen`.
  - Primary switch, Bank Name (required), Branch Name, Account Number, Account Holder Name, Swift Code.
  - Footer: Submit (`saveEmployeeBankInfo()`) and Cancel (`closeEmployeeBank()`).
  - Submit disabled when `isBankLoading`.

### Tab: Assets (`id="assetData"`)
- **POST mode:** `react-analytical-table#employeeAssetTable` with static data.
  - `(isInsertDataChange)="addStaticEmployeeAsset()"`.
- **PUT mode:** `react-analytical-table#employeeAssetTableEdit` with OData API source.
  - `apiUrl="EmployeeHasAssets?$expand=employee,asset"`, filtered by `employee_id eq ${employee.id}`.
  - `(isInsertDataChange)="newEmployeeAsset()"`.
- **Asset Sub-Dialog:** shown when `isAssetOpen`.
  - Asset combobox (required), Issued Date picker, Return Date picker, Remarks textarea, Note textarea.
  - Footer: Submit (`saveEmployeeHasAsset()`) and Cancel (`closeEmployeeAsset()`).
  - Buttons disabled when `loading`.

### Tab: Leave (`id="leave"`) — PUT mode only
- Rendered via `*ngIf="this.saveMode === 'PUT'"`.
- Shows a card with a Leave Summary section.
- `*ngFor` over `leaveList`: shows leave type name and total count per type.
- Shows `totalLeaves` and `EmployeeStatus?.leaveStatus?.leaveBalance`.

### Tab: Attachments (`id="attachments"`)
- `app-attachment-upload#itemAttachmentsTab` with `[model]="'Employee'"`, `[id]="employee.id"`, `[apiUrl]="'Employees'"`.

### Global Dialog Footer
- Submit button: calls `saveEmployee()`; disabled when `loading`.
- Cancel button: calls `CloseDialog()`; disabled when `loading`.

### `app-delete-entity`
- Receives `[IsDelete]="IsDelete"` (the EventEmitter).
- Emits `(isSuccess)="onDeleteSuccess()"` after successful deletion.

---

## API Calls

| HTTP Method | Endpoint | When Called | Payload / Query Params | Response Handling |
|---|---|---|---|---|
| GET | `EmployeeTypes?$filter=is_active eq true` | `ngOnInit` via `initEmployeeType()` | — | Populates `employeeTypes` |
| GET | `Designations?$filter=is_active eq true` | `ngOnInit` via `initDesignation()` | — | Populates `designations` |
| GET | `EmployeeSections?$filter=is_active eq true` | `ngOnInit` via `initEmployeeSection()` | — | Populates `employeeSections` |
| GET | `Departments?$filter=is_active eq true` | `ngOnInit` via `initDepartment()` | — | Populates `departments` |
| GET | `EmployeeShifts?$filter=is_active eq true` | `ngOnInit` via `getEmployeeShifts()` | — | Populates `employeeShifts` |
| GET | `Assets?$filter=is_active eq true` | `ngOnInit` via `getAssets()` | — | Populates `assets` |
| GET | `Employees?$filter=is_active eq true[ and contains(...)]` | `ngOnInit` and `onSupervisorSearchInput` via `getSupervisorEmployees()` | — | Populates `employeeList` for Supervisor combobox (debounced search) |
| GET | `Employees/${id}?$expand=media` | `getEmployeeImageData()` (called by parent) | — | Resolves `EmployeeImage` URL |
| GET | `Employees?$filter=employee_no eq '${employeeNo}'` | On Employee ID input (POST mode only) | OData filter | Sets `employeeIdExists` flag |
| GET | `employePayrollStatus/${id}/${start}/${end}` | `initEmployeeStatus()` (called by parent) | Path params | Populates `EmployeeStatus`, triggers `leaveCount()` |
| POST | `generate-id` | `generateCode()` (called by parent) | Optional `data` body | Sets `employee.employee_no` |
| POST | `Employees` | `saveEmployee()` in POST mode | `employee.toOdata()` | Creates employee; triggers salary/asset/bank saves |
| PUT | `Employees(${id})` | `saveEmployee()` in PUT mode | `employee.toOdata()` | Updates employee; triggers salary save if needed |
| POST | `EmployeeSalaries` | `onSalarySave()` when no existing salary | `salaryPayload.toOdata()` | Saves salary, closes dialog, refreshes table |
| PUT | `EmployeeSalaries/${id}` | `onSalarySave()` when salary exists in PUT mode | `salaryPayload.toOdata()` | Updates salary, closes dialog, refreshes table |
| POST | `EmployeeHasAssets` | Bulk in `saveEmployee()` OR single in `handleEmployeeAssetLocal()` when `resEmployeeId` set | `asset.toOdata()` | Associates assets with employee |
| PUT | `EmployeeHasAssets(${id})` | `handleEmployeeAssetAPI()` in PUT mode | `employeeHasAssets.toOdata()` | Updates asset assignment |
| POST | `EmployeeBankInfos` | Bulk in `saveEmployee()` OR single in `handleEmployeeBankLocal()` when `resEmployeeId` set | `bank.toOdata()` | Saves bank info |
| PUT | `EmployeeBankInfos(${id})` | `handleEmployeeBankAPI()` in PUT mode | `EmployeeBank.toOdata()` | Updates bank record |

---

## Validation Logic

| Field | Rule | State Set on Failure |
|---|---|---|
| `employee_no` | Non-empty AND no duplicate in DB | `valueStateOptions.employee_no = Negative`; `validationMessage = "Employee ID already exists"` for duplicate |
| `first_name` | Non-empty (trimmed) | `valueStateOptions.first_name = Negative` |
| `contact_number` | Non-empty AND exactly 11 characters | `valueStateOptions.contact_number = Negative`; `validationContactMessage` set accordingly |
| `present_address` | Non-empty (trimmed) | `valueStateOptions.present_address = Negative` |
| `asset_id` (in asset dialog) | Truthy (selected) | `valueStateOptions.selectAssets = Negative` |
| `bank_name` (in bank dialog) | Non-empty (trimmed) | `valueStateOptions.bankName = Negative` |

The following fields have validation state tracking (inline `checkValidation` and `valueStateOptions` entries) but are **not enforced on save** (their save-time checks are commented out):
- `email`, `employee_type`, `shift_id`, `blood_group`, `gender`, `religion`, `emgerency_contact_number`, `emgerency_contact_person_name`, `emgerency_contact_relation`

On save failure due to tab mismatch (e.g. Core Data invalid), the component programmatically switches to the offending tab via `this.selectedTab = "coreData"` or `"personalData"`.

---

## Services Injected

| Service | Why Injected | Methods Used |
|---|---|---|
| `CommonService` | Central HTTP service for all API calls | `get()`, `post()`, `put()`; also provides `odata` and `api` flags |
| `ToastService` | Display success/error toast notifications | `show("add")`, `show("edit")`, `show("error")` |
| `MediaService` | Registers the entity ID for media/attachment upload context | `setId(id)` — called after employee save to associate attachments |
| `ChangeDetectorRef` | Manual change detection after async updates | `detectChanges()` — called in `getEmployeeImageData()` |
| `RolePermissionService` | Role-based permission checks for conditional rendering | `hasPermission(Permissions.*)` — used in table column builders and template `[isInsertData]` bindings |

---

## Inter-component Communication

| Direction | Mechanism | Details |
|---|---|---|
| Parent → This | `@Input() saveMode` | Parent sets POST or PUT before opening. |
| Parent → This | `@Input() employee` | Parent populates with existing data for editing. |
| Parent → This | Sets `this.open = true` | Parent directly accesses the component reference to open the dialog. |
| Parent → This | Calls `getEmployeeImageData()` | Parent triggers image loading after dialog opens in PUT mode. |
| Parent → This | Calls `initEmployeeStatus()` | Parent triggers leave status loading for PUT mode. |
| Parent → This | Calls `generateCode()` | Parent triggers auto ID generation. |
| This → Parent | `RefreshTable.emit()` | After employee save or sub-entity batch save; parent reloads its list table. |
| This → Parent | `RefreshAssetTable.emit()` | After asset add/update/delete in PUT mode. |
| This → Parent | `RefreshBankTable` | Passed as `[refreshTrigger]` to the POST-mode bank table; parent can emit this to force refresh. |
| This → Parent | `IsOpenToastAlert.emit()` | Reserved; not emitted in current code. |
| This → Child `app-attachment-upload` | `itemAttachmentsTab.isEdit`, `isPreview`, `loadInputImages()` | Activates attachment viewing when Attachments tab is selected. |
| This → Child `react-analytical-table` | `staticData.emit()`, `render()`, `staticDataList` | Pushes updated local data to static tables and forces re-render. |
| This → Child `app-custom-grid-table` | `onFilterAndSorting()` | Forces the bank grid to reload from the server. |
| This → Child `app-delete-entity` | `[IsDelete]` EventEmitter binding | Passes the entity path to the delete component for API deletion; receives `(isSuccess)` back. |
| `MediaService` | `setId(res.id)` | Notifies the media/attachment subsystem of the current employee context after save. |

---

## Enums / Models Used

| Name | Kind | Source | Role |
|---|---|---|---|
| `Employee` | Model class | `@shared/model/employee` | Main form data model; input and working copy. |
| `EmployeeSalary` | Model class | `@app/modules/hr-management/shared/models/EmployeeSalary` | Salary data model. |
| `EmployeeHasAsset` | Model class | `@app/modules/hr-management/shared/models/employeeHasAsset` | Asset assignment model. |
| `EmployeeBank` | Model class | `@shared/model/employeeBank` | Bank info model. |
| `EmployeeShift` | Model class | `@app/modules/hr-management/shared/models/employeeShift` | Shift model. |
| `EmployeeSection` | Model class | `@app/modules/hr-management/shared/models/employeeSection` | Section model. |
| `EmployeeType` | Model class | `@app/modules/hr-management/shared/models/employeeType` | Employee type model. |
| `Designation` | Model class | `@app/modules/hr-management/shared/models/designation` | Designation model. |
| `Department` | Model class | `@app/shared/model/department` | Department model. |
| `Asset` | Model class | `@app/shared/model/asset` | Asset model. |
| `Gender` | Enum | `@shared/enums/gender` | Values populate the Gender select options. |
| `Religion` | Enum | `@shared/enums/religion` | Values populate the Religion select options. |
| `BloodGroups` | Enum | `@shared/enums/bloodGroups` | Values populate the Blood Group select options. |
| `saveMode` | Enum | `@shared/enums/saveMode` | `POST` and `PUT` constants; controls form mode and sub-entity save routing. |
| `Permissions` | Enum | `@app/shared/enums/permissions` | Permission keys used in `hasPermission()` checks: `HR_EMPLOYEE_EDIT`, `HR_EMPLOYEE_DELETE`, `HR_EMPLOYEE_ASSET_CREATE`, `HR_EMPLOYEE_ASSET_EDIT`, `HR_EMPLOYEE_ASSET_DELETE`. |
| `ValueState` | Utility | `@shared/utilities/value-state-wrapper` | Wrapper for UI5 value state values (`None`, `Negative`, etc.). |
| `Localization` | Utility | `@shared/utilities/localization` | String constants for UI labels. |

---

## Key Business Logic

### Dual-Mode Persistence Strategy
The component behaves fundamentally differently based on `saveMode`:
- **POST:** Assets and bank records are staged in memory (`employeeHasAssetsList`, `employeeBankInfoList`) and only committed to the API via `forkJoin` after the employee record itself is successfully created. The `resEmployeeId` property bridges the timing: once the employee is saved, subsequent sub-entity adds within the same open session are sent directly to the API rather than staged.
- **PUT:** Each sub-entity change (bank, asset) is persisted immediately to the API. There is no staging.

### Salary Decomposition Rule
When a total salary is entered, the component automatically computes salary components using a fixed business rule:
- Basic: 50% of total
- House Rent: 30% of total
- Medical Allowance: fixed BDT 750
- Transport Allowance: fixed BDT 400
- Other Allowance: remainder (total minus all above)

All derived fields are read-only; only `total_salary` is editable.

### Supervisor Self-Reference Guard
If `employee.is_supervisor` is true, `supervisor_id` is cleared before saving, preventing a supervisor from being assigned a supervisor.

### Email Nullification
Empty string emails are converted to `undefined` before the API call to avoid unique constraint violations on an empty string value in the backend.

### Duplicate Employee ID Check
Employee ID uniqueness is checked asynchronously on every keystroke (POST mode only) via an OData filter query. The `employeeIdExists` flag is then re-evaluated during the synchronous `coreDataValidation()` on save, providing both real-time feedback and save-time enforcement.

### Leave Tab Availability
The Leave tab is only rendered when `saveMode === 'PUT'`. The actual leave data (`EmployeeStatus`) is loaded by the parent component calling `initEmployeeStatus()`, not by `ngOnInit`.

### Address Synchronization
The "Same as Present Address" checkbox creates a one-way copy: present address is copied to permanent address. The permanent address becomes read-only. If the present address is later cleared, the checkbox is automatically unchecked and the permanent address field becomes editable again.

### Asset Name Resolution in Table
The asset table column for `asset_id` does not use an expand/join. Instead, the `Cell` renderer performs a client-side lookup against the locally loaded `this.assets` array, matching by `id`. This means the asset must be present in the locally fetched list to display its name.

### `resEmployeeId` — Mid-Session Sub-Entity Association
After a new employee is saved in POST mode, `resEmployeeId` is set to the new employee's server-assigned ID. Any subsequent bank or asset additions within the same dialog session (while the dialog is still open after save) will use this ID and make direct API calls rather than staging locally. This handles the edge case of a user saving the employee and then immediately adding more sub-entities before closing the dialog.

### Permission-Gated Table Actions
Action columns (Edit/Delete buttons) are only injected into table column definitions when the current user has the appropriate permission. This check happens at column-build time (constructor for bank columns; at render time via `tableColumnnAssets()` being called inline in the template). This means the Delete button routes correctly based on mode: local list deletion in POST mode, and API deletion via `IsDelete` emitter in PUT mode.
