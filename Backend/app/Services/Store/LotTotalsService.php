<?php

namespace App\Services\Store;

use App\Models\Store\Lot;
use App\Models\Store\MaterialReceiptItem;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class LotTotalsService
{
    /**
     * Sums Lot bale_quantity/net_weight_kg per (material_receipt_id, product_id) for a set of
     * MaterialReceiptLog rows — Lot has no direct log FK, only a link via MaterialReceiptItem,
     * which shares the same (material_receipt_id, product_id) pair as the log.
     *
     * @param Collection $logs MaterialReceiptLog rows (must expose material_receipt_id, product_id)
     * @return array<string, array{bale_quantity: float, net_weight_kg: float}> keyed by "{material_receipt_id}_{product_id}"
     */
    public function totalsByReceiptAndProduct(Collection $logs): array
    {
        $receiptIds = $logs->pluck('material_receipt_id')->unique()->values();
        if ($receiptIds->isEmpty()) {
            return [];
        }

        $items = MaterialReceiptItem::query()
            ->whereIn('material_receipt_id', $receiptIds)
            ->get(['id', 'material_receipt_id', 'product_id']);

        if ($items->isEmpty()) {
            return [];
        }

        $lotSumsByItemId = Lot::query()
            ->whereIn('mrr_item_id', $items->pluck('id'))
            ->groupBy('mrr_item_id')
            ->select('mrr_item_id', DB::raw('SUM(bale_quantity) as bale_quantity'), DB::raw('SUM(net_weight_kg) as net_weight_kg'))
            ->get()
            ->keyBy('mrr_item_id');

        $totals = [];
        foreach ($items as $item) {
            $sums = $lotSumsByItemId->get($item->id);
            if (!$sums) {
                continue;
            }

            $key = $item->material_receipt_id . '_' . $item->product_id;
            $totals[$key] ??= ['bale_quantity' => 0, 'net_weight_kg' => 0];
            $totals[$key]['bale_quantity'] += (float) $sums->bale_quantity;
            $totals[$key]['net_weight_kg'] += (float) $sums->net_weight_kg;
        }

        return $totals;
    }
}
