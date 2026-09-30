<?php

namespace App\Http\Controllers\Purchase;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;
use App\Services\Purchase\PurchaseService;
use Illuminate\Http\Request;
use Carbon\Carbon;

class PurchaseController extends Controller
{
    protected $purchaseService;
    
    public function __construct(PurchaseService $purchaseService){
        $this->purchaseService = $purchaseService;
    }

    public function getAnalysisData(Request $request)
    {
        try {
            $startDate = $request->query('startDate');
            $endDate = $request->query('endDate');
            $supplierId = $request->query('supplier_id');
            $departmentId = $request->query('department_id');

            // ---------------------
            // Helper function for date validation
            // ---------------------
            $parseDate = function ($date) {
                if (!$date) return null;

                $formats = ['d-m-Y', 'Y-m-d'];

                foreach ($formats as $format) {
                    try {
                        return Carbon::createFromFormat($format, $date)->format('Y-m-d');
                    } catch (\Exception $e) {
                        // continue trying next format
                    }
                }

                return null; // invalid date
            };

            // Parse dates
            $startDate = $parseDate($startDate);
            $endDate = $parseDate($endDate);

            if ($request->query('startDate') && !$startDate) {
                return response()->json(['message' => 'Invalid startDate format. Use d-m-Y or Y-m-d.'], 422);
            }

            if ($request->query('endDate') && !$endDate) {
                return response()->json(['message' => 'Invalid endDate format. Use d-m-Y or Y-m-d.'], 422);
            }

            // Send all filters to service
            $result = $this->purchaseService->getPurchaseAnalysis(
                $startDate,
                $endDate,
                $supplierId,
                $departmentId
            );

            return response()->json([
                'message' => 'Purchase analysis data retrieved successfully',
                'data'    => $result,
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error retrieving purchase analysis data',
                'error'   => $e->getMessage()
            ], 500);
        }
    }

}
