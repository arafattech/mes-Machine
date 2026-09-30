import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgChartsModule } from 'ng2-charts';

import { PurcheseManagementRoutingModule } from './purchese-management-routing.module';
import { LayoutComponent } from '@app/modules/purchese-management/layout/layout.component';
import { PurcheseHomeComponent } from '@app/modules/purchese-management/purchese-home/purchese-home.component';
import { SharedModule } from '@app/shared/shared.module';
import { AngularEditorModule } from '@kolkov/angular-editor';
import { PurcheseOrderListComponent } from '@app/modules/purchese-management/purchese-orders/purchese-order-list/purchese-order-list.component';
import { StoreManagementModule } from '@app/modules/store-management/store-management.module';
import { QuotationManagementComponent } from '@app/modules/purchese-management/quotation-management/quotation-management.component';
import { ComparativeStudyComponent } from '@app/modules/purchese-management/comparative-study/comparative-study.component';
import { SharedBarChartComponent } from '@shared/components/shared-bar-chart/shared-bar-chart.component';
import { SharedDonutChartComponent } from '@shared/components/shared-donut-chart/shared-donut-chart.component';
import { BaseDataManagementModule } from '@app/modules/base-data-management/base-data-management.module';

@NgModule({
  declarations: [
    LayoutComponent,
    PurcheseHomeComponent,
    PurcheseOrderListComponent,
    QuotationManagementComponent,
    ComparativeStudyComponent,
  ],
  imports: [
    CommonModule,
    PurcheseManagementRoutingModule,
    SharedModule,
    AngularEditorModule,
    StoreManagementModule,
    BaseDataManagementModule,
    NgChartsModule,
    SharedBarChartComponent,
    SharedDonutChartComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PurcheseManagementModule {}
