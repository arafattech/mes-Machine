<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_bonuses', function (Blueprint $table) {
            if (!Schema::hasColumn('employee_bonuses', 'attendance_log_id')) {
                $table->unsignedBigInteger('attendance_log_id')->nullable();
            }

            if (!Schema::hasColumn('employee_bonuses', 'shift_id')) {
                $table->unsignedBigInteger('shift_id')->nullable();
            }

            if (!Schema::hasColumn('employee_bonuses', 'attendance_date')) {
                $table->date('attendance_date')->nullable();
            }

            if (!Schema::hasColumn('employee_bonuses', 'overtime_minutes')) {
                $table->unsignedInteger('overtime_minutes')->nullable();
            }

            if (!Schema::hasColumn('employee_bonuses', 'calculation_type')) {
                $table->string('calculation_type')->nullable();
            }

            if (!Schema::hasColumn('employee_bonuses', 'bonus_config_amount')) {
                $table->decimal('bonus_config_amount', 12, 2)->nullable();
            }

            if (!Schema::hasColumn('employee_bonuses', 'bonus_type_id')) {
                $table->unsignedBigInteger('bonus_type_id')->nullable();
            }

            if (!Schema::hasColumn('employee_bonuses', 'source_type')) {
                $table->string('source_type')->nullable();
            }

            if (!Schema::hasColumn('employee_bonuses', 'remarks')) {
                $table->string('remarks', 500)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('employee_bonuses', function (Blueprint $table) {
            $table->dropUnique('employee_bonus_overtime_unique');

            $table->dropForeign(['attendance_log_id']);
            $table->dropForeign(['shift_id']);
            $table->dropForeign(['bonus_type_id']);

            $table->dropColumn([
                'attendance_log_id',
                'shift_id',
                'attendance_date',
                'overtime_minutes',
                'calculation_type',
                'bonus_config_amount',
                'bonus_type_id',
                'source_type',
                'remarks',
            ]);
        });
    }
};
