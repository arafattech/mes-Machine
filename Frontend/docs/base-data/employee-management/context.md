# Base Data Management — Employee Management

## Files
```
employees-management/
├── employee-form/
│   └── employee-form.component.tsx    ← React/TSX (complex multi-tab form)
└── employee-list/
    └── employee-list.component.tsx    ← React/TSX list
```

## Route
`/base-data/employees` — `EmployeeListComponent` — guarded by `BASE_DATA_EMPLOYEE`.

## Purpose
Manages **Employee** master records — the most complex entity in the Base Data module. Covers personal details, organizational assignment, bank information, asset assignments, salary, shifts, and profile pictures.

---

## EmployeeFormComponent

### Selector
`app-employee-form`

### Type
React/TSX — multi-tab form with sub-tables and file uploads.

### Inputs

| Input | Type | Purpose |
|-------|------|---------|
| `saveMode` | `string` | `'POST'` or `'PUT'` |

### Outputs

| Output | Type | Purpose |
|--------|------|---------|
| `RefreshTable` | `EventEmitter<any>` | Reloads employee list after save |

### ViewChild References

| Ref | Type | Purpose |
|-----|------|---------|
| `itemAttachmentsTab` | `AttachmentUploadComponent` | Profile picture / document uploads |
| `employeeAssetTable` | `AnalyticalTableComponent` | Asset assignment table (new) |
| `employeeAssetTableEdit` | `AnalyticalTableComponent` | Asset assignment table (edit) |
| `employeeBankTable` | `AnalyticalTableComponent` | Bank info table (new) |
| `employeeBankTableEdit` | `CustomGridTableComponent` | Bank info table (edit) |

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `employee` | `Employee` | Main employee model |
| `EmployeeHasAssetList` | `EmployeeHasAsset[]` | Assets assigned to this employee |
| `EmployeeShift` | `EmployeeShift` | Shift assignment |
| `EmployeeBankList` | `EmployeeBank[]` | Bank accounts |
| `EmployeeSalary` | `EmployeeSalary` | Salary record |
| `Departments` | `Department[]` | Dropdown options |
| `Designations` | `Designation[]` | Dropdown options |
| `EmployeeTypes` | `EmployeeType[]` | Dropdown options |
| `EmployeeSections` | `EmployeeSection[]` | Dropdown options |
| `selectedTab` | `string` | Active tab |

### Key Methods

| Method | Description |
|--------|-------------|
| `saveEmployee()` | Orchestrates save: saves employee, then sequentially saves bank info, assets, salary, shift |
| `loadDropdowns()` | Loads all lookup dropdowns in parallel (departments, designations, types, sections) |
| `saveAssetAssignment()` | Posts `EmployeeHasAsset` records |
| `saveBankInfo()` | Posts `EmployeeBank` records |
| `saveSalary()` | Posts/puts `EmployeeSalary` |
| `saveShift()` | Associates employee with shift |
| `uploadProfilePicture()` | Uses `MediaService` to upload profile image |
| `validateForm()` | Validates required employee fields |
| `addAssetRow()` | Adds empty row to asset assignment table |
| `removeAssetRow(index)` | Removes asset row locally |
| `addBankRow()` | Adds empty row to bank table |
| `removeBankRow(index)` | Removes bank row locally |

### API Calls

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `Departments?$filter=is_active eq true` | Department dropdown |
| GET | `Designations?$filter=is_active eq true` | Designation dropdown |
| GET | `EmployeeTypes?$filter=is_active eq true` | Type dropdown |
| GET | `EmployeeSections?$filter=is_active eq true` | Section dropdown |
| GET | `Assets?$filter=is_active eq true` | Asset picker |
| GET | `Shifts?$filter=is_active eq true` | Shift picker |
| POST | `Employees` | Create employee |
| PUT | `Employees(${id})` | Update employee |
| POST | `EmployeeHasAssets` | Assign asset |
| DELETE | `EmployeeHasAssets(${id})` | Remove asset |
| POST | `EmployeeBanks` | Add bank account |
| PUT | `EmployeeBanks(${id})` | Update bank account |
| POST/PUT | `EmployeeSalaries` | Save salary |
| POST | `employee/shift/associate` | Link employee to shift |
| POST | (media endpoint) | Profile picture upload |

