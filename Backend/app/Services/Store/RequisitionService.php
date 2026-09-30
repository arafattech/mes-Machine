<?php

namespace App\Services\Store;

use Illuminate\Validation\ValidationException;
use App\Models\Store\PurchaseRequisition;
use App\Models\Store\StockAdjustment;
use App\Models\Product;
use Illuminate\Support\Facades\DB;
use App\Enums\Store\SprStatus;
use Exception;
use Throwable;

class RequisitionService
{
    /**
     * Create a new class instance.
     */
    public function __construct()
    {
        //
    }

    public function approveRequisition($srId)
    {
        DB::beginTransaction();
        $requisition = null;

        try {
            $requisition = PurchaseRequisition::with('sprItems.item')->findOrFail($srId);

            foreach ($requisition->sprItems as $reqItem) {
                $this->adjustProductStock($reqItem, $requisition->id);
            }

            $requisition->update(['status' => SprStatus::APPROVED->value]);

            DB::commit();

            return [
                'success' => true,
                'message' => 'Requisition approved successfully.',
                'data' => $requisition->fresh(['sprItems.item']),
            ];
        } catch (Throwable $e) {
            DB::rollBack();

            if ($requisition) {
                $requisition->update(['status' => SprStatus::SUBMITTED->value]);
            }

            return [
                'success' => false,
                'message' => 'Something went wrong while approving the requisition.',
                'error' => $e->getMessage(),
            ];
        }
    }

    public function finalApproveRequisition($srId)
    {
        DB::beginTransaction();

        try {
            $requisition = PurchaseRequisition::with('sprItems.item')->findOrFail($srId);

            if ($requisition->status !== SprStatus::APPROVED->value) {
                DB::rollBack();

                return [
                    'success' => false,
                    'message' => 'Only GM-approved indents can be finally approved.',
                    'error' => 'INVALID_STATUS',
                ];
            }

            foreach ($requisition->sprItems as $reqItem) {
                $this->adjustProductStock($reqItem, $requisition->id);
            }

            $requisition->update([
                'status' => SprStatus::FINAL_APPROVAL->value,
                'final_approved_by' => auth()->id(),
                'final_approved_at' => now(),
            ]);

            DB::commit();

            return [
                'success' => true,
                'message' => 'Indent final approval completed successfully.',
                'data' => $requisition->fresh(['sprItems.item']),
            ];
        } catch (Throwable $e) {
            DB::rollBack();

            return [
                'success' => false,
                'message' => 'Something went wrong while performing final approval.',
                'error' => $e->getMessage(),
            ];
        }
    }

    private function adjustProductStock($reqItem, $requisitionId)
    {
        $product = $reqItem->item;

        if (! $product) {
            return;
        }

        $currentStock = (float) ($product->current_stock ?? 0);
        $receivedQty = (float) ($reqItem->approved_qty ?? $reqItem->received_quantity ?? 0);

        $newStock = max($currentStock - $receivedQty, 0);
        $product->update(['current_stock' => $newStock]);

        StockAdjustment::create([
            'product_id' => $product->id,
            'adjustment_quantity' => $receivedQty,
            'created_by' => auth()->id(),
            'condition' => 'DECREASED',
            'sectionable_type' => 'App\Models\Store\PurchaseRequisition',
            'sectionable_id' => $requisitionId,
            'adjustment_date' => now(),
        ]);
    }

}
