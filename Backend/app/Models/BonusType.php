<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Flat3\Lodata\Attributes\LodataRelationship;

class BonusType extends Model
{
    protected $guarded = [];

    #[LodataRelationship]
    public function bonusConfigs()
    {
        return $this->hasMany(BonusConfig::class, 'bonus_type_id');
    }

    #[LodataRelationship]
    public function employeeBonuses()
    {
        return $this->hasMany(EmployeeBonus::class, 'bonus_type_id');
    }
}
