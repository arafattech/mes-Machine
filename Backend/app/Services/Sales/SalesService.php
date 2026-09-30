<?php

namespace App\Services\Sales;

use App\Models\ItemPricePlanning;
use App\Models\Sales\SaleOrder;
use App\Models\Sales\SaleOrderItem;
use App\Models\Product;
use App\Models\SaleOrderItem as ModelsSaleOrderItem;
use App\Models\SalesOrder;
use App\Models\User;
use Illuminate\Support\Str;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SalesService
{


    public function createSaleOrder(array $data)
    {
        $items = $data['items'] ?? [];

        if (empty($items)) {
            throw new \Exception('No items provided.');
        }

        $warnings = [];
        foreach ($items as $item) {
            $plan = ItemPricePlanning::where('product_id', $item['id'])
                ->where('is_active', true)
                ->whereDate('start_date', '<=', now())
                ->where(function ($q) {
                    $q->whereDate('end_date', '>=', now())
                        ->orWhereNull('end_date');
                })
                ->orderBy('start_date', 'desc')
                ->first();

            if ($plan && ($item['received_quantity'] ?? 0) < $plan->price) {
                $warnings[] = [
                    'product_id' => $item['id'],
                    'product_name' => $item['product_name'],
                    'item_code' => $item['item_code'],
                    'received_quantity' => $item['received_quantity'],
                    'price_plan' => $plan->price,
                    'message' => "Price is lower than price plan."
                ];
            }
        }

        if (!empty($warnings)) {
            return response()->json([
                'success' => false,
                'message' => 'Price validation failed.',
                'warnings' => $warnings
            ], 422);
        }

        return DB::transaction(function () use ($data, $items) {
            $requestedStatus = $data['status'] ?? 'PENDING';
            $order = SalesOrder::create([
                'client_id' => $data['client_id'] ?? null,
                'order_no' => 'PI-' . Str::upper(Str::random(8)),
                'status' => $requestedStatus === 'APPROVED' ? 'PENDING' : $requestedStatus,
                'subtotal' => $data['subtotal'] ?? 0,
                'grand_total' => $data['grand_total'] ?? 0,
                'paid_amount' => $data['paid_amount'] ?? 0,
                'due_amount' => $data['due_amount'] ?? 0,
                'note' => $data['note'] ?? null,
                'vat' => $data['vat'] ?? 0,
                'expected_delivery_date' => $data['expected_delivery_date'] ?? null,
                'discount_amount' => $data['discount_amount'] ?? null,
                'discount_type' => $data['discount_type'] ?? null,
                'discount' => $data['discount'] ?? null,
                'discount_option' => $data['discount_option'] ?? null,
                
                'created_by' => auth()->user()->id
            ]);

            foreach ($items as $item) {
                ModelsSaleOrderItem::create([
                    'sales_order_id'     => $order->id,
                    'product_id'         => $item['id'],
                    'quantity'           => $item['quantity'],
                    'unit_price'         => $item['received_quantity'] ?? 0,
                    'minimum_unit_price' => $item['min_price'] ?? 0,
                    'total_price'        => ($item['total_price'] ?? 0),
                    'status'             => $item['status'] ?? 'PENDING',
                    'discount'          => $item['discount'] ?? 0,
                    'discount_type'        => $item['discount_type'] ?? '',
                    'discount_amount'      => $item['discount_amount'] ?? 0,

                ]);
            }

            if ($requestedStatus === 'APPROVED') {
                $order->update(['status' => 'APPROVED']);
            }

            return $order->load('items');
        });
    }


    public function updateSaleOrder($id, array $data)
    {
        $order = SalesOrder::with('items')->findOrFail($id);

        $order->client_id   = $data['client_id']   ?? $order->client_id;
        $order->order_date  = $data['order_date']  ?? $order->order_date;
        $order->grand_total = $data['grand_total'] ?? $order->grand_total;
        $order->subtotal    = $data['subtotal']    ?? $order->subtotal;
        $order->vat         = $data['vat']         ?? $order->vat;
        $order->note        = $data['note']        ?? $order->note;
        $order->discount_amount = $data['discount_amount'] ?? $order->discount_amount;
        $order->discount_type   = $data['discount_type']   ?? $order->discount_type;
        $order->discount        = $data['discount']        ?? $order->discount;
        $order->discount_option = $data['discount_option'] ?? $order->discount_option;
        $order->expected_delivery_date = $data['expected_delivery_date'] ?? $order->expected_delivery_date ?? null;

        $order->save();

        $incomingProductIds = collect($data['items'])->pluck('product_id')->toArray();
        ModelsSaleOrderItem::where('sales_order_id', $order->id)
            ->whereNotIn('product_id', $incomingProductIds)
            ->delete();

        $warnings = [];

        foreach ($data['items'] as $item) {

            $plan = ItemPricePlanning::where('product_id', $item['product_id'])
                ->where('is_active', true)
                ->whereDate('start_date', '<=', now())
                ->where(function ($q) {
                    $q->whereDate('end_date', '>=', now())
                        ->orWhereNull('end_date');
                })
                ->orderBy('start_date', 'desc')
                ->first();

            if ($plan && ($item['received_quantity'] ?? 0) < $plan->price) {
                $warnings[] = [
                    'product_id'   => $item['product_id'],
                    'product_name' => $item['product_name'],
                    'item_code'    => $item['item_code'],
                    'unit_price'   => $item['unit_price'],
                    'price_plan'   => $plan->price,
                    'message'      => "Price is lower than the allowed price plan."
                ];
            }
        }

        if (!empty($warnings)) {
            return response()->json([
                'success'  => false,
                'message'  => 'Price validation failed.',
                'warnings' => $warnings
            ], 422);
        }

        foreach ($data['items'] as $item) {
            ModelsSaleOrderItem::updateOrCreate(
                [
                    'sales_order_id' => $order->id,
                    'product_id'     => $item['product_id'],
                ],
                [
                    'quantity'    => $item['quantity'],
                    'unit_price'  => $item['received_quantity'] ?? 0,
                    'total_price' => $item['total_price'],
                    'discount'          => $item['discount'] ?? 0,
                    'discount_type'     => $item['discount_type'] ?? '',
                    'discount_amount'   => $item['discount_amount'] ?? 0,
                ]
            );
        }

        return $order->refresh();
    }

    public function getUserMarketPriceItem(int $id)
    {
        try {
            $today = Carbon::today()->toDateString();

            $user = User::query()->find($id);

            $products = Product::query()
                ->where('is_sellable', true)
                ->whereNotIn('id', function ($query) use ($id, $today) {
                    $query->select('product_id')
                        ->from('market_prices')
                        ->where('created_by', $id)
                        ->whereDate('created_at', $today);
                })
                ->with(['category:id,name', 'uom:id,name'])
                ->get();

            return response()->json([
                'success'     => true,
                'sales_user'  => $user,
                'total_item'  => $products->count(),
                'items'       => $products,
            ]);

        } catch (\Throwable $e) {

            Log::error('getUserMarketPriceItem failed', [
                'user_id' => $id,
                'error'   => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Something went wrong while fetching market price items',
            ], 500);
        }
    }
}
