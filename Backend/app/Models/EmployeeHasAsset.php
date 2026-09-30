<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;
use Lodata\Attributes\LodataRelationship;

class EmployeeHasAsset extends Model
{
    use HasCustomId;

    #[LodataRelationship]
    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    #[LodataRelationship]
    public function asset()
    {
        return $this->belongsTo(Asset::class);
    }
}
