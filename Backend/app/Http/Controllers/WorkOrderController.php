<?php

namespace App\Http\Controllers;

use App\Models\EmployeeShift;
use App\Models\MachineProductionCount;
use App\Models\MachineWastageAllocation;
use App\Models\MachineWastageEntry;
use App\Models\WorkOrder;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WorkOrderController extends Controller
{
    /**
     * Custom REST create/update (not OData) because assigning a work order to several
     * machines is a pivot sync, not a scalar field — mirrors `MachineConfigController`'s
     * validate → transaction → sync-related-collection shape.
     */
    public function store(Request $request)
    {
        $validated = $this->validatePayload($request);
        $machineIds = $validated['machine_ids'] ?? [];
        unset($validated['machine_ids']);

        $workOrder = WorkOrder::create($validated);
        $workOrder->machines()->sync($machineIds);

        return response()->json([
            'message' => 'Work order created successfully.',
            'data' => $workOrder->load(['product', 'machines']),
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $workOrder = WorkOrder::findOrFail($id);
        $validated = $this->validatePayload($request);
        $machineIds = $validated['machine_ids'] ?? [];
        unset($validated['machine_ids']);

        $workOrder->update($validated);
        $workOrder->machines()->sync($machineIds);

        return response()->json([
            'message' => 'Work order updated successfully.',
            'data' => $workOrder->fresh(['product', 'machines']),
        ]);
    }

    private function validatePayload(Request $request): array
    {
        return $request->validate([
            'is_active' => ['sometimes', 'boolean'],
            'custom_id' => ['nullable', 'string', 'max:255'],
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'status' => ['nullable', 'string', 'in:pending,in_progress,completed,cancelled'],
            'scheduled_start' => ['nullable', 'date'],
            'actual_start' => ['nullable', 'date'],
            'machine_ids' => ['nullable', 'array'],
            'machine_ids.*' => ['integer', 'exists:machines,id'],
        ]);
    }

    /**
     * Batch manual production-count entry for one work order across every machine planned
     * against it (the "Plan & Production Log" sidebar page) — distinct from
     * `MachineController::logProductionCount`'s single-machine, no-date, "continue from last
     * bucket to now" flow used on `/mco`. Here the caller explicitly picks a date and shift,
     * so the bucket spans that shift's own start/end time on that date instead of "now".
     * Always additive (one new row per submission, never an upsert) to match the existing
     * per-machine flow's audit-trail semantics.
     */
    public function logProductionCounts(Request $request, $id)
    {
        $workOrder = WorkOrder::findOrFail($id);

        $validated = $request->validate([
            'date' => ['required', 'date'],
            'shift_id' => ['required', 'integer', 'exists:employee_shifts,id'],
            'entries' => ['required', 'array', 'min:1'],
            'entries.*.machine_id' => ['required', 'integer', 'exists:machines,id'],
            'entries.*.good_count' => ['required', 'integer', 'min:0'],
        ]);

        $assignedMachineIds = $workOrder->machines()->pluck('machines.id')->all();
        $invalidMachineIds = collect($validated['entries'])->pluck('machine_id')->diff($assignedMachineIds);
        if ($invalidMachineIds->isNotEmpty()) {
            return response()->json([
                'message' => 'One or more machines are not assigned to this work order.',
            ], 422);
        }

        $shift = EmployeeShift::findOrFail($validated['shift_id']);
        [$bucketStartedAt, $bucketEndedAt] = $this->resolveShiftWindow($validated['date'], $shift);

        $created = DB::transaction(fn () => collect($validated['entries'])->map(fn ($entry) =>
            MachineProductionCount::create([
                'machine_id' => $entry['machine_id'],
                'work_order_id' => $workOrder->id,
                'shift_id' => $validated['shift_id'],
                'bucket_started_at' => $bucketStartedAt,
                'bucket_ended_at' => $bucketEndedAt,
                'good_count' => $entry['good_count'],
                'scrap_count' => 0,
                'total_count' => $entry['good_count'],
            ])
        ));

        return response()->json([
            'message' => 'Production counts logged successfully.',
            'data' => $created,
        ], 201);
    }

    /**
     * Logs a total wastage quantity (kg) for one wastage type against a work order,
     * optionally scoped to a shift/date, then distributes it across every machine
     * assigned to the work order that has this wastage type configured
     * (`Machine::machinewastagetypes`), proportional to each eligible machine's
     * share of `machine_production_counts.total_count` in that same scope. Falls
     * back to an equal split when no production has been logged yet for the scope
     * (there's no output data to weight by). Always additive — matches
     * `logProductionCounts`' audit-trail semantics, no upsert.
     */
    public function logWastage(Request $request, $id)
    {
        $workOrder = WorkOrder::findOrFail($id);

        $validated = $request->validate([
            'wastage_type_id' => ['required_without:entries', 'integer', 'exists:machine_wastage_types,id'],
            'shift_id' => ['nullable', 'integer', 'exists:employee_shifts,id'],
            'date' => ['required', 'date'],
            'qty_kg' => ['required_without:entries', 'numeric', 'min:0.01'],
            'entries' => ['nullable', 'array', 'min:1'],
            'entries.*.wastage_type_id' => ['required_with:entries', 'integer', 'exists:machine_wastage_types,id'],
            'entries.*.qty_kg' => ['required_with:entries', 'numeric', 'min:0.01'],
        ]);

        $items = isset($validated['entries']) ? $validated['entries'] : [
            ['wastage_type_id' => $validated['wastage_type_id'], 'qty_kg' => $validated['qty_kg']]
        ];

        $results = DB::transaction(function () use ($workOrder, $validated, $items) {
            $createdEntries = [];
            foreach ($items as $item) {
                $wastageTypeId = (int) $item['wastage_type_id'];
                $qtyKg = (float) $item['qty_kg'];

                $eligibleMachineIds = $workOrder->machines()
                    ->whereHas('machinewastagetypes', fn ($q) => $q->where('machine_wastage_types.id', $wastageTypeId))
                    ->pluck('machines.id');

                if ($eligibleMachineIds->isEmpty()) {
                    continue;
                }

                $shares = $this->resolveWastageShares($workOrder->id, $eligibleMachineIds, $validated['date'], $validated['shift_id'] ?? null);

                $entry = MachineWastageEntry::create([
                    'work_order_id' => $workOrder->id,
                    'wastage_type_id' => $wastageTypeId,
                    'shift_id' => $validated['shift_id'] ?? null,
                    'entry_date' => $validated['date'],
                    'qty_kg' => $qtyKg,
                    'created_by' => auth()->id(),
                ]);

                $allocations = $this->createAllocations($entry, $eligibleMachineIds, $shares, $qtyKg);
                $createdEntries[] = $entry->setRelation('allocations', $allocations);
            }
            return $createdEntries;
        });

        if (empty($results)) {
            return response()->json([
                'message' => 'No machine on this work order has the selected wastage type(s) assigned.',
            ], 422);
        }

        return response()->json([
            'message' => 'Wastage logged successfully.',
            'data' => count($results) === 1 ? $results[0] : $results,
        ], 201);
    }

    /**
     * Every wastage type shared by at least one machine currently assigned to
     * this work order — feeds the "Log Wastage" dialog's type picker so an
     * operator can't pick a type nothing on this WO can actually absorb.
     */
    public function eligibleWastageTypes($id)
    {
        $workOrder = WorkOrder::findOrFail($id);

        $types = $workOrder->machines()
            ->with('machinewastagetypes')
            ->get()
            ->pluck('machinewastagetypes')
            ->flatten()
            ->unique('id')
            ->values();

        return response()->json(['data' => $types]);
    }

    /**
     * Each eligible machine's share of `total_count` within the entry's own
     * scope (work order + date, optionally narrowed to a shift). Equal split
     * (share = null, i.e. "not weighted") when nothing has been produced in
     * that scope yet — there's no output to weight by.
     */
    private function resolveWastageShares($workOrderId, $eligibleMachineIds, string $date, ?int $shiftId): array
    {
        $sums = MachineProductionCount::whereIn('machine_id', $eligibleMachineIds)
            ->where('work_order_id', $workOrderId)
            ->whereDate('bucket_started_at', $date)
            ->when($shiftId, fn ($q) => $q->where('shift_id', $shiftId))
            ->selectRaw('machine_id, SUM(total_count) as total')
            ->groupBy('machine_id')
            ->pluck('total', 'machine_id');

        $grandTotal = $sums->sum();
        if ($grandTotal <= 0) {
            $equalShare = 1 / $eligibleMachineIds->count();

            return $eligibleMachineIds->mapWithKeys(fn ($machineId) => [$machineId => null])->all()
                + ['__equal_share__' => $equalShare];
        }

        return $eligibleMachineIds->mapWithKeys(fn ($machineId) => [
            $machineId => ((float) ($sums[$machineId] ?? 0)) / $grandTotal,
        ])->all();
    }

    /**
     * Turns resolved shares into `machine_wastage_allocations` rows whose
     * `allocated_qty_kg` sum EXACTLY equals `$qtyKg` — every machine but the
     * last is rounded normally, the last absorbs the rounding remainder so
     * the total never silently drifts from what was actually entered.
     */
    private function createAllocations(MachineWastageEntry $entry, $eligibleMachineIds, array $shares, float $qtyKg)
    {
        $isEqualSplit = array_key_exists('__equal_share__', $shares);
        $equalShare = $shares['__equal_share__'] ?? null;

        $machineIds = $eligibleMachineIds->values();
        $running = 0.0;
        $rows = [];

        foreach ($machineIds as $index => $machineId) {
            $isLast = $index === $machineIds->count() - 1;
            $share = $isEqualSplit ? $equalShare : $shares[$machineId];

            $allocated = $isLast ? round($qtyKg - $running, 2) : round($qtyKg * $share, 2);
            $running += $allocated;

            $rows[] = MachineWastageAllocation::create([
                'wastage_entry_id' => $entry->id,
                'machine_id' => $machineId,
                'allocated_qty_kg' => $allocated,
                'production_share' => $isEqualSplit ? null : $share,
            ]);
        }

        return collect($rows);
    }

    /**
     * Every individual production log for one work order — the entry modal's History tab
     * when called with no extra filters. Also doubles as the per-machine drill-down behind
     * the "Log Production" list grid's info action: that grid groups by (work order, shift,
     * day) and shows a machine count instead of a machine per row (`MachineController::
     * productionLogs()`), so its info icon calls back here with `shift_id`/`date` to reveal
     * exactly the machines/counts that made up one group.
     * Same Lodata-expand-bug workaround as `MachineController::productionLogs()` (see that
     * method's doc comment); scoped here by `work_order_id` instead of listing everything.
     */
    public function productionLogs(Request $request, $id)
    {
        $top = max(1, min(200, (int) $request->query('$top', 40)));
        $skip = max(0, (int) $request->query('$skip', 0));

        $query = MachineProductionCount::with(['machine:id,machine_name', 'shift:id,name'])
            ->where('work_order_id', $id);

        if ($request->filled('shift_id')) {
            $query->where('shift_id', $request->query('shift_id'));
        }
        if ($request->filled('date')) {
            $query->whereDate('bucket_started_at', $request->query('date'));
        }

        $query->orderByDesc('bucket_started_at')->orderByDesc('id');

        $total = (clone $query)->count();
        $rows = $query->skip($skip)->take($top)->get();

        return response()->json(['data' => $rows, 'total' => $total]);
    }

    private function resolveShiftWindow(string $date, EmployeeShift $shift): array
    {
        $start = Carbon::parse($date)->setTimeFrom(Carbon::parse($shift->start_time));
        $end = Carbon::parse($date)->setTimeFrom(Carbon::parse($shift->end_time));
        if ($end->lessThanOrEqualTo($start)) {
            $end->addDay();
        }

        return [$start, $end];
    }
}
