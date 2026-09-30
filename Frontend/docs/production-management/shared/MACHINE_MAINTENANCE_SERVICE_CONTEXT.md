# MACHINE_MAINTENANCE_SERVICE — Service Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `shared/services/machine-maintenance.service.ts` |
| **Class** | `MachineMaintenanceService` |
| **Provided in** | `root` (singleton) |
| **Purpose** | Machine-maintenance **write-side** REST client for the `MachineMaintenanceListComponent` CRUD page. Reads are NOT done here — the list's AG Grid reads `MachineMaintenanceSchedules` over OData (with `$expand=machine`), the same pattern as every other list page in the module. |
| **Used by** | `MachineMaintenanceListComponent`, `MachineMaintenanceFormComponent` |

## Data Flow

```
REST POST    /api/machine/maintenance                      { machine_id, scheduled_start_at, reason, buffer_enabled }  → create()
REST PUT     /api/machine/maintenance/{id}                { machine_id?, scheduled_start_at?, reason?, buffer_enabled? } → update()
REST DELETE  /api/machine/maintenance/{id}                → remove()
REST POST    /api/machine/{machineId}/maintenance/end     {}   → end()     (end ACTIVE / cancel SCHEDULED)
REST POST    /api/machine/maintenance/{id}/activate       { buffer_minutes }   → activate()
```

All calls go through `CommonService.post/put/delete(..., false)` → the `/api/` prefix (REST, per `Frontend/CLAUDE.md` §7). Reads go through OData — see [MACHINE_MAINTENANCE_LIST_CONTEXT.md](../machine-maintenance/MACHINE_MAINTENANCE_LIST_CONTEXT.md).

The override effect is applied **by node-server**, not the frontend: Laravel persists the schedule + writes the Redis `machine:maintenance_overrides` set, and node-server forces the machine's MAINTENANCE state from that set. `remove()`/`end()` clear the override so a machine is never stuck in MAINTENANCE because its schedule disappeared.

## Methods

| Method | Description |
|---|---|
| `create(machineId, scheduledStartAt, reason, bufferEnabled = true)` | `POST /api/machine/maintenance`. Always created SCHEDULED — activation is manual-only (`activate()`), never automatic, even when `scheduledStartAt` is already in the past. `reason` is required (validated, max 500) |
| `update(id, { machine_id?, scheduled_start_at?, reason?, buffer_enabled? })` | `PUT /api/machine/maintenance/{id}`. Backend rules: SCHEDULED rows accept `machine_id`/`scheduled_start_at`/`reason`; ACTIVE rows accept only `reason`; `buffer_enabled` is accepted regardless of state (read live by node-server only when the row ends); ended rows reject any edit. Null/omitted fields are ignored |
| `remove(id)` | `DELETE /api/machine/maintenance/{id}` — deletes the row and clears the Redis override **if the schedule was ACTIVE** (never leave a machine stuck in MAINTENANCE). This is why deletes go through the Laravel REST endpoint rather than OData `DELETE` |
| `end(machineId)` | `POST /api/machine/{machineId}/maintenance/end` — ends the machine's ACTIVE schedule or cancels its SCHEDULED one (same endpoint), clearing the override |
| `activate(id, bufferMinutes)` | `POST /api/machine/maintenance/{id}/activate` — activates a single SCHEDULED row on demand ("Activate now"), setting the override. `bufferMinutes` (collected via the list's Activate dialog, required integer ≥ 1) is persisted on the row as `buffer_minutes` — the length of its own post-maintenance verification buffer, replacing the old fixed 5-minute default (see `MachineStateTrackerService` in node-server) |

## Known Gaps

- There is deliberately no fleet-wide/cron auto-activation path — activation is always per-row, via the CRUD page's Activate action (`activate(id, bufferMinutes)`).
- Reads aren't cached/held in a signal — the AG Grid datasource owns list state; mutations refresh the grid directly via `RefreshTable` → `refreshGridData(true)`.