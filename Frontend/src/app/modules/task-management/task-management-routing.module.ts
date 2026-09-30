import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PermissionGuard } from '@app/services/permission-guard/permission.guard';
import { TaskHomeDataManagementComponent } from '@app/modules/task-management/task-home-data-management/task-home-data-management.component';
import { BankDetailsListComponent } from '@app/modules//base-data-management/supplier-management/bank-details/bank-details-list/bank-details-list.component';
import { TaskDataManagementComponent } from '@app/modules/task-management/layout/task-data-management/task-data-management.component';
import { Permissions } from '@app/shared/enums/permissions';
const routes: Routes = [
  {
    title: 'Task Management',
    path: '',
    component: TaskDataManagementComponent,
    canActivate: [PermissionGuard],
    data: { permission: Permissions.TASK_ADMIN },
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: TaskHomeDataManagementComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.TASK_DASHBOARD },
      },
      {
        path: 'my-tasks',
        component: BankDetailsListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.TASK_ADMIN },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TaskManagementRoutingModule {}
