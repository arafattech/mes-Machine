# HR Management — Calendar Holiday / Off-Day Management

## Files
```
leave-management/
└── calender-management/
    ├── calender-management.component.ts    ← selector: app-calendar-holiday
    ├── calender-management.component.html
    └── calender-management.component.scss
```

Standalone component (`FullCalendarModule` via `@fullcalendar/angular`), not declared in an NgModule.

## Purpose
Admin screen for managing per-employee or company-wide "Industrial" holidays and weekly off-days:
- **Calendar type** switch: Individual (one or more employees, picked from the full active-employee list) vs Industrial (whole company, no employee picker — `showDeptEmployee=false`).
- Add/remove holidays on the FullCalendar grid, apply weekend/off-day patterns per year (`applyScope`: entire year / from-selected-month), bulk-apply weekends across employees selected in the settings dialog.

Individual mode has **two separate employee pickers with two different selection modes** — see
"Two employee pickers" below for the current split and its history. In short: the toolbar (calendar
home view) picker is single-select; the settings dialog's picker is multi-select and drives the
bulk-save target list. Neither picker has a department filter — both search all active employees
directly (`filterQuery="is_active eq true"`, no `department_id`); previously the picker was
department-scoped and auto-selected the first employee of the first department on load. Now it
defaults to the **logged-in user's own employee record** instead: `selectLoggedInEmployeeByDefault()`
looks up `Employees?$filter=user_id eq {authService.user().id}` and preselects that employee (into
both `employee` and `selectedEmployees`) — same lookup pattern as `requisition-from.component.ts`'s
`autoSelectDepartmentFromEmployee()`. Runs once on init (after holiday types load, before the first
`loadAllData()`) and again on `onCalendarTypeChange()` when switching into Individual with nothing
yet selected. Only fires if `this.employee.id` is not yet set and the logged-in user has a matching
`Employees` row — a non-employee login (no matching row) just leaves the picker empty as before, no
error surfaced.

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `employee` | `Employee` (`@Input`) | The employee whose calendar is displayed/edited — driven by the toolbar picker directly, or by the first entry of `selectedEmployees` when the dialog picker changes; unused as a component `@Input` by any parent (searched — no consumer binds it) |
| `employeeDisplayValue` | `string` (getter) | Text shown in the toolbar `app-server-dropdown`'s input for the current `employee`, via `employeeLabelFn` |
| `selectedEmployees` | `Employee[]` | Bulk-save target list, managed by the settings dialog's multi-select picker; reset to `[employee]` whenever the toolbar picker changes |
| `calendarType` | `string` | `'Indivdual'` (default, sic) / `'Industrial'` |
| `weekendHolidays` / `holidays` | `Holiday[]` | Off-days vs ad-hoc holidays, both rendered as calendar events |
| `weekendOptions` | array | Checkbox-per-weekday config for `applyWeekendConfig()` |

## Two employee pickers, two different selection modes — not the same widget twice

- **Toolbar** (calendar home view, `onEmployeeSelect(item)`, `(selectionChange)`,
  `[value]="employeeDisplayValue"`): single-select. Sets `employee` and collapses
  `selectedEmployees` back down to just that one employee — switching who you're viewing abandons
  any bulk selection made earlier in the dialog.
- **Settings dialog** (gear icon → Individual tab, `onEmployeeMultiSelectChange(items)`,
  `(selectionListChange)`, `[selectedItems]="selectedEmployees"`): multi-select. This is the
  bulk-save target list; its first entry also becomes `employee` so the previewed/edited draft
  (Add Holiday / Off Day tabs) matches whichever employee is first in the list.
- **Save** (`saveAllChanges()`, non-Industrial branch): `selectedEmployees.length > 1` → POST to
  `hrm/employee-weekends/bulk` with `employee_ids: selectedEmployees.map(id)` (the same bulk
  endpoint Industrial's "all active" apply uses, just scoped to the picked IDs instead of
  `all_active: true`). Exactly one employee → single-employee POST to `hrm/employee-weekends`
  (`employee_id`, `sync: true`).
