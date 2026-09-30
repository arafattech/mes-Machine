# HR Management — Employee Dashboard: My Calendar

## Files
```
employee-dashboard/
└── my-calendar/
    ├── my-calendar.component.ts    ← Angular (read-only FullCalendar)
    ├── my-calendar.component.html  ← Template
    └── my-calendar.component.scss  ← FullCalendar (.fc-*) theming only
```

## Mounted In
`employee-dashboard.component.html` — `<app-my-calendar [employee]="selectedEmployee">` inside the **My Calendar** tab.

## Purpose
Read-only month calendar showing the logged-in employee's **off days** for the selected year. Renders two categories sourced from a single table (`employee_weekends`):
- **Weekend** (`type = WEEKEND`) — grey background tint
- **Holiday** (`type !== WEEKEND` and `type !== LEAVE`, e.g. `INDUSTRIAL_HOLIDAY`) — red background tint

`LEAVE` rows are excluded. Clicking a date does nothing (display only — no dialog, no add, no selection).

---

## Migration Note
Replaced the legacy shared `<app-calendar>` (`@app/shared/components/calender`) with the FullCalendar-based view used by `CalenderManagementComponent` (leave-management → calender-management). The visual/theming pattern is copied from that component.

**Current state (post subsequent re-additions — do not trust the older "removed" list below if it
conflicts with source, always verify against `loadCalendarData()`):** the data layer combines
`hrm/employee-weekends` (REST) with an OData `Employees(id)?$expand=leaveRequests(...)` call for
approved leave dates, an OData `HolidayTypes` fetch for per-type colors, and an OData
`EmployeeHolidaySwaps` fetch to remap swapped weekend dates (see "Holiday-swap remap" below).
Approved leave dates and holiday-type colouring were re-added after this doc's original "removed"
note was written — the method itself is `loadCalendarData()`, not `loadWeekends()`.
---
## MyCalendarComponent

### Selector
`app-my-calendar`

### Declared In
`HrManagementModule` (non-standalone). Module imports `FullCalendarModule`.

### Inputs
| Name | Direction | Purpose |
|------|-----------|---------|
| `employee` | `@Input` | Employee object; only `employee.id` is read |

### ViewChild
| Ref | Type | Purpose |
|-----|------|---------|
| `fullCalendar` | `FullCalendarComponent` | Calendar API for nav + event re-paint |

### Key Properties
| Property | Type | Purpose |
|----------|------|---------|
| `loading` | `boolean` | Busy indicator |
| `selectedYear` / `selectedMonth` | `number` | Current view position |
| `specialDates` | `CalendarSpecialDate[]` | Mapped weekend/holiday dates with colour + `isWeekend` |
| `weekendColor` | `#7e7e7e` | Weekend tint |
| `holidayColor` | `#ef4444` | Holiday tint |

### Key Methods
| Method | Description |
|--------|-------------|
| `ngOnInit` | Initial `loadCalendarData()` |
| `ngOnChanges` | Reloads when `employee` input changes (skips first change — handled by ngOnInit) |
| `loadCalendarData()` | `forkJoin`s weekends + approved leave dates + holiday types + holiday swaps; filters `LEAVE` rows out of weekends; maps everything to `specialDates`; repaints |
| `refreshCalendarEvents()` | Clears + re-adds background events on the FullCalendar API; guarded when API not yet mounted |
| `labelFor(type)` | `INDUSTRIAL_HOLIDAY` → `Industrial Holiday` (snake → Title Case) |
| `formatDate(date)` | `DateFormatterService` → `YYYY-MM-DD` |
| `prevMonth` / `nextMonth` / `goToday` | FullCalendar API nav |
| `legendTypes` (getter) | Unique `{name,color}` from `specialDates` for the footer legend |
| `currentMonthYearLabel` (getter) | e.g. `JUNE 2026` (uses `Month` enum) |

### CalendarOptions
`dayGridMonth`, `headerToolbar: false`, `editable: false`, `selectable: false`, **no `dateClick`** (read-only).
- `datesSet` — tracks month/year; reloads data on year change, repaints otherwise (also guarantees events paint after mount).
- `dayCellDidMount` — injects a `.fc-cell-labels` container per cell.
- `eventDidMount` — appends a `.fc-off-day-label` (weekend/holiday name) into that container.

### API Calls
| Method | Endpoint | OData | Purpose |
|--------|----------|-------|---------|
| GET | `hrm/employee-weekends?employee_id=X&year=Y` | ✗ (REST, `commonService.api`) | Weekend + holiday dates for the employee/year |
| GET | `Employees(X)?$expand=leaveRequests(...)` | ✓ | Approved leave dates (see `loadCalendarData()` below) |
| GET | `HolidayTypes` | ✓ | Holiday type colors |
| GET | `EmployeeHolidaySwaps?$filter=employee_id eq X and type eq 'WEEKEND'` | ✓ | Swap remap — see below |

Backend: `EmployeeHolidayController@index` → `EmployeeWeekend` model (`employee_weekends` table; columns `weekend_date`, `type`, `is_industrial`).

### Holiday-swap remap (`loadCalendarData()`)
`loadCalendarData()` (the method actually driving the widget — supersedes the older `loadWeekends()`
description above if it's ever found to diverge; both fetch the same weekend source) now also fetches
`EmployeeHolidaySwaps?$filter=employee_id eq {id} and type eq 'WEEKEND'` in the same `forkJoin` as the
weekend/leave/holiday-type requests. For every weekend row whose original date matches a swap's
`original_holiday_date`, the date pushed into `specialDates` is the swap's `swapped_holiday_date`
instead of the raw `weekend_date` — so "My Calendar" shows the employee's off-day on its
swapped-to date, consistent with [leave-transfer](../../leave-management/leave-transfer/context.md)
and [calender-management](../../leave-management/calender-management/context.md#holiday-swap-remap-in-loademployeeweekends--display-only-dont-conflate-with-syncweekendoptionswithdata).
This widget is read-only (no Save), so it has none of `calender-management`'s "Save re-persists the
swapped date" caveat — it only ever displays, never writes, `employee_weekends`.

---

## Styling
- Layout: Tailwind utilities only.
- `.fc-*` internals: scoped `::ng-deep` SCSS (FullCalendar third-party DOM cannot be styled by Tailwind). Mirrors `calender-management.component.scss` minus the add-holiday plus-button and clickable-cell cursor.

## Notes
- Year navigation across the Dec→Jan boundary triggers a fresh fetch for the new year.
- The shared `<app-calendar>` component is untouched — still used by leave-section, leave-request, leave-transfer.
