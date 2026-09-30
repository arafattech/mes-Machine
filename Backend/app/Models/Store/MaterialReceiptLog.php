<?php

namespace App\Models\Store;

use App\Models\Product;
use App\Models\User;
use Flat3\Lodata\Attributes\LodataRelationship;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MaterialReceiptLog extends Model
{
    use HasFactory;

    protected $guarded = [];

    #[LodataRelationship]
    public function receipt()
    {
        return $this->belongsTo(MaterialReceipt::class, 'material_receipt_id', 'id');
    }

    #[LodataRelationship]
    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }

    #[LodataRelationship]
    public function receivedBy()
    {
        return $this->belongsTo(User::class, 'received_by', 'id');
    }
}
