<?php

namespace App\Http\Controllers;

use App\Http\Requests\ScheduleFrequencyRequest;
use App\Models\ScheduleFrequency;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * CRUD for the recurrence intervals recurring maintenance schedules pick from.
 * Grid read follows the `$top`/`$skip`/`$orderby`/`$filter` REST convention of
 * `MaintenanceScheduleController::index()`.
 */
class ScheduleFrequencyController extends Controller
{
    public function index(Request $request)
    {
        $top = max(1, min(200, (int) $request->query('$top', 40)));
        $skip = max(0, (int) $request->query('$skip', 0));

        $query = ScheduleFrequency::query();
        $this->applyFilter($query, (string) $request->query('$filter', ''));
        $this->applySort($query, (string) $request->query('$orderby', ''));

        $total = (clone $query)->count();

        return response()->json([
            'data' => $query->skip($skip)->take($top)->get(),
            'total' => $total,
        ]);
    }

    /** Dropdown source: every frequency (the form hides inactive ones except the schedule's current pick). */
    public function options()
    {
        return response()->json([
            'data' => ScheduleFrequency::orderBy('name')->get(['id', 'name', 'is_active']),
        ]);
    }

    public function store(ScheduleFrequencyRequest $request)
    {
        $frequency = ScheduleFrequency::create($request->validated());

        return response()->json([
            'message' => 'Frequency created successfully',
            'data' => $frequency,
        ], 201);
    }

    public function show(ScheduleFrequency $scheduleFrequency)
    {
        return response()->json(['data' => $scheduleFrequency]);
    }

    public function update(ScheduleFrequencyRequest $request, ScheduleFrequency $scheduleFrequency)
    {
        $scheduleFrequency->update($request->validated());

        return response()->json([
            'message' => 'Frequency updated successfully',
            'data' => $scheduleFrequency,
        ]);
    }

    public function destroy(ScheduleFrequency $scheduleFrequency)
    {
        if ($scheduleFrequency->maintenanceSchedules()->exists()) {
            throw ValidationException::withMessages([
                'id' => 'This frequency is used by maintenance schedules and cannot be deleted.',
            ]);
        }

        $scheduleFrequency->delete();

        return response()->json(['message' => 'Frequency deleted successfully']);
    }

    /**
     * Recognizes exactly the fixed shapes the frontend generates into `$filter` for this
     * grid — the search box over `searchFields` (`name`) and the All/Active/Inactive
     * segment (`is_active eq true|false`) — never a general OData parser.
     */
    private function applyFilter($query, string $filter): void
    {
        if ($filter === '') {
            return;
        }

        if (preg_match("/contains\(tolower\(name\), *'([^']*)'\)/", $filter, $m)) {
            $query->where('name', 'like', '%' . $m[1] . '%');
        }

        if (preg_match('/\bis_active eq (true|false)\b/', $filter, $m)) {
            $query->where('is_active', $m[1] === 'true');
        }
    }

    private function applySort($query, string $orderBy): void
    {
        if (preg_match('/^(\w+) (asc|desc)$/i', trim($orderBy), $m)
            && in_array($m[1], ['id', 'name', 'interval_days', 'is_active'], true)) {
            $query->orderBy($m[1], strtolower($m[2]));
            return;
        }

        $query->orderBy('name');
    }
}
