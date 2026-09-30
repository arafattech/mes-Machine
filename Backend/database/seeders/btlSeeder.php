<?php

namespace Database\Seeders;

// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Database\Seeders\IdGeneratorSettingsSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Database\Seeder;


class BtlSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(IdGeneratorSettingsSeeder::class);
        $this->call(BtlPermissionSeeder::class);
        $this->call(RoleSeeder::class);
        $this->call(UserSeeder::class);
    }
}
