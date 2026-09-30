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
    children: [{ path: '**', component: ComingSoonComponent }],
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
    children: [{ path: '**', component: ComingSoonComponent }],
  },
  {
    path: 'store-management',
    title: 'Store Management',
    children: [{ path: '**', component: ComingSoonComponent }],
  },
  {
    path: 'purchase-management',
    title: 'Purchase Management',
    children: [{ path: '**', component: ComingSoonComponent }],
  },

  {
    path: 'sales-management',
    title: 'Sales Management',
    children: [{ path: '**', component: ComingSoonComponent }],
  },

  {
    path: 'not-authorized',
    component: NotAuthorizedComponent,
  },
];
