import { Routes } from '@angular/router';
import { DashboardComponent } from '@app/dashboard/dashboard.component';
import { LoginComponent } from '@app/shared/components/login/login.component';
import { NotAuthorizedComponent } from '@app/shared/components/not-authorized/not-authorized.component';
import { ComingSoonComponent } from '@app/dashboard/coming-soon/coming-soon.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: DashboardComponent,
  },

  {
    path: 'coming-soon',
    component: ComingSoonComponent,
  },
  {
    path: 'task-management',
    title: 'Task Management',
    loadChildren: () =>
      import('@app/modules/task-management/task-management.module').then(
        (m) => m.TaskManagementModule
      ),
  },
  {
    path: 'production',
    title: 'Production Management',
    loadChildren: () =>
      import('@app/modules/production-management/production.module').then(
        (m) => m.ProductionModule
      ),
  },
  {
    path: 'base-data',
    title: 'Base Data Management',
    loadChildren: () =>
      import(
        '@app/modules/base-data-management/base-data-management.module'
      ).then((m) => m.BaseDataManagementModule),
  },
  {
    path: 'hr-management',
    title: 'HR Management',
    loadChildren: () =>
      import('@app/modules/hr-management/hr-management.module').then(
        (m) => m.HrDataManagementModule
      ),
  },
  {
    path: 'store-management',
    title: 'Store Management',
    loadChildren: () =>
      import('@app/modules/store-management/store-management.module').then(
        (m) => m.StoreManagementModule
      ),
  },
  {
    path: 'purchase-management',
    title: 'Purchase Management',
    loadChildren: () =>
      import(
        '@app/modules/purchese-management/purchese-management.module'
      ).then((m) => m.PurcheseManagementModule),
  },

  {
    path: 'sales-management',
    title: 'Sales Management',
    loadChildren: () =>
      import('@app/modules/sales-management/sales.module').then(
        (m) => m.SalesManagementModule
      ),
  },

  {
    path: 'not-authorized',
    component: NotAuthorizedComponent,
  },
];
