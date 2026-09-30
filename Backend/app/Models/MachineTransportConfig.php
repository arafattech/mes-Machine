<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MachineTransportConfig extends Model
{
    protected $fillable = [
        'masch_id',
        'transport',
        'api_url',
        'api_signal_map',
    ];

    protected $casts = [
        'api_signal_map' => 'array',
    ];
}
