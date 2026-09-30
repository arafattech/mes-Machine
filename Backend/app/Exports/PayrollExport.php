<?php

namespace App\Exports;

use App\Exports\Concerns\HasCompanyReportLayout;
use App\Models\Holiday;
use App\Models\LeaveDate;
use App\Models\Payroll;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use Carbon\Carbon;

class PayrollExport implements FromCollection, WithHeadings, WithStyles, WithEvents, WithColumnWidths
{
    use HasCompanyReportLayout;

    private $start;
    private $end;
    private $historyId;
    private $shiftId;
    private $employeeTypeId;
    private $shiftRangeStart;
    private $shiftRangeEnd;
    private $shiftName;
    private $employeeTypeName;
    private int $rowCount = 0;
    private string $lastCol = 'Y';

    public function __construct(
        $start = null,
        $end = null,
        $historyId = null,
        $shiftId = null,
        $employeeTypeId = null,
        $shiftRangeStart = null,
        $shiftRangeEnd = null,
        $shiftName = null,
        $employeeTypeName = null
    ) {
        $this->start = $start;
        $this->end = $end;
        $this->historyId = $historyId;
        $this->shiftId = $shiftId;
        $this->employeeTypeId = $employeeTypeId;
        $this->shiftRangeStart = $shiftRangeStart ?? $start;
        $this->shiftRangeEnd = $shiftRangeEnd ?? $end;
        $this->shiftName = $shiftName;
        $this->employeeTypeName = $employeeTypeName;
    }

    public function collection()
    {
        $query = Payroll::with(['employee.employeeSection', 'employee.salary']);

        if ($this->historyId) {
            $query->where('payroll_history_id', $this->historyId);
        } elseif ($this->start && $this->end) {
            $query->where('start_date', '<=', $this->end)
                  ->where('end_date', '>=', $this->start);
        }

        if ($this->employeeTypeId) {
            $query->whereHas('employee', function ($q) {
                $q->where('employee_type_id', $this->employeeTypeId);
            });
        }

        if ($this->shiftId && $this->shiftRangeStart && $this->shiftRangeEnd) {
            $rangeStart = Carbon::parse($this->shiftRangeStart)->format('Y-m-d');
            $rangeEnd = Carbon::parse($this->shiftRangeEnd)->format('Y-m-d');

            $query->whereHas('employee.attendancelogs', function ($q) use ($rangeStart, $rangeEnd) {
                $q->where('shift_id', $this->shiftId)
                  ->whereBetween('attendance_date', [$rangeStart, $rangeEnd]);
            });
        }

        $payrolls = $query->get();

        $exportRows = collect();
        $rowCount = 1;

        foreach ($payrolls as $payroll) {
            $employee = $payroll->employee;
            $salary = $employee->salary ?? null;
            $breakdown = self::attendanceBreakdown($payroll);

            $exportRows->push([
                'SL' => $rowCount++,
                'Employee Name' => trim(($employee->first_name ?? '') . ' ' . ($employee->last_name ?? '')),
                'Designation' => $employee->designation ?? '',
                'Section' => $employee->employeeSection->name ?? '',
                'Joining Date' => $employee->joining_date ? Carbon::parse($employee->joining_date)->format('d/m/Y') : '',
                'Card No.' => $employee->employee_no ?? '',
                'Basic Salary' => $payroll->basic_salary,
                'House Rent' => $salary->house_rent ?? 0,
                'Medical Allowance' => $salary->medical_allowance ?? 0,
                'Conveyance Allowance' => $salary->transport_allowance ?? 0,
                'Total Salary' => $payroll->gross_salary,
                'Off Days' => $breakdown['off_days'],
                'Leave Days' => $breakdown['leave_days'],
                'Absent Days' => $breakdown['absent_days'],
                'Actual Attendance' => $payroll->total_attendance,
                'In Total Attendance' => $payroll->total_payable_days,
                'Salary Ded. for Absent' => $payroll->other_deductions,
                'Salary Ded. for Various Reason' => '',
                'Night Bill' => $payroll->nightshift_bonus,
                'Attendance Bonus' => $payroll->attendance_bonus,
                'Increment' => '',
                'Stamp' => '',
                'Net Salary' => $payroll->net_salary,
                'Signature' => '',
                'Remarks' => $payroll->hr_notes,
            ]);
        }

        $this->rowCount = $exportRows->count();

        return $exportRows;
    }

    public static function attendanceBreakdown(Payroll $payroll): array
    {
        $employee = $payroll->employee;

        if (!$employee || !$payroll->start_date || !$payroll->end_date) {
            return ['off_days' => 0, 'leave_days' => 0, 'absent_days' => 0];
        }

        $start = Carbon::parse($payroll->start_date);
        $end = Carbon::parse($payroll->end_date);

        $offDays = $employee->employeeWeekend()
            ->whereBetween('weekend_date', [$start, $end])
            ->where('status', 'APPROVED')
            ->where('type', '!=', 'LEAVE')
            ->pluck('weekend_date')
            ->unique()
            ->count();

        $leaveDays = LeaveDate::where('employee_id', $employee->id)
            ->whereBetween('leave_date', [$start, $end])
            ->whereHas('leaveRequest', function ($q) {
                $q->where('final_status', 'approved')
                    ->whereHas('leaveType', function ($typeQuery) {
                        $typeQuery->where('is_paid', true);
                    });
            })
            ->count();

        $totalDaysInPeriod = $start->diffInDays($end) + 1;
        $absentDays = max(0, $totalDaysInPeriod - (int) $payroll->total_attendance - $leaveDays - $offDays);

        return ['off_days' => $offDays, 'leave_days' => $leaveDays, 'absent_days' => $absentDays];
    }

