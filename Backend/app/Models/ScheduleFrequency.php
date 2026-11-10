<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * User-defined recurrence interval for recurring maintenance schedules
 * (`maintenance_schedules.schedule_frequency_id`).
 */
class ScheduleFrequency extends Model
{
    protected $fillable = [
        'name',
        'interval_days',
        'is_active',
    ];

    protected $casts = [
        'interval_days' => 'integer',
        'is_active' => 'boolean',
    ];

    public function maintenanceSchedules(): HasMany
    {
        return $this->hasMany(MaintenanceSchedule::class);
    }

    /** The date one interval after `$from`. */
    public function nextAfter(Carbon $from): Carbon
    {
        return $from->copy()->addDays($this->interval_days);
    }
}
