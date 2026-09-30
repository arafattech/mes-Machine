<?php

namespace App\Http\Controllers\Store;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Validation\ValidationException;
use App\Models\Store\PurchaseRequisition;
use App\Models\Product;
use App\Services\Store\RequisitionService;
use Illuminate\Support\Facades\DB;
use Exception;

class RequisitionController extends Controller
{

    public function __construct(protected RequisitionService $requisitionService){}

    public function approveRequisition(Request $request)
    {
        $srId = $request->srId;
        $result = $this->requisitionService->approveRequisition($srId);

        if ($result['success']) {
            return response()->json([
                'message' => $result['message'],
                'data' => $result['data']
            ], 200);
        }

        return response()->json([
            'message' => $result['message'],
            'error' => $result['error']
        ], 500);
    }

    public function finalApproveRequisition(Request $request)
    {
        $srId = $request->srId;
        $result = $this->requisitionService->finalApproveRequisition($srId);

        if ($result['success']) {
            return response()->json([
                'message' => $result['message'],
                'data' => $result['data']
            ], 200);
        }

        $status = $result['error'] === 'INVALID_STATUS' ? 422 : 500;

        return response()->json([
            'message' => $result['message'],
            'error' => $result['error']
        ], $status);
    }

}
