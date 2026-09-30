# MACHINE_MAINTENANCE_LIST — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `machine-maintenance/machine-maintenance-list/machine-maintenance-list.component.ts` |
| **HTML file** | `machine-maintenance/machine-maintenance-list/machine-maintenance-list.component.html` |
| **Selector** | `app-machine-maintenance-list` |
| **Component type** | NgModule-declared page (routed at `/production/machine-maintenance`), default change detection |
| **Purpose** | Machine-maintenance CRUD page — AG Grid table of all maintenance schedules (open + history) with New/Edit/Delete, per-row Activate/End, and search by machine or reason |
| **Permission** | Route + toolbar/new/edit/delete gated by `Permissions.PRODUCTION_ADMIN` (`rolePermissionService`) |
| **Used by** | `ProductionModule` route `machine-maintenance` |

## Data Source

```ts
dataSource: AgGridTableODataSourceConfig = {
  type: 'api',
  endpoint: '',
  customEndpoint: 'machine/maintenance',
  fromCustomPaginator: true,
  searchFields: ['machine.machine_name', 'reason'],
  pageSize: 40,
  scrollPagination: true,
  // no sortBy/sortDirection — see default ordering below
};
```

- REST, not OData — `GET /api/machine/maintenance` (`MachineMaintenanceController::index()`), response shape `{ data, total }` (`fromCustomPaginator: true`). Backend always eager-loads `machine`+`endedByUser`, no `$expand` param needed for `type: 'api'`.
- Backend parses `$top`/`$skip`/`$orderby` and these fixed `$filter`/`$orderby` shapes (never a general OData parser, same convention as `MachineController::applyProductionLogFilter()`):
  - search box: combined `machine.machine_name` nav lambda OR `reason` plain `contains`
  - the component's permanent 5-day lookahead cap (`baseFilter`, set in the constructor): `scheduled_start_at le <ISO8601>`
  - a date column's (`scheduled_start_at`/`activated_at`/`ended_at`) floating text filter — typed substring, `contains(tolower(<field>), '<term>')` → `WHERE LOWER(<field>) LIKE '%<term>%'`
  - the Status column's multiSelect header — `status eq 'scheduled'`, OR'd per pick — translated to real `activated_at`/`ended_at` conditions (see Columns below); any other per-column filter is silently ignored server-side
  - `$orderby=status asc|desc` (from clicking the Status header) and the no-`$orderby` default both route through `applySort()`'s status-priority `CASE` expression (`orderByStatusPriority()`) — see "Default ordering" below; any other single `field asc|desc` sorts that real column directly
- **Default ordering** (`dataSource` has no `sortBy`, so the first load sends no `$orderby`): `applySort()`'s fallback branch orders by status priority ascending — Scheduled (no `activated_at`) → Active (`activated_at` set, not ended) → Ended (`ended_at` set) last — then `scheduled_start_at desc` within each group. Surfaces what needs attention first instead of pure recency. Clicking any column header (including Status) still sorts explicitly as normal.
- Eloquent's `toArray()` renders the `endedByUser` relation under the snake_case key `ended_by_user` (unlike Lodata's OData `$expand`, which preserved the camelCase relation name) — the grid column and `viewEndedByLabel()` both check `endedByUser` first, falling back to `ended_by_user`, so this is transparent to callers.
- `ended_by` is a PHP backed enum (`MaintenanceEndedBy`, backed by lowercase `manual`/`auto`) — the controller explicitly serializes it as `->name` (`MANUAL`/`AUTO`) to match the exact strings this component's `ended_by === 'MANUAL'`/`'AUTO'` checks expect (the old OData response rendered the enum's case name the same way; a naive `toArray()` would have emitted the lowercase backing value instead and silently broken those checks).

## Columns

