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
        Schema::table('employee_shifts', function (Blueprint $table) {
            $table->decimal('night_shift_bonus_amount', 10, 2)->nullable()->default(0)->after('is_night');
            $table->decimal('ramadan_bonus_amount', 10, 2)->nullable()->default(0)->after('night_shift_bonus_amount');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('employee_shifts', function (Blueprint $table) {
            $table->dropColumn(['night_shift_bonus_amount', 'ramadan_bonus_amount']);
        });
    }
};
