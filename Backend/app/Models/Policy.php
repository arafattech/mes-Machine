<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;
use Flat3\Lodata\Attributes\LodataRelationship;

class Policy extends Model
{
    use HasCustomId;

    #[LodataRelationship]
    public function assignedBy()
    {
        return $this->belongsTo(User::class,'assigned_by', 'id');
    }
}
