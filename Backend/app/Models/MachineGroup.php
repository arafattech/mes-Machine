<?php

namespace App\Models;

use Flat3\Lodata\Attributes\LodataRelationship;
use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;

class MachineGroup extends Model
{
    use HasCustomId;

    #[LodataRelationship]
    public function machines()
    {
        return $this->belongsToMany(Machine::class, 'machine_has_groups');
    }
}
