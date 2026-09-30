<?php

namespace App\Http\Controllers;

use App\Models\ApprovalType;
use Illuminate\Http\Request;

class ApprovalTypeController extends Controller
{
    public function approvers(ApprovalType $approvalType)
    {
        $employees = $approvalType->employees()
            ->select('employees.id', 'employees.employee_no', 'employees.first_name', 'employees.last_name', 'employees.designation_id', 'employees.user_id')
            ->with(['designation:id,name', 'media'])
            ->get();

        return response()->json(['data' => $employees]);
    }

    public function associate(Request $request)
    {
        $validated = $request->validate([
            'approval_type_id' => 'required|exists:approval_types,id',
            'employees' => 'array',
            'employees.*.employee_id' => 'required|exists:employees,id',
            'employees.*.is_required' => 'boolean',
            'employees.*.sequence_index' => 'integer|min:1',
        ]);

        $approvalType = ApprovalType::findOrFail($validated['approval_type_id']);

        $syncData = collect($validated['employees'] ?? [])->mapWithKeys(fn ($row) => [
            $row['employee_id'] => [
                'is_required' => $row['is_required'] ?? true,
                'sequence_index' => $row['sequence_index'] ?? 1,
            ],
        ])->all();

        $approvalType->employees()->sync($syncData);

        return response()->json(['message' => 'Approvers updated successfully']);
    }
}
