<?php

namespace App\Services\hrModule;

use App\Models\AttendanceLog;
use App\Models\Employee;
use App\Models\EmployeeHolidaySwap;
use App\Models\EmployeeShift;
use App\Models\EmployeeWeekend;
use App\Models\LeaveRequest;
use App\Models\Roster;
use App\Models\ShiftOverrides;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

class EmployeeRosterService
{
    // Check-in OT rule:
    //  - Rostered today with an EXTRA-type assignment (override or regular) → this
    //    check-in itself is OT.
    //  - Not rostered today at all → not OT by itself, but if the employee already
    //    has an earlier attendance log the same day, this is their 2nd+ session —
    //    retroactively flag the earlier log(s) as OT.
    public function resolveIsOt(AttendanceLog $attendance): void
    {
        if (!$attendance->employee_id || !$attendance->attendance_date) {
            return;
        }

        $dateStr = Carbon::parse($attendance->attendance_date)->format('Y-m-d');
        $schedule = $this->getRosterSchedule($dateStr, $dateStr, false, [$attendance->employee_id]);
        $day = $schedule['data'][0] ?? null;

        // Only the roster status for the SHIFT THIS ATTENDANCE ROW ACTUALLY BELONGS
        // TO decides OT — not any shift the employee happens to be rostered onto
        // that day. An employee can be "Regular" on their own roster shift and
        // merely a secondary/pivot-group member (often tagged EXTRA) on another;
        // scanning every shift's status regardless of match wrongly flagged a
        // Regular check-in as EXTRA whenever ANY of the employee's other shifts
        // that day happened to carry an EXTRA tag. Mirrors the same fix already
        // applied to node-server's BiometricsService::resolveCheckInOt.
        $statuses = [];
        foreach ($day['shifts'] ?? [] as $shift) {
            if ($attendance->shift_id && (int) ($shift['shift_id'] ?? 0) !== (int) $attendance->shift_id) {
                continue;
            }
            foreach ($shift['employees'] ?? [] as $entry) {
                if ((int) ($entry['employee_details']['id'] ?? 0) === (int) $attendance->employee_id) {
                    $statuses[] = strtoupper($entry['status'] ?? '');
                }
            }
        }

        if (!empty($statuses)) {
            $attendance->is_ot = in_array('EXTRA', $statuses, true);
            return;
        }

        $existingIds = AttendanceLog::where('employee_id', $attendance->employee_id)
            ->whereDate('attendance_date', $dateStr)
            ->pluck('id');

        if ($existingIds->isNotEmpty()) {
            AttendanceLog::whereIn('id', $existingIds)->update(['is_ot' => true]);
        }

        $attendance->is_ot = false;
    }

    public function createOrUpdateRosters(array $rosters)
    {
        $result = DB::transaction(function () use ($rosters) {
            return $this->persistRosters($rosters);
        });

        $dates = collect($result['data'])
            ->pluck('start_date')
            ->map(fn ($date) => Carbon::parse($date)->format('Y-m-d'))
            ->unique()
            ->values()
            ->all();

        $this->invalidateBiometricsRosterCache($dates);

        return $result;
    }

    // node-server (the biometrics/attendance service) caches each day's roster in
    // Redis for up to 7 days (see BiometricsService::reloadRosterCache) so device
    // punches don't hit Laravel on every check-in. That cache has no automatic
    // invalidation on roster changes — without this, a newly created/updated
    // roster silently keeps losing to whatever stale snapshot is already cached,
    // and attendance gets matched against the wrong (or no) shift until the cache
    // happens to expire or someone manually reloads it. Both processes share the
    // same Redis instance/DB (see node-server's config/redis/config.redis.ts,
    // which defaults to the same host as this app's REDIS_* config), so deleting
    // the key directly here is enough — node-server's cold-cache path already
    // falls back to a live DB query for the correct roster.
    public function invalidateBiometricsRosterCache(array $dates): void
    {
        foreach (array_unique($dates) as $date) {
            if (!$date) {
                continue;
            }

            try {
                Redis::del("biometrics:roster:{$date}");
            } catch (\Throwable $e) {
                // Best-effort — a Redis hiccup here must not fail the roster save itself.
            }
        }
    }

