<?php

namespace App\Http\Controllers\Purchase;

use App\Http\Controllers\Controller;
use App\Models\Purchase\PurchaseQuote;
use App\Models\Purchase\PurchaseQuoteItem;
use App\Models\Store\PurchaseRequisition;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PurchaseQuoteController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $payload = $this->validatePayload($request);

        $quote = DB::transaction(function () use ($payload) {
            $quote = PurchaseQuote::create($this->prepareQuoteData($payload));
            $this->syncItems($quote, $payload['items']);

            return $quote->fresh(['supplier', 'requisition', 'quoteItems.item']);
        });

        return response()->json($quote, 201);
    }

    public function update(Request $request, PurchaseQuote $purchaseQuote): JsonResponse
    {
        $payload = $this->validatePayload($request);

        $quote = DB::transaction(function () use ($purchaseQuote, $payload) {
            $purchaseQuote->update($this->prepareQuoteData($payload));
            $purchaseQuote->quoteItems()->delete();
            $this->syncItems($purchaseQuote, $payload['items']);

            return $purchaseQuote->fresh(['supplier', 'requisition', 'quoteItems.item']);
        });

        return response()->json($quote);
    }

    public function destroy(PurchaseQuote $purchaseQuote): JsonResponse
    {
        abort_if(
            strtoupper((string) $purchaseQuote->status) === 'CREATED',
            422,
            'Cannot delete a quote that has a purchase order created against it.'
        );

        DB::transaction(function () use ($purchaseQuote) {
            $purchaseQuote->quoteItems()->delete();
            $purchaseQuote->delete();
        });

        return response()->json(['message' => 'Purchase quote deleted successfully.']);
    }

    private function validatePayload(Request $request): array
    {
        return $request->validate([
            'custom_id' => ['required', 'string', 'max:255'],
            'purchase_requisition_id' => ['required', 'integer', 'exists:purchase_requisitions,id'],
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'quote_date' => ['nullable', 'date'],
            'valid_until' => ['nullable', 'date'],
            'status' => ['nullable', 'string', 'max:50'],
            'note' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.delivery_date' => ['nullable', 'date'],
            'items.*.note' => ['nullable', 'string'],
        ]);
    }

    private function prepareQuoteData(array $payload): array
    {
        $total = collect($payload['items'])->sum(
            fn (array $item) => ((float) $item['unit_price']) * ((int) $item['quantity'])
        );

        return [
            'custom_id' => $payload['custom_id'],
            'purchase_requisition_id' => $payload['purchase_requisition_id'],
            'supplier_id' => $payload['supplier_id'],
            'created_by' => auth()->id(),
            'quote_date' => $payload['quote_date'] ?? now()->toDateString(),
            'valid_until' => $payload['valid_until'] ?? null,
            'status' => $payload['status'] ?? 'SUBMITTED',
            'note' => $payload['note'] ?? null,
            'total_amount' => $total,
        ];
    }

    private function validateQuoteQuantities(array $payload, ?PurchaseQuote $purchaseQuote = null): void
    {
        $requisition = PurchaseRequisition::with([
            'sprItems',
            'purchaseQuotes.quoteItems',
        ])->findOrFail($payload['purchase_requisition_id']);

        // Quantities being submitted in this request
        $requestedByProduct = collect($payload['items'] ?? [])
            ->groupBy(fn (array $item) => (int) ($item['product_id'] ?? 0))
            ->map(fn ($group) => $group->sum(fn (array $item) => (int) ($item['quantity'] ?? 0)));

        // Quantities already quoted by OTHER non-cancelled quotes for this SPR
        $alreadyQuotedByProduct = [];
        foreach ($requisition->purchaseQuotes as $quote) {
            if (in_array(strtoupper((string) $quote->status), ['CANCELLED'], true)) {
                continue;
            }
            if ($purchaseQuote && $quote->id === $purchaseQuote->id) {
                continue;
            }
            foreach ($quote->quoteItems as $quoteItem) {
                $productId = (int) $quoteItem->product_id;
                $alreadyQuotedByProduct[$productId] = ($alreadyQuotedByProduct[$productId] ?? 0) + (int) $quoteItem->quantity;
            }
        }

        // Total required per product from SPR lines
        $requiredByProduct = [];
        foreach ($requisition->sprItems as $sprItem) {
            $productId = (int) ($sprItem->product_id ?? 0);
            if (!$productId) continue;
            $requiredByProduct[$productId] = ($requiredByProduct[$productId] ?? 0)
                + (int) ($sprItem->approved_qty ?? $sprItem->required_quantity ?? 0);
        }

        foreach ($requestedByProduct as $productId => $currentQuoted) {
            if (!$productId || !isset($requiredByProduct[$productId])) continue;

            $requiredQuantity = (int) $requiredByProduct[$productId];
            $alreadyQuoted = (int) ($alreadyQuotedByProduct[$productId] ?? 0);
            $remainingQuantity = max($requiredQuantity - $alreadyQuoted, 0);

            if ($currentQuoted > $remainingQuantity) {
                throw ValidationException::withMessages([
                    'items' => "Quoted quantity exceeds remaining balance for a product. Required: {$requiredQuantity}, already quoted: {$alreadyQuoted}, remaining: {$remainingQuantity}.",
                ]);
            }
        }
    }

    private function syncItems(PurchaseQuote $quote, array $items): void
    {
        foreach ($items as $item) {
            PurchaseQuoteItem::create([
                'purchase_quote_id' => $quote->id,
                'product_id' => $item['product_id'],
                'quantity' => (int) $item['quantity'],
                'unit_price' => (float) $item['unit_price'],
                'total_price' => ((float) $item['unit_price']) * ((int) $item['quantity']),
                'delivery_date' => $item['delivery_date'] ?? null,
                'note' => $item['note'] ?? null,
            ]);
        }
    }
}
