<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;

class ClientNote extends Model
{
    use HasCustomId;

    public function clients(){
        return $this->belongsToMany(Client::class, 'client_has_notes');
    }
}
