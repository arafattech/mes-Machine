<?php

namespace App\Http\Controllers;

use App\Models\MaintenanceSchedule;
use App\Models\MachineMaintenanceSchedule;
use Illuminate\Http\Request;
use Carbon\Carbon;

class MaintenanceScheduleController extends Controller
{
    public function index(Request $request)
    {
        $top = max(1, min(200, (int) $request->query('$top', 40)));
        $skip = max(0, (int) $request->query('$skip', 0));

        $query = MaintenanceSchedule::with('machine');
        $this->applySearchFilter($query, (string) $request->query('$filter', ''));
        $this->applySort($query, (string) $request->query('$orderby', ''));

        $total = (clone $query)->count();
        $schedules = $query->skip($skip)->take($top)->get();

        return response()->json([
            'data' => $schedules,
            'total' => $total,
        ]);
    }

    /**
     * Recognizes exactly the one fixed shape the frontend's search box generates into
     * `$filter` for this grid's `searchFields` (`machine.machine_name`, `frequency`) —
     * never a general OData parser (same convention as
     * `MachineController::applyProductionLogFilter()`).
     */
    private function applySearchFilter($query, string $filter): void
    {
        if ($filter === '') {
            return;
        }

        if (preg_match(
            "/machine\/any\(a:contains\(tolower\(a\/machine_name\), *'([^']*)'\)\)\) or \(contains\(tolower\(frequency\), *'([^']*)'\)\)/",
            $filter,
            $m
        )) {
            $term = $m[1];
            $query->where(function ($q) use ($term) {
                $q->whereHas('machine', fn ($mq) => $mq->where('machine_name', 'like', '%' . $term . '%'))
                    ->orWhere('frequency', 'like', '%' . $term . '%');
            });
        }
    }

    private function applySort($query, string $orderBy): void
    {
        if (preg_match('/^(\w+) (asc|desc)$/i', trim($orderBy), $m)) {
            $query->orderBy($m[1], strtolower($m[2]));
            return;
        }

        $query->orderBy('id', 'desc');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'machine_id' => 'required|exists:machines,id',
            'start_date' => 'required|date',
            'scheduled_time' => 'required|string',
            'frequency' => 'required|in:weekly,10-days,15-days,monthly,yearly',
            'is_active' => 'boolean',
            'buffer_enabled' => 'boolean',
        ]);

        $nextDate = $this->calculateNextDate($validated['start_date'], $validated['scheduled_time'], $validated['frequency']);

        $schedule = MaintenanceSchedule::create([
            ...$validated,
            'is_active' => $validated['is_active'] ?? true,
            'buffer_enabled' => $validated['buffer_enabled'] ?? true,
            'next_maintenance_date' => $nextDate,
            'created_by_user_id' => auth()->id(),
        ]);

        if ($schedule->is_active) {
            MachineMaintenanceSchedule::create([
                'machine_id' => $schedule->machine_id,
                'scheduled_start_at' => $schedule->next_maintenance_date,
                'reason' => 'Schedule Maintenance',
                'created_by_user_id' => auth()->id() ?? 1,
                'maintenance_schedule_id' => $schedule->id,
                'buffer_enabled' => $schedule->buffer_enabled,
            ]);
        }

        return response()->json([
            'message' => 'Schedule created successfully',
            'data' => $schedule,
        ], 201);
    }

    public function show($id)
    {
        $schedule = MaintenanceSchedule::with('machine')->findOrFail($id);
        return response()->json([
            'data' => $schedule,
        ]);
    }

    public function update(Request $request, $id)
    {
        $schedule = MaintenanceSchedule::findOrFail($id);
        
        $validated = $request->validate([
            'machine_id' => 'sometimes|exists:machines,id',
            'start_date' => 'sometimes|date',
            'scheduled_time' => 'sometimes|string',
            'frequency' => 'sometimes|in:weekly,10-days,15-days,monthly,yearly',
            'is_active' => 'boolean',
            'buffer_enabled' => 'boolean',
        ]);

        if (isset($validated['start_date']) || isset($validated['scheduled_time']) || isset($validated['frequency'])) {
            $startDate = $validated['start_date'] ?? $schedule->start_date;
            $scheduledTime = $validated['scheduled_time'] ?? $schedule->scheduled_time;
            $frequency = $validated['frequency'] ?? $schedule->frequency;
            $validated['next_maintenance_date'] = $this->calculateNextDate($startDate, $scheduledTime, $frequency);
        }

        $schedule->update($validated);

        return response()->json([
            'message' => 'Schedule updated successfully',
            'data' => $schedule,
        ]);
    }

    public function destroy($id)
    {
        $schedule = MaintenanceSchedule::findOrFail($id);
        $schedule->delete();

        return response()->json([
            'message' => 'Schedule deleted successfully',
        ]);
    }

    private function calculateNextDate($startDate, $time, $frequency)
    {
        $date = Carbon::parse($startDate . ' ' . $time);
        
        return match ($frequency) {
            'weekly' => $date->addWeek(),
            '10-days' => $date->addDays(10),
            '15-days' => $date->addDays(15),
            'monthly' => $date->addMonth(),
            'yearly' => $date->addYear(),
            default => $date->addDays(1),
        };
    }
}
