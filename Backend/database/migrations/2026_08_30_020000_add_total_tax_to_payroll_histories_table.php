<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payroll_histories', function (Blueprint $table) {
            $table->decimal('total_tax', 15, 2)->default(0)->after('total_deductions');
        });
    }

    public function down(): void
    {
        Schema::table('payroll_histories', function (Blueprint $table) {
            $table->dropColumn('total_tax');
        });
    }
};
