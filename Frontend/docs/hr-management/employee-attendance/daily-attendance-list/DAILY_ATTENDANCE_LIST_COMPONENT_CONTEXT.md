# Daily Attendance

Route: `hr-management/attendence-management/employee-daily-attendence`
Component: `DailyAttendanceListComponent`
Path: `Frontend/src/app/modules/hr-management/employee-attendance/daily-attendance-list/`

## Purpose

Shows one attendance card per active employee for a selected date — check-in/check-out, present/absent status, shift, worked hours, overtime.

## Data flow

- `GET hrm/dailyAttendance?date=<YYYY-MM-DD>&shift_id=<id>` (REST, not OData).
- Backend: `App\Services\hrModule\DailyAttendanceService::employeeDailyAttendance()`.
- Response: `{ date, attendance[], present_count, absent_count, has_roster }`.
- `has_roster` = whether any active `Roster` row covers the selected date (checked before per-employee/group filtering). Used to gate the whole grid.

## UI states (mutually exclusive, driven by `ui5-busy-indicator [active]="loading"`)

1. **Loading** — `ui5-busy-indicator` spinner overlays content while `loading = true`. Defaults to `true` on init so the first paint never flashes an empty state.
2. **Roster not found** — `!loading && !hasRoster`: shows only the message *"Roster not found. Please create a roster."* (`text-2xl`, black). No action button.
3. **Employee not found** — `!loading && hasRoster && filteredAttendance.length === 0`: roster exists for the date but current filters (search / status / department) match nobody. Message *"Employee not found."* (`text-2xl`, black).
4. **Cards grid** — `!loading && hasRoster && filteredAttendance.length > 0`: normal card grid, unchanged design.

## Filters (top bar)

| Control | Behavior |
|---|---|
| Shift combobox | Defaults to the shift whose time range contains "now" (auto-selected in `getEmployeeShifts()`). Changing it re-fetches (`loadDailyAttendance()`) with `shift_id` query param. |
| Date picker | `dd-MM-yyyy` display, converted to `YYYY-MM-DD` before refetch. |
| Department combobox | Client-side filter only (`applyFilters()`), no refetch. |
| Search (ID or name) | Client-side filter only. |
| All / Present / Absent segmented buttons | Client-side filter only. |
| Reset | Clears all filters, resets date to today, refetches. |

Refetch (`loadDailyAttendance()`) happens only on shift or date change. Department, search, and status filters are applied client-side against the already-loaded `dailyAttendance` list via `applyFilters()` → `filteredAttendance`.

## Overtime assignment

- `showOvertimeButton` / `canAssignOvertime` / `hasAssignedOvertime` gate an "Overtime" button per card, only for present employees who checked in but haven't checked out and have no overtime assigned yet.
- Opens `app-overtime-modal`; on success, reloads the list.

## Known infra note

Backend runs on **Laravel Octane (RoadRunner)** — the app is kept booted in long-lived worker processes. Backend code edits (e.g. to `DailyAttendanceService`) do **not** take effect until workers reload:

```bash
php artisan octane:reload
```

Plain opcache timestamp revalidation does not apply here; a stale response (e.g. missing `has_roster`) after a backend change is almost always this.
