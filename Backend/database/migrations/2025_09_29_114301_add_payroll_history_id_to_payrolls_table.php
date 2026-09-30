<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payrolls', function (Blueprint $table) {
            $table->foreignId('payroll_history_id')
                ->nullable()
                ->constrained('payroll_histories')
                ->onDelete('set null')
                ->after('employee_id');
        });
    }

    public function down(): void
    {
        Schema::table('payrolls', function (Blueprint $table) {
            $table->dropForeign(['payroll_history_id']);
            $table->dropColumn('payroll_history_id');
        });
    }
};
