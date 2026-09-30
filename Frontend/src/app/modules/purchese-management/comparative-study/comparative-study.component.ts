import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
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
import { PurchaseOrderStatusClass } from '@app/modules/purchese-management/shared/enum/purchase.enum';

@Component({
  selector: 'app-comparative-study',
  templateUrl: './comparative-study.component.html',
  styleUrl: './comparative-study.component.scss',
})
export class ComparativeStudyComponent implements OnInit {
  @ViewChild('requisitionAgGridRef')
  requisitionAgGridRef?: AgGridTableComponent<any>;
  @ViewChild('quoteAgGridRef') quoteAgGridRef?: AgGridTableComponent<any>;
  requisitions: any[] = [];
  selectedRequisition: any = null;
  selectedQuote: any = null;
  quoteDraft: any = null;
  quoteItemRows: any[] = [];
  selectedRequisitionId: number | null = null;
  awarding = false;
  loadingPoItems = false;
  quoteDetailsOpen = false;
  requisitionDataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: 'PurchaseRequisitions',
    expand: 'department,purchaseQuotes($expand=supplier)',
    searchFields: ['custom_id', 'department.name'],
    pageSize: 40,
    sortBy: 'custom_id',
    sortDirection: 'desc',
    filter: "status eq 'FINAL_APPROVAL' and type eq 'SPR'",
  };
  requisitionToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Requisitions`,
    showRowCount: true,
    showSearch: true,
    showNewButton: false,
    showDownload: false,
    showSegmentButton: false,
  };
  quoteDataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: 'PurchaseQuotes',
    expand: 'supplier',
    searchFields: ['custom_id', 'supplier.name'],
    pageSize: 40,
    sortBy: 'custom_id',
    sortDirection: 'desc',
    filter: 'purchase_requisition_id eq 0',
  };
  quoteToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Supplier Comparison`,
    showRowCount: true,
    showSearch: true,
    showNewButton: false,
    showDownload: false,
    showSegmentButton: false,
  };
  sharedDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 120px)',
    alternateRowColors: false,
  };
  createPoConfirmOpen = false;
  pendingCreateQuote: any = null;
  requisitionColumns: AgGridTableColumn<any>[] = [];
  quoteColumns: AgGridTableColumn<any>[] = [];
  quoteItemColumns: AgGridTableColumn<any>[] = this.quoteItemTableColumn();
  quoteItemDataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };
  quoteItemToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Items *`,
    showRowCount: true,
    showSearch: false,
    showNewButton: false,
    showDownload: false,
    showSegmentButton: false,
  };
  quoteItemDisplayConfig: AgGridTableDisplayConfig = {
    alternateRowColors: false,
    loadingDelay: 0,
  };
  createPoItemColumns: AgGridTableColumn<any>[] =
    this.buildCreatePoItemColumns();
  createPoItemDataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };
  createPoItemToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Items`,
    showRowCount: true,
    showSearch: false,
    showNewButton: false,
    showDownload: false,
    showSegmentButton: false,
  };
  createPoItemDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 500px)',
    alternateRowColors: false,
    loadingDelay: 0,
  };

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.requisitionColumns = this.buildRequisitionColumns();
    this.quoteColumns = this.buildQuoteColumns();
  }

  handleRequisitionData(event: any) {
    const requisitions = Array.isArray(event?.[0]) ? event[0] : [];
    this.requisitions = requisitions;

    const selectedStillExists =
      this.selectedRequisitionId &&
      this.requisitions.some(
        (requisition) => requisition.id === this.selectedRequisitionId,
      );

    if (this.requisitions.length > 0 && !selectedStillExists) {
      this.setSelectedRequisition(this.requisitions[0]);
    }
  }

  handleRowSelect(event: any) {
    if (!event) return;
    this.setSelectedRequisition(event);
  }

  private setSelectedRequisition(requisition: any) {
    this.selectedRequisition = requisition;
    this.selectedRequisitionId = requisition.id;
    this.quoteDataSource = {
      ...this.quoteDataSource,
      filter: `purchase_requisition_id eq ${requisition.id}`,
    };
    this.quoteToolbarConfig = {
      ...this.quoteToolbarConfig,
      headerTitle: `Supplier Comparison - ${requisition.custom_id}`,
    };
  }

  openQuoteDetails(quote: any) {
    this.selectedQuote = quote;
    this.quoteDraft = { ...quote, quoteItems: [] };
    this.quoteItemRows = [];
    this.quoteItemDataSource = { ...this.quoteItemDataSource, data: [] };
    this.quoteDetailsOpen = true;

    this.commonService
      .get(
        `PurchaseQuotes(${quote.id})?$expand=supplier,requisition,quoteItems($expand=item)`,
      )
      .subscribe((res: any) => {
        const full = res ?? {};
        this.quoteDraft = {
          ...quote,
          ...full,
          quoteItems: full.quoteItems ?? [],
        };
        this.quoteItemRows = (full.quoteItems ?? []).map((item: any) => ({
          item_code: item?.item?.item_code ?? '',
          product_name: item?.item?.product_name ?? '',
          required_quantity: Number(item?.quantity ?? 0),
          quantity: Number(item?.quantity ?? 0),
          unit_price: Number(item?.unit_price ?? 0),
          total_price: Number(item?.total_price ?? 0),
          delivery_date: item?.delivery_date ?? null,
          status: item?.status ?? 'PENDING',
        }));
        this.quoteItemDataSource = {
          ...this.quoteItemDataSource,
          data: this.quoteItemRows,
        };
      });
  }

  closeQuoteDetails() {
    this.quoteDetailsOpen = false;
    this.selectedQuote = null;
    this.quoteDraft = null;
    this.quoteItemRows = [];
    this.quoteItemDataSource = { ...this.quoteItemDataSource, data: [] };
  }

  hasActivePurchaseOrder(quote: any): boolean {
    return String(quote?.status ?? '').toUpperCase() === 'CREATED';
  }

  getPurchaseOrderActionLabel(quote: any): string {
    return this.hasActivePurchaseOrder(quote)
      ? $localize`PO Created`
      : $localize`Create PO`;
  }

  getQuoteItemPriceSummary(quote: any): string {
    return (quote?.quoteItems ?? [])
      .map((item: any) => {
        const productName =
          item?.item?.product_name ?? item?.product?.product_name ?? '';
        const unitPrice = Number(item?.unit_price ?? 0).toFixed(2);
        return productName ? `${productName} - ${unitPrice}` : '';
      })
      .filter(Boolean)
      .join(', ');
  }

  getQuoteItemStatusLabel(status: string): string {
    return PurchaseOrderStatusClass.getLabel(status || 'PENDING');
  }

  confirmCreatePurchaseOrder(quote: any) {
    if (!quote || this.hasActivePurchaseOrder(quote)) {
      return;
    }

    this.pendingCreateQuote = quote;
    this.createPoItemDataSource = { ...this.createPoItemDataSource, data: [] };
    this.loadingPoItems = true;
    this.createPoConfirmOpen = true;

    this.commonService
      .get(
        `PurchaseQuotes(${quote.id})?$expand=supplier,requisition,quoteItems($expand=item)`,
      )
      .subscribe((res: any) => {
        this.pendingCreateQuote = {
          ...quote,
          ...res,
          quoteItems: res?.quoteItems ?? [],
        };
        this.createPoItemDataSource = {
          ...this.createPoItemDataSource,
          data: (res?.quoteItems ?? []).map((item: any) => ({
            item_code: item.item?.item_code ?? '',
            product_name: item.item?.product_name ?? '',
            quantity: Number(item.quantity ?? 0),
            unit_price: Number(item.unit_price ?? 0),
            total_price: Number(item.total_price ?? 0),
            delivery_date: item.delivery_date ?? null,
          })),
        };
        this.loadingPoItems = false;
      });
  }

  closeCreatePoConfirm() {
    this.createPoConfirmOpen = false;
    this.pendingCreateQuote = null;
    this.loadingPoItems = false;
  }

  async proceedCreatePurchaseOrder() {
    if (!this.pendingCreateQuote) {
      return;
    }

    const quote = this.pendingCreateQuote;
    this.closeCreatePoConfirm();
    await this.createPurchaseOrder(quote);
  }

  private buildCreatePoItemColumns(): AgGridTableColumn<any>[] {
    return [
      {
        field: 'item_code',
        headerName: $localize`Item Code`,
        width: 140,
        minWidth: 120,
        sortable: false,
        filter: false,
        floatingFilter: false,
      },
      {
        field: 'product_name',
        headerName: $localize`Name`,
        flex: 1,
        minWidth: 150,
        sortable: false,
        filter: false,
        floatingFilter: false,
      },
      {
        field: 'quantity',
        headerName: $localize`Qty`,
        width: 100,
        sortable: false,
        filter: false,
        floatingFilter: false,
        dataType: GridTableColumnDataType.Number,
      },
      {
        field: 'unit_price',
        headerName: $localize`Unit Price`,
        width: 130,
        sortable: false,
        filter: false,
        floatingFilter: false,
        dataType: GridTableColumnDataType.Number,
      },
      {
        field: 'total_price',
        headerName: $localize`Total Price`,
        width: 130,
        sortable: false,
        filter: false,
        floatingFilter: false,
        dataType: GridTableColumnDataType.Number,
      },
      {
        field: 'delivery_date',
        headerName: $localize`Delivery Date`,
        width: 150,
        sortable: false,
        filter: false,
        floatingFilter: false,
        dataType: GridTableColumnDataType.Date,
      },
    ];
  }

  private quoteItemTableColumn(): AgGridTableColumn<any>[] {
    return [
      {
        field: 'item_code',
        headerName: $localize`Item Code`,
        width: 140,
        minWidth: 120,
        sortable: false,
        filter: false,
        floatingFilter: false,
      },
      {
        field: 'product_name',
        headerName: $localize`Name`,
        flex: 1,
        minWidth: 150,
        sortable: false,
        filter: false,
        floatingFilter: false,
      },
      {
        field: 'required_quantity',
        headerName: $localize`Required Qty`,
        width: 130,
        minWidth: 100,
        sortable: false,
        filter: false,
        floatingFilter: false,
        dataType: GridTableColumnDataType.Number,
      },
      {
        field: 'quantity',
        headerName: $localize`Quote Qty *`,
        width: 120,
        minWidth: 100,
        sortable: false,
        filter: false,
        floatingFilter: false,
        dataType: GridTableColumnDataType.Number,
      },
      {
        field: 'unit_price',
        headerName: $localize`Unit Price *`,
        width: 140,
        minWidth: 120,
        sortable: false,
        filter: false,
        floatingFilter: false,
        dataType: GridTableColumnDataType.Number,
      },
      {
        colId: 'total_price',
        headerName: $localize`Total Price`,
        width: 140,
        minWidth: 120,
        sortable: false,
        filter: false,
        floatingFilter: false,
        valueGetter: (params: any) =>
          Number(params.data?.quantity ?? 0) *
          Number(params.data?.unit_price ?? 0),
        dataType: GridTableColumnDataType.Number,
      },
      {
        field: 'delivery_date',
        headerName: $localize`Delivery Date`,
        width: 160,
        minWidth: 130,
        sortable: false,
        filter: false,
        floatingFilter: false,
        dataType: GridTableColumnDataType.Date,
      },
      {
        field: 'status',
        headerName: $localize`Status`,
        width: 120,
        minWidth: 100,
        sortable: false,
        filter: false,
        floatingFilter: false,
        valueFormatter: (params: any) =>
          this.getQuoteItemStatusLabel(params.value),
      },
    ];
  }

  async createPurchaseOrder(quote: any) {
    if (!this.selectedRequisitionId) return;
    this.awarding = true;
    const customId = await this.commonService.getCustomId({
      model: 'purchase_orders',
      prefix: 'PO',
      field: 'custom_id',
    });

    const items = (quote.quoteItems ?? []).map((item: any) => ({
      product_id: item.product_id,
      quantity: Number(item.quantity ?? 0),
      unit_price: Number(item.unit_price ?? 0),
      total_price: Number(item.total_price ?? 0),
      delivery_date: item.delivery_date ?? null,
    }));

    this.commonService
      .post(
        `purchase/requisitions/${this.selectedRequisitionId}/create-order-from-quote`,
        {
          purchase_quote_id: quote.id,
          custom_id: customId,
          po_date: new Date().toISOString().slice(0, 10),
          note: `Purchase order created from comparative study against ${quote.custom_id}`,
          items,
        },
        false,
      )
      .subscribe({
        next: () => {
          this.awarding = false;
          this.toastService.show('add');
          this.quoteAgGridRef?.refreshGridData(true);
        },
        error: () => {
          this.awarding = false;
          this.toastService.show('error');
        },
      });
  }

  private buildRequisitionColumns(): AgGridTableColumn<any>[] {
    return [
      {
        field: 'custom_id',
        headerName: $localize`SPR No`,
        minWidth: 130,
        width: 150,
      },
      {
        colId: 'urgency',
        headerName: $localize`Urgency`,
        minWidth: 120,
        width: 130,
        sortable: false,
        valueGetter: (params: any) =>
          String(params.data?.urgency ?? '').toUpperCase() || '-',
        cellRenderer: AgGridIconTextCellRendererComponent,
        cellRendererParams: (params: any) => {
          const urgency = String(params.data?.urgency ?? '').toUpperCase();
          const isHigh = urgency === 'HIGH';
          return {
            icon: isHigh ? 'warning' : 'activity-2',
            iconColor: isHigh ? '#d97706' : '#64748b',
          };
        },
      },
      {
        colId: 'department_name',
        headerName: $localize`Department`,
        minWidth: 150,
        flex: 1,
        sortable: false,
        valueGetter: (params: any) => params.data?.department?.name ?? '',
      },
      {
        colId: 'quotes_count',
        headerName: $localize`Quotes`,
        minWidth: 90,
        width: 100,
        sortable: false,
        valueGetter: (params: any) =>
          Array.isArray(params.data?.purchaseQuotes)
            ? params.data.purchaseQuotes.length
            : 0,
      },
      {
        colId: 'is_complete',
        headerName: $localize`Status`,
        minWidth: 110,
        width: 120,
        sortable: false,
        valueGetter: (params: any) =>
          params.data?.is_complete ? 'COMPLETED' : 'PENDING',
        cellRenderer: AgGridStatusBadgeComponent,
      },
    ];
  }

  private buildQuoteColumns(): AgGridTableColumn<any>[] {
    const rowActions: AgGridTableRowAction<any>[] = [
      {
        id: 'view',
        label: '',
        icon: 'show',
        tooltip: $localize`View`,
        design: 'Transparent',
      },
      {
        id: 'create-po',
        label: '',
        icon: 'add',
        tooltip: $localize`Create PO`,
        design: 'Emphasized',
        disabled: (row: any) =>
          this.awarding || this.hasActivePurchaseOrder(row),
      },
    ];

    return [
      {
        field: 'custom_id',
        headerName: $localize`Quote No`,
        minWidth: 130,
        width: 150,
      },
      {
        colId: 'supplier_name',
        headerName: $localize`Supplier`,
        minWidth: 150,
        flex: 1,
        sortable: false,
        valueGetter: (params: any) => params.data?.supplier?.name ?? '',
      },
      {
        field: 'total_amount',
        headerName: $localize`Total Amount`,
        minWidth: 140,
        width: 150,
      },
      {
        field: 'valid_until',
        headerName: $localize`Valid Until`,
        minWidth: 130,
        width: 140,
      },
      {
        colId: 'items_count',
        headerName: $localize`Items`,
        minWidth: 80,
        width: 90,
        sortable: false,
        valueGetter: (params: any) =>
          Array.isArray(params.data?.quoteItems)
            ? params.data.quoteItems.length
            : 0,
      },
      {
        colId: 'item_summary',
        headerName: $localize`Item Summary`,
        minWidth: 200,
        width: 260,
        sortable: false,
        valueGetter: (params: any) =>
          this.getQuoteItemPriceSummary(params.data),
      },
      {
        field: 'status',
        headerName: $localize`Status`,
        minWidth: 110,
        width: 120,
      },
      {
        field: 'actions',
        headerName: $localize`Actions`,
        width: 220,
        minWidth: 200,
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
            switch (actionId) {
              case 'view':
                this.openQuoteDetails(row);
                break;
              case 'create-po':
                this.confirmCreatePurchaseOrder(row);
                break;
            }
          },
        },
      },
    ];
  }
}
