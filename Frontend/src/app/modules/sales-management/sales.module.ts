import { CommonModule } from '@angular/common';
import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { SharedModule } from '@app/shared/shared.module';
import { SalesModuleRoutes } from '@app/modules/sales-management/sales.route';
import { SalesDashboard } from '@app/modules/sales-management/dashboard/sales-analytics.component';
import { PricingPlanComponent } from '@sales-module/pricing-plan/pricing-plan.component';
import { SalesOrderComponent } from '@sales-module/sales-order/sales-order.component';
import { SalesRequestComponent } from '@app/modules/sales-management/sales-request/sales-request.component';
import { PricingFormComponent } from '@sales-module/pricing-plan/pricing-form/pricing-form.component';
import { OrderFormComponent } from '@sales-module/sales-order/order-form/order-form.component';
import { AuditTrailComponent } from '@sales-module/audit-trail/audit-trail.component';
import { ExpiredSalesOrderComponent } from '@sales-module/expired-sales-order/expired-sales-order.component';
import { MarketPriceHistoryComponent } from '@sales-module/market-price-history/market-price-history.component';
import { CdkDropList } from "@angular/cdk/drag-drop";
import { MarketAnalysisChartComponent } from "./shared/components/market-analysis-chart/market-analysis-chart.component.js";
import { SharedBarChartComponent } from '@shared/components/shared-bar-chart/shared-bar-chart.component';
import { SharedDonutChartComponent } from '@shared/components/shared-donut-chart/shared-donut-chart.component';
import { SalesForecastChartComponent } from '@sales-module/shared/components/sales-forecast-chart/sales-forecast-chart.component';
import { SalesForecastCandlestickChartComponent } from '@sales-module/shared/components/sales-forecast-candlestick-chart/sales-forecast-candlestick-chart.component';
import { SalesForecastComponent } from '@sales-module/forecast/sales-forecast.component';

@NgModule({
  declarations: [
    SalesDashboard,
    PricingPlanComponent,
    PricingFormComponent,
    SalesDashboard,
    PricingPlanComponent,
    SalesOrderComponent,
    SalesRequestComponent,
    OrderFormComponent,
    AuditTrailComponent,
    ExpiredSalesOrderComponent,
    MarketPriceHistoryComponent,
    MarketAnalysisChartComponent,
    SalesForecastChartComponent,
    SalesForecastCandlestickChartComponent,
    SalesForecastComponent
  ],

  imports: [SalesModuleRoutes, SharedModule, CommonModule, SharedDonutChartComponent, SharedBarChartComponent, CdkDropList],
  exports: [MarketAnalysisChartComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SalesManagementModule {}