- This is intentionally **not** independent per-employee editing (no switching between employees'
  own separate holiday sets in one dialog session) — picking 3 employees in the dialog and hitting
  Save applies the *same* date/type/bonus list to all 3.

**History**: this screen's employee picker has gone through three shapes. (1) Originally a
`ui5-combobox` + `getEmployee()`/`onEmployeeSearchInput()` server search (see "Employee search"
below), single-select. (2) Replaced with `app-server-dropdown`, and multi-select was introduced
everywhere (toolbar + dialog both `[multiple]="true"`, sharing one `selectedEmployees` array) for a
uniform bulk-apply experience. (3) Multi-select-everywhere was then reverted back to single-select
everywhere per direct instruction, then — in the same follow-up — split into the current shape:
toolbar single-select for "which employee's calendar am I looking at", dialog multi-select for "who
do I apply this save to". If this needs revisiting again, the split (not a return to
uniform single- or multi-select) is what's been asked for twice now — treat that as the stable
shape unless told otherwise.

## Employee search — server-side, not full-list preload

**Problem**: `getEmployee()` originally fetched `Employees?$top=10000&$filter=is_active eq true` in one shot. Lodata silently caps responses at **200 rows regardless of a larger `$top`**, so any org with >200 active employees had employees missing from both employee comboboxes with no error — just absent from the list.

**Fix**: `getEmployee(search?: string)` now:
- Always applies `$top=50`.
- With no `search` term: fetches the first 50 active employees (used for the initial default-select-first-employee behavior in Individual mode — unchanged, `loadEmployeeWeekends()` still fires only for that default-load case, guarded by `!term`).
- With a `search` term: adds `contains(tolower(employee_no),'x') or contains(tolower(first_name),'x') or contains(tolower(last_name),'x')` to the filter and re-queries.

`onEmployeeSearchInput(event)` — bound to `(input)` on both employee `ui5-combobox` elements (top toolbar + settings-panel picker) — debounces via a plain `setTimeout` (300ms, cleared on each keystroke via `employeeSearchTimer`) before calling `getEmployee(value)`. No RxJS `Subject`/`debounceTime` here — this component doesn't otherwise use reactive-forms-style RxJS, so a manual timer matches the existing style.

**Tradeoff accepted**: opening the dropdown with an empty search only shows the first 50 active employees (alphabetical/ID order from the API), not the full org — the user must type to reach anyone outside that batch. There's no dropdown-scroll pagination available (`ui5-combobox`/`ComboBox.js` has no scroll/load-more event — confirmed by reading `@ui5/webcomponents` source), so search-to-narrow is the only practical fix for the 200-row Lodata cap.

**If you hit the same symptom elsewhere** (a `ui5-combobox` silently missing rows past ~200): same root cause, same fix — replace the one-shot `$top=<huge number>` fetch with a debounced `(input)`-driven server search capped at `$top=50` (or similar).

### Search loading indicator — `isEmployeeSearchLoading`

`getEmployee()` sets `isEmployeeSearchLoading = true`/`false` around the request. Shown as a `ui5-busy-indicator[slot="icon"][size="S"]` swapped into the combobox's own `icon` slot via `*ngIf` (both the toolbar and settings-panel comboboxes).

