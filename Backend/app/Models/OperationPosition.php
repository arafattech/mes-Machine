<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;

class OperationPosition extends Model
{
    use HasCustomId;

    public function products(){
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }

    public function machines(){
        return $this->belongsTo(Machine::class, 'machine_id', 'id');
    }
}
