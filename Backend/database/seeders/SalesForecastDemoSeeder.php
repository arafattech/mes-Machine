<?php

namespace Database\Seeders;

use App\Models\Product;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SalesForecastDemoSeeder extends Seeder
{
    private const MONTHS_OF_HISTORY = 24;
    private const PRODUCT_SAMPLE_SIZE = 30;

    public function run(): void
    {
        $products = Product::query()
            ->orderBy('id')
            ->limit(self::PRODUCT_SAMPLE_SIZE)
            ->get(['id']);

        if ($products->isEmpty()) {
            $this->command?->warn('No products found — skipping sales forecast demo seed.');
            return;
        }

        Product::whereIn('id', $products->pluck('id'))->update([
            'is_active' => true,
            'is_sellable' => true,
        ]);

        $clientId = DB::table('clients')->value('id');
        $trends = ['declining', 'growing', 'stable'];
        $now = Carbon::now()->startOfMonth();

        foreach ($products as $index => $product) {
            $trend = $trends[$index % count($trends)];
            $baseQty = random_int(80, 400);
            $unitPrice = round(random_int(1000, 50000) / 100, 2);

            for ($monthsAgo = self::MONTHS_OF_HISTORY - 1; $monthsAgo >= 0; $monthsAgo--) {
                $orderDate = (clone $now)->subMonths($monthsAgo);
                $qty = $this->quantityForMonth($baseQty, $trend, self::MONTHS_OF_HISTORY - 1 - $monthsAgo);
                $totalPrice = round($qty * $unitPrice, 2);

                $salesOrderId = DB::table('sales_orders')->insertGetId([
                    'client_id' => $clientId,
                    'order_no' => sprintf('DEMO-SO-%d-%d', $product->id, $monthsAgo),
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

        $this->command?->info(sprintf(
            '%d months of demo sales history seeded for %d products.',
            self::MONTHS_OF_HISTORY,
            $products->count()
        ));
    }

    private function quantityForMonth(int $baseQty, string $trend, int $monthIndex): int
    {
        $noise = random_int(-10, 10) / 100;

        $trendFactor = match ($trend) {
            'declining' => max(0.15, 1 - ($monthIndex * 0.03)),
            'growing' => 1 + ($monthIndex * 0.025),
            default => 1.0,
        };

        $seasonal = 1 + (0.1 * sin($monthIndex / 2));

        return max(1, (int) round($baseQty * $trendFactor * $seasonal * (1 + $noise)));
    }
}
