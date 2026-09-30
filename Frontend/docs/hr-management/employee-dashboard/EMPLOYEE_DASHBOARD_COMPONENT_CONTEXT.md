# HR Management — Employee Dashboard

## Files
```
employee-dashboard/
├── employee-dashboard.component.ts
├── employee-dashboard.component.html
├── employee-dashboard.component.scss
├── asset-section/                    ← AssetSectionComponent (standalone, no longer used by this dashboard)
├── leave-section/                    ← LeaveSectionComponent + view-apply/ViewApplyComponent (standalone, no longer used by this dashboard)
├── my-calendar/                      ← MyCalendarComponent (still embedded, see its own context doc)
└── employee-settings/                ← EmployeeSettingsComponent (dialog opened via userSettings())
```

## Selector
`app-employee-dashboard`

## Purpose
Tabbed "Employee Profile" page — one employee's own view (My Profile/My Leave/My Calendar/Asset/My
Roster) plus a supervisor's read-only rollups (Notice, Payroll, Employee Request, Attendance) for the
same person. Tabs lazy-load their content on first visit (`isTabLoaded`/`visitedTabs`) and the last
opened tab is remembered per-browser (`localStorage['emp_desh_tab']`), so a reload lands back on the
same tab immediately.

## Tabs

| Tab (`ui5-tab` text) | `*ngIf` gate | Content |
|---|---|---|
| My Profile | always | Static profile card + summary tiles (check-in/out time, salary, present count, leave summary) — no grid |
| My Leave | `selectedEmployee?.id` | Inline `app-ag-grid-table` — read-only list, see [Inline grids](#inline-grids-notice--payroll--asset--my-leave--employee-request--attendance) |
| My Calendar | `selectedEmployee?.id` | `app-my-calendar` wrapper (full calendar widget, not a grid) |
| Asset | `employee?.id` | Inline `app-ag-grid-table` — read-only list |
| Notice | `selectedEmployee?.notices?.length > 0` | Inline `app-ag-grid-table`, `(rowClick)="viewNotice($event)"` opens the shared view dialog |
| Payroll | `selectedEmployee?.id` | Inline `app-ag-grid-table`, `(rowClick)="viewPayrollDetails($event)"` opens `app-payroll-overview` |
| My Roster | `selectedEmployee?.id && !selectedEmployee.is_shift_fixed` | `app-roster-table` wrapper (custom week/day shift board, not a grid) |
| Employee Request | `selectedEmployee?.subordinates?.length > 0` | Inline `app-ag-grid-table` — read-only list, supervisor's view of direct reports' leave requests |
| Attendance | `selectedEmployee?.id` | Inline `app-ag-grid-table` — read-only list |

### Inline grids (Notice / Payroll / Asset / My Leave / Employee Request / Attendance)
All six follow the same direct pattern — no wrapper component, `dataSource` + `columns` +
`toolbarConfig` + `displayConfig` are properties on `EmployeeDashboardComponent` itself, and
`app-ag-grid-table` is placed straight in this template (`[isBase]="true"`, `[showAction]="false"`,
`selectionMode="Single"`):

| Tab | `dataSource.endpoint` / `expand` | `filterQuery` | Columns built by |
|---|---|---|---|
| Notice | `NoticesEmployees`, expand `notice` | `employee_id eq {selectedEmployee.id}` | `buildNoticeColumns()` |
| Payroll | `Payrolls`, expand `employee` | `employee_id eq {selectedEmployee.id}` | `buildPayrollColumns()` |
| Asset | `EmployeeHasAssets`, expand `asset` | `employee_id eq {employee.id}` | `buildAssetColumns()` |
| My Leave | `LeaveRequests`, expand `leavetype,employee,weekeend` | `employee_id eq {selectedEmployee.id}` | `buildLeaveRequestColumns()` |
| Employee Request | `LeaveRequests`, expand `employee,leavetype,weekeend` | `employee/supervisor_id eq {selectedEmployee.id}` | `buildLeaveRequestColumns()` (shared with My Leave — identical column set) |
| Attendance | `AttendanceLogs`, expand `shift,employee($expand=employeeType)` | `employee_id eq {selectedEmployee.id}` | `buildAttendanceColumns()` |

All six are **read-only summaries**: no new/edit/delete dialogs, no toolbar new-button, no rowClick
action wiring except Notice/Payroll's view dialogs. `showIllustratedMessage`/`IllustratedName`/
`IllustratedTitle` are set per-tab to preserve each grid's original empty-state message (e.g. "No
Assets Found", "No Attendance Records Found").

**Why this design, not a wrapper component**: My Leave, Employee Request, Asset, and Attendance used
to delegate to `LeaveSectionComponent`/`ViewApplyComponent`/`AssetSectionComponent`/
`EmployeeAttendanceListComponent` respectively. Those wrappers carry full CRUD (apply/edit leave,
approve/reject, new/edit attendance) — far more than this dashboard tab needs. They were replaced
with a direct read-only grid (matching the pre-existing Notice/Payroll pattern) so the dashboard shows
**just the list**, with no dialog/CRUD surface. The wrapper components themselves are unchanged and
still power their own standalone management pages — only this dashboard's template stopped
referencing them.

### `attendanceDataSource` note
Previously this tab bound `[apiUrl]="'/AttendanceLogs?...&$filter=employee_id eq ' + id"` to
`EmployeeAttendanceListComponent`. The leading `/` plus building the whole OData query as one string
was fragile; the current `dataSource` object + `[filterQuery]` binding is the same pattern already
proven by Notice/Payroll and is not sensitive to that class of bug.

### Grid height (`*DisplayConfig`)
Every inline grid gets its own `*DisplayConfig` (`noticeDisplayConfig`, `payrollDisplayConfig`,
`assetDisplayConfig`, `leaveDisplayConfig`, `employeeRequestDisplayConfig`,
`attendanceDisplayConfig`) rather than a shared generic one. The tab strip lives inside a
`ui5-tabcontainer` sized `h-[calc(100vh-80px)]`, and (at ≥1024px width) `employee-dashboard.component.scss`
additionally forces `ui5-card { height: 825px !important }`. A grid height of `calc(100vh - 80px)`
overshoots that fixed card and produces a page-level scrollbar even with the grid empty; `calc(100vh -
193px)` (Payroll/Asset/Leave/Employee Request) / `calc(100vh - 250px)` (Notice/Attendance) both fit
inside the card. There used to be one shared `DisplayConfig` property (`calc(100vh - 80px)`) fed to
the Asset/My Leave/Employee Request/Attendance tabs' old wrapper components — it was removed as dead
code once every tab got its own inline grid + matching height.

## Key Methods

| Method | Purpose |
|---|---|
| `fetchEmployeeData()` | `AuthService.getUser()` → sets `employee`, kicks off `fetchShiftFromRosterOrEmployee` + `fetchEmployeeInfo` |
| `fetchEmployeeInfo(id)` | `GET Employees/{id}?$expand=...` — populates `selectedEmployee`, `employeeHasAssets` (→ `headerTitleAsset`/`assetToolbarConfig.headerTitle` count), `PayrollsList`, `notisList`; triggers `fetchSubordinates` when applicable |
| `fetchShiftFromRosterOrEmployee(id)` | `GET AttendanceLogs?$filter=employee_id eq {id} and attendance_date eq today` — today's check-in/out time for the My Profile tile |
| `initEmployeeStatus(id)` | `GET employePayrollStatus/{id}/{start}/{end}` — populates `EmployeeStatus` (salary, attendance count, leave-in-year) used across My Profile |
| `initRosterData(employee)` | If `is_shift_fixed`, reads `employee.shift.name` directly; otherwise `GET hrm/roster-schedule` for today's assigned shift name |
| `fetchSubordinates(id)` | `GET Employees?$filter=supervisor_id eq {id}` — gates the Employee Request tab |
| `viewNotice(data)` / `viewPayrollDetails(payroll)` | Row-click handlers opening the Notice view dialog / `app-payroll-overview` |
| `onChangeTab(event)` / `selectedTab(tab)` / `isTabLoaded(tab)` | Tab persistence + lazy-load bookkeeping (`localStorage['emp_desh_tab']`, `visitedTabs` set) |
| `downloadPayrollSlip(payroll)` | `POST pdf/generate` (blob) → triggers a client-side download |
| `markAsRead` / `UpdateRead` | `POST hrm/NoticesEmployees/{id}/mark-as-read` from the Notice view dialog |

## Notes
- `selectedEmployee` (from `Employees/{id}?$expand=...`) and `employee` (from `AuthService.getUser()`)
  are two separate objects populated by two different calls — most `*ngIf` gates use
  `selectedEmployee?.id`, but Asset/My Roster use `employee?.id`/`employee.id` (pre-existing, not a
  typo to "fix" — both resolve to the same employee).
- `Employee Request`'s `employee/supervisor_id eq X` filter is a to-one nav-property filter (not a
  collection lambda) — same string format already used by the standalone `ViewApplyComponent`, so any
  OData/lodata support question for that syntax is pre-existing, not introduced by inlining.
- **My Leave has no "Apply Leave" button** — intentional, not a bug/regression. Before inlining, this
  tab rendered `LeaveSectionComponent`, which included the full Apply/Edit/View dialog
  (`toolbarConfig.showNewButton: true`, `(newButtonClick)="newLeave()"`). The inline replacement is a
  deliberate read-only summary (see [Why this design](#inline-grids-notice--payroll--asset--my-leave--employee-request--attendance)),
  so `leaveToolbarConfig.showNewButton` is `false` and there's no `newButtonClick` handler. An employee
  who needs to apply for leave still can — via the standalone Leave Management page, which uses
  `LeaveSectionComponent` unchanged — just not from this dashboard tab. If Apply/Edit is wanted back
  on this tab specifically, that means re-wiring `app-leave-section` (or its dialog/save logic) back
  into the My Leave tab; it's not something the current inline grid can grow into on its own.
