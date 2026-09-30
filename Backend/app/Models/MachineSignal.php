<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MachineSignal extends Model
{
    protected $fillable = [
        'masch_id',
        'invert_F',
        'invert_P',
        'invert_A',
        'invert_ZH',
        'invert_HK',
    ];
}
