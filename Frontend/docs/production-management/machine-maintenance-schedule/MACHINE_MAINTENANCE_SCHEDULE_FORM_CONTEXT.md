# MACHINE_MAINTENANCE_SCHEDULE_FORM — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `machine-maintenance-schedule/machine-maintenance-schedule-form/machine-maintenance-schedule-form.component.ts` |
| **HTML file** | `machine-maintenance-schedule/machine-maintenance-schedule-form/machine-maintenance-schedule-form.component.html` |
| **Selector** | `app-machine-maintenance-schedule-form` |
| **Component type** | NgModule-declared dialog component (hosted by `MachineMaintenanceScheduleListComponent`) |
| **Purpose** | New/Edit dialog for a **recurring** maintenance schedule — machine + start date/time + recurrence frequency + active toggle. Distinct from `MachineMaintenanceFormComponent` (one-off manual override): this drives `maintenance_schedules` (`next_maintenance_date` recomputed server-side on every save) |
| **Used by** | `MachineMaintenanceScheduleListComponent` |

## Inputs / Outputs

| Name | Type | Purpose |
|---|---|---|
| `@Input() saveMode` | `string` (`saveMode.POST \| saveMode.PUT`) | `POST` → create, `PUT` → update (see `@app/shared/enums/saveMode`) |
| `@Output() formSubmitted` | `EventEmitter<any>` | Emitted after a successful save → list refreshes the grid |

## Dialog

`ui5-dialog` (`w-[90vw] max-w-xl`), header = `Localization.New` / `Localization.Edit` by `saveMode`, `(before-close)` resets. Fields:

| Field | Control | Notes |
|---|---|---|
| Active | `ui5-switch` | Toggles `is_active`; no validation |
| Verification Buffer | `ui5-switch` | Toggles `buffer_enabled`; defaults **on**; no validation. Controls whether the 5-minute post-maintenance verification buffer (see `MACHINE_MAINTENANCE_STATUS_DURATION_PLAN.md`) applies to sessions opened from this schedule — off skips straight to closing the maintenance session the moment the machine is confirmed Active again |
| Machine | `ui5-select` (options from REST `GET /api/machines`) | `[attr.value]` + `[selected]` pattern (module convention) — required |
| Start Date | `ui5-date-picker`, `format-pattern="yyyy-MM-dd"` | Required |
| Scheduled Time | `ui5-time-picker`, `format-pattern="hh:mm a"` | Required |
| Frequency | `ui5-select`, options from `MaintenanceFrequencyClass.getOptions()` (`@production-module/shared/enums/maintenance-frequency`) | Required, default `MaintenanceFrequency.FIFTEEN_DAYS` |

Validation: `validateForm()` sets `ValueState.Negative` on Machine/Start Date/Scheduled Time/Frequency when empty; submit is blocked until all pass.

## Methods

| Method | Description |
|---|---|
| `loadMachines()` | Loads the machine dropdown once from the constructor (REST `GET /api/machines`, id+machine_name only) |
| `openDialog(schedule \| null)` | Resets `formData`/`valueStateOptions` to defaults, then prefills from the passed row (raw REST row) when editing; `start_date` is re-formatted via `moment(...).format('YYYY-MM-DD')` for the date picker |
| `onMachineChange` / `onDateChange` / `onTimeChange` / `onFrequencyChange` / `onActiveChange` / `onBufferEnabledChange` | Write the picked value onto `formData` + clear the matching value state |
| `validateForm()` | Required-field gate |
| `save()` | Builds `payload` from `formData`, `POST maintenance-schedules` or `PUT maintenance-schedules/{id}` (REST, not OData) depending on `saveMode`; on success closes, emits `formSubmitted`, toast `save`/`edit`; on error toast `error` |
| `closeDialog()` | Closes the dialog (no field reset — `openDialog()` re-resets on next open) |

## Known Gaps

- No client-side check that Start Date + Scheduled Time combine to a valid future/past-tolerant instant — the backend computes `next_maintenance_date` from `Carbon::parse(start_date . ' ' . scheduled_time)` and accepts any value.
- `next_maintenance_date` (recurrence rollover) is entirely server-side (`MaintenanceScheduleController::calculateNextDate()`); the form has no preview of when the next occurrence lands.