| Column | Source | Notes |
|---|---|---|
| Machine | `machine.machine_name` (valueGetter) | Expanded nav property |
| Reason | `reason` | Free text, required on create |
| Scheduled Start | `scheduled_start_at` | `DD/MM/YYYY hh:mm A` via `formatScheduledStart()` — `moment.utc()` (see timezone note) |
| Activated At | `activated_at` | Same format via `formatDateTime()` — plain `moment()` (see timezone note) |
| Duration | `duration_seconds` (valueGetter) | `HH:mm:ss` via the shared `DurationPipe` (`@production-module/shared/pipes/duration.pipe`), blank while `duration_seconds` is null (not yet ended, or ended before ever activating) |
| Ended At | `ended_at` | Same as Activated At |
| Ended By | `ended_by` (valueGetter) | `Manual` / `Auto` / blank |
| Maintenance Note | `maintenance_note` | Rich-text (HTML) — `stripHtml()` valueFormatter renders it as plain text in the grid cell |
| Status | `scheduleStatus(row)` (valueGetter) | `ended` → ENDED, `active` → ACTIVE, `scheduled` → SCHEDULED — rendered by `AgGridStatusBadgeComponent` (keys added to `statusStyles`). No real backing column — filterable via a `filterControl: {type:'multiSelect'}` header (options `scheduled`/`active`/`ended`, matching this valueGetter's own values exactly), server-translated in `MachineMaintenanceController::applyFilter()`/`applySort()` (see Data Source above) |

**Timezone note**: all three are Carbon `datetime` casts serialized with a `Z` (UTC) suffix, but they are NOT all real UTC instants — backend `APP_TIMEZONE` is `UTC`, not the deployment's local zone:
- `scheduled_start_at` comes from `Carbon::parse()` of a naive local wall-clock string assembled (via `moment`) from the create/edit form's separate `<ui5-date-picker>` + `<ui5-time-picker>` fields — the stored value is mislabeled UTC, so `formatScheduledStart()` uses `moment.utc(value)` to read the raw numbers as-is (no re-shift).
- `activated_at` / `ended_at` are set from `Carbon::now()` when the Activate/End action runs — genuine UTC instants — so `formatDateTime()` uses plain `moment(value)` (real UTC → browser-local conversion), which is correct as-is.

Do not "fix" these to use the same formatter — they have opposite semantics.

**`duration_seconds`**: computed and persisted server-side (activated_at → ended_at, in seconds) at the moment a row closes — never computed in the frontend. Two independent writers, both must stay in sync:
- Manual End (Laravel `MachineMaintenanceService::endForMachine()`) — `max(0, activated_at->diffInSeconds(ended_at))`, only set when `activated_at` was non-null (a row ended while still SCHEDULED has no duration).
- Auto-close (node-server `MachineStateTrackerService::clearMaintenanceOverride()`, on the real Active-channel confirming) — raw SQL `ROUND(TIMESTAMPDIFF(MICROSECOND, activated_at, now) / 1e6)` in the same `UPDATE` that sets `ended_at`/`ended_by='auto'`.

## Row Actions

`customActionButtons` (rendered by `AgGridActionCellRendererComponent` in the pinned `__actions__` column, next to the standard Edit/Delete):

| Button | Visibility | Action |
|---|---|---|
| Activate (play, Emphasized) | hidden unless SCHEDULED (`ended_at == null && activated_at == null`) | Opens the Activate dialog to collect the verification-buffer minutes, then `maintenanceService.activate(id, bufferMinutes)` → toast `approve` + grid refresh |
| End/Cancel (stop, Negative) | hidden when ended | Opens the End/Cancel dialog — Maintenance Note is edited via `app-angular-editor` (rich text, required) → `maintenanceService.end(machine_id, note)` → toast `remove` (was ACTIVE) / `edit` (was SCHEDULED) + grid refresh |
| Info (information, Transparent) | always visible | Opens the read-only Maintenance Details dialog (see below) |

Edit/Delete buttons are gated on `PRODUCTION_ADMIN`.

## Activate Dialog

`openActivateDialog(row)` / `closeActivateDialog()`, backed by `activateDialogOpen` / `scheduleToActivate` / `bufferMinutes` (defaults to `5`, required positive integer, `bufferMinutesState` goes `Negative` on blank/zero/negative). `confirmActivate()` validates then calls `maintenanceService.activate(id, bufferMinutes)` — this per-activation value becomes that row's own post-maintenance verification-buffer length (`buffer_minutes` column), replacing the old fixed 5-minute default node-server used for every schedule (`MAINTENANCE_VERIFICATION_BUFFER_MS`, now only a fallback for rows activated before this column existed). It only takes effect if the row's `buffer_enabled` (set on the create/edit form) is on.

## Maintenance Details (view) Dialog

`openViewDialog(row)` / `closeViewDialog()`, backed by `viewDialogOpen` / `scheduleToView` (the raw REST row, incl. eager-loaded `machine` / `ended_by_user`). Read-only fields: Machine, Activated At, Ended At, Ended By (`viewEndedByLabel()`), and Maintenance Note rendered via `app-angular-editor` with `[isReadonly]="true"` so HTML formatting (bold/lists/etc.) displays as authored instead of raw markup.

## Delete Flow

Delete uses a **custom `ui5-dialog` confirm**, NOT the shared `app-delete-entity` — that component is hardwired to `DELETE /odata/...`, which would delete the row without clearing the Redis override for an ACTIVE schedule (a machine could be stuck in MAINTENANCE). The list calls `maintenanceService.remove(id)` (REST) which clears the override when needed. The dialog shows the schedule's reason and warns that an active maintenance will be ended.

## Methods

| Method | Description |
|---|---|
| `buildColumns()` | Column defs (above) |
| `processData()` | `agGridRef.refreshGridData(true)` — wired to the form's `RefreshTable` and delete success |
| `newSchedule()` | Resets selection, sets `saveMode = POST`, opens form dialog empty |
| `editSchedule(row)` | Normalizes the raw row via `toSchedule()`, sets `saveMode = PUT`, opens form dialog prefilled |
| `deleteClick(row)` / `closeDeleteDialog()` / `confirmDelete()` | Open / close / execute the delete confirm dialog |
| `openActivateDialog(row)` / `closeActivateDialog()` / `onBufferMinutesInput(event)` / `confirmActivate()` | Activate dialog lifecycle (see above) |
| `openEndDialog(row)` / `closeEndDialog()` / `onMaintenanceNoteInput(value)` / `confirmEnd()` | End/Cancel dialog lifecycle — validates the (rich-text) note is non-empty before calling `maintenanceService.end()` |
| `openViewDialog(row)` / `closeViewDialog()` / `viewEndedByLabel(row)` | Maintenance Details (view) dialog lifecycle |
| `formatDateTime(value)` | `DD/MM/YYYY hh:mm A`, real-UTC-instant formatter (`activated_at`/`ended_at`) — used by the grid valueFormatter and the view dialog |
| `formatScheduledStart(value)` | Same output format, naive-local-mislabeled-UTC formatter (`scheduled_start_at`) — grid valueFormatter only (see timezone note above) |
| `toSchedule(row)` | snake_case REST row (with eager-loaded `machine`) → `MachineMaintenanceSchedule` |

## Known Gaps

- Activation is manual-only by design: creating or editing a row with a start date/time already in the past does NOT auto-activate it, and nothing polls for due schedules — a row only moves to ACTIVE via the row's Activate action and dialog (`maintenanceService.activate(id, bufferMinutes)`, `MachineMaintenanceService::activate()`). There is deliberately no cron/fallback endpoint for this.
- Delete confirmation is a bespoke dialog rather than the shared `app-delete-entity` — deliberate (override cleanup), see above.