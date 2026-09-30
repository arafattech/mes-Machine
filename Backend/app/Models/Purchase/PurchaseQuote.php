<?php

namespace App\Models\Purchase;

use App\Models\Purchase\PurchaseOrder;
use App\Models\Store\PurchaseRequisition;
use App\Models\Supplier;
use App\Models\User;
use Flat3\Lodata\Attributes\LodataRelationship;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseQuote extends Model
{
    use HasFactory, SoftDeletes;

    protected $guarded = [];

    #[LodataRelationship]
    public function supplier()
    {
        return $this->belongsTo(Supplier::class, 'supplier_id', 'id');
    }

    #[LodataRelationship]
    public function requisition()
    {
        return $this->belongsTo(PurchaseRequisition::class, 'purchase_requisition_id', 'id');
    }

    #[LodataRelationship]
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', 'id');
    }

    #[LodataRelationship]
    public function quoteItems()
    {
        return $this->hasMany(PurchaseQuoteItem::class, 'purchase_quote_id', 'id');
    }

    #[LodataRelationship]
    public function purchaseOrders()
    {
        return $this->hasMany(PurchaseOrder::class, 'purchase_quote_id', 'id');
    }
}
