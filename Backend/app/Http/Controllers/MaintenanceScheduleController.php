<?php

namespace App\Http\Controllers;

use App\Enums\Machine\MaintenanceWorkType;
use App\Models\ScheduleFrequency;
use App\Models\MaintenanceSchedule;
use App\Models\MachineMaintenanceSchedule;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Carbon\Carbon;

class MaintenanceScheduleController extends Controller
{
    public function index(Request $request)
    {
        $top = max(1, min(200, (int) $request->query('$top', 40)));
        $skip = max(0, (int) $request->query('$skip', 0));

        $query = MaintenanceSchedule::with(['machine', 'frequency']);
        $this->applyFilter($query, (string) $request->query('$filter', ''));
        $this->applySort($query, (string) $request->query('$orderby', ''));

        $total = (clone $query)->count();
        $schedules = $query->skip($skip)->take($top)->get();

        return response()->json([
            'data' => $schedules,
            'total' => $total,
        ]);
    }

    /**
     * Recognizes exactly the fixed shapes the frontend generates into `$filter` for this
     * grid — the search box over `searchFields` (`machine.machine_name`, `frequency.name`) and
     * the toolbar's All/Active/Inactive segment (`is_active eq true|false`) — never a
     * general OData parser (same convention as `MachineController::applyProductionLogFilter()`).
     */
    private function applyFilter($query, string $filter): void
    {
        if ($filter === '') {
            return;
        }

        if (preg_match(
            "/machine\/any\(a:contains\(tolower\(a\/machine_name\), *'([^']*)'\)\)\) or \(frequency\/any\(a:contains\(tolower\(a\/name\), *'([^']*)'\)\)/",
            $filter,
            $m
        )) {
            $term = $m[1];
            $query->where(function ($q) use ($term) {
                $q->whereHas('machine', fn ($mq) => $mq->where('machine_name', 'like', '%' . $term . '%'))
                    ->orWhereHas('frequency', fn ($fq) => $fq->where('name', 'like', '%' . $term . '%'));
            });
        }

        if (preg_match('/\bis_active eq (true|false)\b/', $filter, $m)) {
            $query->where('is_active', $m[1] === 'true');
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
            'schedule_frequency_id' => 'required|exists:schedule_frequencies,id',
            'type_of_work' => ['required', Rule::enum(MaintenanceWorkType::class)],
            'is_active' => 'boolean',
            'buffer_enabled' => 'boolean',
            'buffer_minutes' => 'integer|min:1|max:1440',
        ]);

        $nextDate = $this->calculateNextDate($validated['start_date'], $validated['scheduled_time'], $validated['schedule_frequency_id']);

        $schedule = MaintenanceSchedule::create([
            ...$validated,
            'is_active' => $validated['is_active'] ?? true,
            'buffer_enabled' => $validated['buffer_enabled'] ?? true,
            'buffer_minutes' => $validated['buffer_minutes'] ?? MachineMaintenanceSchedule::DEFAULT_BUFFER_MINUTES,
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
                'buffer_minutes' => $schedule->buffer_minutes,
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
            'schedule_frequency_id' => 'sometimes|exists:schedule_frequencies,id',
            'type_of_work' => ['sometimes', Rule::enum(MaintenanceWorkType::class)],
            'is_active' => 'boolean',
            'buffer_enabled' => 'boolean',
            'buffer_minutes' => 'integer|min:1|max:1440',
        ]);

        if (isset($validated['start_date']) || isset($validated['scheduled_time']) || isset($validated['schedule_frequency_id'])) {
            $startDate = $validated['start_date'] ?? $schedule->start_date;
            $scheduledTime = $validated['scheduled_time'] ?? $schedule->scheduled_time;
            $frequencyId = $validated['schedule_frequency_id'] ?? $schedule->schedule_frequency_id;
            $validated['next_maintenance_date'] = $this->calculateNextDate($startDate, $scheduledTime, $frequencyId);
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

    private function calculateNextDate($startDate, $time, int $frequencyId): Carbon
    {
        return ScheduleFrequency::findOrFail($frequencyId)->nextAfter(Carbon::parse($startDate . ' ' . $time));
    }
}
