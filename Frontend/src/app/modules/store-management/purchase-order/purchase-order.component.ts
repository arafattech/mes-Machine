import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridActionCellRendererComponent,
  AgGridStatusBadgeComponent,
} from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component';
import {
  AgGridTableColumn,
  AgGridTableRowAction,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  AgGridTableDisplayConfig,
  GridTableColumnDataType,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { Permissions } from '@app/shared/enums/permissions';
import { DateFormatterService } from '@app/shared/utilities/date-format';
import { Localization } from '@shared/utilities/localization';
import { PurchaseOrderStatus } from '@store-module/shared/enum/purchase-order-status';
import { PurchaseOrder } from '@store-module/shared/model/purchaseOrder';
import { firstValueFrom } from 'rxjs';
import { ValueState } from '@shared/utilities/value-state-wrapper';

@Component({
  selector: 'app-purchase-order',
  templateUrl: './purchase-order.component.html',
  styleUrl: './purchase-order.component.scss',
})
export class PurchaseOrderComponent implements OnInit {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<any>;
  @Input() readOnly = true;
  @Input() usePurchasePermissions = false;
  public permissions = Permissions;
  public valueState = ValueState;
  public localization = Localization;
  public validationMessage = Localization.requiredField;
  public open = false;
  public loading = false;
  public saveMode: 'POST' | 'PUT' = 'POST';
  public selectedData: any;
  public requisitions: any[] = [];
  public suppliers: any[] = [];
  public po: any = { items: [], status: PurchaseOrderStatus.PENDING };

  valueStateOptions = {
    suppliers: ValueState.None,
  };
  public segmentButtonItems = [
    { id: 'approved', name: 'Approved', defaultSelect: true },
    { id: 'canceled', name: 'Canceled' },
    { id: 'pending', name: 'Pending' },
  ];
  public statusOptions = [
    { value: PurchaseOrderStatus.PENDING, label: 'Pending' },
    { value: PurchaseOrderStatus.APPROVED, label: 'Approved' },
    { value: PurchaseOrderStatus.CANCELED, label: 'Canceled' },
  ];
  itemColumns: AgGridTableColumn<any>[] = [];
  itemsDataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };
  itemsToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Items`,
    showRowCount: true,
    showSearch: true,
    showNewButton: false,
    showDownload: false,
  };
  itemsDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 550px)',
  };

  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: 'PurchaseOrders',
    expand:
      'requestBy,department,supplier,requisition,quote,poItems($expand=item($expand=category,uom))',
    searchFields: ['custom_id', 'supplier.name', 'requisition.custom_id'],
    pageSize: 40,
    sortBy: 'custom_id',
    sortDirection: 'desc',
    filter: `status eq '${PurchaseOrderStatus.APPROVED}'`,
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Purchase List`,
    showRowCount: true,
    showSearch: true,
    showNewButton: false,
    addButtonText: $localize`New`,
    showDownload: false,
    showSegmentButton: false,
  };
  displayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 118px)',
  };

  private buildColumns(): AgGridTableColumn<any>[] {
    const rowActions: AgGridTableRowAction<any>[] = [];

    if (this.canView) {
      rowActions.push({
        id: 'view',
        label: '',
        icon: 'information',
        tooltip: $localize`View Details`,
        design: 'Default',
      });
    }

    const cols: AgGridTableColumn<any>[] = [
      {
        field: 'custom_id',
        headerName: $localize`PI No`,
        minWidth: 120,
        width: 140,
      },
      {
        colId: 'requisition.custom_id',
        headerName: $localize`SPR No`,
        minWidth: 130,
        width: 150,
        sortable: false,
        valueGetter: (params: any) => params.data?.requisition?.custom_id ?? '',
      },
      {
        colId: 'supplier.name',
        headerName: $localize`Supplier`,
        minWidth: 140,
        flex: 1,
        sortable: false,
        valueGetter: (params: any) => params.data?.supplier?.name ?? '',
      },
      {
        field: 'po_date',
        headerName: $localize`PI Date`,
        minWidth: 130,
        width: 140,
        dataType: GridTableColumnDataType.Date,
        valueFormatter: ({ value }: any) =>
          value
            ? this.dateFormatter.formatDate(value, true, false, false, false, false)
            : '',
      },
      {
        field: 'total_amount',
        headerName: $localize`Total Amount`,
        minWidth: 160,
        width: 160,
      },
      {
        field: 'status',
        headerName: $localize`Status`,
        minWidth: 120,
        width: 130,
        sortable: false,
        filter: false,
        floatingFilter: false,
        valueGetter: (params: any) => this.normalizeStatus(params.data?.status),
        cellRenderer: AgGridStatusBadgeComponent,
      },
      {
        colId: 'is_complete',
        headerName: $localize`Complete`,
        minWidth: 100,
        width: 110,
        sortable: false,
        filter: false,
        floatingFilter: false,
        valueGetter: (params: any) =>
          params.data?.is_complete ? 'COMPLETED' : 'PENDING',
        cellRenderer: AgGridStatusBadgeComponent,
      },
      {
        colId: 'order_type',
        headerName: $localize`Order Type`,
        minWidth: 120,
        width: 130,
        sortable: false,
        cellRenderer: AgGridStatusBadgeComponent,
        valueGetter: (params: any) => (params.data?.is_imported ? 'FOREIGN' : 'LOCAL'),
      },
    ];

    cols.push({
      field: 'actions',
      headerName: $localize`Actions`,
      width: 140,
      minWidth: 90,
      pinned: 'right',
      lockPinned: true,
      sortable: false,
      filter: false,
      floatingFilter: false,
      editable: false,
      cellRenderer: AgGridActionCellRendererComponent,
      cellRendererParams: {
        actions: rowActions,
        onAction: (actionId: string, row: any) => {
          if (actionId === 'view') this.viewItem(row);
        },
      },
    });

    return cols;
  }

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
    public rolePermissionService: RolePermissionService,
    private dateFormatter: DateFormatterService,
  ) {
    this.loadDependencies();
  }

  ngOnInit(): void {
    this.columns = this.buildColumns();
    this.itemColumns = this.buildItemColumns();
    this.toolbarConfig = {
      ...this.toolbarConfig,
      showNewButton: this.canCreate,
    };
  }

  segmentButtonChange($event: any): void {
    const selectedId = $event?.id ?? $event?.value;
    let filter: string;
    switch (selectedId) {
      case 'canceled':
        filter = `status eq '${PurchaseOrderStatus.CANCELED}'`;
        break;
      case 'pending':
        filter = `status eq '${PurchaseOrderStatus.PENDING}'`;
        break;
      default:
        filter = `status eq '${PurchaseOrderStatus.APPROVED}'`;
    }
    this.dataSource = { ...this.dataSource, filter };
  }

  get isFormLocked(): boolean {
    return (
      this.readOnly ||
      String(this.po?.status ?? '').toUpperCase() === 'APPROVED'
    );
  }

  get isPending(): boolean {
    return (
      String(this.po?.status ?? '').toUpperCase() ===
      PurchaseOrderStatus.PENDING
    );
  }

  get canView(): boolean {
    return this.usePurchasePermissions
      ? this.rolePermissionService.hasPermission(
          this.permissions.PURCHESE_ADMIN,
        )
      : this.rolePermissionService.hasPermission(
          this.permissions.STORE_PURCHASE_ORDER_VIEW,
        );
  }

  get canCreate(): boolean {
    if (this.readOnly) {
      return false;
    }

    return this.usePurchasePermissions
      ? this.rolePermissionService.hasPermission(
          this.permissions.PURCHESE_ADMIN,
        )
      : this.rolePermissionService.hasPermission(
          this.permissions.STORE_PURCHASE_ORDER_CREATE,
        );
  }

  get dialogHeaderText(): string {
    if (this.readOnly) {
      return $localize`Purchase Order Details`;
    }

    return this.saveMode === 'POST'
      ? $localize`Create Purchase Order`
      : $localize`Purchase Order Details`;
  }

  get requisitionDisplayValue(): string {
    const requisition =
      this.po?.requisition ??
      this.requisitions.find((item: any) => item.id === this.po?.spr_id);
    const requisitionId = requisition?.custom_id ?? '';
    const departmentName =
      requisition?.department?.name ?? this.po?.department?.name ?? '';

    if (!requisitionId) {
      return '';
    }

    return departmentName
      ? `${requisitionId} | ${departmentName}`
      : requisitionId;
  }

  private buildItemColumns(): AgGridTableColumn<any>[] {
    return [
      {
        field: 'item_code',
        headerName: $localize`Item Code`,
        width: 140,
      },
      {
        field: 'product_name',
        headerName: $localize`Name`,
        flex: 1,
      },
      {
        field: 'quantity',
        headerName: $localize`Qty`,
        width: 120,
        dataType: GridTableColumnDataType.IntegerField,
        editable: !this.readOnly,
        minValue: 0,
      },
      {
        field: 'unit_price',
        headerName: $localize`Unit Price`,
        width: 140,
        dataType: GridTableColumnDataType.IntegerField,
        editable: !this.readOnly,
        minValue: 0,
      },
      {
        field: 'delivery_date',
        headerName: $localize`Delivery Date`,
        width: 160,
        dataType: GridTableColumnDataType.InputField,
        editable: !this.readOnly,
      },
    ];
  }

  async newItem() {
    const customId = await this.getNextPurchaseOrderId();
    this.saveMode = 'POST';
    this.po = {
      items: [],
      status: PurchaseOrderStatus.PENDING,
      custom_id: customId,
    };
    this.open = true;
    this.syncItemsGrid();
  }

  viewItem(event: any) {
    this.saveMode = 'PUT';
    this.selectedData = event;
    this.po = {
      ...event,
      spr_id: event.spr_id,
      status: this.normalizeStatus(event.status),
      items: (event.poItems ?? []).map((item: any) => ({
        product_id: item.product_id,
        item_code: item.item?.item_code,
        product_name: item.item?.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        delivery_date: item.delivery_date,
      })),
    };
    this.open = true;
    this.syncItemsGrid();
  }

  onRequisitionChange(event: any) {
    const id = Number(event.detail.item?.id);
    const requisition = this.requisitions.find((item: any) => item.id === id);
    if (!requisition) return;

    this.po.spr_id = requisition.id;
    this.po.department_id = requisition.department_id;
    this.po.requisition = requisition;
    this.po.department = requisition.department;
    this.po.items = (requisition.sprItems ?? [])
      .map((item: any) => ({
        product_id: item.product_id ?? item.item?.id,
        item_code: item.item?.item_code ?? '',
        product_name: item.item?.product_name ?? '',
        quantity: Number(item.approved_qty ?? item.required_quantity ?? 0),
        unit_price: Number(item.total_price ?? item.item?.unit_price ?? 0),
        delivery_date: null,
      }))
      .filter((item: any) => Number(item.quantity ?? 0) > 0);
    this.syncItemsGrid();
  }

  onSupplierChange(event: any) {
    this.po.supplier_id = Number(event.detail.item?.id);
  }

  onStatusChange(event: any) {
    const selectedId = event?.detail?.item?.id ?? event?.detail?.item?.value;
    this.po.status = this.normalizeStatus(selectedId ?? this.po.status);
  }

  savePo() {
    if (!this.Validation()) {
      this.toastService.show('error');
      return;
    }
    this.loading = true;
    this.po.items = (this.po.items ?? []).filter(
      (item: any) => Number(item.quantity ?? 0) > 0,
    );
    this.po.status = this.normalizeStatus(this.po.status);

    if (!this.po.spr_id || !this.po.supplier_id || this.po.items.length === 0) {
      this.loading = false;
      this.toastService.show('error');
      return;
    }

    const purchaseOrder = new PurchaseOrder().deserialize({
      ...this.po,
      mode: this.saveMode,
    });

    const request$ =
      this.saveMode === 'POST'
        ? this.commonService.post(
            'purchase/orders',
            purchaseOrder.toOdata(),
            false,
          )
        : this.commonService.put(
            `purchase/orders/${this.selectedData.id}`,
            purchaseOrder.toOdata(),
            false,
          );

    request$.subscribe({
      next: () => {
        this.loading = false;
        this.toastService.show(this.saveMode === 'POST' ? 'add' : 'edit');
        this.CloseDialog();
        this.agGridRef?.refreshGridData(true);
      },
      error: () => {
        this.loading = false;
        this.toastService.show('error');
      },
    });
  }

  approvePo(): void {
    this.changeOrderStatus(PurchaseOrderStatus.APPROVED);
  }

  rejectPo(): void {
    this.changeOrderStatus(PurchaseOrderStatus.CANCELED);
  }

  private changeOrderStatus(status: string): void {
    if (!this.selectedData?.id) return;
    this.loading = true;
    this.commonService
      .post(
        `purchase/orders/${this.selectedData.id}/approve`,
        { status },
        false,
      )
      .subscribe({
        next: () => {
          this.loading = false;
          this.toastService.show('edit');
          this.CloseDialog();
          this.agGridRef?.refreshGridData(true);
        },
        error: () => {
          this.loading = false;
          this.toastService.show('error');
        },
      });
  }

  CloseDialog() {
    this.open = false;
    this.loading = false;
  }

  syncItemsGrid(): void {
    this.itemsDataSource = {
      ...this.itemsDataSource,
      data: [...(this.po.items ?? [])],
    };
  }

  private loadDependencies() {
    this.commonService
      .get(
        "PurchaseRequisitions?$filter=status eq 'APPROVED' and type eq 'SPR'&$expand=department,sprItems($expand=item)",
      )
      .subscribe((res: any) => {
        this.requisitions = res.value ?? [];
      });

    this.commonService.get('Suppliers').subscribe((res: any) => {
      this.suppliers = res.value ?? [];
    });
  }

  private normalizeStatus(status: string): string {
    const value = String(status ?? '').toUpperCase();

    if (value === PurchaseOrderStatus.COMPLETED)
      return PurchaseOrderStatus.APPROVED;
    if (
      value === PurchaseOrderStatus.REJECTED ||
      value === PurchaseOrderStatus.PARTIAL
    )
      return PurchaseOrderStatus.CANCELED;
    if (
      value === PurchaseOrderStatus.APPROVED ||
      value === PurchaseOrderStatus.CANCELED ||
      value === PurchaseOrderStatus.PENDING
    )
      return value;

    return PurchaseOrderStatus.PENDING;
  }

  public formatStatus(status: string): string {
    const value = this.normalizeStatus(status);
    return value.charAt(0) + value.slice(1).toLowerCase();
  }

  private async getNextPurchaseOrderId(): Promise<string> {
    try {
      const res: any = await firstValueFrom(
        this.commonService.get(
          'PurchaseOrders?$select=custom_id&$orderby=id desc&$top=20',
        ),
      );

      const values = res?.value ?? [];
      const maxNumber = values.reduce((max: number, item: any) => {
        const match = /^PI-(\d+)$/.exec(item?.custom_id ?? '');
        const current = match ? Number(match[1]) : 0;
        return Math.max(max, current);
      }, 0);

      return `PI-${String(maxNumber + 1).padStart(6, '0')}`;
    } catch {
      return 'PI-000001';
    }
  }

  checkValidation(event: any, field: string) {
    const value = event.target.value ? event.target.value : '';

    switch (field) {
      case 'suppliers':
        if (!value.trim()) {
          this.valueStateOptions.suppliers = ValueState.Negative;
        } else {
          this.onSupplierChange(event);
          this.valueStateOptions.suppliers = ValueState.None;
        }
        break;

      default:
        break;
    }
  }
  Validation(): boolean {
    let isValid = true;

    if (!this.po.supplier_id) {
      this.valueStateOptions.suppliers = ValueState.Negative;
      isValid = false;
    } else {
      this.valueStateOptions.suppliers = ValueState.None;
    }

    return isValid;
  }
}
