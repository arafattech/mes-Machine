<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MachineProductionCount extends Model
{
    protected $fillable = [
        'machine_id',
        'work_order_id',
        'shift_id',
        'bucket_started_at',
        'bucket_ended_at',
        'good_count',
        'scrap_count',
        'total_count',
    ];

    protected $casts = [
        'bucket_started_at' => 'datetime',
        'bucket_ended_at' => 'datetime',
        'good_count' => 'integer',
        'scrap_count' => 'integer',
        'total_count' => 'integer',
    ];

    public function machine()
    {
        return $this->belongsTo(Machine::class);
    }

    public function workOrder()
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function shift()
    {
        return $this->belongsTo(EmployeeShift::class, 'shift_id');
    }
}
