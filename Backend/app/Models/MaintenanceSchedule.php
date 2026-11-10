<?php

namespace App\Models;

use App\Enums\Machine\MaintenanceWorkType;
use App\Support\FactoryClock;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MaintenanceSchedule extends Model
{
    protected $table = 'maintenance_schedules';

    protected $fillable = [
        'machine_id',
        'start_date',
        'scheduled_time',
        'schedule_frequency_id',
        'type_of_work',
        'is_active',
        'buffer_enabled',
        'buffer_minutes',
        'next_maintenance_date',
        'created_by_user_id',
    ];

    protected $casts = [
        'start_date' => 'date',
        'type_of_work' => MaintenanceWorkType::class,
        'is_active' => 'boolean',
        'buffer_enabled' => 'boolean',
        'buffer_minutes' => 'integer',
        'next_maintenance_date' => 'datetime',
    ];

    protected $appends = ['overdue_days'];

    public function machine(): BelongsTo
    {
        return $this->belongsTo(Machine::class);
    }

    /**
     * Whole factory days an active schedule is past its next date (null when not overdue).
     * `next_maintenance_date` holds naive factory wall-clock time, so its date part is the
     * factory date as stored.
     */
    protected function overdueDays(): Attribute
    {
        return Attribute::get(function (): ?int {
            if (! $this->is_active || ! $this->next_maintenance_date) {
                return null;
            }

            $dueOn = CarbonImmutable::parse($this->next_maintenance_date->toDateString());
            $today = CarbonImmutable::parse(FactoryClock::today());

            return $dueOn->lessThan($today) ? (int) $dueOn->diffInDays($today) : null;
        });
    }

    public function frequency(): BelongsTo
    {
        return $this->belongsTo(ScheduleFrequency::class, 'schedule_frequency_id');
    }

    public function createdByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }
}
