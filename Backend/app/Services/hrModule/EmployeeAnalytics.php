<?php

namespace App\Services\hrModule;

use App\Models\AttendanceLog;
use App\Models\Employee;
use App\Models\EmployeeHasAsset;
use App\Models\LeaveRequest;
use App\Models\Payroll;
use Illuminate\Database\Eloquent\Builder;
use Carbon\Carbon;

class EmployeeAnalytics
{
    private function applyDepartmentFilter(Builder $query, ?string $departmentId): Builder
    {
        if (!$departmentId) {
            return $query;
        }

        return $query->whereHas('employee', function ($employeeQuery) use ($departmentId) {
            $employeeQuery->where('department_id', $departmentId);
        });
    }

    public function attendanceSummary(string $start, string $end, ?string $departmentId = null): array
    {
        $startDate = Carbon::parse($start)->startOfDay()->toDateString();
        $endDate   = Carbon::parse($end)->endOfDay()->toDateString();

        $attendanceQuery = AttendanceLog::query()
            ->whereBetween('attendance_date', [$startDate, $endDate])
            ->where('is_active', 1)
            ->whereNotNull('check_in_time')
            ->selectRaw('attendance_date as date, COUNT(DISTINCT employee_id) as presentEmployees');

        $attendanceQuery = $this->applyDepartmentFilter($attendanceQuery, $departmentId);

        $attendanceRows = $attendanceQuery
            ->groupBy('attendance_date')
            ->orderBy('attendance_date')
            ->get();

        return $attendanceRows->map(fn($attendanceRow) => [
            'date' => (string) $attendanceRow->date,
            'presentEmployees' => (int) $attendanceRow->presentEmployees,
        ])->values()->all();
    }
    public function leaveSummary(string $start, string $end, ?string $departmentId = null): array
    {
        $startDate = Carbon::parse($start)->startOfDay()->toDateString();
        $endDate   = Carbon::parse($end)->endOfDay()->toDateString();

        $leaveRequestQuery = LeaveRequest::query()
            ->where('is_active', 1)
            ->where(function ($dateRangeFilterQuery) use ($startDate, $endDate) {
                $dateRangeFilterQuery->whereBetween('start_date', [$startDate, $endDate])
                    ->orWhereBetween('end_date', [$startDate, $endDate])
                    ->orWhere(function ($fullOverlapQuery) use ($startDate, $endDate) {
                        $fullOverlapQuery->where('start_date', '<=', $startDate)
                            ->where('end_date', '>=', $endDate);
                    });
            })
            ->selectRaw("final_status, COUNT(*) as total");

        $leaveRequestQuery = $this->applyDepartmentFilter($leaveRequestQuery, $departmentId);

        $leaveStatusRows = $leaveRequestQuery
            ->groupBy('final_status')
            ->get();

        $map = [
            'approved' => 0,
            'pending'  => 0,
            'rejected' => 0,
        ];

        foreach ($leaveStatusRows as $leaveStatusRow) {
            $leaveStatusKey = strtolower((string) $leaveStatusRow->final_status);
            if (isset($map[$leaveStatusKey])) {
                $map[$leaveStatusKey] = (int) $leaveStatusRow->total;
            }
        }

        return [
            ['category' => 'Approved', 'amount' => $map['approved']],
            ['category' => 'Pending',  'amount' => $map['pending']],
            ['category' => 'Rejected', 'amount' => $map['rejected']],
        ];
    }
    public function monthWiseSummary(string $start, string $end, ?string $departmentId = null): array
    {
        $startDate = Carbon::parse($start)->startOfDay()->toDateString();
        $endDate   = Carbon::parse($end)->endOfDay()->toDateString();

        $baseQuery = Payroll::query()
            ->where('is_active', 1)
            ->whereNotNull('start_date')
            ->where(function ($rangeOverlapQuery) use ($startDate, $endDate) {
                $rangeOverlapQuery->where('start_date', '<=', $endDate)
                    ->where('end_date', '>=', $startDate);
            });

        $baseQuery = $this->applyDepartmentFilter($baseQuery, $departmentId);

        $monthlyRows = (clone $baseQuery)
            ->selectRaw("
                year,
                month,
                SUM(net_salary) as totalNet,
                SUM(total_deductions) as totalDeduction,
                SUM(COALESCE(bonuses,0) + COALESCE(nightshift_bonus,0) + COALESCE(attendance_bonus,0)) as totalBonus
            ")
            ->groupBy('year', 'month')
            ->orderBy('year')
            ->orderBy('month')
            ->get();

        $overview = (clone $baseQuery)
            ->selectRaw("
                COALESCE(SUM(gross_salary), 0) as totalSalary,
                COALESCE(SUM(CASE WHEN LOWER(status) <> 'paid' THEN net_salary ELSE 0 END), 0) as totalOutstanding,
                COUNT(*) as totalGenerated
            ")
            ->first();

        $totalPayableDays = Carbon::parse($startDate)->diffInDays(Carbon::parse($endDate)) + 1;

        $bar = $monthlyRows->map(function ($monthlyRow) {
            $label = Carbon::createFromDate((int)$monthlyRow->year, (int)$monthlyRow->month, 1)->format('M Y');
            return [
                'label' => $label,
                'year'  => (int) $monthlyRow->year,
                'month' => (int) $monthlyRow->month,
                'totalNet' => (float) $monthlyRow->totalNet,
                'totalDeduction' => (float) $monthlyRow->totalDeduction,
                'totalBonus' => (float) $monthlyRow->totalBonus,
            ];
        })->values();

        $totals = [
            'totalNet' => (float) $monthlyRows->sum('totalNet'),
            'totalDeduction' => (float) $monthlyRows->sum('totalDeduction'),
            'totalBonus' => (float) $monthlyRows->sum('totalBonus'),
        ];

        return [
            'bar' => $bar,
            'totals' => $totals,
            'overview' => [
                'totalSalary' => (float) ($overview->totalSalary ?? 0),
                'totalOutstanding' => (float) ($overview->totalOutstanding ?? 0),
                'totalPayableDays' => (int) round($totalPayableDays),
                'totalGenerated' => (int) ($overview->totalGenerated ?? 0),
            ],
        ];
    }

    public function assetSummary(string $start, string $end, ?string $departmentId = null): array
    {
        $startDate = Carbon::parse($start)->startOfDay()->toDateString();
        $endDate   = Carbon::parse($end)->endOfDay()->toDateString();

        $assetQuery = EmployeeHasAsset::query()
            ->where('employee_has_assets.is_active', 1)
            ->whereBetween('employee_has_assets.issued_date', [$startDate, $endDate])
            ->join('assets', 'employee_has_assets.asset_id', '=', 'assets.id')
            ->selectRaw('assets.name as label, COUNT(employee_has_assets.id) as total');

        if ($departmentId) {
            $assetQuery->join('employees', 'employee_has_assets.employee_id', '=', 'employees.id')
                ->where('employees.department_id', $departmentId);
        }

        $assetRows = $assetQuery
            ->groupBy('assets.id', 'assets.name')
            ->orderByDesc('total')
            ->get();

        return [
            'labels' => $assetRows->pluck('label')->values()->all(),
            'values' => $assetRows->map(fn($assetRow) => (int) $assetRow->total)->values()->all(),
        ];
    }

    public function groupSummary(string $start, string $end, ?string $departmentId = null): array
    {
        $startDate = Carbon::parse($start)->startOfDay()->toDateString();
        $endDate   = Carbon::parse($end)->endOfDay()->toDateString();

        $employeeGroupQuery = Employee::query()
            ->leftJoin('employee_groups', 'employees.group_id', '=', 'employee_groups.id')
            ->where('employees.is_active', 1)
            ->whereBetween('employees.joining_date', [$startDate, $endDate])
            ->selectRaw("COALESCE(employee_groups.name, 'Ungrouped') as label, COUNT(employees.id) as total");

        if ($departmentId) {
            $employeeGroupQuery->where('employees.department_id', $departmentId);
        }

        $employeeGroupRows = $employeeGroupQuery
            ->groupBy('employee_groups.id', 'employee_groups.name')
            ->orderByDesc('total')
            ->get();

        return [
            'labels' => $employeeGroupRows->pluck('label')->values()->all(),
            'values' => $employeeGroupRows->map(fn($employeeGroupRow) => (int) $employeeGroupRow->total)->values()->all(),
        ];
    }
}
