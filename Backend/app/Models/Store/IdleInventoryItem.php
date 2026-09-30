<?php

namespace App\Models\Store;

use App\Models\Product;
use Flat3\Lodata\Attributes\LodataRelationship;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class IdleInventoryItem extends Model
{
    use HasFactory, SoftDeletes;

    protected $guarded = [];

    #[LodataRelationship]
    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }

    #[LodataRelationship]
    public function materialReceiptItem()
    {
        return $this->belongsTo(MaterialReceiptItem::class, 'material_receipt_item_id', 'id');
    }
}
