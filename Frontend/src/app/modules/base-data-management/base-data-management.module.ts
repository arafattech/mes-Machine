import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LazyLoadImageModule } from 'ng-lazyload-image';

import { BaseDataManagementRoutingModule } from '@base-data-module/base-data-management-routing.module';
import { MachineStateFormComponent } from '@base-data-module/machine-management/machine-state/machine-state-form/machine-state-form.component';
import { MachineStateListComponent } from '@base-data-module/machine-management/machine-state/machine-state-list/machine-state-list.component';
import { CapacityListComponent } from '@base-data-module/capacity-management/capacity-list/capacity-list.component';
import { CapacityFormComponent } from '@base-data-module/capacity-management/capacity-form/capacity-form.component';
import { HallFormComponent } from '@base-data-module/hall-management/hall-form/hall-form.component';
import { HallListComponent } from '@base-data-module/hall-management/hall-list/hall-list.component';
import { ProductTypeListComponent } from '@base-data-module/product-management/product-type/product-type-list/product-type-list.component';
import { ProductFormComponent } from '@base-data-module/product-management/product-type/product-form/product-form.component';
import { UomFormComponent } from '@base-data-module/product-management/uom/uom-form/uom-form.component';
import { UomListComponent } from '@base-data-module/product-management/uom/uom-list/uom-list.component';
import { OriginListComponent } from '@base-data-module/product-management/origin/origin-list/origin-list.component';
import { OriginFormComponent } from '@base-data-module/product-management/origin/origin-form/origin-form.component';
import { VariantComponent } from '@base-data-module/product-management/variant/variant.component';
import { VariantFormComponent } from '@base-data-module/product-management/variant/variant-form/variant-form.component';
import { PlanningManagementComponent } from '@base-data-module/plant-management/plant-list/planning-management.component';
import { PlantFormComponent } from '@base-data-module/plant-management/plant-form/plant-form.component';
import { MachineGroupListComponent } from '@base-data-module/machine-management/machine-group/machine-group-list/machine-group-list.component';
import { MachineGroupFormComponent } from '@base-data-module/machine-management/machine-group/machine-group-form/machine-group-form.component';
import { MachineWastageTypeListComponent } from '@base-data-module/machine-management/machine-wastage-type/machine-wastage-type-list/machine-wastage-type-list.component';
import { MachineWastageTypeFormComponent } from '@base-data-module/machine-management/machine-wastage-type/machine-wastage-type-form/machine-wastage-type-form.component';
import { MachineProductionTargetListComponent } from '@base-data-module/machine-management/machine-production-target/machine-production-target-list/machine-production-target-list.component';
import { MachineProductionTargetFormComponent } from '@base-data-module/machine-management/machine-production-target/machine-production-target-form/machine-production-target-form.component';
import { StorageLocationFormComponent } from '@base-data-module/storage-management/storage-location/storage-location-form/storage-location-form.component';
import { LocationListComponent } from '@base-data-module/storage-management/storage-location/location-list/location-list.component';
import { UnitsFormComponent } from '@base-data-module/tools-management/handling-units/units-form/units-form.component';
import { UnitsListComponent } from '@base-data-module/tools-management/handling-units/units-list/units-list.component';
import { ItemCategoryListComponent } from '@base-data-module/product-management/item-category/item-category-list/item-category-list.component';
import { CategoryFormComponent } from '@base-data-module/product-management/item-category/category-form/category-form.component';
import { ClientAreaFormComponent } from '@base-data-module/client-management/client-area/client-area-form/client-area-form.component';
import { AreaListComponent } from '@base-data-module/client-management/client-area/area-list/area-list.component';
import { ClientNoteFormComponent } from '@base-data-module/client-management/client-notes/client-note-form/client-note-form.component';
import { NotesListComponent } from '@base-data-module/client-management/client-notes/notes-list/notes-list.component';
import { SharedModule } from '@app/shared/shared.module';
import { AssetListComponent } from '@base-data-module/asset-management/asset-list/asset-list.component';
import { AssetFormComponent } from '@base-data-module/asset-management/asset-form/asset-form.component';
import { AssetGroupListComponent } from '@app/modules/base-data-management/asset-management/asset-group/asset-group-list/asset-group-list.component';
import { AssetGroupFormComponent } from '@base-data-module/asset-management/asset-group/asset-group-form/asset-group-form.component';
import { SubCategoryFormComponent } from '@base-data-module/product-management/item-sub-category/sub-category-form/sub-category-form.component';
import { SubCategoryListComponent } from '@app/modules/base-data-management/product-management/item-sub-category/sub-category-list/sub-category-list.component';
import { SupplierFormModule } from '@base-data-module/supplier-management/supplier-form.module';
import { SupplierListComponent } from '@base-data-module/supplier-management/supplier-list/supplier-list.component';
import { UserFormComponent } from '@base-data-module/user-management/user-form/user-form.component';
import { UserListComponent } from '@base-data-module/user-management/user-list/user-list.component';
import { UserBinListComponent } from '@base-data-module/user-management/user-bin-list/user-bin-list.component';
import { ClientManagementComponent } from '@base-data-module/client-management/client-list/client-management.component';
import { MachineManagementComponent } from '@base-data-module/machine-management/machine-list/machine-management.component';
import { MachineFormComponent } from '@base-data-module/machine-management/machine-form/machine-form.component';
import { OperationManagementFormComponent } from '@base-data-module/oparation-management/operation-management-form/operation-management-form.component';
import { OparationManagementListComponent } from '@base-data-module/oparation-management/oparation-management-list/oparation-management-list.component';
import { BankDetailsComponent } from '@base-data-module/supplier-management/bank-details/bank-details/bank-details.component';
import { BankDetailsListComponent } from '@base-data-module/supplier-management/bank-details/bank-details-list/bank-details-list.component';
import { OperationManagementInfoComponent } from '@base-data-module/oparation-management/operation-management-info/operation-management-info.component';
import { OperationManagementInfoFormComponent } from '@base-data-module/oparation-management/operation-management-info/operation-management-info-form/operation-management-info-form.component';
import { EmployeeFormComponent } from '@base-data-module/employees-management/employee-form/employee-form.component';
import { EmployeeListComponent } from '@base-data-module/employees-management/employee-list/employee-list.component';
import { RolePermissionListComponent } from '@base-data-module/role-permission-management/role-permission-list/role-permission-list.component';
import { RoleFormComponent } from '@base-data-module/role-permission-management/role-form/role-form.component';
import { ProductListComponent } from '@base-data-module/product-management/product-list/product-list.component';
import { ItemFormComponent } from '@base-data-module/product-management/item-form/item-form.component';
import { ItemVariantsComponent } from '@base-data-module/product-management/item-variants/item-variants.component';
import { DepartmentManagementComponent } from '@base-data-module/department-management/department-management.component';
import { MachineConfigComponent } from '@base-data-module/machine-management/machine-config/machine-config.component';
import { CountTypeListComponent } from '@base-data-module/count-type-management/count-type-list/count-type-list.component';
import { CountTypeFormComponent } from '@base-data-module/count-type-management/count-type-form/count-type-form.component';
import { ApproverListComponent } from '@base-data-module/approver-management/approver-list/approver-list.component';
import { ApproverTypeFormComponent } from '@base-data-module/approver-management/approver-type-form/approver-type-form.component';
import { ApproverAssignFormComponent } from '@base-data-module/approver-management/approver-assign-form/approver-assign-form.component';

