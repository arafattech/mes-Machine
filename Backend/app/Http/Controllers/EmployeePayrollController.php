<?php

namespace App\Http\Controllers;

use App\Models\AttendanceLog;
use Illuminate\Http\Request;
use App\Models\Employee;
use App\Models\EmployeeBonus;
use App\Models\LeaveDate;
use App\Models\LeaveType;
use Carbon\Carbon;
use App\Models\Payroll;
use App\Models\TaxRule;
use Barryvdh\DomPDF\Facade\Pdf;

class EmployeePayrollController extends Controller
{

    public function employePayrollStatus($employeeId, $start_date, $end_date)
    {
        $employee = Employee::with(['salary', 'attendancelogs', 'leaves', 'employeeWeekend'])->find($employeeId);

        if (!$employee) {
            return response()->json(['error' => 'Employee not found'], 404);
        }

        $startDate = Carbon::createFromFormat('d-m-Y', $start_date)->startOfDay();
        $endDate   = Carbon::createFromFormat('d-m-Y', $end_date)->endOfDay();

        return response()->json($this->computePayrollStatus($employee, $startDate, $endDate));
    }

    private function computePayrollStatus(Employee $employee, Carbon $startDate, Carbon $endDate): array
    {
        $existingPayroll = Payroll::where('employee_id', $employee->id)
            ->whereBetween('processed_at', [$startDate, $endDate])
            ->first();

        $holidaysInRange = $employee->employeeWeekend()
            ->whereBetween('weekend_date', [$startDate, $endDate])
            ->where('status', 'APPROVED')
            ->where('type', '!=', 'LEAVE')
            ->where('type', '!=', 'WEEKEND')
            ->pluck('weekend_date')
            ->unique()
            ->count();

        $nightShiftAttendances = AttendanceLog::where('employee_id', $employee->id)
            ->whereBetween('attendance_date', [$startDate, $endDate])
            ->whereNotNull('check_in_time')
            ->whereNotNull('check_out_time')
            ->whereHas('shift', function ($query) {
                $query->where('is_night', true);
            })
            ->count();

        $configuredHolidayDates = $employee->employeeWeekend()
            ->whereBetween('weekend_date', [$startDate, $endDate])
            ->whereNotNull('bonus_mode')
            ->pluck('weekend_date')
            ->map(fn ($date) => Carbon::parse($date)->toDateString())
            ->unique()
            ->values()
            ->all();

        $actualAttendanceInRange = AttendanceLog::where('employee_id', $employee->id)
            ->whereBetween('attendance_date', [$startDate, $endDate])
            ->whereNotNull('check_in_time')
            ->whereNotNull('check_out_time')
            ->distinct('attendance_date')
            ->count('attendance_date');

        // Excludes days that are also configured weekend/holiday dates so those days
        // aren't counted twice (once as attendance, once as weekend) in the payable-days
        // formula below. The *displayed* attendance figure uses the unfiltered count above.
        $employeeAttendanceInRange = AttendanceLog::where('employee_id', $employee->id)
            ->whereBetween('attendance_date', [$startDate, $endDate])
            ->whereNotNull('check_in_time')
            ->whereNotNull('check_out_time')
            ->when(
                ! empty($configuredHolidayDates),
                fn ($query) => $query->whereNotIn('attendance_date', $configuredHolidayDates),
            )
            ->distinct('attendance_date')
            ->count('attendance_date');

        $employeePaidLeaveInRange = LeaveDate::where('employee_id', $employee->id)
            ->whereBetween('leave_date', [$startDate, $endDate])
            ->whereHas('leaveRequest', function ($query) {
                $query->where('final_status', 'approved')
                    ->whereHas('leaveType', function ($typeQuery) {
                        $typeQuery->where('is_paid', true);
                    });
            })
            ->count();

        $leaveTypeCountInRange = LeaveDate::where('employee_id', $employee->id)
            ->whereBetween('leave_date', [$startDate, $endDate])
            ->whereHas('leaveRequest', function ($query) {
                $query->where('final_status', 'approved');
            })
            ->with('leaveRequest.leaveType')
            ->get()
            ->groupBy(fn($leaveRecord) => $leaveRecord->leaveRequest->leave_type_id)
            ->map(fn($group, $typeId) => [
                'leave_type_id' => $typeId,
                'total' => $group->count(),
            ])
            ->values();

        $year = $startDate->year;

        $leaveTypeCountInYear = LeaveDate::where('employee_id', $employee->id)
            ->whereYear('leave_date', $year)
            ->whereHas('leaveRequest', function ($query) {
                $query->where('final_status', 'approved');
            })
            ->with('leaveRequest.leaveType')
            ->get()
            ->groupBy(fn($leaveRecord) => $leaveRecord->leaveRequest->leave_type_id)
            ->map(fn($group, $typeId) => [
                'leave_type_id' => $typeId,
                'leave_type' => ['name' => $group->first()->leaveRequest->leaveType->name ?? 'Unknown'],
                'total' => $group->count(),
            ])
            ->values();

        $employeeWeekendCount = $employee->employeeWeekend()
            ->whereBetween('weekend_date', [$startDate, $endDate])
            ->where('status', 'APPROVED')
            ->where('type', '!=', 'LEAVE')
            ->pluck('weekend_date')
            ->unique()
            ->count();

        $employeeSalary = $employee->salary;
        $basicSalary = (float) ($employeeSalary->basic ?? 0);
        $totalSalary = (float) ($employeeSalary->total_salary ?? 0);
        $allowances  =
            (float) ($employeeSalary->medical_allowance ?? 0) +
            (float) ($employeeSalary->transport_allowance ?? 0) +
            (float) ($employeeSalary->house_rent ?? 0) +
            (float) ($employeeSalary->other_allowance ?? 0);

        $bonusBreakdown = $this->employeeBonusBreakdown($employee->id, $startDate, $endDate);
        $attendenceBonus = $bonusBreakdown['attendance_bonus'];
        $nightShiftBonus = $bonusBreakdown['nightshift_bonus'];
        $holidayBonus = $bonusBreakdown['holiday_bonus'];
        $overtimeBonus = $bonusBreakdown['overtime_bonus'];
        $bonuses = $bonusBreakdown['total_bonus'];

        $grossSalary = $basicSalary + $allowances + $bonuses;

        $taxInfo = $this->resolveTaxForEmployee($employee, $totalSalary);
        $tax = $taxInfo['tax_amount'];
        $socialSecurity = 0;
        $loans = 0;
        $penalties = 0;
        $otherDeductions = 0;

        $totalCountableDays = $employeeAttendanceInRange + $employeePaidLeaveInRange + $employeeWeekendCount;
        $daysInSelectedMonth = $startDate->daysInMonth;
        $perDaySalary = $totalSalary / $daysInSelectedMonth;
        $otherDeductions += $totalSalary  - ($totalCountableDays * $perDaySalary);
        $totalDeductions = $tax + $socialSecurity + $loans + $penalties + $otherDeductions;

        $netSalary = max(0, $grossSalary - $totalDeductions);

        $employeLastPayroll = Payroll::where('employee_id', $employee->id)->latest()->first();
        $lastPayroll = null;
        $nextPayroll = null;

        if ($employeLastPayroll && $employeLastPayroll->processed_at) {
            $lastPayroll = Carbon::parse($employeLastPayroll->processed_at)->format('Y-m-d');
            $nextPayroll = Carbon::parse($employeLastPayroll->processed_at)->addMonth()->format('Y-m-d');
        }
        $totalPayableDays = $startDate->diffInDays($endDate) + 1;
        return [

            'employeeSalary' => $employeeSalary,
            'lastPayroll' => $lastPayroll,
            'nextPayroll' => $nextPayroll,
            'allowances' => $allowances,
            'deductions' => round($totalDeductions, 2),
            'grossSalary' => $grossSalary,
            'netSalary' => round($netSalary, 2),
            'bonuses' => $bonuses,
            'total_bonus' => $bonuses,
            'attendance_bonus' => $attendenceBonus,
            'nightshift_bonus' => $nightShiftBonus,
            'holiday_bonus' => $holidayBonus,
            'overtime_bonus' => $overtimeBonus,
            'total_payable_days' => (int)$totalPayableDays,
            'hr_notes' => $existingPayroll ? $existingPayroll->hr_notes : null,
            'employeeAttendance' => [
                'totalAttendenceInMonth' => $actualAttendanceInRange,
                'holiday' => $holidaysInRange,
                'nightShiftAttendances' => $nightShiftAttendances,
            ],

            'employeeBonuses' => [
                'attendance_bonus' => $attendenceBonus,
                'nightshift_bonus' => $nightShiftBonus,
                'holiday_bonus' => $holidayBonus,
                'overtime_bonus' => $overtimeBonus,
                'total_bonus' => $bonuses,
                'attendanceBonus' => $attendenceBonus,
                'nightShiftBonus' => $nightShiftBonus,
                'holidayBonus' => $holidayBonus,
                'overtimeBonus' => $overtimeBonus,
                'totalBonus' => $bonuses,
                'nightShiftAttendenceBonus' => $nightShiftBonus,
                'attendenceBonuses' => $attendenceBonus,
            ],

            'employeeDeducations' => [
                'tax' => $tax,
                'tax_rate' => $taxInfo['tax_rate'],
                'tax_rule_name' => $taxInfo['tax_rule_name'],
                'social_security' => $socialSecurity,
                'loans' => $loans,
                'penalties' => $penalties,
                'other_deductions' => round($otherDeductions, 2),
                'total_deductions' => round($totalDeductions, 2),
            ],

            'leaveStatus' => [
                'leaveInYear' => $leaveTypeCountInYear,
                'leaveInMonth' => $leaveTypeCountInRange,
                'leaveBalance' => LeaveType::sum('max_days') - $leaveTypeCountInYear->sum('total'),
                'leaveTypes' => LeaveType::select('id', 'name', 'max_days')->get(),
            ],
            'total_weekend' => $employeeWeekendCount,
        ];
    }

