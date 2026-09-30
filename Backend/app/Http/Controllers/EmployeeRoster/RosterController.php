<?php

namespace App\Http\Controllers\EmployeeRoster;

use App\Exports\RostersExport;
use App\Http\Controllers\Controller;
use App\Models\Roster;
use App\Models\ShiftOverrides;
use Carbon\Carbon;
use Illuminate\Http\Request;
use App\Services\hrModule\EmployeeRosterService;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Facades\Excel;

class RosterController extends Controller
{

    protected $rosterService;

    public function __construct(EmployeeRosterService $rosterService)
    {
        $this->rosterService = $rosterService;
    }

    public function store(Request $request, EmployeeRosterService $service)
    {
        try {
            $validated = $request->validate([
                'rosters' => 'required|array|min:1',
                'rosters.*.roster_id' => 'nullable|integer|exists:rosters,id',
                'rosters.*.shift_id' => 'nullable|integer|exists:employee_shifts,id',
                'rosters.*.group_id' => 'nullable|integer|exists:employee_groups,id',
                'rosters.*.group_ids' => 'nullable|array',
                'rosters.*.group_ids.*' => 'integer|exists:employee_groups,id',
                'rosters.*.employee_id' => 'nullable|integer|exists:employees,id',
                'rosters.*.start_date' => 'required|date_format:Y-m-d',
                'rosters.*.end_date' => 'required|date_format:Y-m-d|after_or_equal:rosters.*.start_date',
            ]);

            $results = $service->createOrUpdateRosters($validated['rosters']);

            return response()->json($results, 200);

        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Something went wrong',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function index()
    {
        $rosters = Roster::with(['shift', 'group', 'employee'])
            ->orderBy('start_date', 'desc')
            ->paginate(20);

        return response()->json($rosters);
    }

    public function getLatestRoster(Request $request)
    {
        try {
            $latestRoster = Roster::where('is_active', true)
                ->orderByDesc('end_date')
                ->with(['shift', 'group', 'employee'])
                ->first();

            if (!$latestRoster) {
                return response()->json([
                    'latest_roster' => 'N/A'
                ]);
            }

            return response()->json([
                'latest_roster' => [
                    'id' => $latestRoster->id,
                    'shift_id' => $latestRoster->shift_id,
                    'group_id' => $latestRoster->group_id,
                    'employee_id' => $latestRoster->employee_id,
                    'start_date' => $latestRoster->start_date,
                    'end_date' => $latestRoster->end_date
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Something went wrong',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function getOverrides($id)
    {
        $roster = Roster::find($id);

        if (!$roster) {
            return response()->json(['message' => 'Roster not found.'], 404);
        }

        $overrides = ShiftOverrides::where('roster_id', $roster->id)
            ->with([
                'shift',
                'secondShift',
                'absentEmployee:id,first_name,last_name,custom_id',
                'replacementEmployee:id,first_name,last_name,custom_id'
            ])
            ->get();

        return response()->json($overrides);
    }

    public function getSchedule(Request $request, EmployeeRosterService $service)
    {

        $validated = $request->validate([
            'start_date' => 'required|date_format:Y-m-d',
            'end_date' => 'required|date_format:Y-m-d|after_or_equal:start_date',
            'all_employees' => 'required|boolean',
            'employee_ids' => 'nullable|array|required_if:all_employees,false',
            'employee_ids.*' => 'integer|exists:employees,id',
        ]);

        $data = $service->getRosterSchedule(
            $validated['start_date'],
            $validated['end_date'],
            $validated['all_employees'],
            $validated['employee_ids'] ?? []
        );

        return response()->json($data);
    }

    public function exportSchedule(Request $request, EmployeeRosterService $service)
    {
        $validated = $request->validate([
            'start_date' => 'required|date_format:Y-m-d',
            'end_date' => 'required|date_format:Y-m-d|after_or_equal:start_date',
            'all_employees' => 'required|boolean',
            'employee_ids' => 'nullable|array|required_if:all_employees,false',
            'employee_ids.*' => 'integer|exists:employees,id',
        ]);

        $schedule = $service->getRosterSchedule(
            $validated['start_date'],
            $validated['end_date'],
            $validated['all_employees'],
            $validated['employee_ids'] ?? []
        );

        if (!empty($schedule['message']) && empty($schedule['data'])) {
            return response()->json([
                'message' => $schedule['message'],
            ], 500);
        }

        $start = Carbon::parse($validated['start_date'])->format('Y-m-d');
        $end = Carbon::parse($validated['end_date'])->format('Y-m-d');
        $scope = $validated['all_employees'] ? 'all' : 'individual';
        $filename = $start === $end
            ? "roster_{$scope}_{$start}.xlsx"
            : "roster_{$scope}_{$start}_to_{$end}.xlsx";

        return Excel::download(
            new RostersExport($schedule['data'] ?? [], $validated),
            $filename
        );
    }

    public function shiftOVerrides(Request $request)
    {
        try {

            $validated = $request->validate([
                'roster_id' => 'required|exists:rosters,id',
                'date' => 'required|date',
                'type' => 'required|string|in:REPLACEMENT,SWAP,EXTRA',
                'absent_employee_id' => 'nullable|exists:employees,id',
                'replacement_employee_id' => 'nullable|exists:employees,id',
                'shift_id' => 'nullable|exists:employee_shifts,id',
                'second_shift_id' => 'nullable|exists:employee_shifts,id',
            ]);
            $roster = Roster::with('shift')->findOrFail($validated['roster_id']);
            $shiftId = $validated['shift_id'] ?? $roster->shift_id;

            if (
                !empty($validated['absent_employee_id']) &&
                !empty($validated['replacement_employee_id']) &&
                $validated['absent_employee_id'] === $validated['replacement_employee_id']
            ) {
                return response()->json(['message' => 'Absent and replacement employees cannot be the same.'], 422);
            }

            $override = ShiftOverrides::create([
                'roster_id' => $validated['roster_id'],
                'shift_id' => $shiftId,
                'date' => $validated['date'],
                'type' => strtoupper($validated['type']),
                'absent_employee_id' => $validated['absent_employee_id'] ?? null,
                'replacement_employee_id' => $validated['replacement_employee_id'] ?? null,
                'second_shift_id' => $validated['second_shift_id'] ?? null,
                'is_active' => true,
            ]);

            $this->rosterService->invalidateBiometricsRosterCache([
                Carbon::parse($validated['date'])->format('Y-m-d'),
            ]);

            return response()->json([
                'message' => 'Shift override created successfully.',
                'data' => $override->load(['shift', 'absentEmployee', 'replacementEmployee', 'roster'])
            ], 201);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Failed to create override: ' . $e->getMessage()
            ], 500);
        }
    }
}