    private function persistRosters(array $rosters)
    {
        $createdOrUpdated = [];

        foreach ($rosters as $data) {
            $shiftId = $data['shift_id'] ?? null;
            $groupIds = !empty($data['group_ids']) ? array_values(array_unique(array_map('intval', $data['group_ids']))) : array_filter([$data['group_id'] ?? null]);
            $groupId = $groupIds[0] ?? null;
            $employeeId = $data['employee_id'] ?? null;

            $startDate = Carbon::parse($data['start_date'])->startOfDay();
            $endDate   = Carbon::parse($data['end_date'])->endOfDay();

            $dateRange = CarbonPeriod::create($startDate, $endDate);

            foreach ($dateRange as $date) {
                $rosterDateStart = $date->copy()->startOfDay();
                $rosterDateEnd = $date->copy()->endOfDay();

                if (!empty($data['roster_id'])) {
                    $roster = Roster::find($data['roster_id']);
                    if ($roster) {
                        $roster->update([
                            'shift_id' => $shiftId,
                            'group_id' => $groupId,
                            'employee_id' => $employeeId,
                            'start_date' => $rosterDateStart,
                            'end_date' => $rosterDateEnd,
                        ]);
                        $roster->groups()->sync($groupIds);
                        $createdOrUpdated[] = $roster;
                        continue;
                    }
                }

                $existingRoster = Roster::whereDate('start_date', $rosterDateStart)
                    ->whereDate('end_date', $rosterDateEnd)
                    ->where('shift_id', $shiftId)
                    ->first();

                if ($existingRoster) {
                    $existingRoster->update([
                        'group_id' => $groupId,
                        'employee_id' => $employeeId,
                    ]);
                    $existingRoster->groups()->sync($groupIds);
                    $createdOrUpdated[] = $existingRoster;
                    continue;
                }

                $roster = Roster::create([
                    'shift_id' => $shiftId,
                    'group_id' => $groupId,
                    'employee_id' => $employeeId,
                    'start_date' => $rosterDateStart,
                    'end_date' => $rosterDateEnd,
                    'is_active' => true,
                ]);
                $roster->groups()->sync($groupIds);

                $createdOrUpdated[] = $roster;
            }
        }

        return [
            'message' => 'Rosters processed successfully',
            'data' => $createdOrUpdated,
        ];
    }

