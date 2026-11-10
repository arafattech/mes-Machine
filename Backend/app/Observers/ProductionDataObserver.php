<?php

namespace App\Observers;

use App\Models\WorkOrder;
use App\Services\ProductionEventPublisher;
use Illuminate\Contracts\Events\ShouldHandleEventsAfterCommit;
use Illuminate\Database\Eloquent\Model;

/**
 * Realtime signal for every model that feeds machine production / wastage / OEE figures.
 * Observing the models (not the controllers) covers the custom REST endpoints *and* the
 * generic Lodata OData writes (MachineProductionCounts, MachineProductionTargets,
 * MachineHasConfigs, WorkOrders are writable entity sets) with one hook.
 *
 * Runs after commit so node-server never recomputes from a transaction that later rolls back.
 */
class ProductionDataObserver implements ShouldHandleEventsAfterCommit
{
    public function __construct(private ProductionEventPublisher $publisher)
    {
    }

    public function saved(Model $model): void
    {
        // `saved` fires even for a save that changed nothing — no signal for a no-op. Except
        // WorkOrder: its machine assignment is a pivot sync the model's own dirty state can't see.
        if (! $model instanceof WorkOrder && ! $model->wasRecentlyCreated && ! $model->wasChanged()) {
            return;
        }

        $this->publish($model);
    }

    public function deleted(Model $model): void
    {
        $this->publish($model);
    }

    private function publish(Model $model): void
    {
        $machineId = $model->getAttribute('machine_id');
        $workOrderId = $model instanceof WorkOrder ? $model->getKey() : $model->getAttribute('work_order_id');

        $this->publisher->publish(
            class_basename($model),
            $machineId !== null ? [(int) $machineId] : [],
            $workOrderId !== null ? [(int) $workOrderId] : [],
        );
    }
}
