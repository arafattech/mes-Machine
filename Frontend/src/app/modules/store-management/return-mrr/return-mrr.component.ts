import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridCustomButton,
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  AgGridTableDisplayConfig,
  GridTableColumnDataType,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { DateFormatterService } from '@app/shared/utilities/date-format';

@Component({
  selector: 'app-return-mrr',
  templateUrl: './return-mrr.component.html',
})
export class ReturnMrrComponent implements OnInit {
  @ViewChild('returnsGridRef') returnsGridRef?: AgGridTableComponent<any>;

  private static readonly MRR_EXPAND =
    'supplier,department,requestBy,purchaseOrder($expand=poItems),' +
    'receiptItems($expand=item($expand=uom)),mrrReturns($expand=items)';

  private static readonly VIEW_EXPAND =
    'materialReceipt($expand=supplier,purchaseOrder($expand=poItems),receiptItems($expand=item($expand=uom))),' +
    'returnedBy,items($expand=item($expand=uom))';

  readonly returnTypeOptions = [
    { id: 'QC_REJECTION', text: $localize`QC Rejection` },
    { id: 'EXCESS_RECEIPT', text: $localize`Excess Receipt` },
    { id: 'WRONG_ITEM', text: $localize`Wrong Item` },
    { id: 'DAMAGED', text: $localize`Damaged` },
    { id: 'OTHER', text: $localize`Other` },
  ];

  readonly reasonOptions = [
    { id: 'DAMAGED_MATERIAL', text: $localize`Damaged material` },
    { id: 'QUALITY_ISSUE', text: $localize`Quality issue` },
    { id: 'WRONG_SPECIFICATION', text: $localize`Wrong specification` },
    { id: 'EXCESS_QUANTITY', text: $localize`Excess quantity` },
    { id: 'OTHER', text: $localize`Other` },
  ];

  // ─── Top summary cards ────────────────────────────────────────────────────────
  summary = {
    total_returns: 0,
    total_quantity: 0,
    latest_return_date: null as string | null,
    returns_this_month: 0,
    average_quantity_per_return: 0,
    pending_returnable_mrrs: 0,
  };

