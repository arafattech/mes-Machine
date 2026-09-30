<?php

namespace App\Http\Controllers;

use App\Models\ProductionLot;
use App\Models\ProductionLotCount;
use App\Models\ProductionLotItem;
use App\Services\ProductionLotCountService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductionLotCountController extends Controller
{
    public function __construct(protected ProductionLotCountService $productionLotCountService)
    {
    }

    public function update(Request $request, ProductionLot $lotBatch, ProductionLotCount $count): JsonResponse
    {
        $payload = $request->validate([
            'count_type_id' => ['nullable', 'integer', 'exists:count_types,id'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
        ]);

        $this->productionLotCountService->update($count, $payload);

        return response()->json($this->freshBatch($lotBatch));
    }

    public function recordQc(Request $request, ProductionLot $lotBatch, ProductionLotCount $count): JsonResponse
    {
        $payload = $request->validate([
            'qc_status' => ['required', 'string', 'in:PASSED,FAILED'],
            'qc_remark' => ['nullable', 'string'],
        ]);

        $this->productionLotCountService->recordQc($count, $payload['qc_status'], $payload['qc_remark'] ?? null);

        return response()->json($this->freshBatch($lotBatch));
    }

    public function addItem(Request $request, ProductionLot $lotBatch, ProductionLotCount $count): JsonResponse
    {
        $payload = $request->validate([
            'bag_no' => ['nullable', 'integer', 'min:1'],
            'cone_count' => ['required', 'integer', 'min:1'],
            'gross_weight_kg' => ['required', 'numeric', 'min:0'],
            'net_weight_kg' => ['required', 'numeric', 'min:0'],
            'remark' => ['nullable', 'string'],
        ]);

        $this->productionLotCountService->addItem($count, $payload);

        return response()->json($this->freshBatch($lotBatch), 201);
    }

    public function updateItem(Request $request, ProductionLot $lotBatch, ProductionLotCount $count, ProductionLotItem $item): JsonResponse
    {
        $payload = $request->validate([
            'bag_no' => ['nullable', 'integer', 'min:1'],
            'cone_count' => ['required', 'integer', 'min:1'],
            'gross_weight_kg' => ['required', 'numeric', 'min:0'],
            'net_weight_kg' => ['required', 'numeric', 'min:0'],
            'remark' => ['nullable', 'string'],
        ]);

        $this->productionLotCountService->updateItem($count, $item, $payload);

        return response()->json($this->freshBatch($lotBatch));
    }

    public function deleteItem(ProductionLot $lotBatch, ProductionLotCount $count, ProductionLotItem $item): JsonResponse
    {
        $this->productionLotCountService->deleteItem($count, $item);

        return response()->json($this->freshBatch($lotBatch));
    }

    public function pack(ProductionLot $lotBatch, ProductionLotCount $count): JsonResponse
    {
        $this->productionLotCountService->pack($count);

        return response()->json($this->freshBatch($lotBatch));
    }

    public function cancel(Request $request, ProductionLot $lotBatch, ProductionLotCount $count): JsonResponse
    {
        $payload = $request->validate([
            'reason' => ['nullable', 'string'],
        ]);

        $this->productionLotCountService->cancel($count, $payload['reason'] ?? null);

        return response()->json($this->freshBatch($lotBatch));
    }

    private function freshBatch(ProductionLot $lotBatch): ProductionLot
    {
        return $lotBatch->fresh('counts.countType', 'counts.product', 'counts.items');
    }
}
