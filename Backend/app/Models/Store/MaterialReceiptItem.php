<?php

namespace App\Models\Store;

use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Flat3\Lodata\Attributes\LodataRelationship;
use Illuminate\Database\Eloquent\Model;

class MaterialReceiptItem extends Model
{
    use HasFactory, SoftDeletes;

    protected $guarded = [];

    #[LodataRelationship]
    public function item()
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }

    #[LodataRelationship]
    public function receipt()
    {
        return $this->belongsTo(MaterialReceipt::class, 'material_receipt_id', 'id');
    }
}
