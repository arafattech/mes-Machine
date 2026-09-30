<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MachineCounter extends Model
{
    protected $fillable = [
        'masch_id',
        'shot_nr',
        'last_cycle_time',
        'cycle_time',
    ];
}
