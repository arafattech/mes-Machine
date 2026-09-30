<?php

namespace App\Http\Controllers;

use App\Models\MachineMaintenanceSchedule;
use App\Services\MachineMaintenanceService;
use Carbon\Carbon;
use Illuminate\Http\Request;

/**
 * Manual machine-maintenance scheduling. Thin wrapper over
 * MachineMaintenanceService — inline validation per the
 * MachineConfigController::validatePayload() convention (no FormRequest
 * classes exist in this repo).
 */
class MachineMaintenanceController extends Controller
{
    public function __construct(private readonly MachineMaintenanceService $maintenanceService) {}

    /** Grid read — REST counterpart of the old `MachineMaintenanceSchedules` OData entity. */
    public function index(Request $request)
    {
        $top = max(1, min(200, (int) $request->query('$top', 40)));
        $skip = max(0, (int) $request->query('$skip', 0));

        $query = MachineMaintenanceSchedule::with(['machine', 'endedByUser']);
        $this->applyFilter($query, (string) $request->query('$filter', ''));
        $this->applySort($query, (string) $request->query('$orderby', ''));

        $total = (clone $query)->count();
        $rows = $query->skip($skip)->take($top)->get()->map(function (MachineMaintenanceSchedule $row) {
            $data = $row->toArray();
            // Preserve the OData contract: Lodata rendered this backed enum by its case
            // name (`MANUAL`/`AUTO`), not its lowercase DB value — the frontend still
            // checks the uppercase form (`machine-maintenance-list.component.ts`).
            $data['ended_by'] = $row->ended_by?->name;

            return $data;
        });

        return response()->json(['data' => $rows, 'total' => $total]);
    }

    /** Real date columns the grid's per-column text filter (`contains(tolower(...))`) may target. */
    private const DATE_FILTER_FIELDS = ['scheduled_start_at', 'activated_at', 'ended_at'];

    /**
     * Recognizes exactly the fixed shapes the frontend generates into `$filter` — never
     * a general OData parser (same convention as
     * `MachineController::applyProductionLogFilter()`):
     *   - search box (nav-path lambda + plain column, OR'd): searchFields
     *     `['machine.machine_name', 'reason']`
     *   - the list's permanent 5-day lookahead cap (`baseFilter` in the component):
     *     `scheduled_start_at le <ISO8601>`
     *   - a date column's floating text filter (typed substring, e.g. "2026-01"):
     *     `contains(tolower(<scheduled_start_at|activated_at|ended_at>), '<term>')`
     *   - the Status column's multiSelect header (`status` has no real column — it's
     *     `MachineMaintenanceListComponent.scheduleStatus()`, derived from
     *     `activated_at`/`ended_at`): `status eq 'scheduled'`, OR'd for multiple picks
     */
    private function applyFilter($query, string $filter): void
    {
        if ($filter === '') {
            return;
        }

        if (preg_match(
            "/machine\/any\(a:contains\(tolower\(a\/machine_name\), *'([^']*)'\)\)\) or \(contains\(tolower\(reason\), *'([^']*)'\)\)/",
            $filter,
            $m
        )) {
            $term = $m[1];
            $query->where(function ($q) use ($term) {
                $q->whereHas('machine', fn ($mq) => $mq->where('machine_name', 'like', '%' . $term . '%'))
                    ->orWhere('reason', 'like', '%' . $term . '%');
            });
        }

        if (preg_match('/scheduled_start_at le ([0-9T:.\-]+Z)/', $filter, $m)) {
            $query->where('scheduled_start_at', '<=', Carbon::parse($m[1])->format('Y-m-d H:i:s'));
        }

        foreach (self::DATE_FILTER_FIELDS as $field) {
            if (preg_match("/contains\(tolower\($field\), *'([^']*)'\)/", $filter, $m)) {
                $query->whereRaw("LOWER($field) LIKE ?", ['%' . strtolower($m[1]) . '%']);
            }
        }

        if (preg_match_all("/status eq '(scheduled|active|ended)'/", $filter, $m) && $m[1]) {
            $statuses = array_unique($m[1]);
            $query->where(function ($q) use ($statuses) {
                foreach ($statuses as $status) {
                    $q->orWhere(fn ($q2) => match ($status) {
                        'scheduled' => $q2->whereNull('activated_at')->whereNull('ended_at'),
                        'active' => $q2->whereNotNull('activated_at')->whereNull('ended_at'),
                        'ended' => $q2->whereNotNull('ended_at'),
                    });
                }
            });
        }
    }