    private function resolveTaxForEmployee(Employee $employee, float $totalSalary): array
    {
        $today = Carbon::today();

        $activeWithinRange = function ($query) use ($today) {
            $query->where('is_active', true)
                ->where('effective_from', '<=', $today)
                ->where(function ($q) use ($today) {
                    $q->whereNull('effective_to')->orWhere('effective_to', '>=', $today);
                });
        };

        $rule = TaxRule::where('employee_id', $employee->id)
            ->where($activeWithinRange)
            ->orderByDesc('effective_from')
            ->first();

        if (!$rule) {
            $rule = TaxRule::whereNull('employee_id')
                ->where($activeWithinRange)
                ->where(function ($q) use ($totalSalary) {
                    $q->whereNull('salary_from')->orWhere('salary_from', '<=', $totalSalary);
                })
                ->where(function ($q) use ($totalSalary) {
                    $q->whereNull('salary_to')->orWhere('salary_to', '>=', $totalSalary);
                })
                ->orderByDesc('effective_from')
                ->first();
        }

        if (!$rule) {
            return ['tax_amount' => 0.0, 'tax_rate' => null, 'tax_rule_name' => null];
        }

        $taxAmount = $rule->is_percentage
            ? $totalSalary * ((float) $rule->tax_rate / 100)
            : (float) $rule->fixed_amount;

        return [
            'tax_amount' => round($taxAmount, 2),
            'tax_rate' => $rule->is_percentage ? (float) $rule->tax_rate : null,
            'tax_rule_name' => $rule->name,
        ];
    }

