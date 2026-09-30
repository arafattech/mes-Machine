# HR Management — Holiday Type Management

## Files
```
holiday-type-management/
└── holiday-type-management.component.ts    ← Angular component
└── holiday-type-management.component.html  ← Template
```

## Route
`/hr-management/holiday-type-management/holiday-type-list` — `HolidayTypeManagementComponent`

Permissions: `HR_HOLIDAY_TYPE` (menu), `HR_HOLIDAY_TYPE_LIST`, `HR_HOLIDAY_TYPE_CREATE`,
`HR_HOLIDAY_TYPE_EDIT`, `HR_HOLIDAY_TYPE_DELETE`.

## Purpose
CRUD screen for `holiday_types` (OData `HolidayTypes`), replacing the previous seeder-only static
list. HR can create/edit/delete holiday types with just a name, color, and active flag — exactly
like `shift-management`. `holiday_types` carries **no bonus-related flag of any kind**; it is a
pure label/color used by the calendar. Bonus rules for holiday dates (Ramadan, Eid, or any other
custom holiday) are configured **per date, in the calendar screen**, not on the holiday type — see
[Bonus rules](#bonus-rules) below and the calendar's own doc for the full mechanism.

> History: an earlier iteration had an `is_eid` switch here that auto-granted a 2×-salary bonus
> for the first 3 days of any Eid-flagged holiday. That was replaced because it couldn't express
> "double pay on these 3 specific dates, fixed 500tk on these other 2" — the current per-date
> config in the calendar (see below) can. `is_eid` was dropped from the schema entirely
> (migration `2026_07_08_131731_drop_is_eid_from_holiday_types_table`).

Structure mirrors `@app/modules/hr-management/shift-management/shift-management.component` 1:1:
`app-ag-grid-table` + `ui5-dialog` form + nested `ui5-color-picker` dialog.

---

## HolidayTypeManagementComponent

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `holidayType` | `HolidayType` | Model bound to create/edit dialog |
| `dataSource` | `AgGridTableODataSourceConfig` | OData `HolidayTypes`, `searchFields: ['name']` |
| `columns` | `AgGridTableColumn<any>[]` | is_active, name, color (badge) |
| `saveMode` | `string` | `POST` (create) / `PUT` (edit) |
| `open` / `colorDialogOpen` | `boolean` | Main dialog / nested color-picker dialog visibility |
| `valueStateOptions.name` | `ValueState` | Required-field validation state for name input |

### Key Methods

| Method | Description |
|--------|-------------|
| `newHolidayType()` | Resets model, sets `POST`, opens dialog |
| `editHolidayType(data)` | Deserializes row into model, sets `PUT`, opens dialog |
| `checkValidation(event, 'name')` | Real-time required validation |
| `validateForm()` | Pre-save validation |
| `openColorPickerDialog()` / `onColorPickerChange()` / `confirmColor()` | Nested `ui5-color-picker` flow, defaults to `rgb(0, 128, 0)` |
| `saveHolidayType()` | POST/PUT to `HolidayTypes` via `CommonService`, refreshes grid, shows toast |
| `deleteClick(id)` | Emits `HolidayTypes/{id}` to `app-delete-entity` |

### Model
`@app/modules/hr-management/shared/models/holidayType` — `HolidayType implements Deserializable`:
`id`, `name`, `color`, `is_active`, `deserialize()`, `toOdata()`.

The read-only interface at `@app/modules/hr-management/shared/interface/holidayTypes` (consumed by
`calender-management`) mirrors the same fields.

---

## Bonus rules

Two payroll bonus types exist alongside the instant NIGHTSHIFT/ATTENDANCE bonuses: RAMADAN and
`HOLIDAY_BONUS`. Both are **approval-gated** like OVERTIME (not instant like NIGHTSHIFT/
ATTENDANCE): `OvertimeBonusService::syncForAttendance()` (called on every checkout, and via an
`AttendanceLog::booted()` `created` observer for records made directly through OData) only
computes and stores an *eligibility flag* on the `attendance_logs` row — it does not create the
`employee_bonuses` row. The bonus is only created when HR explicitly approves the record in the
[Employee Overtime](../employee-attendance/employee-overtime/EMPLOYEE_OVERTIME_COMPONENT_CONTEXT.md)
screen.

### Ramadan bonus
- Eligibility (`OvertimeBonusService::syncRamadanBonus()`): `employee_shifts.is_ramadan_bonus`
  (toggled per-shift in `shift-management`, next to "Night") is true and the attendance has a
  `check_out_time`. Stored as `attendance_logs.is_ramadan_duty`.
- HR manually flips the shift switch on when Ramadan starts and off when it ends — no holiday-type
  or calendar-date config involved.
- Approval: `OvertimeBonusService::approveRamadanBonus()` — pays a **fixed 30 tk**
  (`RAMADAN_BONUS_AMOUNT`) once approved. `attendance_logs.ramadan_status` tracks
  `null` (pending) → `'APPROVED'`.

### Holiday date bonus (Eid or any other holiday)
Fully dynamic, per calendar date, configured entirely in **calender-management** — see
[that component's doc](../../leave-management/calender-management/context.md#per-date-bonus-config)
for the admin-facing UI. Summary of the mechanism:

- Each date HR adds to a holiday (Individual or Industrial) is stored as its own row in
  `employee_weekends`, with two extra columns: `bonus_mode` (`null` / `'DOUBLE'` / `'FIXED'`) and
  `bonus_amount` (used only when `bonus_mode = 'FIXED'`). Both are `null` by default — a holiday
  date carries no bonus unless HR explicitly sets one via the calendar's "Set Bonus" action.
- `OvertimeBonusService::holidayBonusConfigFor(Employee, date)` — looks up the employee's
  `employee_weekends` row for that date and returns it if `bonus_mode` is set, else `null`. This
  is the single source of truth; nothing about the *holiday type* is consulted here.
- `isHolidayBonusOffDay()` — public wrapper used by `EmployeeController::checkAttendanceDate()` to
  waive the weekend/holiday block on manual attendance entry for any date that has a bonus config
  set (regardless of mode) — same behavior as before for every other case (weekend/holiday still
  blocks, approved leave still blocks).
- Eligibility (`OvertimeBonusService::syncHolidayDateBonus()`): a bonus config exists for
  (employee, date) **and** the attendance has a `check_in_time`. Stored as
  `attendance_logs.is_holiday_bonus_duty`. No duty-window/first-N-days logic and no roster
  requirement — HR marks exactly which dates count by setting `bonus_mode` on them individually.
- Approval: `OvertimeBonusService::approveHolidayDateBonus()` re-reads the employee's config for
  that date:
  - `DOUBLE` → pays **2× daily salary** (`total_salary / 30 × HOLIDAY_BONUS_DOUBLE_MULTIPLIER`).
  - `FIXED` → pays the configured `bonus_amount` flat, regardless of salary.
  - Bonus type recorded as `HOLIDAY_BONUS` (`BONUS_TYPE_HOLIDAY`). `attendance_logs.holiday_bonus_status`
    tracks `null` (pending) → `'APPROVED'`.
- `OvertimeBonusService::hasOtherDutyLogSameDay()` — shared guard also used by
  `syncRamadanBonus()`: if the employee already has *another* `AttendanceLog` row for the same
  `attendance_date` with the same duty flag already true, this one is forced ineligible. Prevents
  a duplicate manual attendance entry for a day already claimed from producing a second pending
  duty row (and a second bonus if both were approved).

> Renamed from the old Eid-specific naming: `is_eid_duty`→`is_holiday_bonus_duty`,
> `eid_status`→`holiday_bonus_status`, bonus_type `EID`→`HOLIDAY_BONUS`, payroll field
> `eid_bonus`→`holiday_bonus` (migrations `2026_07_08_131733`, `2026_07_08_132001`,
> `2026_07_08_132530`). If you find old docs/code referencing "Eid bonus", it now means this
> generic per-date holiday bonus.

### Approval screen
See [Employee Overtime](../employee-attendance/employee-overtime/EMPLOYEE_OVERTIME_COMPONENT_CONTEXT.md)
for the full approval-queue mechanism (row-exploding grid, `{items:[{id,type}]}` approve contract,
`type` values `OVERTIME` / `RAMADAN` / `HOLIDAY`).

Both bonuses feed into `EmployeePayrollController::employeeBonusBreakdown()` as `ramadan_bonus` /
`holiday_bonus`, included in `total_bonus` / gross salary, and persisted on the `payrolls` table
(`ramadan_bonus`, `holiday_bonus` columns) when payroll is generated. Displayed in
`employee-payroll` (grid columns), `payroll-process` (live preview tiles), and `payroll-overview`
(processed record tiles).
