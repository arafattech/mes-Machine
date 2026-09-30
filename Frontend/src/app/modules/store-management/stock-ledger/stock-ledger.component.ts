import { Component } from '@angular/core';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  AgGridTableDisplayConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';

@Component({
  selector: 'app-stock-ledger',
  templateUrl: './stock-ledger.component.html',
})
export class StockLedgerComponent {
  columns: AgGridTableColumn<any>[] = [
    {
      colId: 'category.name',
      headerName: $localize`Name of Ladger`,
      minWidth: 160,
      sortable: false,
      valueGetter: (p: any) => p.data?.category?.name ?? '',
    },
    { field: 'item_code', headerName: $localize`Material Code`, minWidth: 150 },
    {
      colId: 'product_name_with_model',
      headerName: $localize`Name of the Material with size`,
      flex: 1,
      minWidth: 220,
      sortable: false,
      valueGetter: (p: any) => {
        const productName = p.data?.product_name ?? '';
        const model = p.data?.model_number;
        return model ? `${productName} (${model})` : productName;
      },
    },
    {
      colId: 'uom.name',
      headerName: $localize`Unit`,
      minWidth: 100,
      sortable: false,
      valueGetter: (p: any) => p.data?.uom?.name ?? '',
    },
    { field: 'opening_stock', headerName: $localize`Opening Stock`, minWidth: 130, sortable: false },
    { field: 'mrr', headerName: $localize`MRR`, minWidth: 100, sortable: false },
    { field: 'sr', headerName: $localize`SR`, minWidth: 100, sortable: false },
    { field: 'srm', headerName: $localize`SRM`, minWidth: 100, sortable: false },
    { field: 'rejected', headerName: $localize`Rejected`, minWidth: 110, sortable: false },
    { field: 'returned', headerName: $localize`Returned Qty`, minWidth: 130, sortable: false },
    { field: 'current_stock', headerName: $localize`Current Stock`, minWidth: 130 },
    { field: 'rate_per_unit', headerName: $localize`Rate Per Unit`, minWidth: 130, sortable: false },
    { field: 'amount', headerName: $localize`Amount`, minWidth: 130, sortable: false },
    { field: 'rack_no', headerName: $localize`Rack No`, minWidth: 110 },
  ];

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: 'api',
    endpoint: '',
    customEndpoint: 'store/stock-ledger/report',
    sortBy: 'last_activity',
    sortDirection: 'desc',
    pageSize: 40,
    scrollPagination: true,
    searchFields: [
      'item_code',
      'product_name',
      'model_number',
      'part_number',
      'rack_no',
      'uom.name',
      'category.name',
    ],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Stock Ledger`,
    showRowCount: true,
    showSearch: true,
    showNewButton: false,
    showDownload: true,
  };

  displayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 118px)',
  };

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
  ) {}

  downloadData(): void {
    this.commonService
      .post<Blob>('store/stock-ledger/export', {}, false, undefined, 'blob')
      .subscribe({
        next: (res: Blob) => {
          const url = window.URL.createObjectURL(res);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'stock-ledger.xlsx';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          this.toastService.show('export');
        },
        error: () => {
          this.toastService.show('error');
        },
      });
  }
}
