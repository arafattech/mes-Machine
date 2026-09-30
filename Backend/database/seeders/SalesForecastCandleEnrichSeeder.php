<?php

namespace Database\Seeders;

use App\Models\Product;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SalesForecastCandleEnrichSeeder extends Seeder
{
    private const ENRICH_MONTHS = [7, 8];
    private const ORDERS_PER_MONTH = 12;

    public function run(): void
    {
        $products = Product::query()
            ->where('is_active', true)
            ->where('is_sellable', true)
            ->orderBy('id')
            ->get(['id']);

        if ($products->isEmpty()) {
            $this->command?->warn('No sellable products found — run SalesForecastDemoSeeder first.');
            return;
        }

        $clientId = DB::table('clients')->value('id');
        $now = Carbon::now();

        foreach ($products as $index => $product) {
            $unitPrice = round(random_int(1000, 50000) / 100, 2);
            $baseQty = random_int(80, 400);

            foreach (self::ENRICH_MONTHS as $month) {
                $monthStart = Carbon::create($now->year, $month, 1)->startOfMonth();
                $daysInMonth = $monthStart->daysInMonth;
                $orderDays = $this->pickRandomDays($daysInMonth, self::ORDERS_PER_MONTH);

                foreach ($orderDays as $orderIndex => $day) {
                    $orderDate = (clone $monthStart)->day($day);
                    $qty = $this->quantityForOrder($baseQty, $orderIndex, self::ORDERS_PER_MONTH);
                    $totalPrice = round($qty * $unitPrice, 2);

                    $salesOrderId = DB::table('sales_orders')->insertGetId([
                        'client_id' => $clientId,
                        'order_no' => sprintf('DEMO-CANDLE-SO-%d-%d-%d', $product->id, $month, $day),
                        'order_date' => $orderDate->toDateString(),
                        'status' => 'APPROVED',
                        'subtotal' => $totalPrice,
                        'paid_amount' => $totalPrice,
                        'due_amount' => 0,
                        'note' => 'Sales forecast candle demo data',
                        'created_at' => $orderDate,
                        'updated_at' => $orderDate,
                    ]);

                    DB::table('sale_order_items')->insert([
                        'sales_order_id' => $salesOrderId,
                        'product_id' => $product->id,
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

        $this->command?->info(sprintf(
            'Candle demo data enriched for %d products across months: %s.',
            $products->count(),
            implode(', ', self::ENRICH_MONTHS)
        ));
    }

    private function pickRandomDays(int $daysInMonth, int $count): array
    {
        $days = range(1, $daysInMonth);
        shuffle($days);
        $picked = array_slice($days, 0, min($count, $daysInMonth));
        sort($picked);

        return $picked;
    }

    private function quantityForOrder(int $baseQty, int $orderIndex, int $totalOrders): int
    {
        $wave = sin(($orderIndex / max(1, $totalOrders - 1)) * M_PI * 2) * 0.35;
        $noise = random_int(-15, 15) / 100;

        return max(1, (int) round($baseQty * (1 + $wave + $noise)));
    }
}
