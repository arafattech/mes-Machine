<?php

namespace App\Services\hrModule;

use App\Models\AttendanceLog;
use App\Models\BonusType;
use App\Models\Employee;
use App\Models\EmployeeBonus;
use App\Models\EmployeeShift;
use App\Models\EmployeeWeekend;
use App\Models\Holiday;
use App\Models\LeaveDate;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Support\Facades\Log;

class OvertimeBonusService
{
    private const BONUS_TYPE_OVERTIME = 'OVERTIME';
    private const BONUS_TYPE_ATTENDANCE = 'ATTENDANCE';
    private const BONUS_TYPE_NIGHT_SHIFT = 'NIGHTSHIFT';
    private const BONUS_TYPE_RAMADAN = 'RAMADAN';
    private const BONUS_TYPE_HOLIDAY = 'HOLIDAY_BONUS';
    private const BONUS_TYPE_HOLIDAY_OVERTIME = 'HOLIDAY_OVERTIME';
    private const BONUS_TYPE_EXTRA_SHIFT = 'EXTRA_SHIFT';
    private const LEAVE_TYPE_CASUAL = 'CASUALLEAVE';
    private const LEAVE_TYPE_MEDICAL = 'MEDICALLEAVE';
    private const ATTENDANCE_BONUS_AMOUNT = 800;
    private const HOLIDAY_BONUS_MODE_DOUBLE = 'DOUBLE';
    private const HOLIDAY_BONUS_MODE_TRIPLE = 'TRIPLE';
    private const HOLIDAY_BONUS_MODE_FIXED = 'FIXED';
    private const WORKING_HOURS_PER_DAY = 8;
    private const MAX_OVERTIME_HOURS_PER_DAY = 8;

    public function approveOvertimeBonus(AttendanceLog $attendance): void
    {
        $attendance->loadMissing(['employee.employeeSection', 'employee.salary', 'shift']);

        $employee = $attendance->employee
            ?: Employee::with(['employeeSection', 'salary'])->find($attendance->employee_id);

        if (! $employee) {
            return;
        }

        $overtimeMinutes = (int) ($attendance->overtime_minutes ?? 0);
        $payableHours = $this->payableOvertimeHours($overtimeMinutes);

        if ($payableHours < 1) {
            return;
        }

        $totalSalary = (float) optional($employee->salary)->total_salary;
        $amount = $totalSalary > 0
            ? $this->calculateOvertimeAmount($totalSalary, $payableHours, $attendance->attendance_date)
            : 0;

        $this->saveAttendanceLogBonus(
            $attendance,
            $employee,
            self::BONUS_TYPE_OVERTIME,
            $amount,
            $overtimeMinutes,
            'SALARY_BASED',
            []
        );
    }

    public function syncForAttendance(AttendanceLog $attendance, array $attributes = []): void
    {
        $attendance->loadMissing(['employee.employeeSection', 'employee.salary', 'shift']);

        $employee = $attendance->employee
            ?: Employee::with(['employeeSection', 'salary'])->find($attendance->employee_id);
        $shift = $attendance->shift ?: EmployeeShift::find($attendance->shift_id);

        if (! $employee) {
            Log::warning('Bonus sync skipped because employee was not found.', [
                'attendance_log_id' => $attendance->id,
                'employee_id' => $attendance->employee_id,
            ]);

            return;
        }

        $this->syncNightShiftBonus($attendance, $employee, $shift, $attributes);
        $this->syncOvertimeBonus($attendance, $employee, $attributes);
        $this->syncAttendanceBonus($attendance, $employee, $attributes);
        $this->syncRamadanBonus($attendance, $employee, $shift);
        $this->syncHolidayDateBonus($attendance, $employee);
    }

    private function syncNightShiftBonus(
        AttendanceLog $attendance,
        Employee $employee,
        ?EmployeeShift $shift,
        array $attributes
    ): void {
        if (! $attendance->check_out_time || ! $shift || ! $shift->is_night) {
            $this->clearAttendanceLogBonus($attendance, self::BONUS_TYPE_NIGHT_SHIFT);
            return;
        }

        $this->saveAttendanceLogBonus(
            $attendance,
            $employee,
            self::BONUS_TYPE_NIGHT_SHIFT,
            (float) ($shift->night_shift_bonus_amount ?? 0),
            null,
            'FIXED',
            $attributes
        );
    }

