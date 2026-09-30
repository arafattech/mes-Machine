<?php

namespace App\Http\Controllers;

use App\Exports\PayrollExport;
use App\Models\AttendanceLog;
use Illuminate\Http\Request;
use App\Models\Employee;
use App\Models\EmployeeBonus;
use App\Models\EmployeeShift;
use App\Models\EmployeeType;
use App\Models\LeaveDate;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use Carbon\Carbon;
use App\Models\Payroll;
use App\Models\PayrollHistory;
use App\Models\TaxRule;
use Barryvdh\DomPDF\Facade\Pdf;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Support\Facades\DB;


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

    public function employePayrollStatusBulk(Request $request)
    {
        $validated = $request->validate([
            'employee_ids'   => ['required', 'array', 'min:1'],
            'employee_ids.*' => ['integer', 'exists:employees,id'],
            'start_date'     => ['required', 'string'],
            'end_date'       => ['required', 'string'],
        ]);

        $startDate = Carbon::createFromFormat('d-m-Y', $validated['start_date'])->startOfDay();
        $endDate   = Carbon::createFromFormat('d-m-Y', $validated['end_date'])->endOfDay();

        $employees = Employee::with(['salary', 'attendancelogs', 'leaves', 'employeeWeekend'])
            ->whereIn('id', $validated['employee_ids'])
            ->get();

        $results = [];
        foreach ($employees as $employee) {
            $results[$employee->id] = $this->computePayrollStatus($employee, $startDate, $endDate);
        }

        return response()->json($results);
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

    public function destroyPayroll($id)
    {
        $payroll = Payroll::find($id);

        if (!$payroll) {
            return response()->json(['message' => 'Payroll not found'], 404);
        }

        DB::transaction(function () use ($payroll) {
            $history = $payroll->payroll_history_id
                ? PayrollHistory::find($payroll->payroll_history_id)
                : null;

            if ($history) {
                $remainingEmployees = max(0, $history->total_employees - 1);

                if ($remainingEmployees === 0) {
                    $history->delete();
                } else {
                    $history->update([
                        'total_employees'  => $remainingEmployees,
                        'total_salary'     => max(0, $history->total_salary - ($payroll->net_salary ?? 0)),
                        'total_deductions' => max(0, $history->total_deductions - ($payroll->total_deductions ?? 0)),
                        'total_tax'        => max(0, $history->total_tax - ($payroll->tax ?? 0)),
                        'total_bonuses'    => max(0, $history->total_bonuses - ($payroll->bonuses ?? 0)),
                    ]);
                }
            }

            $payroll->delete();
        });

        return response()->json(['message' => 'Payroll deleted successfully']);
    }

    public function bulkMarkBonusesPaid(Request $request)
    {
        $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'exists:employee_bonuses,id',
        ]);

        $ids = $request->ids;

        $updated = EmployeeBonus::whereIn('id', $ids)
            ->where(function ($query) {
                $query->whereNull('status')->orWhere('status', '!=', 'PAID');
            })
            ->update(['status' => 'PAID']);

        return response()->json([
            'message' => 'Selected bonuses marked as paid successfully.',
            'updated_count' => $updated,
        ]);
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

    public function generatePayroll(Request $request, string $start_date, string $end_date)
    {
        $employeeIds   = $request->input('employee_ids', []);
        $departmentIds = $request->input('department_ids', []);

        if (empty($employeeIds) && empty($departmentIds)) {
            return response()->json([
                'status' => false,
                'error'  => 'Please provide either employee_ids or department_ids'
            ], 400);
        }

        $start = Carbon::createFromFormat('d-m-Y', $start_date)->startOfDay();
        $end   = Carbon::createFromFormat('d-m-Y', $end_date)->endOfDay();

        if ($end->lt($start)) {
            return response()->json([
                'status' => false,
                'error'  => 'End date must be greater than or equal to start date'
            ], 422);
        }

        $totalPayableDays = $start->diffInDays($end) + 1;

        $processedCount = 0;
        $skipped = [];
        $createdPayrollIds = [];

        $query = Employee::query()
            ->with(['salary'])
            ->where(function ($q) use ($employeeIds, $departmentIds) {
                if (!empty($employeeIds)) {
                    $q->whereIn('id', $employeeIds);
                }
                if (!empty($departmentIds)) {
                    $q->orWhereIn('department_id', $departmentIds);
                }
            })
            ->orderBy('id');

        $anyEmployee = false;

        $query->chunkById(200, function ($employees) use (
            &$processedCount,
            &$skipped,
            &$anyEmployee,
            &$createdPayrollIds,
            $request,
            $start_date,
            $end_date,
            $start,
            $end,
            $totalPayableDays
        ) {
            $anyEmployee = true;

            $existing = Payroll::query()
                ->whereIn('employee_id', $employees->pluck('id'))
                ->where(function ($query) use ($start, $end) {
                    $query->where('start_date', '<=', $end)
                        ->where('end_date', '>=', $start);
                })
                ->pluck('id', 'employee_id');

            foreach ($employees as $employee) {

                if (empty($employee->salary) || (float)($employee->salary->basic ?? 0) <= 0) {
                    $skipped[] = [
                        'employee_id' => $employee->id,
                        'name'        => trim($employee->first_name . ' ' . $employee->last_name),
                        'reason'      => 'Salary not found',
                    ];
                    continue;
                }

                if (isset($existing[$employee->id])) {
                    $skipped[] = [
                        'employee_id' => $employee->id,
                        'name'        => trim($employee->first_name . ' ' . $employee->last_name),
                        'reason'      => 'Payroll already exists',
                    ];
                    continue;
                }

                $payrollResponse = $this->employePayrollStatus($employee->id, $start_date, $end_date);
                $payroll = $payrollResponse->getData();

                $createdPayroll = Payroll::create([
                    'employee_id'         => $employee->id,
                    'month'               => $start->month,
                    'year'                => $start->year,
                    'start_date'          => $start->toDateString(),
                    'end_date'            => $end->toDateString(),
                    'total_payable_days'  => $totalPayableDays,

                    'basic_salary'        => $payroll->employeeSalary->basic ?? 0,
                    'hr_notes'            => $request->hr_notes,

                    'allowances'          => $payroll->allowances ?? 0,
                    'bonuses'             => $payroll->bonuses ?? 0,
                    'gross_salary'        => $payroll->grossSalary ?? 0,

                    'tax'                 => $payroll->employeeDeducations->tax ?? 0,
                    'social_security'     => $payroll->employeeDeducations->social_security ?? 0,
                    'loans'               => $payroll->employeeDeducations->loans ?? 0,
                    'penalties'           => $payroll->employeeDeducations->penalties ?? 0,
                    'other_deductions'    => $payroll->employeeDeducations->other_deductions ?? 0,
                    'total_deductions'    => $payroll->employeeDeducations->total_deductions ?? 0,

                    'net_salary'          => $payroll->netSalary ?? 0,
                    'status'              => 'processed',

                    'total_attendance'    => $payroll->employeeAttendance->totalAttendenceInMonth ?? 0,
                    'total_nightshift'    => $payroll->employeeAttendance->nightShiftAttendances ?? 0,
                    'nightshift_bonus'    => $payroll->employeeBonuses->nightShiftBonus ?? $payroll->employeeBonuses->nightShiftAttendenceBonus ?? 0,
                    'attendance_bonus'    => $payroll->employeeBonuses->attendanceBonus ?? $payroll->employeeBonuses->attendenceBonuses ?? 0,
                    'holiday_bonus'       => $payroll->employeeBonuses->holidayBonus ?? 0,
                    'overtime_bonus'      => $payroll->employeeBonuses->overtimeBonus ?? 0,
                    'total_holidays'      => $payroll->employeeAttendance->holiday ?? 0,
                    'processed_at'        => now(),
                ]);

                $createdPayrollIds[] = $createdPayroll->id;
                $processedCount++;
            }
        });

        if (!$anyEmployee) {
            return response()->json([
                'status' => false,
                'error'  => 'No employees found for payroll generation'
            ], 404);
        }

        if (!empty($createdPayrollIds)) {
            $createdPayrolls = Payroll::whereIn('id', $createdPayrollIds)->get();

            // Multiple generate runs landing in the same calendar month share one
            // history row (aggregated) instead of each run creating its own —
            // the history list groups by month, not by exact generation date range.
            $history = PayrollHistory::whereYear('start_date', $start->year)
                ->whereMonth('start_date', $start->month)
                ->first();

            if ($history) {
                $existingStart = Carbon::parse($history->start_date);
                $existingEnd = Carbon::parse($history->end_date);

                $history->update([
                    'start_date'       => $start->lt($existingStart) ? $start->toDateTimeString() : $history->start_date,
                    'end_date'         => $end->gt($existingEnd) ? $end->toDateTimeString() : $history->end_date,
                    'total_employees'  => $history->total_employees + $createdPayrolls->count(),
                    'total_salary'     => max(0, $history->total_salary + $createdPayrolls->sum('net_salary')),
                    'total_deductions' => $history->total_deductions + $createdPayrolls->sum('total_deductions'),
                    'total_tax'        => $history->total_tax + $createdPayrolls->sum('tax'),
                    'total_bonuses'    => $history->total_bonuses + $createdPayrolls->sum('bonuses'),
                    'payment_method'   => collect(explode(', ', $history->payment_method))
                        ->merge($createdPayrolls->pluck('payment_method'))
                        ->filter()
                        ->unique()
                        ->implode(', '),
                ]);
            } else {
                $history = PayrollHistory::create([
                    'start_date'        => $start->toDateTimeString(),
                    'end_date'          => $end->toDateTimeString(),
                    'total_employees'   => $createdPayrolls->count(),
                    'total_salary'      => max(0, $createdPayrolls->sum('net_salary')),
                    'total_deductions'  => $createdPayrolls->sum('total_deductions'),
                    'total_tax'         => $createdPayrolls->sum('tax'),
                    'total_bonuses'     => $createdPayrolls->sum('bonuses'),
                    'payment_method'    => $createdPayrolls->pluck('payment_method')->unique()->implode(', '),
                ]);
            }

            Payroll::whereIn('id', $createdPayrollIds)->update(['payroll_history_id' => $history->id]);
        }

        return response()->json([
            'status'    => true,
            'processed' => $processedCount,
            'skipped'   => $skipped,
            'message'   => "Payroll generated for {$processedCount} employees. Skipped " . count($skipped) . ".",
        ]);
    }


    public function isGeneratedPayrollInPeriod($employeeId, $start_date, $end_date)
    {
        $employee = Employee::with(['salary', 'attendancelogs', 'leaves'])->find($employeeId);

        if (!$employee) {
            return response()->json([
                'message' => "Employee Salary not found."
            ], 403);
        }

        try {
            $start = Carbon::createFromFormat('d-m-Y', $start_date)->startOfDay();
            $end   = Carbon::createFromFormat('d-m-Y', $end_date)->endOfDay();
        } catch (\Exception $e) {
            return response()->json([
                'message' => "Invalid date format. Use DD-MM-YYYY."
            ], 422);
        }

        $existingPayroll = Payroll::where('employee_id', $employee->id)
            ->where(function ($query) use ($start, $end) {
                $query->whereBetween('start_date', [$start, $end])
                    ->orWhereBetween('end_date', [$start, $end]);
            })
            ->first();

        if ($existingPayroll) {
            return response()->json([
                'status' => true,
                'message' => "Payroll already exists for this period.",
                'start_date' => $start->format('d-m-Y'),
                'end_date' => $end->format('d-m-Y')
            ], 200);
        }

        return response()->json([
            'status' => false,
            'message' => "Payroll does not exist for this period.",
            'start_date' => $start->format('d-m-Y'),
            'end_date' => $end->format('d-m-Y')
        ], 200);
    }

    public function payrollCalculations($stdate, $endate)
    {
        if (!$stdate || !$endate) {
            return response()->json([
                'status' => false,
                'message' => 'Start date and end date are required.'
            ], 400);
        }

        try {

            $start = Carbon::parse($stdate)->startOfDay();
            $end   = Carbon::parse($endate)->endOfDay();
        } catch (\Exception $e) {
            return response()->json([
                'status' => false,
                'message' => 'Invalid date format.'
            ], 400);
        }

        $payrollQuery = Payroll::query()
            ->where(function ($q) use ($start, $end) {
                $q->where('start_date', '<=', $end)
                    ->where('end_date', '>=', $start);
            })
            ->whereHas('employee', fn($q) => $q->where('is_active', 1));

        $payrollCount = (clone $payrollQuery)->count();
        $totalRequests = $payrollCount;

        $totalOutstandingPayroll = (clone $payrollQuery)->sum('net_salary');

        $totalEmployeeSalary = Employee::where('is_active', 1)
            ->with('salary')
            ->get()
            ->sum(fn($employee) => $employee->salary->total_salary ?? 0);

        $newEmployee = Employee::where('is_active', 1)
            ->where('created_at', '>=', Carbon::now()->subDays(30))
            ->count();

        return response()->json([
            'status' => true,
            'payrollcount' => $payrollCount,
            'totalOutstandingPayroll' => max(0, floor($totalOutstandingPayroll)),
            'avarageOutstandingPayroll' => $payrollCount > 0 ? max(0, floor($totalOutstandingPayroll / $payrollCount)) : 0,
            'totalEmployeeSalary' => floor($totalEmployeeSalary),
            'totalEmployee' => Employee::where('is_active', 1)->count(),
            'totalRequests' => $totalRequests,
            'newEmployee' => $newEmployee,

            'date' => [$start->toDateTimeString(), $end->toDateTimeString()],
        ]);
    }

    private function applyPayrollShiftAndTypeFilter($query, ?int $shiftId, ?int $employeeTypeId, string $rangeStart, string $rangeEnd)
    {
        if ($employeeTypeId) {
            $query->whereHas('employee', function ($q) use ($employeeTypeId) {
                $q->where('employee_type_id', $employeeTypeId);
            });
        }
        if ($shiftId) {
            $query->whereHas('employee.attendancelogs', function ($q) use ($shiftId, $rangeStart, $rangeEnd) {
                $q->where('shift_id', $shiftId)
                  ->whereBetween('attendance_date', [$rangeStart, $rangeEnd]);
            });
        }

        return $query;
    }

    public function exportPayroll(Request $request)
    {
        $validated = $request->validate([
            'shift_id' => ['nullable', 'integer', 'exists:employee_shifts,id'],
            'employee_type_id' => ['nullable', 'integer', 'exists:employee_types,id'],
        ]);
        $shiftId = $validated['shift_id'] ?? null;
        $employeeTypeId = $validated['employee_type_id'] ?? null;
        $shiftName = $shiftId ? EmployeeShift::find($shiftId)?->name : null;
        $employeeTypeName = $employeeTypeId ? EmployeeType::find($employeeTypeId)?->name : null;

        $historyId = $request->query('payroll_history_id');

        if ($historyId) {
            $history = PayrollHistory::find($historyId);

            if (!$history) {
                return response()->json(['error' => 'Payroll history not found'], 404);
            }

            $historyStart = Carbon::parse($history->start_date)->format('Y-m-d');
            $historyEnd = Carbon::parse($history->end_date)->format('Y-m-d');

            $historyQuery = Payroll::where('payroll_history_id', $historyId);
            $this->applyPayrollShiftAndTypeFilter($historyQuery, $shiftId, $employeeTypeId, $historyStart, $historyEnd);

            if (!$historyQuery->exists()) {
                return response()->json(['no_data' => true, 'message' => 'No payrolls found for this batch'], 200);
            }

            return Excel::download(
                new PayrollExport(null, null, $historyId, $shiftId, $employeeTypeId, $historyStart, $historyEnd, $shiftName, $employeeTypeName),
                'payroll_' . $historyStart . '_to_' . $historyEnd . '.xlsx'
            );
        }

        $startInput = $request->query('start');
        $endInput = $request->query('end');

        if (!$startInput || !$endInput) {
            return response()->json(['error' => 'Start and end dates are required'], 400);
        }

        $start = Carbon::parse($startInput)->startOfDay();
        $end = Carbon::parse($endInput)->endOfDay();

        if ($end->lt($start)) {
            return response()->json(['error' => 'End date must be greater than or equal to start date'], 422);
        }

        $periodQuery = Payroll::where('start_date', '<=', $end)
            ->where('end_date', '>=', $start);
        $this->applyPayrollShiftAndTypeFilter($periodQuery, $shiftId, $employeeTypeId, $start->format('Y-m-d'), $end->format('Y-m-d'));

        if (!$periodQuery->exists()) {
            return response()->json(['no_data' => true, 'message' => 'No payrolls found for this period'], 200);
        }

        return Excel::download(
            new PayrollExport($start->format('Y-m-d H:i:s'), $end->format('Y-m-d H:i:s'), null, $shiftId, $employeeTypeId, null, null, $shiftName, $employeeTypeName),
            'payroll_' . $start->format('Y-m-d') . '_to_' . $end->format('Y-m-d') . '.xlsx'
        );
    }

    public function exportPayrollPdf(Request $request)
    {
        $validated = $request->validate([
            'shift_id' => ['nullable', 'integer', 'exists:employee_shifts,id'],
            'employee_type_id' => ['nullable', 'integer', 'exists:employee_types,id'],
        ]);
        $shiftId = $validated['shift_id'] ?? null;
        $employeeTypeId = $validated['employee_type_id'] ?? null;
        $shiftName = $shiftId ? EmployeeShift::find($shiftId)?->name : null;
        $employeeTypeName = $employeeTypeId ? EmployeeType::find($employeeTypeId)?->name : null;

        $historyId = $request->query('payroll_history_id');

        if ($historyId) {
            $history = PayrollHistory::find($historyId);

            if (!$history) {
                return response()->json(['error' => 'Payroll history not found'], 404);
            }

            $rangeStart = Carbon::parse($history->start_date)->format('Y-m-d');
            $rangeEnd = Carbon::parse($history->end_date)->format('Y-m-d');

            $query = Payroll::with(['employee.employeeSection', 'employee.salary'])->where('payroll_history_id', $historyId);
        } else {
            $startInput = $request->query('start');
            $endInput = $request->query('end');

            if (!$startInput || !$endInput) {
                return response()->json(['error' => 'Start and end dates are required'], 400);
            }

            $start = Carbon::parse($startInput)->startOfDay();
            $end = Carbon::parse($endInput)->endOfDay();

            if ($end->lt($start)) {
                return response()->json(['error' => 'End date must be greater than or equal to start date'], 422);
            }

            $rangeStart = $start->format('Y-m-d');
            $rangeEnd = $end->format('Y-m-d');

            $query = Payroll::with(['employee.employeeSection', 'employee.salary'])
                ->where('start_date', '<=', $end)
                ->where('end_date', '>=', $start);
        }

        $this->applyPayrollShiftAndTypeFilter($query, $shiftId, $employeeTypeId, $rangeStart, $rangeEnd);

        $payrolls = $query->get();

        if ($payrolls->isEmpty()) {
            return response()->json(['no_data' => true, 'message' => 'No payrolls found for this selection'], 200);
        }

        $rows = $payrolls->map(function ($payroll) {
            $employee = $payroll->employee;
            $salary = $employee->salary ?? null;
            $breakdown = PayrollExport::attendanceBreakdown($payroll);

            return [
                'employee_name' => trim(($employee->first_name ?? '') . ' ' . ($employee->last_name ?? '')) ?: '-',
                'designation' => $employee->designation ?? '-',
                'section' => $employee->employeeSection->name ?? '-',
                'joining_date' => $employee->joining_date ? Carbon::parse($employee->joining_date)->format('d/m/Y') : '-',
                'card_no' => $employee->employee_no ?? '-',
                'basic_salary' => $payroll->basic_salary,
                'house_rent' => $salary->house_rent ?? 0,
                'medical_allowance' => $salary->medical_allowance ?? 0,
                'conveyance_allowance' => $salary->transport_allowance ?? 0,
                'total_salary' => $payroll->gross_salary,
                'off_days' => $breakdown['off_days'],
                'leave_days' => $breakdown['leave_days'],
                'absent_days' => $breakdown['absent_days'],
                'actual_attendance' => $payroll->total_attendance,
                'in_total_attendance' => $payroll->total_payable_days,
                'salary_ded_absent' => $payroll->other_deductions,
                'night_bill' => $payroll->nightshift_bonus,
                'attendance_bonus' => $payroll->attendance_bonus,
                'net_salary' => $payroll->net_salary,
                'remarks' => $payroll->hr_notes,
            ];
        });

        $subtitle = $shiftName
            ? "Shift: {$shiftName}"
            : ($employeeTypeName ? "Employee Type: {$employeeTypeName}" : null);

        $totalDays = Carbon::parse($rangeStart)->diffInDays(Carbon::parse($rangeEnd)) + 1;
        $weekendHolidayBreakdown = PayrollExport::weekendHolidayBreakdown($rangeStart, $rangeEnd);

        $pdf = Pdf::loadView('pdf-templates.payroll', [
            'payrolls' => $rows,
            'dateRange' => [
                'start' => Carbon::parse($rangeStart)->format('d/m/Y'),
                'end' => Carbon::parse($rangeEnd)->format('d/m/Y'),
            ],
            'subtitle' => $subtitle,
            'totalDays' => $totalDays,
            'workingDays' => $weekendHolidayBreakdown['working_days'],
            'whDays' => $weekendHolidayBreakdown['wh_days'],
        ])->setPaper('A4', 'landscape');

        $filename = sprintf('payroll_%s_to_%s.pdf', $rangeStart, $rangeEnd);

        return response($pdf->output(), 200)
            ->header('Content-Type', 'application/pdf')
            ->header('Content-Disposition', 'inline; filename="' . $filename . '"');
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
