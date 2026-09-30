<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;

class ClientArea extends Model
{
    use HasCustomId;

    public function clients()
    {
        return $this->belongsToMany(ClientArea::class, 'client_has_areas');
    }
}
