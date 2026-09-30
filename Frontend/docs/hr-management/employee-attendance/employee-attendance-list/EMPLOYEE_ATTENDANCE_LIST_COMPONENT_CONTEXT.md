# HR Management — Employee Attendance List (Manual Attendance Entry)

## Files
```
employee-attendance-list/
└── employee-attendance-list.component.ts    ← Angular component
└── employee-attendance-list.component.html  ← Template
└── employee-attendance-list.component.scss
```

## Route
`/hr-management/attendence-management/employee-attendence` — `EmployeeAttendanceListComponent`
(`isNewAttendanceButtonVisible=true`, default `apiUrl` is unused, endpoint is `AttendanceLogs`).
This is currently the component's **only** caller — the `[isNewAttendanceButtonVisible]="false"` /
custom `[apiUrl]` read-only-embed path (still present in `ngOnChanges`, swapping
`dataSource.endpoint`/`expand`/`filter` based on that flag) is dead code with no current caller: the
Employee Profile dashboard's Attendance tab used to embed this component that way but now renders its
own inline `app-ag-grid-table` instead (see
[`EMPLOYEE_DASHBOARD_COMPONENT_CONTEXT.md`](../../employee-dashboard/EMPLOYEE_DASHBOARD_COMPONENT_CONTEXT.md#inline-grids-notice--payroll--asset--my-leave--employee-request--attendance)).
Kept in case another read-only embed appears; remove if it stays unused.

## Purpose
CRUD grid over `AttendanceLogs` (create/edit/delete a single employee's daily attendance) plus a
date-range filter, an Employee Type toolbar filter, and an Excel export. This is the **manual entry
path** — distinct from real device/biometric check-ins. Create goes straight to OData
(`POST AttendanceLogs`); edit goes through the dedicated REST checkout endpoint
(`PUT hrm/attendance/{id}/checkout`) so `AttendanceCheckoutService` can recompute overtime and
re-run `OvertimeBonusService::syncForAttendance()`.

---

## EmployeeAttendanceListComponent

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `employees` | `Employee[]` | Options for the "Select Employee" combobox — **not** the full employee table, see [Employee search](#employee-search) below |
| `shifts` | `EmployeeShift[]` | Active shifts, used for the Shift column's multi-select filter |
| `employeeTitle` | `string` | Display value bound to the employee combobox (separate from `attendance.employee_id`) |
| `isHoliday` / `isOnApprovedLeave` / `isSubmitable` | `boolean` | Populated by `hrm/employees/{id}/attendance-check` after picking a date — holiday/leave values control informational warning strips; `isSubmitable` remains true for those dates and is subsequently gated by shift validation |
| `showShiftError` | `boolean` | Set when `validate-checkin` reports the check-in time doesn't match any shift window |
| `dateRangeValue` / `dateRangeFilter` | `string` | Display value (`DD/MM/YYYY - DD/MM/YYYY`) and OData fragment for the date-range picker; defaults to the last 30 days |
| `employeeTypeFilter` | `string` | OData fragment (`employee_type_id eq X`) from the Employee Type toolbar filter, joined with `dateRangeFilter` via `rebuildFilter()` |
| `employeeTypeToolbarFilters` | `AgGridToolbarFilter[]` | Options for the toolbar's Employee Type select, built from `getEmployeeTypes()` |
| `selectedEmployeeTypeId` / `selectedEmployeeTypeName` | `string` | Currently selected Employee Type filter — the name is reused as the export filename segment |
| `IsExportXls` | `EventEmitter<void>` | Emitted by `exportAttendances()`; drives this component's own `<excel-upload-download>` (rendered only when `isNewAttendanceButtonVisible`), which POSTs `hrm/attendance/export` with `getAttendanceExportPayload()`/`getAttendanceExportFileName()` |

### Employee search
`getEmployee(search?: string)` — GETs `Employees?$top=50&$filter=is_active eq true` plus, when a
search term is present, an `or`-joined `contains(tolower(field),'term')` clause across
`employee_no`/`first_name`/`last_name`. Replaces an earlier `$top=10000` "load everyone" call,
which would have started silently missing employees once the table grew past that page size — 50
is a page, not a ceiling, and the query narrows as the user types instead.

- `onEmployeeSearchInput(event)` — bound to the combobox's `(input)` event, 300ms `setTimeout`
  debounce (`employeeSearchDebounce`) before calling `getEmployee(value)`. Skipped when
  `saveMode === PUT` (employee field is read-only during edit).
- Editing an existing row does **not** depend on `employees` containing that employee —
  `editAttendance()` reads `data.employee` directly off the grid row (already `$expand`ed via
  `dataSource.expand: 'employee,shift'`) to set `employeeTitle`/`employee_id`. So a search-narrowed
  `employees` list never breaks showing the currently-assigned employee on edit.
- Term is lightly escaped (`replace(/'/g, "''")`, OData string-literal escaping) before
  interpolation into the filter — an apostrophe in a name (e.g. `O'Brien`) would otherwise break
  the OData filter syntax.

### Key Methods

| Method | Description |
|--------|-------------|
| `newAttendance()` / `editAttendance(data)` | Open the dialog in `POST`/`PUT` mode |
| `onAttendanceDateChange(event)` | Calls `hrm/employees/{id}/attendance-check?date=` — sets `isHoliday`/`isOnApprovedLeave` for warning strips and leaves submission available for leave, weekend, and holiday dates |
| `checkValidation(event, 'check_in_time')` | Additionally calls `hrm/employees/{id}/validate-checkin` to confirm the time falls in a shift window, via `onCheckInResponse()`; a matched shift enables Submit, including on leave/weekend/holiday dates |
| `saveAttendance()` | `POST AttendanceLogs` (create) or `PUT hrm/attendance/{id}/checkout` (edit) — see Purpose above for why these differ |
| `resetFilters()` | Resets the date range to the last 30 days, clears the Employee Type filter, and clears grid search |
| `getEmployeeTypes()` | Fetches `EmployeeTypes?$filter=is_active eq true`, builds `employeeTypeToolbarFilters` (single `select` filter, id `employee_type`) |
| `onToolbarAction(event)` | Handles the toolbar filter's `filter:employee_type` action — sets `selectedEmployeeTypeId`/`selectedEmployeeTypeName`, rebuilds `employeeTypeFilter`, calls `rebuildFilter()` |
| `onDateRangeStringChange(value)` | Parses the picker's `DD/MM/YYYY - DD/MM/YYYY` value → rebuilds `dateRangeFilter` → `rebuildFilter()` |
| `rebuildFilter()` | Joins `dateRangeFilter` + `employeeTypeFilter` with `and`, assigns a new `dataSource` object so the grid detects the change |
| `exportAttendances()` | Emits `IsExportXls` — the actual POST is issued by this component's own `<excel-upload-download>` |
| `getAttendanceExportPayload()` | Builds `{ from, to, employee_type_id, employee_type_name }` from `dateRangeValue` + the selected Employee Type filter |
| `getAttendanceExportFileName()` | `${from}-to-${to}[_<employee_type_name>]_attendance.xlsx` |

### API Calls

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `Employees` (OData, `$top=50`, search-filtered) | Employee combobox options |
| GET | `EmployeeShifts?$filter=is_active eq true` (OData) | Shift filter options |
| GET | `EmployeeTypes?$filter=is_active eq true` (OData) | Employee Type toolbar filter options |
| GET | `hrm/employees/{id}/attendance-check` (REST) | Returns holiday/leave status and the selected-date shift; status is informational and `canSubmit` allows attendance entry |
| GET | `hrm/employees/{id}/validate-checkin` (REST) | Shift-window validation for a check-in time |
| POST | `AttendanceLogs` (OData) | Create attendance |
| PUT | `hrm/attendance/{id}/checkout` (REST) | Edit attendance — triggers overtime/bonus resync |
| POST | `hrm/attendance/export` (REST, via `<excel-upload-download>`) | Excel export — see [Export](#export-hrmattendanceexport) below |

---

## Export (`hrm/attendance/export`)
`AttendanceExportController::export()` (`Backend/app/Http/Controllers/AttendanceExportController.php`)
takes `from`/`to`/`employee_type_id` and streams `App\Exports\AttendanceExport` (`Backend/app/Exports/AttendanceExport.php`)
as an `.xlsx` download. Filename is `{from}-to-{to}[_<employee_type_name>]_attendance.xlsx`.

One row per employee that has at least one `AttendanceLog` in range (employees with **zero** logs in
the whole range — e.g. on leave the entire period — do not get a row; this mirrors the existing
grid, which is also log-driven). Fixed columns: `SL`, `Emp No`, `Employee Name`, `Designation`,
`Shift`, `Total ML`, `Total CL`, `Total FL`, `Total OFF`, `Total Attendances`, `Total OT`, followed by
one column per date in range (`dd/MM` heading).

### `is_ot` — overtime sessions are not regular attendance
`attendance_logs.is_ot` (boolean) marks a log row as an overtime session rather than the employee's
regular shift attendance — see `EmployeeRosterService::resolveIsOt()` for how it gets set (rostered
`EXTRA` assignment → that check-in is OT; otherwise, a 2nd+ same-day check-in retroactively flips the
**earlier** log(s) to `is_ot = true`, so in practice at most one log per employee+date stays
`is_ot = false`). `AttendanceExport` treats these as two disjoint counts:

- **regular** (`is_ot = false`) logs → drive `P` on the date grid, count toward `Total Attendances`
- **OT** (`is_ot = true`) logs → contribute the `+OT` suffix per date, count toward `Total OT` only —
  they do **not** add to `Total Attendances`, since (per the reason the column exists) they were
  created for overtime, not as a second day of regular presence

Same fix applied upstream in `EmployeePayrollController::employePayrollStatus()` (the
`employeeAttendanceInRange` query gained a matching `where('is_ot', false)`), so the payroll
attendance count and its downstream `Payroll.total_attendance` / `PayrollExport` stay consistent with
this export — a day with only an OT log and no regular log doesn't count as attended in either place.

### Per-date cell codes
Each date column resolves to exactly one of (priority order — first match wins):

| Code | Meaning | Source |
|------|---------|--------|
| `P` / `P+OT+OT…` | Present — one `+OT` per `is_ot = true` `AttendanceLog` that day | Regular (`is_ot = false`) log count for employee+date drives `P`; `+OT` count comes from the `is_ot = true` logs that same date, independent of the regular count |
| `CL` / `ML` | Approved casual/medical leave | `LeaveDate` → `leaveRequest` (`final_status = approved`) → `leavetype.name` matched by `medical`/`casual` substring |
| `L` | Approved leave of some other/unmatched type | same as above, name doesn't match either substring |
| `FL + OFF` | **Both** a festival-leave row and a plain-weekend row exist for that employee+date (e.g. a holiday that also falls on their weekly off day) | Two `EmployeeWeekend` rows for the same `(employee_id, weekend_date)` but different `type` — the unique key is `(employee_id, weekend_date, type)`, so this is a real, expected case, not a data error |
| `FL` | Festival/holiday leave (`EmployeeWeekend.type_id` set, i.e. tied to a `HolidayType`) | `EmployeeWeekend`, `status = APPROVED`, `type != LEAVE` |
| `OFF` | Plain weekly weekend off-day (`EmployeeWeekend.type_id` null) | same table, no `HolidayType` link |
| `0` | Absent — no regular log, no approved leave, no weekend/holiday row for that date (a day with **only** an `is_ot = true` log and no regular log also lands here) | default |

`0` is written as the **string** `"0"`, not the int `0` — PhpSpreadsheet's `Sheet::fromArray()` loose-compares
cell values against its null placeholder (`0 == null` is `true` in PHP) and silently skips the cell,
leaving it blank, if given the actual int.

Each date cell also gets a background fill keyed off this code (`cellFillColor()`): green for `P*`,
red for `0`, blue for `OFF`, orange for `FL`, rose for `FL + OFF`, yellow for `CL`, cyan for `ML`,
grey for anything else (e.g. `L`). No legend row is rendered in the sheet (removed per request — the
codes are considered self-explanatory to HR).

`Total FL` / `Total OFF` (replacing an earlier single `Total Weekend` column) are independent lifetime
counts over the export range — computed by `weekendCounts($employeeIds, festivalLeave: bool)`, not
derived from the per-date cells, so they can disagree with a quick visual count of the date columns
(e.g. a `FL + OFF` date contributes to both totals, since it satisfies both queries independently).

`Total OT` is the count of `is_ot = true` `AttendanceLog` rows in range — the same rows that produce
the `+OT` suffixes on the date columns, kept separate from `Total Attendances` per the `is_ot` note
above.

## Notes
- `dataSource`/`toolbarConfig`/columns follow the standard `app-ag-grid-table` server-side OData
  pattern — this doc only covers what's specific to this component (the employee picker and the
  create-vs-edit endpoint split); see [holiday-type-management](../../holiday-type-management/HOLIDAY_TYPE_MANAGEMENT_COMPONENT_CONTEXT.md) for the general dialog/CRUD conventions this codebase follows.
- `displayConfig: AgGridTableDisplayConfig = { gridHeight: 'calc(100vh - 193px)' }` sizes this
  component's own standalone route page. It no longer matters for the Employee Profile dashboard's
  Attendance tab — that tab now renders its own inline grid with its own `attendanceDisplayConfig`
  (`calc(100vh - 250px)`, tuned for that tab's `ui5-card`/tab-strip chrome) instead of embedding this
  component; see the dashboard's own context doc for that history.
- The "Overtime" grid column only ever shows a value when `overtime_status === 'APPROVED'` — it
  reflects the same approval gate documented in
  [Employee Overtime](../employee-overtime/EMPLOYEE_OVERTIME_COMPONENT_CONTEXT.md), not a live
  computed value. It formats via `calculateHoursFromMinutes(overtime_minutes, over_time || '0h 0m')`
  (`@app/modules/hr-management/shared/utilities/dateTime-format`, same helper the Employee Overtime
  grid uses) to match the "Working Hour" column's `1h 50m` style instead of showing the raw
  `overtime_hours`/`over_time` SQL `TIME` string (`"01:50:00.0000000"`).
