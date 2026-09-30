<?php

namespace App\Services\hrModule;

use App\Models\Employee;
use App\Models\AttendanceLog;
use App\Models\Roster;
use App\Models\EmployeeShift;
use App\Models\ShiftOverrides;
use Carbon\Carbon;

class DailyAttendanceService
{

    private function getAttendanceDataForShift($employeeLogsForDay, $shiftDetails, $employee, $requestDate)
    {
        $matchingLog = null;

        if ($employeeLogsForDay && $shiftDetails) {

            $shiftStart = $requestDate->copy()->setTimeFromTimeString(Carbon::parse($shiftDetails->start_time)->toTimeString());
            $shiftEnd = $requestDate->copy()->setTimeFromTimeString(Carbon::parse($shiftDetails->end_time)->toTimeString());

            if ($shiftEnd->isBefore($shiftStart)) {
                $shiftEnd->addDay();
            }

            // "Present for this shift" means the employee has an attendance_logs row
            // actually assigned to this shift — whatever status it carries (VALID,
            // LATE, or INVALID) — not a re-derived timestamp-window guess. The
            // shift_id on the log is already the ground truth: it was resolved by
            // the real shift-matching logic (node-server's biometrics matcher /
            // EmployeeController::validateCheckIn), which accounts for
            // early_start_time/late_start_time grace periods this window check does
            // not. Re-deriving the window here could wrongly mark an early-but-VALID
            // check-in as outside the shift and show the employee as absent.
            foreach ($employeeLogsForDay as $log) {
                if ($log->shift_id !== null && (int) $log->shift_id === (int) $shiftDetails->id) {
                    $matchingLog = $log;
                    break;
                }
            }

            // Fallback for logs with no shift_id recorded at all (legacy data
            // predating that column being populated) — re-derive by raw timestamp
            // window as before, rather than never matching them.
            if (!$matchingLog) {
                foreach ($employeeLogsForDay as $log) {
                    if ($log->shift_id !== null) {
                        continue;
                    }

                    $checkIn = Carbon::parse($log->check_in_time);

                    if ($checkIn->between($shiftStart, $shiftEnd)) {
                        $matchingLog = $log;
                        break;
                    }
                }
            }
        }

        $attendanceStatus = $matchingLog ? 'present' : 'absent';
        $absentType = null;

        if ($attendanceStatus === 'absent') {
            $date = $requestDate->copy()->startOfDay();
            $leave = $employee->leaves->first(fn($leave) => $date->between(Carbon::parse($leave->start_date), Carbon::parse($leave->end_date)));
            if ($leave) {
                $absentType = 'Leave';
            } else {
                $weekend = $employee->employeeWeekend->firstWhere('weekend_date', $date->toDateString());
                if ($weekend) {
                    $absentType = 'Weekend';
                } else {
                    $swap = $employee->holidaySwaps->first(fn($holiday) => $holiday->swapped_holiday_date === $date->toDateString());
                    if ($swap) $absentType = 'Weekend';
                }
            }
        }

        $overtimeMinutes = null;
        $overTime = null;
        $hasAssignedOvertime = $matchingLog ? (bool) $matchingLog->has_overtime : false;

        if ($hasAssignedOvertime && $matchingLog->check_out_time && $shiftDetails) {
            $checkOut = Carbon::parse($matchingLog->check_out_time);
            $shiftEnd = $requestDate->copy()->setTimeFromTimeString(Carbon::parse($shiftDetails->end_time)->toTimeString());

            if ($shiftEnd->isBefore($requestDate->copy()->setTimeFromTimeString(Carbon::parse($shiftDetails->start_time)->toTimeString()))) {
                $shiftEnd->addDay();
            }

            if ($checkOut->greaterThan($shiftEnd)) {
                $overtimeMinutes = $shiftEnd->diffInMinutes($checkOut);
                $overTime = gmdate('H:i:s', $overtimeMinutes * 60);
            }
        }

        return [
            'attendance_log_id' => $matchingLog ? $matchingLog->id : null,
            'attendance_date' => $matchingLog ? $matchingLog->attendance_date : null,
            'check_in_time' => $matchingLog ? $matchingLog->check_in_time : null,
            'check_out_time' => $matchingLog ? $matchingLog->check_out_time : null,
            'attendance_status' => $attendanceStatus,
            'absent_type' => $absentType,
            'has_overtime' => $hasAssignedOvertime,
            'over_time' => $overTime,
            'overtime_minutes' => $overtimeMinutes,
        ];
    }

