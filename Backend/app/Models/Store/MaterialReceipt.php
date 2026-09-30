<?php

namespace App\Models\Store;

use App\Models\Department;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Flat3\Lodata\Attributes\LodataRelationship;
use Illuminate\Database\Eloquent\Model;

class MaterialReceipt extends Model
{
    use HasFactory, SoftDeletes;
    protected $guarded = [];

    #[LodataRelationship]
    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class, 'purchase_order_id', 'id');
    }

    #[LodataRelationship]
    public function requisition()
    {
        return $this->belongsTo(PurchaseRequisition::class, 'purchase_requisition_id', 'id');
    }

    #[LodataRelationship]
    public function requestBy()
    {
        return $this->belongsTo(User::class, 'requested_by', 'id');
    }

    #[LodataRelationship]
    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id', 'id');
    }

    #[LodataRelationship]
    public function supplier()
    {
        return $this->belongsTo(Supplier::class, 'supplier_id', 'id');
    }

    #[LodataRelationship]
    public function receiptItems()
    {
        return $this->hasMany(MaterialReceiptItem::class, 'material_receipt_id', 'id');
    }

    #[LodataRelationship]
    public function returnedBy()
    {
        return $this->belongsTo(User::class, 'returned_by', 'id');
    }

    #[LodataRelationship]
    public function mrrReturns()
    {
        return $this->hasMany(MrrReturn::class, 'material_receipt_id', 'id');
    }
}
