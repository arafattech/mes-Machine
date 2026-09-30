<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MachineStateEvent extends Model
{
    protected $fillable = [
        'machine_id',
        'state',
        'started_at',
        'ended_at',
        'duration_seconds',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'duration_seconds' => 'integer',
    ];

    public function machine()
    {
        return $this->belongsTo(Machine::class);
    }
}
