<?php

use App\Http\Controllers\AttendanceExportController;
use App\Http\Controllers\AttendanceLogController;
use App\Http\Controllers\BonusConfigController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\ApprovalTypeController;
use App\Http\Controllers\LeaveApprovalController;
use App\Http\Controllers\HrmDashboardAnalyticsController;
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
use App\Http\Controllers\SideBillController;
use App\Http\Controllers\SideBillExportController;
use App\Http\Controllers\EmployeeBonusExportController;
use App\Http\Controllers\ClientImportController;
use App\Http\Controllers\EmployeeHolidayController;
use App\Http\Controllers\EmployeePayrollController;
use App\Http\Controllers\EmployeeRoster\RosterController;
use App\Http\Controllers\SupplierImportController;
use App\Http\Controllers\ProductBarcodeController;
use App\Http\Controllers\idGeneratorController;
use App\Http\Controllers\LeaveController;
use App\Http\Controllers\NotificationClear;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\NoticeController;
use App\Http\Controllers\ReminderController;
use App\Http\Controllers\PDFController;
use App\Http\Controllers\PromotionConfigurationController;
use App\Http\Controllers\PromotionController;
use App\Http\Controllers\Store\RequisitionController;
use App\Http\Controllers\Store\MaterialReceiptController;
use App\Http\Controllers\Store\MrrReturnController;
use App\Http\Controllers\Store\IdleInventoryController;
use App\Http\Controllers\Store\LowStockController;
use App\Http\Controllers\Store\StockLedgerController;
use App\Http\Controllers\Store\RawCottonReceivedController;
use App\Http\Controllers\Store\SalesDispatchController;
use App\Http\Controllers\Store\YarnAdviceController;
use App\Http\Controllers\Purchase\PurchaseController;
use App\Http\Controllers\Purchase\PurchaseQuoteController;
use App\Http\Controllers\Purchase\PurchaseOrderWorkflowController;
use App\Http\Controllers\Sales\SalesAnalyticsController;
use App\Http\Controllers\Sales\SalesController;


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
    Route::get('approval-types/by-code/{code}/approvers', [ApprovalTypeController::class, 'approversByCode']);
    Route::get('approval-types/by-code/{code}/progress', [ApprovalTypeController::class, 'progressByCode']);
    Route::get('approval-types/{approvalType}/approvers', [ApprovalTypeController::class, 'approvers']);
    Route::post('approval-type/employee-associate', [ApprovalTypeController::class, 'associate']);
    Route::post('requisitions/{requisitionId}/approver-approve', [ApprovalTypeController::class, 'approve']);
    Route::post('requisitions/{requisitionId}/approver-reject', [ApprovalTypeController::class, 'reject']);
    Route::get('leave-requests/progress', [LeaveApprovalController::class, 'progress']);
    Route::get('leave-requests/{leaveRequest}/approvers', [LeaveApprovalController::class, 'approvers']);
    Route::post('leave-requests/{leaveRequestId}/approver-approve', [LeaveApprovalController::class, 'approve']);
    Route::post('leave-requests/{leaveRequestId}/approver-reject', [LeaveApprovalController::class, 'reject']);

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
    Route::post('/side-bills/export', [SideBillExportController::class, 'export']);
    Route::post('/side-bills', [SideBillController::class, 'store']);
    Route::put('/side-bills/{id}', [SideBillController::class, 'update']);
    Route::post('/employee-bonuses/export', [EmployeeBonusExportController::class, 'export']);

    Route::post('/product-barcode', [ProductBarcodeController::class, 'generateBarcodePdf']);

    Route::delete('/ProductHasvariants/DeleteByProduct/{product_id}', [ProductController::class, 'deleteByProduct']);

    Route::post('/generate-id', [idGeneratorController::class, 'generateCustomCode']);
    // ============================ PDF Download =====================
    Route::post('/pdf/generate', [PDFController::class, 'generatePDF']);

    //  ------- hr management --------

    // ============================ Employee payroll management =====================
    Route::get('employePayrollStatus/{id}/{start_date}/{end_date}', [EmployeePayrollController::class, 'employePayrollStatus']);
    Route::post('employePayrollStatusBulk', [EmployeePayrollController::class, 'employePayrollStatusBulk']);
    Route::post('generatePayroll/{stdate}/{endate}', [EmployeePayrollController::class, 'generatePayroll']);
    Route::get('isGeneratedPayrollInMonth/{id}/{start_date}/{end_date}', [EmployeePayrollController::class, 'isGeneratedPayrollInMonth']);
    Route::post('exportPayroll', [EmployeePayrollController::class, 'exportPayroll']);
    Route::post('exportPayrollPdf', [EmployeePayrollController::class, 'exportPayrollPdf']);
    Route::post('employee-log/export-pdf', [EmployeePayrollController::class, 'exportEmployeeLogPdf']);
    Route::post('employee-log/export-list-pdf', [EmployeePayrollController::class, 'exportEmployeeListPdf']);
    Route::get('payrollcalculate/{stdate}/{endate}', [EmployeePayrollController::class, 'payrollCalculations']);
    Route::delete('payrolls/{id}', [EmployeePayrollController::class, 'destroyPayroll']);
    Route::get('payrollsByDateRange/{start}/{end}', [EmployeePayrollController::class, 'getPayrollsByDateRange']);
    Route::put('employee-bonuses/bulk-mark-paid', [EmployeePayrollController::class, 'bulkMarkBonusesPaid']);
    Route::post('employee/blacklist/{id}', [EmployeeController::class, 'employeeBlacklist']);
    Route::post('employee/blacklist-revoked/{id}', [EmployeeController::class, 'employeeBlacklistUndo']);

    // ============================ Hr Holiday, Shift, Attendance, Notice, Roster management =====================
    Route::prefix('hrm')->group(function () {
        Route::get('holidays', [EmployeeHolidayController::class, 'getHoliday']);
        Route::post('holidays', [EmployeeHolidayController::class, 'saveHoliday']);
        Route::get('employee-weekends', [EmployeeHolidayController::class, 'index']);
        Route::post('employee-weekends', [EmployeeHolidayController::class, 'store']);
        Route::get('weekends/schedule', [EmployeeHolidayController::class, 'employeeWeekends']);
        Route::get('employees/{id}/shift-check', [EmployeeController::class, 'getEmployeeShift']);
        Route::get('employees/{employeeId}/attendance-check', [EmployeeController::class, 'checkAttendanceDate']);
        Route::get('employees/{id}/validate-checkin', [EmployeeController::class, 'validateCheckIn']);
        Route::get('dailyAttendance', [EmployeeController::class, 'loadDailyAttendance']);
        Route::apiResource('notices', NoticeController::class);
        Route::put('notices/{id}', [NoticeController::class, 'update']);
        Route::post('NoticesEmployees/{id}/mark-as-read', [NoticeController::class, 'markAsRead']);
        Route::post('rosters', [RosterController::class, 'store']);
        Route::get('rosters/latest', [RosterController::class, 'getLatestRoster']);
        Route::get('rosters/{roster}/overrides', [RosterController::class, 'getOverrides']);
        Route::get('roster-schedule', [RosterController::class, 'getSchedule']);
        Route::post('roster-schedule/export', [RosterController::class, 'exportSchedule']);
        Route::post('shift-overrides', [RosterController::class, 'shiftOVerrides']);
        Route::get('leave-taken', [LeaveController::class, 'getTakenLeaveDates']);
        Route::post('leave-requests', [LeaveController::class, 'storeLeaveRequest']);
        Route::get('leave-request', [LeaveController::class, 'getLeaveRequest']);
        Route::put('leave-requests/{id}', [LeaveController::class, 'updateLeaveRequest']);
        Route::get('analytics/today-summary', [HrmDashboardAnalyticsController::class, 'todaySummary']);
        Route::get('analytics/dashboard', [HrmDashboardAnalyticsController::class, 'dashboard']);
        Route::get('analytics/shift-employee-trend', [HrmDashboardAnalyticsController::class, 'shiftEmployeeTrend']);
        Route::put('attendance/{id}/checkout', [AttendanceLogController::class, 'update']);
        Route::get('attendance/duty-rows', [AttendanceLogController::class, 'dutyRows']);
        Route::post('attendance/approve-overtime', [AttendanceLogController::class, 'approveOvertime']);
        Route::post('attendance/export', [AttendanceExportController::class, 'export']);
        Route::post('bonus-configs', [BonusConfigController::class, 'store']);
        Route::put('bonus-configs/{bonusConfig}', [BonusConfigController::class, 'update']);
        Route::get('promotions/options', [PromotionController::class, 'options']);
        Route::get('promotions/employees/{employee}', [PromotionController::class, 'employee']);
        Route::post('promotions/export', [PromotionController::class, 'exportHistory']);
        Route::get('promotions', [PromotionController::class, 'index']);
        Route::post('promotions', [PromotionController::class, 'store']);
        // Catch null ID (virtual promotion) before the model-bound {promotion} routes
        Route::put('promotions/null', [PromotionController::class, 'store']);
        Route::put('promotions/{promotion}', [PromotionController::class, 'update']);
        Route::post('promotions/sync-eligibility', [PromotionController::class, 'syncEligibility']);
        Route::post('promotions/approve-eligible', [PromotionController::class, 'approveEligible']);
        Route::post('promotions/{promotion}/approve', [PromotionController::class, 'approve']);
        // POST alias for update (frontend can use POST instead of PUT for existing promotions)
        Route::post('promotions/{promotion}', [PromotionController::class, 'update']);

    });

    //  ============================== Store management ===============================
    Route::prefix('store')->group(function () {
        Route::put('requisitions-approved', [RequisitionController::class, 'approveRequisition']);
        Route::put('requisitions-final-approve', [RequisitionController::class, 'finalApproveRequisition']);
        Route::post('material-receipts', [MaterialReceiptController::class, 'store']);
        Route::put('material-receipts/{materialReceipt}', [MaterialReceiptController::class, 'update']);
        Route::post('material-receipts/{materialReceipt}/pdf', [MaterialReceiptController::class, 'generatePdf']);
        Route::post('material-receipts/{materialReceipt}/receive', [MaterialReceiptController::class, 'receiveSingleItem']);
        Route::post('mrr-returns', [MrrReturnController::class, 'store']);
        Route::get('mrr-returns/summary', [MrrReturnController::class, 'summary']);
        Route::get('mrr-returns/next-custom-id', [MrrReturnController::class, 'nextCustomId']);
        Route::post('mrr-returns/{mrrReturn}/pdf', [MrrReturnController::class, 'generatePdf']);
        Route::get('idle-inventory/report', [IdleInventoryController::class, 'report']);
        Route::get('low-stock/report', [LowStockController::class, 'report']);
        Route::get('stock-ledger/report', [StockLedgerController::class, 'report']);
        Route::get('raw-cotton-received/report', [RawCottonReceivedController::class, 'report']);
        Route::post('raw-cotton-received/export', [RawCottonReceivedController::class, 'export']);
        Route::post('stock-ledger/export', [StockLedgerController::class, 'export']);
        Route::get('sales-dispatch/report', [SalesDispatchController::class, 'report']);
        Route::post('reminders', [ReminderController::class, 'store']);
        Route::put('reminders/{reminder}', [ReminderController::class, 'update']);

        // ===== Yarn submission to store: transfer advice with prepared->hod->store->gm approval chain =====
        Route::post('yarn-advices', [YarnAdviceController::class, 'store']);
        Route::put('yarn-advices/{advice}', [YarnAdviceController::class, 'update']);
        Route::post('yarn-advices/{advice}/cancel', [YarnAdviceController::class, 'cancel']);
        Route::post('yarn-advices/{advice}/approve-hod', [YarnAdviceController::class, 'approveHod']);
        Route::post('yarn-advices/{advice}/reject', [YarnAdviceController::class, 'reject']);
        Route::post('yarn-advices/{advice}/resubmit', [YarnAdviceController::class, 'resubmit']);
        Route::post('yarn-advices/{advice}/lines/{line}/receive', [YarnAdviceController::class, 'receiveLine']);
        Route::post('yarn-advices/{advice}/lines/{line}/reject', [YarnAdviceController::class, 'rejectLine']);
        Route::post('yarn-advices/{advice}/approve-gm', [YarnAdviceController::class, 'approveGm']);
        Route::post('yarn-advices/{advice}/lines/{line}/reconcile', [YarnAdviceController::class, 'reconcileLine']);
    });
    //  ============================== purchase management ===============================
    Route::prefix('purchase')->group(function () {
        Route::get('analysis-data', [PurchaseController::class, 'getAnalysisData']);
        Route::post('quotes', [PurchaseQuoteController::class, 'store']);
        Route::put('quotes/{purchaseQuote}', [PurchaseQuoteController::class, 'update']);
        Route::delete('quotes/{purchaseQuote}', [PurchaseQuoteController::class, 'destroy']);
        Route::post('orders', [PurchaseOrderWorkflowController::class, 'store']);
        Route::put('orders/{purchaseOrder}', [PurchaseOrderWorkflowController::class, 'update']);
        Route::delete('orders/{purchaseOrder}', [PurchaseOrderWorkflowController::class, 'destroy']);
        Route::post('orders/{purchaseOrder}/approve', [PurchaseOrderWorkflowController::class, 'approve']);
        Route::post('requisitions/{purchaseRequisition}/create-order-from-quote', [PurchaseOrderWorkflowController::class, 'createPurchaseOrderFromQuote']);
    });

    // ============ Sales Module ==================
    Route::prefix('sales')->group(function () {
        Route::post('create-order', [SalesController::class, 'createOrder']);
        Route::put('update-order/{id}', [SalesController::class, 'updateOrder']);
        Route::get('analytics-data', [SalesAnalyticsController::class, 'getDashboardData']);
        Route::get('market-prices', [SalesAnalyticsController::class, 'getMarketPrice']);
        Route::get('get-price-planning', [SalesController::class, 'getPricePlannings']);
        Route::get('get-market-price-entry', [SalesController::class, 'getMarketPriceEntry']);
        Route::post('/invoice/generate', [SalesController::class, 'generatePDF']);
    });
});

// ============================ Internal service-to-service routes =====================
// No user session (node-server device/biometrics flow has nobody logged in) — gated by
// a static shared-secret header instead of auth:sanctum. See VerifyInternalServiceToken.
Route::middleware(['internal.token'])->group(function () {
    Route::put('internal/attendance/{id}/checkout', [AttendanceLogController::class, 'update']);
    Route::get('internal/roster-schedule', [RosterController::class, 'getSchedule']);
});
