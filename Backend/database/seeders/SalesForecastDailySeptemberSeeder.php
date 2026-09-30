<?php

namespace Database\Seeders;

use App\Models\Product;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * September 2026 currently has a single order per product (from
 * SalesForecastFillYear2026Seeder), so the daily candlestick view has
 * nothing to show for that month. This redistributes each product's
 * existing September total across ~10 days (same day-weighted, sum-
 * preserving approach as SalesForecastCandleFixSeeder) so daily OHLC has
 * real variation without disturbing the monthly trend total.
 */
class SalesForecastDailySeptemberSeeder extends Seeder
{
    private const NOTE = 'Sales forecast demo data';
    private const MONTH = 9;
    private const ORDERS_PER_MONTH = 10;

    public function run(): void
    {
        $products = Product::query()
            ->where('is_active', true)
            ->where('is_sellable', true)
            ->orderBy('id')
            ->get(['id']);

        $clientId = DB::table('clients')->value('id');
        $fixed = 0;

        foreach ($products as $product) {
            $monthTotal = $this->existingMonthlyTotal($product->id);
            if ($monthTotal <= 0) {
                continue;
            }

            $unitPrice = round(random_int(1000, 50000) / 100, 2);

            $this->deleteExistingOrders($product->id);
            $this->insertDistributedOrders($product->id, $monthTotal, $unitPrice, $clientId);
            $fixed++;
        }

        $this->command?->info(sprintf('Spread September 2026 sales across daily orders for %d products.', $fixed));
    }

    private function existingMonthlyTotal(int $productId): int
    {
        return (int) DB::table('sale_order_items')
            ->join('sales_orders', 'sales_orders.id', '=', 'sale_order_items.sales_order_id')
            ->where('sales_orders.note', self::NOTE)
            ->where('sale_order_items.product_id', $productId)
            ->whereMonth('sales_orders.order_date', self::MONTH)
            ->whereYear('sales_orders.order_date', 2026)
            ->sum('sale_order_items.quantity');
    }

    private function deleteExistingOrders(int $productId): void
    {
        $orderIds = DB::table('sales_orders')
            ->join('sale_order_items', 'sale_order_items.sales_order_id', '=', 'sales_orders.id')
            ->where('sales_orders.note', self::NOTE)
            ->where('sale_order_items.product_id', $productId)
            ->whereMonth('sales_orders.order_date', self::MONTH)
            ->whereYear('sales_orders.order_date', 2026)
            ->pluck('sales_orders.id');

        if ($orderIds->isEmpty()) {
            return;
        }

        DB::table('sale_order_items')->whereIn('sales_order_id', $orderIds)->delete();
        DB::table('sales_orders')->whereIn('id', $orderIds)->delete();
    }

    private function insertDistributedOrders(int $productId, int $monthTotal, float $unitPrice, ?int $clientId): void
    {
        $monthStart = Carbon::create(2026, self::MONTH, 1)->startOfMonth();
        $daysInMonth = $monthStart->daysInMonth;
        $orderCount = min(self::ORDERS_PER_MONTH, $daysInMonth);

        $days = range(1, $daysInMonth);
        shuffle($days);
        $days = array_slice($days, 0, $orderCount);
        sort($days);

        $weights = [];
        foreach (range(0, $orderCount - 1) as $i) {
            $wave = sin(($i / max(1, $orderCount - 1)) * M_PI * 2) * 0.4;
            $noise = random_int(-10, 10) / 100;
            $weights[] = max(0.1, 1 + $wave + $noise);
        }
        $weightSum = array_sum($weights);

        $remaining = $monthTotal;
        foreach ($days as $index => $day) {
            $isLast = $index === count($days) - 1;
            $qty = $isLast
                ? max(1, $remaining)
                : max(1, (int) round($monthTotal * ($weights[$index] / $weightSum)));
            $qty = min($qty, max(1, $remaining - (count($days) - $index - 1)));
            $remaining -= $qty;

            $orderDate = (clone $monthStart)->day($day);
            $totalPrice = round($qty * $unitPrice, 2);

            $salesOrderId = DB::table('sales_orders')->insertGetId([
                'client_id' => $clientId,
                'order_no' => sprintf('DEMO-SO-DAILY-%d-%d', $productId, $day),
                'order_date' => $orderDate->toDateString(),
                'status' => 'APPROVED',
                'subtotal' => $totalPrice,
                'paid_amount' => $totalPrice,
                'due_amount' => 0,
                'note' => self::NOTE,
                'created_at' => $orderDate,
                'updated_at' => $orderDate,
            ]);

            DB::table('sale_order_items')->insert([
                'sales_order_id' => $salesOrderId,
                'product_id' => $productId,
                'quantity' => $qty,
                'unit_price' => $unitPrice,
                'minimum_unit_price' => $unitPrice,
                'total_price' => $totalPrice,
                'status' => 'APPROVED',
                'created_at' => $orderDate,
                'updated_at' => $orderDate,
            ]);
        }
    }
}
