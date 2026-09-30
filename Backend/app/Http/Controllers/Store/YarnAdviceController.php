<?php

namespace App\Http\Controllers\Store;

use App\Http\Controllers\Controller;
use App\Models\Store\YarnTransferAdvice;
use App\Models\Store\YarnTransferAdviceLine;
use App\Services\Store\YarnAdviceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class YarnAdviceController extends Controller
{
    public function __construct(protected YarnAdviceService $yarnAdviceService)
    {
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'from_hall_id' => ['nullable', 'integer', 'exists:halls,id'],
            'transfer_date' => ['required', 'date'],
            'vehicle_no' => ['nullable', 'string', 'max:255'],
            'remarks' => ['nullable', 'string'],
            'production_lot_count_ids' => ['required', 'array', 'min:1'],
            'production_lot_count_ids.*' => ['integer', 'exists:production_lot_counts,id'],
        ]);

        $advice = $this->yarnAdviceService->create($payload);

        return response()->json($advice, 201);
    }

    public function update(Request $request, YarnTransferAdvice $advice): JsonResponse
    {
        $payload = $request->validate([
            'from_hall_id' => ['nullable', 'integer', 'exists:halls,id'],
            'transfer_date' => ['nullable', 'date'],
            'vehicle_no' => ['nullable', 'string', 'max:255'],
            'remarks' => ['nullable', 'string'],
        ]);

        $advice = $this->yarnAdviceService->update($advice, $payload);

        return response()->json($advice);
    }

    public function cancel(Request $request, YarnTransferAdvice $advice): JsonResponse
    {
        $payload = $request->validate([
            'reason' => ['nullable', 'string'],
        ]);

        $advice = $this->yarnAdviceService->cancel($advice, $payload['reason'] ?? null);

        return response()->json($advice);
    }

    public function approveHod(YarnTransferAdvice $advice): JsonResponse
    {
        $advice = $this->yarnAdviceService->approveHod($advice);

        return response()->json($advice);
    }

    public function reject(Request $request, YarnTransferAdvice $advice): JsonResponse
    {
        $payload = $request->validate([
            'reason' => ['nullable', 'string'],
        ]);

        $advice = $this->yarnAdviceService->rejectAdvice($advice, $payload['reason'] ?? null);

        return response()->json($advice);
    }

    public function resubmit(YarnTransferAdvice $advice): JsonResponse
    {
        $advice = $this->yarnAdviceService->resubmit($advice);

        return response()->json($advice);
    }

    public function receiveLine(Request $request, YarnTransferAdvice $advice, YarnTransferAdviceLine $line): JsonResponse
    {
        $payload = $request->validate([
            'qty_in_cones' => ['required', 'integer', 'min:0'],
            'net_weight_kg_in' => ['nullable', 'numeric', 'min:0'],
            'remark' => ['nullable', 'string'],
        ]);

        $advice = $this->yarnAdviceService->receiveLine(
            $advice,
            $line,
            $payload['qty_in_cones'],
            $payload['net_weight_kg_in'] ?? null,
            $payload['remark'] ?? null,
        );

        return response()->json($advice);
    }

    public function rejectLine(Request $request, YarnTransferAdvice $advice, YarnTransferAdviceLine $line): JsonResponse
    {
        $payload = $request->validate([
            'remark' => ['nullable', 'string'],
        ]);

        $advice = $this->yarnAdviceService->rejectLine($advice, $line, $payload['remark'] ?? null);

        return response()->json($advice);
    }

    public function approveGm(YarnTransferAdvice $advice): JsonResponse
    {
        $advice = $this->yarnAdviceService->approveGm($advice);

        return response()->json($advice);
    }

    public function reconcileLine(Request $request, YarnTransferAdvice $advice, YarnTransferAdviceLine $line): JsonResponse
    {
        $payload = $request->validate([
            'remark' => ['nullable', 'string'],
        ]);

        $advice = $this->yarnAdviceService->reconcileLine($advice, $line, $payload['remark'] ?? null);

        return response()->json($advice);
    }
}
