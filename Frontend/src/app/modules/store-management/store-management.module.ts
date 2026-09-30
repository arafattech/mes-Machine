import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgChartsModule } from 'ng2-charts';

import { StoreManagementRoutingModule } from './store-management-routing.module';
import { SharedModule } from '@app/shared/shared.module';
import { AngularEditorModule } from '@kolkov/angular-editor';
import { StoreLayoutComponent } from '@store-module/store-layout/store-layout.component';
import { StoreHomeComponent } from '@app/modules/store-management/store-home/store-home.component';
import { PurchaseOrderComponent } from '@store-module/purchase-order/purchase-order.component';
import { PurchaseRequisitionComponent } from '@store-module/purchase-requisition/purchase-requisition.component';
import { LocalMaterialReceiptComponent } from '@store-module/local-material-receipt/local-material-receipt.component';
import { ItemInventoryComponent } from '@store-module/item-inventory/item-inventory.component';
import { IdleInventoryComponent } from '@store-module/idle-inventory/idle-inventory.component';
import { LowStockComponent } from '@store-module/low-stock/low-stock.component';
import { StockLedgerComponent } from '@store-module/stock-ledger/stock-ledger.component';
import { ReturnMrrComponent } from '@store-module/return-mrr/return-mrr.component';
import { RequisitionFromComponent } from '@store-module/purchase-requisition/requisition-from/requisition-from.component';
import { StoreRequisitionComponent } from '@store-module/store-requisition/store-requisition.component';
import { MRRFromComponent } from '@store-module/local-material-receipt/mrr-from/mrr-from.component';
import { ReceiveQtyFormComponent } from '@store-module/local-material-receipt/receive-qty-form/receive-qty-form.component';
import { ItemDetailsComponent } from '@store-module/item-inventory/item-details/item-details.component';
import { SrRequestComponent } from '@app/modules/store-management/sr-request/sr-request.component';
import { ImportedMaterialReceiptComponent } from '@store-module/imported-material-receipt/imported-material-receipt.component';
import { SprRequestsComponent } from '@app/modules/purchese-management/spr-requests/spr-requests.component';
import { ItemReturnComponent } from '@store-module/item-return/item-return.component';
import { ItemReturnFormComponent } from '@store-module/item-return/item-return-form/item-return-form.component';
import { ReminderComponent } from '@store-module/reminder/reminder.component';
import { ReminderFormComponent } from '@store-module/reminder/reminder-form/reminder-form.component';
import { YarnTransferListComponent } from '@store-module/yarn-transfer-management/yarn-transfer-list/yarn-transfer-list.component';
import { YarnAdviceFormComponent } from '@store-module/yarn-transfer-management/yarn-advice-form/yarn-advice-form.component';
import { SalesDispatchComponent } from '@store-module/sales-dispatch/sales-dispatch.component';
import { LotManagementComponent } from '@store-module/lot-management/lot-management.component';
import { SharedBarChartComponent } from '@shared/components/shared-bar-chart/shared-bar-chart.component';
import { SharedDonutChartComponent } from '@shared/components/shared-donut-chart/shared-donut-chart.component';
import { SharedLineChartComponent } from '@shared/components/shared-line-chart/shared-line-chart.component';
import { SharedActivityHeatmapComponent } from '@shared/components/shared-activity-heatmap/shared-activity-heatmap.component';
import { SupplierFormModule } from '@base-data-module/supplier-management/supplier-form.module';
import { RawCottonReceivedComponent } from '@store-module/raw-cotton-received/raw-cotton-received.component';

@NgModule({
  declarations: [
    StoreLayoutComponent,
    StoreHomeComponent,
    PurchaseOrderComponent,
    PurchaseRequisitionComponent,
    LocalMaterialReceiptComponent,
    ItemInventoryComponent,
    IdleInventoryComponent,
    LowStockComponent,
    StockLedgerComponent,
    ReturnMrrComponent,
    RequisitionFromComponent,
    StoreRequisitionComponent,
    MRRFromComponent,
    ReceiveQtyFormComponent,
    ItemDetailsComponent,
    SrRequestComponent,
    ImportedMaterialReceiptComponent,
    SprRequestsComponent,
    ItemReturnComponent,
    ItemReturnFormComponent,
    ReminderComponent,
    ReminderFormComponent,
    YarnTransferListComponent,
    YarnAdviceFormComponent,
    SalesDispatchComponent,
    RawCottonReceivedComponent,
    LotManagementComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    CommonModule,
    AngularEditorModule,
    StoreManagementRoutingModule,
    SharedBarChartComponent,
    SharedDonutChartComponent,
    SharedLineChartComponent,
    SharedActivityHeatmapComponent,
    SupplierFormModule,
  ],
  exports: [RequisitionFromComponent, SharedDonutChartComponent, PurchaseOrderComponent, SprRequestsComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class StoreManagementModule {}
