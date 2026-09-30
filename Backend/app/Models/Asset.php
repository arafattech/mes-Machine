<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;
use Lodata\Attributes\LodataRelationship;
class Asset extends Model
{
    use HasCustomId;

    #[LodataRelationship]
    public function employees()
    {
        return $this->belongsToMany(Employee::class);
    }

    #[LodataRelationship]
    public function employeeHasAssets()
    {
        return $this->hasMany(EmployeeHasAsset::class);
    }

}
