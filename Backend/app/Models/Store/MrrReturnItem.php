<?php

namespace App\Models\Store;

use App\Models\Product;
use Flat3\Lodata\Attributes\LodataRelationship;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MrrReturnItem extends Model
{
    use HasFactory;

    protected $guarded = [];

    #[LodataRelationship]
    public function mrrReturn()
    {
        return $this->belongsTo(MrrReturn::class, 'mrr_return_id', 'id');
    }

    #[LodataRelationship]
    public function item()
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }
}
