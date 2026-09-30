<?php

namespace App\Services\Store;

use App\Enums\Production\LotStatus;
use App\Enums\Store\StoreTransferItemStatus;
use App\Enums\Store\YarnAdviceStatus;
use App\Models\ProductionLotCount;
use App\Models\Store\YarnTransferAdvice;
use App\Models\Store\YarnTransferAdviceLine;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class YarnAdviceService
{
    private const LINE_RELATIONS = 'lines.productionLotCount.countType';

    public function create(array $payload): YarnTransferAdvice
    {
        return DB::transaction(function () use ($payload) {
            $advice = YarnTransferAdvice::create([
                'prepared_by' => auth()->id(),
                'from_hall_id' => $payload['from_hall_id'] ?? null,
                'transfer_date' => $payload['transfer_date'],
                'vehicle_no' => $payload['vehicle_no'] ?? null,
                'remarks' => $payload['remarks'] ?? null,
                'status' => YarnAdviceStatus::DRAFT->value,
            ]);

            foreach ($payload['production_lot_count_ids'] as $countId) {
                $count = ProductionLotCount::with('productionLot')->whereKey($countId)->lockForUpdate()->first();

                if (! $count || $count->status !== LotStatus::PACKED->value) {
                    throw ValidationException::withMessages([
                        'production_lot_count_ids' => "Lot count {$countId} is not in PACKED status and cannot be transferred.",
                    ]);
                }

                YarnTransferAdviceLine::create([
                    'advice_id' => $advice->id,
                    'production_lot_count_id' => $count->id,
                    'lot_no' => $count->productionLot?->lot_no,
                    'first_bag_serial' => $count->items()->min('bag_no'),
                    'last_bag_serial' => $count->items()->max('bag_no'),
                    'qty_out_cones' => $count->total_cones,
                    'gross_weight_kg_out' => $count->gross_weight_kg,
                    'net_weight_kg_out' => $count->net_weight_kg,
                    'status' => StoreTransferItemStatus::PENDING->value,
                ]);

                $count->update(['status' => LotStatus::PENDING_TRANSFER->value]);
            }

            return $advice->fresh(self::LINE_RELATIONS);
        });
    }

    public function update(YarnTransferAdvice $advice, array $payload): YarnTransferAdvice
    {
        if ($advice->status !== YarnAdviceStatus::DRAFT->value) {
            throw ValidationException::withMessages([
                'status' => 'Only a draft advice can be edited.',
            ]);
        }

        $advice->update([
            'from_hall_id' => $payload['from_hall_id'] ?? $advice->from_hall_id,
            'transfer_date' => $payload['transfer_date'] ?? $advice->transfer_date,
            'vehicle_no' => $payload['vehicle_no'] ?? $advice->vehicle_no,
            'remarks' => $payload['remarks'] ?? $advice->remarks,
        ]);

        return $advice->fresh(self::LINE_RELATIONS);
    }

    public function cancel(YarnTransferAdvice $advice, ?string $reason): YarnTransferAdvice
    {
        if (! in_array($advice->status, [YarnAdviceStatus::DRAFT->value, YarnAdviceStatus::HOD_APPROVED->value], true)) {
            throw ValidationException::withMessages([
                'status' => 'This advice can no longer be cancelled — store has already actioned it.',
            ]);
        }

        return DB::transaction(function () use ($advice, $reason) {
            foreach ($advice->lines as $line) {
                if ($line->status !== StoreTransferItemStatus::PENDING->value) {
                    throw ValidationException::withMessages([
                        'status' => 'This advice can no longer be cancelled — store has already actioned it.',
                    ]);
                }

                $line->productionLotCount?->update(['status' => LotStatus::PACKED->value]);
            }

            $advice->update([
                'status' => YarnAdviceStatus::CANCELLED->value,
                'rejected_reason' => $reason,
            ]);

            return $advice->fresh(self::LINE_RELATIONS);
        });
    }

    public function approveHod(YarnTransferAdvice $advice): YarnTransferAdvice
    {
        $advice->update([
            'status' => YarnAdviceStatus::HOD_APPROVED->value,
            'hod_approved_by' => auth()->id(),
            'hod_approved_at' => now(),
        ]);

        return $advice->fresh(self::LINE_RELATIONS);
    }

    public function rejectAdvice(YarnTransferAdvice $advice, ?string $reason): YarnTransferAdvice
    {
        $advice->update([
            'status' => YarnAdviceStatus::REJECTED->value,
            'rejected_reason' => $reason,
        ]);

        return $advice->fresh(self::LINE_RELATIONS);
    }

    public function resubmit(YarnTransferAdvice $advice): YarnTransferAdvice
    {
        $advice->update(['status' => YarnAdviceStatus::DRAFT->value]);

        return $advice->fresh(self::LINE_RELATIONS);
    }

    public function receiveLine(YarnTransferAdvice $advice, YarnTransferAdviceLine $line, int $qtyInCones, ?float $netWeightKgIn, ?string $remark): YarnTransferAdvice
    {
        if ($advice->status !== YarnAdviceStatus::HOD_APPROVED->value) {
            throw ValidationException::withMessages([
                'status' => 'This advice must be HOD-approved before store can receive lines.',
            ]);
        }

        return DB::transaction(function () use ($advice, $line, $qtyInCones, $netWeightKgIn, $remark) {
            $line = YarnTransferAdviceLine::whereKey($line->id)->lockForUpdate()->first();
            $variance = $qtyInCones - $line->qty_out_cones;

            $line->update([
                'qty_in_cones' => $qtyInCones,
                'net_weight_kg_in' => $netWeightKgIn,
                'variance_cones' => $variance,
                'status' => StoreTransferItemStatus::RECEIVED->value,
                'received_by' => auth()->id(),
                'received_at' => now(),
                'remark' => $remark,
            ]);

            $count = $line->productionLotCount;

            if ($count) {
                $count->update([
                    'status' => LotStatus::RECEIVED->value,
                    'variance_cones' => $variance,
                ]);

                $this->applyStockIncrease($count, $netWeightKgIn ?? 0);

                if ($variance === 0) {
                    $count->update(['status' => LotStatus::RECONCILED->value]);
                }
            }

            $this->refreshAdviceStatus($advice);

            return $advice->fresh(self::LINE_RELATIONS);
        });
    }

    public function rejectLine(YarnTransferAdvice $advice, YarnTransferAdviceLine $line, ?string $remark): YarnTransferAdvice
    {
        return DB::transaction(function () use ($advice, $line, $remark) {
            $line->update([
                'status' => StoreTransferItemStatus::REJECTED->value,
                'received_by' => auth()->id(),
                'received_at' => now(),
                'remark' => $remark,
            ]);

            $line->productionLotCount?->update([
                'status' => LotStatus::REJECTED->value,
                'rejected_reason' => $remark,
            ]);

            $this->refreshAdviceStatus($advice);

            return $advice->fresh(self::LINE_RELATIONS);
        });
    }

    public function approveGm(YarnTransferAdvice $advice): YarnTransferAdvice
    {
        if ($advice->status !== YarnAdviceStatus::STORE_RECEIVED->value) {
            throw ValidationException::withMessages([
                'status' => 'This advice must be fully received by store before GM can approve it.',
            ]);
        }

        $advice->update([
            'status' => YarnAdviceStatus::GM_APPROVED->value,
            'gm_approved_by' => auth()->id(),
            'gm_approved_at' => now(),
        ]);

        return $advice->fresh(self::LINE_RELATIONS);
    }

    public function reconcileLine(YarnTransferAdvice $advice, YarnTransferAdviceLine $line, ?string $remark): YarnTransferAdvice
    {
        $count = $line->productionLotCount;

        if (! $count || $count->status !== LotStatus::RECEIVED->value) {
            throw ValidationException::withMessages([
                'status' => 'Only a received lot count with an open variance can be reconciled.',
            ]);
        }

        $count->update([
            'status' => LotStatus::RECONCILED->value,
            'reconciled_by' => auth()->id(),
            'reconciled_at' => now(),
            'reconcile_remark' => $remark,
        ]);

        return $advice->fresh(self::LINE_RELATIONS);
    }

    private function refreshAdviceStatus(YarnTransferAdvice $advice): void
    {
        if ($advice->status !== YarnAdviceStatus::HOD_APPROVED->value) {
            return;
        }

        $advice->loadMissing('lines');
        $lines = $advice->lines;

        $allActioned = $lines->isNotEmpty()
            && $lines->every(fn (YarnTransferAdviceLine $line) => $line->status !== StoreTransferItemStatus::PENDING->value);

        if ($allActioned) {
            $advice->update([
                'status' => YarnAdviceStatus::STORE_RECEIVED->value,
                'store_received_by' => auth()->id(),
                'store_received_at' => now(),
            ]);
        }
    }

    private function applyStockIncrease(ProductionLotCount $count, float $netWeightKgIn): void
    {
        if (! $count->product_id || $netWeightKgIn <= 0) {
            return;
        }

        $count->product?->increment('current_stock', $netWeightKgIn);
    }
}
