<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class BonusTypeSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();
        $bonusTypes = [
            ['name' => 'OVERTIME', 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'ATTENDANCE', 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'NIGHTSHIFT', 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'RAMADAN', 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'HOLIDAY_BONUS', 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'EXTRA_SHIFT', 'created_at' => $now, 'updated_at' => $now],
        ];

        foreach ($bonusTypes as $type) {
            DB::table('bonus_types')->updateOrInsert(
                ['name' => $type['name']],
                $type,
            );
        }
    }
}
