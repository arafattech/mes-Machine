<?php

namespace App\Http\Controllers;

use App\Models\AttendanceLog;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Services\hrModule\EmployeeAnalytics;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use App\Services\hrModule\EmployeeRosterService;


class HrmDashboardAnalyticsController extends Controller
{
    protected $rosterService;

    public function __construct(EmployeeRosterService $rosterService)
    {
        $this->rosterService = $rosterService;
    }


    public function todaySummary(Request $request , EmployeeRosterService $service )
    {
        $today = Carbon::today()->toDateString();

        $totalEmployees = Employee::query()
            ->where('is_active', 1)
            ->count();
        $totalOverTime = AttendanceLog::query()
            ->where('has_overtime', 1)
            ->whereDate('attendance_date', $today)
            ->count();

        $presentCount = AttendanceLog::query()
            ->where('is_active', 1)
            ->whereDate('attendance_date', $today)
            ->whereNotNull('check_in_time')
            ->distinct('employee_id')
            ->count('employee_id');

        $absentCount = max($totalEmployees - $presentCount, 0);

        $leaveTodayCount = LeaveRequest::query()
            ->where('is_active', 1)
            ->where('final_status', 'approved')
            ->whereDate('start_date', '<=', $today)
            ->whereDate('end_date', '>=', $today)
            ->count();

        $shiftId = (int) $request->query('shift_id');


        $ShiftResponse = $service->getRosterSchedule(
            $today,
            $today,
            1,
            []
        );

        $shiftEmployeeCount = collect($ShiftResponse['data'])
            ->flatMap(fn($day) => $day['shifts'])
            ->where('shift_id', $shiftId)
            ->flatMap(fn($shift) => collect($shift['employees'])->pluck('employee_details.id'))
            ->unique()
            ->count();

        $totalInShift = $shiftEmployeeCount + $totalOverTime;


        $totalShiftPresent = AttendanceLog::query()
            ->where('shift_id', $shiftId)
            ->whereDate('attendance_date', $today)
            ->count();

        $totalAbsentInShift = max($totalInShift - ($totalShiftPresent + $totalOverTime), 0);

        $lateCount = AttendanceLog::query()
            ->where('status', 'LATE')
            ->whereDate('attendance_date', $today)
            ->when($shiftId, fn($q) => $q->where('shift_id', $shiftId))
            ->count();

        return response()->json([
            'data' => [
                'totalEmployees' => $totalEmployees,
                'presentCount' => $presentCount,
                'absentCount' => $absentCount,
                'leaveTodayCount' => $leaveTodayCount,
            ],
            'shift-data' => [
                'totalOverTime' => $totalOverTime,
                'shiftEmployeeCount' => $shiftEmployeeCount,
                'totalInShift' => $totalInShift,
                'totalShiftPresent' => $totalShiftPresent,
                'totalAbsentInShift' => $totalAbsentInShift,
                'lateCount' => $lateCount,
            ],
        ]);
    }

    public function dashboard(Request $request, EmployeeAnalytics $analytics)
    {
        try {
            $data = $request->validate([
                'start' => ['required', 'date'],
                'end' => ['required', 'date'],
                'department_id' => ['nullable'],
            ]);

            if ($data['start'] > $data['end']) {
                throw ValidationException::withMessages([
                    'start' => ['Start date must be <= end date.'],
                ]);
            }

            $departmentId = $data['department_id'] ?? null;
            return response()->json([
                'data' => [
                    'attendance' => $analytics->attendanceSummary($data['start'], $data['end'], $departmentId),
                    'leaveSummary' => $analytics->leaveSummary($data['start'], $data['end'], $departmentId),
                    'payroll' => $analytics->monthWiseSummary($data['start'], $data['end'], $departmentId),
                    'assetAnalysis' => $analytics->assetSummary($data['start'], $data['end'], $departmentId),
                    'groupAnalysis' => $analytics->groupSummary($data['start'], $data['end'], $departmentId),
                ],
            ]);
        } catch (ValidationException $exception) {
            throw $exception;
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => 'Failed to load dashboard analytics.',
                'error' => $exception->getMessage(),
            ], 500);
        }
    }

    public function shiftEmployeeTrend(Request $request, EmployeeRosterService $service)
    {
        $data = $request->validate([
            'start' => ['required', 'date'],
            'end' => ['required', 'date'],
        ]);

        if ($data['start'] > $data['end']) {
            throw ValidationException::withMessages([
                'start' => ['Start date must be <= end date.'],
            ]);
        }

        $schedule = $service->getRosterSchedule($data['start'], $data['end'], 1, []);

        $shiftEmployeeIds = collect($schedule['data'])
            ->flatMap(fn($day) => $day['shifts'])
            ->groupBy('shift_id')
            ->map(function ($shiftRows) {
                return [
                    'label' => $shiftRows->first()['shift_name'] ?? 'Unassigned',
                    'employeeIds' => $shiftRows->flatMap(
                        fn($shift) => collect($shift['employees'])->pluck('employee_details.id')
                    )->unique(),
                ];
            })
            ->values();

        return response()->json([
            'data' => [
                'labels' => $shiftEmployeeIds->pluck('label')->all(),
                'values' => $shiftEmployeeIds->map(fn($row) => $row['employeeIds']->count())->all(),
            ],
        ]);
    }
}
