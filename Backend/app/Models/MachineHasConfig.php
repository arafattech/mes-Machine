<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MachineHasConfig extends Model
{
    protected $fillable = [
        'machine_id',
        'machine_name',
        'is_active',
        'config_id',
        'ip_plc',
        'id_iot',
        'protocol',
        'type',
        'read_from',
        'ip_hmi',
        'port',
        'websocket_port',
        'max_rpm',
        'min_rpm',
        'max_temp',
        'min_temp',
        'ideal_cycle_seconds',
        'shot_buffer',
        'timeout_sec',
        'server_call_sec',
        'auto_signal',
        'shot_signal',
        'inverse_auto',
        'inverse_shot',
        'auto_independent',
        'live_status_api',
        'live_shot_api',
        'test_status_api',
        'test_shot_api',
        'active',
        'scrap',
        'robot_active',
        'robot',
        'press_active',
        'press',
        'handling_active',
        'handling',
        'selection_type',
        'heating_start',
        'order_of_machine',
    ];

    public function machine()
    {
        return $this->belongsTo(Machine::class);
    }
    public function channels()
    {
        return $this->hasMany(ConfigHasChannel::class, 'config_id', 'id');
    }
}
