# HR Management — Employee Overtime (Duty Approval Queue)

## Files and route

```
Frontend/src/app/modules/hr-management/employee-attendance/employee-overtime/
├── employee-overtime.component.ts
└── employee-overtime.component.html
```

Route: `/hr-management/employee-attendence/employee-overtime` — `EmployeeOvertimeComponent`.

## Purpose

This is the HR approval queue for attendance-related payments. A single `AttendanceLog` can
produce one or more selectable rows:

| Duty type | Eligibility | Approval result |
|---|---|---|
| `OVERTIME` | `overtime_minutes > 0` | Creates the salary-based `OVERTIME` bonus. |
| `HOLIDAY` | Employee checked in on a calendar date with `bonus_mode`. | Creates the configured holiday payment. |
| `EXTRA_SHIFT` | Attendance is marked `is_ot` by the roster. | Creates an `EXTRA_SHIFT` bonus. |

Holiday eligibility is configured in [Calendar Management](../../leave-management/calender-management/context.md).
The calendar has `None`, `Double (OT)`, `Triple`, and `Fixed` modes. Approval is deliberately
required: checking in only creates a pending Holiday row; it does not create money automatically.

For a monthly salary of 6,000, the daily rate is `6,000 / 30 = 200`:

| Calendar mode | Employee Bonus records created after approving the Holiday row | Total pay for that holiday worked |
|---|---|---|
| Double (OT) | `HOLIDAY_BONUS` = 200 | Regular paid day 200 + 200 = 400 |
| Triple | `HOLIDAY_BONUS` = 200 and `HOLIDAY_OVERTIME` = 200 | Regular paid day 200 + 200 + 200 = 600 |
| Fixed | `HOLIDAY_BONUS` = configured fixed amount | Regular paid day + fixed amount |

`HOLIDAY_OVERTIME` is a separate bonus record so it is visible and payable from
[Employee Bonuses](../../employee-payroll/employee-bonuses/EMPLOYEE_BONUSES_COMPONENT_CONTEXT.md).

## Grid and selection

The main `app-ag-grid-table` uses REST/server-paginated mode:

```ts
{
  type: 'api',
  customEndpoint: '/hrm/attendance/duty-rows',
  pageSize: 40,
  scrollPagination: true
}
```

It defaults to the latest seven days. The date picker builds the OData-style date fragment
`attendance_date ge YYYY-MM-DD and attendance_date le YYYY-MM-DD`; the REST controller parses
these two bounds.

`selectionMode="Multiple"` and `selectionRowBehavior="Row"` are intentional. Row clicks and
checkbox clicks are additive: selecting a new row keeps prior selections. The selected rows are
shown in a static-data confirmation grid before approval. The same behavior is used by the
Employee Bonuses grid, including Pay mode.

### Main columns

`buildColumns()` renders employee number/name, overtime hours, attendance date, shift, duty type,
approval status, and created date. Holiday rows additionally show:

- **Bonus Mode** — `DOUBLE`, `TRIPLE`, or `FIXED` from `employee_weekends.bonus_mode`.
- **Bonus Amount** — the total additional amount that approval will generate: daily rate for
  Double, two daily rates for Triple, or the configured fixed amount.

`overtime_hours` is calculated server-side and is populated only for `OVERTIME` rows.

## Component state and methods

| Item | Responsibility |
|---|---|
| `dataSource` | Server-paginated duty queue configuration. |
| `selectedRows` | Current multi-row selection. |
| `onSelectionChanged(rows)` | Stores selected rows and shows Approve only if a pending row is selected. |
| `approveOvertime()` | Drops non-pending selections and opens confirmation. |
| `confirmApprove()` | Sends selected `{ id: attendance_log_id, type: duty_type }` items to the API. |
| `removeSelectedRow(row)` | Removes one item from the confirmation list and deselects it in the main grid. |
| `onDateRangeStringChange()` / `resetFilters()` | Update the date filter and reload the grid. |
| `incrementOvertimeMin()` / `decrementOvertimeMin()` | Step `overtimeMinValue` up/down by `overtimeStep`, clamped to `[0, overtimeMaxHours]`, and re-apply the `overtime_hours ge X` filter. |
| `applyFilters()` | Combines the date-range condition and the min-overtime-hours condition (AND-joined) into `dataSource.filter`. |

