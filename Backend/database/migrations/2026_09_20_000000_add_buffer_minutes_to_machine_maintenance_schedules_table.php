<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-activation verification buffer length, in minutes. Previously the
     * post-maintenance verification window (`pending_confirm_until`) was a
     * single fixed duration for every schedule (`MAINTENANCE_VERIFICATION_BUFFER_MS`
     * env var on node-server, 5 minutes by default). It is now chosen by the
     * operator in the "Activate now" dialog and stored per row — see
     * `MachineMaintenanceController::activate()` / `MachineMaintenanceService::activate()`.
     * Nullable so existing rows (activated before this column existed) keep
     * falling back to node-server's env-var default.
     */
    public function up(): void
    {
        Schema::table('machine_maintenance_schedules', function (Blueprint $table) {
            $table->unsignedSmallInteger('buffer_minutes')->nullable()->after('buffer_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('machine_maintenance_schedules', function (Blueprint $table) {
            $table->dropColumn('buffer_minutes');
        });
    }
};
