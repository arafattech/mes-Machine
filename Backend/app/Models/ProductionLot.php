<?php

namespace App\Models;

use App\Traits\HasCustomId;
use Flat3\Lodata\Attributes\LodataRelationship;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProductionLot extends Model
{
    use HasCustomId, SoftDeletes;

    protected $guarded = [];

    protected $casts = [
        'lot_date' => 'date',
        'doffed_at' => 'datetime',
    ];

    #[LodataRelationship]
    public function workOrder()
    {
        return $this->belongsTo(WorkOrder::class, 'work_order_id');
    }

    #[LodataRelationship]
    public function machine()
    {
        return $this->belongsTo(Machine::class, 'machine_id');
    }

    #[LodataRelationship]
    public function hall()
    {
        return $this->belongsTo(Hall::class, 'hall_id');
    }

    #[LodataRelationship]
    public function shift()
    {
        return $this->belongsTo(EmployeeShift::class, 'shift_id');
    }

    #[LodataRelationship]
    public function operator()
    {
        return $this->belongsTo(Employee::class, 'operator_id');
    }

    #[LodataRelationship]
    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    #[LodataRelationship]
    public function counts()
    {
        return $this->hasMany(ProductionLotCount::class, 'production_lot_id');
    }
}
