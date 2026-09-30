<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;
class MachineState extends Model
{
    use HasCustomId;
    public function machines()
    {
        return $this->belongsToMany(Machine::class, 'machine_has_states');
    }
}
