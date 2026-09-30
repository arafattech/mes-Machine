<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-schedule switch (create-form default on) controlling whether the
     * 5-minute post-maintenance verification buffer applies to sessions
     * opened from this recurring schedule. Copied onto each
     * `machine_maintenance_schedules` row at open time — see that table's
     * own `buffer_enabled` column.
     */
    public function up(): void
    {
        Schema::table('maintenance_schedules', function (Blueprint $table) {
            $table->boolean('buffer_enabled')->default(true)->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('maintenance_schedules', function (Blueprint $table) {
            $table->dropColumn('buffer_enabled');
        });
    }
};
