<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class HolidayTypesSeeder extends Seeder
{
    public function run()
    {
        $types = [
            ['name' => 'Public Holiday' , 'color'=> '#ffa07a'],
            ['name' => 'Govt Holiday' , 'color'=> '#98fb98'],
            ['name' => 'Special Event' , 'color'=> '#87cefa'],
            ['name' => 'Industrial Holiday' , 'color'=> '#FFD700'],
            ['name' => 'Religious Holiday' , 'color'=> '#FF69B4'],
        ];

        foreach ($types as $type) {
            DB::table('holiday_types')->updateOrInsert(
                ['name' => $type['name']],
                ['color'=> $type['color']]
            );
        }
    }
}