A `ui5-progress-indicator` with a `+`/`-` `ui5-button` pair either side is projected into the
grid's toolbar via `app-ag-grid-table`'s `[toolbarExtra]` content-projection slot (see
`ag-grid-table.component.html`) — no slider, since the filter is a single minimum-hours threshold,
not a range. The indicator's `value` is `overtimeMinPercent` (`overtimeMinValue / overtimeMaxHours`
as a percentage) and its `displayValue` shows `"N hour"`. `overtimeMinValue = 0` means no filter.
`resetFilters()` resets it back to `0`.

`loadOvertimeHoursRange()` (called from `ngOnInit`) fetches `EmployeeShifts?$select=total_working_hours`
and sets `overtimeMaxHours` to the longest configured shift's working hours (parsed from the
`"Xh Ym"` string via `parseWorkingHours()`), and `overtimeStep` to `0.5` if any shift's duration
isn't a whole number of hours — so the scale reflects what a shift can actually produce instead of
a fixed guess.

Example request:

```json
{
  "items": [
    { "id": 2190, "type": "HOLIDAY" },
    { "id": 2191, "type": "OVERTIME" }
  ]
}
```

## Backend flow

### `GET hrm/attendance/duty-rows`

`AttendanceLogController::dutyRows()` loads eligible logs, then expands each log into individual
rows in `buildDutyRow()`. Every row has a synthetic `id` such as `2190-HOLIDAY`, while
`attendance_log_id` remains the real database id for approval. This prevents AG Grid row-id
collisions when the same attendance log has both overtime and holiday duties.

The Holiday row includes `holiday_bonus_mode` and `holiday_bonus_amount`. The amount is derived
from `EmployeeWeekend` and the employee's `salary.total_salary` divided by 30.

### `POST hrm/attendance/approve-overtime`

`AttendanceLogController::approveOvertime()` validates every item and approves it by duty type.
The holiday branch sets `holiday_bonus_status` to `APPROVED` and calls
`OvertimeBonusService::approveHolidayDateBonus()`.

`OvertimeBonusService` calculates the daily rate as `total_salary / 30`:

- `FIXED`: saves the configured amount as `HOLIDAY_BONUS`.
- `DOUBLE`: saves one additional daily rate as `HOLIDAY_BONUS`.
- `TRIPLE`: saves one daily rate as `HOLIDAY_BONUS` plus one daily rate as
  `HOLIDAY_OVERTIME`.

`EmployeeBonus::updateOrCreate()` uses the attendance-log id and bonus type, so re-approving a
stale row cannot create duplicate bonus records.

## Payroll interaction

Configured holiday dates are already paid through `employee_weekends`. Payroll therefore excludes
attendance on a bonus-configured holiday from the regular attendance count; otherwise a worked
holiday would be counted twice before its bonus was added. `EmployeePayrollController` includes
`HOLIDAY_BONUS` in `holiday_bonus` and `OVERTIME`/`EXTRA_SHIFT`/`HOLIDAY_OVERTIME` in
`overtime_bonus`. Both are included in the total payroll bonus.

## Related context

- [Calendar Management](../../leave-management/calender-management/context.md)
- [Employee Bonuses](../../employee-payroll/employee-bonuses/EMPLOYEE_BONUSES_COMPONENT_CONTEXT.md)
- [Employee Attendance List](../employee-attendance-list/EMPLOYEE_ATTENDANCE_LIST_COMPONENT_CONTEXT.md)
