<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class MachineStatesSeeder extends Seeder
{
    /**
     * Canonical starting rows for the now fully DB-driven machine status vocabulary.
     * Colors/icons match what used to be hardcoded in
     * `machine-overview.component.ts`'s `statusColorMap`/`statusIconMap` — these are
     * just the *initial* values now; admins can rename/recolor/add more via the
     * existing machine-state-list/machine-state-form CRUD. `priority` mirrors the
     * old fixed precedence (Maintenance checked first, then Active/Idle, Fault as
     * the active+idle contradiction, else Inactive) for the new priority-based
     * channel-mapping resolution. Only Active counts toward OEE Availability.
     */
    public function run(): void
    {
        $states = [
            ['name' => 'Active', 'color' => '#257a3e', 'icon' => 'media-play', 'counts_as_productive' => true, 'priority' => 50],
            ['name' => 'Idle', 'color' => '#e76500', 'icon' => 'lateness', 'counts_as_productive' => false, 'priority' => 40],
            ['name' => 'Inactive', 'color' => '#bb0000', 'icon' => 'decline', 'counts_as_productive' => false, 'priority' => 10],
            ['name' => 'Maintenance', 'color' => '#6a6d70', 'icon' => 'wrench', 'counts_as_productive' => false, 'priority' => 100],
            ['name' => 'Fault', 'color' => '#bb0000', 'icon' => 'alert', 'counts_as_productive' => false, 'priority' => 90],
        ];

        foreach ($states as $state) {
            DB::table('machine_states')->updateOrInsert(
                ['name' => $state['name']],
                [
                    'is_active' => true,
                    'color' => $state['color'],
                    'icon' => $state['icon'],
                    'counts_as_productive' => $state['counts_as_productive'],
                    'priority' => $state['priority'],
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }
    }
}
