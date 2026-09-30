<?php

namespace App\Http\Controllers\Store;

use App\Exports\StockLedgerExport;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Store\MaterialReceiptItem;
use App\Models\Store\MrrReturnItem;
use App\Models\Store\PurchaseRequisitionItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;

class StockLedgerController extends Controller
{
    private const ALLOWED_SORT_COLUMNS = [
        'item_code', 'product_name', 'model_number', 'rack_no',
        'opening_stock', 'current_stock', 'unit_price', 'created_at', 'last_activity',
    ];

    public function export()
    {
        return Excel::download(new StockLedgerExport(), 'stock-ledger.xlsx');
    }

    public function report(Request $request): JsonResponse
    {
        $top  = $request->filled('$top') ? max((int) $request->input('$top'), 0) : 40;
        $skip = $request->filled('$skip') ? max((int) $request->input('$skip'), 0) : 0;

        $query = $this->baseQuery();

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
                                ->orWhere('part_number', 'like', "%{$word}%")
                                ->orWhere('rack_no', 'like', "%{$word}%")
                                ->orWhereHas('uom', function ($u) use ($word) {
                                    $u->where('name', 'like', "%{$word}%");
                                })
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

        $rows = $query->skip($skip)->take($top)->get();

        $rows->each(function (Product $product) {
            $rate = (float) ($product->unit_price ?? 0);
            $product->rate_per_unit = $rate;
            $product->amount = round(((float) $product->current_stock) * $rate, 2);
            // SRM (Store Return Material) has no source of truth yet in this
            // system — surfaced as a placeholder column until that flow exists.
            $product->srm = 0;
        });

        return response()->json([
            'value'  => $rows,
            '@count' => $count,
        ]);
    }

    private function baseQuery()
    {
        return Product::query()
            ->with(['uom:id,name', 'category:id,name'])
            ->select('products.*')
            ->selectSub(
                MaterialReceiptItem::query()
                    ->selectRaw('COALESCE(SUM(received_quantity), 0)')
                    ->whereColumn('product_id', 'products.id'),
                'mrr'
            )
            ->selectSub(
                MaterialReceiptItem::query()
                    ->selectRaw('COALESCE(SUM(rejected_quantity), 0)')
                    ->whereColumn('product_id', 'products.id'),
                'rejected'
            )
            ->selectSub(
                PurchaseRequisitionItem::query()
                    ->join('purchase_requisitions', 'purchase_requisitions.id', '=', 'purchase_requisition_items.spr_id')
                    ->where('purchase_requisitions.type', 'SR')
                    ->whereColumn('purchase_requisition_items.product_id', 'products.id')
                    ->selectRaw('COALESCE(SUM(purchase_requisition_items.received_quantity), 0)'),
                'sr'
            )
            ->selectSub(
                MrrReturnItem::query()
                    ->selectRaw('COALESCE(SUM(returned_quantity), 0)')
                    ->whereColumn('product_id', 'products.id'),
                'returned'
            )
            // Most recent of: a receiving event on this product, an SR issue, or a
            // return — whichever touched the product last. Defaults each source to
            // an epoch date so GREATEST() never nulls out when a product has no
            // activity in one or more of the three tables.
            ->selectRaw(
                '(SELECT GREATEST(
                    COALESCE((SELECT MAX(mri.created_at) FROM material_receipt_items mri WHERE mri.product_id = products.id), "1970-01-01"),
                    COALESCE((SELECT MAX(pri.updated_at) FROM purchase_requisition_items pri
                        INNER JOIN purchase_requisitions pr ON pr.id = pri.spr_id
                        WHERE pr.type = "SR" AND pri.product_id = products.id), "1970-01-01"),
                    COALESCE((SELECT MAX(mreti.created_at) FROM mrr_return_items mreti WHERE mreti.product_id = products.id), "1970-01-01")
                )) as last_activity'
            );
    }

    private function resolveSort(Request $request): array
    {
        $orderby    = trim((string) $request->input('$orderby', ''));
        $column     = 'last_activity';
        $descending = true;

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
