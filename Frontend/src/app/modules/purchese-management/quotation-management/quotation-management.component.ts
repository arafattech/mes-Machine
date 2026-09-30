import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, inject, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import {
  AgGridTableComponent,
} from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridActionCellRendererComponent,
  AgGridIconTextCellRendererComponent,
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
import { Localization } from '@shared/utilities/localization';
import { PurchaseQuote } from '@app/modules/purchese-management/shared/model/purchaseQuote';
import ValueState from '@ui5/webcomponents-base/dist/types/ValueState.js';

@Component({
  selector: 'app-quotation-management',
  templateUrl: './quotation-management.component.html',
  styleUrl: './quotation-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuotationManagementComponent implements OnInit {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<any>;
  open = false;
  loading = false;
  requisitions: any[] = [];
  suppliers: any[] = [];
  quote: any = { items: [], status: 'SUBMITTED' };
  saveMode: 'POST' | 'PUT' = 'POST';
  selectedData: any;
  requisitionTitle = '';
  supplierTitle = '';
  warningMessage = '';
  loadingItems = false;
  IsDelete = new EventEmitter<string>();
  valueState = ValueState;
  valueStateOptions = {
    requisition: ValueState.None,
    supplier: ValueState.None,
  };
  public localization = Localization;
  public itemColumns: AgGridTableColumn<any>[] = [];

  itemsDataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };
  itemsToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Items *`,
    showRowCount: true,
    showSearch: true,
    showNewButton: false,
    showDownload: false,
    showSegmentButton: false,
  };
  itemsDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 550px)',
    fillEmptyRows: false,
  };

  get isQuoteLocked(): boolean {
    return this.selectedData?.status === 'APPROVED';
  }

  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: 'PurchaseQuotes',
    expand: 'supplier,requisition,quoteItems($expand=item($expand=uom))',
    searchFields: ['custom_id', 'supplier.name', 'requisition.custom_id'],
    pageSize: 40,
    sortBy: 'custom_id',
    sortDirection: 'desc',
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`RFQ / Quotation Management`,
    showRowCount: true,
    showSearch: true,
    showNewButton: true,
    addButtonText: $localize`New`,
    showDownload: false,
    showSegmentButton: false,
  };
  displayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 118px)',
  };

  private mapQuoteStatus(quote: any): string {
    return quote?.status === 'CREATED' ? 'CREATED' : 'NOT_CREATED';
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    const rowActions: AgGridTableRowAction<any>[] = [
      {
        id: 'view',
        label: '',
        icon: 'information',
        tooltip: $localize`View Details`,
        design: 'Default',
      },

      {
        id: 'delete',
        label: '',
        icon: 'delete',
        tooltip: $localize`Delete`,
        design: 'Negative',
        disabled: (row: any) => row?.status === 'APPROVED' || row?.status === 'CREATED',
      },
    ];

    const cols: AgGridTableColumn<any>[] = [
      {
        field: 'custom_id',
        headerName: $localize`Quote No`,
        minWidth: 130,
        width: 150,
      },
      {
        colId: 'requisition_custom_id',
        headerName: $localize`SPR No`,
        minWidth: 130,
        width: 150,
        sortable: false,
        valueGetter: (params: any) => params.data?.requisition?.custom_id ?? '',
      },
      {
        colId: 'urgency',
        headerName: $localize`Urgency`,
        minWidth: 120,
        width: 130,
        sortable: false,
        valueGetter: (params: any) => {
          const v = params.data?.requisition?.urgency ?? params.data?.urgency ?? '';
          return String(v).toUpperCase() || '-';
        },
        cellRenderer: AgGridIconTextCellRendererComponent,
        cellRendererParams: (params: any) => {
          const urgency = String(params.data?.requisition?.urgency ?? params.data?.urgency ?? '').toUpperCase();
          const isHigh = urgency === 'HIGH';
          const isMedium = urgency === 'MEDIUM';
          return {
            icon: isHigh ? 'warning' : isMedium ? 'message-warning' : 'circle-task',
            iconColor: isHigh ? '#d97706' : isMedium ? '#2563eb' : '#64748b',
          };
        },
      },
      {
        colId: 'supplier_name',
        headerName: $localize`Supplier`,
        minWidth: 160,
        flex: 1,
        sortable: false,
        valueGetter: (params: any) => params.data?.supplier?.name ?? '',
      },
      {
        field: 'quote_date',
        headerName: $localize`Quote Date`,
        minWidth: 130,
        width: 140,
      },
      {
        field: 'total_amount',
        headerName: $localize`Total Amount`,
        minWidth: 150,
        width: 160,
      },
      {
        colId: 'po_status',
        headerName: $localize`PO Status`,
        minWidth: 130,
        width: 140,
        sortable: false,
        filter: false,
        floatingFilter: false,
        valueGetter: (params: any) => this.mapQuoteStatus(params.data),
        cellRenderer: AgGridStatusBadgeComponent,
      },
      {
        field: 'actions',
        headerName: $localize`Actions`,
        width: 100,
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
            if (actionId === 'delete') this.deleteItem(row);
          },
        },
      },
    ];

    return cols;
  }

  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
  ) {
    this.tableColumn(false);
    this.loadDependencies();
  }

  ngOnInit(): void {
    this.columns = this.buildColumns();
  }

  tableColumn(readOnly = false): void {
    this.itemColumns = [
      {
        field: 'item_code',
        headerName: $localize`Item Code`,
        width: 140,
        editable: false,
      },
      {
        field: 'product_name',
        headerName: $localize`Name`,
        flex: 1,
        editable: false,
      },
      {
        field: 'required_quantity',
        headerName: $localize`Required Qty`,
        width: 120,
        type: 'numericColumn',
        editable: false,
      },
      {
        field: 'quantity',
        headerName: $localize`Quote Qty *`,
        width: 120,
        type: 'numericColumn',
        editable: false,
        inlineEditor: { type: 'stepInput', min: 0, maxField: 'remaining_quantity', disabled: readOnly },
        afterValueChange: this.onQuoteQtyChange.bind(this),
      },
      {
        field: 'unit_price',
        headerName: $localize`Unit Price *`,
        width: 140,
        type: 'numericColumn',
        editable: false,
        inlineEditor: { type: 'stepInput', min: 0, disabled: readOnly },
        afterValueChange: this.onUnitPriceChange.bind(this),
      },
      {
        colId: 'total_price',
        headerName: $localize`Total Price`,
        width: 140,
        type: 'numericColumn',
        editable: false,
        valueGetter: (params: any) =>
          Number(params.data?.quantity ?? 0) * Number(params.data?.unit_price ?? 0),
      },
      {
        field: 'delivery_date',
        headerName: $localize`Delivery Date`,
        width: 160,
        editable: !readOnly,
        dataType: GridTableColumnDataType.Date,
      },
    ];
  }

  async newItem() {
    this.saveMode = 'POST';
    this.selectedData = null;
    this.tableColumn(false);
    this.quote = {
      items: [],
      status: 'SUBMITTED',
      quote_date: '',
      valid_until: '',
      note: '',
      purchase_requisition_id: null,
      supplier_id: null,
      custom_id: '',
    };
    this.requisitionTitle = '';
    this.supplierTitle = '';
    this.syncItemsGrid();
    this.open = true;
    this.quote.custom_id = await this.commonService.getCustomId({
      model: 'purchase_quotes',
      prefix: 'RFQ',
      field: 'custom_id',
    });
  }

  async viewItem(event: any) {
    this.saveMode = 'PUT';
    this.selectedData = event;
    this.tableColumn(this.isQuoteLocked);

    const quotedMap = await this.fetchAlreadyQuotedQty(event.purchase_requisition_id, event.id);

    this.quote = {
      ...event,
      purchase_requisition_id: event.purchase_requisition_id,
      supplier_id: event.supplier_id,
      items: (event.quoteItems ?? []).map((item: any) => {
        const reqQty = Number(item.item?.required_quantity ?? item.quantity ?? 0);
        const alreadyQuoted = quotedMap.get(item.product_id) ?? 0;
        const remaining = Math.max(item.quantity, reqQty - alreadyQuoted);
        return {
          product_id: item.product_id,
          item_code: item.item?.item_code,
          product_name: item.item?.product_name,
          required_quantity: reqQty,
          remaining_quantity: remaining,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          delivery_date: item.delivery_date,
        };
      }),
    };
    this.requisitionTitle = event.requisition?.custom_id ?? '';
    this.supplierTitle = event.supplier?.name ?? '';
    this.syncItemsGrid();
    this.open = true;
    this.cdr.markForCheck();
  }

  private async fetchAlreadyQuotedQty(requisitionId: number, excludeQuoteId?: number): Promise<Map<number, number>> {
    const filter = excludeQuoteId
      ? `purchase_requisition_id eq ${requisitionId} and id ne ${excludeQuoteId}`
      : `purchase_requisition_id eq ${requisitionId}`;
    try {
      const res: any = await firstValueFrom(
        this.commonService.get(`PurchaseQuotes?$filter=${filter}&$expand=quoteItems($select=product_id,quantity)`),
      );
      const map = new Map<number, number>();
      for (const quote of res?.value ?? []) {
        for (const qi of quote.quoteItems ?? []) {
          const pid = Number(qi.product_id);
          map.set(pid, (map.get(pid) ?? 0) + Number(qi.quantity ?? 0));
        }
      }
      return map;
    } catch {
      return new Map();
    }
  }

  get dialogHeaderText() {
    return this.saveMode === 'POST'
      ? $localize`New RFQ / Quotation`
      : $localize`RFQ / Quotation Details`;
  }

  get requisitionName() {
    return this.requisitionTitle;
  }

  get supplierName() {
    return this.supplierTitle;
  }

  get quoteStatusLabel() {
    return this.mapQuoteStatus(this.quote);
  }

  CloseDialog() {
    this.open = false;
    this.loading = false;
    this.warningMessage = '';
    this.valueStateOptions = { requisition: ValueState.None, supplier: ValueState.None };
  }

  afterSuccessSave() {
    this.loading = false;
    this.toastService.show(this.saveMode === 'POST' ? 'add' : 'edit');
    this.CloseDialog();
    this.agGridRef?.refreshGridData(true);
  }

  onUnitPriceChange(rowData: any) {
    rowData.unit_price = Number(rowData.unit_price ?? 0);
    rowData.total_price =
      Number(rowData.quantity ?? 0) * Number(rowData.unit_price ?? 0);
  }

  onQuoteQtyChange(rowData: any) {
    rowData.quantity = Number(rowData.quantity ?? 0);
    rowData.total_price =
      Number(rowData.quantity ?? 0) * Number(rowData.unit_price ?? 0);
  }

  syncItemsGrid() {
    this.itemsDataSource = { ...this.itemsDataSource, data: [...(this.quote.items ?? [])] };
  }

  async onRequisitionChange(event: any) {
    const id = Number(event.detail.item?.id);
    const requisition = this.requisitions.find((item: any) => item.id === id);
    if (!requisition) return;

    this.valueStateOptions.requisition = ValueState.None;
    this.quote.purchase_requisition_id = requisition.id;
    this.requisitionTitle = requisition.custom_id ?? '';
    this.quote.requisition = requisition;
    this.quote.items = [];
    this.syncItemsGrid();
    this.loadingItems = true;
    this.cdr.markForCheck();

    try {
      const quotedMap = await this.fetchAlreadyQuotedQty(requisition.id);

      this.quote.items = (requisition.sprItems ?? [])
        .map((item: any) => {
          const reqQty = Number(item.approved_qty ?? item.required_quantity ?? 0);
          const alreadyQuoted = quotedMap.get(item.product_id ?? item.item?.id) ?? 0;
          const remaining = Math.max(0, reqQty - alreadyQuoted);
          const price = Number(item.item?.unit_price ?? 0);
          return {
            product_id: item.product_id ?? item.item?.id,
            item_code: item.item?.item_code ?? '',
            product_name: item.item?.product_name ?? '',
            required_quantity: reqQty,
            remaining_quantity: remaining,
            quantity: remaining,
            unit_price: price,
            total_price: remaining * price,
            delivery_date: null,
          };
        })
        .filter((item: any) => item.remaining_quantity > 0);
    } finally {
      this.loadingItems = false;
      this.syncItemsGrid();
      this.cdr.markForCheck();
    }
  }

  onSupplierChange(event: any) {
    const supplierId = Number(event.detail.item?.id);
    this.valueStateOptions.supplier = ValueState.None;
    this.quote.supplier_id = supplierId;
    const supplier = this.suppliers.find((item: any) => item.id === supplierId);
    this.supplierTitle = supplier?.name ?? '';
    this.quote.supplier = supplier ?? null;
  }

  saveQuote() {
    if (this.isQuoteLocked) return;

    this.warningMessage = '';
    this.valueStateOptions = { requisition: ValueState.None, supplier: ValueState.None };
    let valid = true;

    if (!this.quote.purchase_requisition_id) {
      this.valueStateOptions.requisition = ValueState.Negative;
      valid = false;
    }
    if (!this.quote.supplier_id) {
      this.valueStateOptions.supplier = ValueState.Negative;
      valid = false;
    }
    if (!(this.quote.items ?? []).length) {
      this.warningMessage = $localize`At least one item is required.`;
      valid = false;
    }

    const exceeded = (this.quote.items ?? []).find(
      (item: any) => Number(item.quantity ?? 0) > Number(item.remaining_quantity ?? item.required_quantity ?? 0),
    );
    if (exceeded) {
      this.warningMessage = $localize`Quote quantity for "${exceeded.product_name}" exceeds remaining available quantity.`;
      valid = false;
    }

    if (!valid) {
      this.toastService.show('error');
      return;
    }

    this.loading = true;

    const quotePayload = new PurchaseQuote().deserialize(this.quote);

    const request$ =
      this.saveMode === 'POST'
        ? this.commonService.post(
            'purchase/quotes',
            quotePayload.toOdata(),
            false,
          )
        : this.commonService.put(
            `purchase/quotes/${this.selectedData.id}`,
            quotePayload.toOdata(),
            false,
          );

    request$.subscribe({
      next: () => {
        this.afterSuccessSave();
      },
      error: (err: any) => {
        this.loading = false;
        const msg = err?.error?.errors?.items?.[0] ?? err?.error?.message ?? null;
        if (msg) this.warningMessage = msg;
        this.toastService.show('error');
      },
    });
  }

  deleteItem(row: any): void {
    if (!row?.id) return;
    this.IsDelete.emit(`PurchaseQuotes(${row.id})`);
  }

  onDeleteSuccess(): void {
    this.agGridRef?.refreshGridData(true);
  }

  private loadDependencies() {
    this.commonService
      .get(
        "PurchaseRequisitions?$filter=status eq 'FINAL_APPROVAL' and type eq 'SPR' and is_complete eq false&$orderby=id desc&$expand=sprItems($expand=item),department",
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res: any) => {
        this.requisitions = res.value ?? [];
      });

    this.commonService
      .get('Suppliers')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res: any) => {
        this.suppliers = res.value ?? [];
      });
  }
}
