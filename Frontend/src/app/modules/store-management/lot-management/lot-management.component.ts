import { Component, ViewChild } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  AgGridTableDisplayConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { Lot } from '@store-module/shared/model/lot';

@Component({
  selector: 'app-lot-management',
  templateUrl: './lot-management.component.html',
})
export class LotManagementComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<any>;

  columns: AgGridTableColumn<any>[] = [
    { field: 'id', hide: true },
    { field: 'lot_number', headerName: $localize`Lot No`, minWidth: 130 },
    {
      colId: 'product.product_name',
      headerName: $localize`Product`,
      minWidth: 160,
      sortable: false,
      valueGetter: (p: any) => p.data?.product?.product_name ?? '-',
    },
    {
      colId: 'materialReceiptItem.material_receipt_id',
      headerName: $localize`MRR Item ID`,
      minWidth: 120,
      sortable: false,
      valueGetter: (p: any) => p.data?.mrr_item_id ?? '-',
    },
    { field: 'bale_quantity', headerName: $localize`Bale Qty`, minWidth: 100, type: 'numericColumn' },
    { field: 'gross_weight_kg', headerName: $localize`Gross (kg)`, minWidth: 110, type: 'numericColumn' },
    { field: 'tare_weight_kg', headerName: $localize`Tare (kg)`, minWidth: 110, type: 'numericColumn' },
    { field: 'net_weight_kg', headerName: $localize`Net (kg)`, minWidth: 110, type: 'numericColumn' },
    { field: 'moisture_pct', headerName: $localize`Moisture %`, minWidth: 100, type: 'numericColumn' },
    { field: 'received_date', headerName: $localize`Received Date`, minWidth: 130 },
    { field: 'status', headerName: $localize`Status`, minWidth: 110 },
  ];

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: 'Lots',
    expand: 'product,materialReceiptItem',
    sortBy: 'id',
    sortDirection: 'desc',
    pageSize: 40,
    scrollPagination: true,
    searchFields: ['lot_number', 'product.product_name', 'status'],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Lots`,
    addButtonText: $localize`New`,
    showNewButton: true,
    showSearch: true,
    showRowCount: true,
    showDownload: false,
  };

  displayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 130px)',
  };

  dialogOpen = false;
  submitting = false;
  saveMode: 'POST' | 'PUT' = 'POST';
  lot = new Lot().deserialize({});

  productOptions: any[] = [];
  loadingProductOptions = false;
  selectedProductLabel = '';
  private productSearchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
  ) {}

  openNew(): void {
    this.saveMode = 'POST';
    this.lot = new Lot().deserialize({});
    this.selectedProductLabel = '';
    this.productOptions = [];
    this.dialogOpen = true;
  }

  openEdit(row: any): void {
    this.saveMode = 'PUT';
    this.lot = new Lot().deserialize(row);
    this.selectedProductLabel = row?.product?.product_name ?? '';
    this.productOptions = row?.product ? [row.product] : [];
    this.dialogOpen = true;
  }

  closeDialog(): void {
    if (this.submitting) return;
    this.dialogOpen = false;
  }

  deleteRow(row: any): void {
    if (!row?.id) return;
    if (!confirm($localize`Delete lot ${row.lot_number}? This cannot be undone.`)) return;
    this.commonService.delete(`Lots(${row.id})`, null, true).subscribe({
      next: () => {
        this.toastService.show('delete');
        this.agGridRef?.refreshGridData(true);
      },
      error: () => this.toastService.show('error'),
    });
  }

  onProductSearchInput(event: any): void {
    const value = event?.target?.value ?? '';
    if (this.productSearchTimer) clearTimeout(this.productSearchTimer);
    this.productSearchTimer = setTimeout(() => this.searchProductOptions(value), 300);
  }

  private searchProductOptions(term: string): void {
    const filter = term ? `contains(tolower(product_name),'${term.toLowerCase()}')` : '';
    this.loadingProductOptions = true;
    this.commonService
      .get(`Products${filter ? `?$filter=${filter}` : ''}&$top=30`, true)
      .subscribe({
        next: (res: any) => {
          this.productOptions = res.value ?? [];
          this.loadingProductOptions = false;
        },
        error: () => {
          this.loadingProductOptions = false;
        },
      });
  }

  onProductChange(event: any): void {
    const selectedItem = event?.detail?.item;
    if (!selectedItem) {
      this.lot.product_id = null;
      this.selectedProductLabel = '';
      return;
    }
    const product = this.productOptions.find((p) => Number(p.id) === Number(selectedItem.id));
    if (!product) return;
    this.lot.product_id = product.id;
    this.selectedProductLabel = product.product_name ?? '';
  }

  onReceivedDateChange(event: any): void {
    this.lot.received_date = event.detail.value;
  }

  onStatusChange(event: any): void {
    this.lot.status = event.detail.selectedOption.value;
  }

  onGrossWeightChange(event: any): void {
    this.lot.gross_weight_kg = +event.target.value;
    this.recalculateNetWeight();
  }

  onTareWeightChange(event: any): void {
    this.lot.tare_weight_kg = +event.target.value;
    this.recalculateNetWeight();
  }

  // Net weight is derived — gross minus tare, floored at 0 — not user-entered.
  private recalculateNetWeight(): void {
    const gross = this.lot.gross_weight_kg ?? 0;
    const tare = this.lot.tare_weight_kg ?? 0;
    this.lot.net_weight_kg = Math.max(0, gross - tare);
  }

  // Computed, not stored — matches net_weight_kg being the mill's own measured
  // figure rather than a derived gross-minus-tare value.
  get avgWeightPerBale(): string {
    const bales = this.lot.bale_quantity ?? 0;
    const net = this.lot.net_weight_kg ?? 0;
    if (!bales || !net) return '0';
    return (net / bales).toFixed(2);
  }

  save(): void {
    if (this.submitting || !this.lot.lot_number) return;
    this.submitting = true;

    const payload = {
      lot_number: this.lot.lot_number,
      product_id: this.lot.product_id ?? null,
      mrr_item_id: this.lot.mrr_item_id ?? null,
      bale_quantity: this.lot.bale_quantity ?? 0,
      gross_weight_kg: this.lot.gross_weight_kg ?? null,
      tare_weight_kg: this.lot.tare_weight_kg ?? null,
      net_weight_kg: this.lot.net_weight_kg ?? null,
      moisture_pct: this.lot.moisture_pct ?? null,
      received_date: this.lot.received_date || null,
      status: this.lot.status || 'IN_STOCK',
      remarks: this.lot.remarks || null,
    };

    const request =
      this.saveMode === 'POST'
        ? this.commonService.post('Lots', payload, true)
        : this.commonService.put(`Lots(${this.lot.id})`, payload, true);

    request.subscribe({
      next: () => {
        this.toastService.show('save');
        this.submitting = false;
        this.dialogOpen = false;
        this.agGridRef?.refreshGridData(true);
      },
      error: () => {
        this.toastService.show('error');
        this.submitting = false;
      },
    });
  }
}
