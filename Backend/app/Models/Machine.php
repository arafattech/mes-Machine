<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;

class Machine extends Model
{
    use HasCustomId;

    /** `machines.dashboard_view` column default — the original OEE & Production dashboard. */
    public const DEFAULT_DASHBOARD_VIEW = 'OEE_PRODUCTION';

    /** Needed to choose a machine's dashboard layout; super-admin grants it to roles. */
    public const DASHBOARD_VIEW_PERMISSION = 'BASE_DATA_MACHINE_DASHBOARD_VIEW';

    /**
     * The machine form hides the Dashboard View field without the permission, but the form is a
     * client — so a signed-in user lacking it can never change the stored value (no authenticated
     * user, i.e. seeders and console commands, is left alone).
     */
    protected static function booted(): void
    {
        static::saving(function (Machine $machine) {
            $user = auth()->user();
            if (! $user || ! $machine->isDirty('dashboard_view') || $user->can(self::DASHBOARD_VIEW_PERMISSION)) {
                return;
            }

            $machine->dashboard_view = $machine->exists
                ? $machine->getOriginal('dashboard_view')
                : self::DEFAULT_DASHBOARD_VIEW;
        });
    }

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