    private function syncRamadanBonus(AttendanceLog $attendance, Employee $employee, ?EmployeeShift $shift): void
    {
        $isEligible = (bool) ($attendance->check_out_time && $shift && $shift->is_ramadan_bonus);

        if ($isEligible && $this->hasOtherDutyLogSameDay($attendance, 'is_ramadan_duty')) {
            $isEligible = false;
        }

        if ($attendance->is_ramadan_duty !== $isEligible) {
            $attendance->is_ramadan_duty = $isEligible;
            $attendance->save();
        }

        if (! $isEligible) {
            $this->clearAttendanceLogBonus($attendance, self::BONUS_TYPE_RAMADAN);
            return;
        }

        $this->saveAttendanceLogBonus(
            $attendance,
            $employee,
            self::BONUS_TYPE_RAMADAN,
            (float) ($shift->ramadan_bonus_amount ?? 0),
            null,
            'FIXED',
            []
        );
    }

    private function syncHolidayDateBonus(AttendanceLog $attendance, Employee $employee): void
    {
        $isEligible = (bool) ($attendance->check_in_time && $this->holidayBonusConfigFor($employee, $attendance->attendance_date));

        if ($isEligible && $this->hasOtherDutyLogSameDay($attendance, 'is_holiday_bonus_duty')) {
            $isEligible = false;
        }

        if ($attendance->is_holiday_bonus_duty !== $isEligible) {
            $attendance->is_holiday_bonus_duty = $isEligible;
            $attendance->save();
        }

        if (! $isEligible) {
            $this->clearAttendanceLogBonus($attendance, self::BONUS_TYPE_HOLIDAY);
            $this->clearAttendanceLogBonus($attendance, self::BONUS_TYPE_HOLIDAY_OVERTIME);
            return;
        }

        if ($this->holidayBonusConfigFor($employee, $attendance->attendance_date)?->bonus_mode !== self::HOLIDAY_BONUS_MODE_TRIPLE) {
            $this->clearAttendanceLogBonus($attendance, self::BONUS_TYPE_HOLIDAY_OVERTIME);
        }
    }

    private function holidayBonusConfigFor(Employee $employee, ?string $attendanceDate): ?EmployeeWeekend
    {
        if (! $attendanceDate) {
            return null;
        }

        return EmployeeWeekend::where('employee_id', $employee->id)
            ->whereDate('weekend_date', Carbon::parse($attendanceDate)->toDateString())
            ->whereNotNull('bonus_mode')
            ->first();
    }

    private function hasOtherDutyLogSameDay(AttendanceLog $attendance, string $dutyFlagColumn): bool
    {
        return AttendanceLog::where('employee_id', $attendance->employee_id)
            ->where('attendance_date', $attendance->attendance_date)
            ->where('id', '!=', $attendance->id)
            ->where($dutyFlagColumn, true)
            ->exists();
    }

    public function approveHolidayDateBonus(AttendanceLog $attendance): void
    {
        $attendance->loadMissing('employee.salary');
        $employee = $attendance->employee ?: Employee::with('salary')->find($attendance->employee_id);

        if (! $employee) {
            return;
        }

        $config = $this->holidayBonusConfigFor($employee, $attendance->attendance_date);

        if (! $config) {
            return;
        }

        if ($config->bonus_mode === self::HOLIDAY_BONUS_MODE_FIXED) {
            $amount = (float) $config->bonus_amount;
            $calculationType = 'FIXED';
        } else {
            $totalSalary = (float) optional($employee->salary)->total_salary;

            if ($totalSalary <= 0) {
                return;
            }

            $amount = round($totalSalary / 30, 2);
            $calculationType = $config->bonus_mode === self::HOLIDAY_BONUS_MODE_TRIPLE
                ? 'HOLIDAY_TRIPLE'
                : 'HOLIDAY_DOUBLE';
        }

        if ($amount <= 0) {
            return;
        }

        $this->saveAttendanceLogBonus(
            $attendance,
            $employee,
            self::BONUS_TYPE_HOLIDAY,
            $amount,
            null,
            $calculationType,
            []
        );

        if ($config->bonus_mode === self::HOLIDAY_BONUS_MODE_TRIPLE) {
            $this->saveAttendanceLogBonus(
                $attendance,
                $employee,
                self::BONUS_TYPE_HOLIDAY_OVERTIME,
                $amount,
                null,
                'HOLIDAY_OVERTIME',
                []
            );
        } else {
            $this->clearAttendanceLogBonus($attendance, self::BONUS_TYPE_HOLIDAY_OVERTIME);
        }
    }

