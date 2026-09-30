<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_logs', function (Blueprint $table) {
            $table->renameColumn('is_eid_duty', 'is_holiday_bonus_duty');
            $table->renameColumn('eid_status', 'holiday_bonus_status');
        });
    }

    public function down(): void
    {
        Schema::table('attendance_logs', function (Blueprint $table) {
            $table->renameColumn('is_holiday_bonus_duty', 'is_eid_duty');
            $table->renameColumn('holiday_bonus_status', 'eid_status');
        });
    }
};
