# Machine Maintenance — Live Status & Duration Attribution Plan

## Goal (confirmed with user, from hand-drawn state diagram)

When a machine goes into maintenance, the board's live status and its running "duration" badge must follow the machine's *actual* state at every moment:

```
Active ──(maintenance started)──> Maintenance   [duration now counts as Maintenance]
Maintenance ──(real Active channel confirms it's actually fixed)──> Active
                                                  [duration switches, now counts as Active]
Active ──(faults / maintenance re-triggered)──> Maintenance
                                                  [duration switches back to Maintenance]
```

In short: whichever state is *currently* live is the one the running duration is attributed to — no separate manual reset, no stale "leftover" counting under the wrong bucket.

## Current implementation status (verified this session — already built)

This exact flow is **already fully implemented and wired**, for the one-off manual-override feature (`Frontend/.../machine-maintenance` module):

| Piece | File | What it does |
|---|---|---|
| Activate/End endpoints | `Backend/app/Http/Controllers/MachineMaintenanceController.php` | `activate()` → `MachineMaintenanceService::activate()`; `end()` → `endForMachine()` |
| Redis signal | `Backend/app/Services/MachineMaintenanceOverrideSignal.php` | `activate()`/`clear()` do `SADD`/`SREM` on Redis Set `machine:maintenance_overrides` (bug found + fixed this session: `predis/predis` composer package was declared but never installed, so every activate/end call was silently failing since 2026-08-17 — see `composer.lock` diff) |
| Override gate | `node-server/.../runtime/channel-mapping.service.ts` (`applyMaintenanceOverride()`) | Every poll tick: if machine is in the Redis override set AND the debounced *real* channel status is confirmed `ACTIVE` → auto-clears the override and lets `ACTIVE` through; otherwise forces `MAINTENANCE` regardless of real status |
| Auto-clear + persistence | `node-server/.../runtime/machine-state-tracker.service.ts` (`clearMaintenanceOverride()`) | Clears Redis, closes the open `machine_maintenance_schedules` row (`ended_by='auto'`, `duration_seconds` computed), and the normal `machine_state_events` transition fires `machine_status_runtime` over Socket.IO |
| Duration badge | `Frontend/.../shared/services/machine-duration.service.ts` | `since` timestamp re-seeds *only* on a `machine_status_runtime` transition — so the board's duration badge automatically re-bases to 0 and starts counting under whichever state just became current, with zero extra frontend logic needed |

**Net effect**: the diagram's cycle (Active → Maintenance → auto-detected-fixed → Active → faults again → Maintenance) is the designed, already-shipped behavior end-to-end for the `machine-maintenance` module, as long as the Redis bridge is healthy (confirmed fixed this session).

## Scope gap: `machine-maintenance-schedule` (recurring) has NO live link

The other module named in this request, `machine-maintenance-schedule` (the *recurring* schedule — `maintenance_schedules` table, `MaintenanceScheduleController`), is architecturally separate and does **not** participate in any of the above:

- It only computes `next_maintenance_date` (a Carbon date, recurrence math) — a planning reminder, nothing more.
- It never calls `MachineMaintenanceOverrideSignal`, never touches Redis, never flips a machine's live status.
- Its list has no Activate/End row action at all (see `MACHINE_MAINTENANCE_SCHEDULE_LIST_CONTEXT.md`) — pure CRUD.

**Decision needed before any further code change**: should a recurring schedule's arrival (`next_maintenance_date <= now()`) *also* auto-trigger the same live override (start counting as Maintenance automatically, then auto-clear on real Active like the one-off flow)? That is new work — nothing today wires it up. If yes, the shape would mirror the one-off flow's `ActivateMaintenanceSchedules` cron pattern (a new scheduled command that calls the *same* `MachineMaintenanceOverrideSignal`/`machine_maintenance_schedules` machinery already built, keyed off `maintenance_schedules.next_maintenance_date` instead of a one-off `scheduled_start_at`). Until that's confirmed, this plan treats `machine-maintenance-schedule` as staying a pure reminder list.

## Verification plan (no code changes — confirms the diagram's flow works today)

