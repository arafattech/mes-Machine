<?php

namespace App\Http\Controllers\Sales;

use App\Http\Controllers\Controller;
use App\Services\Sales\SalesService;
use App\Services\Sales\InvoiceService;
use Illuminate\Http\Request;
use App\Models\ItemPricePlanning;
use Carbon\Carbon;

class SalesController extends Controller
{
    protected $saleOrderService;
    protected $invoiceService;


    public function __construct(SalesService $saleOrderService , InvoiceService $invoiceService)
    {
        $this->saleOrderService = $saleOrderService;
        $this->invoiceService = $invoiceService;
    }

    public function createOrder(Request $request)
    {
        try {
            $result = $this->saleOrderService->createSaleOrder($request->all());
            if ($result instanceof \Illuminate\Http\JsonResponse) {
                return $result;
            }

            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 422);
        }
    }

    public function updateOrder(Request $request, $id)
{
    try {
        $result = $this->saleOrderService->updateSaleOrder($id, $request->all());

        if ($result instanceof \Illuminate\Http\JsonResponse) {
            return $result;
        }

        return response()->json([
            'success' => true,
            'data' => $result
        ]);

    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => $e->getMessage()
        ], 422);
    }
}


    public function getPricePlannings($productId = null)
    {
        $today = Carbon::today();

        $query = ItemPricePlanning::query()
            ->where('is_active', true)
            ->whereDate('start_date', '<=', $today)
            ->where(function ($q) use ($today) {
                $q->whereDate('end_date', '>=', $today)
                    ->orWhereNull('end_date');
            })
            ->orderBy('start_date', 'desc');

        if ($productId) {
            $query->where('product_id', $productId);
        }

        return $query->get();
    }

    public function getMarketPriceEntry(Request $request)
    {
        $userId = (int) $request->input('user_id');

        return $this->saleOrderService->getUserMarketPriceItem($userId);
    }

    public function generatePDF(Request $request)
    {
        return $this->invoiceService->generatePIPDF($request);
    }

}
