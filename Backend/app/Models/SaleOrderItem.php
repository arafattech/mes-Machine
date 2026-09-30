<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\SalesOrder;
use App\Models\Product;
use Flat3\Lodata\Attributes\LodataRelationship;

class SaleOrderItem extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'sale_order_items';

    protected $fillable = [
        'sales_order_id',
        'product_id',
        'quantity',
        'unit_price',
        'minimum_unit_price',
        'total_price',
        'status',
        'discount',
        'discount_type',
        'discount_amount',
    ];

    #[LodataRelationship]
    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }

}
