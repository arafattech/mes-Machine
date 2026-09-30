<?php

namespace App\Http\Controllers\Purchase;

use App\Enums\Purchase\PoStatus;
use App\Http\Controllers\Controller;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\PurchaseQuote;
use App\Models\Store\PurchaseRequisition;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PurchaseOrderWorkflowController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $payload = $this->validatePayload($request);
        $this->validateOrderQuantities($payload);

        $purchaseOrder = DB::transaction(function () use ($payload) {
            $purchaseOrder = PurchaseOrder::create($this->prepareOrderData($payload));
            $this->syncItems($purchaseOrder, $payload['items']);

            return $purchaseOrder->fresh(['supplier', 'department', 'requestBy', 'quote', 'poItems.item']);
        });

        return response()->json($purchaseOrder, 201);
    }

    public function update(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $payload = $this->validatePayload($request);
        $this->validateOrderQuantities($payload, $purchaseOrder);

        $purchaseOrder = DB::transaction(function () use ($payload, $purchaseOrder) {
            $purchaseOrder->update($this->prepareOrderData($payload));
            $purchaseOrder->poItems()->delete();
            $this->syncItems($purchaseOrder, $payload['items']);

            return $purchaseOrder->fresh(['supplier', 'department', 'requestBy', 'quote', 'poItems.item']);
        });

        return response()->json($purchaseOrder);
    }

    public function createPurchaseOrderFromQuote(Request $request, PurchaseRequisition $purchaseRequisition): JsonResponse
    {
        $payload = $request->validate([
            'purchase_quote_id' => ['required', 'integer', 'exists:purchase_quotes,id'],
            'custom_id' => ['nullable', 'string', 'max:255'],
            'po_date' => ['nullable', 'date'],
            'note' => ['nullable', 'string'],
            'items' => ['nullable', 'array'],
            'items.*.product_id' => ['required_with:items', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required_with:items', 'numeric', 'min:0'],
            'items.*.unit_price' => ['required_with:items', 'numeric', 'min:0'],
            'items.*.total_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.delivery_date' => ['nullable', 'date'],
        ]);

        $purchaseOrder = DB::transaction(function () use ($payload, $purchaseRequisition) {
            $customId = $this->resolvePurchaseOrderCustomId($payload['custom_id'] ?? null);
            $quote = PurchaseQuote::findOrFail($payload['purchase_quote_id']);

            $items = $payload['items'] ?? null;

            if (empty($items)) {
                $quote->loadMissing('quoteItems');
                $items = $quote->quoteItems->map(fn ($qi) => [
                    'product_id' => $qi->product_id,
                    'quantity' => $qi->quantity,
                    'unit_price' => $qi->unit_price,
                    'total_price' => $qi->total_price,
                    'delivery_date' => $qi->delivery_date,
                ])->all();
            }

            $totalAmount = collect($items)->sum(
                fn ($item) => (float) ($item['total_price'] ?? ((float) $item['unit_price'] * (float) $item['quantity']))
            );

            $purchaseOrder = PurchaseOrder::create([
                'custom_id' => $customId,
                'spr_id' => $purchaseRequisition->id,
                'purchase_quote_id' => $quote->id,
                'supplier_id' => $quote->supplier_id,
                'department_id' => $purchaseRequisition->department_id,
                'created_by' => auth()->id(),
                'po_date' => $payload['po_date'] ?? now()->toDateString(),
                'status' => PoStatus::PENDING->value,
                'total_amount' => $totalAmount,
                'note' => $payload['note'] ?? "Purchase order created against {$quote->custom_id}",
                'is_imported' => $purchaseRequisition->is_imported,
            ]);

            foreach ($items as $item) {
                PurchaseOrderItem::create([
                    'purchase_order_id' => $purchaseOrder->id,
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],
                    'received_quantity' => 0,
                    'unit_price' => $item['unit_price'],
                    'total_price' => $item['total_price'] ?? ((float) $item['unit_price'] * (float) $item['quantity']),
                    'delivery_date' => $item['delivery_date'] ?? null,
                    'status' => PoStatus::PENDING->value,
                ]);
            }

            $quote->update(['status' => 'CREATED']);

            return $purchaseOrder->fresh(['supplier', 'department', 'requestBy', 'quote', 'poItems.item']);
        });

        return response()->json($purchaseOrder, 201);
    }

    private function resolvePurchaseOrderCustomId(?string $requestedCustomId = null): string
    {
        $requestedCustomId = $requestedCustomId ? trim($requestedCustomId) : null;

        if ($requestedCustomId && !PurchaseOrder::where('custom_id', $requestedCustomId)->exists()) {
            return $requestedCustomId;
        }

        $lastCustomId = PurchaseOrder::query()
            ->where('custom_id', 'like', 'PI-%')
            ->lockForUpdate()
            ->orderByDesc('id')
            ->value('custom_id');

        preg_match('/^PI-(\d+)$/', (string) $lastCustomId, $matches);

        $nextNumber = ((int) ($matches[1] ?? 0)) + 1;

        do {
            $customId = 'PI-' . str_pad((string) $nextNumber, 6, '0', STR_PAD_LEFT);
            $nextNumber++;
        } while (PurchaseOrder::where('custom_id', $customId)->exists());

        return $customId;
    }

    public function approve(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $request->validate([
            'status' => ['required', 'string', 'in:PENDING,APPROVED,CANCELED,COMPLETED,REJECTED,PARTIAL'],
            'rejected_reason' => ['nullable', 'string'],
        ]);

        $status = $this->normalizeStatus($request->string('status')->toString());
        $allowedStatuses = [
            PoStatus::PENDING->value,
            PoStatus::APPROVED->value,
            PoStatus::CANCELED->value,
        ];

        abort_unless(in_array($status, $allowedStatuses, true), 422, 'Unsupported purchase order status.');

        $purchaseOrder->update([
            'status' => $status,
            'approved_by' => auth()->id(),
            'approved_at' => now(),
            'rejected_reason' => $status === PoStatus::CANCELED->value
                ? $request->input('rejected_reason')
                : null,
        ]);

        return response()->json($purchaseOrder->fresh(['supplier', 'department', 'requestBy', 'quote', 'poItems.item']));
    }

    public function destroy(PurchaseOrder $purchaseOrder): JsonResponse
    {
        abort_unless(
            strtoupper((string) $purchaseOrder->status) === PoStatus::PENDING->value,
            422,
            'Only pending purchase orders can be deleted.'
        );

        DB::transaction(function () use ($purchaseOrder) {
            $purchaseOrder->poItems()->delete();
            $purchaseOrder->delete();
        });

        return response()->json(['message' => 'Purchase order deleted successfully.']);
    }

    private function validatePayload(Request $request): array
    {
        return $request->validate([
            'custom_id' => ['nullable', 'string', 'max:255'],
            'spr_id' => ['nullable', 'integer', 'exists:purchase_requisitions,id'],
            'purchase_quote_id' => ['nullable', 'integer', 'exists:purchase_quotes,id'],
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'po_date' => ['nullable', 'date'],
            'status' => ['nullable', 'string', 'in:PENDING,APPROVED,CANCELED,COMPLETED,REJECTED,PARTIAL'],
            'note' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.delivery_date' => ['nullable', 'date'],
        ]);
    }

    private function prepareOrderData(array $payload): array
    {
        $total = collect($payload['items'])->sum(
            fn (array $item) => ((float) $item['unit_price']) * ((int) $item['quantity'])
        );

        return [
            'custom_id' => $this->resolvePurchaseOrderCustomId($payload['custom_id'] ?? null),
            'spr_id' => $payload['spr_id'] ?? null,
            'purchase_quote_id' => $payload['purchase_quote_id'] ?? null,
            'supplier_id' => $payload['supplier_id'],
            'department_id' => $payload['department_id'] ?? null,
            'created_by' => auth()->id(),
            'po_date' => $payload['po_date'] ?? now()->toDateString(),
            'status' => $this->normalizeStatus($payload['status'] ?? PoStatus::PENDING->value),
            'total_amount' => $total,
            'note' => $payload['note'] ?? null,
        ];
    }

    private function syncItems(PurchaseOrder $purchaseOrder, array $items): void
    {
        foreach ($items as $item) {
            PurchaseOrderItem::create([
                'purchase_order_id' => $purchaseOrder->id,
                'product_id' => $item['product_id'],
                'quantity' => (int) $item['quantity'],
                'received_quantity' => 0,
                'unit_price' => (float) $item['unit_price'],
                'total_price' => ((float) $item['unit_price']) * ((int) $item['quantity']),
                'delivery_date' => $item['delivery_date'] ?? null,
                'status' => PoStatus::PENDING->value,
            ]);
        }
    }

    private function validateOrderQuantities(array $payload, ?PurchaseOrder $purchaseOrder = null): void
    {
        $sprId = $payload['spr_id'] ?? null;
        if (!$sprId) {
            return;
        }

        $requisition = PurchaseRequisition::with('sprItems')->findOrFail($sprId);

        $orderedByProduct = PurchaseOrderItem::query()
            ->join('purchase_orders', 'purchase_orders.id', '=', 'purchase_order_items.purchase_order_id')
            ->selectRaw('purchase_order_items.product_id, COALESCE(SUM(purchase_order_items.quantity), 0) as total_ordered')
            ->where('purchase_orders.spr_id', $sprId)
            ->whereRaw("UPPER(purchase_orders.status) NOT IN ('CANCELED', 'CANCELLED')")
            ->when($purchaseOrder, fn ($query) => $query->where('purchase_orders.id', '!=', $purchaseOrder->id))
            ->groupBy('product_id')
            ->pluck('total_ordered', 'product_id');

        $requestedByProduct = collect($payload['items'] ?? [])
            ->groupBy(fn (array $item) => (int) ($item['product_id'] ?? 0))
            ->map(fn ($group) => $group->sum(fn (array $item) => (int) ($item['quantity'] ?? 0)));

        // Aggregate total required per product across all SPR lines
        $requiredByProduct = [];
        foreach ($requisition->sprItems as $sprItem) {
            $productId = (int) ($sprItem->product_id ?? 0);
            if (!$productId) continue;
            $requiredByProduct[$productId] = ($requiredByProduct[$productId] ?? 0)
                + (int) ($sprItem->approved_qty ?? $sprItem->required_quantity ?? 0);
        }

        foreach ($requestedByProduct as $productId => $currentOrdered) {
            if (!$productId || !isset($requiredByProduct[$productId])) continue;

            $requiredQuantity = (int) $requiredByProduct[$productId];
            $alreadyOrdered = (int) ($orderedByProduct[$productId] ?? 0);
            $remainingQuantity = max($requiredQuantity - $alreadyOrdered, 0);

            if ($currentOrdered > $remainingQuantity) {
                throw ValidationException::withMessages([
                    'items' => "Ordered quantity exceeds remaining SPR quantity. Required: {$requiredQuantity}, already ordered: {$alreadyOrdered}, remaining: {$remainingQuantity}.",
                ]);
            }
        }
    }

    private function normalizeStatus(string $status): string
    {
        return match (strtoupper($status)) {
            'COMPLETED' => PoStatus::APPROVED->value,
            'REJECTED', 'PARTIAL' => PoStatus::CANCELED->value,
            default => in_array(
                strtoupper($status),
                [PoStatus::APPROVED->value, PoStatus::CANCELED->value, PoStatus::PENDING->value],
                true
            )
                ? strtoupper($status)
                : PoStatus::PENDING->value,
        };
    }
}
