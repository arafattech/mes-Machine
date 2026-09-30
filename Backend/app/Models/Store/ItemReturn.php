<?php

namespace App\Models\Store;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;
use Flat3\Lodata\Attributes\LodataRelationship;
use App\Models\Department;
use App\Models\User;
use App\Models\Product;
use App\Enums\Store\ItemReturnStatus;
use App\Http\Controllers\ActivityLogController;

class ItemReturn extends Model
{
    use HasFactory, SoftDeletes;
    protected $guarded = [];

    protected $casts = [
        'return_date' => 'date',
    ];

    // On PENDING → APPROVED, merge each line's return_quantity back into the SR
    // item's received_quantity (the department no longer holds that stock).
    protected static function booted(): void
    {
        static::updating(function (ItemReturn $itemReturn) {
            if (! $itemReturn->isDirty('status')) {
                return;
            }

            $from = (string) $itemReturn->getOriginal('status');
            $to = (string) $itemReturn->status;

            if ($from === ItemReturnStatus::PENDING->value && $to === ItemReturnStatus::APPROVED->value) {
                DB::transaction(function () use ($itemReturn) {
                    foreach ($itemReturn->returnItems as $line) {
                        $prItem = PurchaseRequisitionItem::whereKey($line->purchase_requisition_item_id)
                            ->lockForUpdate()
                            ->first();

                        if (! $prItem) {
                            continue;
                        }

                        $prItem->received_quantity = max(0, $prItem->received_quantity - $line->return_quantity);
                        $prItem->return_quantity = ($prItem->return_quantity ?? 0) + $line->return_quantity;
                        $prItem->save();

                        // Returned stock physically goes back into the store — restock the product.
                        $product = Product::whereKey($line->product_id)->lockForUpdate()->first();
                        if ($product) {
                            $product->current_stock = (string) ((int) $product->current_stock + $line->return_quantity);
                            $product->save();
                        }
                    }
                });
            }
        });

        static::updated(function (ItemReturn $itemReturn) {
            if (! $itemReturn->wasChanged('status')) {
                return;
            }

            $actionType = match ($itemReturn->status) {
                ItemReturnStatus::APPROVED->value => 'approved',
                ItemReturnStatus::REJECTED->value => 'rejected',
                default => null,
            };

            if ($actionType) {
                ActivityLogController::createLog($itemReturn, $actionType);
            }
        });
    }

    #[LodataRelationship]
    public function purchaseRequisition()
    {
        return $this->belongsTo(PurchaseRequisition::class, 'purchase_requisition_id', 'id');
    }

    #[LodataRelationship]
    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id', 'id');
    }

    #[LodataRelationship]
    public function requestBy()
    {
        return $this->belongsTo(User::class, 'requested_by', 'id');
    }

    #[LodataRelationship]
    public function returnItems()
    {
        return $this->hasMany(ItemReturnItem::class, 'item_return_id', 'id');
    }
}
