<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_holiday_swaps', function (Blueprint $table) {
            $table->foreignId('weekend_id')
                ->nullable()
                ->after('employee_id')
                ->constrained('employee_weekends')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('employee_holiday_swaps', function (Blueprint $table) {
            $table->dropConstrainedForeignId('weekend_id');
        });
    }
};
