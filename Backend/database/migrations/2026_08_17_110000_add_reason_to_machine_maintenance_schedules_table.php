<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add the required `reason` column to machine_maintenance_schedules.
     * The base table migration (2026_08_17_100000) shipped before the reason
     * field existed — CRUD requires a required reason on every schedule.
     */
    public function up(): void
    {
        Schema::table('machine_maintenance_schedules', function (Blueprint $table) {
            $table->string('reason', 500)->after('scheduled_start_at');
        });
    }

    public function down(): void
    {
        Schema::table('machine_maintenance_schedules', function (Blueprint $table) {
            $table->dropColumn('reason');
        });
    }
};
