<?php

namespace App\Observers;

use App\Models\Product;
use App\Models\SalesOrder;
use App\Models\Store\StockAdjustment;
use App\Services\NotificationService;
use Illuminate\Support\Facades\DB;

class SalesOrderObserver
{
    public function __construct(private NotificationService $notificationService)
    {
    }

    public function saved(SalesOrder $salesOrder): void
    {
        $this->dispatchNotification($salesOrder);

        $isNewlyApproved = $salesOrder->wasRecentlyCreated
            ? $salesOrder->status === 'APPROVED'
            : $salesOrder->wasChanged('status') && $salesOrder->status === 'APPROVED';

        if (! $isNewlyApproved) {
            return;
        }

        DB::transaction(function () use ($salesOrder) {
            $salesOrder->loadMissing('items');

            foreach ($salesOrder->items->groupBy('product_id') as $productId => $items) {
                $alreadyDispatched = StockAdjustment::query()
                    ->where('sales_order_id', $salesOrder->id)
                    ->where('product_id', $productId)
                    ->where('reason', 'SALES_DISPATCH')
                    ->exists();

                if ($alreadyDispatched) {
                    continue;
                }

                $product = Product::query()->lockForUpdate()->find($productId);
                if (! $product) {
                    continue;
                }

                $quantity = (int) $items->sum('quantity');
                $product->decrement('current_stock', $quantity);

                StockAdjustment::create([
                    'product_id' => $product->id,
                    'sales_order_id' => $salesOrder->id,
                    'adjustment_quantity' => $quantity,
                    'created_by' => auth()->id(),
                    'condition' => 'DECREASED',
                    'reason' => 'SALES_DISPATCH',
                    'sectionable_type' => SalesOrder::class,
                    'sectionable_id' => $salesOrder->id,
                    'adjustment_date' => now()->toDateString(),
                ]);
            }
        });
    }

    private function dispatchNotification(SalesOrder $salesOrder): void
    {
        if ($salesOrder->wasRecentlyCreated) {
            $this->notificationService->dispatch($salesOrder, 'created', auth()->id());

            return;
        }

        if (! $salesOrder->wasChanged('status')) {
            return;
        }

        $actionType = match ($salesOrder->status) {
            'PENDING' => 'sent',
            'APPROVED' => 'approved',
            'REJECTED' => 'rejected',
            default => null,
        };

        if (! $actionType) {
            return;
        }

        $this->notificationService->dispatch($salesOrder, $actionType, auth()->id());
    }
}