    public function headings(): array
    {
        return [
            'SL',
            'Employee Name',
            'Designation',
            'Section',
            'Joining Date',
            'Card No.',
            'Basic Salary',
            'House Rent',
            'Medical Allowance',
            'Conveyance Allowance',
            'Total Salary',
            'Off Days',
            'Leave Days',
            'Absent Days',
            'Actual Attendance',
            'In Total Attendance',
            'Salary Ded. for Absent',
            'Salary Ded. for Various Reason',
            'Night Bill',
            'Attendance Bonus',
            'Increment',
            'Stamp',
            'Net Salary',
            'Signature',
            'Remarks',
        ];
    }

    public function columnWidths(): array
    {
        return [
            'A' => 5,   // SL
            'B' => 20,  // Employee Name
            'C' => 16,  // Designation
            'D' => 14,  // Section
            'E' => 12,  // Joining Date
            'F' => 10,  // Card No.
            'G' => 12,  // Basic Salary
            'H' => 12,  // House Rent
            'I' => 12,  // Medical Allowance
            'J' => 12,  // Conveyance Allowance
            'K' => 12,  // Total Salary
            'L' => 9,   // Off Days
            'M' => 9,   // Leave Days
            'N' => 10,  // Absent Days
            'O' => 11,  // Actual Attendance
            'P' => 11,  // In Total Attendance
            'Q' => 13,  // Salary Ded. for Absent
            'R' => 15,  // Salary Ded. for Various Reason
            'S' => 10,  // Night Bill
            'T' => 12,  // Attendance Bonus
            'U' => 10,  // Increment
            'V' => 9,   // Stamp
            'W' => 12,  // Net Salary
            'X' => 12,  // Signature
            'Y' => 14,  // Remarks
        ];
    }

    public function styles(Worksheet $sheet): array
    {
        return [
            1 => [
                'font' => ['bold' => true, 'size' => 11],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['argb' => 'FFB8CCE4'],
                ],
            ],
        ];
    }

    private function reportTitle(): string
    {
        $title = ($this->start && $this->end)
            ? 'Salary Sheet of Employees for ' . Carbon::parse($this->start)->format('d/m/Y') . ' to ' . Carbon::parse($this->end)->format('d/m/Y')
            : 'Salary Sheet of Employees (' . Carbon::now()->format('F Y') . ')';

        $subtitle = $this->reportSubtitle();

        return $subtitle ? "{$title} | {$subtitle}" : $title;
    }

    private function reportSubtitle(): ?string
    {
        if ($this->shiftName) {
            return "Shift: {$this->shiftName}";
        }
        if ($this->employeeTypeName) {
            return "Employee Type: {$this->employeeTypeName}";
        }

        return null;
    }

    private function totalDaysInPeriod(): ?int
    {
        if (!$this->start || !$this->end) {
            return null;
        }

        $start = Carbon::parse($this->start)->startOfDay();
        $end = Carbon::parse($this->end)->startOfDay();

        return (int) $start->diffInDays($end) + 1;
    }

    public static function weekendHolidayBreakdown($start, $end): array
    {
        $start = Carbon::parse($start)->startOfDay();
        $end = Carbon::parse($end)->startOfDay();
        $totalDays = (int) $start->diffInDays($end) + 1;

        $fridayCount = 0;
        $cursor = $start->copy();
        while ($cursor->lte($end)) {
            if ($cursor->isFriday()) {
                $fridayCount++;
            }
            $cursor->addDay();
        }

        $holidayDates = [];
        $companyHolidays = Holiday::where('start_date', '<=', $end)
            ->where('end_date', '>=', $start)
            ->get(['start_date', 'end_date']);

        foreach ($companyHolidays as $holiday) {
            $day = Carbon::parse($holiday->start_date)->startOfDay()->max($start);
            $holidayEnd = Carbon::parse($holiday->end_date)->startOfDay()->min($end);
            while ($day->lte($holidayEnd)) {
                if (!$day->isFriday()) {
                    $holidayDates[$day->toDateString()] = true;
                }
                $day->addDay();
            }
        }

        $whDays = $fridayCount + count($holidayDates);

        return [
            'working_days' => max(0, $totalDays - $whDays),
            'wh_days' => $whDays,
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $totalDays = $this->totalDaysInPeriod();
                $leftHeaderLines = null;

                if ($totalDays !== null) {
                    $breakdown = self::weekendHolidayBreakdown($this->start, $this->end);
                    $leftHeaderLines = [
                        "Total Days of The Month : {$totalDays}",
                        "Working Day of The Month : {$breakdown['working_days']}",
                        "W/H Days of The Month : {$breakdown['wh_days']}",
                    ];
                }

                $this->applyCompanyReportLayout(
                    $sheet,
                    $this->lastCol,
                    $this->reportTitle(),
                    $this->rowCount,
                    ['Prepared By', 'AGM', 'DGM', 'GM', 'Director', 'Managing Director'],
                    true,
                    $leftHeaderLines
                );
            },
        ];
    }
}
