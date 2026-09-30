import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PermissionGuard } from '@app/services/permission-guard/permission.guard';
import { LayoutComponent } from '@app/modules/purchese-management/layout/layout.component';
import { PurcheseHomeComponent } from '@app/modules/purchese-management/purchese-home/purchese-home.component';
import { PurcheseOrderListComponent } from '@app/modules/purchese-management/purchese-orders/purchese-order-list/purchese-order-list.component';
import { SprRequestsComponent } from '@app/modules/purchese-management/spr-requests/spr-requests.component';
import { SrRequestComponent } from '@app/modules/store-management/sr-request/sr-request.component';
import { Permissions } from '@app/shared/enums/permissions';
import { QuotationManagementComponent } from '@app/modules/purchese-management/quotation-management/quotation-management.component';
import { ComparativeStudyComponent } from '@app/modules/purchese-management/comparative-study/comparative-study.component';
import { SupplierListComponent } from '@app/modules/base-data-management/supplier-management/supplier-list/supplier-list.component';
import { ReminderComponent } from '@app/modules/store-management/reminder/reminder.component';

const routes: Routes = [
  {
    path: '',
    title: 'Purchase Management',
    component: LayoutComponent,
    canActivate: [PermissionGuard],
    data: { permission: Permissions.PURCHESE_ADMIN },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'purchase-analytics' },
      {
        path: 'purchase-analytics',
        component: PurcheseHomeComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.PURCHESE_ANALYTICS },
      },
      {
        path: 'purchase-orders',
        component: PurcheseOrderListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.PURCHESE_ADMIN },
      },
      {
        path: 'spr-requests',
        component: SprRequestsComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.PURCHESE_ADMIN },
      },
      {
        path: 'rf-quotations',
        component: QuotationManagementComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.PURCHESE_ADMIN },
      },
      {
        path: 'comparative-study',
        component: ComparativeStudyComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.PURCHESE_ADMIN },
      },
      {
        path: 'supplier-list',
        component: SupplierListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.PURCHESE_ADMIN },
      },
      {
        path: 'reminders',
        component: ReminderComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.STORE_REMINDERS, context: 'purchase' },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PurcheseManagementRoutingModule {}
