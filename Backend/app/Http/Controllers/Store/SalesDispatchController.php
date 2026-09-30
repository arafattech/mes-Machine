<?php

namespace App\Http\Controllers\Store;

use App\Http\Controllers\Controller;
use App\Models\Store\StockAdjustment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SalesDispatchController extends Controller
{
    private const ALLOWED_SORT_COLUMNS = ['id', 'adjustment_quantity', 'adjustment_date', 'created_at'];

    public function report(Request $request): JsonResponse
    {
        $top = $request->filled('$top') ? max((int) $request->input('$top'), 0) : 40;
        $skip = $request->filled('$skip') ? max((int) $request->input('$skip'), 0) : 0;
        $query = StockAdjustment::query()->with([
            'product:id,item_code,product_name',
            'salesOrder:id,order_no,custom_id,client_id',
            'salesOrder.client:id,name',
        ])->where('reason', 'SALES_DISPATCH');

        $searchTerms = $this->extractSearchTerms($request);
        if ($searchTerms) {
            $query->where(function ($q) use ($searchTerms) {
                foreach ($searchTerms as $term) {
                    $q->where(function ($w) use ($term) {
                        $w->whereHas('product', fn ($product) => $product->where('item_code', 'like', "%{$term}%")->orWhere('product_name', 'like', "%{$term}%"))
                            ->orWhereHas('salesOrder', fn ($order) => $order->where('order_no', 'like', "%{$term}%")->orWhere('custom_id', 'like', "%{$term}%")->orWhereHas('client', fn ($client) => $client->where('name', 'like', "%{$term}%")));
                    });
                }
            });
        }

        $count = (clone $query)->count();
        [$column, $descending] = $this->resolveSort($request);
        $rows = $query->orderBy($column, $descending ? 'desc' : 'asc')->skip($skip)->take($top)->get();

        return response()->json(['value' => $rows, '@count' => $count]);
    }

    private function resolveSort(Request $request): array
    {
        $orderby = trim((string) $request->input('$orderby', ''));
        $column = 'adjustment_date';
        $descending = true;
        if ($orderby && preg_match('/^([A-Za-z0-9_]+)\s+(asc|desc)$/i', $orderby, $matches) && in_array($matches[1], self::ALLOWED_SORT_COLUMNS, true)) {
            $column = $matches[1];
            $descending = strtolower($matches[2]) === 'desc';
        }
        return [$column, $descending];
    }

    private function extractSearchTerms(Request $request): array
    {
        $terms = [];
        $filter = urldecode((string) $request->input('$filter', ''));
        if ($filter) {
            preg_match_all("/contains\\((?:tolower\\()?[^,]+,\\s*'([^']*)'\\)/i", $filter, $matches);
            $terms = array_map('urldecode', $matches[1] ?? []);
        }
        if ($request->filled('search')) {
            $terms[] = (string) $request->input('search');
        }
        return collect($terms)->map(fn ($term) => trim((string) $term))->filter()->unique()->values()->all();
    }
}