    public function approveExtraShiftBonus(AttendanceLog $attendance): void
    {
        $attendance->loadMissing('employee.salary');
        $employee = $attendance->employee ?: Employee::with('salary')->find($attendance->employee_id);

        if (! $employee) {
            return;
        }

        $totalSalary = (float) optional($employee->salary)->total_salary;

        if ($totalSalary <= 0) {
            return;
        }

        $amount = round($totalSalary / 30, 2);

        $this->saveAttendanceLogBonus(
            $attendance,
            $employee,
            self::BONUS_TYPE_EXTRA_SHIFT,
            $amount,
            null,
            'SALARY_BASED',
            []
        );
    }

    public function isHolidayBonusOffDay(Employee $employee, ?string $attendanceDate): bool
    {
        return $this->holidayBonusConfigFor($employee, $attendanceDate) !== null;
    }

    private function syncOvertimeBonus(
        AttendanceLog $attendance,
        Employee $employee,
        array $attributes
    ): void {
        $overtimeMinutes = (int) ($attendance->overtime_minutes ?? 0);
        $payableHours = $this->payableOvertimeHours($overtimeMinutes);

        if (! $attendance->has_overtime || $payableHours < 1) {
            $this->clearAttendanceLogBonus($attendance, self::BONUS_TYPE_OVERTIME);
            return;
        }

        if (! $this->isOvertimeEligible($employee)) {
            $this->clearAttendanceLogBonus($attendance, self::BONUS_TYPE_OVERTIME);
            return;
        }

        $totalSalary = (float) optional($employee->salary)->total_salary;

        if ($totalSalary <= 0) {
            $this->clearAttendanceLogBonus($attendance, self::BONUS_TYPE_OVERTIME);
            return;
        }

        $amount = $this->calculateOvertimeAmount(
            $totalSalary,
            $payableHours,
            $attendance->attendance_date
        );

        $this->saveAttendanceLogBonus(
            $attendance,
            $employee,
            self::BONUS_TYPE_OVERTIME,
            $amount,
            $overtimeMinutes,
            'SALARY_BASED',
            $attributes
        );
    }

    private function syncAttendanceBonus(
        AttendanceLog $attendance,
        Employee $employee,
        array $attributes
    ): void {
        $date = Carbon::parse($attendance->attendance_date);

        if (! $this->isMonthComplete($date)) {
            $this->clearMonthlyAttendanceBonus($employee, $date);
            return;
        }

        if (! $this->isAttendanceEligible($employee)) {
            $this->clearMonthlyAttendanceBonus($employee, $date);
            return;
        }

        $allowedLeaveDates = $this->eligibleMonthlyLeaveDates($employee, $date);

        if ($allowedLeaveDates === null) {
            $this->clearMonthlyAttendanceBonus($employee, $date);
            return;
        }

        if (! $this->hasFullMonthlyAttendance($employee, $date, $allowedLeaveDates)) {
            $this->clearMonthlyAttendanceBonus($employee, $date);
            return;
        }

        $this->saveMonthlyAttendanceBonus(
            $attendance,
            $employee,
            $date,
            $attributes
        );
    }

    private function isOvertimeEligible(Employee $employee): bool
    {
        return (bool) optional($employee->employeeSection)->is_overtimeBonus;
    }

    private function isAttendanceEligible(Employee $employee): bool
    {
        return (bool) optional($employee->employeeSection)->is_attendanceBonus;
    }

    private function payableOvertimeHours(int $overtimeMinutes): int
    {
        if ($overtimeMinutes < 60) {
            return 0;
        }

        return min(intdiv($overtimeMinutes, 60), self::MAX_OVERTIME_HOURS_PER_DAY);
    }

    private function calculateOvertimeAmount(float $totalSalary, int $payableHours, string $attendanceDate): float
    {
        $date = Carbon::parse($attendanceDate);

        $dailySalary = $totalSalary / $date->daysInMonth;
        $hourlyRate = $dailySalary / self::WORKING_HOURS_PER_DAY;

        return round($payableHours * $hourlyRate, 2);
    }

    private function isMonthComplete(Carbon $date): bool
    {
        $attendanceDate = $date->copy()->startOfDay();
        $endOfMonth = $date->copy()->endOfMonth()->startOfDay();

        return $attendanceDate->greaterThanOrEqualTo($endOfMonth)
            || now()->startOfDay()->greaterThan($endOfMonth);
    }

    private function eligibleMonthlyLeaveDates(Employee $employee, Carbon $date): ?array
    {
        $leaveDatesByType = $this->approvedAllowedLeaveDatesByType($employee, $date);

        $casualLeaveDates = $leaveDatesByType[self::LEAVE_TYPE_CASUAL] ?? [];
        $medicalLeaveDates = $leaveDatesByType[self::LEAVE_TYPE_MEDICAL] ?? [];

        if (
            count($casualLeaveDates) > 1
            || count($medicalLeaveDates) > 1
            || (count($casualLeaveDates) >= 1 && count($medicalLeaveDates) >= 1)
        ) {
            return null;
        }

        if (count($casualLeaveDates) === 1) {
            return $casualLeaveDates;
        }

        if (count($medicalLeaveDates) === 1) {
            return $medicalLeaveDates;
        }

        return [];
    }

