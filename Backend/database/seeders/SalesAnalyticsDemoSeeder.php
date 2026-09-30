<?php

namespace Database\Seeders;

use App\Models\Product;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SalesAnalyticsDemoSeeder extends Seeder
{
    private const CLIENT_NAMES = [
        'Anchor Textiles Ltd', 'Bengal Garments Co', 'Crescent Apparel Group',
        'Delta Fabrics International', 'Evergreen Knitwear', 'Falcon Sourcing Ltd',
        'Golden Thread Exports', 'Harbor Fashion House', 'Ivory Cotton Mills',
        'Jasmine Textile Trading', 'Kingfisher Garments', 'Lotus Apparel Ltd',
        'Meridian Clothing Co', 'Northstar Fabrics', 'Orchid Fashion Group',
        'Pinnacle Sourcing Ltd', 'Quantum Textile Solutions', 'Riverside Knits',
        'Summit Garments International', 'Tradewind Apparel Co',
    ];

    private const STATUS_WEIGHTS = [
        'APPROVED' => 60,
        'PENDING' => 20,
        'DRAFT' => 12,
        'REJECTED' => 8,
    ];

    public function run(): void
    {
        $clientIds = $this->seedClients();
        $productIds = Product::query()->where('is_active', true)->inRandomOrder()->limit(200)->pluck('id')->all();

        if (empty($productIds)) {
            $this->command?->warn('No active products found — skipping sales analytics demo seed.');
            return;
        }

        $now = Carbon::now();
        $totalOrders = 0;

        for ($monthsAgo = 32; $monthsAgo >= 0; $monthsAgo--) {
            $monthStart = (clone $now)->subMonths($monthsAgo)->startOfMonth();
            $ordersThisMonth = $this->orderVolumeForMonth($monthsAgo);

            for ($i = 0; $i < $ordersThisMonth; $i++) {
                $this->createDemoOrder($monthStart, $clientIds, $productIds, $now, $monthsAgo, $i);
                $totalOrders++;
            }
        }

        $this->seedMarketPrices($productIds, $now);

        $this->command?->info(sprintf(
            '%d demo sales orders seeded across %d clients (2024-2026).',
            $totalOrders,
            count($clientIds)
        ));
    }

    private function seedClients(): array
    {
        $existingNames = DB::table('clients')->pluck('name')->all();
        $now = Carbon::now();
        $ids = [];

        foreach (self::CLIENT_NAMES as $name) {
            if (in_array($name, $existingNames, true)) {
                $id = DB::table('clients')->where('name', $name)->value('id');
                $ids[] = $id;
                continue;
            }

            $ids[] = DB::table('clients')->insertGetId([
                'name' => $name,
                'is_active' => true,
                'email' => strtolower(str_replace(' ', '.', $name)) . '@example.com',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        return $ids;
    }

    private function orderVolumeForMonth(int $monthsAgo): int
    {
        if ($monthsAgo >= 21) {
            return random_int(8, 15); // 2024
        }
        if ($monthsAgo >= 9) {
            return random_int(12, 20); // 2025
        }
        return random_int(20, 35); // 2026, heavier toward the trailing 6-month dashboard window
    }

    private function createDemoOrder(
        Carbon $monthStart,
        array $clientIds,
        array $productIds,
        Carbon $now,
        int $monthsAgo,
        int $orderIndex
    ): void {
        $daysInMonth = min($monthStart->daysInMonth, $monthsAgo === 0 ? max(1, $now->day) : $monthStart->daysInMonth);
        $orderDate = (clone $monthStart)->addDays(random_int(0, max(0, $daysInMonth - 1)));
        $status = $this->weightedStatus();
        $clientId = $clientIds[array_rand($clientIds)];

        $itemCount = random_int(1, 3);
        $items = [];
        $subtotal = 0;

        for ($j = 0; $j < $itemCount; $j++) {
            $productId = $productIds[array_rand($productIds)];
            $quantity = random_int(5, 200);
            $unitPrice = round(random_int(500, 30000) / 100, 2);
            $totalPrice = round($quantity * $unitPrice, 2);
            $subtotal += $totalPrice;

            $items[] = [
                'product_id' => $productId,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'minimum_unit_price' => $unitPrice,
                'total_price' => $totalPrice,
            ];
        }

        $vat = round($subtotal * 0.05, 2);
        $grandTotal = round($subtotal + $vat, 2);
        $expectedDelivery = (clone $orderDate)->addDays(random_int(7, 30));

        $salesOrderId = DB::table('sales_orders')->insertGetId([
            'client_id' => $clientId,
            'order_no' => sprintf('DEMO-ANL-%d-%d-%d', $monthsAgo, $orderIndex, random_int(1000, 9999)),
            'order_date' => $orderDate->toDateString(),
            'expected_delivery_date' => $expectedDelivery,
            'status' => $status,
            'subtotal' => $subtotal,
            'vat' => $vat,
            'grand_total' => $grandTotal,
            'paid_amount' => $status === 'APPROVED' ? $subtotal : 0,
            'due_amount' => $status === 'APPROVED' ? 0 : $subtotal,
            'note' => 'Sales analytics demo data',
            'created_at' => $orderDate,
            'updated_at' => $orderDate,
        ]);

        foreach ($items as $item) {
            DB::table('sale_order_items')->insert(array_merge($item, [
                'sales_order_id' => $salesOrderId,
                'status' => $status,
                'created_at' => $orderDate,
                'updated_at' => $orderDate,
            ]));
        }
    }

    private function weightedStatus(): string
    {
        $roll = random_int(1, 100);
        $cumulative = 0;

        foreach (self::STATUS_WEIGHTS as $status => $weight) {
            $cumulative += $weight;
            if ($roll <= $cumulative) {
                return $status;
            }
        }

        return 'APPROVED';
    }

    private function seedMarketPrices(array $productIds, Carbon $now): void
    {
        $priceProducts = array_slice($productIds, 0, 15);

        foreach ($priceProducts as $productId) {
            $basePrice = round(random_int(500, 30000) / 100, 2);

            for ($daysAgo = 44; $daysAgo >= 0; $daysAgo--) {
                $date = (clone $now)->subDays($daysAgo);
                $drift = 1 + (sin($daysAgo / 5) * 0.08) + (random_int(-3, 3) / 100);
                $price = max(1, round($basePrice * $drift, 2));

                DB::table('market_prices')->insert([
                    'product_id' => $productId,
                    'unit_price' => $price,
                    'created_by' => 1,
                    'created_at' => $date,
                    'updated_at' => $date,
                ]);
            }
        }
    }
}
