<?php

namespace App\Http\Controllers;

use App\Models\AttendanceLog;
use App\Models\EmployeeWeekend;
use App\Services\hrModule\AttendanceCheckoutService;
use App\Services\hrModule\OvertimeBonusService;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Throwable;

class AttendanceLogController extends Controller
{
    public function __construct(
        private AttendanceCheckoutService $checkoutService,
        private OvertimeBonusService $overtimeBonusService,
    ) {}

    public function update(Request $request, int $id)
    {
        $payload = $request->validate([
            'attendance_date' => ['sometimes', 'nullable', 'date'],
            'check_in_time' => ['sometimes', 'nullable', 'string'],
            'check_out_time' => ['sometimes', 'nullable', 'string'],
            'shift_id' => ['sometimes', 'nullable', 'integer', 'exists:employee_shifts,id'],
            'is_active' => ['sometimes', 'boolean'],
            'has_overtime' => ['sometimes', 'boolean'],
        ]);

        try {
            $attendance = $this->checkoutService->checkout($id, $payload);

            return response()->json([
                'message' => 'Attendance updated successfully',
                'data' => $attendance,
            ]);
        } catch (ValidationException|ModelNotFoundException $exception) {
            throw $exception;
        } catch (Throwable $exception) {
            Log::error('Attendance checkout failed.', [
                'attendance_log_id' => $id,
                'message' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => 'Attendance checkout failed',
            ], 500);
        }
    }

    public function dutyRows(Request $request)
    {
        $filter = (string) $request->query('$filter', '');
        $from = $this->extractFilterDate($filter, 'ge');
        $to = $this->extractFilterDate($filter, 'le');
        // Frontend sends the min-overtime threshold in hours (the grid's own unit);
        // the DB stores overtime_minutes, so convert once here.
        $minOvertimeHours = $this->extractFilterNumber($filter, 'overtime_hours', 'ge');
        $minOvertimeMinutes = $minOvertimeHours !== null ? $minOvertimeHours * 60 : null;
        $top = max((int) $request->query('$top', 40), 1);
        $skip = max((int) $request->query('$skip', 0), 0);
        $sortDirection = str_starts_with((string) $request->query('$orderby', ''), 'attendance_date asc')
            ? 'asc'
            : 'desc';

        $logs = AttendanceLog::with(['employee.salary', 'shift'])
            ->where(function ($query) {
                $query->where('overtime_minutes', '>', 0)
                    ->orWhere('is_holiday_bonus_duty', true)
                    ->orWhere('is_ot', true);
            })
            ->when(
                $from,
                fn ($query, $date) => $query->whereDate('attendance_date', '>=', $date),
            )
            ->when(
                $to,
                fn ($query, $date) => $query->whereDate('attendance_date', '<=', $date),
            )
            ->orderBy('attendance_date', $sortDirection)
            ->limit(1000)
            ->get();

        $rows = collect();

        foreach ($logs as $log) {
            // The min-hours threshold only makes sense against OVERTIME rows (it's the
            // "Overtime Hours" column) — HOLIDAY/EXTRA_SHIFT rows on the same log have
            // no comparable duration and must stay unaffected by it.
            if (
                (int) $log->overtime_minutes > 0
                && ($minOvertimeMinutes === null || $log->overtime_minutes >= $minOvertimeMinutes)
            ) {
                $rows->push($this->buildDutyRow($log, 'OVERTIME'));
            }
            if ($log->is_holiday_bonus_duty) {
                $rows->push($this->buildDutyRow($log, 'HOLIDAY'));
            }
            if ($log->is_ot) {
                $rows->push($this->buildDutyRow($log, 'EXTRA_SHIFT'));
            }
        }

        return response()->json([
            'value' => $rows->slice($skip, $top)->values(),
            '@count' => $rows->count(),
        ]);
    }

    private function extractFilterDate(string $filter, string $operator): ?string
    {
        if (preg_match('/attendance_date '.$operator.' (\d{4}-\d{2}-\d{2})/', $filter, $matches)) {
            return $matches[1];
        }

        return null;
    }

    private function extractFilterNumber(string $filter, string $field, string $operator): ?float
    {
        if (preg_match('/'.preg_quote($field, '/').' '.$operator.' ([\d.]+)/', $filter, $matches)) {
            return (float) $matches[1];
        }

        return null;
    }

    private function buildDutyRow(AttendanceLog $log, string $dutyType): array
    {
        $row = $log->toArray();
        $row['id'] = "{$log->id}-{$dutyType}";
        $row['attendance_log_id'] = $log->id;
        $row['duty_type'] = $dutyType;

        if ($dutyType === 'OVERTIME') {
            $minutes = (int) $log->overtime_minutes;
            $row['overtime_hours'] = sprintf('%dh %dm', intdiv($minutes, 60), $minutes % 60);
        }

        if ($dutyType === 'HOLIDAY') {
            $config = EmployeeWeekend::query()
                ->where('employee_id', $log->employee_id)
                ->whereDate('weekend_date', $log->attendance_date)
                ->first(['bonus_mode', 'bonus_amount']);
            $mode = $config?->bonus_mode;
            $dailySalary = round(((float) optional($log->employee?->salary)->total_salary) / 30, 2);

            $row['holiday_bonus_mode'] = $mode;
            $row['holiday_bonus_amount'] = match ($mode) {
                'FIXED' => (float) $config?->bonus_amount,
                'TRIPLE' => $dailySalary * 2,
                default => $dailySalary,
            };
        }

        return $row;
    }

    public function approveOvertime(Request $request)
    {
        $request->validate([
            'items'      => ['required', 'array'],
            'items.*.id' => ['required', 'integer', 'exists:attendance_logs,id'],
            'items.*.type' => ['required', 'in:OVERTIME,HOLIDAY,EXTRA_SHIFT'],
        ]);

        $logs = AttendanceLog::with(['employee.employeeSection', 'employee.salary', 'shift'])
            ->whereIn('id', collect($request->items)->pluck('id')->unique())
            ->get()
            ->keyBy('id');

        $approved = 0;

        foreach ($request->items as $item) {
            $log = $logs->get($item['id']);

            if (! $log) {
                continue;
            }

            $wasApproved = match ($item['type']) {
                'OVERTIME' => $this->approveOvertimeDuty($log),
                'HOLIDAY' => $this->approveHolidayDuty($log),
                'EXTRA_SHIFT' => $this->approveExtraShiftDuty($log),
            };

            if ($wasApproved) {
                $approved++;
            }
        }

        return response()->json(['approved' => $approved]);
    }

    private function approveOvertimeDuty(AttendanceLog $log): bool
    {
        if ($log->overtime_status !== 'PENDING' || (int) $log->overtime_minutes <= 0) {
            return false;
        }

        $log->update(['has_overtime' => true, 'overtime_status' => 'APPROVED']);
        $this->overtimeBonusService->approveOvertimeBonus($log);

        return true;
    }

    private function approveHolidayDuty(AttendanceLog $log): bool
    {
        if (! is_null($log->holiday_bonus_status) || ! $log->is_holiday_bonus_duty) {
            return false;
        }

        $log->update(['holiday_bonus_status' => 'APPROVED']);
        $this->overtimeBonusService->approveHolidayDateBonus($log);

        return true;
    }

    private function approveExtraShiftDuty(AttendanceLog $log): bool
    {
        if (! is_null($log->extra_shift_status) || ! $log->is_ot) {
            return false;
        }

        $log->update(['extra_shift_status' => 'APPROVED']);
        $this->overtimeBonusService->approveExtraShiftBonus($log);

        return true;
    }
}
