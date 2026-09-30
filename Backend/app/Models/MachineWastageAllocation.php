<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MachineWastageAllocation extends Model
{
    protected $fillable = [
        'wastage_entry_id',
        'machine_id',
        'allocated_qty_kg',
        'production_share',
    ];

    protected $casts = [
        'allocated_qty_kg' => 'decimal:2',
        'production_share' => 'decimal:5',
    ];

    public function wastageEntry()
    {
        return $this->belongsTo(MachineWastageEntry::class, 'wastage_entry_id');
    }

    public function machine()
    {
        return $this->belongsTo(Machine::class);
    }
}
