<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $roles = ['super-admin', 'admin', 'accountant', 'user','employee','sales-head', 'sales-person', 'production-supervisor', 'store-keeper', 'hod', 'gm'];

        foreach ($roles as $roleName) {
            $role = Role::updateOrCreate(
                ['name' => $roleName],
                ['guard_name' => 'web']
            );

            $permissions = Permission::all();
            if ($roleName === 'super-admin') {
                $role->syncPermissions($permissions);
            }
            $employeePermissions = [
                'HR_EMPLOYEE_DASHBOARD',
            ];
            if($roleName === 'employee'){
                $role->syncPermissions($employeePermissions);
            }

            // $productionSupervisorPermissions = [
            //     'PRODUCTION_LOT',
            //     'PRODUCTION_LOT_CREATE',
            //     'PRODUCTION_LOT_BATCH_CREATE',
            //     'PRODUCTION_LOT_EDIT',
            //     'PRODUCTION_LOT_DELETE',
            //     'PRODUCTION_LOT_VIEW',
            //     'PRODUCTION_LOT_QC',
            //     'PRODUCTION_LOT_PACK',
            //     'PRODUCTION_LOT_GTN_SUBMIT',
            //     'PRODUCTION_LOT_GTN_RECALL',
            // ];
            // if ($roleName === 'production-supervisor') {
            //     $role->syncPermissions($productionSupervisorPermissions);
            // }

            // $storeKeeperPermissions = [
            //     'STORE_YARN_GRN',
            //     'STORE_YARN_GRN_VIEW',
            //     'STORE_YARN_GRN_RECEIVE',
            //     'STORE_YARN_GRN_REJECT',
            //     'STORE_YARN_RECONCILE',
            // ];
            // if ($roleName === 'store-keeper') {
            //     $role->syncPermissions($storeKeeperPermissions);
            // }

            // $hodPermissions = [
            //     'STORE_YARN_GRN_VIEW',
            //     'STORE_YARN_ADVICE_APPROVE_HOD',
            // ];
            // if ($roleName === 'hod') {
            //     $role->syncPermissions($hodPermissions);
            // }

            // $gmPermissions = [
            //     'STORE_YARN_GRN_VIEW',
            //     'STORE_YARN_ADVICE_APPROVE_GM',
            // ];
            // if ($roleName === 'gm') {
            //     $role->syncPermissions($gmPermissions);
            // }
        }
    }
}
