<?php

namespace App\Http\Controllers;

use App\Models\ProductionLot;
use App\Services\ProductionLotBatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductionLotBatchController extends Controller
{
    public function __construct(protected ProductionLotBatchService $productionLotBatchService)
    {
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'lot_no' => ['nullable', 'string', 'max:255'],
            'work_order_id' => ['nullable', 'integer', 'exists:work_orders,id'],
            'machine_id' => ['nullable', 'integer', 'exists:machines,id'],
            'hall_id' => ['nullable', 'integer', 'exists:halls,id'],
            'shift_id' => ['nullable', 'integer', 'exists:employee_shifts,id'],
            'operator_id' => ['nullable', 'integer', 'exists:employees,id'],
            'lot_date' => ['required', 'date'],
            'doffed_at' => ['nullable', 'date'],
            'counts' => ['required', 'array', 'min:1'],
            'counts.*.count_type_id' => ['nullable', 'integer', 'exists:count_types,id'],
            'counts.*.product_id' => ['nullable', 'integer', 'exists:products,id'],
        ]);

        $batch = $this->productionLotBatchService->create($payload);

        return response()->json($batch, 201);
    }

    public function update(Request $request, ProductionLot $lotBatch): JsonResponse
    {
        $payload = $request->validate([
            'lot_no' => ['nullable', 'string', 'max:255'],
            'work_order_id' => ['nullable', 'integer', 'exists:work_orders,id'],
            'machine_id' => ['nullable', 'integer', 'exists:machines,id'],
            'hall_id' => ['nullable', 'integer', 'exists:halls,id'],
            'shift_id' => ['nullable', 'integer', 'exists:employee_shifts,id'],
            'operator_id' => ['nullable', 'integer', 'exists:employees,id'],
            'lot_date' => ['nullable', 'date'],
            'doffed_at' => ['nullable', 'date'],
        ]);

        $batch = $this->productionLotBatchService->update($lotBatch, $payload);

        return response()->json($batch);
    }

    public function addCount(Request $request, ProductionLot $lotBatch): JsonResponse
    {
        $payload = $request->validate([
            'count_type_id' => ['nullable', 'integer', 'exists:count_types,id'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
        ]);

        $batch = $this->productionLotBatchService->addCount($lotBatch, $payload);

        return response()->json($batch, 201);
    }
}