    private function employeeBonusBreakdown(int $employeeId, Carbon $startDate, Carbon $endDate): array
    {
        $breakdown = [
            'attendance_bonus' => 0.0,
            'nightshift_bonus' => 0.0,
            'holiday_bonus' => 0.0,
            'overtime_bonus' => 0.0,
        ];

        $employeeBonuses = EmployeeBonus::with('bonusType')
            ->where('emp_id', $employeeId)
            ->whereBetween('attendance_date', [
                $startDate->toDateString(),
                $endDate->toDateString(),
            ])
            ->get();

        foreach ($employeeBonuses as $employeeBonus) {
            $bonusKey = $this->payrollBonusKey(
                $employeeBonus->bonusType?->name ?: $employeeBonus->bonus_type
            );

            if (!$bonusKey) {
                continue;
            }

            $breakdown[$bonusKey] += (float) $employeeBonus->amount;
        }

        foreach ($breakdown as $key => $amount) {
            $breakdown[$key] = round($amount, 2);
        }

        $breakdown['total_bonus'] = round(array_sum($breakdown), 2);

        return $breakdown;
    }

    private function payrollBonusKey(?string $bonusType): ?string
    {
        if ($bonusType === null) {
            return null;
        }

        $normalized = preg_replace('/[^A-Z0-9]/', '', strtoupper(trim($bonusType)));

        return match ($normalized) {
            'ATTENDANCE', 'ATTENDANCEBONUS', 'ATTENDENCE', 'ATTENDENCEBONUS' => 'attendance_bonus',
            'NIGHTSHIFT', 'NIGHTSHIFTBONUS', 'NIGHTSHIFTATTENDANCE', 'NIGHTSHIFTATTENDENCE' => 'nightshift_bonus',
            'HOLIDAYBONUS' => 'holiday_bonus',
            'OVERTIME', 'OVERTIMEBONUS', 'EXTRASHIFT', 'HOLIDAYOVERTIME' => 'overtime_bonus',
            default => null,
        };
    }

