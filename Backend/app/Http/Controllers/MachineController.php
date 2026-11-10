<?php

namespace App\Http\Controllers;

use App\Http\Requests\Production\LogProductionCountRequest;
use App\Services\Production\ProductionLogRules;
use App\Models\Machine;
use App\Models\MachineProductionCount;
use App\Models\MachineWastageEntry;
use App\Models\WorkOrder;
use App\Support\FactoryClock;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MachineController extends Controller
{
    /**
     * Work orders this machine is planned against (via `work_order_machines`) and still
     * open — the pick-list for manual production-count entry. Independent of whether any
     * `machine_production_counts` bucket has ever been logged for this machine.
     */
    public function assignedWorkOrders($id)
    {
        $machine = Machine::findOrFail($id);

        $workOrders = $machine->workOrders()
            ->whereIn('status', ['pending', 'in_progress'])
            ->with('product')
            ->get();

        return response()->json([
            'work_orders' => $workOrders->map(fn ($wo) => [
                'id' => $wo->id,
                'custom_id' => $wo->custom_id,
                'product_name' => $wo->product->product_name ?? null,
                'quantity' => $wo->quantity,
                'status' => $wo->status,
            ]),
        ]);
    }

    /**
     * Manual production-count entry — this plant's PLCs only report machine state
     * (Active/Idle/Inactive), not piece counts, so good/scrap counts can't be captured
     * automatically. An operator logs them here instead, same as the standard MES
     * "manual data collection" pattern. Writes one `machine_production_counts` bucket
     * spanning from the last logged bucket's end (or 1 hour ago if none) to now.
     */
    public function logProductionCount(LogProductionCountRequest $request, ProductionLogRules $logRules, $id)
    {
        $machine = Machine::findOrFail($id);
        $validated = $request->validated();
        $logRules->assertCanLog(WorkOrder::findOrFail($validated['work_order_id']), FactoryClock::today());

        $isAssigned = $machine->workOrders()->where('work_orders.id', $validated['work_order_id'])->exists();
        if (!$isAssigned) {
            return response()->json([
                'message' => 'This work order is not assigned to this machine.',
            ], 422);
        }

        $bucketStartedAt = MachineProductionCount::where('machine_id', $machine->id)
            ->max('bucket_ended_at') ?? now()->subHour();

        $bucket = MachineProductionCount::create([
            'machine_id' => $machine->id,
            'work_order_id' => $validated['work_order_id'],
            'shift_id' => $validated['shift_id'],
            'bucket_started_at' => $bucketStartedAt,
            'bucket_ended_at' => now(),
            'good_count' => $validated['good_count'],
            'scrap_count' => $validated['scrap_count'],
            'total_count' => $validated['good_count'] + $validated['scrap_count'],
        ]);

        return response()->json([
            'message' => 'Production count logged successfully.',
            'data' => $bucket,
        ], 201);
    }

    /**
     * Every work-order/shift production log across the whole plant — the "Log Production"
     * sidebar page's grid. One row per (work order, shift, day) submission group, not per
     * machine — a single "Log Production" submission can span several machines at once, and
     * the list is meant to read as "what got logged" not "which machine". `machine_count` is
     * `COUNT(DISTINCT machine_id)`; good/scrap/total are summed across every machine in that
     * group. Per-machine detail lives behind the row's info action —
     * `WorkOrderController::productionLogs()` scoped down via `shift_id`/`date`.
     *
     * Deliberately plain Eloquent (grouped aggregate query), NOT the `MachineProductionCounts`
     * OData entity: combining `$expand` with `$orderby`/`$count` on that entity silently drops
     * the expanded `machine`/`workOrder`/`shift` objects (confirmed Lodata bug on this entity
     * specifically — WorkOrders' own expand+orderby works fine, so it isn't a general library
     * limitation). The infinite-scroll grid always sends both, so OData isn't usable here.
     *
     * Search + the date-range/shift toolbar filters DO work here, same idiom as
     * `EmployeeAttendanceListComponent` on the frontend: the grid hand-builds a small,
     * fixed-shape OData-flavored `$filter` string (never arbitrary user-typed OData), and
     * `applyProductionLogFilter()` below regex-extracts just those known shapes rather than
     * parsing general OData — the search term, the shift ids, and the date range.
     */
    public function productionLogs(Request $request)
    {
        $top = max(1, min(200, (int) $request->query('$top', 40)));
        $skip = max(0, (int) $request->query('$skip', 0));

        $base = MachineProductionCount::query();
        $this->applyProductionLogFilter($base, (string) $request->query('$filter', ''));

        $logDate = FactoryClock::localDateSql('bucket_started_at');
        $groupBy = ['work_order_id', 'shift_id', DB::raw($logDate)];

        $total = (clone $base)
            ->select('work_order_id', 'shift_id')
            ->selectRaw("{$logDate} as log_date")
            ->groupBy($groupBy)
            ->get()
            ->count();

        $rows = (clone $base)
            ->select('work_order_id', 'shift_id')
            ->selectRaw("{$logDate} as log_date")
            ->selectRaw('COUNT(DISTINCT machine_id) as machine_count')
            ->selectRaw('SUM(good_count) as good_count')
            ->selectRaw('SUM(scrap_count) as scrap_count')
            ->selectRaw('SUM(total_count) as total_count')
            ->selectRaw('MAX(created_at) as logged_at')
            ->groupBy($groupBy)
            ->orderByDesc('log_date')
            ->orderByDesc('logged_at')
            ->skip($skip)
            ->take($top)
            ->with(['workOrder:id,custom_id', 'shift:id,name'])
            ->withCasts(['logged_at' => 'datetime'])
            ->get();

        return response()->json(['data' => $rows, 'total' => $total]);
    }

    /**
     * Recognizes exactly four fixed shapes the frontend generates into `$filter` — never a
     * general OData parser:
     *   - search (nav-path lambda, Work Order is a relation):
     *     `work_order/any(a:contains(tolower(a/custom_id), 'term'))`
     *   - date range (plain column): `bucket_started_at ge 'Y-m-d' and bucket_started_at le 'Y-m-d'`
     *   - shift multi-select (plain column, OR'd): `(shift_id eq 2 or shift_id eq 5)`
     *   - single machine (plain column): `machine_id eq 7` — the per-machine dashboard's log tab;
     *     groups then hold that machine's counts only, so `machine_count` is 1
     * All independent and optional; whichever are present get AND-ed onto the query.
     */
    private function applyProductionLogFilter($query, string $filter): void
    {
        if ($filter === '') {
            return;
        }

        if (preg_match("/work_order\/any\(a:contains\(tolower\(a\/custom_id\), *'([^']*)'\)\)/", $filter, $m)) {
            $search = $m[1];
            $query->whereHas('workOrder', fn ($q) => $q->where('custom_id', 'like', '%' . $search . '%'));
        }

        if (preg_match("/bucket_started_at ge '(\d{4}-\d{2}-\d{2})'/", $filter, $m)) {
            $query->where('bucket_started_at', '>=', FactoryClock::dayWindow($m[1])[0]);
        }

        if (preg_match("/bucket_started_at le '(\d{4}-\d{2}-\d{2})'/", $filter, $m)) {
            $query->where('bucket_started_at', '<', FactoryClock::dayWindow($m[1])[1]);
        }

        if (preg_match_all('/shift_id eq (\d+)/', $filter, $m) && $m[1]) {
            $query->whereIn('shift_id', $m[1]);
        }

        // Quoted literals are user search text — blank them so a search term can't pose as the scope.
        $unquoted = preg_replace("/'[^']*'/", "''", $filter);
        if (preg_match('/(?<![a-z_])machine_id eq (\d+)/', $unquoted, $m)) {
            $query->where('machine_id', (int) $m[1]);
        }
    }

    /**
     * Every logged wastage entry, system-wide — the "Wastage Log" page's grid. Unlike
     * `productionLogs()` above, this is a flat list (one row per real `machine_wastage_entries`
     * row), not a grouped aggregate — an entry already represents one submission (one work
     * order + wastage type + optional shift + date), so there's nothing to group. Eager-loads
     * `allocations.machine` so the grid's per-row info action can show the computed per-machine
     * split without a second request (contrast `productionLogs()`'s group-detail endpoint, which
     * exists only because that list's grouping loses the per-machine rows it's built from).
     */
    public function wastageLogs(Request $request)
    {
        $top = max(1, min(200, (int) $request->query('$top', 40)));
        $skip = max(0, (int) $request->query('$skip', 0));

        $base = MachineWastageEntry::query();
        $this->applyWastageLogFilter($base, (string) $request->query('$filter', ''));

        $groupBy = ['work_order_id', 'shift_id', 'entry_date'];

        $total = (clone $base)
            ->select('work_order_id', 'shift_id', 'entry_date')
            ->groupBy($groupBy)
            ->get()
            ->count();

        $rows = (clone $base)
            ->select('work_order_id', 'shift_id', 'entry_date')
            ->selectRaw('SUM(qty_kg) as qty_kg')
            ->selectRaw('COUNT(DISTINCT wastage_type_id) as wastage_type_count')
            ->selectRaw('MAX(created_at) as logged_at')
            ->selectRaw('(
                SELECT COUNT(DISTINCT mwa.machine_id)
                FROM machine_wastage_allocations mwa
                JOIN machine_wastage_entries mwe ON mwa.wastage_entry_id = mwe.id
                WHERE mwe.work_order_id = machine_wastage_entries.work_order_id
                  AND (mwe.shift_id = machine_wastage_entries.shift_id OR (mwe.shift_id IS NULL AND machine_wastage_entries.shift_id IS NULL))
                  AND mwe.entry_date = machine_wastage_entries.entry_date
            ) as machine_count')
            ->groupBy($groupBy)
            ->orderByDesc('entry_date')
            ->orderByDesc('logged_at')
            ->skip($skip)
            ->take($top)
            ->with(['workOrder:id,custom_id', 'shift:id,name'])
            ->withCasts(['logged_at' => 'datetime'])
            ->get();

        return response()->json(['data' => $rows, 'total' => $total]);
    }

    private function applyWastageLogFilter($query, string $filter): void
    {
        if ($filter === '') {
            return;
        }

        if (preg_match("/work_order\/any\(a:contains\(tolower\(a\/custom_id\), *'([^']*)'\)\)/", $filter, $m)) {
            $search = $m[1];
            $query->whereHas('workOrder', fn ($q) => $q->where('custom_id', 'like', '%' . $search . '%'));
        }

        if (preg_match("/entry_date ge '([0-9-]+)'/", $filter, $m)) {
            $query->whereDate('entry_date', '>=', $m[1]);
        }

        if (preg_match("/entry_date le '([0-9-]+)'/", $filter, $m)) {
            $query->whereDate('entry_date', '<=', $m[1]);
        }

        if (preg_match_all('/shift_id eq (\d+)/', $filter, $m) && $m[1]) {
            $query->whereIn('shift_id', $m[1]);
        }
    }

    public function wastageLogDetail(Request $request)
    {
        $workOrderId = $request->query('work_order_id');
        $shiftId = $request->query('shift_id');
        $date = $request->query('date');

        if (!$workOrderId) {
            return response()->json(['data' => []]);
        }

        $query = MachineWastageEntry::with([
            'wastageType:id,name',
            'allocations.machine:id,machine_name',
        ])->where('work_order_id', $workOrderId);

        if ($shiftId) {
            $query->where('shift_id', $shiftId);
        } else {
            $query->whereNull('shift_id');
        }

        if ($date) {
            $query->whereDate('entry_date', $date);
        }

        $entries = $query->get();

        $rows = [];
        foreach ($entries as $entry) {
            foreach ($entry->allocations as $alloc) {
                $rows[] = [
                    'id' => $alloc->id,
                    'machine' => $alloc->machine ? ['id' => $alloc->machine->id, 'machine_name' => $alloc->machine->machine_name] : null,
                    'wastage_type' => $entry->wastageType ? ['id' => $entry->wastageType->id, 'name' => $entry->wastageType->name] : null,
                    'allocated_qty_kg' => (float) $alloc->allocated_qty_kg,
                ];
            }
        }

        return response()->json(['data' => $rows]);
    }

    /**
     * This machine's currently tagged states with their `is_default` flag — used by
     * `machine-form`'s edit-load path to pre-select the current default in the States
     * tab. Not exposed via the `Machines?$expand=states` OData path since Lodata doesn't
     * surface `belongsToMany` pivot columns through a plain expand.
     */
    /**
     * Lightweight id+name list for machine-picker dropdowns (REST counterpart of the
     * `Machines?$select=id,machine_name` OData call used elsewhere in the app).
     */
    public function machineOptions()
    {
        return response()->json([
            'data' => Machine::select('id', 'machine_name')->get(),
        ]);
    }

    public function machineStates($id)
    {
        $machine = Machine::findOrFail($id);

        return response()->json([
            'states' => $machine->states()->get()->map(fn ($state) => [
                'id' => $state->id,
                'is_default' => (bool) $state->pivot->is_default,
            ]),
        ]);
    }

    public function machineAssociate(Request $request)
    {
        try {
            $machine = Machine::findOrFail($request->machine_id);

            if (!$request->has('machinegroup') || !is_array($request->machinegroup)) {
                return response()->json(['error' => 'Invalid group data'], 400);
            }

            $stateIds = collect($request->machinestate)->pluck('id')->toArray();
            $groupIds = collect($request->machinegroup)->pluck('id')->toArray();
            $hallIds = collect($request->machinehall)->pluck('id')->toArray();
            $wastageTypeIds = collect($request->machinewastagetype)->pluck('id')->toArray();

            // This machine's fallback state when no configured channel reads HIGH
            // (`ChannelMappingService.deriveStatus`'s replacement for the old hardcoded
            // `else -> INACTIVE`). Optional — falls through to no default until an admin
            // picks one. Must be one of the states actually being tagged in this request.
            $defaultStateId = $request->input('default_state_id');
            if ($defaultStateId !== null && !in_array($defaultStateId, $stateIds, true)) {
                return response()->json(['error' => 'default_state_id must be one of the assigned states'], 422);
            }

            $stateSync = collect($stateIds)->mapWithKeys(fn ($stateId) => [
                $stateId => ['is_default' => $defaultStateId !== null && (int) $stateId === (int) $defaultStateId],
            ])->all();

            $machine->states()->sync($stateSync);
            $machine->machinegroups()->sync($groupIds);
            $machine->machinehalls()->sync($hallIds);
            $machine->machinewastagetypes()->sync($wastageTypeIds);

            return response()->json([
                'message' => 'State assigned successfully',
                'machine' => $machine
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Machine not found', 'details' => $e->getMessage()], 404);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Something went wrong', 'details' => $e->getMessage()], 500);
        }
    }
}
