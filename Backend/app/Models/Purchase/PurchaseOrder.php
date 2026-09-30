<?php

namespace App\Models\Purchase;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Flat3\Lodata\Attributes\LodataRelationship;
use App\Models\Department;
use App\Models\Store\MaterialReceipt;
use App\Models\Store\PurchaseRequisition;
use App\Models\User;
use App\Models\Supplier;

class PurchaseOrder extends Model
{
      use HasFactory, SoftDeletes;
      protected $guarded = [];

      #[LodataRelationship]
      public function requestBy()
      {
            return $this->belongsTo(User::class, 'created_by', 'id');
      }

      #[LodataRelationship]
      public function department()
      {
            return $this->belongsTo(Department::class, 'department_id', 'id');
      }

      #[LodataRelationship]
      public function supplier()
      {
            return $this->belongsTo(Supplier::class , 'supplier_id', 'id');
      }

      #[LodataRelationship]
      public function requisition()
      {
            return $this->belongsTo(PurchaseRequisition::class, 'spr_id', 'id');
      }

      #[LodataRelationship]
      public function quote()
      {
            return $this->belongsTo(PurchaseQuote::class, 'purchase_quote_id', 'id');
      }

      #[LodataRelationship]
      public function poItems()
      {
            return $this->hasMany(PurchaseOrderItem::class, 'purchase_order_id', 'id');
      }

      public function materialReceipts()
      {
            return $this->hasMany(MaterialReceipt::class, 'purchase_order_id', 'id');
      }
}
