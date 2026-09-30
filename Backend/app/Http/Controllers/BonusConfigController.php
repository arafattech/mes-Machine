<?php

namespace App\Http\Controllers;

use App\Models\BonusConfig;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class BonusConfigController extends Controller
{
    public function store(Request $request)
    {
        $payload = $this->validatedPayload($request);
        $this->ensureUniqueConfig($payload);

        $bonusConfig = BonusConfig::create($payload);

        return response()->json([
            'message' => 'Bonus config saved successfully.',
            'data' => $bonusConfig->load('bonusType'),
        ], 201);
    }

    public function update(Request $request, BonusConfig $bonusConfig)
    {
        $payload = $this->validatedPayload($request);
        $this->ensureUniqueConfig($payload, $bonusConfig->id);

        $bonusConfig->update($payload);

        return response()->json([
            'message' => 'Bonus config updated successfully.',
            'data' => $bonusConfig->fresh('bonusType'),
        ]);
    }

    private function validatedPayload(Request $request): array
    {
        $payload = $request->validate([
            'is_active' => ['sometimes', 'boolean'],
            'name' => ['required', 'string', 'max:255'],
            'bonus_type_id' => ['required', 'integer', 'exists:bonus_types,id'],
            'calculation_type' => ['required', Rule::in(['FIXED', 'PER_HOUR'])],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'applicable_to' => ['required', Rule::in(['DEPARTMENT', 'EMPLOYEE'])],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'employee_id' => ['nullable', 'integer', 'exists:employees,id'],
        ]);

        $payload['is_active'] = $payload['is_active'] ?? true;
        $payload['amount'] = $payload['amount'] ?? 0;
        $payload['group_id'] = null;

        if ($payload['applicable_to'] === 'DEPARTMENT') {
            if (empty($payload['department_id'])) {
                throw ValidationException::withMessages([
                    'department_id' => 'Department is required.',
                ]);
            }

            $payload['employee_id'] = null;
        }

        if ($payload['applicable_to'] === 'EMPLOYEE') {
            if (empty($payload['employee_id'])) {
                throw ValidationException::withMessages([
                    'employee_id' => 'Employee is required.',
                ]);
            }

            $payload['department_id'] = null;
        }

        return $payload;
    }

    private function ensureUniqueConfig(array $payload, ?int $ignoreId = null): void
    {
        $query = BonusConfig::where('bonus_type_id', $payload['bonus_type_id'])
            ->whereRaw('UPPER(applicable_to) = ?', [$payload['applicable_to']]);

        if ($ignoreId) {
            $query->where('id', '!=', $ignoreId);
        }

        if ($payload['applicable_to'] === 'DEPARTMENT') {
            $query->where('department_id', $payload['department_id']);
            $message = 'This bonus type already has a config for the selected department.';
        } else {
            $query->where('employee_id', $payload['employee_id']);
            $message = 'This bonus type already has a config for the selected employee.';
        }

        if ($query->exists()) {
            throw ValidationException::withMessages([
                'bonus_type_id' => $message,
            ]);
        }
    }
}
