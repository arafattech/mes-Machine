# Manual Machine Maintenance Scheduling — Plan

## Context

Factory wants operator to mark machine for maintenance by picking machine + date + start time (can be future-dated). Core confusion raised: how does system know maintenance ended and machine running again?

Investigated 3 layers (Backend Laravel, node-server, Frontend Angular). Findings:
- `machine_state_events` table (Backend) is authoritative live-state timeline (`ended_at IS NULL` = current state). Already has `maintenance`/`fault` enum values. **Only node-server writes to it today** — Laravel has never written to this table.
- Machine status is derived automatically every poll tick by `channel-mapping.service.ts` from real PLC channels (Active/Idle/Maintenance/Fault), debounced ~1s, then persisted + broadcast via Socket.IO `machine_status_runtime`.
- **No manual status-override path exists anywhere in the codebase today.** Frontend `MachineStatusCardComponent` is read-only. No scheduling/cron infra exists in Laravel (`bootstrap/app.php` has no `->withSchedule()`).
- Critical tension: if we manually write `maintenance` into the live state, node-server's continuous poll loop will just re-derive real status next tick and clobber it — a manual mark needs to *override* the automatic pipeline, not fight it.

User confirmed 3 design decisions:
1. **End detection = hybrid**: auto-clear when machine's real Active channel confirms running again, **plus** always-available manual "End Maintenance" as fallback/override.
2. **Future scheduling** supported — a scheduled time in the future must activate on its own when it arrives (needs a new Laravel scheduler, none exists yet).
3. **Open-ended** — no planned/expected end time captured, just start.

## Recommended Approach

