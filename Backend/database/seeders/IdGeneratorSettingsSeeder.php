<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class IdGeneratorSettingsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'Product', 'table' => 'products'],
            [
                'prefix' => 'PR-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'User', 'table' => 'users'],
            [
                'prefix' => 'U-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'Role', 'table' => 'roles'],
            [
                'prefix' => 'ROLE-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'Permission', 'table' => 'permissions'],
            [
                'prefix' => 'PERM-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'Client', 'table' => 'clients'],
            [
                'prefix' => 'CLI-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,

            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'Employee', 'table' => 'employees'],
            [
                'prefix' => 'EMP-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'Plant', 'table' => 'plants'],
            [
                'prefix' => 'PLA-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'Machine', 'table' => 'machines'],
            [
                'prefix' => 'MA-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'Supplier', 'table' => 'suppliers'],
            [
                'prefix' => 'SUP-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'ActivityLog', 'table' => 'activity_logs'],
            [
                'prefix' => 'LOG-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'ProductType', 'table' => 'product_types'],
            [
                'prefix' => 'PTP-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'Uom', 'table' => 'uoms'],
            [
                'prefix' => 'UOM-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'Origin', 'table' => 'origins'],
            [
                'prefix' => 'ORG-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'StorageLocation', 'table' => 'storage_locations'],
            [
                'prefix' => 'STL-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'Operation', 'table' => 'operations'],
            [
                'prefix' => 'OPA-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'HandlingUnit', 'table' => 'handling_units'],
            [
                'prefix' => 'HNU-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'Capacity', 'table' => 'capacities'],
            [
                'prefix' => 'CAP-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'WorkOrder', 'table' => 'work_orders'],
            [
                'prefix' => 'WO-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'Hall', 'table' => 'halls'],
            [
                'prefix' => 'HAL-',

                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'MachineGroup ', 'table' => 'machine_groups'],
            [
                'prefix' => 'MAG-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'MachineState ', 'table' => 'machine_states'],
            [
                'prefix' => 'MAS-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'MachineWastageType', 'table' => 'machine_wastage_types'],
            [
                'prefix' => 'MWT-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'ClientArea', 'table' => 'client_areas'],
            [
                'prefix' => 'CLA-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'ClientNote', 'table' => 'client_notes'],
            [
                'prefix' => 'CLN-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'Asset', 'table' => 'assets'],
            [
                'prefix' => 'AST-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'AssetGroup', 'table' => 'asset_groups'],
            [
                'prefix' => 'ASG-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'OperationPosition', 'table' => 'operation_positions'],
            [
                'prefix' => 'OPP-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'ItemCategory', 'table' => 'item_categories'],
            [
                'prefix' => 'ITC-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'CountType', 'table' => 'count_types'],
            [
                'prefix' => 'CT-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'ItemSubCategory', 'table' => 'item_subcategories'],
            [
                'prefix' => 'ITC-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'Variant', 'table' => 'variants'],
            [
                'prefix' => 'VAR-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]

        );


        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'Department', 'table' => 'departments'],
            [
                'prefix' => 'DPT-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]

        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'Designation', 'table' => 'designations'],
            [
                'prefix' => 'DES-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'EmployeeType', 'table' => 'employee_types'],
            [
                'prefix' => 'ETP-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'EmployeeSection', 'table' => 'employee_sections'],
            [
                'prefix' => 'ESC-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        // =========== HR Management Entities ==============

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'SalaryType', 'table' => 'salary_types'],
            [
                'prefix' => 'SAT-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]

        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'Policy', 'table' => 'policies'],
            [
                'prefix' => 'POL-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'AttendanceLog', 'table' => 'attendance_logs'],
            [
                'prefix' => 'ATD-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'EmployeeShift', 'table' => 'employee_shifts'],
            [
                'prefix' => 'ESH-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'EmployeeBlacklist', 'table' => 'employee_blacklists'],
            [
                'prefix' => 'EBL-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'Notice', 'table' => 'notices'],
            [
                'prefix' => 'NOT-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'EmployeeHasAsset', 'table' => 'employee_has_assets'],
            [
                'prefix' => 'EHA-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'LeaveRequest', 'table' => 'leave_requests'],
            [
                'prefix' => 'LR-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'EmployeeGroup', 'table' => 'employee_groups'],
            [
                'prefix' => 'EMG-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'SideBill', 'table' => 'side_bills'],
            [
                'prefix' => 'SBL-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'BonusConfig', 'table' => 'bonus_configs'],
            [
                'prefix' => 'BC-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'Roster', 'table' => 'rosters'],
            [
                'prefix' => 'RST-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'ShiftOverrides', 'table' => 'shift_overrides'],
            [
                'prefix' => 'SHO-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        // ========== store module ==============
        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'ProductionLot', 'table' => 'production_lots'],
            [
                'prefix' => 'LOT-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'ProductionLotCount', 'table' => 'production_lot_counts'],
            [
                'prefix' => 'LOTC-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'YarnTransferAdvice', 'table' => 'yarn_transfer_advices'],
            [
                'prefix' => 'GTN-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'PurchaseRequisition', 'table' => 'purchase_requisitions'],
            [
                'prefix' => 'SPR-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
        // ========== sales module ==============
        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'SalesOrder', 'table' => 'sales_orders'],
            [
                'prefix' => 'PI-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
         // ========== Promotion ==============
        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'Promotion', 'table' => 'promotions'],
            [
                'prefix' => 'PMT-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
        DB::table('id_generator_settings')->updateOrInsert(
            ['entity' => 'PromotionConfiguration', 'table' => 'promotion_configurations'],
            [
                'prefix' => 'PMC-',
                'field' => 'custom_id',
                'length' => 10,
                'reset_on_prefix_change' => 1,
                'is_date_prefix' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }
}
