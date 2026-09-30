<?php

namespace Database\Seeders;

use App\Models\Product;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * SalesForecastDemoSeeder only fills the trailing 24 months counting back
 * from whenever it was run, leaving the rest of the current calendar year
 * (Sep-Dec 2026, since the seeder ran in August) empty. That makes month
 * selection past August look like a hard cliff instead of a forecast. This
 * seeder continues each product's own existing trend (extrapolated from its
 * last 3 real months) forward through December 2026, so switching to any
 * month in 2026 has real history behind it.
 */
class SalesForecastFillYear2026Seeder extends Seeder
{
    private const NOTE = 'Sales forecast demo data';
    private const MONTHS_TO_FILL = [9, 10, 11, 12];
    private const TREND_BASIS_MONTHS = [6, 7, 8];

    public function run(): void
    {
        $products = Product::query()
            ->where('is_active', true)
            ->where('is_sellable', true)
            ->orderBy('id')
            ->get(['id']);

        $clientId = DB::table('clients')->value('id');
        $filled = 0;

        foreach ($products as $product) {
            $basisQty = $this->monthlyQuantities($product->id, self::TREND_BASIS_MONTHS);
            if (count(array_filter($basisQty)) < 2) {
                continue; // not enough history to extrapolate from
            }

            $ratio = $this->averageMonthOverMonthRatio($basisQty);
            $unitPrice = round(random_int(1000, 50000) / 100, 2);
            $lastQty = end($basisQty);

            foreach (self::MONTHS_TO_FILL as $month) {
                if ($this->monthAlreadySeeded($product->id, $month)) {
                    continue;
                }

                $noise = random_int(-8, 8) / 100;
                $lastQty = max(1, (int) round($lastQty * $ratio * (1 + $noise)));

                $this->insertMonthlyOrder($product->id, $month, $lastQty, $unitPrice, $clientId);
                $filled++;
            }
        }

        $this->command?->info(sprintf(
            'Filled %d product-months of 2026 forecast history (Sep-Dec).',
            $filled
        ));
    }

    private function monthlyQuantities(int $productId, array $months): array
    {
        $totals = DB::table('sale_order_items')
            ->join('sales_orders', 'sales_orders.id', '=', 'sale_order_items.sales_order_id')
            ->where('sales_orders.note', self::NOTE)
            ->where('sale_order_items.product_id', $productId)
            ->whereYear('sales_orders.order_date', 2026)
            ->whereIn(DB::raw('MONTH(sales_orders.order_date)'), $months)
            ->selectRaw('MONTH(sales_orders.order_date) as m, SUM(sale_order_items.quantity) as qty')
            ->groupBy('m')
            ->pluck('qty', 'm');

        return array_map(fn ($month) => (int) ($totals[$month] ?? 0), $months);
    }

    private function averageMonthOverMonthRatio(array $quantities): float
    {
        $ratios = [];
        for ($i = 1; $i < count($quantities); $i++) {
            if ($quantities[$i - 1] > 0) {
                $ratios[] = $quantities[$i] / $quantities[$i - 1];
            }
        }

        if (empty($ratios)) {
            return 1.0;
        }

        return max(0.5, min(1.5, array_sum($ratios) / count($ratios)));
    }

    private function monthAlreadySeeded(int $productId, int $month): bool
    {
        return DB::table('sale_order_items')
            ->join('sales_orders', 'sales_orders.id', '=', 'sale_order_items.sales_order_id')
            ->where('sales_orders.note', self::NOTE)
            ->where('sale_order_items.product_id', $productId)
            ->whereYear('sales_orders.order_date', 2026)
            ->whereRaw('MONTH(sales_orders.order_date) = ?', [$month])
            ->exists();
    }

    private function insertMonthlyOrder(int $productId, int $month, int $qty, float $unitPrice, ?int $clientId): void
    {
        $orderDate = Carbon::create(2026, $month, random_int(1, 28));
        $totalPrice = round($qty * $unitPrice, 2);

        $salesOrderId = DB::table('sales_orders')->insertGetId([
            'client_id' => $clientId,
            'order_no' => sprintf('DEMO-SO-FILL-%d-%d', $productId, $month),
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