@NgModule({
  declarations: [
    MachineStateListComponent,
    MachineStateFormComponent,
    CapacityListComponent,
    CapacityFormComponent,
    HallFormComponent,
    HallListComponent,
    ProductTypeListComponent,
    ProductFormComponent,
    UomFormComponent,
    UomListComponent,
    OriginListComponent,
    OriginFormComponent,
    VariantComponent,
    VariantFormComponent,
    PlanningManagementComponent,
    PlantFormComponent,
    MachineGroupListComponent,
    MachineGroupFormComponent,
    MachineWastageTypeListComponent,
    MachineWastageTypeFormComponent,
    MachineProductionTargetListComponent,
    MachineProductionTargetFormComponent,
    StorageLocationFormComponent,
    LocationListComponent,
    UnitsFormComponent,
    UnitsListComponent,
    ItemCategoryListComponent,
    CategoryFormComponent,
    ClientAreaFormComponent,
    AreaListComponent,
    NotesListComponent,
    ClientNoteFormComponent,
    AssetListComponent,
    AssetFormComponent,
    AssetGroupListComponent,
    AssetGroupFormComponent,
    SubCategoryFormComponent,
    SubCategoryListComponent,
    SupplierListComponent,
    UserListComponent,
    UserFormComponent,
    UserBinListComponent,
    ClientManagementComponent,
    MachineManagementComponent,
    MachineFormComponent,
    OperationManagementFormComponent,
    OparationManagementListComponent,
    OperationManagementInfoComponent,
    OperationManagementInfoFormComponent,
    EmployeeListComponent,
    EmployeeFormComponent,
    RolePermissionListComponent,
    RoleFormComponent,
    BankDetailsComponent,
    BankDetailsListComponent,
    ProductListComponent,
    ItemFormComponent,
    ItemVariantsComponent,
    DepartmentManagementComponent,
    MachineConfigComponent,
    CountTypeListComponent,
    CountTypeFormComponent,
    ApproverListComponent,
    ApproverTypeFormComponent,
    ApproverAssignFormComponent,
  ],
  imports: [
    BaseDataManagementRoutingModule,
    SharedModule,
    CommonModule,
    SupplierFormModule,
    LazyLoadImageModule,
],
  exports: [
    SupplierListComponent,
    AssetFormComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class BaseDataManagementModule {}
