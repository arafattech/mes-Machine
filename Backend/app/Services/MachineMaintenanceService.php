<?php

namespace App\Services;

use App\Enums\Machine\MaintenanceEndedBy;
use App\Models\MachineMaintenanceSchedule;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Manual machine-maintenance scheduling. Laravel is the single writer of
 * `machine_maintenance_schedules` (schedule/activate/end); node-server closes
 * rows automatically (`ended_by='auto'`) when the machine's real Active channel
 * confirms running again. State signals flow through
 * MachineMaintenanceOverrideSignal — this service never writes
 * `machine_state_events` directly.
 */
class MachineMaintenanceService
{
    public function __construct(
        private readonly MachineMaintenanceOverrideSignal $overrideSignal,
    ) {}

    /**
     * Create a maintenance schedule for a machine. At most one open (un-ended)
     * row per machine — enforced with a `lockForUpdate()` race guard. Always
     * created SCHEDULED, even when `scheduledStartAt` is already in the past —
     * activation only ever happens via the manual "Activate now" action
     * (`activate()`), never automatically.
     *
     * @throws ValidationException when an open schedule already exists.
     */
    public function schedule(int $machineId, string $scheduledStartAt, string $reason, int $createdByUserId, bool $bufferEnabled = true): MachineMaintenanceSchedule
    {
        $scheduledStart = Carbon::parse($scheduledStartAt);

        return DB::transaction(function () use ($machineId, $scheduledStart, $reason, $createdByUserId, $bufferEnabled) {
            // We only block creating a new emergency schedule if there's already an open EMERGENCY schedule.
            // A pending recurring schedule (maintenance_schedule_id IS NOT NULL) does not block emergency maintenance.
            $open = MachineMaintenanceSchedule::where('machine_id', $machineId)
                ->whereNull('ended_at')
                ->whereNull('maintenance_schedule_id')
                ->lockForUpdate()
                ->first();

            if ($open) {
                throw ValidationException::withMessages([
                    'machine_id' => 'An open manual maintenance schedule already exists for this machine.',
                ]);
            }

            return MachineMaintenanceSchedule::create([
                'machine_id' => $machineId,
                'scheduled_start_at' => $scheduledStart,
                'reason' => $reason,
                'activated_at' => null,
                'created_by_user_id' => $createdByUserId,
                'buffer_enabled' => $bufferEnabled,
            ]);
        });
    }

    /**
     * Edit a maintenance schedule. While SCHEDULED (not yet activated), the
     * machine, start time, and reason are all editable; once ACTIVE only the
     * reason may change (the machine is already forced to MAINTENANCE); ended
     * rows cannot be edited at all. `buffer_enabled` is always editable
     * regardless of state — node-server reads it live from the row only when
     * the schedule ends (`MachineStateTrackerService.reopenMaintenanceSession`).
     *
     * @throws ValidationException on an ended row or an illegal ACTIVE-row edit.
     */
    public function update(int $id, ?int $machineId, ?string $scheduledStartAt, ?string $reason, ?bool $bufferEnabled = null): ?MachineMaintenanceSchedule
    {
        return DB::transaction(function () use ($id, $machineId, $scheduledStartAt, $reason, $bufferEnabled) {
            $schedule = MachineMaintenanceSchedule::whereKey($id)->lockForUpdate()->first();

            if (! $schedule) {
                return null;
            }

            if ($schedule->ended_at !== null) {
                throw ValidationException::withMessages([
                    'id' => 'Ended maintenance schedules cannot be edited.',
                ]);
            }

            $payload = [];
            if ($reason !== null) {
                $payload['reason'] = $reason;
            }
            if ($bufferEnabled !== null) {
                $payload['buffer_enabled'] = $bufferEnabled;
            }

            if ($schedule->activated_at !== null) {
                if ($machineId !== null || $scheduledStartAt !== null) {
                    throw ValidationException::withMessages([
                        'machine_id' => 'Active maintenance schedules can only have their reason changed.',
                    ]);
                }
            } else {
                if ($machineId !== null) {
                    $open = MachineMaintenanceSchedule::where('machine_id', $machineId)
                        ->whereNull('ended_at')
                        ->where('id', '!=', $id)
                        ->whereNull('maintenance_schedule_id')
                        ->lockForUpdate()
                        ->first();

                    if ($open) {
                        throw ValidationException::withMessages([
                            'machine_id' => 'An open manual maintenance schedule already exists for this machine.',
                        ]);
                    }

                    $payload['machine_id'] = $machineId;
                }

                if ($scheduledStartAt !== null) {
                    $payload['scheduled_start_at'] = Carbon::parse($scheduledStartAt);
                }
            }

            if ($payload) {
                $schedule->update($payload);
            }

            return $schedule->fresh();
        });
    }

