<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use App\Http\Controllers\ActivityLogController;

class RolePermissionController extends Controller
{
    public function sync_permission(Request $request)
    {
        try {
            $roleId = $request->get('id');

            $permissions = collect($request->get('syncPermissions'))->pluck('id')->toArray();
            if ($roleId) {
                $previousRole = Role::with('permissions')->findOrFail($roleId);
            }
            if (!$roleId) {
                return response()->json(['error' => 'Role ID  are required'], 400);
            }
            if (empty($permissions)) {
                $role = Role::findOrFail($roleId);
                $role->syncPermissions([]);
                return response()->json([
                    'message' => 'All permissions have been removed from the role',
                    'permissions' => []
                ]);
            }

            if (!$roleId || !$permissions) {
                return response()->json(['error' => 'Role ID and Permissions are required'], 400);
            }
            if (!is_array($permissions)) {
                return response()->json(['error' => 'Permissions must be an array'], 400);
            }

            $permissions = Permission::whereIn('id', $permissions)->get();
            if ($permissions->isEmpty()) {
                return response()->json(['error' => 'No valid permissions found'], 404);
            }
            $role = Role::findOrFail($roleId);
            $role->syncPermissions($permissions);
            $role->load('permissions');

            $model = "Role";
            $modelId = $role->id;
            $modelCustomId = $role->custom_id;
            $ipAddress = $request->ip();
            $actionType = "update";
            $oldValue = json_encode([
                'id' => $previousRole->id,
                'name' => $previousRole->name,
                'custom_id' => $previousRole->custom_id,
                'permissions' => $previousRole->permissions->pluck('name', 'id')->toArray()
            ]);

            $newValue = json_encode([
                'id' => $role->id,
                'name' => $role->name,
                'custom_id' => $role->custom_id,
                'permissions' => $role->permissions->pluck('name', 'id')->toArray()
            ]);

            ActivityLogController::createCustomLog($model, $modelId, $modelCustomId, $ipAddress, $actionType, $oldValue, $newValue);

            return response()->json([
                'message' => 'Permissions synced successfully',
                'role_name' => $role->name,
            ]);
        } catch (\Exception $e) {
            Log::error('Error syncing permissions: ' . $e->getMessage());
            return response()->json([
                'error' => 'An error occurred while syncing permissions',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function allGrouped(): \Illuminate\Http\JsonResponse
    {
        $groupPrefixes = [
            'BASE_DATA'          => ['BASE_DATA'],
            'PRODUCTION'         => ['PRODUCTION'],
            'HR'                 => ['HR'],
            'QUALITY'            => ['QUALITY'],
            'STORE'              => ['STORE'],
            'TASK'               => ['TASK'],
            'PURCHESE'           => ['PURCHESE'],
            'SALES_AND_MARKETING'=> ['SALES', 'MARKETING'],
            'NOTIFICATION'       => ['NOTIFICATION'],
        ];

        $permissions = Permission::orderBy('name')->get(['id', 'name']);

        $grouped = $permissions->groupBy(function ($p) use ($groupPrefixes) {
            if (str_ends_with($p->name, '_NOTIFICATION') || $p->name === 'NOTIFICATION_VIEW') {
                return 'NOTIFICATION';
            }
            foreach ($groupPrefixes as $group => $prefixes) {
                foreach ($prefixes as $prefix) {
                    if (str_starts_with($p->name, $prefix)) return $group;
                }
            }
            return 'OTHER';
        });

        $order = array_keys($groupPrefixes);
        $data = collect($order)->map(fn($group) => [
            'group' => $group,
            'permissions' => $grouped->get($group, collect())->values(),
        ])->filter(fn($g) => $g['permissions']->isNotEmpty())->values();

        $other = $grouped->get('OTHER', collect());
        if ($other->isNotEmpty()) {
            $data->push(['group' => 'OTHER', 'permissions' => $other->values()]);
        }

        return response()->json(['data' => $data]);
    }

    public function remove_permission(Request $request)
    {
        try {
            $roleId = $request->get('role_id');
            if ($roleId) {
                $previousRole = Role::with('permissions')->findOrFail($roleId);
            }
            $permissionId = $request->get('permission_id');
            $permission = Permission::findOrFail($permissionId);
            $role = Role::findOrFail($roleId);
            $role->revokePermissionTo($permission);
            $role->load('permissions');

            $model = "Role";
            $modelId = $role->id;
            $modelCustomId = $role->custom_id;
            $ipAddress = $request->ip();
            $actionType = "update";
            $oldValue = json_encode([
                'id' => $previousRole->id,
                'name' => $previousRole->name,
                'custom_id' => $previousRole->custom_id,
                'permissions' => $previousRole->permissions->pluck('name', 'id')->toArray()
            ]);

            $newValue = json_encode([
                'id' => $role->id,
                'name' => $role->name,
                'custom_id' => $role->custom_id,
                'permissions' => $role->permissions->pluck('name', 'id')->toArray()
            ]);

            ActivityLogController::createCustomLog($model, $modelId, $modelCustomId, $ipAddress, $actionType, $oldValue, $newValue);
            return response()->json([
                'message' => 'Permission removed successfully',
            ]);
        } catch (\Exception $e) {
            Log::error('Error removing permission: ' . $e->getMessage());
            return response()->json([
                'error' => 'An error occurred while removing permission',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
