<?php

namespace App\Services\Sales;

use App\Models\MarketPrice;
use Illuminate\Support\Facades\DB;
use Exception;
use Carbon\Carbon;
class SalesAnalyticsService
{
    public function getSalesAnalysis(
        $startDate = null,
        $endDate = null,
        $clientId = null,
        $status = null
    ) {
        $baseQuery = DB::table('sales_orders')
            ->when($startDate, fn ($q) =>
                $q->whereDate('sales_orders.created_at', '>=', $startDate)
            )
            ->when($endDate, fn ($q) =>
                $q->whereDate('sales_orders.created_at', '<=', $endDate)
            )
            ->when($clientId, fn ($q) =>
                $q->where('sales_orders.client_id', $clientId)
            )
            ->when($status, fn ($q) =>
                $q->where('sales_orders.status', $status)
            );

        /** =======================
         * KPI DATA (Single Query)
         * ======================= */
        $kpi = (clone $baseQuery)
            ->selectRaw("
                COUNT(*) as total_orders,
                SUM(status = 'APPROVED') as total_sales,
                SUM(status = 'REJECTED') as total_rejection,
                SUM(subtotal) as total_order_amount,
                SUM(CASE WHEN status = 'APPROVED' THEN subtotal ELSE 0 END) as total_approved_amount,
                SUM(CASE WHEN status = 'DRAFT' THEN subtotal ELSE 0 END) as total_draft_amount
            ")
            ->first();

        /** =======================
         * MONTHLY SALES (SQL GROUPING)
         * ======================= */
        $monthlySalesRaw = (clone $baseQuery)
            ->selectRaw("
                DATE_FORMAT(created_at, '%Y-%m') as month_key,
                DATE_FORMAT(created_at, '%b-%Y') as month,
                SUM(subtotal) as amount
            ")
            ->groupBy('month_key', 'month')
            ->orderBy('month_key')
            ->get()
            ->keyBy('month');

        $monthlySales = collect(range(5, 0))->map(function ($i) use ($monthlySalesRaw) {
            $month = now()->subMonths($i)->format('M-Y');
            return [
                'month'  => $month,
                'amount' => (float) ($monthlySalesRaw[$month]->amount ?? 0),
            ];
        });

        /** =======================
         * STATUS BREAKDOWN
         * ======================= */
        $statusBreakdown = (clone $baseQuery)
            ->select('status', DB::raw('COUNT(*) as count'))
            ->groupBy('status')
            ->get();

        $totalStatus = $statusBreakdown->sum('count');

        $statusBreakdown = $statusBreakdown->map(fn ($row) => [
            'category'   => $row->status,
            'amount'     => (int) $row->count,
            'percentage' => $totalStatus > 0
                ? round(($row->count / $totalStatus) * 100, 1)
                : 0,
        ]);

        /** =======================
         * TOP CLIENTS
         * ======================= */
        $topClients = (clone $baseQuery)
            ->join('clients', 'clients.id', '=', 'sales_orders.client_id')
            ->selectRaw("
                clients.name,
                clients.custom_id,
                COUNT(sales_orders.id) as total_orders,
                SUM(sales_orders.grand_total) as total_amount
            ")
            ->groupBy('clients.id', 'clients.name', 'clients.custom_id')
            ->orderByDesc('total_amount')
            ->limit(5)
            ->get();

        /** =======================
         * LATEST ORDERS
         * ======================= */
        $latestOrders = (clone $baseQuery)
            ->join('clients', 'clients.id', '=', 'sales_orders.client_id')
            ->orderByDesc('sales_orders.created_at')
            ->limit(10)
            ->get([
                'sales_orders.order_no',
                'sales_orders.custom_id',
                'sales_orders.status',
                'sales_orders.subtotal',
                'sales_orders.expected_delivery_date',
                'clients.name as client_name',
            ])
            ->map(fn ($o) => [
                'order_no' => $o->order_no,
                'custom_id' => $o->custom_id,
                'status' => $o->status,
                'subtotal' => $o->subtotal,
                'expected_delivery_date' => $o->expected_delivery_date,
                'client' => ['name' => $o->client_name],
            ]);

        /** =======================
         * OVERDUE ORDERS
         * ======================= */
        $overdueOrders = (clone $baseQuery)
            ->whereDate('expected_delivery_date', '<', today())
            ->where('status', 'APPROVED')
            ->join('clients', 'clients.id', '=', 'sales_orders.client_id')
            ->orderBy('expected_delivery_date')
            ->limit(10)
            ->get([
                'sales_orders.order_no',
                'sales_orders.custom_id',
                'sales_orders.status',
                'sales_orders.subtotal',
                'sales_orders.expected_delivery_date',
                'clients.name as client_name',
            ])
            ->map(fn ($o) => [
                'order_no' => $o->order_no,
                'custom_id' => $o->custom_id,
                'status' => $o->status,
                'subtotal' => $o->subtotal,
                'expected_delivery_date' => $o->expected_delivery_date,
                'client' => ['name' => $o->client_name],
            ]);

        return [
            'kpi' => [
                'total_orders' => (int) ($kpi->total_orders ?? 0),
                'total_sales' => (int) ($kpi->total_sales ?? 0),
                'total_rejection' => (int) ($kpi->total_rejection ?? 0),
                'total_order_amount' => (float) ($kpi->total_order_amount ?? 0),
                'total_approved_amount' => (float) ($kpi->total_approved_amount ?? 0),
                'total_draft_amount' => (float) ($kpi->total_draft_amount ?? 0),
            ],
            'charts' => [
                'monthly_sales' => $monthlySales,
                'status_breakdown' => $statusBreakdown,
            ],
            'top_clients' => $topClients,
            'latest_orders' => $latestOrders,
            'overdue_orders' => $overdueOrders,
        ];
    }

    public function getMarketPriceAverage($productId, $startDate = null, $endDate = null)
    {
        $prices = MarketPrice::query()
            ->where('product_id', $productId)
            ->when($startDate, fn ($q) => $q->whereDate('created_at', '>=', $startDate))
            ->when($endDate, fn ($q) => $q->whereDate('created_at', '<=', $endDate))
            ->selectRaw('DATE(created_at) as date, AVG(unit_price) as avg_price')
            ->groupBy(DB::raw('DATE(created_at)'))
            ->pluck('avg_price', 'date');

        $start = $startDate ? Carbon::parse($startDate) : now()->subDays(30);
        $end   = $endDate ? Carbon::parse($endDate) : now();

        $chartData = [];

        for ($date = $start->copy(); $date->lte($end); $date->addDay()) {
            $key = $date->format('Y-m-d');
            $chartData[] = [
                'date' => $key,
                'averagePrice' => round((float) ($prices[$key] ?? 0), 2),
            ];
        }

        return $chartData;
    }

}