    public function employeeDailyAttendance($date, $filterShiftId = null)
    {
        $date = Carbon::parse($date)->startOfDay();
        $dateStart = $date->startOfDay();
        $dateEnd = $date->endOfDay();

        $employees = Employee::with(['department', 'group', 'leaves', 'employeeWeekend', 'holidaySwaps'])
            ->where('is_active', true)
            ->get();

        $attendanceLogs = AttendanceLog::whereDate('attendance_date', $date->format('Y-m-d'))
            ->get()
            ->groupBy('employee_id');

        $shiftOverrides = ShiftOverrides::whereDate('date', $date->format('Y-m-d'))
            ->where('is_active', true)
            ->with(['shift', 'absentEmployee', 'replacementEmployee', 'target_shift'])
            ->get();

        $rosters = Roster::where('is_active', true)
            ->where(function ($query) use ($dateStart, $dateEnd) {
                $query->whereBetween('start_date', [$dateStart, $dateEnd])
                    ->orWhereBetween('end_date', [$dateStart, $dateEnd])
                    ->orWhere(function ($subQuery) use ($dateStart, $dateEnd) {
                        $subQuery->where('start_date', '<=', $dateStart)
                            ->where('end_date', '>=', $dateEnd);
                    });
            })
            ->orderBy('start_date', 'desc')
            ->get();

        $shifts = EmployeeShift::where('is_active', true)->get()->keyBy('id');
        $results = collect();

        foreach ($employees as $employee) {

            $employeeLogsForDay = $attendanceLogs[$employee->id] ?? null;

            $cleanEmployeeData = [
                'employee_id' => $employee->id,
                'custom_id' => $employee->custom_id,
                'employee_no' => $employee->employee_no,
                'first_name' => $employee->first_name,
                'last_name' => $employee->last_name,
                'department_id' => $employee->department_id,
                'department' => $employee->department->name ?? null,
                'group_id' => $employee->group_id,
                'group_name' => $employee->group->name ?? null,
                'default_shift_id' => $employee->shift_id,
            ];

            $employeeRosters = $rosters->filter(fn($roster) => $roster->group_id == $employee->group_id);
            if ($employeeRosters->isEmpty()) {
                $employeeRosters = collect([(object)['shift_id' => $employee->shift_id]]);
            }

            $employeeResults = collect();

            foreach ($employeeRosters as $roster) {

                $effectiveShiftId = $roster->shift_id ?? $employee->shift_id;
                $shiftDetails = $shifts[$effectiveShiftId] ?? null;

                $shiftAttendanceData = $this->getAttendanceDataForShift($employeeLogsForDay, $shiftDetails, $employee, $date);

                $employeeResults->push(array_merge(
                    $cleanEmployeeData,
                    [
                        'effective_shift_id' => $effectiveShiftId,
                        'shift' => $shiftDetails ? [
                            'id' => $shiftDetails->id,
                            'name' => $shiftDetails->name,
                            'start_time' => $shiftDetails->start_time,
                            'end_time' => $shiftDetails->end_time,
                            'is_night' => $shiftDetails->is_night,
                        ] : null,
                    ],
                    $shiftAttendanceData
                ));
            }

            $employeeOverrides = $shiftOverrides->filter(
                fn($override) =>
                $override->absent_employee_id == $employee->id || $override->replacement_employee_id == $employee->id
            );

            foreach ($employeeOverrides as $override) {
                switch ($override->type) {
                    case 'SWAP':
                        if ($override->absent_employee_id == $employee->id) {

                            $employeeResults = $employeeResults->reject(
                                fn($record) => $record['effective_shift_id'] == $override->shift_id
                            );
                            if ($override->target_shift) {
                                $swapShift = $override->target_shift;
                                $swapAttendanceData = $this->getAttendanceDataForShift($employeeLogsForDay, $swapShift, $employee, $date);

                                $employeeResults->push(array_merge(
                                    $cleanEmployeeData,
                                    [
                                        'effective_shift_id' => $swapShift->id,
                                        'shift' => [
                                            'id' => $swapShift->id,
                                            'name' => $swapShift->name,
                                            'start_time' => $swapShift->start_time,
                                            'end_time' => $swapShift->end_time,
                                            'is_night' => $swapShift->is_night,
                                        ],
                                    ],
                                    $swapAttendanceData
                                ));
                            }
                        }
                        if ($override->replacement_employee_id == $employee->id) {
                            $shift = $override->shift;
                            $replacementAttendanceData = $this->getAttendanceDataForShift($employeeLogsForDay, $shift, $employee, $date);

                            $employeeResults->push(array_merge(
                                $cleanEmployeeData,
                                [
                                    'effective_shift_id' => $shift->id,
                                    'shift' => [
                                        'id' => $shift->id,
                                        'name' => $shift->name,
                                        'start_time' => $shift->start_time,
                                        'end_time' => $shift->end_time,
                                        'is_night' => $shift->is_night,
                                    ],
                                ],
                                $replacementAttendanceData
                            ));
                        }
                        break;

                    case 'REPLACEMENT':
                        if ($override->absent_employee_id == $employee->id) {
                            $employeeResults = $employeeResults->reject(
                                fn($record) => $record['effective_shift_id'] == $override->shift_id
                            );
                        }
                        if ($override->replacement_employee_id == $employee->id) {
                            $shift = $override->shift;

                            $replacementAttendanceData = $this->getAttendanceDataForShift($employeeLogsForDay, $shift, $employee, $date);

                            $employeeResults->push(array_merge(
                                $cleanEmployeeData,
                                [
                                    'effective_shift_id' => $shift->id,
                                    'shift' => [
                                        'id' => $shift->id,
                                        'name' => $shift->name,
                                        'start_time' => $shift->start_time,
                                        'end_time' => $shift->end_time,
                                        'is_night' => $shift->is_night,
                                    ],
                                ],
                                $replacementAttendanceData
                            ));
                        }
                        break;

                    case 'EXTRA':
                        if ($override->replacement_employee_id == $employee->id) {
                            $shift = $override->shift;
                            $extraAttendanceData = $this->getAttendanceDataForShift($employeeLogsForDay, $shift, $employee, $date);

                            $employeeResults->push(array_merge(
                                $cleanEmployeeData,
                                [
                                    'effective_shift_id' => $shift->id,
                                    'shift' => [
                                        'id' => $shift->id,
                                        'name' => $shift->name,
                                        'start_time' => $shift->start_time,
                                        'end_time' => $shift->end_time,
                                        'is_night' => $shift->is_night,
                                    ],
                                ],
                                $extraAttendanceData
                            ));
                        }
                        break;
                }
            }

            $results = $results->merge($employeeResults);
        }

        if ($filterShiftId) {
            $results = $results->filter(fn($record) => (int)$record['effective_shift_id'] === (int)$filterShiftId);
        }

        $results = $results->unique(function ($item) {
            return $item['employee_id'] . '-' . $item['effective_shift_id'];
        });

        $presentCount = $results->where('attendance_status', 'present')->count();
        $absentCount = $results->where('attendance_status', 'absent')->count();

        return [
            'date' => $date->format('Y-m-d'),
            'attendance' => $results->values(),
            'present_count' => $presentCount,
            'absent_count' => $absentCount,
            'has_roster' => $rosters->isNotEmpty(),
        ];
    }
}
