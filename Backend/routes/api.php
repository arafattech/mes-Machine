<?php

use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\ApprovalTypeController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\RolePermissionController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\MachineController;
use App\Http\Controllers\MachineConfigController;
use App\Http\Controllers\MachineMaintenanceController;
use App\Http\Controllers\WorkOrderController;
use App\Http\Controllers\ProductionLotBatchController;
use App\Http\Controllers\ProductionLotCountController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\HallController;
use App\Http\Controllers\MediaController;
use App\Http\Controllers\EmployeeImportController;
use App\Http\Controllers\EmployeeExportController;
use App\Http\Controllers\ClientExportController;
use App\Http\Controllers\SupplierExportController;
use App\Http\Controllers\ClientImportController;
use App\Http\Controllers\EmployeePayrollController;
use App\Http\Controllers\SupplierImportController;
use App\Http\Controllers\ProductBarcodeController;
use App\Http\Controllers\idGeneratorController;
use App\Http\Controllers\NotificationClear;
use App\Http\Controllers\NotificationController;

Route::post('login', [AuthController::class, 'login']);
Route::middleware(['auth:sanctum'])->group(function () {
    // ==================== authentication ===============================
    Route::get('auth', [AuthController::class, 'auth']);
    Route::post('logout', [AuthController::class, 'logout']);

    // ==================== Roles permission management================-
    Route::get('permissions/grouped', [RolePermissionController::class, 'allGrouped']);
    Route::post('permissions', [RolePermissionController::class, 'sync_permission']);
    Route::delete('remove/permissions', [RolePermissionController::class, 'remove_permission']);

    // ============== User management =================
    Route::post('add/user', [UserController::class, 'add_user']);
    Route::put('edit/user/{id}', [UserController::class, 'edit_user']);
    Route::get('users', [UserController::class, 'user_list']);
    Route::get('users/trashed', [UserController::class, 'trashed_list']);
    Route::post('users/{id}/restore', [UserController::class, 'restore_user']);
    Route::post('/user/change-password', [UserController::class, 'change_password']);

    // ============== Notifications =================
    Route::post('/activity-logs/read', [NotificationClear::class, 'markAllAsRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::delete('/notifications/clear-all', [NotificationController::class, 'clearAll']);
    Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);

    // =============== Product management =========================
    Route::post('product/associate', [ProductController::class, 'productAssociate']);

    // =============== employee management =========================
    Route::post('employee/associate', [EmployeeController::class, 'employeeAssociate']);
    Route::post('employee/group-associate', [EmployeeController::class, 'syncEmployeeGroup']);
    Route::put('employee/bulk-status-update', [EmployeeController::class, 'bulkStatusUpdate']);

    // =============== Approval type management =========================
    Route::get('approval-types/{approvalType}/approvers', [ApprovalTypeController::class, 'approvers']);
    Route::post('approval-type/employee-associate', [ApprovalTypeController::class, 'associate']);

    // =============== Machine management =========================
    Route::get('machines', [MachineController::class, 'machineOptions']);
    Route::post('machine/associate', [MachineController::class, 'machineAssociate']);
    Route::get('machine/{id}/states', [MachineController::class, 'machineStates']);
    Route::post('machine/configs', [MachineConfigController::class, 'store']);
    Route::put('machine/configs/{id}', [MachineConfigController::class, 'update']);
    // Manual maintenance scheduling — schedules table is the Laravel-side writer;
    // node-server forces MAINTENANCE from the Redis override set. Activation is
    // manual-only ("Activate now"); nothing auto-activates a schedule by date.
    Route::get('machine/maintenance', [MachineMaintenanceController::class, 'index']);
    Route::post('machine/maintenance', [MachineMaintenanceController::class, 'store']);
    Route::put('machine/maintenance/{id}', [MachineMaintenanceController::class, 'update']);
    Route::delete('machine/maintenance/{id}', [MachineMaintenanceController::class, 'destroy']);
    Route::post('machine/maintenance/{id}/activate', [MachineMaintenanceController::class, 'activate']);
    Route::post('machine/{machineId}/maintenance/end', [MachineMaintenanceController::class, 'end']);
    Route::apiResource('maintenance-schedules', App\Http\Controllers\MaintenanceScheduleController::class);
    // Machine overview/OEE, current-work-order, and the work-order execution rollup are
    // now served by node-server (NestJS/Prisma) — it already owns the write-side of
    // machine_state_events/machine_production_counts. See node-server/src/module/machine/
    // calculations.module.ts. CRUD stays here.
    Route::get('machine/{id}/work-orders', [MachineController::class, 'assignedWorkOrders']);
    Route::post('machine/{id}/production-count', [MachineController::class, 'logProductionCount']);
    Route::get('production-logs', [MachineController::class, 'productionLogs']);
    Route::get('wastage-logs', [MachineController::class, 'wastageLogs']);
    Route::get('wastage-logs-detail', [MachineController::class, 'wastageLogDetail']);
    Route::post('work-orders', [WorkOrderController::class, 'store']);
    Route::put('work-orders/{id}', [WorkOrderController::class, 'update']);
    Route::post('work-orders/{id}/production-counts', [WorkOrderController::class, 'logProductionCounts']);
    Route::get('work-orders/{id}/production-logs', [WorkOrderController::class, 'productionLogs']);
    Route::post('work-orders/{id}/wastages', [WorkOrderController::class, 'logWastage']);
    Route::get('work-orders/{id}/eligible-wastage-types', [WorkOrderController::class, 'eligibleWastageTypes']);

    //  ============== Production Lot Batch (yarn submission to store) ==============
    Route::post('production/lot-batches', [ProductionLotBatchController::class, 'store']);
    Route::put('production/lot-batches/{lotBatch}', [ProductionLotBatchController::class, 'update']);
    Route::post('production/lot-batches/{lotBatch}/counts', [ProductionLotBatchController::class, 'addCount']);
    Route::put('production/lot-batches/{lotBatch}/counts/{count}', [ProductionLotCountController::class, 'update']);
    Route::post('production/lot-batches/{lotBatch}/counts/{count}/qc', [ProductionLotCountController::class, 'recordQc']);
    Route::post('production/lot-batches/{lotBatch}/counts/{count}/items', [ProductionLotCountController::class, 'addItem']);
    Route::put('production/lot-batches/{lotBatch}/counts/{count}/items/{item}', [ProductionLotCountController::class, 'updateItem']);
    Route::delete('production/lot-batches/{lotBatch}/counts/{count}/items/{item}', [ProductionLotCountController::class, 'deleteItem']);
    Route::post('production/lot-batches/{lotBatch}/counts/{count}/pack', [ProductionLotCountController::class, 'pack']);
    Route::post('production/lot-batches/{lotBatch}/counts/{count}/cancel', [ProductionLotCountController::class, 'cancel']);

    //  ============== Hall management =========================
    Route::post('hall/associate', [HallController::class, 'hallAssociate']);

    // ============================ Client management =====================
    Route::post('client/associate', [ClientController::class, 'clientAssociate']);

    // ============================ Media management =====================
    Route::post('image-upload', [MediaController::class, 'uploadMedia']);

    // ============================ Excel Import =====================
    Route::post('/employees/import', [EmployeeImportController::class, 'import']);

    Route::post('/item/import', [EmployeeImportController::class, 'itemImport']);

    Route::post('/clients/import', [ClientImportController::class, 'import']);
    Route::post('/suppliers/import', [SupplierImportController::class, 'import']);

    // ============================ Excel Export =====================
    Route::post('/employees/export', [EmployeeExportController::class, 'export']);
    Route::post('/clients/export', [ClientExportController::class, 'export']);
    Route::post('/export/supplier', [SupplierExportController::class, 'export']);
    Route::post('/item/export', [EmployeeExportController::class, 'Itemexport']);

    Route::post('/product-barcode', [ProductBarcodeController::class, 'generateBarcodePdf']);

    Route::delete('/ProductHasvariants/DeleteByProduct/{product_id}', [ProductController::class, 'deleteByProduct']);

    Route::post('/generate-id', [idGeneratorController::class, 'generateCustomCode']);

    // ============================ Employee payroll management =====================
    Route::get('employePayrollStatus/{id}/{start_date}/{end_date}', [EmployeePayrollController::class, 'employePayrollStatus']);
    Route::post('employee-log/export-pdf', [EmployeePayrollController::class, 'exportEmployeeLogPdf']);
    Route::post('employee-log/export-list-pdf', [EmployeePayrollController::class, 'exportEmployeeListPdf']);
});
