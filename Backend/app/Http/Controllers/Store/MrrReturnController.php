<?php

namespace App\Http\Controllers\Store;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Store\MaterialReceipt;
use App\Models\Store\MaterialReceiptItem;
use App\Models\Store\MrrReturn;
use App\Models\Store\MrrReturnItem;
use App\Models\Store\StockAdjustment;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MrrReturnController extends Controller
{
    // Reverses part or all of an MRR's REMAINING returnable quantity per product —
    // an MRR can be returned against multiple times (e.g. more defects found later),
    // so the cap per product is (received − already returned across all prior
    // MrrReturns for this receipt), not just received. Decrements each returned
    // product's current_stock by the submitted return_quantity, logs a
    // StockAdjustment per product, and persists a permanent MrrReturn +
    // MrrReturnItem snapshot (audit history, independent of the live receiptItems
    // rows). `is_returned`/`returned_at`/`returned_by` are stamped as an informational
    // "has been returned from at least once" marker — no longer a gate that blocks
    // further returns or receiving.
    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'material_receipt_id' => ['required', 'integer', 'exists:material_receipts,id'],
            'return_date' => ['nullable', 'date'],
            'return_type' => ['nullable', 'string', 'max:255'],
            'reason' => ['nullable', 'string', 'max:255'],
            'remarks' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.return_quantity' => ['required', 'integer', 'min:0'],
            'items.*.remark' => ['nullable', 'string', 'max:255'],
        ]);

        $materialReceipt = MaterialReceipt::findOrFail($payload['material_receipt_id']);

        if ($materialReceipt->status === 'CANCELLED') {
            throw ValidationException::withMessages([
                'material_receipt_id' => 'A cancelled MRR was never received into stock and cannot be returned.',
            ]);
        }

        $requestedQuantities = collect($payload['items'])
            ->filter(fn (array $item) => (int) $item['return_quantity'] > 0)
            ->pluck('return_quantity', 'product_id');

        $remarksByProduct = collect($payload['items'])->pluck('remark', 'product_id');

        if ($requestedQuantities->isEmpty()) {
            throw ValidationException::withMessages([
                'items' => 'Select at least one item with a return quantity greater than zero.',
            ]);
        }

        // receiptItems has one row per receiving EVENT (syncReceiptItems appends, never
        // updates in place) — the running total received for a product is the latest
        // (highest id) row's received_quantity, same dedup as generatePdf().
        $latestByProduct = [];
        foreach (MaterialReceiptItem::where('material_receipt_id', $materialReceipt->id)->get() as $item) {
            $existing = $latestByProduct[$item->product_id] ?? null;
            if (!$existing || $item->id > $existing->id) {
                $latestByProduct[$item->product_id] = $item;
            }
        }

        // Sum every previously returned quantity for this receipt, per product, across
        // ALL prior MrrReturn records — the remaining returnable amount is received minus
        // this running total, not just received.
        $alreadyReturnedByProduct = MrrReturnItem::whereIn(
            'mrr_return_id',
            MrrReturn::where('material_receipt_id', $materialReceipt->id)->pluck('id')
        )->selectRaw('product_id, SUM(returned_quantity) as total')
            ->groupBy('product_id')
            ->pluck('total', 'product_id');

        foreach ($requestedQuantities as $productId => $requestedQuantity) {
            $receivedQuantity = (int) ($latestByProduct[$productId]->received_quantity ?? 0);
            $remaining = max(0, $receivedQuantity - (int) ($alreadyReturnedByProduct[$productId] ?? 0));
            if ((int) $requestedQuantity > $remaining) {
                throw ValidationException::withMessages([
                    'items' => "Return quantity for product #{$productId} cannot exceed its remaining returnable quantity ({$remaining}).",
                ]);
            }
        }

        $mrrReturn = DB::transaction(function () use (
            $materialReceipt,
            $payload,
            $requestedQuantities,
            $latestByProduct,
            $remarksByProduct,
            $alreadyReturnedByProduct
        ) {
            $materialReceipt = MaterialReceipt::whereKey($materialReceipt->id)->lockForUpdate()->firstOrFail();

            $mrrReturn = MrrReturn::create([
                'material_receipt_id' => $materialReceipt->id,
                'returned_by' => auth()->id(),
                'return_date' => $payload['return_date'] ?? now()->toDateString(),
                'return_type' => $payload['return_type'] ?? null,
                'reason' => $payload['reason'] ?? null,
                'remarks' => $payload['remarks'] ?? null,
                'total_quantity' => 0,
            ]);

            $totalQuantity = 0;

            foreach ($requestedQuantities as $productId => $requestedQuantity) {
                $item = $latestByProduct[$productId] ?? null;
                $receivedQuantity = (int) ($item->received_quantity ?? 0);
                $remaining = max(0, $receivedQuantity - (int) ($alreadyReturnedByProduct[$productId] ?? 0));
                $quantity = min((int) $requestedQuantity, $remaining);
                if ($quantity <= 0) {
                    continue;
                }

                $product = Product::whereKey($productId)->lockForUpdate()->first();
                if (!$product) {
                    continue;
                }

                $product->decrement('current_stock', $quantity);

                StockAdjustment::create([
                    'product_id' => $product->id,
                    'adjustment_quantity' => $quantity,
                    'created_by' => auth()->id(),
                    'condition' => 'DECREASED',
                    'reason' => 'MATERIAL_RECEIPT_RETURN',
                    'sectionable_type' => MaterialReceipt::class,
                    'sectionable_id' => $materialReceipt->id,
                    'adjustment_date' => now()->toDateString(),
                ]);

                MrrReturnItem::create([
                    'mrr_return_id' => $mrrReturn->id,
                    'product_id' => $productId,
                    'returned_quantity' => $quantity,
                    'rejected_quantity' => (int) ($item->rejected_quantity ?? 0),
                    'remark' => $remarksByProduct[$productId] ?? null,
                ]);

                $totalQuantity += $quantity;
            }

            $mrrReturn->update([
                'custom_id' => sprintf('MRR-RTN-%05d', $mrrReturn->id),
                'total_quantity' => $totalQuantity,
            ]);

            $materialReceipt->update([
                'is_returned' => true,
                'returned_at' => now(),
                'returned_by' => auth()->id(),
            ]);

            return $mrrReturn->fresh(['materialReceipt.supplier', 'returnedBy', 'items.item.uom']);
        });

        return response()->json($mrrReturn, 201);
    }

    // Preview of the Return No the next save will get — not reserved, just the next
    // sequential id under the same sprintf('MRR-RTN-%05d', id) scheme store() uses.
    public function nextCustomId(): JsonResponse
    {
        $nextId = (int) MrrReturn::withTrashed()->max('id') + 1;

        return response()->json(['custom_id' => sprintf('MRR-RTN-%05d', $nextId)]);
    }

    public function generatePdf(MrrReturn $mrrReturn)
    {
        $mrrReturn->load([
            'materialReceipt.supplier',
            'materialReceipt.purchaseOrder.poItems',
            'materialReceipt.receiptItems',
            'returnedBy',
            'items.item.uom',
        ]);

        // Required qty comes from the PO line for that product; receiptItems has one row
        // per receiving EVENT (never updated in place), so the latest (highest id) row per
        // product carries both the total received quantity and its po_item_id — same dedup
        // used everywhere else this quantity is derived (generatePdf on MaterialReceipt, etc).
        $latestReceiptItemByProduct = [];
        foreach ($mrrReturn->materialReceipt?->receiptItems ?? [] as $receiptItem) {
            $existing = $latestReceiptItemByProduct[$receiptItem->product_id] ?? null;
            if (!$existing || $receiptItem->id > $existing->id) {
                $latestReceiptItemByProduct[$receiptItem->product_id] = $receiptItem;
            }
        }

        $requiredByPoItem = collect($mrrReturn->materialReceipt?->purchaseOrder?->poItems ?? [])
            ->mapWithKeys(fn ($poItem) => [(int) $poItem->id => (int) ($poItem->quantity ?? 0)])
            ->all();

        $items = $mrrReturn->items->map(function ($item) use ($latestReceiptItemByProduct, $requiredByPoItem) {
            $receiptItem = $latestReceiptItemByProduct[$item->product_id] ?? null;

            return [
                'item_code' => $item->item?->item_code ?? '-',
                'product_name' => $item->item?->product_name ?? '-',
                'uom' => $item->item?->uom?->name ?? '-',
                'required_quantity' => $requiredByPoItem[(int) ($receiptItem->po_item_id ?? 0)] ?? 0,
                'received_quantity' => (int) ($receiptItem->received_quantity ?? 0),
                'current_quantity' => max(0, (int) ($item->item?->current_stock ?? 0)),
                'returned_quantity' => (int) $item->returned_quantity,
                'remark' => $item->remark ?? '-',
            ];
        });

        $pdf = Pdf::loadView('pdf-templates.mrr-return', [
            'mrrReturn' => $mrrReturn,
            'items' => $items,
        ])->setPaper('A4', 'portrait');

        $filename = sprintf('%s.pdf', $mrrReturn->custom_id ?? 'mrr-return');

        return response($pdf->output(), 200)
            ->header('Content-Type', 'application/pdf')
            ->header('Content-Disposition', 'inline; filename="' . $filename . '"');
    }

    public function summary(): JsonResponse
    {
        $totalReturns = MrrReturn::count();
        $totalQuantity = (int) MrrReturn::sum('total_quantity');

        return response()->json([
            'total_returns' => $totalReturns,
            'total_quantity' => $totalQuantity,
            'latest_return_date' => MrrReturn::max('return_date'),
            'returns_this_month' => MrrReturn::whereYear('return_date', now()->year)
                ->whereMonth('return_date', now()->month)
                ->count(),
            'average_quantity_per_return' => $totalReturns > 0
                ? round($totalQuantity / $totalReturns, 1)
                : 0,
            // Non-cancelled receipts are always selectable for a (further) return —
            // is_returned no longer gates eligibility, so it's dropped from this count.
            'pending_returnable_mrrs' => MaterialReceipt::where('status', '!=', 'CANCELLED')->count(),
        ]);
    }
}
