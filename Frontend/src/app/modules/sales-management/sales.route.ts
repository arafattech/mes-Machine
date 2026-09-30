import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SalesLayout } from './layout/sales-layout.component';
import { PermissionGuard } from '@app/services/permission-guard/permission.guard';
import { SalesDashboard } from '@app/modules/sales-management/dashboard/sales-analytics.component';
import { PricingPlanComponent } from '@app/modules/sales-management/pricing-plan/pricing-plan.component';
import { SalesOrderComponent } from './sales-order/sales-order.component';
import { SalesRequestComponent } from '@app/modules/sales-management/sales-request/sales-request.component';
import { AuditTrailComponent } from '@sales-module/audit-trail/audit-trail.component';
import { ExpiredSalesOrderComponent } from '@sales-module/expired-sales-order/expired-sales-order.component';
import { MarketPriceHistoryComponent } from '@sales-module/market-price-history/market-price-history.component';
import { SalesForecastComponent } from '@sales-module/forecast/sales-forecast.component';
import { Permissions } from '@app/shared/enums/permissions';
const routes: Routes = [
  {
    path: '',
    title: 'Sales Management',
    component: SalesLayout,
    canActivate: [PermissionGuard],
    data: { permission: Permissions.SALES_ADMIN },
    children: [
      {
        path: 'sales-analytics',
        component: SalesDashboard,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.SALES_ANALYTICS },
      },
      {
        path: 'pricing-plan',
        component: PricingPlanComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.SALES_PRICING_PLAN },
      },

      {
        path: 'sales-orders',
        component: SalesOrderComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.SALES_SALES_ORDERS },
      },
      {
        path: 'sales-requests',
        component: SalesRequestComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.SALES_SALES_REQUESTS },
      },
      {
        path: 'audit-trail',
        component: AuditTrailComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.SALES_SALES_REQUESTS },
      },
      {
        path: 'expired-sales-orders',
        component: ExpiredSalesOrderComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.SALES_EXPIRED_SALES_ORDERS },
      },
      {
        path: 'market-price-history',
        component: MarketPriceHistoryComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.SALES_MARKET_PRICE_HISTORY },
      },
      {
        path: 'sales-forecast',
        component: SalesForecastComponent,
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SalesModuleRoutes {}
