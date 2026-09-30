<?php

namespace App\Http\Controllers\Store;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LowStockController extends Controller
{
    private const ALLOWED_SORT_COLUMNS = [
        'item_code', 'product_name', 'model_number', 'rack_no',
        'current_stock', 'minimum_stock', 'unit_price', 'created_at',
    ];

    public function report(Request $request): JsonResponse
    {
        $top  = $request->filled('$top') ? max((int) $request->input('$top'), 0) : 40;
        $skip = $request->filled('$skip') ? max((int) $request->input('$skip'), 0) : 0;

        $query = Product::query()
            ->with('category:id,name')
            ->where('current_stock', '>=', 0)
            ->whereColumn('current_stock', '<', 'minimum_stock');

        $searchTerms = $this->extractSearchTerms($request);
        if ($searchTerms) {
            $query->where(function ($q) use ($searchTerms) {
                foreach ($searchTerms as $term) {
                    $words = array_filter(preg_split('/\s+/', trim($term)));
                    foreach ($words as $word) {
                        $q->where(function ($w) use ($word) {
                            $w->where('item_code', 'like', "%{$word}%")
                                ->orWhere('product_name', 'like', "%{$word}%")
                                ->orWhere('model_number', 'like', "%{$word}%")
                                ->orWhere('rack_no', 'like', "%{$word}%")
                                ->orWhere('unit_price', 'like', "%{$word}%")
                                ->orWhere('current_stock', 'like', "%{$word}%")
                                ->orWhere('minimum_stock', 'like', "%{$word}%")
                                ->orWhereHas('category', function ($c) use ($word) {
                                    $c->where('name', 'like', "%{$word}%");
                                });
                        });
                    }
                }
            });
        }

        $count = (clone $query)->count();

        [$column, $descending] = $this->resolveSort($request);
        $query->orderBy($column, $descending ? 'desc' : 'asc');

        $rows = $query
            ->skip($skip)
            ->take($top)
            ->get([
                'id',
                'item_code',
                'product_name',
                'model_number',
                'rack_no',
                'item_category_id',
                'current_stock',
                'minimum_stock',
                'unit_price',
                'created_at',
            ]);

        return response()->json([
            'value' => $rows,
            '@count' => $count,
        ]);
    }

    private function resolveSort(Request $request): array
    {
        $orderby    = trim((string) $request->input('$orderby', ''));
        $column     = 'current_stock';
        $descending = false;

        if ($orderby && preg_match('/^([A-Za-z0-9_]+)\s+(asc|desc)$/i', $orderby, $matches)) {
            if (in_array($matches[1], self::ALLOWED_SORT_COLUMNS, true)) {
                $column     = $matches[1];
                $descending = strtolower($matches[2]) === 'desc';
            }
        }

        return [$column, $descending];
    }

    private function extractSearchTerms(Request $request): array
    {
        $terms = [];

        $filter = urldecode((string) $request->input('$filter', ''));
        if ($filter) {
            preg_match_all("/contains\((?:tolower\()?[^,]+,\s*'([^']*)'\)/i", $filter, $m);
            $terms = array_map('urldecode', $m[1] ?? []);
        }

        if ($request->filled('search')) {
            $terms[] = (string) $request->input('search');
        }

        return collect($terms)
            ->map(fn ($t) => trim(strtolower((string) $t)))
            ->filter()
            ->unique()
            ->values()
            ->all();
    }
}
