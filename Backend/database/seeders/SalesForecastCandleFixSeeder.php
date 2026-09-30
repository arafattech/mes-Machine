<?php

namespace Database\Seeders;

use App\Models\Product;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * The earlier SalesForecastCandleEnrichSeeder ADDED ~12 extra orders per
 * product on top of the existing single monthly order for July/August 2026,
 * inflating those two months' totals far above the surrounding 24-month
 * trend. That spike fed straight into Prophet's forecast and made every
 * product classify as "high risk" for any month whose window includes it.
 * This seeder replaces both the original single order and the enrichment
 * orders with a day-spread set of orders whose quantities sum back to the
 * original monthly trend total — same daily variation for candlesticks,
 * without corrupting the monthly aggregate.
 */
class SalesForecastCandleFixSeeder extends Seeder
{
    private const FIX_MONTHS = [7, 8];
    private const ORDERS_PER_MONTH = 10;

    public function run(): void
    {
        $products = Product::query()
            ->where('is_active', true)
            ->where('is_sellable', true)
            ->orderBy('id')
            ->get(['id']);

        $clientId = DB::table('clients')->value('id');
        $now = Carbon::now();
        $fixedCount = 0;

        foreach ($products as $product) {
            $unitPrice = round(random_int(1000, 50000) / 100, 2);

            foreach (self::FIX_MONTHS as $month) {
                $monthTotal = $this->originalMonthlyTotal($product->id, $month);
                if ($monthTotal <= 0) {
                    continue;
                }

                $this->deleteDemoOrders($product->id, $month, 'Sales forecast demo data');
                $this->deleteDemoOrders($product->id, $month, 'Sales forecast candle demo data');

                $this->insertDistributedOrders($product->id, $month, $monthTotal, $unitPrice, $clientId);
                $fixedCount++;
            }
        }

        $this->command?->info(sprintf(
            'Rebalanced candle demo data for %d product-months (July/August 2026 totals restored to trend).',
            $fixedCount
        ));
    }

    private function originalMonthlyTotal(int $productId, int $month): int
    {
        return (int) DB::table('sale_order_items')
            ->join('sales_orders', 'sales_orders.id', '=', 'sale_order_items.sales_order_id')
            ->where('sales_orders.note', 'Sales forecast demo data')
            ->where('sale_order_items.product_id', $productId)
            ->whereMonth('sales_orders.order_date', $month)
            ->whereYear('sales_orders.order_date', 2026)
            ->sum('sale_order_items.quantity');
    }

    private function deleteDemoOrders(int $productId, int $month, string $note): void
    {
        $orderIds = DB::table('sales_orders')
            ->join('sale_order_items', 'sale_order_items.sales_order_id', '=', 'sales_orders.id')
            ->where('sales_orders.note', $note)
            ->where('sale_order_items.product_id', $productId)
            ->whereMonth('sales_orders.order_date', $month)
            ->whereYear('sales_orders.order_date', 2026)
            ->pluck('sales_orders.id');

        if ($orderIds->isEmpty()) {
            return;
        }

        DB::table('sale_order_items')->whereIn('sales_order_id', $orderIds)->delete();
        DB::table('sales_orders')->whereIn('id', $orderIds)->delete();
    }

    private function insertDistributedOrders(
        int $productId,
        int $month,
        int $monthTotal,
        float $unitPrice,
        ?int $clientId
    ): void {
        $monthStart = Carbon::create(2026, $month, 1)->startOfMonth();
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
                'order_no' => sprintf('DEMO-CANDLE-FIX-%d-%d-%d', $productId, $month, $day),
                'order_date' => $orderDate->toDateString(),
                'status' => 'APPROVED',
                'subtotal' => $totalPrice,
                'paid_amount' => $totalPrice,
                'due_amount' => 0,
                'note' => 'Sales forecast demo data',
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
