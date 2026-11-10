import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProductListComponent } from '@app/modules/base-data-management/product-management/product-list/product-list.component';
import { HomeDataManagementComponent } from '@app/modules/base-data-management/home-data-management/home-data-management.component';
import { RolePermissionListComponent } from '@app/modules/base-data-management/role-permission-management/role-permission-list/role-permission-list.component';
import { EmployeeListComponent } from '@app/modules/base-data-management/employees-management/employee-list/employee-list.component';
import { MachineManagementComponent } from '@app/modules/base-data-management/machine-management/machine-list/machine-management.component';
import { PlanningManagementComponent } from '@app/modules/base-data-management/plant-management/plant-list/planning-management.component';
import { ClientManagementComponent } from '@app/modules/base-data-management/client-management/client-list/client-management.component';
import { UserListComponent } from '@app/modules/base-data-management/user-management/user-list/user-list.component';
import { UserBinListComponent } from '@app/modules/base-data-management/user-management/user-bin-list/user-bin-list.component';
import { SupplierListComponent } from '@app/modules/base-data-management/supplier-management/supplier-list/supplier-list.component';
import { PermissionGuard } from '@app/services/permission-guard/permission.guard';
import { LogListComponent } from '@app/modules/base-data-management/activity-management/log-list/log-list.component';
import { LoginActivityListComponent } from '@app/modules/base-data-management/activity-management/login-activity-list/login-activity-list.component';
import { OparationManagementListComponent } from '@app/modules/base-data-management/oparation-management/oparation-management-list/oparation-management-list.component';
import { ProductTypeListComponent } from '@app/modules/base-data-management/product-management/product-type/product-type-list/product-type-list.component';
import { LocationListComponent } from '@app/modules/base-data-management/storage-management/storage-location/location-list/location-list.component';
import { UnitsListComponent } from '@app/modules/base-data-management/tools-management/handling-units/units-list/units-list.component';
import { CapacityListComponent } from '@app/modules/base-data-management/capacity-management/capacity-list/capacity-list.component';
import { HallListComponent } from '@app/modules/base-data-management/hall-management/hall-list/hall-list.component';
import { AreaListComponent } from '@app/modules/base-data-management/client-management/client-area/area-list/area-list.component';
import { NotesListComponent } from '@app/modules/base-data-management/client-management/client-notes/notes-list/notes-list.component';
import { MachineStateListComponent } from '@app/modules/base-data-management/machine-management/machine-state/machine-state-list/machine-state-list.component';
import { MachineGroupListComponent } from '@app/modules/base-data-management/machine-management/machine-group/machine-group-list/machine-group-list.component';
import { MachineWastageTypeListComponent } from '@app/modules/base-data-management/machine-management/machine-wastage-type/machine-wastage-type-list/machine-wastage-type-list.component';
import { MachineProductionTargetListComponent } from '@app/modules/base-data-management/machine-management/machine-production-target/machine-production-target-list/machine-production-target-list.component';
import { OperationManagementInfoComponent } from '@app/modules/base-data-management/oparation-management/operation-management-info/operation-management-info.component';
import { AssetListComponent } from '@app/modules/base-data-management/asset-management/asset-list/asset-list.component';
import { AssetGroupListComponent } from '@app/modules/base-data-management/asset-management/asset-group/asset-group-list/asset-group-list.component';
import { BankDetailsListComponent } from '@app/modules/base-data-management/supplier-management/bank-details/bank-details-list/bank-details-list.component';
import { ItemCategoryListComponent } from '@app/modules/base-data-management/product-management/item-category/item-category-list/item-category-list.component';
import { UomListComponent } from '@app/modules/base-data-management/product-management/uom/uom-list/uom-list.component';
import { OriginListComponent } from '@app/modules/base-data-management/product-management/origin/origin-list/origin-list.component';
import { SubCategoryListComponent } from '@app/modules/base-data-management/product-management/item-sub-category/sub-category-list/sub-category-list.component';
import { BaseDataManagementLayoutComponent } from '@app/modules/base-data-management/layout/base-data-management-layout/base-data-management-layout.component';
import { VariantComponent } from '@app/modules/base-data-management/product-management/variant/variant.component';
import { ItemVariantsComponent } from '@base-data-module/product-management/item-variants/item-variants.component';
import { DepartmentManagementComponent } from '@app/modules/base-data-management/department-management/department-management.component';
import { Permissions } from '@app/shared/enums/permissions';
import { MachineConfigComponent } from './machine-management/machine-config/machine-config.component';
import { ScheduleFrequencyListComponent } from '@app/modules/base-data-management/machine-management/schedule-frequency/schedule-frequency-list/schedule-frequency-list.component';
import { DesignationManagementComponent } from '@app/modules/hr-management/designation-management/designation-management.component';
import { EmployeeTypeManagementComponent } from '@app/modules/hr-management/employee-type-management/employee-type-management.component';
import { CountTypeListComponent } from '@app/modules/base-data-management/count-type-management/count-type-list/count-type-list.component';
import { ApproverListComponent } from '@app/modules/base-data-management/approver-management/approver-list/approver-list.component';


