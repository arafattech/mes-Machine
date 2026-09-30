<?php

namespace App\Services\hrModule;

use App\Models\AttendanceLog;
use App\Models\EmployeeShift;
use Carbon\Carbon;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class AttendanceCheckoutService
{
    private const FILLABLE_FIELDS = [
        'attendance_date',
        'check_in_time',
        'check_out_time',
        'shift_id',
        'is_active',
    ];

    private const OVERTIME_FIELDS = [
        'attendance_date',
        'check_in_time',
        'check_out_time',
        'shift_id',
    ];

    public function __construct(private OvertimeBonusService $overtimeBonusService) {}

    public function checkout(int|string $attendanceId, array $payload): AttendanceLog
    {
        return DB::transaction(function () use ($attendanceId, $payload) {
            $attendance = AttendanceLog::with(['employee.employeeSection', 'employee.salary', 'shift'])
                ->lockForUpdate()
                ->findOrFail($attendanceId);

            $payload = $this->normalizePayload($attendance, $payload);
            $attendance->fill(Arr::only($payload, self::FILLABLE_FIELDS));
            $this->calculateOvertime($attendance);

            $attendance->save();
            $attendance->load(['employee.employeeSection', 'employee.salary', 'shift']);

            $this->overtimeBonusService->syncForAttendance($attendance);

            return $attendance->fresh(['employee.employeeSection', 'employee.salary', 'shift', 'employeeBonuses']);
        });
    }

    private function normalizePayload(AttendanceLog $attendance, array $payload): array
    {
        $payload = $this->emptyStringsToNull($payload);

        $date = Carbon::parse($payload['attendance_date'] ?? $attendance->attendance_date)->format('Y-m-d');

        if (! empty($payload['attendance_date'])) {
            $payload['attendance_date'] = $date;
        }

        foreach (['check_in_time', 'check_out_time'] as $field) {
            if (! empty($payload[$field])) {
                $payload[$field] = $this->parseDateTime($date, $payload[$field], $field);
            }
        }

        if (! empty($payload['check_out_time'])) {
            $checkIn = $payload['check_in_time'] ?? $attendance->check_in_time;
            $shiftId = $payload['shift_id'] ?? $attendance->shift_id;

            $payload['check_out_time'] = $this->fixNextDayCheckout(
                $date,
                $payload['check_out_time'],
                $checkIn,
                $shiftId
            );
        }

        return $payload;
    }

    private function emptyStringsToNull(array $payload): array
    {
        foreach (['attendance_date', 'check_in_time', 'check_out_time'] as $field) {
            if (array_key_exists($field, $payload) && $payload[$field] === '') {
                $payload[$field] = null;
            }
        }

        return $payload;
    }

    private function parseDateTime(string $date, string $value, string $field): string
    {
        try {
            return $this->hasDate($value)
                ? Carbon::parse($value)->toDateTimeString()
                : Carbon::parse($date . ' ' . $value)->toDateTimeString();
        } catch (Throwable) {
            throw ValidationException::withMessages([
                $field => "The {$field} format is invalid.",
            ]);
        }
    }

    private function fixNextDayCheckout(string $date, string $checkout, ?string $checkIn, ?int $shiftId): string
    {
        $checkoutTime = Carbon::parse($checkout);

        if ($checkIn && $checkoutTime->lessThanOrEqualTo(Carbon::parse($checkIn))) {
            return $checkoutTime->addDay()->toDateTimeString();
        }

        $shift = $shiftId ? EmployeeShift::find($shiftId) : null;

        if ($shift) {
            [$shiftStart, $shiftEnd] = $this->shiftWindow($shift, Carbon::parse($date));

            if ($shiftEnd->isNextDay() && $checkoutTime->lessThan($shiftStart)) {
                return $checkoutTime->addDay()->toDateTimeString();
            }
        }

        return $checkoutTime->toDateTimeString();
    }

    private function calculateOvertime(AttendanceLog $attendance): void
    {
        $shift = $attendance->shift_id ? EmployeeShift::find($attendance->shift_id) : null;

        if (! $attendance->check_out_time || ! $shift) {
            $this->clearOvertime($attendance);
            return;
        }

        [, $shiftEnd] = $this->shiftWindow($shift, Carbon::parse($attendance->attendance_date));
        $checkOut = Carbon::parse($attendance->check_out_time);

        if ($checkOut->lessThanOrEqualTo($shiftEnd)) {
            $this->clearOvertime($attendance);
            return;
        }

        $minutes = $shiftEnd->diffInMinutes($checkOut);

        $attendance->overtime_minutes = $minutes;
        $attendance->over_time = gmdate('H:i:s', $minutes * 60);

        $attendance->has_overtime = false;
        $attendance->overtime_status = 'PENDING';
    }

    private function clearOvertime(AttendanceLog $attendance): void
    {
        $attendance->overtime_minutes = null;
        $attendance->over_time = null;
        $attendance->has_overtime = false;
        $attendance->overtime_status = null;
    }

    private function shiftWindow(EmployeeShift $shift, Carbon $date): array
    {
        $start = Carbon::parse($date->format('Y-m-d') . ' ' . Carbon::parse($shift->start_time)->format('H:i:s'));
        $end = Carbon::parse($date->format('Y-m-d') . ' ' . Carbon::parse($shift->end_time)->format('H:i:s'));

        if ($end->lessThanOrEqualTo($start)) {
            $end->addDay();
        }

        return [$start, $end];
    }

    private function hasDate(string $value): bool
    {
        return preg_match('/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/', $value) === 1;
    }
}
