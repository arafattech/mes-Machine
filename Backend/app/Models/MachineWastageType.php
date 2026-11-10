<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\RequiresAttributes;
use App\Traits\HasCustomId;

class MachineWastageType extends Model
{
    use RequiresAttributes;

    protected array $requiredAttributes = ['name'];

    use HasCustomId;

    public function machines()
    {
        return $this->belongsToMany(Machine::class, 'machine_has_wastage', 'wastage_id', 'machine_id');
    }
}
