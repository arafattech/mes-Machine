# Calendar Management — Component Context

## Purpose
HR calendar for managing employee off-days (personal weekends) and viewing industrial holidays.
Two modes: **Individual** (per-employee) and **Industrial** (apply holidays to all employees).

---

## Architecture

### Data Sources
| Source | API | Purpose |
|--------|-----|---------|
| `employee_weekends` | `hrm/employee-weekends` | Personal off-days per employee (WEEKEND, holiday types) |
| `holidays` | `hrm/holidays` | Shared industrial holidays (read-only reference) |
| `HolidayTypes` | OData | Type definitions with colors (Religious, National, etc.) |

### Key Arrays
- **`this.holidays`** — merged display list: `[...manualHolidays, ...weekendHolidays, ...industrialHolidays]`
- **`this.weekendHolidays`** — loaded from `employee_weekends` (LEAVE type excluded), normalized to `start_date`
- **`this.manualHolidays`** — always `[]`; items added via form go directly into `this.holidays`
- **`this.specialDates`** — calendar color data, built from `this.holidays` via `updateSpecialDates()`
- **`this.industrialHolidays`** (local in `loadEmployeeWeekends`) — marked `_readOnly: true`, display-only

### Holiday Interface
```ts
interface Holiday {
  id?: number;
  start_date: string;   // YYYY-MM-DD
  end_date?: string;
  type_id: number | null; // null = plain WEEKEND (no holiday type) — never default this to 0, see below
  type: string;         // normalized UPPER_SNAKE by save
  _readOnly?: boolean;  // true = from hrm/holidays, never saved to employee_weekends
}
```

`type_id` must default to `null`, not `0`, whenever a loaded record has no type (plain weekend day). `0` round-trips straight back into the save payload (`saveAllChanges` spreads `item.type_id` as-is) and the DB's `type_id` FK to `holiday_types` has no row `0` — the backend now also guards this with `?:` instead of `??`, but the frontend should not manufacture the sentinel in the first place.

---

## FullCalendar Integration
Uses `@fullcalendar/angular` daygrid + interaction plugins. `calendarOptions` carries only calendar behavior (view, click handlers, `datesSet`) — no styling. All visual rendering lives in the HTML via the Angular content-projected template slots the `@fullcalendar/angular` adapter exposes (`dayHeaderContent`, `dayCellContent`), styled with Tailwind classes directly, no SCSS/`::ng-deep`.

- `<ng-template #dayHeaderContent let-arg>` — weekday label (`arg.text`).
- `<ng-template #dayCellContent let-arg>` — day number (indigo pill via `arg.isToday`, dimmed via `arg.isOther`) plus the inline "add holiday" `+` button, a real `<button (click)="addHoliday($event, arg.date)">` — no imperative DOM injection, no `dayCellDidMount`, no `NgZone`.
- `addHoliday(event, date)`: `stopPropagation()` then calls `onCalendarDayClick(date.toISOString().slice(0, 10))`.
- Theme-driven FullCalendar CSS vars (`--fc-border-color`, `--fc-today-bg-color`) set via `[ngStyle]` on the grid wrapper, switched by `theme.isDarkTheme()` — the only way to theme FullCalendar's own generated grid lines/today-highlight without touching its internal DOM.

### Events (native FullCalendar rendering, matches `app-my-calendar`)
- `refreshCalendarEvents()`: `api.removeAllEvents()` then `api.addEvent({ start, allDay: true, title, backgroundColor, borderColor })` per `specialDates` entry — a normal foreground event chip with its title visible in the cell, not a background tint.

### specialDates
```ts
specialDates: { date: string; type: string; color: string; isWeekend: boolean }[]
```
- Multiple entries per date are allowed (unique key is `employee_id + weekend_date + type`) — each renders as its own event chip, stacking like a normal calendar.

---

## Individual Mode — Save / Sync

### Flow
1. User edits `this.holidays` (add via form, remove via `removeHoliday`)
2. Click Save → `saveAllChanges()`
3. Frontend filters: `this.holidays.filter(item => !item._readOnly)` — excludes industrial holidays
4. Sends `{ employee_id, data: [...personalRecords], year: selectedYear, sync: true }` to `hrm/employee-weekends`
5. Backend: delete ALL non-LEAVE records for employee+year → `updateOrCreate` each from payload
6. On success: `loadAllData()` → `loadEmployeeWeekends()` → rebuild `this.holidays`

### Why `_readOnly` Filter
Industrial holidays from `hrm/holidays` must NOT be stored in `employee_weekends`. If sent, they create duplicate entries (loaded twice on reload: from `employee_weekends` + `hrm/holidays`). Filter by `_readOnly: true` prevents this.

### Why Filter LEAVE
`employee_weekends` stores LEAVE records (type = 'LEAVE'). These are managed separately (leave requests, not calendar). `weekendHolidays` mapping filters `type !== 'LEAVE'` to exclude them from the display/sync. Backend also skips `type === 'LEAVE'` on insert.

### `_readOnly` Source
Set in `loadEmployeeWeekends`:
```ts
const industrialHolidays = (holidaysRes || []).map((item: Holiday) => ({
  ...item,
  type: this.holidayTypes.find((t) => t.id === item.type_id)?.name || '',
  _readOnly: true,
}));
```

---

## Industrial Mode — Save

Posts once to `hrm/employee-weekends/bulk` with `{ all_active: true, data, year }` — backend resolves the employee set itself (`Employee::where('is_active', true)`), no per-employee frontend loop. Uses scoped delete (by `payloadTypes`/`payloadDates` only) — does NOT use `sync: true`. This preserves each employee's personal WEEKEND records that aren't in the industrial payload.

