<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;

class Operation extends Model
{
    use HasCustomId;

    public function products(){
        return $this->belongsTo(Product::class, 'item_id', 'id');
    }
}
