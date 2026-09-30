<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EmployeeController extends Controller
{
    public function employeeAssociate(Request $request)
    {
        try {
            $employee = Employee::findOrFail($request->employee_id);

            if (!$request->has('assets') || !is_array($request->assets)) {
                return response()->json(['error' => 'Invalid assets data'], 400);
            }

            $assetsIds = collect($request->assets)->pluck('id')->toArray();
            $employee->assets()->sync($assetsIds);

            return response()->json([
                'message' => 'Associations assigned successfully',
                'product' => $employee
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['error' => 'employee not found'], 404);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Something went wrong', 'details' => $e->getMessage()], 500);
        }
    }

    public function syncEmployeeGroup(Request $request)
    {
        $request->validate([
            'group_id' => 'required',
            'employee_ids' => 'required|array',
            'employee_ids.*' => 'exists:employees,id',
        ]);

        $groupId = $request->group_id;
        $employeeIds = $request->employee_ids ?? [];

        $currentEmployeeIds = Employee::where('group_id', $groupId)
            ->pluck('id')
            ->toArray();

        $toAdd = array_diff($employeeIds, $currentEmployeeIds);

        if (!empty($toAdd)) {
            Employee::whereIn('id', $toAdd)
                ->update([
                    'group_id' => $groupId,
                    'is_shift_fixed' => false,
                ]);
        }

        return response()->json([
            'message' => 'Employees synced successfully with the group.'
        ]);
    }

    public function bulkStatusUpdate(Request $request)
    {
        $request->validate([
            'employee_ids' => 'required|array|min:1',
            'employee_ids.*' => 'exists:employees,id',
            'is_active' => 'required|boolean',
        ]);

        $employeeIds = $request->employee_ids;
        $isActive = $request->boolean('is_active');

        DB::transaction(function () use ($employeeIds, $isActive) {
            $employees = Employee::with('user')
                ->whereIn('id', $employeeIds)
                ->get();

            foreach ($employees as $employee) {
                $employee->is_active = $isActive;
                $employee->save();

                if (!$isActive && $employee->user) {
                    $employee->user->remember_token = null;
                    $employee->user->save();
                }
            }
        });

        return response()->json([
            'message' => $isActive
                ? 'Selected employees activated successfully.'
                : 'Selected employees inactivated successfully.',
            'updated_count' => count($employeeIds),
        ]);
    }
}
