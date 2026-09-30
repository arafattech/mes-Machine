<?php

namespace App\Models\Purchase;

use App\Models\Product;
use Flat3\Lodata\Attributes\LodataRelationship;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseOrderItem extends Model
{
    use HasFactory, SoftDeletes;

    protected $guarded = [];

    #[LodataRelationship]
    public function item()
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }

    #[LodataRelationship]
    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class, 'purchase_order_id', 'id');
    }
}
