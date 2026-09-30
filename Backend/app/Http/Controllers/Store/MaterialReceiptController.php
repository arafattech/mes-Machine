<?php

namespace App\Http\Controllers\Store;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Store\MaterialReceipt;
use App\Models\Store\MaterialReceiptItem;
use App\Models\Store\MaterialReceiptLog;
use App\Models\Store\PurchaseRequisition;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Store\StockAdjustment;
use App\Enums\Purchase\PoStatus;
use Carbon\Carbon;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MaterialReceiptController extends Controller
{
    // Create only establishes the MRR header + required-qty tracking rows — zero received,
    // no MaterialReceiptLog rows, no stock/PO-item increments. Actual receiving happens
    // afterward via update()/receiveSingleItem(), never at creation time.
    public function store(Request $request): JsonResponse
    {
        $payload = $this->validateRequest($request);

        $receipt = DB::transaction(function () use ($payload) {
            $receiptData = $this->buildReceiptData($payload);
            $receiptData['status'] = $receiptData['status'] === 'CANCELLED' ? 'CANCELLED' : 'PARTIAL';
            $receipt = MaterialReceipt::create($receiptData);
            $this->createReceiptItemsShell($receipt, $payload['items']);

            return $receipt->fresh($this->defaultRelations());
        });

        return response()->json($receipt, 201);
    }

    // Header-only edit — never touches items/stock/PO-item counters. Receiving is
    // exclusively receiveSingleItem()'s job now; editing an MRR (supplier, dates,
    // invoice/LC/vehicle no, remarks, etc.) must never rebuild or re-validate quantities
    // already received through the separate "Receive" dialog.
    public function update(Request $request, MaterialReceipt $materialReceipt): JsonResponse
    {
        $payload = $this->validateRequest($request);

        $receipt = DB::transaction(function () use ($materialReceipt, $payload) {
            $receiptData = $this->buildReceiptData($payload);
            // Preserve the existing status — buildReceiptData's resolveReceiptStatus() is
            // computed from the submitted items array, which is meaningless here since
            // items/receiving are untouched by this endpoint. Only an explicit cancel
            // request is honored.
            $receiptData['status'] = strtoupper((string) ($payload['status'] ?? '')) === 'CANCELLED'
                ? 'CANCELLED'
                : $materialReceipt->status;

            $materialReceipt->update($receiptData);

            return $materialReceipt->fresh($this->defaultRelations());
        });

        return response()->json($receipt);
    }

    // Lightweight single-product receiving action (the left-panel "Receive" dialog) —
    // appends one MaterialReceiptItem/MaterialReceiptLog row via the same syncReceiptItems()
    // path as the full form, but recomputes overall MRR status from ALL of the linked PO's
    // items (fresh from DB), not just the one product being touched here.
    public function receiveSingleItem(Request $request, MaterialReceipt $materialReceipt): JsonResponse
    {
        if (in_array($materialReceipt->status, ['CANCELLED', 'COMPLETED'], true)) {
            throw ValidationException::withMessages([
                'status' => 'This MRR can no longer be modified.',
            ]);
        }

        $payload = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'receiving_quantity' => ['required', 'integer', 'min:1'],
        ]);

        // Everything that decides "how much is left" must be read AND written inside one
        // locked transaction — reading it beforehand (or without a row lock) let two
        // near-simultaneous submits (e.g. an accidental double-click) both see the same
        // stale "previously received" figure and both insert a row, double-counting.
        $receipt = DB::transaction(function () use ($materialReceipt, $payload) {
            $poItem = PurchaseOrderItem::where('purchase_order_id', $materialReceipt->purchase_order_id)
                ->where('product_id', $payload['product_id'])
                ->lockForUpdate()
                ->first();

            if (!$poItem) {
                throw ValidationException::withMessages([
                    'product_id' => 'This product is not part of the linked purchase order.',
                ]);
            }

            $previouslyReceived = (int) (MaterialReceiptItem::where('material_receipt_id', $materialReceipt->id)
                ->where('product_id', $payload['product_id'])
                ->lockForUpdate()
                ->orderByDesc('id')
                ->value('received_quantity') ?? 0);

            $requiredQuantity = (int) $poItem->quantity;
            $remaining = max(0, $requiredQuantity - (int) $poItem->received_quantity);

            if ($payload['receiving_quantity'] > $remaining) {
                throw ValidationException::withMessages([
                    'receiving_quantity' => "Receiving quantity exceeds remaining. Remaining: {$remaining}.",
                ]);
            }

            $this->syncReceiptItems($materialReceipt, [[
                'product_id' => $payload['product_id'],
                'po_item_id' => $poItem->id,
                'required_quantity' => $requiredQuantity,
                'received_quantity' => $previouslyReceived,
                'receiving_quantity' => $payload['receiving_quantity'],
                'remark' => null,
            ]], $materialReceipt->status);

            $this->refreshReceiptStatus($materialReceipt);
            $this->markRequisitionCompleteIfNeeded($materialReceipt, $materialReceipt->fresh()->status);

            return $materialReceipt->fresh($this->defaultRelations());
        });

        return response()->json($receipt);
    }

    // Recomputes status from every PO item's current received_quantity vs quantity — NOT
    // from a client-submitted items array — so a single-product update can never mismark
    // the whole MRR complete/partial based on just that one product.
    private function refreshReceiptStatus(MaterialReceipt $materialReceipt): void
    {
        $materialReceipt->loadMissing('purchaseOrder.poItems');
        $poItems = $materialReceipt->purchaseOrder?->poItems ?? collect();

        $allReceived = $poItems->isNotEmpty()
            && $poItems->every(fn ($poItem) => (int) $poItem->received_quantity >= (int) $poItem->quantity);

        $materialReceipt->update(['status' => $allReceived ? 'COMPLETED' : 'PARTIAL']);
    }

    public function generatePdf(MaterialReceipt $materialReceipt)
    {
        $receipt = $materialReceipt->load([
            'purchaseOrder.requisition',
            'purchaseOrder.poItems.item.uom',
            'supplier',
            'department',
            'receiptItems.item.uom',
        ]);
        $requiredQuantities = collect($receipt->purchaseOrder?->poItems ?? [])
            ->mapWithKeys(fn ($item) => [
                (int) ($item->id ?? 0) => (int) ($item->quantity ?? 0),
            ])
            ->all();

        // receiptItems has one row per receiving EVENT (syncReceiptItems appends, never
        // updates in place) — the PDF should show one row per PRODUCT (a total overview),
        // not the raw log/event history, so take only the latest (highest id) row per product.
        $latestItemByProduct = [];
        foreach ($receipt->receiptItems as $item) {
            $existing = $latestItemByProduct[$item->product_id] ?? null;
            if (!$existing || $item->id > $existing->id) {
                $latestItemByProduct[$item->product_id] = $item;
            }
        }

        $items = collect($latestItemByProduct)
            ->values()
            ->map(function ($item) use ($requiredQuantities) {
                $required = $requiredQuantities[$item->po_item_id ?? 0] ?? 0;
                $received = (int) $item->received_quantity;

                return [
                    'item_code' => $item->item?->item_code ?? '-',
                    'product_name' => $item->item?->product_name ?? '-',
                    'uom' => $item->item?->uom?->name ?? '-',
                    'required_quantity' => $required,
                    'received_quantity' => $received,
                    'due_quantity' => max(0, $required - $received),
                    'remark' => $item->remark ?? '-',
                ];
            });

        $pdf = Pdf::loadView('pdf-templates.material-receipt', [
            'receipt' => $receipt,
            'items' => $items,
        ])->setPaper('A4', 'portrait');

        $filename = sprintf('%s.pdf', $receipt->custom_id ?? 'material-receipt');

        return response($pdf->output(), 200)
            ->header('Content-Type', 'application/pdf')
            ->header('Content-Disposition', 'inline; filename="' . $filename . '"');
    }

    private function validateRequest(Request $request): array
    {
        return $request->validate([
            'custom_id' => ['required', 'string', 'max:255'],
            'receipt_date' => ['required', 'date'],
            'remarks' => ['nullable', 'string'],
            'status' => ['nullable', 'string', 'in:PARTIAL,COMPLETED,CANCELLED'],
            'purchase_order_id' => ['nullable', 'integer', 'exists:purchase_orders,id'],
            'purchase_requisition_id' => ['nullable', 'integer', 'exists:purchase_requisitions,id'],
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'requested_by' => ['nullable', 'integer', 'exists:users,id'],
            'source' => ['nullable', 'string', 'max:50'],
            'invoice_no' => ['nullable', 'string', 'max:255'],
            'lc_no' => ['nullable', 'string', 'max:255'],
            'vehicle_no' => ['nullable', 'string', 'max:255'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.received_quantity' => ['nullable', 'integer', 'min:0'],
            'items.*.receiving_quantity' => ['required', 'integer', 'min:0'],
            'items.*.required_quantity' => ['nullable', 'integer', 'min:0'],
            'items.*.remark' => ['nullable', 'string'],
            'items.*.po_item_id' => ['nullable', 'integer', 'exists:purchase_order_items,id'],
        ]);
    }

    private function buildReceiptData(array $payload): array
    {
        $status = strtoupper((string) ($payload['status'] ?? ''));
        if ($status !== 'CANCELLED') {
            $status = $this->resolveReceiptStatus($payload['items']);
        }

        return [
            'custom_id' => $payload['custom_id'],
            'purchase_order_id' => $payload['purchase_order_id'] ?? null,
            'purchase_requisition_id' => $payload['purchase_requisition_id'] ?? null,
            'supplier_id' => $payload['supplier_id'],
            'department_id' => $payload['department_id'] ?? null,
            'requested_by' => $payload['requested_by'] ?? auth()->id(),
            'created_by' => auth()->id(),
            'source' => $payload['source'] ?? 'LOCAL',
            'invoice_no' => $payload['invoice_no'] ?? null,
            'lc_no' => $payload['lc_no'] ?? null,
            'vehicle_no' => $payload['vehicle_no'] ?? null,
            'receipt_date' => $this->normalizeReceiptDate($payload['receipt_date']),
            'remarks' => $payload['remarks'] ?? null,
            'status' => $status,
        ];
    }

    private function normalizeReceiptDate(string $receiptDate): string
    {
        $formats = ['d-m-Y', 'Y-m-d', 'Y-m-d H:i:s', DATE_ATOM];

        foreach ($formats as $format) {
            try {
                return Carbon::createFromFormat($format, $receiptDate)->toDateString();
            } catch (\Throwable) {
            }
        }

        return Carbon::parse($receiptDate)->toDateString();
    }

    private function resolveReceiptStatus(array $items): string
    {
        $totalRequired = collect($items)->sum(fn (array $item) => (int) ($item['required_quantity'] ?? 0));
        $totalCumulative = collect($items)->sum(
            fn (array $item) => (int) ($item['receiving_quantity'] ?? 0) + (int) ($item['received_quantity'] ?? 0)
        );

        if ($totalRequired > 0 && $totalCumulative < $totalRequired) {
            return 'PARTIAL';
        }

        return 'COMPLETED';
    }

    // Create-time only — no MaterialReceiptLog row, no stock increment, no PO-item
    // increment. Just the required-qty tracking shell, zero received.
    private function createReceiptItemsShell(MaterialReceipt $receipt, array $items): void
    {
        foreach ($items as $item) {
            MaterialReceiptItem::create([
                'material_receipt_id' => $receipt->id,
                'po_item_id' => $item['po_item_id'] ?? null,
                'product_id' => (int) $item['product_id'],
                'received_quantity' => 0,
                'previous_received_quantity' => 0,
                'remark' => $item['remark'] ?? null,
            ]);
        }
    }

    private function syncReceiptItems(MaterialReceipt $receipt, array $items, string $status): void
    {
        foreach ($items as $item) {
            $newlyReceiving = (int) ($item['receiving_quantity'] ?? 0);
            $previouslyReceived = (int) ($item['received_quantity'] ?? 0);
            $cumulativeReceived = $previouslyReceived + $newlyReceiving;
            $requiredQuantity = (int) ($item['required_quantity'] ?? 0);
            $productId = (int) $item['product_id'];
            $poItemId = $item['po_item_id'] ?? null;

            $receiptItem = MaterialReceiptItem::create([
                'material_receipt_id' => $receipt->id,
                'po_item_id' => $poItemId,
                'product_id' => $productId,
                'received_quantity' => $cumulativeReceived,
                'previous_received_quantity' => $previouslyReceived,
                'remark' => $item['remark'] ?? null,
            ]);

            // Increment by the DELTA (newlyReceiving), not the running cumulative total —
            // $poItem->received_quantity and $product->current_stock are both already-
            // cumulative counters, so adding the cumulative-to-date value on every call
            // would multiply-count everything received before this event.
            if ($poItemId && $status !== 'CANCELLED' && $newlyReceiving > 0) {
                PurchaseOrderItem::whereKey($poItemId)->increment('received_quantity', $newlyReceiving);
            }

            if ($status !== 'CANCELLED' && $newlyReceiving > 0) {
                $this->applyStockIncrease($receipt, $receiptItem, $newlyReceiving);

                $logPreviouslyReceived = MaterialReceiptLog::where('material_receipt_id', $receipt->id)
                    ->where('product_id', $productId)
                    ->sum('receiving_quantity');

                MaterialReceiptLog::create([
                    'material_receipt_id' => $receipt->id,
                    'product_id' => $productId,
                    'required_quantity' => $requiredQuantity,
                    'received_quantity' => (int) $logPreviouslyReceived + $newlyReceiving,
                    'receiving_quantity' => $newlyReceiving,
                    'remark' => $item['remark'] ?? null,
                    'received_by' => auth()->id(),
                ]);
            }
        }
    }

    private function applyStockIncrease(MaterialReceipt $receipt, MaterialReceiptItem $receiptItem, int $quantityDelta): void
    {
        $product = Product::find($receiptItem->product_id);

        if (!$product) {
            return;
        }

        $product->increment('current_stock', $quantityDelta);

        StockAdjustment::create([
            'product_id' => $product->id,
            'adjustment_quantity' => $quantityDelta,
            'created_by' => auth()->id(),
            'condition' => 'INCREASED',
            'reason' => 'MATERIAL_RECEIPT',
            'sectionable_type' => MaterialReceipt::class,
            'sectionable_id' => $receipt->id,
            'adjustment_date' => $receipt->receipt_date,
        ]);
    }

    private function markRequisitionCompleteIfNeeded(MaterialReceipt $receipt, string $status): void
    {
        if ($status === 'CANCELLED') {
            return;
        }

        $purchaseOrderId = $receipt->purchase_order_id;

        if ($purchaseOrderId) {
            // PO is complete only when every line item is fully received.
            $allItemsReceived = ! PurchaseOrderItem::where('purchase_order_id', $purchaseOrderId)
                ->whereColumn('received_quantity', '<', 'quantity')
                ->exists();

            if ($allItemsReceived) {
                PurchaseOrder::whereKey($purchaseOrderId)->update([
                    'is_complete' => true,
                    'status' => PoStatus::RECEIVED->value,
                ]);
            }
        }

        $sprId = $receipt->purchase_requisition_id
            ?? ($purchaseOrderId ? PurchaseOrder::find($purchaseOrderId)?->spr_id : null);

        if (! $sprId) {
            return;
        }

        // SPR is complete when at least one PO exists and every non-cancelled PO is fully received.
        $hasActivePOs = PurchaseOrder::where('spr_id', $sprId)
            ->whereNotIn('status', ['CANCELED', 'CANCELLED'])
            ->exists();

        $allPosDone = $hasActivePOs && ! PurchaseOrder::where('spr_id', $sprId)
            ->whereNotIn('status', ['CANCELED', 'CANCELLED'])
            ->where('is_complete', false)
            ->exists();

        if ($allPosDone) {
            PurchaseRequisition::whereKey($sprId)->update(['is_complete' => true]);
        }
    }

    private function defaultRelations(): array
    {
        return [
            'requestBy',
            'department',
            'supplier',
            'purchaseOrder.requisition',
            'purchaseOrder.poItems.item',
            'requisition',
            'receiptItems.item',
        ];
    }
}