**Pitfall — don't toggle a slotted child of an open `ui5-combobox` on every keystroke's response.** Adding/removing the `slot="icon"` busy-indicator via `*ngIf` forces the web component to re-render, which can drop the user's typed buffer mid-search — symptom: after each search response lands, the user has to add/remove a letter to "wake" the filter again. Confirmed this is exactly what the `*ngIf` icon-slot toggle caused here. If a loading affordance is needed near an actively-typed combobox, prefer something **outside** the combobox's own DOM (e.g. a thin `animate-pulse` line under the field's label) rather than a slotted child that mounts/unmounts while the component has focus.

Currently reverted back to the icon-slot droplet per explicit instruction — be aware of the tradeoff above if the "stuck typing" symptom resurfaces.

## Per-date bonus config

Every date HR adds to "Current Holidays" (Individual or Industrial) can independently be flagged
for a payroll bonus — this replaced an earlier design where a whole *holiday type* (e.g. "Eid")
carried a fixed bonus rule. That was too rigid: it couldn't express "double pay on these 3 specific
dates, a flat 500tk on these other 2" within one holiday. Now bonus config lives on the date
itself.

**Data model**: `Holiday` stores `bonus_mode?: 'DOUBLE' | 'TRIPLE' | 'FIXED' | null` and
`bonus_amount?: number | null`. These map 1:1 to `employee_weekends.bonus_mode` and
`employee_weekends.bonus_amount`, so the configuration is per employee and date.

**UI**: select one or more rows in Current Holidays and click Set Bonus. The UI5 combobox stores
stable values while showing `None`, `Double (OT)`, `Triple`, and `Fixed`. `onBonusModeChange()`
updates `bonusModeDraft`; only Fixed displays `bonusAmountDraft`. `applyBonusToSelected()` updates
the selected in-memory `holidays[]` rows and the outer Save persists them. Badges show `2x`, `3x`,
or the fixed amount.

For a monthly salary of 6,000 (daily rate 200), approval in Employee Overtime creates:

| Mode | Bonus records | Total holiday-work pay |
|---|---|---|
| Double (OT) | `HOLIDAY_BONUS` = 200 | 200 normal holiday pay + 200 = 400 |
| Triple | `HOLIDAY_BONUS` = 200 and `HOLIDAY_OVERTIME` = 200 | 200 + 200 + 200 = 600 |
| Fixed | `HOLIDAY_BONUS` = configured amount | Normal holiday pay + fixed amount |

Calendar configuration only creates a pending holiday-duty eligibility flag. HR must approve the
Holiday row in [Employee Overtime](../../employee-attendance/employee-overtime/EMPLOYEE_OVERTIME_COMPONENT_CONTEXT.md)
before either Employee Bonus record is created.

**Save/load wiring**: `saveAllChanges()` includes `bonus_mode`/`bonus_amount` in both the
Industrial (`hrm/employee-weekends/bulk`) and Individual (`hrm/employee-weekends`, single
`employee_id`, via the existing `{...item}` spread) payloads. `loadAllData()` (Industrial) and
`loadEmployeeWeekends()` (Individual) both carry these two fields back out of the API response
when re-populating `holidays`/`weekendHolidays` — **this matters**: before this fix, the
Individual-mode reload dropped `bonus_mode`/`bonus_amount` (and, as a latent pre-existing bug,
`type_id` too) entirely, so simply reopening the calendar and saving again — even without
touching bonus at all — would silently wipe any previously configured bonus on every date.
`EmployeeHolidayController::index()` (backend, the endpoint both loaders call) was updated to
actually select `bonus_mode`/`bonus_amount`/`type_id` — it previously only returned
`weekend_date`/`type`/`is_industrial`.

**Bonus computation**: `OvertimeBonusService::holidayBonusConfigFor(Employee, date)` reads this
config at attendance-sync time; see
[holiday-type-management's Bonus rules](../../holiday-type-management/HOLIDAY_TYPE_MANAGEMENT_COMPONENT_CONTEXT.md#bonus-rules)
for the full eligibility/approval flow (approval-gated via
[Employee Overtime](../../employee-attendance/employee-overtime/EMPLOYEE_OVERTIME_COMPONENT_CONTEXT.md)).

## Not covered here
FullCalendar event wiring is unchanged by this session's work — not documented in detail here;
read the component directly if touching it.

## Off Day tab — `applyWeekendConfig()` is a full replace per year, not additive

Clicking "Apply Weekend" is local staging only (no API call yet — persisted on the dialog's Save).
It drops **every** existing `type === 'WEEKEND'` entry in `this.holidays` whose year matches
`offDayYear` first, then regenerates only for the current `applyScope` (`Entire Year` one shot, or
`Specific Month` → `offDayMonth`) with the currently checked `weekendOptions` days. This is
intentional: re-applying with a narrower scope (e.g. an accidental "Entire Year" apply, corrected
by switching to one `Specific Month` and re-applying) must clear the other months' previously
staged weekend days for that year, not layer on top of them. Prior to this fix the filter only
dropped `WEEKEND` entries inside the *new* scope's months, so narrowing the scope silently left the
old wider-scope days behind — "Current Holidays" kept showing entire-year weekend dates no matter
how many times a single-month scope was re-applied. Non-`WEEKEND` holidays and other years are
untouched either way.

## `type_id` must default to `null`, never `0` — FK violation wipes saved data

`Holiday.type_id` is `number | null`. Both loaders that reconstruct a plain WEEKEND record from the
API (`loadAllData()` for Industrial, `loadEmployeeWeekends()` for Individual) previously defaulted
a missing `type_id` to `0` (`item.type_id ?? 0` / `holidayType?.id ?? 0`). `saveAllChanges()` spreads
`item.type_id` straight into the save payload, so that `0` round-tripped back to the backend, which
inserts it against `employee_weekends.type_id`, a nullable FK to `holiday_types` — there is no
`holiday_types` row with id `0`, so the insert threw an FK-violation `QueryException`.

This surfaced as: apply an Off Day config, Save (works — no stale `0` in a fresh in-memory record
yet) → reload repopulates `this.holidays` with `type_id: 0` for those WEEKEND rows → reopen the
dialog, change the weekend-day selection, Save again → **"Something went wrong"**, and because the
Individual `sync: true` backend path deleted-then-reinserted without a transaction, the delete had
already committed before the FK error aborted the insert loop — every holiday for that
employee/year was gone on reload, not just unsaved.

Fixed on both ends: the two loaders now default to `?? null`, and
`EmployeeHolidayController::store()` (both the `sync: true` and Industrial scoped-delete branches)
now wraps its delete+reinsert in `DB::transaction()` and coerces `type_id` with `?:` (not `??`) so a
stray `0` from any caller is also treated as "no type" instead of reaching the FK — and, being
transactional, a failure now rolls back cleanly instead of leaving the table empty.

## Holiday-swap remap in `loadEmployeeWeekends()` — display-only, don't conflate with `syncWeekendOptionsWithData()`

`loadEmployeeWeekends()` now fetches a third source alongside weekends/holidays:
`EmployeeHolidaySwaps?$filter=employee_id eq {id} and type eq 'WEEKEND'` (see
[leave-transfer](../leave-transfer/context.md) for how these records get created via drag-and-drop).
For every raw `EmployeeWeekend` row whose `weekend_date` matches a swap's
`original_holiday_date`, the row's `start_date`/`end_date` are remapped to the swap's
`swapped_holiday_date` before being merged into `this.holidays` — this is what makes the calendar
grid **show** an employee's weekend chip on its swapped-to date instead of the original.

**This remap is display-only.** `syncWeekendOptionsWithData(this.weekendHolidays)` — which drives
the recurring-weekday checkboxes (Sun/Mon/.../Sat) in the settings panel — is called with the
**raw, pre-swap** `weekendHolidays` array, before the swap remap is applied. Do not swap the order
or feed the remapped array into `syncWeekendOptionsWithData()`: the weekday checkboxes represent
the employee's *recurring* off-day pattern (e.g. "every Friday"), which a one-off date swap must
not change.

**Caveat — hitting Save after a swap is visible can silently promote it to a recurring record.**
`this.holidays` (the display array used to render the calendar and the "Current Holidays"/weekend
list) carries the swapped dates, and `saveAllChanges()` persists straight from `this.holidays` —
for the Individual branch, every non-`_readOnly` entry in `this.holidays` is POSTed to
`hrm/employee-weekends` (`sync: true`). So if a swap has already been created (via the
leave-transfer dialog) and is now showing in the calendar with its swapped date, simply opening
this screen and clicking "Save" — even without touching anything — will write the **swapped**
date into `employee-weekends` as a real persisted weekend/holiday row, not just a display artifact.
This is a real behavior interaction, not a bug fix made this session — flag it if it comes up.

## `saveAllChanges()` now closes the settings dialog on success

Both branches of `saveAllChanges()` (`calendarType === 'Industrial'` and the per-employee/else
branch) now set `this.settingsOpen = false` inside their success callback, closing the settings
panel dialog automatically after a successful save. Previously the dialog stayed open after Save;
the user had to close it manually via `closeSettings()`.
