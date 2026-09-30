<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ApprovalTypeSeeder extends Seeder
{
    public function run()
    {
        $types = [
            ['code' => 'INDENT', 'name' => 'INDENT APPROVAL'],
            ['code' => 'SR', 'name' => 'SR APPROVAL'],
        ];

        foreach ($types as $type) {
            DB::table('approval_types')->updateOrInsert(
                ['code' => $type['code']],
                ['name' => $type['name'], 'is_active' => true]
            );
        }
    }
}
