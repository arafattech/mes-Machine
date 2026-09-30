<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payrolls', function (Blueprint $table) {
            $table->date('start_date')->nullable()->after('employee_id');
            $table->date('end_date')->nullable()->after('start_date');
            $table->integer('total_payable_days')->default(0)->after('end_date');
        });
    }

    public function down(): void
    {
        Schema::table('payrolls', function (Blueprint $table) {
            $table->dropColumn(['start_date', 'end_date', 'total_payable_days']);
        });
    }
};
