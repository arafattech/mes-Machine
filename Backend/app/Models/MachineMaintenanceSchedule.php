<?php

namespace App\Models;

use App\Enums\Machine\MaintenanceEndedBy;
use Illuminate\Database\Eloquent\Model;

/**
 * A manual machine-maintenance schedule. One open row per machine enforced at
 * the application layer (validation + `lockForUpdate` race guard), not by a
 * DB constraint.
 *
 * States: `activated_at IS NULL` + `ended_at IS NULL` = SCHEDULED (future);
 * `activated_at` set + `ended_at IS NULL` = ACTIVE; `ended_at` set = closed.
 */
class MachineMaintenanceSchedule extends Model
{
    protected $fillable = [
        'machine_id',
        'scheduled_start_at',
        'reason',
        'maintenance_note',
        'activated_at',
        'ended_at',
        'pending_confirm_until',
        'duration_seconds',
        'ended_by',
        'ended_by_user_id',
        'created_by_user_id',
        'maintenance_schedule_id',
        'buffer_enabled',
        'buffer_minutes',
    ];

    protected $casts = [
        'scheduled_start_at' => 'datetime',
        'activated_at' => 'datetime',
        'ended_at' => 'datetime',
        'pending_confirm_until' => 'datetime',
        'duration_seconds' => 'integer',
        'ended_by' => MaintenanceEndedBy::class,
        'buffer_enabled' => 'boolean',
        'buffer_minutes' => 'integer',
    ];

    public function machine()
    {
        return $this->belongsTo(Machine::class);
    }

    public function endedByUser()
    {
        return $this->belongsTo(User::class, 'ended_by_user_id');
    }

    public function createdByUser()
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }
}
