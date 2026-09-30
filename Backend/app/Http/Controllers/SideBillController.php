<?php

namespace App\Http\Controllers;

use App\Models\MachineGroup;
use App\Models\SideBill;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class SideBillController extends Controller
{
    private array $rules = [
        'is_active'                  => 'boolean',
        'employee_id'                => 'required|exists:employees,id',
        'machine_group_id'           => 'required|exists:machine_groups,id',
        'amount'                     => 'required|numeric|min:0',
        'side_bill_date'             => 'nullable|date',
        'current_working_machine_id' => 'nullable|exists:machines,id',
        'side_working_machine_id'    => 'nullable|exists:machines,id',
        'side'                       => 'nullable|in:LEFT,RIGHT',
        'shift_id'                   => 'nullable|exists:employee_shifts,id',
        'note'                       => 'nullable|string',
        'status'                     => 'nullable|string',
    ];

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules);

        $group = MachineGroup::findOrFail($data['machine_group_id']);
        $this->applyGroupValidation($group, $data);

        $sideBill = SideBill::create($data);

        return response()->json($sideBill->load(['employee', 'machineGroup']), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $sideBill = SideBill::findOrFail($id);

        $data = $request->validate($this->rules);

        $group = MachineGroup::findOrFail($data['machine_group_id']);
        $this->applyGroupValidation($group, $data);

        $sideBill->update($data);

        return response()->json($sideBill->load(['employee', 'machineGroup']));
    }

    private function applyGroupValidation(MachineGroup $group, array $data): void
    {
        $hasSideMachine = !empty($data['side_working_machine_id']);

        if ($group->is_ring) {
            if (empty($data['side'])) {
                throw ValidationException::withMessages([
                    'side' => 'Side (LEFT or RIGHT) is required for ring machine groups.',
                ]);
            }

            $maxAmount = $hasSideMachine ? 600 : 1200;
            if ((float) ($data['amount'] ?? 0) > $maxAmount) {
                $label = $hasSideMachine ? 'side (max 600 spindles)' : 'main (max 1200 spindles)';
                throw ValidationException::withMessages([
                    'amount' => "Amount exceeds limit for ring machine group {$label}.",
                ]);
            }
        }

        if ($group->is_autocon) {
            // No side machine: 60 derm for 2 persons. With side machine: 30 (person) + 10 (machine) = 40.
            $maxAmount = $hasSideMachine ? 40 : 60;
            if ((float) ($data['amount'] ?? 0) > $maxAmount) {
                $label = $hasSideMachine ? 'side (30 derm person + 10 derm machine = 40 max)' : 'main (60 derm for 2 persons)';
                throw ValidationException::withMessages([
                    'amount' => "Amount exceeds limit for autocon machine group {$label}.",
                ]);
            }
        }
    }
}
