<?php

namespace App\Http\Controllers\Store;

use App\Exports\RawCottonReceivedExport;
use App\Http\Controllers\Controller;
use App\Models\Store\MaterialReceiptLog;
use App\Services\Store\LotTotalsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;

class RawCottonReceivedController extends Controller
{
    public function __construct(private LotTotalsService $lotTotalsService)
    {
    }

    public function report(Request $request): JsonResponse
    {
        $top = $request->filled('$top') ? max((int) $request->input('$top'), 0) : 40;
        $skip = $request->filled('$skip') ? max((int) $request->input('$skip'), 0) : 0;

        $query = MaterialReceiptLog::query()
            ->whereHas('product', fn ($product) => $product->where('is_raw_cotton', true))
            ->with([
                'receipt:id,lc_no,supplier_id,receipt_date',
                'receipt.supplier:id,name,origin_id',
                'receipt.supplier.origin:id,name',
                'product:id,product_name,item_code,current_stock,unit_price',
            ]);

        [$from, $to] = $this->dateRange($request);
        if ($from) $query->whereDate('created_at', '>=', $from);
        if ($to) $query->whereDate('created_at', '<=', $to);

        $search = $this->searchTerm($request);
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->whereHas('receipt', fn ($receipt) => $receipt->where('lc_no', 'like', "%{$search}%"))
                    ->orWhereHas('receipt.supplier', fn ($supplier) => $supplier->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('product', fn ($product) => $product
                        ->where('product_name', 'like', "%{$search}%")
                        ->orWhere('item_code', 'like', "%{$search}%"));
            });
        }

        $count = (clone $query)->count();
        $logs = $query->latest('created_at')->skip($skip)->take($top)->get();
        $lotTotals = $this->lotTotalsService->totalsByReceiptAndProduct($logs);

        $rows = $logs->map(function (MaterialReceiptLog $log) use ($lotTotals) {
            $lotKey = $log->material_receipt_id . '_' . $log->product_id;
            $lotTotal = $lotTotals[$lotKey] ?? ['bale_quantity' => 0, 'net_weight_kg' => 0];

            return [
                'id' => $log->id,
                'lc_no' => $log->receipt?->lc_no,
                'supplier_name' => $log->receipt?->supplier?->name,
                'origin_name' => $log->receipt?->supplier?->origin?->name,
                'item_code' => $log->product?->item_code,
                'product_name' => $log->product?->product_name,
                'received_quantity' => $log->receiving_quantity,
                'received_date' => optional($log->created_at)->toDateString(),
                'rate_per_kg' => $log->product?->unit_price,
                'opening_stock' => $log->product?->current_stock,
                'received_lot_bale' => $lotTotal['bale_quantity'],
                'received_lot_net_weight_kg' => $lotTotal['net_weight_kg'],
            ];
        });

        return response()->json(['value' => $rows, '@count' => $count]);
    }

    private function dateRange(Request $request): array
    {
        $filter = urldecode((string) $request->input('$filter', ''));
        preg_match('/received_date ge ([0-9-]+)/', $filter, $from);
        preg_match('/received_date le ([0-9-]+)/', $filter, $to);

        return [$from[1] ?? null, $to[1] ?? null];
    }

    private function searchTerm(Request $request): ?string
    {
        $filter = urldecode((string) $request->input('$filter', ''));
        preg_match("/contains\\((?:tolower\\()?[^,]+,\\s*'([^']+)'\\)/i", $filter, $match);

        return $match[1] ?? null;
    }

    public function export(Request $request)
    {
        $filters = $request->only(['from', 'to', 'search']);
        $filename = 'raw-cotton-received';

        if (!empty($filters['from']) && !empty($filters['to'])) {
            $filename .= '-' . $filters['from'] . '-to-' . $filters['to'];
        }

        return Excel::download(new RawCottonReceivedExport($filters), $filename . '.xlsx');
    }
}
