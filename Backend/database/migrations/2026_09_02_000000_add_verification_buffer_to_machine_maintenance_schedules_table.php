<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Post-maintenance verification buffer: on a confirmed real-ACTIVE
     * auto-clear, node-server no longer closes the row immediately. It clears
     * the Redis override right away (board shows Active immediately) but
     * leaves the row open with `pending_confirm_until` set 5 minutes out. If
     * the machine faults again before that deadline, the same row re-opens
     * for Maintenance; otherwise the row closes for real once the deadline
     * passes with the buffer window excluded from `duration_seconds`. See
     * `machine-state-tracker.service.ts` (node-server) for the poll-tick
     * check that drives both branches.
     *
     * `buffer_enabled` lets a schedule opt out of the buffer entirely (set
     * from the switch on the `machine-maintenance-schedule` create form,
     * default on) — false skips straight to the pre-buffer behavior:
     * confirmed ACTIVE closes the row immediately.
     */
    public function up(): void
    {
        Schema::table('machine_maintenance_schedules', function (Blueprint $table) {
            $table->timestamp('pending_confirm_until')->nullable()->after('ended_at');
            $table->boolean('buffer_enabled')->default(true)->after('maintenance_schedule_id');
            $table->index('pending_confirm_until');
        });
    }

    public function down(): void
    {
        Schema::table('machine_maintenance_schedules', function (Blueprint $table) {
            $table->dropIndex(['pending_confirm_until']);
            $table->dropColumn('buffer_enabled');
            $table->dropColumn('pending_confirm_until');
        });
    }
};
