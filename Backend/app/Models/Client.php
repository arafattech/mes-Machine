<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;
class Client extends Model
{
    use HasCustomId;
    protected $guarded = [];

    public function areas(){
        return $this->belongsToMany(ClientArea::class, 'client_has_areas');
    }

    public function notes(){
        return $this->belongsToMany(ClientNote::class, 'client_has_notes');
    }
}
