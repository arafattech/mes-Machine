# HR Management — Employee Bonuses

## Files
```
employee-bonuses/
└── employee-bonuses.component.ts     ← Angular component
└── employee-bonuses.component.html  ← Template
```

## Route
`/hr-management/employee-payroll/employee-bonuses` — `EmployeeBonusesComponent`

## Purpose
Lists employee bonus records (`EmployeeBonuses` OData) with date-range filtering, a Bonus Type
toolbar filter, and an optional "Pay" mode. In pay mode a left panel lets the user pick an employee;
the right panel shows that employee's bonuses filtered by the selected date range + employee, and
still respects the Bonus Type toolbar filter if one is picked (the filter used to be hidden while
pay mode was on — fixed, see [Notes](#notes)). Selected rows can be bulk-marked as PAID, but only
if their `bonus_type` is one of the payable types — `isPayableBonus()` — which now covers
`OVERTIME`, `RAMADAN`, `EXTRA_SHIFT`, `HOLIDAY_BONUS`, and `HOLIDAY_OVERTIME` (previously `OVERTIME` only). Bonus
details are viewed via an info-button dialog. Export via `excel-upload-download`.

`bonus_type` values today: `NIGHTSHIFT`, `ATTENDANCE` (created instantly, no approval step),
`OVERTIME`, `RAMADAN`, `EXTRA_SHIFT`, `HOLIDAY_BONUS`, `HOLIDAY_OVERTIME` (approval-gated — see below).
This screen has no filter excluding any of them; they surface automatically alongside the others
once approved, no code change was needed here to support them (only the pay-eligibility check
needed updating — see `isPayableBonus()`).

> `HOLIDAY_BONUS` was previously named `EID` — renamed because the underlying mechanism is no
> longer Eid-specific, it pays for any calendar date HR flags with a Double (OT)/Triple/Fixed bonus (Eid or
> otherwise). Migration `2026_07_08_132001_rename_eid_bonus_type_to_holiday_bonus` renamed both
> the `bonus_types` row and existing `employee_bonuses.bonus_type` values.

### Where OVERTIME and holiday rows actually come from
Unlike NIGHTSHIFT/ATTENDANCE, approval-gated bonus types are **never** created by
`OvertimeBonusService::syncForAttendance()` on checkout — that only computes eligibility flags on
`AttendanceLog` (`overtime_minutes`/`is_holiday_bonus_duty`). The actual `EmployeeBonus`
row is created only when HR approves the record in
[Employee Overtime](../../employee-attendance/employee-overtime/EMPLOYEE_OVERTIME_COMPONENT_CONTEXT.md)
(see that doc for the full approval flow). If a bonus is missing here, check that screen for a
still-pending row first. Triple approval creates both `HOLIDAY_BONUS` and `HOLIDAY_OVERTIME`.

---

## EmployeeBonusesComponent

### Selector
`app-employee-bonuses`

### Type
Angular component — three `app-ag-grid-table` instances: pay-employee panel, main bonuses table,
and static-data confirm-pay dialog.

### ViewChild References

| Ref | Type | Purpose |
|-----|------|---------|
| `agGridBonusesRef` | `AgGridTableComponent` | Main bonuses table; `refreshGridData(true)` after filter/mutation |
| `agGridPayModeEmployeeRef` | `AgGridTableComponent` | Left-panel employee picker in pay mode |
| `agGridConfirmPayRef` | `AgGridTableComponent` | Static-data table inside mark-as-paid dialog |

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `bonusesColumns` | `AgGridTableColumn<any>[]` | Column defs for bonuses table — built by `buildBonusesColumns()` |
| `bonusesDataSource` | `AgGridTableODataSourceConfig<any>` | OData config for `EmployeeBonuses`; `filter` updated dynamically |
| `bonusesToolbarConfig` | `AgGridTableToolbarConfig` | Toolbar for bonuses table; `showExtraButton` toggled by selection |
| `payModeEmployeeColumns` | `AgGridTableColumn<any>[]` | Column defs for employee picker panel |
| `payModeEmployeeDataSource` | `AgGridTableODataSourceConfig<any>` | Static OData config for `Employees` (filter: `is_active eq true`) |
| `payModeEmployeeToolbarConfig` | `AgGridTableToolbarConfig` | Toolbar for employee picker panel |
| `payMode` | `boolean` | Toggles pay-overtime mode (switch in bonuses toolbar) |
| `selectedPayEmployee` | `any` | Currently selected employee in left panel |
| `payModeEmployeeId` | `number \| null` | ID of selected employee for OData filter |
| `payModeSelectedRows` | `any[]` | Rows selected in bonuses table (pay mode multi-select) |
| `markPaidRows` | `any[]` | Filtered unpaid overtime rows for mark-as-paid action |
| `dateRangeValue` | `string` | Display value for date range picker (`DD/MM/YYYY - DD/MM/YYYY`) |
| `dateRangeFilter` | `string` | OData fragment for attendance_date range |
| `mainTableFilter` | `string` | Combined OData filter applied to bonuses table |
| `bonusTypeToolbarFilters` | `AgGridToolbarFilter[]` | Options for the toolbar's Bonus Type select, built from `getBonusTypes()` (`BonusTypes` OData, no `is_active` column on that table so all rows are used) |
| `bonusTypeFilter` | `string` | OData fragment (`bonus_type_id eq X`) from the Bonus Type filter; applied whether or not pay mode is on (see Filter Logic) |
| `selectedBonusTypeId` / `selectedBonusTypeName` | `string` | Currently selected Bonus Type filter — the **name** (not id) is what the export endpoint expects (see Export below) |
| `isDialogOpen` | `boolean` | Bonus detail dialog visibility |
| `isMarkPaidDialogOpen` | `boolean` | Mark-as-paid confirm dialog visibility |
| `confirmPayColumns` | `AgGridTableColumn<any>[]` | Columns for the static-data confirmation grid |
| `employeeBonus` | `EmployeeBonus` | Model bound to detail dialog |

### Key Methods

| Method | Description |
|--------|-------------|
| `buildBonusesColumns()` | Returns `AgGridTableColumn[]` — employee_no, first/last name, bonus_type, amount, status, attendance_date, shift, created_at |
| `buildPayModeEmployeeColumns()` | Returns `AgGridTableColumn[]` — employee_no, first/last name, section |
| `buildConfirmPayColumns()` | Returns columns for the confirmation grid |
| `rebuildMainTableFilter()` | Joins date + Bonus Type + employee filters (Bonus Type applies in both modes now); updates `bonusesDataSource` (new object ref); calls `agGridBonusesRef?.refreshGridData(true)` |
| `getBonusTypes()` | Fetches `BonusTypes` (OData, all rows — no `is_active` column), builds `bonusTypeToolbarFilters` (single `select` filter, id `bonus_type`) |
| `onToolbarAction(event)` | Handles the toolbar filter's `filter:bonus_type` action — sets `selectedBonusTypeId`/`selectedBonusTypeName`, rebuilds `bonusTypeFilter`, calls `rebuildMainTableFilter()` |
| `onDateRangeChange(event)` | Parses picker value → updates `dateRangeFilter` → `rebuildMainTableFilter()` |
| `onMainSwitchChange(checked)` | Toggles `payMode`; resets selection; calls `rebuildMainTableFilter()`. The Bonus Type filter stays visible and applied regardless of `payMode` |
| `onPayEmployeeSelect(emp)` | Handles `(rowClick)` from employee panel; sets `payModeEmployeeId`; rebuilds filter |
| `handlePayModeTableData(event)` | Auto-selects first employee on load if none selected and payMode is active |
| `onPayModeRowSelect(rows)` | Handles `(selectionChanged)` from bonuses table; updates `payModeSelectedRows`; refreshes toolbar `showExtraButton` |
| `viewEmployeeBonus(data)` | Opens detail dialog |
| `isPayableBonus(row)` | Normalizes the row's bonus type and checks `payableBonusTypes`, including `HOLIDAYBONUS` and `HOLIDAYOVERTIME` — the single gate controlling payment through this screen |
| `openMarkPaidDialog()` | Filters eligible rows via `isPayableBonus()`; computes total; opens confirm dialog |
| `confirmMarkPaid()` | Closes dialog; calls `onPayModeAction()` |
| `onPayModeAction()` | PUTs selected ids to `employee-bonuses/bulk-mark-paid`; refreshes table on completion |
| `exportEmployeeBonuses(_event)` | Emits `IsExportXls` |
| `getExportPayload()` | `{ from, to }` always; adds `bonus_type: selectedBonusTypeName` whenever a Bonus Type filter is picked (in either mode); adds `emp_id` only in pay mode with an employee selected — no longer force-overrides to `'OVERTIME'` in pay mode |
| `getExportFileName()` | `employee-bonuses-{from}-to-{to}[-<bonus_type, lowercased>].xlsx` |
| `processData(_event?)` | Calls `agGridBonusesRef?.refreshGridData(true)` |

### API Calls

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `EmployeeBonuses` (OData, server-side) | Fetch paginated/filtered bonuses |
| GET | `Employees` (OData) | Employee picker (left panel, pay mode) |
| GET | `BonusTypes` (OData) | Bonus Type toolbar filter options |
| PUT | `EmployeeBonuses(${id})` | Mark bonus as PAID |
| POST | `employee-bonuses/export` (REST, via `<excel-upload-download>`) | Excel export |

### OData Expand
`employee,shift,bonusType,bonusConfig,attendanceLog`

### Filter Logic
`rebuildMainTableFilter()` concatenates with `and`:
1. `attendance_date ge YYYY-MM-DD and attendance_date le YYYY-MM-DD` (always)
2. `bonus_type_id eq ${selectedBonusTypeId}` (Bonus Type toolbar filter — applies in both modes)
3. `emp_id eq ${payModeEmployeeId}` (pay mode + employee selected)

The grid-level Bonus Type filter and the pay-eligibility check are independent: the filter narrows
which rows are *shown*; `isPayableBonus()` narrows which of the shown, selected rows can actually be
marked as paid (`OVERTIME`/`RAMADAN`/`EXTRA_SHIFT`/`HOLIDAY_BONUS`/`HOLIDAY_OVERTIME` — `NIGHTSHIFT`/`ATTENDANCE` never
are, since those are created instantly with no approval step to gate on).

### Multi-row selection

The main bonus table uses `selectionMode="Multiple"` with `selectionRowBehavior="Row"`, matching
Employee Overtime. Checkbox and row clicks are additive, so selecting a later row keeps every
earlier selected row selected. This applies in normal mode and after Pay mode is enabled.

### Toolbar Features (Bonuses Table)
- Date range picker → `(changeRangeDatePicker)` → `onDateRangeChange()`
- Bonus Type select filter → `(toolbarAction)` → `onToolbarAction()`; always visible, in both modes
- Switch "Pay" → `(onSwitchChange)` → `onMainSwitchChange()` (the switch pays eligible selected bonuses, including `HOLIDAY_BONUS` and `HOLIDAY_OVERTIME`)
- Extra button "Mark as Paid" → `(extraButtonClick)` → `openMarkPaidDialog()`; shown only when `hasPayModeSelection`
- Download → `(downloadButtonClick)` → `exportEmployeeBonuses()`
- Info button per row → `(infoClick)` → `viewEmployeeBonus()`

---

## Services Injected

| Service | Usage |
|---------|-------|
| `CommonService` | PUT calls for mark-as-paid |
| `ToastService` | Success / error notifications |

## EmployeeBonus Model
Located at `@app/modules/hr-management/shared/models/employeeBonus`.

Key fields: `id`, `emp_id`, `amount`, `bonus_type`, `status`, `is_paid`, `attendance_date`, `overtime_minutes`, `calculation_type`, `source_type`, `remarks`, `description`, `employee`, `shift`, `bonusType`, `bonusConfig`, `attendanceLog`.

## Notes
- **Bonus Type filter used to disappear in pay mode — fixed.** The template used to bind
  `[toolbarFilters]="payMode ? [] : bonusTypeToolbarFilters"` and `rebuildMainTableFilter()` used to
  skip `bonusTypeFilter` while `payMode` was true, so switching "Pay" on silently hid *and*
  deactivated the dropdown. Now `[toolbarFilters]="bonusTypeToolbarFilters"` unconditionally, and
  `rebuildMainTableFilter()` always includes `bonusTypeFilter` when set — the filter behaves
  identically whether or not pay mode is on.
- **Mark-as-Paid used to be OVERTIME-only — expanded to `isPayableBonus()`.** `overtimeBonusType`
  (a single `"OVERTIME"` string) was replaced by `payableBonusTypes` (a `Set` of normalized type
  codes: `OVERTIME`, `OVERTIMEBONUS`, `RAMADAN`, `EXTRASHIFT`, `HOLIDAYBONUS`,
  `HOLIDAYOVERTIME`), and
  `isOvertimeBonus()` was renamed `isPayableBonus()`. `bulkMarkBonusesPaid()`
  (`EmployeePayrollController.php`) already had no `bonus_type` restriction — the OVERTIME-only gate
  was purely frontend, so this was a frontend-only change.
- **Holiday and overtime bonus payroll breakdown.** `EmployeePayrollController` maps
  `HOLIDAY_BONUS` to `holiday_bonus` and maps `OVERTIME`, `EXTRA_SHIFT`, and
  `HOLIDAY_OVERTIME` to `overtime_bonus`. Both are included in `total_bonus`, gross salary, net
  salary, and the generated Payroll record. Payroll excludes attendance on bonus-configured holiday
  dates from the standard attendance count because those dates are already paid via
  `employee_weekends`; this prevents double-counting the base day before the configured bonus is added.
- **Grid filter vs export filter use different bonus-type keys, on purpose.** The grid's OData
  filter (`bonusTypeFilter`) filters on `bonus_type_id` — the normalized FK the `bonusType` expand
  relation is keyed on (`EmployeeBonus::bonusType() belongsTo(BonusType::class, 'bonus_type_id')`).
  The export endpoint (`Backend/app/Exports/EmployeeBonusesExport.php`) instead matches the legacy
  denormalized string column `employee_bonuses.bonus_type` (`where('bonus_type', $filters['bonus_type'])`)
  — it does not accept a `bonus_type_id` key at all. So `getExportPayload()` deliberately sends
  `selectedBonusTypeName` (e.g. `"OVERTIME"`), not `selectedBonusTypeId`, to match what the export
  controller actually reads. `BonusType.name` values are unique per row, so the name is an
  unambiguous stand-in for the id here.
- Migrated main tables from `CustomGridTableComponent` (React/JSX) to `app-ag-grid-table`.
- Confirm-pay dialog uses `app-ag-grid-table` with static selected-row data.
- `React`, `Button` imports removed — no more JSX in this component.
- `rebuildMainTableFilter()` updates `bonusesDataSource` as a new object reference so Angular detects the change.
- `payModeEmployeeRowIndexes` removed — ag-grid handles row highlight natively.
- `hasPayModeSelection` getter requires `onPayModeRowSelect` and `rebuildMainTableFilter` to sync `bonusesToolbarConfig.showExtraButton` since getters are not live-bound in Angular templates via toolbarConfig objects.
