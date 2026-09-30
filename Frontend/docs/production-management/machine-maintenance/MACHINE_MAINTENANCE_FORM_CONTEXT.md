# MACHINE_MAINTENANCE_FORM — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `machine-maintenance/machine-maintenance-form/machine-maintenance-form.component.ts` |
| **HTML file** | `machine-maintenance/machine-maintenance-form/machine-maintenance-form.component.html` |
| **Selector** | `app-machine-maintenance-form` |
| **Component type** | NgModule-declared dialog component (hosted by `MachineMaintenanceListComponent`) |
| **Purpose** | New/Edit dialog for a maintenance schedule — machine + date + time + verification buffer + reason. Mirrors the `WorkOrderFormComponent` pattern (parent toggles `saveMode`, child emits `RefreshTable` on success) |
| **Used by** | `MachineMaintenanceListComponent` |

## Inputs / Outputs

| Name | Type | Purpose |
|---|---|---|
| `@Input() saveMode` | `'POST' \| 'PUT'` | `saveMode.POST` → create, `saveMode.PUT` → update (see `@app/shared/enums/saveMode`) |
| `@Input() schedule` | `MachineMaintenanceSchedule \| null` | Row being edited (read for prefill; the actual fields live on the component, populated by `openDialog()`) |
| `@Output() RefreshTable` | `EventEmitter<any>` | Emitted after a successful save → list refreshes the grid |

## Dialog

`ui5-dialog` (`w-[90vw] max-w-2xl`), header = `Localization.New` / `Localization.Edit` by `saveMode`, `(before-close)` resets. Fields:

| Field | Control | Notes |
|---|---|---|
| Verification Buffer | `ui5-switch` | Mirrors the recurring `machine-maintenance-schedule` form's toggle — `buffer_enabled`, default `true`. Read live by node-server only when the row ends (`MachineStateTrackerService.reopenMaintenanceSession`), so it's editable regardless of SCHEDULED/ACTIVE state |
| Machine | `ui5-select` (options loaded from REST `GET /api/machines`) | Disabled `Select Machine` placeholder option first (selected when `machineId` is null), then `[attr.value]` + `[selected]` pattern per machine (module convention) — required |
| Scheduled Date | `ui5-date-picker`, `format-pattern="yyyy-MM-dd"` | Required |
| Scheduled Time | `ui5-time-picker`, `format-pattern="hh:mm a"` (12-hour, AM/PM) | Required — separate field from Date (was a single combined `ui5-datetime-picker`; split to match the recurring-schedule form's pattern) |
| Reason | `ui5-textarea` (`[maxlength]="500"`, growing) | Required, trimmed before submit |

`startDate` + `scheduledTime` are combined client-side via `moment` (`YYYY-MM-DD` + `hh:mm A` → `YYYY-MM-DDTHH:mm:ss`) into the single `scheduled_start_at` string the backend expects — the backend table has no separate date/time columns (unlike `maintenance_schedules.start_date`/`scheduled_time` on the recurring-schedule side).

Validation: each required field sets `ValueState.Negative` + a `valueStateMessage` ("Required Field") when empty; the submit is blocked until all pass.

## Methods

| Method | Description |
|---|---|
| `getMachines()` | Loads the machine dropdown once on `ngOnInit` (REST `GET /api/machines`, id+machine_name only — fine to re-run per dialog open) |
| `openDialog(schedule \| null)` | Prefills `machineId` / `startDate` + `scheduledTime` (split from `schedule.scheduledStartAt`, or now if null) / `reason` / `bufferEnabled`, resets value states, opens |
| `onMachineChange` / `onDateChange` / `onTimeChange` / `onReasonInput` / `onBufferEnabledChange` | Write the picked values + clear the matching value state |
| `validateForm()` | Required-field gate |
| `save()` | Recombines `startDate`+`scheduledTime` into `scheduledStartAt`; `POST` → `maintenanceService.create(machineId, scheduledStartAt, reason, bufferEnabled)`, `PUT` → `maintenanceService.update(id, { ..., buffer_enabled })`; on success closes, emits `RefreshTable`, toast `add`/`edit` |
| `CloseDialog()` | Resets fields + loading and closes |

## Known Gaps

- The Machine dropdown is disabled-from-editing only implicitly (backend rejects machine/start changes on ACTIVE rows) — the UI doesn't visually lock those fields for an ACTIVE schedule yet. The backend 422 surfaces as a generic error toast in that case.
- Activation is manual-only by design: a past-dated create/edit stays SCHEDULED until the row's Activate action is used (see [MACHINE_MAINTENANCE_LIST_CONTEXT.md](MACHINE_MAINTENANCE_LIST_CONTEXT.md) Known Gaps) — this is not a gap to close, it's intentional.