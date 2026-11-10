<?php

use App\Enums\Machine\MaintenanceWorkType;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** "Type of Works" picked on the recurring schedule form. Existing schedules default to plain maintenance. */
    public function up(): void
    {
        Schema::table('maintenance_schedules', function (Blueprint $table) {
            $table->string('type_of_work', 30)->default(MaintenanceWorkType::MAINT->value)->after('schedule_frequency_id');
        });
    }

    public function down(): void
    {
        Schema::table('maintenance_schedules', function (Blueprint $table) {
            $table->dropColumn('type_of_work');
        });
    }
};