    public function getRosterSchedule(string $startDate, string $endDate, bool $showAllEmployees, array $specificEmployeeIds = []): array
    {
        try {
            $startDate = Carbon::parse($startDate)->startOfDay();
            $endDate   = Carbon::parse($endDate)->endOfDay();
            $period = CarbonPeriod::create($startDate, $endDate);

            $rosters = Roster::where('is_active', true)
                ->where('start_date', '<=', $endDate)
                ->where('end_date', '>=', $startDate)
                ->with('shift', 'group', 'groups')
                ->get();

            $groupIds = $rosters->flatMap(fn($roster) => $roster->all_group_ids)->filter()->unique();
            $employeeIds = $rosters->pluck('employee_id')->filter()->unique();

            $employeeQuery = Employee::where('is_active', true)->with(['group', 'department']);

            if ($showAllEmployees) {
                $employeeQuery->whereIn('group_id', $groupIds)->orWhereIn('id', $employeeIds);
            } else {
                $employeeQuery->whereIn('id', $specificEmployeeIds);
            }
            
            $employees = $employeeQuery->get();
            $allEmployeeIds = $employees->pluck('id')->unique();

            $overridesQuery = ShiftOverrides::where('is_active', true)
                ->whereBetween('date', [$startDate, $endDate])
                ->where(function ($overrideQuery) use ($allEmployeeIds) {
                    $overrideQuery->whereIn('absent_employee_id', $allEmployeeIds)
                        ->orWhereIn('replacement_employee_id', $allEmployeeIds);
                })
                ->with([
                    'shift',
                    'secondShift',
                    'roster.group',
                    'roster.groups',
                    'absentEmployee:id,first_name,last_name',
                    'replacementEmployee:id,first_name,last_name,group_id',
                    'replacementEmployee.group:id,name',
                ]);

            $overrides = $overridesQuery->get();

            $overrideEmployeeIds = $overrides->pluck('absent_employee_id')
                                    ->merge($overrides->pluck('replacement_employee_id'))
                                    ->filter()
                                    ->unique();

            $missingEmployeeIds = $overrideEmployeeIds->diff($allEmployeeIds);

            if ($missingEmployeeIds->isNotEmpty()) {
                $additionalEmployees = Employee::where('is_active', true)
                                        ->with(['group', 'department'])
                                        ->whereIn('id', $missingEmployeeIds)
                                        ->get();

                $employees = $employees->merge($additionalEmployees);
                $allEmployeeIds = $employees->pluck('id')->unique();
            }

            $leaveRequests = LeaveRequest::where('final_status', 'approved')
                ->whereIn('employee_id', $allEmployeeIds)
                ->where(fn($query) => $query->where('start_date', '<=', $endDate)->where('end_date', '>=', $startDate))
                ->get();

            $employeeWeekends = EmployeeWeekend::where('status', 'APPROVED')
                ->where('type', 'WEEKEND')
                ->whereIn('employee_id', $allEmployeeIds)
                ->whereBetween('weekend_date', [$startDate, $endDate])
                ->get();

            $holidaySwaps = EmployeeHolidaySwap::where('status', 'APPROVED')
                ->where('type', 'WEEKEND')
                ->whereIn('employee_id', $allEmployeeIds)
                ->whereBetween('swapped_holiday_date', [$startDate, $endDate])
                ->get();

            $allShifts = EmployeeShift::where('is_active', true)->get();

            $finalSchedule = ['data' => []];

            foreach ($period as $date) {
                $currentDateStr = $date->format('Y-m-d');
                $dayData = [
                    'day' => $currentDateStr,
                    'shifts' => [],
                ];

                $rostersForThisDay = $rosters->filter(function ($roster) use ($date) {
                    $rosterStart = Carbon::parse($roster->start_date)->startOfDay();
                    $rosterEnd = Carbon::parse($roster->end_date)->endOfDay();

                    return $date->between($rosterStart, $rosterEnd);
                });

                $activeEmployees = $employees->filter(function ($employee) use ($rostersForThisDay, $overrides, $currentDateStr) {

                    $isOnOverride = $overrides->first(function ($override) use ($employee, $currentDateStr) {
                        return $override->date->format('Y-m-d') == $currentDateStr &&
                            ($override->absent_employee_id == $employee->id || $override->replacement_employee_id == $employee->id);
                    });

                    if ($isOnOverride) return true;

                    $employeeRosters = $rostersForThisDay->filter(function ($roster) use ($employee) {
                        $isAssignedDirectly = (int) $roster->employee_id === (int) $employee->id;
                        $isAssignedByGroup = !is_null($employee->group_id) && in_array((int) $employee->group_id, array_map('intval', $roster->all_group_ids), true);

                        return $isAssignedDirectly || $isAssignedByGroup;
                    });

                    return $employeeRosters->isNotEmpty();
                });


                $shiftsForThisDay = [];

                foreach ($rostersForThisDay as $roster) {
                    $shift = $roster->shift;
                    if ($shift) {
                        $key = $roster->id . '-' . $shift->id;
                        $shiftsForThisDay[$key] = [
                            'roster_id' => $roster->id,
                            'groups' => $roster->groups_list,
                            'shift_name' => $shift->name,
                            'shift_id' => $shift->id,
                            'color' => $shift->color,
                            'start_time' => $shift->start_time,
                            'late_start_time' => $shift->late_start_time,
                            'early_start_time' => $shift->early_start_time,
                            'end_time' => $shift->end_time,
                            'employees' => [],
                        ];
                    }
                }

                foreach ($activeEmployees as $employee) {
                    $holidayStatus = 'Regular';
                    $currentCarbonDate = $date;
                    $onLeave = $leaveRequests->first(fn($leave) => $leave->employee_id == $employee->id && $currentCarbonDate->between(Carbon::parse($leave->start_date)->startOfDay(), Carbon::parse($leave->end_date)->endOfDay()));
                    if ($onLeave) $holidayStatus = 'Leave';
                    if ($holidayStatus == 'Regular') {
                        $onWeekend = $employeeWeekends->first(fn($weekend) => $weekend->employee_id == $employee->id && $weekend->weekend_date == $currentDateStr);
                        if ($onWeekend) $holidayStatus = 'Weekend';
                    }
                    if ($holidayStatus == 'Regular') {
                        $onSwap = $holidaySwaps->first(fn($status) => $status->employee_id == $employee->id && $status->swapped_holiday_date == $currentDateStr);
                        if ($onSwap) $holidayStatus = 'Swapped';
                    }

                    $assignments = [];
                    $isAbsent = false;
                    $isReplacedOrSwapped = false;

                    $employeeOverrides = $overrides->filter(
                        fn($override) => $override->date->format('Y-m-d') == $currentDateStr && ($override->absent_employee_id == $employee->id || $override->replacement_employee_id == $employee->id)
                    );

                    if ($employeeOverrides->isNotEmpty()) {
                        foreach ($employeeOverrides as $override) {
                            $overrideInfo = [
                                'id' => $override->id,
                                'type' => $override->type,
                                'roster_id' => $override->roster_id,
                                'absent_employee' => $override->absentEmployee ? [
                                    'id' => $override->absentEmployee->id,
                                    'name' => trim($override->absentEmployee->first_name . ' ' . $override->absentEmployee->last_name)
                                ] : null,
                                'replacement_employee' => $override->replacementEmployee ? [
                                    'id' => $override->replacementEmployee->id,
                                    'name' => trim($override->replacementEmployee->first_name . ' ' . $override->replacementEmployee->last_name),
                                    'group_name' => $override->replacementEmployee->group->name ?? null,
                                ] : null,
                            ];

                            if ($override->replacement_employee_id == $employee->id) {
                                $assignments[] = [
                                    'status' => $override->type,
                                    'shiftOnDay' => $override->shift,
                                    'override_info' => $overrideInfo,
                                    'roster_id' => $override->roster_id,
                                    'groups' => $override->roster->groups_list,
                                ];
                                if (in_array($override->type, ['REPLACEMENT', 'SWAP'])) {
                                    $isReplacedOrSwapped = true;
                                }
                            } else if ($override->absent_employee_id == $employee->id) {
                                if ($override->type == 'SWAP') {
                                    $replacementEmployeeId = $override->replacement_employee_id;
                                    if ($replacementEmployeeId) {
                                        $replacementEmployee = $employees->firstWhere('id', $replacementEmployeeId);
                                        $sourceRoster = $rostersForThisDay->first(
                                            fn($roster) => (int) $roster->shift_id === (int) $override->second_shift_id
                                                && (int) $roster->employee_id === (int) $replacementEmployeeId
                                        );

                                        if (!$sourceRoster && $replacementEmployee?->group_id) {
                                            $sourceRoster = $rostersForThisDay->first(
                                                fn($roster) => (int) $roster->shift_id === (int) $override->second_shift_id
                                                    && in_array((int) $replacementEmployee->group_id, array_map('intval', $roster->all_group_ids), true)
                                            );
                                        }

                                        if (!$sourceRoster) {
                                            $sourceRoster = $rostersForThisDay->first(
                                                fn($roster) => (int) $roster->shift_id === (int) $override->second_shift_id
                                            );
                                        }

                                        if ($sourceRoster && $override->secondShift) {
                                            $assignments[] = [
                                                'status' => 'SWAP',
                                                'shiftOnDay' => $override->secondShift,
                                                'override_info' => $overrideInfo,
                                                'roster_id' => $sourceRoster->id,
                                                'groups' => $sourceRoster->groups_list,
                                            ];
                                        }
                                    }
                                    $isReplacedOrSwapped = true;
                                } else {
                                    $isAbsent = true;
                                    $isReplacedOrSwapped = true;
                                }
                            }
                        }
                    }

                    if (!$isReplacedOrSwapped) {
                        $baseRosters = $rostersForThisDay->filter(function ($roster) use ($employee) {
                            $isAssignedDirectly = (int) $roster->employee_id === (int) $employee->id;
                            $isAssignedByGroup = !is_null($employee->group_id) && in_array((int) $employee->group_id, array_map('intval', $roster->all_group_ids), true);

                            return $isAssignedDirectly || $isAssignedByGroup;
                        });

                        foreach ($baseRosters as $baseRoster) {
                            $assignments[] = [
                                'status' => 'Regular',
                                'shiftOnDay' => $baseRoster->shift,
                                'override_info' => null,
                                'roster_id' => $baseRoster->id,
                                'groups' => $baseRoster->groups_list,
                            ];
                        }
                    }

                    if ($isAbsent || empty($assignments)) continue;

                    foreach ($assignments as $assignment) {
                        $shiftOnDay = $assignment['shiftOnDay'];
                        if (!$shiftOnDay) continue;

                        $status = $assignment['status'];
                        $overrideInfo = $assignment['override_info'];
                        $rosterId = $assignment['roster_id'] ?? 'N/A';
                        $shiftId = $shiftOnDay->id ?? 'N/A';
                        $key = $rosterId . '-' . $shiftId;

                        if (!isset($shiftsForThisDay[$key])) {
                            $shiftsForThisDay[$key] = [
                                'roster_id' => $rosterId,
                                'groups' => $assignment['groups'] ?? [],
                                'shift_name' => $shiftOnDay->name,
                                'shift_id' => $shiftId,
                                'color' => $shiftOnDay->color,
                                'start_time' => $shiftOnDay->start_time,
                                'late_start_time' => $shiftOnDay->late_start_time,
                                'early_start_time' => $shiftOnDay->early_start_time,
                                'end_time' => $shiftOnDay->end_time,
                                'employees' => [],
                            ];
                        }

                        $newEmployeeEntry = [
                            'employee_details' => [
                                'id' => $employee->id,
                                'name' => trim($employee->first_name . ' ' . $employee->last_name),
                                'custom_id' => $employee->custom_id,
                                'employee_no' => $employee->employee_no ?? null,
                                'group' => $employee->group->name ?? null,
                                'designation' => $employee->designation ?? null,
                                'department' => $employee->department->name ?? null,
                                'holiday_status' => $holidayStatus,
                            ],
                            'status' => $status,
                            'override_info' => $overrideInfo,
                        ];

                        $existingEmployeeIndex = null;
                        foreach ($shiftsForThisDay[$key]['employees'] as $index => $existingEmployee) {
                            if ((int) ($existingEmployee['employee_details']['id'] ?? 0) === (int) $employee->id) {
                                $existingEmployeeIndex = $index;
                                break;
                            }
                        }

                        if ($existingEmployeeIndex !== null) {
                            $existingStatus = strtoupper($shiftsForThisDay[$key]['employees'][$existingEmployeeIndex]['status'] ?? '');
                            $newStatus = strtoupper($status);

                            if ($existingStatus === 'REGULAR' && $newStatus !== 'REGULAR') {
                                $shiftsForThisDay[$key]['employees'][$existingEmployeeIndex] = $newEmployeeEntry;
                            }

                            continue;
                        }

                        $shiftsForThisDay[$key]['employees'][] = $newEmployeeEntry;
                    }
                }

                foreach ($allShifts as $shift) {
                    $exists = collect($shiftsForThisDay)->firstWhere('shift_id', $shift->id);
                    if (!$exists) {
                        $shiftsForThisDay['empty-' . $shift->id] = [
                            'roster_id' => null,
                            'groups' => [],
                            'shift_name' => $shift->name,
                            'shift_id' => $shift->id,
                            'color' => $shift->color,
                            'start_time' => $shift->start_time,
                            'late_start_time' => $shift->late_start_time,
                            'early_start_time' => $shift->early_start_time,
                            'end_time' => $shift->end_time,
                            'employees' => [],
                        ];
                    }
                }

                $shiftGroups = array_values($shiftsForThisDay);
                usort($shiftGroups, fn($emp_ab, $emp_rp) => ($emp_ab['shift_id'] <=> $emp_rp['shift_id']));
                $dayData['shifts'] = $shiftGroups;
                $finalSchedule['data'][] = $dayData;
            }

            return $finalSchedule;
        } catch (\Exception $e) {
            return [
                'data' => [],
                'message' => 'Failed to generate roster schedule: ' . $e->getMessage(),
            ];
        }
    }
}
