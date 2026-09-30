# HR Management — Leave / Holiday Swap Transfer

## Files
```
leave-management/
└── leave-transfer/
    ├── leave-transfer-list/
    │   ├── leave-transfer-list.component.ts
    │   ├── leave-transfer-list.component.html
    │   └── leave-transfer-list.component.scss
    └── leave-transfer-form/
        ├── leave-transfer-form.component.ts    ← drag-and-drop month calendar (Angular CDK)
        ├── leave-transfer-form.component.html
        └── leave-transfer-form.component.scss
```

## Route
`leave-management/leave-transfer` (registered as `leave-transfer` under the HR Management routing module) — sidebar entry "Holiday Swap" under Leave Management.

---

## LeaveTransferListComponent

### Selector
`app-leave-transfer-list`

### Purpose
Log/history grid of `EmployeeHolidaySwap` records (`EmployeeHolidaySwaps` OData endpoint, `expand: 'employee'`). Read-only list — all editing happens through the "New" button, which opens `LeaveTransferFormComponent`'s calendar dialog.

### Key Properties / Methods
- `dataSource` (`AgGridTableODataSourceConfig`): endpoint `EmployeeHolidaySwaps`, `expand: 'employee'`, `searchFields: ['employee.employee_no', 'employee.first_name', 'employee.last_name', 'type']`, `pageSize: 50`.
- `columns`: Employee Name / Employee ID (both `valueGetter`s off `params.data?.employee`) / Original Date / Transfer To / Swap Type / Created On (`GridTableColumnDataType.Date`, formatted via `DateFormatterService`).
- `toolbarConfig.showNewButton` gated on `Permissions.HR_HOLIDAY_SWAP_CREATE`.
- `newLeaveTransfer()` — opens the form dialog (`leaveTransferFormRef.open = true`) in `saveMode.POST`.
- `processData(event)` — bound to the form's `(RefreshTable)` output; emits `refreshTable` upward **and** calls `agGridRef?.refreshGridData(true)` to actually reload the grid.

### Important Caveats
- **Bug fixed this session**: the template previously bound `(RefreshTable)="refreshTable.emit()"`, which only re-emitted the event to the parent and never told the AG Grid instance to refetch — so after creating or removing a swap in the dialog, the log grid behind it stayed stale until a manual page refresh. Now wired to `(RefreshTable)="processData($event)"`, which calls `agGridRef?.refreshGridData(true)`.
- No row-level edit/delete here — swap removal happens inside the form dialog's calendar (see below), not from this grid.

---

## LeaveTransferFormComponent

### Selector
`app-leave-transfer-form`

### Purpose
Dialog for swapping one of an employee's future weekend/off-days onto a different future date, creating an `EmployeeHolidaySwap` record (`type: 'WEEKEND'`). Rewritten this session from a dropdown-based "pick original date / pick target date" UI into a **drag-and-drop month calendar** — the employee's upcoming weekend days render as draggable chips inside a month grid; dragging a chip onto a valid target day cell creates the swap.

### Drag-and-drop mechanics — Angular CDK, not native HTML5 DnD
Uses `@angular/cdk/drag-drop` (`CdkDrag`, `CdkDragDrop`, `CdkDropList`), **not** the native `draggable`/`dragstart`/`drop` HTML5 API. Each day cell in the 7-column month grid is its own `cdkDropList` (`[id]="day.dateStr"`), grouped under a single `cdkDropListGroup` on the outer grid container so a chip can be dropped into any other cell. Each weekend chip is a `cdkDrag` with `[cdkDragData]="day.dateStr"` (the *source* date).

- `dropPredicate(drag, drop): boolean` — wired to `[cdkDropListEnterPredicate]`; a drop target is valid only if `!day.isPast && !day.weekend && !day.swappedTo && drop.id !== drag.data` (must be a future day, not itself already a weekend, not already a swap destination, and not the same cell being dragged from).
- `onListEntered(day)` / `onListExited(day)` — track `dragOverDate` for the hover-highlight ring/background on the cell currently being dragged over.
- `onCalendarDrop(event: CdkDragDrop<string>)` — reads `event.item.data` (source date) and `event.container.id` (target date), then calls `performSwap(sourceDate, targetDate)`.
- `isDraggable(day)` — a weekend chip is only draggable if it hasn't already been swapped away (`!isSwapDateMatched(day.dateStr)`); `[cdkDragDisabled]` is bound to the inverse.

### Calendar model
- `CalendarDay` (local interface): `dateStr`, `dayNum`, `inMonth`, `isToday`, `isPast`, `weekend` (matching `EmployeeWeekend` row for this date, or `null`), `swappedTo` (matching `EmployeeHolidaySwap` row whose `swapped_holiday_date` is this date, or `null`).
- `buildCalendar()` builds a full 7-column, month-plus-lead/trail-days grid (`viewMonth.startOf('month').startOf('week')` through `.endOf('month').endOf('week')`) from `moment`. Rebuilt on `prevMonth()`/`nextMonth()` and after every data reload.
- `holidays` — the employee's raw `EmployeeWeekend` rows (`EmployeeWeekends?$filter=employee_id eq {id} and weekend_date gt {today}`, future only), fetched by `InitEmployeeWeekend(id)`.
- `swapList` — the employee's `EmployeeHolidaySwap` rows of `type eq 'WEEKEND'`, fetched by `InitSwapedList(employeeId)` right after `InitEmployeeWeekend` resolves.