**New table, not reuse of `machine_state_events`.** A future-dated schedule must never look like "current state" (`ended_at IS NULL` already means "this is live" everywhere it's read — OEE aggregation, duration seeding). New table `machine_maintenance_schedules` keeps that untouched.

**Single writer preserved.** Laravel never writes `machine_state_events` directly. Laravel writes only the new schedules table + signals node-server via a Redis flag (same `shared_cache` connection pattern already proven in `Backend/app/Services/MachineConfigCacheInvalidator.php`). node-server remains the only writer of `machine_state_events`, avoiding a second writer racing the poll loop.

**The override is a gate on node-server's derived status, not a separate state machine.** `channel-mapping.service.ts`'s `deriveStatus()`/`debounceStatus()` keep computing real status every tick unchanged; a `MaintenanceOverrideService` (Redis Set of machine_ids, 1s local TTL cache to avoid hammering Redis per-tier) is checked right after debounce. If a machine is in the override set: force `MAINTENANCE` regardless of derived status (handles "schedule activates while machine is in fault" for free) — **unless** the debounced real status is a confirmed `ACTIVE`, in which case auto-clear the override (closes the schedule row `ended_by='auto'`, clears Redis) and let the real `ACTIVE` status through. Legacy (non-channel-mapping) mode has no debounce and no maintenance channel at all — manual End is the *only* way out there, no auto-clear branch.

### Data model
New migration `Backend/database/migrations/2026_07_13_100000_create_machine_maintenance_schedules_table.php`:
```
machine_maintenance_schedules
  id, machine_id (FK machines, cascade)
  scheduled_start_at (datetime)      -- requested, future or now
  activated_at (nullable datetime)   -- set when override actually goes live; null = still SCHEDULED (future)
  ended_at (nullable datetime)       -- null = still open (pending or active)
  ended_by (enum: manual|auto, nullable)
  ended_by_user_id (FK users, nullable)
  created_by_user_id (FK users)
  timestamps
  index(machine_id, ended_at), index(scheduled_start_at)
```
`activated_at IS NULL` + `ended_at IS NULL` = SCHEDULED (future). `activated_at` set + `ended_at IS NULL` = ACTIVE. App-layer enforces at most one open row per machine (validation + `lockForUpdate()` race guard), not an exotic DB constraint.

New model `Backend/app/Models/MachineMaintenanceSchedule.php` (mirrors `MachineStateEvent.php`). New enum `Backend/app/Enums/Machine/MachineStateEnum.php` (style matches `Backend/app/Enums/Store/SprStatus.php`). Register `Lodata::discover(MachineMaintenanceSchedule::class)` in `AppServiceProvider.php` next to the existing `MachineStateEvent` discovery — frontend reads schedules via OData, no bespoke list endpoint needed.

### Backend API (Laravel)
- `Backend/app/Services/MachineMaintenanceOverrideSignal.php` — Redis Set `machine:maintenance_overrides` on `shared_cache` connection, `activate(machineId)` / `clear(machineId)`, try/catch + `Log::warning`, never throws (identical shape to `MachineConfigCacheInvalidator`).
- `Backend/app/Services/MachineMaintenanceService.php` — `schedule()`, `activate()` (idempotent), `activateDueSchedules(Carbon $now)`, `endManually()`. `schedule()` runs in `DB::transaction()` + `lockForUpdate()`, activates immediately if `scheduled_start_at <= now()`.
- `Backend/app/Http/Controllers/MachineMaintenanceController.php` — thin, `store()` + `end()`, inline validation matching `MachineConfigController::validatePayload()` convention (no `FormRequest` classes exist anywhere in this repo — don't introduce the pattern here alone).
- Routes in `Backend/routes/api.php` (existing `auth:sanctum` group): `POST machine/maintenance`, `POST machine/{machineId}/maintenance/end`.

### Future-schedule activation (new Laravel scheduler infra)
- `Backend/app/Console/Commands/IotMonitor/ActivateMaintenanceSchedules.php` — `machine:activate-maintenance-schedules`, calls `activateDueSchedules(now())`.
- Wire into `Backend/bootstrap/app.php` via `->withSchedule(fn ($schedule) => $schedule->command(...)->everyMinute()->withoutOverlapping())` — **first use of Laravel's scheduler in this repo.**
- **Ops flag (confirm before shipping):** no cron/supervisor entry invoking `php artisan schedule:run` was found anywhere in this repo's deployment config. Without it, future-dated schedules silently never activate. Needs a `* * * * * php artisan schedule:run` cron entry (or supervisor program) added at the ops layer.

### node-server changes
- New `node-server/src/module/machine/runtime/maintenance-override.service.ts` — `getOverrides()` (SMEMBERS, 1s TTL cache, fail-open to stale cache on Redis error), `clear(machineId)`.
- `channel-mapping.service.ts` — after `debounceStatus()`, gate the effective status through the override set (force `MAINTENANCE` unless debounced status is confirmed `ACTIVE`, in which case auto-clear). Downstream broadcast/`lastState`/transition-detection all use the gated status; raw channel diagnostics stay untouched for debugging.
- `machine-state-tracker.service.ts` — add `clearMaintenanceOverride(machineId, now, 'auto')`, closes the open schedule row alongside the normal `machine_state_events` transition.
- `machine-runtime.service.ts` (legacy mode) — same override gate, **no auto-clear branch** (manual End only).
- Register `MaintenanceOverrideService` in `machine.module.ts`.
- **Prisma sync flag (confirm before shipping):** `node-server/prisma/schema.prisma` needs a new `machine_maintenance_schedules` model after the Laravel migration runs against the shared MySQL DB (`npx prisma db pull` + `generate`). No automated schema-sync step was found — this is a manual cross-repo step, easy to forget.

### Frontend (Angular)
- New `Frontend/src/app/modules/production-management/shared/services/machine-maintenance.service.ts` — root-provided, `schedule()`/`end()` POST calls (via existing `CommonService.post` pattern), `schedules$` seeded/refreshed from OData `MachineMaintenanceSchedules?$filter=ended_at eq null` (centralized polling, not per-card, matching module's N+1-network-call avoidance rule).
- `MachineStatusCardComponent` — add `@Input() machineId`, `@Input() scheduledMaintenance`; inject the new service; add a `ui5-dialog` with `ui5-datetime-picker` (`@ui5/webcomponents@2.0.1` is installed and supports this tag; not yet used anywhere else in the codebase — this introduces the precedent) for "Schedule Maintenance"; when `activity === 'MAINTENANCE'` show an "End Maintenance" button instead; render a secondary `ui5-tag design="Information"` badge when a future schedule exists but isn't active yet, to visually distinguish SCHEDULED vs ACTIVE maintenance.
- `MachineBoardComponent` — subscribe to `schedules$`, pass `[machineId]` and `[scheduledMaintenance]` down to each card.
- No changes needed to `MachineDurationService`, `StatusType`/`MachineActivityType` enums, or the board's existing "Under Maintenance" count — all already flow from `machine_status_runtime`/`machine_state_events` unchanged.

### Edge cases (decided, not left open)
- **Overlapping schedules same machine:** rejected at validation (422) + `lockForUpdate()` race backstop.
- **Schedule activates while machine already in `fault`:** override forces `MAINTENANCE` uniformly over any derived status — no special case.
- **Manual End clicked while maintenance PLC channel still HIGH:** End takes effect immediately, but if the channel is still asserted, next poll tick will legitimately re-derive `MAINTENANCE` and re-open a schedule — treated as correct (frontend shows a toast if `machine_status_runtime` reports `MAINTENANCE` again shortly after an End click). Legacy-mode machines have no such re-derivation risk since they have no maintenance channel — manual End is fully authoritative there.

## Build Order
1. Backend: migration → model → enum → `MachineMaintenanceOverrideSignal` → `MachineMaintenanceService` → controller → routes → OData discovery.
2. Backend: `ActivateMaintenanceSchedules` command → scheduler wiring (raise ops cron dependency now, don't block on it).
3. node-server: Prisma sync → `MaintenanceOverrideService` → `machine-state-tracker.service.ts` → `channel-mapping.service.ts` gate → `machine-runtime.service.ts` legacy gate → module registration.
4. Frontend: `MachineMaintenanceService` → `MachineStatusCardComponent` (dialog + inputs) → `MachineBoardComponent` wiring.

## Verification
- Schedule "now" on a channel-mapping test machine → confirm both `machine_state_events` and `machine_maintenance_schedules` transition, socket `machine_status_runtime` fires, card updates to MAINTENANCE.
- Schedule 2 minutes out → confirm it stays SCHEDULED (badge, not live) until the cron command runs (or run `php artisan machine:activate-maintenance-schedules` manually while cron is being provisioned) → confirm it goes ACTIVE at the right time.
- Flip the machine's real Active channel HIGH while overridden → confirm auto-clear (schedule closes `ended_by='auto'`, card returns to ACTIVE) without hitting End.
- Click manual End on a legacy-mode machine (no maintenance channel) → confirm it stays ended (no re-trigger).
- Click manual End on a channel-mapping machine whose maintenance channel is still HIGH → confirm the "re-entered maintenance" toast behavior.

### Critical files
- `Backend/database/migrations/2026_07_13_100000_create_machine_maintenance_schedules_table.php` (new)
- `Backend/app/Services/MachineMaintenanceService.php` (new)
- `Backend/app/Services/MachineMaintenanceOverrideSignal.php` (new)
- `node-server/src/module/machine/runtime/channel-mapping.service.ts` (modified — override gate)
- `node-server/src/module/machine/runtime/maintenance-override.service.ts` (new)
- `node-server/src/module/machine/runtime/machine-state-tracker.service.ts` (modified — `clearMaintenanceOverride`)
- `Frontend/src/app/modules/production-management/shared/components/machine-status-card/machine-status-card.component.ts` (modified — dialog + End action)
- `Frontend/src/app/modules/production-management/shared/services/machine-maintenance.service.ts` (new)
