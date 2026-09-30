import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PermissionGuard } from '@app/services/permission-guard/permission.guard';
import { Permissions } from '@app/shared/enums/permissions';
import { LayoutComponent } from '@production-module/layout/layout.component';
import { MachineBoardComponent } from '@production-module/machine-board/machine-board.component';
import { ProductionLogListComponent } from '@production-module/production-plan-log/Production-logs/production-log-list/production-log-list.component';
import { WastageLogListComponent } from '@production-module/production-plan-log/wastage-logs/wastage-log-list/wastage-log-list.component';
import { WorkOrderListComponent } from '@production-module/production-plan-log/work-order-management/work-order-list/work-order-list.component';
import { ProductionLotListComponent } from '@production-module/production-plan-log/production-lot-management/production-lot-list/production-lot-list.component';
import { MachineOverviewComponent } from '@production-module/shared/components/machine-overview/machine-overview.component';
import { MachineMaintenanceListComponent } from '@production-module/machine-maintenance/machine-maintenance-list/machine-maintenance-list.component';
import { MachineMaintenanceScheduleListComponent } from '@production-module/machine-maintenance-schedule/machine-maintenance-schedule-list/machine-maintenance-schedule-list.component';

const routes: Routes = [
  {
    title: 'Production Management',
    path: '',
    component: LayoutComponent,
    canActivate: [PermissionGuard],
    data: { permission: Permissions.PRODUCTION_ADMIN },
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: MachineBoardComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.PRODUCTION_DASHBOARD },
      },      
      {
        path: 'production',
        pathMatch: 'full',
        component: MachineBoardComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.PRODUCTION_DASHBOARD },
      },
      {
        path: 'production-log',
        pathMatch: 'full',
        component: ProductionLogListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.PRODUCTION_LOG },
      },
      {
        path: 'wastage-log',
        pathMatch: 'full',
        component: WastageLogListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.WASTAGE_LOG },
      },
      {
        path: 'work-orders',
        pathMatch: 'full',
        component: WorkOrderListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.BASE_DATA_WORK_ORDER },
      },
      {
        path: 'machine-maintenance',
        pathMatch: 'full',
        component: MachineMaintenanceListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.PRODUCTION_ADMIN },
      },
      {
        path: 'machine-maintenance-schedule',
        pathMatch: 'full',
        component: MachineMaintenanceScheduleListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.PRODUCTION_ADMIN },
      },
      {
        path: 'production-lots',
        pathMatch: 'full',
        component: ProductionLotListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.PRODUCTION_LOT },
      },
    ],
  },
  {
    path: 'mco',
    pathMatch: 'full',
    component: MachineOverviewComponent,
    canActivate: [PermissionGuard],
    data: { permission: Permissions.PRODUCTION_ADMIN },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ProductionRoutingModule {}
