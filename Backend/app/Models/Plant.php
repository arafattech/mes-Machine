<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;
class Plant extends Model
{
    use HasCustomId;
    public function halls()
    {
        return $this->belongsToMany(Hall::class, 'hall_plant');
    }
}
