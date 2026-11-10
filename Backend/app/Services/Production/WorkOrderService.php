<?php

namespace App\Services\Production;

use App\Models\WorkOrder;
use App\Support\FactoryClock;
use Illuminate\Support\Facades\DB;

class WorkOrderService
{
    public function create(array $attributes): WorkOrder
    {
        $machineIds = $this->pullMachineIds($attributes);

        // One transaction so the after-commit realtime signal (ProductionDataObserver) fires
        // only once the machine assignment is in place too.
        return DB::transaction(function () use ($attributes, $machineIds) {
            $workOrder = WorkOrder::create($this->stampCompletion($this->stampActualStart($attributes)));
            $workOrder->machines()->sync($machineIds);

            return $workOrder;
        });
    }

    public function update(WorkOrder $workOrder, array $attributes): WorkOrder
    {
        $machineIds = $this->pullMachineIds($attributes);

        DB::transaction(function () use ($workOrder, $attributes, $machineIds) {
            $workOrder->update($this->stampCompletion($this->stampActualStart($attributes), $workOrder));
            $workOrder->machines()->sync($machineIds);
        });

        return $workOrder;
    }

    private function pullMachineIds(array &$attributes): array
    {
        $machineIds = $attributes['machine_ids'] ?? [];
        unset($attributes['machine_ids']);

        return $machineIds;
    }

    /** `completed_at` records when the order was first completed; leaving Completed (reopen) clears it. */
    public function stampCompletion(array $attributes, ?WorkOrder $current = null): array
    {
        $isCompleted = ($attributes['status'] ?? null) === 'completed';
        $attributes['completed_at'] = $isCompleted ? ($current?->completed_at ?? now()) : null;

        return $attributes;
    }

    /**
     * An order in progress always has an actual start: when none is submitted it becomes today's
     * factory date — the same date-only precision the form stores, so a later save keeps it.
     */
    public function stampActualStart(array $attributes): array
    {
        if (($attributes['status'] ?? null) === 'in_progress' && empty($attributes['actual_start'])) {
            $attributes['actual_start'] = FactoryClock::today();
        }

        return $attributes;
    }
}
