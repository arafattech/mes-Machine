<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Replaces the hard-coded `maintenance_schedules.frequency` string with a
     * user-managed `schedule_frequencies` table (interval in days).
     *
     * Existing recurring schedules are discarded — their old string frequency
     * has no row to point at — together with their not-yet-started occurrences
     * in `machine_maintenance_schedules` (left behind they would turn into
     * standalone emergency schedules). Started / finished maintenance history
     * is kept; its `maintenance_schedule_id` is nulled by the FK.
     */
    public function up(): void
    {
        DB::table('machine_maintenance_schedules')
            ->whereNotNull('maintenance_schedule_id')
            ->whereNull('activated_at')
            ->whereNull('ended_at')
            ->delete();
        DB::table('maintenance_schedules')->delete();

        Schema::create('schedule_frequencies', function (Blueprint $table) {
            $table->id();
            $table->string('name', 60)->unique();
            $table->unsignedSmallInteger('interval_days');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::table('maintenance_schedules', function (Blueprint $table) {
            $table->foreignId('schedule_frequency_id')->after('scheduled_time')->constrained('schedule_frequencies')->restrictOnDelete();
            $table->dropColumn('frequency');
        });
    }

    public function down(): void
    {
        Schema::table('maintenance_schedules', function (Blueprint $table) {
            $table->string('frequency', 20)->nullable()->after('scheduled_time');
            $table->dropConstrainedForeignId('schedule_frequency_id');
        });

        Schema::dropIfExists('schedule_frequencies');
    }
};
