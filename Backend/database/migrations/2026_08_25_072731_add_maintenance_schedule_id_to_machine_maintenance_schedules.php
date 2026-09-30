<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('machine_maintenance_schedules', function (Blueprint $table) {
            $table->longText('maintenance_note')->nullable()->after('reason');
            $table->foreignId('maintenance_schedule_id')->nullable()->constrained('maintenance_schedules')->nullOnDelete();
            $table->unsignedInteger('duration_seconds')->nullable()->after('ended_at'); // set on close, activated_at -> ended_at
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('machine_maintenance_schedules', function (Blueprint $table) {
            $table->dropColumn('duration_seconds');
            $table->dropForeign(['maintenance_schedule_id']);
            $table->dropColumn('maintenance_schedule_id');
            $table->dropColumn('maintenance_note');
        });
    }
};
