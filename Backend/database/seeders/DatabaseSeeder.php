<?php

namespace Database\Seeders;

// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Database\Seeders\IdGeneratorSettingsSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\BonusTypeSeeder;
use Database\Seeders\UserSeeder;
use Database\Seeders\MachineStatesSeeder;
use Database\Seeders\ApprovalTypeSeeder;
use Illuminate\Database\Seeder;


class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(IdGeneratorSettingsSeeder::class);
        $this->call(PermissionSeeder::class);
        $this->call(RoleSeeder::class);
        $this->call(UserSeeder::class);
        $this->call(HolidayTypesSeeder::class);
        $this->call(BonusTypeSeeder::class);
        $this->call(MachineStatesSeeder::class);
        $this->call(ApprovalTypeSeeder::class);
    }
}
