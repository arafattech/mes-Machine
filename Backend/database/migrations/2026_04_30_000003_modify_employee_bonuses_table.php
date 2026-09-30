<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::table('employee_bonuses', function (Blueprint $table) {
            $table->unsignedBigInteger('group_id')->nullable();
            $table->unsignedBigInteger('emp_id')->nullable();
            $table->unsignedBigInteger('config_id')->nullable();
            $table->unsignedBigInteger('department_id')->nullable();

            $table->foreign('group_id')->references('id')->on('employee_groups')->nullOnDelete();
            $table->foreign('emp_id')->references('id')->on('employees')->nullOnDelete();
            $table->foreign('config_id')->references('id')->on('bonus_configs')->nullOnDelete();
            $table->foreign('department_id')->references('id')->on('departments')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('employee_bonuses', function (Blueprint $table) {
            $table->dropForeign(['group_id']);
            $table->dropForeign(['emp_id']);
            $table->dropForeign(['config_id']);
            $table->dropForeign(['department_id']);
            $table->dropColumn(['group_id', 'emp_id', 'config_id', 'department_id']);
        });
    }
};
