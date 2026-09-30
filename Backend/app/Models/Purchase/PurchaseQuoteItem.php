<?php

namespace App\Models\Purchase;

use App\Models\Product;
use Flat3\Lodata\Attributes\LodataRelationship;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseQuoteItem extends Model
{
    use HasFactory, SoftDeletes;

    protected $guarded = [];

    #[LodataRelationship]
    public function item()
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }
}
