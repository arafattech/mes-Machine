<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MachineWastageEntry extends Model
{
    protected $fillable = [
        'work_order_id',
        'wastage_type_id',
        'shift_id',
        'entry_date',
        'qty_kg',
        'created_by',
    ];

    protected $casts = [
        'entry_date' => 'date',
        'qty_kg' => 'decimal:2',
    ];

    public function workOrder()
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function wastageType()
    {
        return $this->belongsTo(MachineWastageType::class, 'wastage_type_id');
    }

    public function shift()
    {
        return $this->belongsTo(EmployeeShift::class, 'shift_id');
    }

    public function allocations()
    {
        return $this->hasMany(MachineWastageAllocation::class, 'wastage_entry_id');
    }
}
