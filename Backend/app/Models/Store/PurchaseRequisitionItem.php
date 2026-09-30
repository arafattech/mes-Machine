<?php

namespace App\Models\Store;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Flat3\Lodata\Attributes\LodataRelationship;
use Illuminate\Database\Eloquent\Model;
use App\Models\Product;

class PurchaseRequisitionItem extends Model
{
    use HasFactory;
    protected $guarded = [];

        #[LodataRelationship]
      public function item()
      {
            return $this->belongsTo(Product::class, 'product_id', 'id');
      }
}
