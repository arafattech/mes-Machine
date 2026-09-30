<?php

namespace App\Services;

use App\Enums\Production\LotStatus;
use App\Models\Machine;
use App\Models\ProductionLot;
use App\Models\ProductionLotCount;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProductionLotBatchService
{
    private const BATCH_FIELDS = [
        'lot_no', 'work_order_id', 'machine_id', 'hall_id', 'shift_id', 'operator_id', 'lot_date', 'doffed_at',
    ];

    public function create(array $payload): ProductionLot
    {
        if (! empty($payload['machine_id'])) {
            $this->assertMachineIsAutoconer((int) $payload['machine_id']);
        }

        return DB::transaction(function () use ($payload) {
            $batch = ProductionLot::create([
                ...Arr::only($payload, self::BATCH_FIELDS),
                'created_by' => auth()->id(),
            ]);

            foreach ($payload['counts'] as $countPayload) {
                ProductionLotCount::create([
                    'production_lot_id' => $batch->id,
                    'count_type_id' => $countPayload['count_type_id'] ?? null,
                    'product_id' => $countPayload['product_id'] ?? null,
                    'status' => LotStatus::DOFFED->value,
                ]);
            }

            return $batch->fresh('counts.countType', 'counts.product', 'counts.items');
        });
    }

    public function update(ProductionLot $batch, array $payload): ProductionLot
    {
        if (! empty($payload['machine_id'])) {
            $this->assertMachineIsAutoconer((int) $payload['machine_id']);
        }

        $batch->update(Arr::only($payload, self::BATCH_FIELDS));

        return $batch->fresh('counts.countType', 'counts.product', 'counts.items');
    }

    public function addCount(ProductionLot $batch, array $payload): ProductionLot
    {
        ProductionLotCount::create([
            'production_lot_id' => $batch->id,
            'count_type_id' => $payload['count_type_id'] ?? null,
            'product_id' => $payload['product_id'] ?? null,
            'status' => LotStatus::DOFFED->value,
        ]);

        return $batch->fresh('counts.countType', 'counts.product', 'counts.items');
    }

    private function assertMachineIsAutoconer(int $machineId): void
    {
        $isAutoconer = Machine::whereKey($machineId)
            ->whereHas('machinegroups', fn ($query) => $query->where('is_autocon', true))
            ->exists();

        if (! $isAutoconer) {
            throw ValidationException::withMessages([
                'machine_id' => 'Lots can only be doffed from an Autoconer machine.',
            ]);
        }
    }
}
