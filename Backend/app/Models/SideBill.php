<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;
use Flat3\Lodata\Attributes\LodataRelationship;
use App\Models\EmployeeShift;

class SideBill extends Model
{
    use HasCustomId;

    protected $guarded = [];

    #[LodataRelationship]
    public function employee()
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    #[LodataRelationship]
    public function machine()
    {
        return $this->belongsTo(Machine::class, 'machine_id');
    }

    #[LodataRelationship]
    public function machineGroup()
    {
        return $this->belongsTo(MachineGroup::class, 'machine_group_id');
    }

    #[LodataRelationship]
    public function shift()
    {
        return $this->belongsTo(EmployeeShift::class, 'shift_id');
    }

    #[LodataRelationship]
    public function currentWorkingMachine()
    {
        return $this->belongsTo(Machine::class, 'current_working_machine_id');
    }

    #[LodataRelationship]
    public function sideWorkingMachine()
    {
        return $this->belongsTo(Machine::class, 'side_working_machine_id');
    }
}
