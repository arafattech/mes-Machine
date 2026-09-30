<?php

namespace App\Models;
use Flat3\Lodata\Attributes\LodataRelationship;
use App\Traits\HasCustomId;
use Illuminate\Database\Eloquent\Model;

class Hall extends Model
{
    use HasCustomId;
     #[LodataRelationship]
    public function plants()
    {
        return $this->belongsToMany(Plant::class, 'hall_plant');
    }

    #[LodataRelationship]
    public function machines()
    {
        return $this->belongsToMany(Machine::class,'machine_has_halls');
    }
}