    private function approvedAllowedLeaveDatesByType(Employee $employee, Carbon $date): array
    {
        $startOfMonth = $date->copy()->startOfMonth()->toDateString();
        $endOfMonth = $date->copy()->endOfMonth()->toDateString();

        $leaveDates = LeaveDate::query()
            ->join('leave_requests', 'leave_requests.id', '=', 'leave_dates.leave_id')
            ->leftJoin('leave_types', 'leave_types.id', '=', 'leave_requests.leave_type_id')
            ->where('leave_requests.employee_id', $employee->id)
            ->where('leave_dates.employee_id', $employee->id)
            ->whereBetween('leave_dates.leave_date', [$startOfMonth, $endOfMonth])
            ->whereRaw('LOWER(leave_requests.final_status) = ?', ['approved'])
            ->get([
                'leave_dates.leave_date',
                'leave_types.name as leave_type_name',
                'leave_requests.leave_type_name as request_leave_type_name',
            ]);

        $datesByType = [
            self::LEAVE_TYPE_CASUAL => [],
            self::LEAVE_TYPE_MEDICAL => [],
        ];

        foreach ($leaveDates as $leaveDate) {
            $leaveType = $this->normalizeLeaveType(
                $leaveDate->leave_type_name ?: $leaveDate->request_leave_type_name
            );

            if (! array_key_exists($leaveType, $datesByType)) {
                continue;
            }

            $dateString = Carbon::parse($leaveDate->leave_date)->toDateString();
            $datesByType[$leaveType][$dateString] = $dateString;
        }

        return array_map(
            fn(array $dates) => array_values($dates),
            $datesByType
        );
    }

    private function normalizeLeaveType(?string $leaveType): string
    {
        $normalized = preg_replace('/[^A-Z]/', '', strtoupper((string) $leaveType));

        return match ($normalized) {
            'CASUAL', 'CASUALLEAVE' => self::LEAVE_TYPE_CASUAL,
            'MEDICAL', 'MEDICALLEAVE' => self::LEAVE_TYPE_MEDICAL,
            default => $normalized,
        };
    }

    private function hasFullMonthlyAttendance(Employee $employee, Carbon $date, array $allowedLeaveDates): bool
    {
        $startOfMonth = $date->copy()->startOfMonth();
        $endOfMonth = $date->copy()->endOfMonth();
        $allowedLeaveDateLookup = array_flip($allowedLeaveDates);

        $holidayDates = Holiday::whereDate('start_date', '<=', $endOfMonth->toDateString())
            ->where(function ($query) use ($startOfMonth) {
                $query->whereNull('end_date')
                    ->orWhereDate('end_date', '>=', $startOfMonth->toDateString());
            })
            ->get(['start_date', 'end_date'])
            ->flatMap(function (Holiday $holiday) use ($startOfMonth, $endOfMonth) {
                $holidayStart = Carbon::parse($holiday->start_date)->max($startOfMonth);
                $holidayEnd = Carbon::parse($holiday->end_date ?? $holiday->start_date)->min($endOfMonth);

                return collect(CarbonPeriod::create($holidayStart, $holidayEnd))
                    ->map(fn(Carbon $holidayDate) => $holidayDate->toDateString());
            })
            ->unique()
            ->toArray();

        $requiredWorkingDates = [];

        foreach (CarbonPeriod::create($startOfMonth, $endOfMonth) as $day) {
            $dayString = $day->toDateString();

            if (in_array($dayString, $holidayDates, true)) {
                continue;
            }

            if (array_key_exists($dayString, $allowedLeaveDateLookup)) {
                continue;
            }

            $requiredWorkingDates[] = $dayString;
        }

        $presentDates = AttendanceLog::where('employee_id', $employee->id)
            ->whereBetween('attendance_date', [
                $startOfMonth->toDateString(),
                $endOfMonth->toDateString(),
            ])
            ->whereNotNull('check_in_time')
            ->whereNotNull('check_out_time')
            ->pluck('attendance_date')
            ->map(fn($attendanceDate) => Carbon::parse($attendanceDate)->toDateString())
            ->unique()
            ->toArray();

        foreach ($requiredWorkingDates as $requiredDate) {
            if (! in_array($requiredDate, $presentDates, true)) {
                return false;
            }
        }

        return true;
    }

