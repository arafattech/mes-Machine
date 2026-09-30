<?php

namespace App\Services\Sales;


use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

use App\Models\SalesOrder;
use App\Models\SaleOrderItem;
use App\Models\Client;
use App\Models\Product;

class InvoiceService
{
    public function generatePIPDF(Request $request)
    {
        $validated = $request->validate([
            'order_id' => 'nullable|integer',
        ]);

        try {
            $order_id = $validated['order_id'] ?? null;
            $template = 'invoice';

            $salesOrder = SalesOrder::with(['client', 'items'])->find($order_id);

            if (!$salesOrder) {
                return response()->json(['error' => 'Sales order not found'], 404);
            }

            $client = Client::find($salesOrder->client_id);
            if (!$client) {
                return response()->json(['error' => 'Client not found'], 404);
            }

            $orderitems = SaleOrderItem::where('sales_order_id', $salesOrder->id)->get()->toArray();
            if (!$orderitems) {
                return response()->json(['error' => 'Items not found'], 404);
            }
            $items = Product::WhereIn('id', array_column($orderitems, 'product_id'))->get()->toArray();

            if (!$items) {
                return response()->json(['error' => 'Items not found'], 404);
            }

            $data = [
                'order_no' => $salesOrder->order_no,
                'custom_id' => $salesOrder->custom_id,
                'order_date' => $salesOrder->order_date,
                'vat' => $salesOrder->vat,
                'discount' => $salesOrder->discount_amount,
                'subtotal' => $salesOrder->subtotal,
                'discount_option' => $salesOrder->discount_option,
                'grand_total' => $salesOrder->grand_total,
                'paid_amount' => $salesOrder->paid_amount,
                'note' => $salesOrder->note,
                'status' => $salesOrder->status,
                'client_name' => $salesOrder->client->name,
                'client_email' => $salesOrder->client->email,
                'bill_to' => $salesOrder->client->bill_to,
                'ship_to' => $salesOrder->client->ship_to,
                'items' => $salesOrder->items, 
                'total_price' => $salesOrder->items->sum(function ($item) {
                    return $item->quantity * $item->unit_price;
                }),
            ];

            $viewPath = "pdf-templates.{$template}";
            if (!view()->exists($viewPath)) {
                return response()->json(['error' => "Template not found: {$template}"], 404);
            }

            try {
                $pdf = Pdf::loadView($viewPath, ['data' => $data])->setPaper('A4', 'portrait');
            } catch (\Exception $e) {
                Log::error("DomPDF generation failed: " . $e->getMessage());
                return response()->json(['error' => 'Failed to generate PDF: ' . $e->getMessage()], 500);
            }

            $filename = "invoice.pdf";

            return response($pdf->output(), 200)
                ->header('Content-Type', 'application/pdf')
                ->header('Content-Disposition', 'attachment; filename="' . $filename . '"');
        } catch (\Exception $e) {
            Log::error("PDF generation failed: " . $e->getMessage() . "\n" . $e->getTraceAsString());
            return response()->json(['error' => 'Failed to generate PDF: ' . $e->getMessage()], 500);
        }
    }
}
