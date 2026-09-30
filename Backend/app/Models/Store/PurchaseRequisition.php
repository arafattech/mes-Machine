<?php

namespace App\Models\Store;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Validation\ValidationException;
use Flat3\Lodata\Attributes\LodataRelationship;
use App\Models\Department;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseQuote;
use App\Models\User;
use App\Models\Store\PurchaseRequisitionItem;

class PurchaseRequisition extends Model
{
      use HasFactory, SoftDeletes;
      protected $guarded = [];

      protected $casts = [
            'approved_at' => 'datetime',
            'final_approved_at' => 'datetime',
      ];

      private const STATUS_TRANSITIONS = [
            'SUBMITTED' => ['APPROVED', 'REJECTED'],
            'APPROVED' => ['FINAL_APPROVAL', 'REJECTED'],
            'FINAL_APPROVAL' => [],
            'REJECTED' => [],
      ];

      private const APPROVAL_WORKFLOW_TYPES = ['SPR', 'SR'];

      protected static function booted(): void
      {
            static::updating(function (PurchaseRequisition $requisition) {
                  if (
                        ! in_array($requisition->type, self::APPROVAL_WORKFLOW_TYPES, true)
                        || ! $requisition->isDirty('status')
                  ) {
                        return;
                  }

                  $from = (string) $requisition->getOriginal('status');
                  $to = (string) $requisition->status;
                  $allowed = self::STATUS_TRANSITIONS[$from] ?? [];

                  if (! in_array($to, $allowed, true)) {
                        throw ValidationException::withMessages([
                              'status' => "Invalid requisition status transition from {$from} to {$to}.",
                        ]);
                  }
            });
      }

      #[LodataRelationship]
      public function requestBy()
      {
            return $this->belongsTo(User::class, 'requested_by', 'id');
      }

      #[LodataRelationship]
      public function finalApprovedBy()
      {
            return $this->belongsTo(User::class, 'final_approved_by', 'id');
      }

      #[LodataRelationship]
      public function department()
      {
            return $this->belongsTo(Department::class, 'department_id', 'id');
      }

      #[LodataRelationship]
      public function sprItems()
      {
            return $this->hasMany(PurchaseRequisitionItem::class, 'spr_id', 'id');
      }

      #[LodataRelationship]
      public function purchaseQuotes()
      {
            return $this->hasMany(PurchaseQuote::class, 'purchase_requisition_id', 'id');
      }

      public function approvals()
      {
            return $this->hasMany(\App\Models\RequisitionApproval::class, 'requisition_id', 'id');
      }

      #[LodataRelationship]
      public function purchaseOrders()
      {
            return $this->hasMany(PurchaseOrder::class, 'spr_id', 'id');
      }
}