    private function saveAttendanceLogBonus(
        AttendanceLog $attendance,
        Employee $employee,
        string $bonusTypeName,
        float $amount,
        ?int $overtimeMinutes,
        string $calculationType,
        array $attributes
    ): void {
        $bonus = EmployeeBonus::updateOrCreate(
            [
                'attendance_log_id' => $attendance->id,
                'bonus_type' => $bonusTypeName,
            ],
            [
                ...$this->baseBonusValues(
                    $attendance,
                    $employee,
                    $bonusTypeName,
                    $amount,
                    $overtimeMinutes,
                    $calculationType,
                    $attributes
                ),
                'attendance_date' => Carbon::parse($attendance->attendance_date)->toDateString(),
            ]
        );

        $this->deleteDuplicateAttendanceLogBonuses($attendance, $bonusTypeName, $bonus->id);
    }

    private function saveMonthlyAttendanceBonus(
        AttendanceLog $attendance,
        Employee $employee,
        Carbon $date,
        array $attributes
    ): void {
        $startOfMonth = $date->copy()->startOfMonth()->toDateString();
        $endOfMonth = $date->copy()->endOfMonth()->toDateString();

        $monthlyBonuses = EmployeeBonus::where('emp_id', $employee->id)
            ->where('bonus_type', self::BONUS_TYPE_ATTENDANCE)
            ->whereBetween('attendance_date', [$startOfMonth, $endOfMonth])
            ->orderBy('id')
            ->get();

        $bonus = $monthlyBonuses->first() ?: new EmployeeBonus([
            'emp_id' => $employee->id,
            'bonus_type' => self::BONUS_TYPE_ATTENDANCE,
        ]);

        $bonus->fill([
            ...$this->baseBonusValues(
                $attendance,
                $employee,
                self::BONUS_TYPE_ATTENDANCE,
                self::ATTENDANCE_BONUS_AMOUNT,
                null,
                'FIXED',
                $attributes
            ),
            'attendance_log_id' => $attendance->id,
            'attendance_date' => $endOfMonth,
        ]);
        $bonus->save();

        $duplicateIds = $monthlyBonuses
            ->where('id', '!=', $bonus->id)
            ->pluck('id');

        if ($duplicateIds->isNotEmpty()) {
            EmployeeBonus::whereIn('id', $duplicateIds)->delete();
        }
    }

    private function baseBonusValues(
        AttendanceLog $attendance,
        Employee $employee,
        string $bonusTypeName,
        float $amount,
        ?int $overtimeMinutes,
        string $calculationType,
        array $attributes
    ): array {
        return [
            'emp_id' => $attendance->employee_id,
            'shift_id' => $attendance->shift_id,
            'bonus_type_id' => $this->bonusTypeId($bonusTypeName),
            'amount' => round($amount, 2),
            'description' => $attributes['description'] ?? null,
            'group_id' => $employee->group_id,
            'config_id' => null,
            'department_id' => $employee->department_id,
            'overtime_minutes' => $overtimeMinutes,
            'calculation_type' => $calculationType,
            'bonus_config_amount' => null,
            'source_type' => $attributes['source_type'] ?? null,
            'remarks' => $attributes['remarks'] ?? null,
        ];
    }

    private function bonusTypeId(string $bonusTypeName): ?int
    {
        if ($bonusTypeName === self::BONUS_TYPE_NIGHT_SHIFT) {
            return null;
        }

        return BonusType::whereRaw('UPPER(name) = ?', [strtoupper($bonusTypeName)])->value('id');
    }

    private function clearAttendanceLogBonus(AttendanceLog $attendance, string $bonusTypeName): void
    {
        EmployeeBonus::where('attendance_log_id', $attendance->id)
            ->where('bonus_type', $bonusTypeName)
            ->delete();
    }

    private function clearMonthlyAttendanceBonus(Employee $employee, Carbon $date): void
    {
        EmployeeBonus::where('emp_id', $employee->id)
            ->where('bonus_type', self::BONUS_TYPE_ATTENDANCE)
            ->whereBetween('attendance_date', [
                $date->copy()->startOfMonth()->toDateString(),
                $date->copy()->endOfMonth()->toDateString(),
            ])
            ->delete();
    }

    private function deleteDuplicateAttendanceLogBonuses(
        AttendanceLog $attendance,
        string $bonusTypeName,
        int $keepBonusId
    ): void {
        EmployeeBonus::where('attendance_log_id', $attendance->id)
            ->where('bonus_type', $bonusTypeName)
            ->where('id', '!=', $keepBonusId)
            ->delete();
    }
}
