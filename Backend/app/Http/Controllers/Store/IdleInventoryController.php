<?php

namespace App\Http\Controllers\Store;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Store\MaterialReceiptItem;
use App\Models\Store\StockAdjustment;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IdleInventoryController extends Controller
{
    public function report(Request $request): JsonResponse
    {
        if ($request->filled('from') || $request->filled('to')) {
            $fromDate = $request->query('from')
                ? Carbon::parse($request->query('from'))->startOfDay()
                : now()->startOfMonth()->startOfDay();

            $toDate = $request->query('to')
                ? Carbon::parse($request->query('to'))->endOfDay()
                : now()->endOfDay();

            if ($fromDate->gt($toDate)) {
                [$fromDate, $toDate] = [$toDate->copy()->startOfDay(), $fromDate->copy()->endOfDay()];
            }
        } else {
            $month = min(max((int) $request->query('month', now()->month), 1), 12);
            $year = max((int) $request->query('year', now()->year), 1);

            $fromDate = Carbon::create($year, $month, 1)->startOfDay();
            $toDate = $fromDate->copy()->endOfMonth()->endOfDay();
        }

        $top = max((int) $request->query('$top', 0), 0);
        $skip = max((int) $request->query('$skip', 0), 0);

        $rows = $this->buildIdleInventoryRows($fromDate, $toDate);
        $count = count($rows);

        if ($top > 0) {
            $rows = array_values(array_slice($rows, $skip, $top));
        }

        return response()->json([
            'value' => $rows,
            '@count' => $count,
        ]);
    }

    private function buildIdleInventoryRows(Carbon $fromDate, Carbon $toDate): array
    {
        $products = Product::query()
            ->where('current_stock', '>', 0)
            ->get(['id', 'current_stock', 'item_code', 'product_name']);

        if ($products->isEmpty()) {
            return [];
        }

        $productIds = $products->pluck('id')->all();

        $receiptMovements = MaterialReceiptItem::with(['item', 'receipt'])
            ->whereIn('product_id', $productIds)
            ->whereHas('receipt', function ($query) use ($fromDate, $toDate) {
                $query->where('status', '!=', 'CANCELLED')
                    ->where(function ($movementQuery) use ($fromDate, $toDate) {
                        $movementQuery->whereBetween('receipt_date', [$fromDate->toDateString(), $toDate->toDateString()])
                            ->orWhereBetween('created_at', [$fromDate, $toDate]);
                    });
            })
            ->get()
            ->groupBy('product_id');

        $adjustmentMovements = StockAdjustment::query()
            ->whereIn('product_id', $productIds)
            ->where(function ($query) use ($fromDate, $toDate) {
                $query->whereBetween('adjustment_date', [$fromDate->toDateString(), $toDate->toDateString()])
                    ->orWhereBetween('created_at', [$fromDate, $toDate]);
            })
            ->get()
            ->groupBy('product_id');

        $allReceiptItems = MaterialReceiptItem::with(['item', 'receipt'])
            ->whereIn('product_id', $productIds)
            ->whereHas('receipt', fn ($query) => $query->where('status', '!=', 'CANCELLED'))
            ->get()
            ->groupBy('product_id');

        $latestAdjustmentDates = StockAdjustment::query()
            ->whereIn('product_id', $productIds)
            ->selectRaw('product_id, MAX(COALESCE(adjustment_date, DATE(created_at))) as last_movement_date')
            ->groupBy('product_id')
            ->pluck('last_movement_date', 'product_id');

        $rows = [];

        foreach ($products as $product) {
            if ($receiptMovements->has($product->id) || $adjustmentMovements->has($product->id)) {
                continue;
            }

            $receiptItems = $allReceiptItems->get($product->id, collect());
            $latestReceiptItem = $receiptItems->sortByDesc(function (MaterialReceiptItem $item) {
                $movementDate = $item->receipt?->receipt_date ?? $item->created_at;

                return $movementDate ? Carbon::parse($movementDate)->timestamp : 0;
            })->first();

            $latestReceiptDate = $latestReceiptItem
                ? Carbon::parse($latestReceiptItem->receipt?->receipt_date ?? $latestReceiptItem->created_at)->startOfDay()
                : null;

            $latestAdjustmentDate = isset($latestAdjustmentDates[$product->id])
                ? Carbon::parse($latestAdjustmentDates[$product->id])->startOfDay()
                : null;

            $lastMovementDate = collect([$latestReceiptDate, $latestAdjustmentDate])
                ->filter()
                ->sortByDesc(fn (Carbon $date) => $date->timestamp)
                ->first();

            $rows[] = [
                'custom_id' => 'IDLE-' . str_pad((string) $product->id, 6, '0', STR_PAD_LEFT),
                'material_receipt_item_id' => $latestReceiptItem?->id,
                'product_id' => $product->id,
                'quantity' => (int) $product->current_stock,
                'condition' => 'IDLE',
                'remarks' => sprintf(
                    'No material receipt or stock adjustment between %s and %s.',
                    $fromDate->toDateString(),
                    $toDate->toDateString()
                ),
                'created_date' => now()->toDateString(),
                'expiry_date' => null,
                'last_movement_date' => $lastMovementDate?->toDateString(),
                'product' => [
                    'id' => $product->id,
                    'item_code' => $product->item_code,
                    'product_name' => $product->product_name,
                ],
                'materialReceiptItem' => [
                    'id' => $latestReceiptItem?->id,
                    'item' => [
                        'id' => $latestReceiptItem?->item?->id,
                        'item_code' => $latestReceiptItem?->item?->item_code,
                        'product_name' => $latestReceiptItem?->item?->product_name,
                    ],
                ],
            ];
        }

        usort($rows, fn (array $left, array $right) => strcmp($right['custom_id'], $left['custom_id']));

        return $rows;
    }
}