    public function exportEmployeeLogPdf(Request $request)
    {
        $validated = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'start' => ['required', 'date'],
            'end' => ['required', 'date'],
        ]);

        $employeeId = (int) $validated['employee_id'];
        $startDate = Carbon::parse($validated['start'])->startOfDay();
        $endDate = Carbon::parse($validated['end'])->endOfDay();

        if ($endDate->lt($startDate)) {
            return response()->json([
                'error' => 'End date must be greater than or equal to start date',
            ], 422);
        }

        $payrollResponse = $this->employePayrollStatus(
            $employeeId,
            $startDate->format('d-m-Y'),
            $endDate->format('d-m-Y')
        );

        if ($payrollResponse->getStatusCode() !== 200) {
            return $payrollResponse;
        }

        $employee = Employee::with([
            'salary',
            'department',
            'designation',
            'supervisor',
            'employeeWeekend',
        ])->find($employeeId);

        if (!$employee) {
            return response()->json(['error' => 'Employee not found'], 404);
        }

        $payload = $payrollResponse->getData(true);

        $employeeName = trim(($employee->first_name ?? '') . ' ' . ($employee->last_name ?? '')) ?: 'Employee';
        $departmentName = $employee->department->name ?? '-';
        $designationName = $employee->designation->name ?? '-';
        $supervisorName = trim(($employee->supervisor->first_name ?? '') . ' ' . ($employee->supervisor->last_name ?? '')) ?: '-';

        $pdf = Pdf::loadView('pdf-templates.employee-log', [
            'employee' => [
                'name' => $employeeName,
                'employee_no' => $employee->employee_no ?? '-',
                'department' => $departmentName,
                'designation' => $designationName,
                'supervisor' => $supervisorName,
                'status' => $employee->is_active ? 'Active' : 'Inactive',
                'joined_date' => $employee->joining_date ? Carbon::parse($employee->joining_date)->format('d-m-Y') : '-',
                'email' => $employee->email ?? '-',
                'phone' => $employee->contact_number ?? '-',
            ],
            'payroll' => $payload,
            'leaveStatus' => $payload['leaveStatus'] ?? [],
            'dateRange' => [
                'start' => $startDate->format('d-m-Y'),
                'end' => $endDate->format('d-m-Y'),
            ],
        ])->setPaper('A4', 'portrait');

        $filename = sprintf(
            'employee-log-%s-%s.pdf',
            preg_replace('/\s+/', '-', strtolower($employeeName)),
            $startDate->format('Y-m-d') . '-to-' . $endDate->format('Y-m-d')
        );

        return response($pdf->output(), 200)
            ->header('Content-Type', 'application/pdf')
            ->header('Content-Disposition', 'inline; filename="' . $filename . '"');
    }

    public function exportEmployeeListPdf(Request $request)
    {
        $validated = $request->validate([
            'employee_ids' => ['required', 'array', 'min:1'],
            'employee_ids.*' => ['integer', 'exists:employees,id'],
            'start' => ['nullable', 'date'],
            'end' => ['nullable', 'date'],
        ]);

        $startDate = $validated['start'] ?? null
            ? Carbon::parse($validated['start'])->startOfDay()
            : Carbon::now()->subDays(30)->startOfDay();
        $endDate = $validated['end'] ?? null
            ? Carbon::parse($validated['end'])->endOfDay()
            : Carbon::now()->endOfDay();

        if ($endDate->lt($startDate)) {
            return response()->json([
                'error' => 'End date must be greater than or equal to start date',
            ], 422);
        }

        $employees = Employee::with(['department', 'designation'])
            ->whereIn('id', $validated['employee_ids'])
            ->get();

        $rows = $employees->map(function ($employee) use ($startDate, $endDate) {
            $payrollResponse = $this->employePayrollStatus(
                $employee->id,
                $startDate->format('d-m-Y'),
                $endDate->format('d-m-Y')
            );
            $payload = $payrollResponse->getStatusCode() === 200
                ? $payrollResponse->getData(true)
                : [];

            return [
                'name' => trim(($employee->first_name ?? '') . ' ' . ($employee->last_name ?? '')) ?: 'Employee',
                'employee_no' => $employee->employee_no ?? '-',
                'department' => $employee->department->name ?? '-',
                'designation' => $employee->designation->name ?? '-',
                'status' => $employee->is_active ? 'Active' : 'Inactive',
                'joined_date' => $employee->joining_date ? Carbon::parse($employee->joining_date)->format('d-m-Y') : '-',
                'total_salary' => data_get($payload, 'employeeSalary.total_salary', '-'),
                'attendance' => data_get($payload, 'employeeAttendance.totalAttendenceInMonth', '-'),
                'holiday' => data_get($payload, 'employeeAttendance.holiday', '-'),
                'night_shift_attendance' => data_get($payload, 'employeeAttendance.nightShiftAttendances', '-'),
                'bonuses' => data_get($payload, 'bonuses', '-'),
                'overtime_bonus' => data_get($payload, 'overtime', '-'),
                'side_bill' => data_get($payload, 'sideBill', '-'),
                'night_shift_bonus' => data_get($payload, 'employeeBonuses.nightShiftAttendenceBonus', '-'),
                'attendance_bonus' => data_get($payload, 'employeeBonuses.attendenceBonuses', '-'),
                'payable_days' => data_get($payload, 'total_payable_days', '-'),
                'leave_balance' => data_get($payload, 'leaveStatus.leaveBalance', '-'),
                'total_weekend' => data_get($payload, 'total_weekend', '-'),
            ];
        });

        $pdf = Pdf::loadView('pdf-templates.employee-list', [
            'employees' => $rows,
            'dateRange' => [
                'start' => $startDate->format('d-m-Y'),
                'end' => $endDate->format('d-m-Y'),
            ],
        ])->setPaper('A4', 'landscape');

        $filename = sprintf(
            'employee-report-%s-to-%s.pdf',
            $startDate->format('Y-m-d'),
            $endDate->format('Y-m-d')
        );

        return response($pdf->output(), 200)
            ->header('Content-Type', 'application/pdf')
            ->header('Content-Disposition', 'inline; filename="' . $filename . '"');
    }
}
