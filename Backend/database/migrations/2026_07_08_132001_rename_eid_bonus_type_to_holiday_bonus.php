<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('bonus_types')->where('name', 'EID')->update(['name' => 'HOLIDAY_BONUS']);
        DB::table('employee_bonuses')->where('bonus_type', 'EID')->update(['bonus_type' => 'HOLIDAY_BONUS']);
    }

    public function down(): void
    {
        DB::table('bonus_types')->where('name', 'HOLIDAY_BONUS')->update(['name' => 'EID']);
        DB::table('employee_bonuses')->where('bonus_type', 'HOLIDAY_BONUS')->update(['bonus_type' => 'EID']);
    }
};
