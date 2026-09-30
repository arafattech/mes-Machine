<?php

namespace App\Models\Store;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Validation\ValidationException;
use Flat3\Lodata\Attributes\LodataRelationship;
use App\Models\Product;

class ItemReturnItem extends Model
{
    use HasFactory;
    protected $guarded = [];

    protected static function booted(): void
    {
        static::saving(function (ItemReturnItem $item) {
            $prItem = PurchaseRequisitionItem::whereKey($item->purchase_requisition_item_id)
                ->first(['required_quantity', 'return_quantity']);

            // Cumulative return_quantity on the SR item only reflects already-approved
            // returns (this line's merge happens later, on ItemReturn approval), so the
            // remaining allowance is simply required minus what's already been returned.
            $remaining = max(0, (int) $prItem?->required_quantity - (int) $prItem?->return_quantity);

            if ((int) $item->return_quantity > $remaining) {
                throw ValidationException::withMessages([
                    'return_quantity' => 'Return quantity cannot exceed the remaining SR quantity.',
                ]);
            }
        });
    }

    #[LodataRelationship]
    public function itemReturn()
    {
        return $this->belongsTo(ItemReturn::class, 'item_return_id', 'id');
    }

    #[LodataRelationship]
    public function purchaseRequisitionItem()
    {
        return $this->belongsTo(PurchaseRequisitionItem::class, 'purchase_requisition_item_id', 'id');
    }

    #[LodataRelationship]
    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }
}