    /**
     * Delete a maintenance schedule. If it is ACTIVE, the override is cleared
     * first so node-server stops forcing MAINTENANCE — the machine must never
     * be stuck in MAINTENANCE because its schedule row disappeared.
     */
    public function delete(int $id): bool
    {
        return DB::transaction(function () use ($id) {
            $schedule = MachineMaintenanceSchedule::whereKey($id)->lockForUpdate()->first();

            if (! $schedule) {
                return false;
            }

            $wasActive = $schedule->activated_at !== null && $schedule->ended_at === null;
            $machineId = (int) $schedule->machine_id;

            $schedule->delete();

            if ($wasActive) {
                DB::afterCommit(fn () => $this->overrideSignal->clear($machineId));
            }

            return true;
        });
    }

    /**
     * Move a SCHEDULED row to ACTIVE. Idempotent: already-active or ended rows
     * are no-ops. `$bufferMinutes` is the operator-chosen length (from the
     * "Activate now" dialog) of the post-maintenance verification window
     * node-server will use for this row, replacing the old fixed 5-minute
     * default — see `MachineStateTrackerService.clearMaintenanceOverride`.
     */
    public function activate(int $scheduleId, int $bufferMinutes): void
    {
        $schedule = MachineMaintenanceSchedule::find($scheduleId);

        if (! $schedule || $schedule->ended_at !== null || $schedule->activated_at !== null) {
            return;
        }

        DB::transaction(function () use ($schedule, $bufferMinutes) {
            $fresh = MachineMaintenanceSchedule::whereKey($schedule->id)
                ->whereNull('ended_at')
                ->whereNull('activated_at')
                ->lockForUpdate()
                ->first();

            if (! $fresh) {
                return;
            }

            $fresh->update([
                'activated_at' => Carbon::now(),
                'buffer_minutes' => $bufferMinutes,
            ]);

            DB::afterCommit(fn () => $this->overrideSignal->activate((int) $fresh->machine_id));
        });
    }

    /**
     * End the machine's open schedule manually (operator "End Maintenance").
     * Clears the override so node-server stops forcing MAINTENANCE. No-op when
     * the machine has no open schedule.
     */
    public function endForMachine(int $machineId, int $endedByUserId, ?string $maintenanceNote = null): bool
    {
        return DB::transaction(function () use ($machineId, $endedByUserId, $maintenanceNote) {
            // Pick the active maintenance first, then manual (emergency) maintenance, then the earliest scheduled recurring maintenance.
            $schedule = MachineMaintenanceSchedule::where('machine_id', $machineId)
                ->whereNull('ended_at')
                ->orderByRaw('CASE WHEN activated_at IS NOT NULL THEN 1 ELSE 0 END DESC, maintenance_schedule_id IS NULL DESC, scheduled_start_at ASC')
                ->lockForUpdate()
                ->first();

            if (! $schedule) {
                return false;
            }

            $endedAt = Carbon::now();
            $payload = [
                'ended_at' => $endedAt,
                'ended_by' => MaintenanceEndedBy::MANUAL,
                'ended_by_user_id' => $endedByUserId,
                // Manual End always force-closes immediately, buffer or not —
                // clear any pending verification window this row was in.
                'pending_confirm_until' => null,
            ];

            if ($schedule->activated_at !== null) {
                $payload['duration_seconds'] = max(0, $schedule->activated_at->diffInSeconds($endedAt));
            }

            if ($maintenanceNote !== null) {
                $payload['maintenance_note'] = $maintenanceNote;
            }

            $schedule->update($payload);

            DB::afterCommit(fn () => $this->overrideSignal->clear($machineId));

            // Check if it's tied to a recurring MaintenanceSchedule
            if ($schedule->maintenance_schedule_id) {
                $recurring = \App\Models\MaintenanceSchedule::find($schedule->maintenance_schedule_id);
                if ($recurring && $recurring->is_active) {
                    // Calculate the new next_maintenance_date based on the ended date
                    $endedDateStr = Carbon::now()->format('Y-m-d');
                    $baseDate = Carbon::parse($endedDateStr . ' ' . $recurring->scheduled_time);
                    
                    $frequency = $recurring->frequency;
                    $newNextDate = match ($frequency) {
                        'weekly' => $baseDate->copy()->addWeek(),
                        '10-days' => $baseDate->copy()->addDays(10),
                        '15-days' => $baseDate->copy()->addDays(15),
                        'monthly' => $baseDate->copy()->addMonth(),
                        'yearly' => $baseDate->copy()->addYear(),
                        default => $baseDate->copy()->addDays(1), // Fallback
                    };

                    // Update recurring schedule
                    $recurring->update(['next_maintenance_date' => $newNextDate]);

                    // Schedule the next one in machine_maintenance_schedules
                    MachineMaintenanceSchedule::create([
                        'machine_id' => $machineId,
                        'scheduled_start_at' => $newNextDate,
                        'reason' => 'Scheduled Maintenance',
                        'created_by_user_id' => $endedByUserId,
                        'maintenance_schedule_id' => $recurring->id,
                        'buffer_enabled' => $recurring->buffer_enabled,
                    ]);
                }
            }

            return true;
        });
    }
}
