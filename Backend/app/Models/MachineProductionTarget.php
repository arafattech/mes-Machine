<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MachineProductionTarget extends Model
{
    protected $fillable = [
        'machine_id',
        'work_order_id',
        'shift_id',
        'target_qty',
        'effective_from',
        'effective_to',
        'is_active',
    ];

    protected $casts = [
        'target_qty' => 'integer',
        'effective_from' => 'datetime',
        'effective_to' => 'datetime',
        'is_active' => 'boolean',
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
