<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;

class Machine extends Model
{
    use HasCustomId;

    public function states()
    {
        return $this->belongsToMany(MachineState::class, 'machine_has_states')->withPivot('is_default');
    }
    public function machinegroups()
    {
        return $this->belongsToMany(MachineGroup::class, 'machine_has_groups');
    }

    public function machinehalls()
    {
        return $this->belongsToMany(Hall::class, 'machine_has_halls');
    }

    public function machinewastagetypes()
    {
        return $this->belongsToMany(MachineWastageType::class, 'machine_has_wastage', 'machine_id', 'wastage_id');
    }

    public function stateEvents()
    {
        return $this->hasMany(MachineStateEvent::class);
    }

    public function maintenanceSchedules()
    {
        return $this->hasMany(MachineMaintenanceSchedule::class);
    }

    public function workOrders()
    {
        return $this->belongsToMany(WorkOrder::class, 'work_order_machines');
    }
}
