<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $nightshiftType = DB::table('bonus_types')->where('name', 'NIGHTSHIFT')->first();

        if (! $nightshiftType) {
            return;
        }

        DB::table('employee_bonuses')
            ->where('bonus_type', 'NIGHTSHIFT')
            ->whereNull('bonus_type_id')
            ->update(['bonus_type_id' => $nightshiftType->id]);
    }

    public function down(): void
    {
        DB::table('employee_bonuses')
            ->where('bonus_type', 'NIGHTSHIFT')
            ->update(['bonus_type_id' => null]);
    }
};
