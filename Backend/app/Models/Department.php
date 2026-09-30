<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;
use Flat3\Lodata\Attributes\LodataRelationship;

class Department extends Model
{
    use HasCustomId;
    //
    protected $guarded = [];
    #[LodataRelationship]
    public function notices()
    {
        return $this->belongsToMany(Notice::class, 'notices_departments');
    }
    
}