## Individual Mode — Two employee pickers, two different selection modes

Both pickers filter only `is_active eq true` — no department combobox, no `department_id` scoping.
They are **not** the same widget wired twice; each drives its own piece of state, though the two
stay linked so the calendar shown always matches the employee(s) currently targeted:

- **Toolbar** (calendar home view, always visible): **single-select** —
  `onEmployeeSelect(item)`, `(selectionChange)`, `[value]="employeeDisplayValue"`. Picking here sets
  `this.employee` (whose calendar is displayed/edited) and resets `selectedEmployees` down to just
  that one employee.
- **Settings dialog** (gear icon → Individual tab): **multi-select** —
  `onEmployeeMultiSelectChange(items)`, `(selectionListChange)`, `[selectedItems]="selectedEmployees"`.
  This is the bulk-save target list; the first pick also becomes `this.employee` so the previewed
  draft (Add Holiday / Off Day tabs) matches. `saveAllChanges()` branches on
  `selectedEmployees.length`: exactly one → single-employee `hrm/employee-weekends` (`sync: true`);
  2+ → `hrm/employee-weekends/bulk` with `employee_ids` (Industrial still uses `bulk` with
  `all_active: true`, unrelated to this list).

This split (toolbar single / dialog multi) was deliberately chosen after multi-select-everywhere was
tried and reverted twice — full history in the docs mirror:
`Frontend/docs/hr-management/leave-management/calender-management/context.md`.

---

## Backend: `EmployeeHolidayController@store`

### `sync: true` path (Individual)
```php
// delete all non-LEAVE for employee+year, then reinsert — wrapped in DB::transaction
DB::transaction(function () use (...) {
    EmployeeWeekend::where('employee_id', $employeeId)
        ->whereYear('weekend_date', $year)
        ->where('type', '!=', 'LEAVE')
        ->delete();
    foreach ($weekends as $weekend) {
        $type = $weekend['type'] ?? 'WEEKEND';
        if ($type === 'LEAVE') continue;
        EmployeeWeekend::updateOrCreate([...], ['type_id' => $weekend['type_id'] ?: null, ...]);
    }
});
```
Transaction-wrapped (both this path and the Industrial scoped-delete path below) so a mid-loop failure rolls back the delete instead of leaving the employee's year data wiped with nothing reinserted. `type_id` is coerced with `?:` (not `??`) so a stray `0` from the frontend is also treated as "no type" — `0` is not a valid `holiday_types.id` and previously triggered an FK violation that aborted the save after the delete had already committed.

### Scoped delete path (Industrial)
Scopes delete by `payloadTypes` (types present in payload) and `payloadDates`. Only touches types+dates that are being managed. Preserves unrelated types (e.g. personal WEEKEND).

---

## DB: `employee_weekends`
| Column | Notes |
|--------|-------|
| `employee_id` | FK to employees |
| `weekend_date` | DATE |
| `type` | UPPER_SNAKE string (WEEKEND, RELIGIOUS_HOLIDAY, etc.) |
| `status` | APPROVED by default |
| unique key | `(employee_id, weekend_date, type)` — allows same date, different types |

Migration: `2026_06_23_000001_update_employee_weekends_unique_key.php`
Changed from `(employee_id, weekend_date)` to `(employee_id, weekend_date, type)`.
Two-step migration (add new unique first, then drop old) to avoid FK constraint error.

---

## Date Handling
`DateFromat(date: Date)` uses `DateFormatterService.formatDate(date, false, false, false, false, false)`.
Returns `DD/MM/YYYY`. Then `.split('/').reverse().join('-')` → `YYYY-MM-DD`. ✓
`isUTCNeeded = false` — uses local time. Safe for UTC+ timezones (no day-shift issue).

---

## Type Normalization
`toUpperSnake = (s: string) => s.trim().toUpperCase().replace(/\s+/g, '_')`
Applied on save for all types. DB stores types in UPPER_SNAKE form.
Display lookup: normalize both sides before comparing type name vs stored string.

---

## Off Day Tab — `applyWeekendConfig()`
Local staging only (no API call) — result lands in `this.holidays` and is persisted only when the user clicks the dialog's Save (`saveAllChanges()`).

`applyScope` (`Entire Year` | `Specific Month`) + checked `weekendOptions` days are a **full replace of all `WEEKEND`-type entries for `offDayYear`**, not an additive/scoped merge: every existing `type === 'WEEKEND'` holiday whose year matches `offDayYear` is dropped first, then regenerated only for the scope's month(s) with the checked weekday(s). This means re-applying with a narrower scope (e.g. switching from Entire Year back to one Specific Month) intentionally clears the other months' previously-applied weekend days for that year — it does not leave them layered underneath. Non-`WEEKEND` holidays and other years are untouched.

---

## Settings Dialog
Left panel: Calendar type + employee multi-select + Add Holiday form (or Off Day config based on `individualTab`).
Right panel: Holiday list with color dots, delete buttons, count badge.
`individualTab: 'Holiday' | 'OffDay'` — segment buttons use `(click)` directly (not `selectionChange` event).
`settingsOpen` bound to `[attr.open]` on `ui5-dialog`.

---

## Permissions
| Permission | Scope |
|-----------|-------|
| `HR_CALENDAR_INDIVIDUAL_CREATE` | Individual add/save |
| `HR_CALENDAR_INDIVIDUAL_DELETE` | Individual delete |
| `HR_CALENDAR_INDUSTRIAL_CREATE` | Industrial add/save |
| `HR_CALENDAR_INDUSTRIAL_DELETE` | Industrial delete |