const routes: Routes = [
  {
    path: '',
    title: 'Base Data Management',
    component: BaseDataManagementLayoutComponent,
    canActivate: [PermissionGuard],
    data: { permission: Permissions.BASE_DATA_ADMIN },
    children: [
      {
        path: '',
        component: HomeDataManagementComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_ADMIN },
      },
      {
        path: 'products',
        component: ProductListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_ITEM },
      },
      {
        path: 'item-variants',
        component: ItemVariantsComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_ITEM_VARIANTS_LIST },
      },
      {
        path: 'product-type',
        component: ProductTypeListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_ITEM_TYPE_LIST },
      },
      {
        path: 'item-categories',
        component: ItemCategoryListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_ITEM_CATEGORIES },
      },
      {
        path: 'variant-list',
        component: VariantComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_VARIANT },
      },
      {
        path: 'item-subcategories',
        component: SubCategoryListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_ITEM_SUBCATEGORIES },
      },
      {
        path: 'uom-list',
        component: UomListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_UOM_LIST },
      },
      {
        path: 'origin-list',
        component: OriginListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_ORIGIN_LIST },
      },
      {
        path: 'employees',
        component: EmployeeListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_EMPLOYEE },
      },
      {
        path: 'machines',
        component: MachineManagementComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_MACHINE },
      },
      {
        path: 'plants',
        component: PlanningManagementComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_PLANT },
      },
      {
        path: 'client',
        component: ClientManagementComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_CLIENT },
      },
      {
        path: 'roles-permissions',
        component: RolePermissionListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_ROLE_PERMISSION },
      },
      {
        path: 'user-management',
        component: UserListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_USER_LIST },
      },
      {
        path: 'user-bin',
        component: UserBinListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_USER_BIN },
      },
      {
        path: 'supplier',
        component: SupplierListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_SUPPLIER },
      },
      {
        path: 'supplier-bank',
        component: BankDetailsListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_SUPPLIER_BANK_DETAILS },
      },
      {
        path: 'activity-log',
        component: LogListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_ACTIVITY_LOG },
      },
      {
        path: 'user-activity',
        component: LoginActivityListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_USER_ACTIVITY },
      },
      {
        path: 'operations',
        component: OparationManagementListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_OPERATION },
      },

      {
        path: 'storage-location',
        component: LocationListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_STORAGE_LOCATION },
      },
      {
        path: 'handling-units',
        component: UnitsListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_HANDING_UNITS },
      },
      {
        path: 'capacity',
        component: CapacityListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_CAPACITY },
      },
      {
        path: 'hall',
        component: HallListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_HALL },
      },
      {
        path: 'client-area',
        component: AreaListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_CLIENT_AREAS },
      },
      {
        path: 'machine-state',
        component: MachineStateListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_MACHINE_STATE },
      },
      {
        path: 'machine-group',
        component: MachineGroupListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_MACHINE_GROUP },
      },
      {
        path: 'machine-wastage-type',
        component: MachineWastageTypeListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_MACHINE_WASTAGE_TYPE },
      },
      {
        path: 'machine-production-target',
        component: MachineProductionTargetListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_MACHINE_PRODUCTION_TARGET },
      },
      {
        path: 'schedule-frequency',
        component: ScheduleFrequencyListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.PRODUCTION_ADMIN },
      },
      {
        path: 'machine-config',
        component: MachineConfigComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_MACHINE_CONFIG },
      },
      {
        path: 'client-note',
        component: NotesListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_CLIENT_NOTE },
      },
      {
        path: 'operation-info/:id',
        component: OperationManagementInfoComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_OPERATION_INFO },
      },
      {
        path: 'asset-list',
        component: AssetListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_ASSET },
      },
      {
        path: 'asset-group',
        component: AssetGroupListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_ASSET_GROUP },
      },

      {
        path: 'departments',
        component: DepartmentManagementComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_DEPARTMENT },
      },
      {
        path: 'count-types',
        component: CountTypeListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_COUNT_TYPE },
      },
      {
        path: 'approver-management',
        component: ApproverListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_APPROVER },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BaseDataManagementRoutingModule {}