1. Pick a channel-mapping-mode test machine currently `Active`.
2. In `machine-maintenance`, click **Activate** on a maintenance row for it → within one poll tick the board should flip to `Maintenance`, duration badge resets to `0` and starts climbing.
3. Bring the machine's real Active channel high again (or wait for it to genuinely resume) → board should auto-flip back to `Active`, duration badge resets again; `machine_maintenance_schedules.ended_by` should read `auto`.
4. Re-trigger a fault / re-activate maintenance → board switches to `Maintenance` again with a fresh duration.
5. Cross-check `duration_seconds` on the closed schedule row against wall-clock time for both the manual-End path (`MachineMaintenanceService::endForMachine()`) and the auto-clear path (`machine-state-tracker.service.ts`'s raw SQL `UPDATE`) — both write this column, must agree with reality.

## New requirement: 5-minute post-maintenance verification buffer

**Status: implemented.**

### Problem

Today, the instant `applyMaintenanceOverride()` sees the real channel confirmed `ACTIVE`, it immediately clears Redis **and** closes the `machine_maintenance_schedules` row in the same step. A flapping channel (confirms `ACTIVE`, then faults again seconds later) creates a new schedule row per flap — fragments `duration_seconds` and produces noisy history, and the board itself flaps Maintenance→Active→Maintenance for what was never really a completed recovery.

### Design

**The board always shows the machine's real status in real time — the same instant the real channel confirms `ACTIVE`, the board shows Active, exactly like a manual End does.** A confirmed-`ACTIVE` reading clears the Redis override immediately and starts a fixed 5-minute verification window that only governs the *schedule row's own report* (`machine_maintenance_schedules.duration_seconds`), not the board:
- If the machine drops out of `ACTIVE` again before the window elapses (fault / idle / maintenance re-triggered), the board is forced straight back to Maintenance — same schedule row, no new row — and the elapsed window time ends up counted as Maintenance once the row is finally closed.
- If it holds `ACTIVE` for the full window, the row finalizes: closed with `duration_seconds` excluding that window (it was genuinely Active time, and the board already showed it as such the whole time — no retroactive UI correction needed).

(This went through two revisions before landing here. First pass: exactly this — optimistic Active display, corrected retroactively. Second pass: reworked to hold the Maintenance display for the full window and only flip once confirmed, to avoid a possible flap — but that turned out to be the wrong read of the requirement: the board flipping in real time, mirroring a manual End, is what's wanted. Reverted back to the first design.)

#### Schema change

`machine_maintenance_schedules`

| Column | Type | Notes |
|---|---|---|
| `pending_confirm_until` | `timestamp`, nullable | New. Non-null while the row is inside its 5-min post-`ACTIVE` verification window (board already showing Active, row still open for reporting purposes); null otherwise. |
| `buffer_enabled` | `boolean`, default `true` | New. See the per-schedule toggle section below. |

Migration file only — authored, not run by this pass (`php artisan migrate` stays user-owned per repo convention). `--pretend` for SQL sanity-check is fine.

#### State machine (extends step 2→3 of the original diagram above)

```
Maintenance ──(real ACTIVE confirmed)──> Redis override cleared, board shows Active
                                          immediately, pending_confirm_until = now()+5min,
                                          schedule row STAYS OPEN (not closed yet)

  during the 5-min window:
    ├─ real channel drops out of ACTIVE before pending_confirm_until
    │     → SAME row reused (no new row): pending_confirm_until → null,
    │       override re-SADD'd into Redis with the SAME schedule id,
    │       machine_status_runtime fires MAINTENANCE (board flips back
    │       immediately, same tick — not whatever raw status the channel
    │       reads), the elapsed window time counts toward this row's
    │       eventual Maintenance duration_seconds when it's finally closed
    │
    └─ pending_confirm_until passes, still real ACTIVE (no drop-out)
          → row closes for real: duration_seconds = start-of-row → moment the
            override was ORIGINALLY cleared (the 5-min window itself is
            Active time, not counted as Maintenance — board already showed
            Active throughout, so no retroactive UI correction needed),
            ended_by = 'auto', pending_confirm_until → null
```

Board/duration-badge behavior needs no frontend change: `machine-duration.service.ts` re-seeds `since` only on `machine_status_runtime` transitions, and both branches above already fire that event with the correct state (`MAINTENANCE` on drop-out, nothing new on finalize since the board is already showing `Active`).

#### Files touched (implemented)

| File | Change |
|---|---|
| 2 migrations | `pending_confirm_until` + `buffer_enabled` on `machine_maintenance_schedules`; `buffer_enabled` on `maintenance_schedules` |
| `Backend/app/Models/MachineMaintenanceSchedule.php`, `MaintenanceSchedule.php` | fillable/casts for the new columns |
| `Backend/app/Services/MachineMaintenanceService.php` (`endForMachine()`) | manual End force-closes immediately regardless of any pending window, clears `pending_confirm_until`; propagates `buffer_enabled` onto the next recurring-cycle row |
| `Backend/app/Http/Controllers/MaintenanceScheduleController.php` | validates/persists `buffer_enabled`, propagates onto the linked session row on create |
| `node-server/.../runtime/maintenance-override.service.ts` | `clear()` unchanged; `activate()` (re-)added — SADD counterpart to Laravel's, used by the drop-out branch to re-arm the override |
| `node-server/.../runtime/machine-state-tracker.service.ts` | `clearMaintenanceOverride()` (confirmed-`ACTIVE` — clears Redis immediately, starts the window or closes immediately per `buffer_enabled`), `loadPendingConfirmations()` (once per poll tick), `reopenMaintenanceSession()` (drop-out before deadline — re-arms Redis + same row), `finalizePendingConfirmation()` (window elapsed — closes the row, excludes the window from duration) |
| `node-server/.../runtime/channel-mapping.service.ts` | `applyMaintenanceOverride()` (plain override-forcing, clears on confirmed Active) + `applyPendingConfirmationBuffer()` (the window's drop-out-vs-finalize branch) |

#### Acceptance criteria

- Maintenance ends, real channel confirms Active → board **switches to Active immediately** (same as manual End), verification window starts (5 min) invisibly in the background.
- Machine drops out of Active again within the 5 min → same schedule row re-opens, **no duplicate row** in the DB, board flips back to Maintenance immediately, and `duration_seconds` for this row eventually includes the window time as Maintenance.
- Machine stays Active for the full 5 min with no drop-out → row closes automatically, `duration_seconds` does **not** include the 5-minute window, `ended_by='auto'`; board shows no visible change (it was already Active).
- Manual End button always force-closes immediately, window or not, and clears `pending_confirm_until`.
- Per-schedule `buffer_enabled=false` (via the create-form switch) skips the window entirely — confirmed Active closes the row immediately, the pre-buffer behavior (unchanged from before this feature).

#### Open question carried over

The recurring-schedule live-wiring question in the section above is unrelated to this buffer feature and remains unresolved — still gates any work on `machine-maintenance-schedule`.

## New requirement: per-schedule buffer toggle switch

**Status: implemented.**

### Goal

On the schedule create form (`/production/machine-maintenance-schedule`), add a switch that controls whether the 5-minute verification buffer (above) applies to that machine's schedule. Default **on** (`true`). When off, a confirmed-`ACTIVE` event closes the schedule row immediately — the pre-buffer behavior — instead of entering the `pending_confirm_until` window.

### UI

`machine-maintenance-schedule-form.component.html` — add a `<ui5-switch>` bound to a new `formData.buffer_enabled` field (component: `machine-maintenance-schedule-form.component.ts`, current `formData` shape is `machine_id`, `start_date`, `scheduled_time`, `frequency`, `is_active` — `buffer_enabled` joins that list, defaulted to `true`).

### Schema

| Table | Column | Notes |
|---|---|---|
| `maintenance_schedules` | `buffer_enabled` | New. `boolean`, default `true`. Config value set by the switch on this recurring schedule. |
| `machine_maintenance_schedules` | `buffer_enabled` | New. `boolean`, default `true`. Copied from the recurring schedule's `buffer_enabled` at the moment a session row is opened for that schedule — this is the value the poll-tick buffer check actually reads, so a later edit to the recurring config doesn't retroactively change a session already in progress. |

### Backend

- `MaintenanceScheduleController::store()` — validate `buffer_enabled` (`boolean`), persist on `MaintenanceSchedule::create()`.
- Wherever a `MachineMaintenanceSchedule`/`machine_maintenance_schedules` row is opened for a schedule (the controller's immediate linked-record creation seen today, and/or the `ActivateMaintenanceSchedules` cron path referenced in the scope-gap section above) — copy `buffer_enabled` from the parent `maintenance_schedules` row onto the new session row.
- Manual one-off Activate (`MachineMaintenanceController::activate()`, no recurring schedule behind it) has no switch UI — its rows keep `buffer_enabled` at the column default (`true`), unaffected by this feature.

### node-server

- `machine-state-tracker.service.ts` (`clearMaintenanceOverride()`) — on the confirmed-`ACTIVE` tick that clears the Redis override, reads the row's `buffer_enabled`: `true` → starts the verification window (row stays open, board already showing Active); `false` → immediately closes the row too, the pre-buffer behavior.
- `channel-mapping.service.ts` (`applyMaintenanceOverride()`) just calls `clearMaintenanceOverride()` and lets Active through — it doesn't itself branch on `buffer_enabled`.

### Files touched (implemented)

| File | Change |
|---|---|
| migrations | `buffer_enabled` boolean (default `true`) on both `maintenance_schedules` and `machine_maintenance_schedules` |
| `Backend/app/Http/Controllers/MaintenanceScheduleController.php` | validate/persist `buffer_enabled`; propagate it onto the linked session row it creates |
| `Backend/app/Models/MaintenanceSchedule.php`, `MachineMaintenanceSchedule.php` | `buffer_enabled` in `$fillable`/casts |
| `.../machine-maintenance-schedule-form/machine-maintenance-schedule-form.component.ts` | `buffer_enabled: true` in `formData`, `onBufferEnabledChange()` |
| `.../machine-maintenance-schedule-form/machine-maintenance-schedule-form.component.html` | `<ui5-switch>` control next to the existing Active switch, default checked |
| `node-server/.../runtime/machine-state-tracker.service.ts` (`clearMaintenanceOverride()`) | reads `buffer_enabled` on the row at the confirmed-`ACTIVE` tick, branches window-vs-immediate-close |
| `Frontend/docs/production-management/machine-maintenance-schedule/MACHINE_MAINTENANCE_SCHEDULE_FORM_CONTEXT.md` | updated — Verification Buffer field, `onBufferEnabledChange` |

### Acceptance criteria

- Create form shows the switch, default **on**.
- Schedule created with switch **on** → its sessions follow the full buffer design (previous section) end-to-end.
- Schedule created with switch **off** → its sessions skip the buffer entirely: confirmed `ACTIVE` closes the row immediately, `pending_confirm_until` never gets set.
- Manual one-off Activate/End (no recurring schedule) is unaffected — always buffered (default `true`).

**Update:** the manual one-off `machine-maintenance` create/edit form (`MachineMaintenanceFormComponent`) now also carries the same Verification Buffer switch (`bufferEnabled`, default `true`), wired through `MachineMaintenanceController::store()`/`update()` → `MachineMaintenanceService::schedule()`/`update()` → `machine_maintenance_schedules.buffer_enabled`. Editable regardless of SCHEDULED/ACTIVE state (node-server reads it live, only at end-time). See [MACHINE_MAINTENANCE_FORM_CONTEXT.md](machine-maintenance/MACHINE_MAINTENANCE_FORM_CONTEXT.md).

## New requirement: correct the "STATE DURATIONS (TODAY)" widget on a broken window

**Status: implemented.**

### Problem

`MachineOverviewComponent`'s "STATE DURATIONS (TODAY · LIVE)" panel — per-state totals for the day (Active/Idle/Maintenance/Inactive/Fault) — is powered entirely by `MachineDurationService`, a fleet-wide singleton that only mirrors `machine_state_events`/`machine_status_runtime`. It has no notion of `machine_maintenance_schedules` or the verification window at all. So when a window breaks (re-triggers), the span it spent showing Active gets permanently recorded in this widget's Active bucket — correct as a literal historical record (the machine genuinely showed Active in real time), but the user wants that span in the Maintenance bucket here, matching the same attribution `machine_maintenance_schedules.duration_seconds` already uses for that session.

### Design

Keep `machine_state_events` and the board's real-time display exactly as they are (a broken window's Active interval is still genuinely, accurately recorded there — no retroactive rewrite of history). Instead, node-server emits a one-shot correction event the moment a window breaks, and the frontend widget-service applies it on top:

- `ChannelMappingService.applyPendingConfirmationBuffer()` — on the broken branch, alongside the existing `reopenMaintenanceSession()` call, computes the window's span (`since = pendingConfirmUntil - verificationBufferMs` through `until = now`) and queues it in a `recounts` array.
- `ChannelMappingService.pollConfigs()` — flushes `recounts` via `MachineStateTrackerService.emitMaintenanceRecount()` strictly *after* `persistTransitions()` (which fires the tick's `machine_status_runtime` MAINTENANCE transition) — Socket.IO preserves per-connection emit order, so the frontend always processes the real transition first, then this correction on top of it.
- `machine-duration.service.ts` (`MachineDurationService`) — new `machine_maintenance_recount` subscription: `{machine_id, from_state_id, to_state_id, since, until}` → subtracts `(until - since)` from `base[from_state_id]`, adds it to `base[to_state_id]`. Pure post-hoc bucket correction; `entry.state`/`entry.since` (live tracking) untouched.

Scope: this only corrects the **broken** case, matching the exact scenario reported (screenshots showing Active time not moving to Maintenance after a re-trigger). A window that *finalizes* successfully is left alone — it genuinely was Active, which is exactly what the widget already shows; no correction needed there. Whether the *live, still-pending* portion of a window (before its outcome is known) should provisionally show under Maintenance instead of Active in this same widget is an open question, not built — see this service's context doc's Known Gaps.

### Files touched

| File | Change |
|---|---|
| `node-server/.../runtime/channel-mapping.service.ts` | `pollConfigs()` collects a `recounts` array, flushes it after `persistTransitions()`; `applyPendingConfirmationBuffer()` pushes a recount entry on the broken branch |
| `node-server/.../runtime/machine-state-tracker.service.ts` | `getVerificationBufferMs()` (accessor), `emitMaintenanceRecount()` (new `machine_maintenance_recount` socket emit) |
| `Frontend/.../shared/services/machine-duration.service.ts` | new `machine_maintenance_recount` subscription in `subscribeSocket()`, `MachineMaintenanceRecountEvent` interface |
| `Frontend/docs/production-management/shared/MACHINE_DURATION_SERVICE_CONTEXT.md` | updated — new subscription documented, Known Gaps note on the still-open live-pending question |

## New requirement: per-activation buffer length (fixed 5 min → operator-chosen)

The fixed 5-minute verification window (`MAINTENANCE_VERIFICATION_BUFFER_MS`, one process-wide constant) is replaced by a per-row value the operator enters in the "Activate now" dialog on `/production/machine-maintenance` (`MachineMaintenanceListComponent`). Manual one-off Activate only — the recurring-schedule create form (`machine-maintenance-schedule`) and its `buffer_enabled` toggle are unchanged.

- New column `machine_maintenance_schedules.buffer_minutes` (`smallint unsigned`, nullable — null only for rows activated before this column existed, which fall back to the old env-var constant).
- `MachineMaintenanceController::activate()` now validates `buffer_minutes` (`required|integer|min:1|max:1440`) and passes it to `MachineMaintenanceService::activate($id, $bufferMinutes)`, which persists it alongside `activated_at`.
- `MachineMaintenanceListComponent` gained an Activate dialog (`activateDialogOpen`/`scheduleToActivate`/`bufferMinutes`/`bufferMinutesState`) instead of firing `activate()` directly from the row button; `MachineMaintenanceService.activate(id, bufferMinutes)` sends it as `{ buffer_minutes }`.
- `machine-state-tracker.service.ts`: `getVerificationBufferMs()` accessor removed — the old shared constant is now `defaultVerificationBufferMs` (fallback only). `PendingConfirmation` carries its own `bufferMs`; `clearMaintenanceOverride()`, `loadPendingConfirmations()`, and `finalizePendingConfirmation()` all read/thread the row's `buffer_minutes` instead of the shared constant. `channel-mapping.service.ts`'s `applyPendingConfirmationBuffer()` uses `pending.bufferMs` in place of the removed accessor.
- This only takes effect when the row's `buffer_enabled` is on — same gate as before.

## Next step

1. Confirm the open question above (does the recurring schedule need the same live wiring, or stay reminder-only) before any implementation work starts on `machine-maintenance-schedule`.
2. ~~Implement the 5-minute verification buffer~~ — done (migrations `2026_09_02_000000`/`2026_09_02_000001`, `channel-mapping.service.ts`, `machine-state-tracker.service.ts`, `MachineMaintenanceService::endForMachine()`, `MaintenanceScheduleController.php`, the create-form switch). Went through a "hold Maintenance display until confirmed" variant in between, then reverted: the board shows Active in real time the instant the real channel confirms it (same as manual End), and only the schedule row's own report is held open for the verification window.
3. Migrations have been applied. Restart node-server to pick up the current code — watch for `Maintenance verification window started`/`broken`/`confirmed: ...` log lines from `machine-state-tracker.service.ts` to see the flow happen live.
4. Still open: sync the node-server Prisma client (`npx prisma generate`, or `db pull`) so typed Prisma Client usage elsewhere in the codebase reflects the new columns — the buffer code itself uses raw `$queryRaw`/`$executeRaw` and doesn't depend on this, but it's needed for the schema to be authoritative. User-owned, not run by this pass.
5. Manually verify end-to-end per the Acceptance Criteria in both sections above — no automated test coverage was added for this flow.
