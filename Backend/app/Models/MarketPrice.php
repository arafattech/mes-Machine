<?php

namespace App\Models;
use Flat3\Lodata\Attributes\LodataRelationship;
use Illuminate\Database\Eloquent\Model;
use App\Models\Product;
use App\Models\User;

class MarketPrice extends Model
{
    protected $guarded = [];

    #[LodataRelationship]
    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }

    #[LodataRelationship]
    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by', 'id');
    }

}
