<?php

namespace App\Http\Controllers\Sales;

use App\Http\Controllers\Controller;
use App\Services\Sales\SalesAnalyticsService;
use Illuminate\Http\Request;
use Carbon\Carbon;

class SalesAnalyticsController extends Controller
{
    protected $analyticsService;

    public function __construct(SalesAnalyticsService $analyticsService)
    {
        $this->analyticsService = $analyticsService;
    }

    public function getDashboardData(Request $request)
    {
        try {
            $startDate = $request->query('startDate');
            $endDate = $request->query('endDate');
            $clientId = $request->query('clientId');
            $status = $request->query('status');

            $parseDate = function ($date) {
                if (!$date) return null;
                $formats = ['d-m-Y', 'Y-m-d', 'd/m/Y'];
                foreach ($formats as $format) {
                    try {
                        return Carbon::createFromFormat($format, $date)->format('Y-m-d');
                    } catch (\Exception $e) { }
                }
                return null;
            };

            $startDate = $parseDate($startDate);
            $endDate = $parseDate($endDate);

            if ($request->query('startDate') && !$startDate) {
                return response()->json(['success' => false, 'message' => 'Invalid startDate format.'], 422);
            }

            $data = $this->analyticsService->getSalesAnalysis(
                $startDate,
                $endDate,
                $clientId,
                $status
            );

            return response()->json([
                'success' => true,
                'data' => $data
            ]);

        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function getMarketPrice(Request $request)
    {
        try {
            $productId = $request->query('product_id');
            $startDate = $request->query('start_date');
            $endDate = $request->query('end_date');

            if (!$productId) {
                return response()->json(['success' => false, 'message' => 'product_id is required'], 422);
            }

            $data = $this->analyticsService->getMarketPriceAverage($productId, $startDate, $endDate);

            return response()->json([
                'success' => true,
                'data' => $data
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
}
