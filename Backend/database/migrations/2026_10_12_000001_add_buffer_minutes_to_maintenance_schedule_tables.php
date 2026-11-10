<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-schedule length (minutes) of the post-maintenance verification
     * buffer, set by the user when `buffer_enabled` is on. Replaces node-server's
     * fixed 5-minute window; the default keeps existing rows on 5 minutes.
     * Recurring `maintenance_schedules` hold the configured value and copy it
     * onto each `machine_maintenance_schedules` session row they open — the
     * session row's value is the one node-server reads.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('maintenance_schedules', 'buffer_minutes')) {
            Schema::table('maintenance_schedules', function (Blueprint $table) {
                $table->unsignedSmallInteger('buffer_minutes')->default(5)->after('buffer_enabled');
            });
        }

        if (! Schema::hasColumn('machine_maintenance_schedules', 'buffer_minutes')) {
            Schema::table('machine_maintenance_schedules', function (Blueprint $table) {
                $table->unsignedSmallInteger('buffer_minutes')->default(5)->after('buffer_enabled');
            });

            return;
        }

        // Databases that ran the retired 2026_09_20_000000 migration hold a nullable column
        // (per-activation value); normalise it to the per-schedule NOT NULL DEFAULT 5 shape.
        DB::table('machine_maintenance_schedules')->whereNull('buffer_minutes')->update(['buffer_minutes' => 5]);
        Schema::table('machine_maintenance_schedules', function (Blueprint $table) {
            $table->unsignedSmallInteger('buffer_minutes')->default(5)->nullable(false)->change();
        });
    }

    public function down(): void
    {
        foreach (['machine_maintenance_schedules', 'maintenance_schedules'] as $tableName) {
            if (Schema::hasColumn($tableName, 'buffer_minutes')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->dropColumn('buffer_minutes');
                });
            }
        }
    }
};