  // ─── Returns list ─────────────────────────────────────────────────────────────
  columns: AgGridTableColumn<any>[] = [
    { field: 'custom_id', headerName: $localize`Return No`, minWidth: 150 },
    {
      colId: 'materialReceipt.custom_id',
      headerName: $localize`MRR No`,
      minWidth: 150,
      sortable: false,
      valueGetter: (p: any) => p.data?.materialReceipt?.custom_id ?? '',
    },
    {
      colId: 'materialReceipt.supplier.name',
      headerName: $localize`Supplier`,
      minWidth: 160,
      sortable: false,
      valueGetter: (p: any) => p.data?.materialReceipt?.supplier?.name ?? '',
    },
    {
      field: 'return_date',
      headerName: $localize`Return Date`,
      minWidth: 130,
      dataType: GridTableColumnDataType.Date,
      valueFormatter: ({ value }: any) =>
        value ? this.dateFormatter.formatDate(value, true, false, false, false, false) : '',
    },
    { field: 'total_quantity', headerName: $localize`Total Quantity`, minWidth: 130, type: 'numericColumn' },
    {
      colId: 'returnedBy.name',
      headerName: $localize`Returned By`,
      minWidth: 150,
      sortable: false,
      valueGetter: (p: any) => p.data?.returnedBy?.name ?? '',
    },
  ];

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: 'MrrReturns',
    expand: 'materialReceipt($expand=supplier),returnedBy',
    sortBy: 'created_at',
    sortDirection: 'desc',
    pageSize: 40,
    scrollPagination: true,
    searchFields: ['custom_id', 'materialReceipt.custom_id', 'materialReceipt.supplier.name'],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Return MRR`,
    addButtonText: $localize`New`,
    showNewButton: true,
    showSearch: true,
    showRowCount: true,
    showDownload: false,
  };

  displayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 190px)',
  };

  returnActionButtons: AgGridCustomButton[] = [
    {
      id: 'pdf',
      icon: 'pdf-attachment',
      tooltip: $localize`Download PDF`,
      design: 'Transparent',
      onClick: (row: any) => this.downloadReturnPdf(row),
    },
  ];

  // ─── Return dialog — shared by "New Return" (create) and the info-button "Return
  // Details" (view) actions, so both render the exact same layout; view mode just
  // pre-fills everything from the saved record and disables the editable controls. ──
  dialogOpen = false;
  dialogMode: 'create' | 'view' = 'create';
  dialogLoading = false;
  submitting = false;

  mrrOptions: any[] = [];
  selectedMrr: any = null;
  selectedMrrLabel = '';
  returnItems: any[] = [];
  nextReturnNo = '';
  returnDate = new Date().toISOString().slice(0, 10);
  returnType = '';
  reason = '';
  remarks = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  // Left-panel product picker for the items-to-return list (card + progress-indicator
  // idea borrowed from LocalMaterialReceiptComponent's product-progress panel).
  itemSearchTerm = '';
  selectedReturnItem: any = null;

  get isViewMode(): boolean {
    return this.dialogMode === 'view';
  }

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
    private dateFormatter: DateFormatterService,
  ) {}

  ngOnInit(): void {
    this.loadSummary();
  }

  loadSummary(): void {
    this.commonService.get('store/mrr-returns/summary', false).subscribe({
      next: (res: any) => {
        this.summary = {
          total_returns: res?.total_returns ?? 0,
          total_quantity: res?.total_quantity ?? 0,
          latest_return_date: res?.latest_return_date ?? null,
          returns_this_month: res?.returns_this_month ?? 0,
          average_quantity_per_return: res?.average_quantity_per_return ?? 0,
          pending_returnable_mrrs: res?.pending_returnable_mrrs ?? 0,
        };
      },
      error: (err: any) => console.error(err),
    });
  }

  processData(): void {
    this.returnsGridRef?.refreshGridData(true);
  }

  downloadReturnPdf(row: any): void {
    this.commonService
      .post<Blob>(`store/mrr-returns/${row.id}/pdf`, {}, false, undefined, 'blob')
      .subscribe({
        next: (blob: Blob) => {
          const pdfUrl = URL.createObjectURL(blob);
          const newWindow = window.open(pdfUrl, '_blank');
          if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.target = '_blank';
            link.download = `${row.custom_id ?? 'mrr-return'}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
          setTimeout(() => URL.revokeObjectURL(pdfUrl), 100);
        },
        error: (err: any) => {
          console.error(err);
          this.toastService.show('error');
        },
      });
  }

  getReturnTypeLabel(id: string | null): string {
    return this.returnTypeOptions.find((opt) => opt.id === id)?.text ?? '-';
  }

  getReasonLabel(id: string | null): string {
    return this.reasonOptions.find((opt) => opt.id === id)?.text ?? '-';
  }

  // ─── Dialog lifecycle ─────────────────────────────────────────────────────────

  openNewReturnDialog(): void {
    this.dialogMode = 'create';
    this.dialogOpen = true;
    this.resetDialogSelection();
    this.getMrrOptions();
    this.loadNextReturnNo();
  }

  // Info-button action on the list — opens the SAME dialog as "New Return", pre-filled
  // and read-only, instead of a separate view layout.
  viewReturn(row: any): void {
    this.dialogMode = 'view';
    this.dialogOpen = true;
    this.resetDialogSelection();
    this.dialogLoading = true;

    this.commonService
      .get(`MrrReturns(${row.id})?$expand=${ReturnMrrComponent.VIEW_EXPAND}`, true)
      .subscribe({
        next: (res: any) => {
          const materialReceipt = res?.materialReceipt ?? {};
          const { requiredByProduct, receivedByProduct } = this.buildProductMaps(materialReceipt);

          this.selectedMrr = materialReceipt;
          this.selectedMrrLabel = materialReceipt?.custom_id ?? '';
          this.nextReturnNo = res?.custom_id ?? '';
          this.returnDate = res?.return_date ?? '';
          this.returnType = res?.return_type ?? '';
          this.reason = res?.reason ?? '';
          this.remarks = res?.remarks ?? '';

          this.returnItems = (res?.items ?? []).map((item: any) => {
            const productId = Number(item.product_id);
            const returnedQuantity = Number(item.returned_quantity ?? 0);

            return {
              product_id: productId,
              item_code: item.item?.item_code ?? '-',
              product_name: item.item?.product_name ?? '-',
              uom: item.item?.uom?.name ?? '-',
              required_quantity: requiredByProduct.get(productId) ?? 0,
              received_quantity: receivedByProduct.get(productId) ?? 0,
              remaining_quantity: returnedQuantity,
              already_returned_quantity: returnedQuantity,
              current_quantity: Math.max(0, Number(item.item?.current_stock ?? 0)),
              rejected_quantity: Number(item.rejected_quantity ?? 0),
              return_quantity: returnedQuantity,
              remark: item.remark ?? '',
            };
          });
          this.itemSearchTerm = '';
          this.selectedReturnItem = this.returnItems[0] ?? null;
          this.dialogLoading = false;
        },
        error: (err: any) => {
          console.error(err);
          this.dialogLoading = false;
        },
      });
  }

  private loadNextReturnNo(): void {
    this.commonService.get('store/mrr-returns/next-custom-id', false).subscribe({
      next: (res: any) => (this.nextReturnNo = res?.custom_id ?? ''),
      error: (err: any) => console.error(err),
    });
  }

  closeDialog(): void {
    if (this.submitting) return;
    this.dialogOpen = false;
    this.resetDialogSelection();
  }

  private resetDialogSelection(): void {
    this.selectedMrr = null;
    this.selectedMrrLabel = '';
    this.returnItems = [];
    this.itemSearchTerm = '';
    this.selectedReturnItem = null;
    this.nextReturnNo = '';
    this.returnDate = new Date().toISOString().slice(0, 10);
    this.returnType = '';
    this.reason = '';
    this.remarks = '';
  }

  // ─── MRR picker (create mode only) ─────────────────────────────────────────────

  getMrrOptions(search?: string): void {
    const term = search?.trim().toLowerCase();
    const searchFilter = term ? ` and contains(tolower(custom_id),'${term}')` : '';

    this.dialogLoading = true;
    this.commonService
      .get(
        `MaterialReceipts?$filter=status ne 'CANCELLED'${searchFilter}` +
          `&$expand=${ReturnMrrComponent.MRR_EXPAND}&$orderby=custom_id desc&$top=50`,
        true,
      )
      .subscribe({
        next: (res: any) => {
          this.mrrOptions = res.value ?? [];
          this.dialogLoading = false;

          if (!term && !this.selectedMrr && this.mrrOptions.length) {
            this.selectMrr(this.mrrOptions[0]);
          }
        },
        error: (err: any) => {
          console.error(err);
          this.dialogLoading = false;
        },
      });
  }

  onMrrSearchInput(event: any): void {
    const value = event?.target?.value ?? '';
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.getMrrOptions(value), 300);
  }

  onMrrChange(event: any): void {
    const selectedItem = event?.detail?.item;
    if (!selectedItem) return;

    const mrr = this.mrrOptions.find((m) => Number(m.id) === Number(selectedItem.id));
    if (!mrr) return;

    this.selectMrr(mrr);
  }

  private selectMrr(mrr: any): void {
    this.selectedMrr = mrr;
    this.selectedMrrLabel = mrr.custom_id ?? '';
    this.returnItems = this.computeReturnItems(mrr);
    this.itemSearchTerm = '';
    this.selectedReturnItem = this.returnItems[0] ?? null;
  }

  get filteredReturnItems(): any[] {
    const term = this.itemSearchTerm.trim().toLowerCase();
    if (!term) return this.returnItems;
    return this.returnItems.filter(
      (item) =>
        item.item_code.toLowerCase().includes(term) || item.product_name.toLowerCase().includes(term),
    );
  }

  onItemSearchInput(event: any): void {
    this.itemSearchTerm = event?.target?.value ?? '';
  }

  selectReturnItem(item: any): void {
    this.selectedReturnItem = item;
  }

  itemProgressPercent(item: any): number {
    if (!item.received_quantity) return 0;
    return Math.min(100, Math.round((Number(item.already_returned_quantity) / item.received_quantity) * 100));
  }

  onSelectedReturnQtyChange(event: any): void {
    if (!this.selectedReturnItem || this.isViewMode) return;
    let value = Math.round(Number(event?.detail?.value ?? 0));
    if (!Number.isFinite(value) || value < 0) value = 0;
    if (value > this.selectedReturnItem.remaining_quantity) value = this.selectedReturnItem.remaining_quantity;
    this.selectedReturnItem.return_quantity = value;
  }

  trackByProductId(_index: number, item: any): number {
    return item.product_id;
  }

  // Required qty comes from the PO line for a product; received qty is that product's
  // latest (highest-id) receiptItem row — shared by the create-mode item list (which also
  // needs remaining-vs-already-returned) and the view-mode item list (which just needs
  // these two for display).
  private buildProductMaps(mrr: any): {
    requiredByProduct: Map<number, number>;
    receivedByProduct: Map<number, number>;
    receiptItemByProduct: Map<number, any>;
  } {
    const receiptItemByProduct = new Map<number, any>();
    (mrr.receiptItems ?? []).forEach((receiptItem: any) => {
      const productId = Number(receiptItem.product_id);
      const existing = receiptItemByProduct.get(productId);
      if (!existing || Number(receiptItem.id) > Number(existing.id)) {
        receiptItemByProduct.set(productId, receiptItem);
      }
    });

    const requiredByPoItem = new Map<number, number>();
    (mrr.purchaseOrder?.poItems ?? []).forEach((poItem: any) => {
      requiredByPoItem.set(Number(poItem.id), Number(poItem.quantity ?? 0));
    });

    const requiredByProduct = new Map<number, number>();
    const receivedByProduct = new Map<number, number>();
    receiptItemByProduct.forEach((receiptItem, productId) => {
      requiredByProduct.set(productId, requiredByPoItem.get(Number(receiptItem.po_item_id)) ?? 0);
      receivedByProduct.set(productId, Number(receiptItem.received_quantity ?? 0));
    });

    return { requiredByProduct, receivedByProduct, receiptItemByProduct };
  }

  private computeReturnItems(mrr: any): any[] {
    const { requiredByProduct, receivedByProduct, receiptItemByProduct } = this.buildProductMaps(mrr);

    // An MRR can be returned against multiple times — sum every prior MrrReturn's
    // items for this receipt, per product, so the remaining returnable amount is
    // received minus everything already taken back, not just received.
    const alreadyReturnedByProduct = new Map<number, number>();
    (mrr.mrrReturns ?? []).forEach((mrrReturn: any) => {
      (mrrReturn.items ?? []).forEach((returnItem: any) => {
        const productId = Number(returnItem.product_id);
        const prior = alreadyReturnedByProduct.get(productId) ?? 0;
        alreadyReturnedByProduct.set(productId, prior + Number(returnItem.returned_quantity ?? 0));
      });
    });

    return Array.from(receiptItemByProduct.entries())
      .map(([productId, receiptItem]) => {
        const receivedQuantity = receivedByProduct.get(productId) ?? 0;
        const alreadyReturnedQuantity = alreadyReturnedByProduct.get(productId) ?? 0;
        const remainingQuantity = Math.max(0, receivedQuantity - alreadyReturnedQuantity);

        return {
          product_id: productId,
          item_code: receiptItem.item?.item_code ?? '-',
          product_name: receiptItem.item?.product_name ?? '-',
          uom: receiptItem.item?.uom?.name ?? '-',
          required_quantity: requiredByProduct.get(productId) ?? 0,
          received_quantity: receivedQuantity,
          remaining_quantity: remainingQuantity,
          already_returned_quantity: alreadyReturnedQuantity,
          current_quantity: Math.max(0, Number(receiptItem.item?.current_stock ?? 0)),
          rejected_quantity: Number(receiptItem.rejected_quantity ?? 0),
          return_quantity: 0,
          remark: '',
        };
      })
      .filter((row) => row.remaining_quantity > 0);
  }

  onReturnDateChange(event: any): void {
    this.returnDate = event.detail.value;
  }

  onReturnTypeChange(event: any): void {
    this.returnType = event.detail.selectedOption.value;
  }

  onReasonChange(event: any): void {
    this.reason = event.detail.selectedOption.value;
  }

  get hasReturnQuantity(): boolean {
    return this.returnItems.some((item) => Number(item.return_quantity) > 0);
  }

  // ─── Complete return ──────────────────────────────────────────────────────────

  completeReturn(): void {
    if (!this.selectedMrr || !this.hasReturnQuantity || this.submitting) return;

    this.submitting = true;
    const items = this.returnItems.map((item) => ({
      product_id: item.product_id,
      return_quantity: Number(item.return_quantity) || 0,
      remark: item.remark || null,
    }));

    this.commonService
      .post(
        'store/mrr-returns',
        {
          material_receipt_id: this.selectedMrr.id,
          items,
          return_date: this.returnDate || null,
          return_type: this.returnType || null,
          reason: this.reason || null,
          remarks: this.remarks || null,
        },
        false,
      )
      .subscribe({
        next: () => {
          this.toastService.show('save');
          this.submitting = false;
          this.dialogOpen = false;
          this.resetDialogSelection();
          this.loadSummary();
          this.processData();
        },
        error: (err: any) => {
          console.error(err);
          this.toastService.show('error');
          this.submitting = false;
        },
      });
  }
}
