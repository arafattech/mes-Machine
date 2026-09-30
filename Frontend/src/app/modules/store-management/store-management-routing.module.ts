import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PermissionGuard } from '@app/services/permission-guard/permission.guard';
import { StoreLayoutComponent } from '@store-module/store-layout/store-layout.component';
import { PurchaseOrderComponent } from '@store-module/purchase-order/purchase-order.component';
import { StoreHomeComponent } from '@app/modules/store-management/store-home/store-home.component';
import { PurchaseRequisitionComponent } from '@store-module/purchase-requisition/purchase-requisition.component';
import { LocalMaterialReceiptComponent } from '@store-module/local-material-receipt/local-material-receipt.component';
import { ItemInventoryComponent } from '@store-module/item-inventory/item-inventory.component';
import { IdleInventoryComponent } from '@store-module/idle-inventory/idle-inventory.component';
import { LowStockComponent } from '@store-module/low-stock/low-stock.component';
import { StockLedgerComponent } from '@store-module/stock-ledger/stock-ledger.component';
import { ReturnMrrComponent } from '@store-module/return-mrr/return-mrr.component';
import { ImportedMaterialReceiptComponent } from '@store-module/imported-material-receipt/imported-material-receipt.component';
import { StoreRequisitionComponent } from '@store-module/store-requisition/store-requisition.component';
import { SrRequestComponent } from '@app/modules/store-management/sr-request/sr-request.component';
import { SprRequestsComponent } from '@app/modules/purchese-management/spr-requests/spr-requests.component';
import { ItemReturnComponent } from '@store-module/item-return/item-return.component';
import { ReminderComponent } from '@store-module/reminder/reminder.component';
import { YarnTransferListComponent } from '@store-module/yarn-transfer-management/yarn-transfer-list/yarn-transfer-list.component';
import { SalesDispatchComponent } from '@store-module/sales-dispatch/sales-dispatch.component';
import { RawCottonReceivedComponent } from '@store-module/raw-cotton-received/raw-cotton-received.component';
import { LotManagementComponent } from '@store-module/lot-management/lot-management.component';

import { Permissions } from '@app/shared/enums/permissions';
const routes: Routes = [
  {
    path: '',
    title: 'Store Management',
    component: StoreLayoutComponent,
    // canActivate: [PermissionGuard],
    // data: { permission: Permissions.STORE_ADMIN },
    children: [
      {
        path: 'store-analytics',
        component: StoreHomeComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.STORE_ANALYTICS },
      },
      {
        path: 'purchase-order',
        component: PurchaseOrderComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.STORE_PURCHASE_ORDER },
      },
      {
        path: 'local-material-receipt',
        component: LocalMaterialReceiptComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.STORE_LOCAL_MRR },
      },
      {
        path: 'imported-material-receipt',
        component: ImportedMaterialReceiptComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.STORE_LOCAL_MRR },
      },
      {
        path: 'raw-cotton-received',
        component: RawCottonReceivedComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.STORE_LOCAL_MRR },
      },
      {
        path: 'purchase-requisition',
        component: PurchaseRequisitionComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.STORE_PURCHASE_REQUISITION },
      },
      {
        path: 'store-requisition',
        component: StoreRequisitionComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.STORE_STORE_REQUISITION },
      },
      {
        path: 'sr-requests',
        component: SrRequestComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.STORE_SR_REQUEST },
      },
      {
        path: 'item-return',
        component: ItemReturnComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.STORE_ITEM_RETURN },
      },
      {
        path: 'item-inventory',
        component: ItemInventoryComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.STORE_ITEM_INVENTORY },
      },
      {
        path: 'idle-inventory',
        component: IdleInventoryComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.STORE_IDLE_INVENTORY },
      },
      {
        path: 'low-stock',
        component: LowStockComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.STORE_LOW_STOCK },
      },
      {
        path: 'stock-ledger',
        component: StockLedgerComponent,
      },
      {
        path: 'return-mrr',
        component: ReturnMrrComponent,
      },
      {
        path: 'sales-dispatch',
        component: SalesDispatchComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.STORE_ITEM_INVENTORY },
      },
      {
        path: 'lots',
        component: LotManagementComponent,
      },
      {
        path: 'reminders',
        component: ReminderComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.STORE_REMINDERS },
      },
      {
        path: 'spr-requests',
        component: SprRequestsComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.PURCHESE_SPR_REQUESTS },
      },
      {
        path: 'yarn-transfers',
        component: YarnTransferListComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.STORE_YARN_GRN },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class StoreManagementRoutingModule {}
