# MACHINE_MAINTENANCE_SCHEDULE_LIST — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `machine-maintenance-schedule/machine-maintenance-schedule-list/machine-maintenance-schedule-list.component.ts` |
| **HTML file** | `machine-maintenance-schedule/machine-maintenance-schedule-list/machine-maintenance-schedule-list.component.html` |
| **Selector** | `app-machine-maintenance-schedule-list` |
| **Component type** | NgModule-declared page (routed at `production/machine-maintenance-schedule`), default change detection |
| **Purpose** | CRUD page for **recurring** maintenance schedules — AG Grid table of `maintenance_schedules` rows with New/Edit/Delete |
| **Permission** | Route + New/Edit/Delete gated by `Permissions.PRODUCTION_ADMIN` (`rolePermissionService`) |
| **Used by** | `ProductionModule` route `machine-maintenance-schedule` |

## Data Source

```ts
dataSource: AgGridTableODataSourceConfig<any> = {
  type: 'api',
  endpoint: '',
  customEndpoint: 'maintenance-schedules',
  fromCustomPaginator: true,
  searchFields: ['machine.machine_name', 'frequency'],
  pageSize: 40,
  scrollPagination: true,
  sortBy: 'id', sortDirection: 'desc',
};
```

- REST, not OData — `GET /api/maintenance-schedules` (`MaintenanceScheduleController::index()`), response shape `{ data, total }` (`fromCustomPaginator: true`).
- Backend parses `$top`/`$skip`/`$orderby` (single `field asc|desc`, no multi-clause) and exactly **one** fixed `$filter` shape — the combined search-box condition over `machine.machine_name` (nav lambda) OR `frequency` (plain `contains`) that the grid's query builder always emits for this `searchFields` config. Per-column header filters are NOT parsed server-side (same "fixed shapes only" convention as `MachineController::applyProductionLogFilter()` / `wastageLogs()`).
- `next_maintenance_date` is eager-loaded implicitly — the controller always does `MaintenanceSchedule::with('machine')`, no `$expand` param needed for `type: 'api'`.

## Columns

| Column | Source | Notes |
|---|---|---|
| Machine | `machine.machine_name` (valueGetter) | From eager-loaded `machine` relation |
| Start Date | `start_date` | `DD/MM/YYYY` via shared `formatDate()` (`@shared/utilities/date-format`) |
| Scheduled Time | `scheduled_time` | `hh:mm A` via shared `formatTime()` |
| Frequency | `frequency` | Raw enum value (`weekly` / `10-days` / `15-days` / `monthly` / `yearly`) — not yet mapped through `MaintenanceFrequencyClass.getLabel()` for display |
| Status | `is_active` (valueGetter) | `Active` / `Inactive` text, not a status badge |
| Next Maintenance Date | `next_maintenance_date` | `DD/MM/YYYY hh:mm A` via shared `formatDateTime()` — `moment.utc()` (naive-local-mislabeled-UTC, see note below) |

**Timezone note**: `next_maintenance_date` is a Carbon `datetime` cast serialized with a `Z` (UTC) suffix, but the stored value is naive local wall-clock time (backend `APP_TIMEZONE` is UTC, not the deployment's local zone) — `formatDateTime()` in `@shared/utilities/date-format` uses `moment.utc(value)` deliberately to read the raw numbers as-is rather than re-shifting.

## Methods

| Method | Description |
|---|---|
| `buildColumns()` | Column defs (above) |
| `processData()` | `agGridRef.refreshGridData(true)` — wired to the form's `formSubmitted` and delete success |
| `newSchedule()` | Resets selection, sets `saveMode = POST`, opens form dialog empty |
| `editSchedule(row)` | Sets `saveMode = PUT`, opens form dialog with the raw row |
| `deleteClick(row)` / `closeDeleteDialog()` / `confirmDelete()` | Open / close / execute the delete confirm dialog — `confirmDelete()` calls `DELETE maintenance-schedules/{id}` (REST) |

## Delete Flow

Bespoke `ui5-dialog` confirm (not the shared `app-delete-entity`, which is hardwired to OData) — matches the module's REST-first convention for this feature.

## Known Gaps

- `frequency` column shows the raw enum value instead of the localized label from `MaintenanceFrequencyClass.getLabel()` — cosmetic only, filtering/sorting is unaffected.
- Per-column AG Grid header filters (beyond the global search box) are not honored server-side — see Data Source note above.