    private function applySort($query, string $orderBy): void
    {
        $orderBy = trim($orderBy);

        if (preg_match('/^status (asc|desc)$/i', $orderBy, $m)) {
            $this->orderByStatusPriority($query, strtolower($m[1]));
            $query->orderBy('scheduled_start_at', 'desc');
            return;
        }

        if (preg_match('/^(\w+) (asc|desc)$/i', $orderBy, $m)) {
            $query->orderBy($m[1], strtolower($m[2]));
            return;
        }

        // Default (no explicit sort yet): surface what needs attention first —
        // Scheduled, then Active, historical Ended rows last — newest-scheduled
        // first within each group.
        $this->orderByStatusPriority($query, 'asc');
        $query->orderBy('scheduled_start_at', 'desc');
    }

    /** `status`'s priority order matches `MachineMaintenanceListComponent.scheduleStatus()`:
     * scheduled (no activated_at) < active (activated_at, not ended) < ended. */
    private function orderByStatusPriority($query, string $direction): void
    {
        $query->orderByRaw(
            "(CASE WHEN ended_at IS NOT NULL THEN 2 WHEN activated_at IS NOT NULL THEN 1 ELSE 0 END) $direction"
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'machine_id' => ['required', 'integer', 'exists:machines,id'],
            'scheduled_start_at' => ['required', 'date'],
            'reason' => ['required', 'string', 'max:500'],
            'buffer_enabled' => ['sometimes', 'boolean'],
        ]);

        $schedule = $this->maintenanceService->schedule(
            (int) $validated['machine_id'],
            $validated['scheduled_start_at'],
            $validated['reason'],
            (int) auth()->id(),
            $validated['buffer_enabled'] ?? true,
        );

        return response()->json([
            'message' => 'Maintenance scheduled successfully.',
            'data' => $schedule,
        ], 201);
    }

    public function update(Request $request, int $id)
    {
        $validated = $request->validate([
            'machine_id' => ['sometimes', 'integer', 'exists:machines,id'],
            'scheduled_start_at' => ['sometimes', 'date'],
            'reason' => ['sometimes', 'string', 'max:500'],
            'buffer_enabled' => ['sometimes', 'boolean'],
        ]);

        $schedule = $this->maintenanceService->update(
            $id,
            isset($validated['machine_id']) ? (int) $validated['machine_id'] : null,
            $validated['scheduled_start_at'] ?? null,
            $validated['reason'] ?? null,
            $validated['buffer_enabled'] ?? null,
        );

        if (! $schedule) {
            return response()->json([
                'message' => 'Maintenance schedule not found.',
            ], 404);
        }

        return response()->json([
            'message' => 'Maintenance schedule updated successfully.',
            'data' => $schedule,
        ]);
    }

    public function destroy(int $id)
    {
        if (! $this->maintenanceService->delete($id)) {
            return response()->json([
                'message' => 'Maintenance schedule not found.',
            ], 404);
        }

        return response()->json([
            'message' => 'Maintenance schedule deleted successfully.',
        ]);
    }

    /** Activate a single SCHEDULED row on demand (per-row "Activate now"). */
    public function activate(Request $request, int $id)
    {
        $validated = $request->validate([
            'buffer_minutes' => ['required', 'integer', 'min:1', 'max:1440'],
        ]);

        $this->maintenanceService->activate($id, (int) $validated['buffer_minutes']);

        return response()->json([
            'message' => 'Maintenance activated successfully.',
        ]);
    }

    public function end(Request $request, int $machineId)
    {
        $validated = $request->validate([
            'maintenance_note' => ['nullable', 'string'],
        ]);

        $ended = $this->maintenanceService->endForMachine($machineId, (int) auth()->id(), $validated['maintenance_note'] ?? null);

        if (! $ended) {
            return response()->json([
                'message' => 'No open maintenance schedule for this machine.',
            ], 422);
        }

        return response()->json([
            'message' => 'Maintenance ended successfully.',
        ]);
    }
}
