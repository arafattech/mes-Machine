<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\EmployeeHolidaySwap;
use App\Models\EmployeeShift;
use App\Models\EmployeeWeekend;
use App\Models\LeaveRequest;
use App\Models\Roster;
use App\Models\ShiftOverrides;
use App\Services\hrModule\DailyAttendanceService;
use App\Services\hrModule\OvertimeBonusService;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;


class EmployeeController extends Controller
{
    protected $attendanceService;
    protected $overtimeBonusService;

    public function __construct(DailyAttendanceService $attendanceService, OvertimeBonusService $overtimeBonusService)
    {
        $this->attendanceService = $attendanceService;
        $this->overtimeBonusService = $overtimeBonusService;
    }

    public function employeeAssociate(Request $request)
    {
        try {
            $employee = Employee::findOrFail($request->employee_id);

            if (!$request->has('assets') || !is_array($request->assets)) {
                return response()->json(['error' => 'Invalid assets data'], 400);
            }

            $assetsIds = collect($request->assets)->pluck('id')->toArray();
            $employee->assets()->sync($assetsIds);

            return response()->json([
                'message' => 'Associations assigned successfully',
                'product' => $employee
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['error' => 'employee not found'], 404);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Something went wrong', 'details' => $e->getMessage()], 500);
        }
    }

    private function shiftStartEnd($shift, $date)
    {
        $start = Carbon::parse($date->format('Y-m-d') . ' ' . Carbon::parse($shift->start_time)->format('H:i:s'));
        $end   = Carbon::parse($date->format('Y-m-d') . ' ' . Carbon::parse($shift->end_time)->format('H:i:s'));

        if ($end->lessThanOrEqualTo($start)) {
            $end->addDay();
        }

        return [$start, $end];
    }

    public function detectShift($checkInTime)
    {
        $shifts = EmployeeShift::where('is_active', true)->get();
        $checkIn = Carbon::parse($checkInTime);

        foreach ($shifts as $shift) {
            [$start, $end] = $this->shiftStartEnd($shift, $checkIn);
            if ($checkIn->between($start, $end)) {
                return response()->json(['shift' => $shift]);
            }
        }

        return response()->json(['shift' => null]);
    }

    public function employeeBlacklist($id)
    {
        try {
            $employee = Employee::find($id);
            if (!$employee) {
                throw new \Exception('Employee not found');
            }

            $employee->is_active = false;
            $employee->save();

            if ($employee->user) {
                $employee->user->is_active = false;
                $employee->user->remember_token = null;
                $employee->user->save();
            }

            $data['status_code']        = 200;
            $data['blacklist_status']   = true;
            $data['message']            = 'Employee blacklisted successfully.';
        } catch (\Exception $exception) {
            $data['blacklist_status']   = false;
            $data['status_code']        = 400;
            $data['status']             = $exception->getMessage();
        } finally {
            return response()->json($data);
        }
    }
    public function employeeBlacklistUndo($id)
    {
        try {
            $employee = Employee::find($id);
            if (!$employee) {
                throw new \Exception('Employee not found');
            }

            $employee->is_active = true;
            $employee->save();

            if ($employee->user) {
                $employee->user->is_active = true;
                $employee->user->remember_token = null;
                $employee->user->save();
            }

            $data['status_code']        = 200;
            $data['blacklist_status']   = true;
            $data['message']            = 'Employee Revoked successfully.';
        } catch (\Exception $exception) {
            $data['blacklist_status']   = false;
            $data['status_code']        = 400;
            $data['status']             = $exception->getMessage();
        } finally {
            return response()->json($data);
        }
    }

    public function syncEmployeeGroup(Request $request)
    {
        $request->validate([
            'group_id' => 'required',
            'employee_ids' => 'required|array',
            'employee_ids.*' => 'exists:employees,id',
        ]);


        $groupId = $request->group_id;
        $employeeIds = $request->employee_ids ?? [];

        $currentEmployeeIds = Employee::where('group_id', $groupId)
            ->pluck('id')
            ->toArray();

        $toAdd = array_diff($employeeIds, $currentEmployeeIds);

        if (!empty($toAdd)) {
            Employee::whereIn('id', $toAdd)
                ->update([
                    'group_id' => $groupId,
                    'is_shift_fixed' => false,
                ]);
        }

        return response()->json([
            'message' => 'Employees synced successfully with the group.'
        ]);
    }

    public function bulkStatusUpdate(Request $request)
    {
        $request->validate([
            'employee_ids' => 'required|array|min:1',
            'employee_ids.*' => 'exists:employees,id',
            'is_active' => 'required|boolean',
        ]);

        $employeeIds = $request->employee_ids;
        $isActive = $request->boolean('is_active');

        DB::transaction(function () use ($employeeIds, $isActive) {
            $employees = Employee::with('user')
                ->whereIn('id', $employeeIds)
                ->get();

            foreach ($employees as $employee) {
                $employee->is_active = $isActive;
                $employee->save();

                if (!$isActive && $employee->user) {
                    $employee->user->remember_token = null;
                    $employee->user->save();
                }
            }
        });

        return response()->json([
            'message' => $isActive
                ? 'Selected employees activated successfully.'
                : 'Selected employees inactivated successfully.',
            'updated_count' => count($employeeIds),
        ]);
    }

    public function getEmployeeShift(Request $request, $id)
    {
        $date = Carbon::parse($request->query('date', now()));

        $employee = Employee::with('shift')->findOrFail($id);

        $currentShift = $employee->shift;

        $roster = $this->resolveRosterForEmployee($employee, $date);
        if ($roster && $roster->shift) {
            $currentShift = $roster->shift;
        }

        if ($employee->group_id) {
            $isExistExtraShift = ShiftOverrides::where('replacement_employee_id', $id)
                ->Where('type', 'EXTRA')
                ->whereDate('date', $date->format('Y-m-d'))
                ->with('shift')
                ->first();

            $isExistSwapShift = ShiftOverrides::where('replacement_employee_id', $id)
                ->Where('type', 'SWAP')
                ->whereDate('date', $date->format('Y-m-d'))
                ->with('shift')
                ->first();

            $isExistReplaceShift = ShiftOverrides::where('replacement_employee_id', $id)
                ->Where('type', "REPLACEMENT")
                ->whereDate('date', $date->format('Y-m-d'))
                ->with('shift')
                ->first();
        }

        return response()->json([
            'shift' => $currentShift ? [
                'id' => $currentShift->id,
                'name' => $currentShift->name,
                'start_time' => $currentShift->start_time,
                'end_time' => $currentShift->end_time,
                'extendedShift' => [$isExistExtraShift, $isExistSwapShift, $isExistReplaceShift]
            ] : null,
        ]);
    }

    public function checkAttendanceDate(Request $request, $employeeId)
    {
        $request->validate([
            'date' => 'required|date',
        ]);

        $date = $request->query('date');

        $isWeekend = EmployeeWeekend::where('employee_id', $employeeId)
            ->whereDate('weekend_date', $date)
            ->exists();

        $wasSwappedAway = EmployeeHolidaySwap::where('employee_id', $employeeId)
            ->whereDate('original_holiday_date', $date)
            ->exists();

        $wasSwappedTo = EmployeeHolidaySwap::where('employee_id', $employeeId)
            ->whereDate('swapped_holiday_date', $date)
            ->exists();

        $isOnApprovedLeave = LeaveRequest::where('employee_id', $employeeId)
            ->where('final_status', 'approved')
            ->whereHas('leaveDates', function ($q) use ($date) {
                $q->whereDate('leave_date', $date);
            })
            ->exists();

        $employee = Employee::with('shift')->findOrFail($employeeId);
        $currentShift = $employee->shift;

        $isWeekendHoliday = ($isWeekend && !$wasSwappedAway) || $wasSwappedTo;
        $isHolidayBonusDate = $this->overtimeBonusService->isHolidayBonusOffDay($employee, $date);
        $canSubmitAttendance = true;

        $roster = $this->resolveRosterForEmployee($employee, $date);
        if ($roster && $roster->shift) {
            $currentShift = $roster->shift;
        }

        $message = 'Employee can work on this date';
        if ($isOnApprovedLeave) {
            $message = 'Employee is on leave';
        } elseif ($isWeekendHoliday && $isHolidayBonusDate) {
            $message = 'Employee is on holiday duty';
        } elseif ($isWeekendHoliday) {
            $message = 'Employee is on holiday';
        }

        return response()->json([
            'isHoliday' => $isOnApprovedLeave || ($isWeekendHoliday && !$isHolidayBonusDate),
            'canSubmit' => $canSubmitAttendance,
            'isWeekend' => $isWeekend,
            'wasSwappedAway' => $wasSwappedAway,
            'wasSwappedTo' => $wasSwappedTo,
            'isOnApprovedLeave' => $isOnApprovedLeave,
            'shift' => $currentShift ? [
                'id' => $currentShift->id,
                'name' => $currentShift->name,
                'start_time' => $currentShift->start_time,
                'end_time' => $currentShift->end_time,
            ] : null,
            'message' => $message
        ]);
    }

    public function validateCheckIn(Request $request, $employeeId)
    {
        $request->validate([
            'date' => 'required|date',
            'time' => 'required|string',
        ]);

        $date = Carbon::parse($request->query('date'));
        $time = $request->query('time');
        $employee = Employee::with(['group.shift', 'shift'])->findOrFail($employeeId);

        $matched = false;
        $message = null;
        $error = null;
        $chosenShift = null;

        try {
            if (preg_match('/(AM|PM)/i', $time)) {
                $checkTime = Carbon::createFromFormat('g:i A', $time)->format('H:i:s');
            } else {
                $checkTime = Carbon::createFromFormat('H:i', $time)->format('H:i:s');
            }
            $checkIn = Carbon::createFromFormat(
                'Y-m-d H:i:s',
                $date->format('Y-m-d') . ' ' . $checkTime
            );
        } catch (\Exception $e) {
            return response()->json([
                'matched' => false,
                'reason' => 'invalid_time_format',
                'message' => 'Provided time format is invalid.',
                'shift' => null,
                'check_in' => null,
                'employee' => $employee
            ]);
        }

        if ($employee->group_id && $employee->group?->is_permanent && $employee->group?->shift) {
            $chosenShift = $employee->group->shift;
        } elseif ($employee->is_shift_fixed && $employee->shift) {
            $chosenShift = $employee->shift;
        } elseif ($employee->group_id) {
            // A group can be rostered onto more than one shift the same day (its own
            // dedicated roster, plus another roster's multi-group set it's also part
            // of via the pivot table) — e.g. group "O" onto shift O AND, via a
            // different roster, shift R/C. There's no single "correct" one without
            // knowing when the punch actually happened, so gather every candidate
            // shift and let the check-in time itself decide (mirrors node-server's
            // BiometricsService::resolveShiftMatch, which does the same across an
            // employee's roster shifts for the day).
            $rosterShifts = $this->resolveRosterShiftsForEmployee($employee, $date);
            if ($rosterShifts->isNotEmpty()) {
                $chosenShift = $this->pickNearestShiftForCheckIn($rosterShifts, $checkIn);
            }
        }

        $shiftOverrides = ShiftOverrides::with(['shift', 'target_shift'])
            ->whereDate('date', $date)
            ->where(function ($q) use ($employeeId) {
                $q->where('replacement_employee_id', $employeeId)
                    ->orWhere('absent_employee_id', $employeeId);
            })
            ->get();

        if ($shiftOverrides->isNotEmpty()) {
            foreach ($shiftOverrides as $override) {

                switch ($override->type) {

                    case 'SWAP':

                        if ($override->absent_employee_id == $employeeId && $override->target_shift) {
                            [$shiftStart, $shiftEnd] = $this->shiftStartEnd($override->target_shift, $date);
                            if ($this->isCheckInWithinShift($checkIn, $shiftStart, $shiftEnd, $override->target_shift)) {
                                $matched = true;
                                $chosenShift = $override->target_shift;
                                $message = 'Check-in within swapped shift.';
                            } else {


                                $matched = false;
                                $message = 'Employee swapped away from this shift.';
                            }
                            break 2;
                        }

                        if ($override->replacement_employee_id == $employeeId && $override->shift) {
                            [$shiftStart, $shiftEnd] = $this->shiftStartEnd($override->shift, $date);
                            if ($this->isCheckInWithinShift($checkIn, $shiftStart, $shiftEnd, $override->shift)) {
                                $matched = true;
                                $chosenShift = $override->shift;
                                $message = 'Check-in within swapped shift.';
                            } else {

                                $matched = false;
                                $message = 'CheckIn has swaped to another shift';
                            }

                            break 2;
                        }
                        break;

                    case 'EXTRA':
                        if ($override->replacement_employee_id == $employeeId && $override->shift) {
                            [$shiftStart, $shiftEnd] = $this->shiftStartEnd($override->shift, $date);
                            if ($this->isCheckInWithinShift($checkIn, $shiftStart, $shiftEnd, $override->shift)) {
                                $matched = true;
                                $chosenShift = $override->shift;
                                $message = 'Check-in within EXTRA shift.';
                                break 2;
                            } else {
                                if (!$matched && $chosenShift) {
                                    [$shiftStart, $shiftEnd] = $this->shiftStartEnd($chosenShift, $date);
                                    if ($this->isCheckInWithinShift($checkIn, $shiftStart, $shiftEnd, $chosenShift)) {
                                        $matched = true;
                                        $message = 'Matched with main shift';
                                    } else {
                                        $matched = false;
                                        $error = 'outside_shift';
                                        $message = 'Check-in outside default shift';
                                    }
                                }
                            }
                        }
                        break;

                    case 'REPLACEMENT':

                        if ($override->replacement_employee_id == $employeeId && $override->shift) {
                            [$shiftStart, $shiftEnd] = $this->shiftStartEnd($override->shift, $date);
                            if ($this->isCheckInWithinShift($checkIn, $shiftStart, $shiftEnd, $override->shift)) {
                                $matched = true;
                                $chosenShift = $override->shift;
                                $message = 'Check-in within REPLACEMENT shift.';
                                break 2;
                            } else {
                                $matched = false;
                                $message = 'Employee has replaced to another shift.';
                                break 2;
                            }
                        }
                        break;
                }
            }
        }

        if (!$matched && !$error && $chosenShift) {
            [$shiftStart, $shiftEnd] = $this->shiftStartEnd($chosenShift, $date);
            if ($this->isCheckInWithinShift($checkIn, $shiftStart, $shiftEnd, $chosenShift)) {
                $matched = true;
                $message = 'Check-in within default shift';
            } else {
                $matched = false;
                $error = 'outside_shift';
                $message = 'Check-in outside default shift';
            }
        }

        // No hard rejection wall: as long as a shift could be resolved for this
        // employee at all (their fixed/group/roster shift, or whichever override
        // shift the switch above picked), the check-in is always recorded against
        // it — matching node-server's biometrics attendance matching, which never
        // refuses a punch just because it falls outside the shift window. A window
        // mismatch only downgrades the resulting status to INVALID instead of
        // blocking the check-in.
        ['status' => $status, 'late_minutes' => $lateMinutes] = $this->resolveAttendanceStatus(
            $checkIn,
            $chosenShift,
            $date,
            $matched,
        );

        return response()->json([
            'matched' => $matched,
            'status' => $status,
            'late_minutes' => $lateMinutes,
            'reason' => $error,
            'message' => $message,
            'shift' => $chosenShift ? [
                'id' => $chosenShift->id,
                'name' => $chosenShift->name,
                'start_time' => $chosenShift->start_time,
                'end_time' => $chosenShift->end_time,
            ] : null,
            'check_in' => $checkIn->toDateTimeString(),
            'employee' => $employee
        ]);
    }

    // Turns the shift-window match result into the attendance status to store —
    // VALID/LATE when the resolved shift's window matched (LATE once past
    // late_start_time, the configured grace cutoff, defaulting to start_time
    // itself when unset), INVALID whenever no shift could be resolved at all or
    // the punch fell outside its window. Never blocks the check-in either way.
    private function resolveAttendanceStatus(Carbon $checkIn, $shift, Carbon $date, bool $withinShift): array
    {
        if (!$shift || !$withinShift) {
            return ['status' => 'INVALID', 'late_minutes' => null];
        }

        [$shiftStart] = $this->shiftStartEnd($shift, $date);

        if ($checkIn->lessThanOrEqualTo($shiftStart)) {
            return ['status' => 'VALID', 'late_minutes' => 0];
        }

        $graceEnd = $shiftStart->copy();
        if ($shift->late_start_time) {
            $graceTime = Carbon::parse($shift->late_start_time)->format('H:i:s');
            $graceEnd = Carbon::parse($shiftStart->format('Y-m-d') . ' ' . $graceTime);
            if ($graceEnd->lessThan($shiftStart)) {
                $graceEnd->addDay();
            }
        }

        if ($checkIn->greaterThan($graceEnd)) {
            return ['status' => 'LATE', 'late_minutes' => $shiftStart->diffInMinutes($checkIn)];
        }

        return ['status' => 'VALID', 'late_minutes' => 0];
    }


    // A check-in is accepted from the shift's early_start_time onward (not just
    // start_time) — mirrors node-server's biometrics attendance matching
    // (BiometricsService::resolveShiftMatch), which already treats any punch at or
    // after early_start_time as on time for that shift. Falls back to start_time
    // itself when the shift has no early_start_time configured.
    protected function isCheckInWithinShift($checkIn, $shiftStart, $shiftEnd, $shift = null)
    {
        $effectiveStart = $shift ? $this->resolveEarlyShiftStart($shift, $shiftStart) : $shiftStart;

        if ($shiftEnd < $shiftStart) {
            return $checkIn->between($effectiveStart, $shiftStart->copy()->endOfDay()) ||
                $checkIn->between($shiftEnd->copy()->startOfDay(), $shiftEnd);
        }

        return $checkIn->between($effectiveStart, $shiftEnd);
    }

    private function resolveEarlyShiftStart($shift, Carbon $shiftStart): Carbon
    {
        if (!$shift->early_start_time) {
            return $shiftStart;
        }

        $earlyTime = Carbon::parse($shift->early_start_time)->format('H:i:s');
        $early = Carbon::parse($shiftStart->format('Y-m-d') . ' ' . $earlyTime);

        // early_start_time is expected to sit before start_time on the same shift
        // day — if it doesn't (bad data), don't let it narrow the window.
        return $early->lessThanOrEqualTo($shiftStart) ? $early : $shiftStart;
    }

    public function loadDailyAttendance(Request $request)
    {
        $date = $request->query('date');
        $shiftId = $request->query('shift_id');

        $data = $this->attendanceService->employeeDailyAttendance($date, $shiftId);

        return response()->json($data);
    }

    /**
     * Roster covering this date for the employee's group — matches both the legacy
     * single-group column and a multi-group roster's 'roster_has_groups' pivot, since
     * a roster assigned to several groups no longer necessarily carries the employee's
     * group in its own 'group_id' column.
     */
    protected function resolveRosterForEmployee(Employee $employee, $date): ?Roster
    {
        if (!$employee->group_id) {
            return null;
        }

        $rosters = Roster::whereDate('start_date', '<=', $date)
            ->whereDate('end_date', '>=', $date)
            ->with(['shift', 'groups'])
            ->orderByDesc('start_date')
            ->orderByDesc('created_at')
            ->get();

        // A group can end up listed on more than one active roster the same day —
        // its own dedicated roster (group_id IS this group), plus another roster's
        // multi-group set that happens to include it too (roster_has_groups pivot).
        // The dedicated/primary assignment is the one that actually belongs to the
        // employee; only fall back to a pivot-only match when no primary one exists.
        $primaryMatch = $rosters->first(
            fn (Roster $roster) => (int) $roster->group_id === (int) $employee->group_id,
        );

        if ($primaryMatch) {
            return $primaryMatch;
        }

        return $rosters->first(fn (Roster $roster) => in_array(
            (int) $employee->group_id,
            array_map('intval', $roster->all_group_ids),
            true,
        ));
    }

    /**
     * Every distinct shift the employee's group is rostered onto today — via the
     * roster's own group_id or the roster_has_groups pivot — not just one "best"
     * guess. Used by validateCheckIn, which has an actual punch time to pick the
     * right candidate with; other callers that only want a default/informational
     * shift (no punch time) should keep using resolveRosterForEmployee.
     */
    protected function resolveRosterShiftsForEmployee(Employee $employee, $date): \Illuminate\Support\Collection
    {
        if (!$employee->group_id) {
            return collect();
        }

        return Roster::whereDate('start_date', '<=', $date)
            ->whereDate('end_date', '>=', $date)
            ->with('shift')
            ->get()
            ->filter(fn (Roster $roster) => in_array(
                (int) $employee->group_id,
                array_map('intval', $roster->all_group_ids),
                true,
            ))
            ->pluck('shift')
            ->filter()
            ->unique('id')
            ->values();
    }

    /**
     * Picks whichever candidate shift's start_time is closest (in minutes,
     * wrapping the 24h clock) to the check-in — mirrors node-server's
     * BiometricsService::resolveShiftMatch nearest-shift selection, so an
     * employee rostered onto several shifts the same day gets matched against
     * whichever one the punch actually corresponds to.
     */
    protected function pickNearestShiftForCheckIn(\Illuminate\Support\Collection $shifts, Carbon $checkIn): ?EmployeeShift
    {
        if ($shifts->count() <= 1) {
            return $shifts->first();
        }

        $checkInMinutes = $checkIn->hour * 60 + $checkIn->minute;

        return $shifts->sortBy(function (EmployeeShift $shift) use ($checkInMinutes) {
            $start = Carbon::parse($shift->start_time);
            $startMinutes = $start->hour * 60 + $start->minute;
            $diff = abs($checkInMinutes - $startMinutes) % 1440;
            return min($diff, 1440 - $diff);
        })->first();
    }
}