### Cell rendering
- A day with a `weekend` match renders an amber chip showing the holiday-type name (or "Weekend") — draggable if not already swapped, tinted with `day.weekend.type.color` if set; a `(S)` suffix marks a day whose weekend has already been swapped elsewhere (`isSwapDateMatched()`).
- A day with a `swappedTo` match (i.e., this cell **is** a swap destination) renders an emerald pill showing the original date it came from (`formatDate(day.swappedTo.original_holiday_date)`) plus a small "✕" (`icon="decline"`) button calling `removeSwap(day.swappedTo.id)`.

### Employee search — server-side, debounced (mirrors `calender-management.component.ts`)
- `getEmployee(search?: string)` — filters `Employees?$filter=is_active eq true` plus, when a search term is present, `contains(tolower(employee_no|first_name|last_name),'{term}')`. No search term and no employee yet selected → auto-selects the first result and loads its weekend calendar.
- `onEmployeeSearchInput(event)` — bound to the combobox's `(input)`; debounces via a plain `setTimeout` (300ms, cleared each keystroke via `employeeSearchTimer`) before calling `getEmployee(value)`. Same manual-timer pattern as `calender-management`/`leave-section` — no RxJS `Subject` here.
- `isEmployeeSearchLoading` drives a `ui5-busy-indicator[slot="icon"]` inside the combobox while a search request is in flight.
- `employeeDisplayName(employee)` — joins `first_name`/`last_name` filtering out falsy parts before `.join(' ')`, so an employee with no `last_name` shows `"{employee_no} - {first_name}"` instead of `"{employee_no} - {first_name} null"`.

### Creating / removing a swap
- `performSwap(originalHolidayDate, targetDate)` — before posting, does two guard reads: (1) `EmployeeWeekends?...weekend_date eq '{targetDate}'` to reject a target that's already a recurring weekend for this employee, (2) `EmployeeHolidaySwaps?...swapped_holiday_date eq '{targetDate}'` to reject a target already used as another swap's destination. Only after both come back empty does it `POST EmployeeHolidaySwaps` with:
  ```ts
  { employee_id, weekend_id, original_holiday_date, swapped_holiday_date: targetDate, type: 'WEEKEND' }
  ```
  On success: emits `RefreshTable`, shows an "add" toast, and reloads via `InitEmployeeWeekend(selectedEmployeeId)` (which re-chains into `InitSwapedList` and `buildCalendar()`).
- `removeSwap(swapId)` — `DELETE EmployeeHolidaySwaps/{swapId}`, then reloads the same way.

### Important Caveats
- **`CloseDialog()` no longer resets employee/calendar state.** It resets `viewMonth` back to the current month and clears the validation state, but leaves `selectedEmployeeId`, `employeeTitle`, `holidays`, and `swapList` untouched — reopening the dialog keeps the last-picked employee and their calendar instead of forcing a re-search. (Previously this was a full state reset.)
- `weekend_id` sent in the swap payload comes from matching `this.holidays` by `weekend_date === originalHolidayDate` — if that lookup misses (e.g. stale `holidays` array), `weekend_id` is posted as `null`; the backend column is nullable so this doesn't hard-fail, but it does leave the swap's `weekend()` relation unresolvable and the row won't cascade-delete if the underlying weekend record is later removed.
- Only weekend-type swaps are handled here (`type: 'WEEKEND'` hardcoded) — the `EmployeeHolidaySwap` model itself supports a generic `type`/`status`/`reason` shape (default `'HOLIDAY'`/`'APPROVED'`) for potential non-weekend use, but this component only ever creates `WEEKEND` swaps.
- Dialog footer has only a Cancel button — there's no explicit Save; every drag-drop directly persists via `performSwap()`.

## Backend companion
`EmployeeHolidaySwaps` (Lodata OData resource over `App\Models\EmployeeHolidaySwap`) gained a nullable `weekend_id` FK → `employee_weekends.id` with `cascadeOnDelete()` (migration `2026_07_23_000001_add_weekend_id_to_employee_holiday_swaps_table`), plus a new `weekend(): belongsTo(EmployeeWeekend::class, 'weekend_id')` relation on the model. The model's `employee()` relation's `#[LodataRelationship]` attribute was previously silently broken due to a missing `use Flat3\Lodata\Attributes\LodataRelationship;` import — now present, so `employee()` (and the new `weekend()`) resolve correctly over OData `$expand`.

## Related
- [Calendar Holiday / Off-Day Management](../calender-management/context.md) — the admin screen that produces the underlying `EmployeeWeekend` records this component swaps, and which also now remaps calendar-display dates through the same `EmployeeHolidaySwaps` lookup.