### Template Structure (inferred from ViewChild refs)
```
<app-employee-form>
  └── TabContainer
      ├── Tab: Personal Info
      │   ├── name, employee_id, phone, email
      │   ├── date_of_birth, gender, blood_group
      │   ├── religion, nationality
      │   └── address
      ├── Tab: Employment
      │   ├── Department dropdown
      │   ├── Designation dropdown
      │   ├── EmployeeType dropdown
      │   ├── EmployeeSection dropdown
      │   ├── join_date, end_date
      │   └── Shift assignment
      ├── Tab: Bank Info
      │   └── AnalyticalTable of bank accounts (add/remove rows)
      ├── Tab: Assets
      │   └── AnalyticalTable of asset assignments (add/remove rows)
      ├── Tab: Salary
      │   └── Salary form fields
      └── Tab: Attachments
          └── AttachmentUploadComponent (profile picture, documents)
```

---

## Related Models

### Employee
```typescript
interface Employee {
  id?: number;
  employee_id: string;          // business ID — required
  name: string;                 // required
  email?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;              // enum: Male, Female, Other
  blood_group?: string;         // enum: A+, A-, B+, B-, O+, O-, AB+, AB-
  religion?: string;
  nationality?: string;
  address?: string;
  department_id?: number;
  designation_id?: number;
  employee_type_id?: number;
  employee_section_id?: number;
  join_date?: string;
  end_date?: string;
  is_active: boolean;
  profile_picture?: string;
}
```

### EmployeeHasAsset
```typescript
interface EmployeeHasAsset {
  id?: number;
  employee_id: number;
  asset_id: number;
  assigned_date?: string;
  return_date?: string;
}
```

### EmployeeBank
```typescript
interface EmployeeBank {
  id?: number;
  employee_id: number;
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  branch_name?: string;
  is_primary: boolean;
}
```

### EmployeeSalary
```typescript
interface EmployeeSalary {
  id?: number;
  employee_id: number;
  basic_salary: number;
  allowances?: number;
  deductions?: number;
  effective_date?: string;
}
```

### EmployeeShift
```typescript
interface EmployeeShift {
  employee_id: number;
  shift_id: number;
}
```

---

## Lookup Models

| Model | Dropdown In |
|-------|-------------|
| `Department` | Employee employment tab |
| `Designation` | Employee employment tab |
| `EmployeeType` | Employee employment tab |
| `EmployeeSection` | Employee employment tab |

---

## Services Injected

| Service | Usage |
|---------|-------|
| `CommonService` | All CRUD API calls |
| `ToastService` | Notifications |
| `RolePermissionService` | Action visibility |
| `MediaService` | Profile picture upload |
| `ChangeDetectorRef` | Manual change detection (React/TSX interop) |

## Enums Used
```typescript
enum Gender { Male = 'Male', Female = 'Female', Other = 'Other' }
enum BloodGroups { 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-' }
enum Religion { Islam = 'Islam', Christianity = 'Christianity', Hinduism = 'Hinduism', ... }
```

## Validation Rules (inferred)
- `employee_id` — required, unique
- `name` — required
- At least one bank account should have `is_primary = true` if bank info is provided

## Notes
- This is the most complex form in the module — it orchestrates 5-6 sequential API saves after the base employee record is created.
- `AttachmentUploadComponent` is a shared component across the application — see `shared-components` docs.
- Employee count appears on the home dashboard.
- Departments are managed separately in `department-management`.
- `EmployeeSection` is managed separately under the HRM module (see enhancement/hrm branches).
