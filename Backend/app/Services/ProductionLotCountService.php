<?php

namespace App\Services;

use App\Enums\Production\LotStatus;
use App\Models\ProductionLotCount;
use App\Models\ProductionLotItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProductionLotCountService
{
    public function __construct(protected BagSerialService $bagSerialService)
    {
    }

    public function update(ProductionLotCount $count, array $payload): ProductionLotCount
    {
        $this->assertMutable($count);

        $count->update($payload);

        return $count->fresh('items');
    }

    public function recordQc(ProductionLotCount $count, string $qcStatus, ?string $remark): ProductionLotCount
    {
        if (! in_array($qcStatus, ['PASSED', 'FAILED'], true)) {
            throw ValidationException::withMessages([
                'qc_status' => 'QC status must be PASSED or FAILED.',
            ]);
        }

        return DB::transaction(function () use ($count, $qcStatus, $remark) {
            $count->update([
                'qc_status' => $qcStatus,
                'qc_checked_by' => auth()->id(),
                'qc_checked_at' => now(),
                'qc_remark' => $remark,
            ]);

            if ($qcStatus === 'FAILED') {
                $count->update(['status' => LotStatus::QC_FAILED->value]);
            }

            return $count->fresh('items');
        });
    }

    public function addItem(ProductionLotCount $count, array $payload): ProductionLotCount
    {
        $this->assertItemsMutable($count);

        if (! $count->count_type_id) {
            throw ValidationException::withMessages([
                'count_type_id' => 'A count type must be set on this lot count before bags can be recorded.',
            ]);
        }

        DB::transaction(function () use ($count, $payload) {
            $this->bagSerialService->withNextSerial($count->count_type_id, function (int $bagNo) use ($count, $payload) {
                ProductionLotItem::create([
                    ...$payload,
                    'production_lot_count_id' => $count->id,
                    'bag_no' => $payload['bag_no'] ?? $bagNo,
                ]);
            });

            $this->refreshTotals($count);
        });

        return $count->fresh('items');
    }

    public function updateItem(ProductionLotCount $count, ProductionLotItem $item, array $payload): ProductionLotCount
    {
        $this->assertItemsMutable($count);

        DB::transaction(function () use ($count, $item, $payload) {
            $item->update($payload);

            $this->refreshTotals($count);
        });

        return $count->fresh('items');
    }

    public function deleteItem(ProductionLotCount $count, ProductionLotItem $item): ProductionLotCount
    {
        $this->assertItemsMutable($count);

        DB::transaction(function () use ($count, $item) {
            $item->delete();

            $this->refreshTotals($count);
        });

        return $count->fresh('items');
    }

    public function pack(ProductionLotCount $count): ProductionLotCount
    {
        if ($count->qc_status !== 'PASSED') {
            throw ValidationException::withMessages([
                'qc_status' => 'Lot count must pass QC before it can be packed.',
            ]);
        }

        if ($count->items()->doesntExist()) {
            throw ValidationException::withMessages([
                'items' => 'Lot count must have at least one packed bag before it can be packed.',
            ]);
        }

        return DB::transaction(function () use ($count) {
            $this->refreshTotals($count);

            $count->update([
                'status' => LotStatus::PACKED->value,
                'packed_by' => auth()->id(),
                'packed_at' => now(),
            ]);

            return $count->fresh('items');
        });
    }

    public function cancel(ProductionLotCount $count, ?string $reason): ProductionLotCount
    {
        $count->update([
            'status' => LotStatus::CANCELLED->value,
            'rejected_reason' => $reason,
        ]);

        return $count->fresh('items');
    }

    private function assertMutable(ProductionLotCount $count): void
    {
        if ($count->status !== LotStatus::DOFFED->value) {
            throw ValidationException::withMessages([
                'status' => 'This lot count can only be edited while in DOFFED status.',
            ]);
        }
    }

    private function assertItemsMutable(ProductionLotCount $count): void
    {
        if ($count->status !== LotStatus::DOFFED->value) {
            throw ValidationException::withMessages([
                'status' => 'Bags can only be added or changed while the lot count is in DOFFED status.',
            ]);
        }
    }

    private function refreshTotals(ProductionLotCount $count): void
    {
        $items = $count->items()->get();

        $count->update([
            'total_bags' => $items->count(),
            'total_cones' => $items->sum('cone_count'),
            'gross_weight_kg' => $items->sum('gross_weight_kg'),
            'net_weight_kg' => $items->sum('net_weight_kg'),
        ]);
    }
}
