<?php

namespace App\Services\Purchase;
use App\Models\Purchase\PurchaseOrder;
use App\Enums\Purchase\PoStatus;
use App\Enums\Store\SprStatus;
use Illuminate\Support\Facades\DB;
use App\Models\Supplier;
use App\Models\Department;
use Illuminate\Support\Str;
use Exception;

class PurchaseService
{
public function getPurchaseAnalysis($startDate = null, $endDate = null, $supplierId = null, $departmentId = null)
{
    try {
        // Base query
        $query = DB::table('purchase_orders')
            ->when($startDate, fn($q) => $q->whereDate('po_date', '>=', $startDate))
            ->when($endDate, fn($q) => $q->whereDate('po_date', '<=', $endDate))
            ->when($supplierId, fn($q) => $q->where('supplier_id', $supplierId))
            ->when($departmentId, fn($q) => $q->where('department_id', $departmentId));

        // 1. Total number of purchases
        $totals = (clone $query)
            ->selectRaw('COUNT(*) as total_purchases')
            ->first();

        // 3. Top 3 suppliers by order count — analytics surfaces volume, not price.
        $topSuppliers = (clone $query)
            ->join('suppliers', 'purchase_orders.supplier_id', '=', 'suppliers.id')
            ->select('suppliers.name as supplier_name', DB::raw('COUNT(*) as order_count'))
            ->groupBy('purchase_orders.supplier_id', 'suppliers.name')
            ->orderByDesc('order_count')
            ->limit(3)
            ->get();

        // 4. Order-count trend by day — grouped by day rather than a fixed month bucket, so
        // it reflects whatever window the date-range filter is actually set to (a short
        // range grouped by month would collapse to a single point).
        $monthlyTrends = (clone $query)
            ->selectRaw("DATE(po_date) as month, COUNT(*) as order_count")
            ->groupByRaw("DATE(po_date)")
            ->orderByRaw("DATE(po_date)")
            ->get();

        // 5. Latest POs — same date-range/department/supplier filter as the rest of the
        // analytics page, not a filter of its own.
        $latestPOs = (clone $query)
            ->join('suppliers', 'purchase_orders.supplier_id', '=', 'suppliers.id')
            ->join('departments', 'purchase_orders.department_id', '=', 'departments.id')
            ->select(
                'purchase_orders.custom_id',
                'purchase_orders.po_date',
                'purchase_orders.status',
                DB::raw('(SELECT COALESCE(SUM(poi.quantity), 0) FROM purchase_order_items poi WHERE poi.purchase_order_id = purchase_orders.id) as quantity'),

                'departments.name as department_name',
                'departments.custom_id as department_custom_id',
                'suppliers.name as supplier_name',
                'suppliers.custom_id as supplier_custom_id'
            )
            ->orderByDesc('po_date')
            ->get();

        // 6. Department-wise order counts (with percentages) — order volume, not spend.
        $departmentWise = (clone $query)
            ->join('departments', 'purchase_orders.department_id', '=', 'departments.id')
            ->select('departments.name as department_name', DB::raw('COUNT(*) as total_orders'))
            ->groupBy('purchase_orders.department_id', 'departments.name')
            ->get();

        $grandTotal = $departmentWise->sum('total_orders');

        $departmentWise = $departmentWise->map(fn($item) => [
            'department_name' => $item->department_name,
            'total_orders' => $item->total_orders,
            'percentage' => $grandTotal > 0 ? round(($item->total_orders / $grandTotal) * 100, 2) : 0,
        ]);

        $sprCount = DB::table('purchase_requisitions')
            ->where('type', 'SPR')
            ->when($startDate, fn($q) => $q->whereDate('request_date', '>=', $startDate))
            ->when($endDate, fn($q) => $q->whereDate('request_date', '<=', $endDate))
            ->when($departmentId, fn($q) => $q->where('department_id', $departmentId))
            ->count();

        $receivedOrders = (clone $query)
            ->where('status', PoStatus::RECEIVED->value)
            ->count();

        $srQuery = DB::table('purchase_requisitions')
            ->where('type', 'SR')
            ->when($startDate, fn($q) => $q->whereDate('request_date', '>=', $startDate))
            ->when($endDate, fn($q) => $q->whereDate('request_date', '<=', $endDate))
            ->when($departmentId, fn($q) => $q->where('department_id', $departmentId));

        // Store requisitions still awaiting approval — an actionable count, not a money figure.
        $pendingSr = (clone $srQuery)
            ->where('status', SprStatus::SUBMITTED->value)
            ->count();

        $inboundTrends = DB::table('material_receipts')
            ->when($startDate, fn($q) => $q->whereDate('receipt_date', '>=', $startDate))
            ->when($endDate, fn($q) => $q->whereDate('receipt_date', '<=', $endDate))
            ->when($supplierId, fn($q) => $q->where('supplier_id', $supplierId))
            ->when($departmentId, fn($q) => $q->where('department_id', $departmentId))
            ->selectRaw('DATE(receipt_date) as date, COUNT(*) as inbound_count')
            ->groupByRaw('DATE(receipt_date)')
            ->pluck('inbound_count', 'date');

        $outboundTrends = (clone $srQuery)
            ->selectRaw('DATE(request_date) as date, COUNT(*) as outbound_count')
            ->groupByRaw('DATE(request_date)')
            ->pluck('outbound_count', 'date');

        $monthlyTrends = $monthlyTrends->map(function ($row) use ($inboundTrends, $outboundTrends) {
            $row->inbound_count = $inboundTrends[$row->month] ?? 0;
            $row->outbound_count = $outboundTrends[$row->month] ?? 0;
            return $row;
        });

        $srDepartmentWise = (clone $srQuery)
            ->join('departments', 'purchase_requisitions.department_id', '=', 'departments.id')
            ->select('departments.name as department_name', DB::raw('COUNT(*) as total_requests'))
            ->groupBy('purchase_requisitions.department_id', 'departments.name')
            ->get();

        $srGrandTotal = $srDepartmentWise->sum('total_requests');

        $srDepartmentWise = $srDepartmentWise->map(fn($item) => [
            'department_name' => $item->department_name,
            'total_requests' => $item->total_requests,
            'percentage' => $srGrandTotal > 0 ? round(($item->total_requests / $srGrandTotal) * 100, 2) : 0,
        ]);

        return [
            'total_purchases' => $totals->total_purchases ?? 0,
            'pending_sr' => $pendingSr,
            'total_spr' => $sprCount,
            'received_orders' => $receivedOrders,
            'department_wise_total' => $departmentWise,
            'sr_department_wise' => $srDepartmentWise,
            'top_suppliers' => $topSuppliers,
            'monthly_trends' => $monthlyTrends,
            'latest_pos' => $latestPOs,
        ];

    } catch (Exception $e) {
        throw new Exception('Error retrieving purchase analysis data: ' . $e->getMessage());
    }
}


    function generateDemoPurchaseOrders(int $totalOrders = 50000)
    {
        $suppliers = Supplier::pluck('id')->toArray();
        $departments = Department::pluck('id')->toArray();

        $data = [];
        $statuses = ['pending', 'approved', 'rejected']; 

        for ($i = 0; $i < $totalOrders; $i++) {
            $poDate = date('Y-m-d', strtotime('-'.rand(0, 730).' days')); 
            $data[] = [
                'custom_id' => 'PO-' . Str::upper(Str::random(8)),
                'spr_id' => null,
                'supplier_id' => $suppliers[array_rand($suppliers)],
                'department_id' => $departments[array_rand($departments)],
                'created_by' => 1,
                'po_date' => $poDate,
                'status' => $statuses[array_rand($statuses)],
                'total_amount' => rand(100, 10000) + rand(0,99)/100, 
                'note' => 'Demo purchase order',
                'created_at' => now(),
                'updated_at' => now(),
            ];

            if (count($data) >= 500) {
                DB::table('purchase_orders')->insert($data);
                $data = [];
            }
        }

        if (count($data)) {
            DB::table('purchase_orders')->insert($data);
        }

        echo "Created {$totalOrders} demo purchase orders.\n";
    }

}
