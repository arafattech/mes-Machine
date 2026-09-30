<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Lodata\Attributes\LodataRelationship;

class ProductHasvariant extends Model
{
    protected $guarded = [];
    #[LodataRelationship]
    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }
    
}
