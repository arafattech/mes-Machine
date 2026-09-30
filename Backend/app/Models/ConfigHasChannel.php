<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ConfigHasChannel extends Model
{
    protected $fillable = [
        'config_id',
        'channel_id',
        'status',
        'machine_state_id',
    ];

    protected $casts = [
        'channel_id' => 'integer',
        'machine_state_id' => 'integer',
    ];

    public function config()
    {
        return $this->belongsTo(MachineHasConfig::class, 'config_id', 'id');
    }

    public function machineState()
    {
        return $this->belongsTo(MachineState::class, 'machine_state_id');
    }
}
