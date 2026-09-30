<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MaintenanceSchedule extends Model
{
    protected $table = 'maintenance_schedules';

    protected $fillable = [
        'machine_id',
        'start_date',
        'scheduled_time',
        'frequency',
        'is_active',
        'buffer_enabled',
        'next_maintenance_date',
        'created_by_user_id',
    ];

    protected $casts = [
        'start_date' => 'date',
        'is_active' => 'boolean',
        'buffer_enabled' => 'boolean',
        'next_maintenance_date' => 'datetime',
    ];

    public function machine(): BelongsTo
    {
        return $this->belongsTo(Machine::class);
    }

    public function createdByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }
}
