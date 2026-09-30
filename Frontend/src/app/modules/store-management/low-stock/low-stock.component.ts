import { Component } from '@angular/core';
import { AgGridStatusBadgeComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  AgGridTableDisplayConfig,
  GridTableColumnDataType,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { DateFormatterService } from '@app/shared/utilities/date-format';

@Component({
  selector: 'app-low-stock',
  templateUrl: './low-stock.component.html',
})
export class LowStockComponent {
  columns: AgGridTableColumn<any>[] = [
    { field: 'item_code', headerName: `${$localize`Item`} ${$localize`Code`}`, minWidth: 120 },
    { field: 'product_name', headerName: `${$localize`Item`} ${$localize`Name`}`, flex: 1, minWidth: 150 },
    {
      colId: 'category.name',
      headerName: $localize`Category`,
      minWidth: 140,
      sortable: false,
      valueGetter: (p: any) => p.data?.category?.name ?? '',
    },
    { field: 'model_number', headerName: $localize`Model`, minWidth: 120 },
    { field: 'rack_no', headerName: `${$localize`Rack`} ${$localize`Number`}`, minWidth: 120 },
    { field: 'current_stock', headerName: `${$localize`Current`} ${$localize`Stock`}`, minWidth: 120, width: 130 },
    { field: 'minimum_stock', headerName: `${$localize`Minimum`} ${$localize`Stock`}`, minWidth: 120, width: 130 },
    {
      colId: 'stock_status',
      headerName: $localize`Status`,
      minWidth: 110,
      width: 130,
      sortable: false,
      filter: false,
      floatingFilter: false,
      cellRenderer: AgGridStatusBadgeComponent,
      valueGetter: () => 'Low Stock',
    },
    { field: 'unit_price', headerName: `${$localize`Unit`} ${$localize`Price`}`, minWidth: 110, width: 120 },
    {
      field: 'created_at',
      headerName: $localize`Created On`,
      minWidth: 130,
      dataType: GridTableColumnDataType.Date,
      valueFormatter: ({ value }: any) =>
        value
          ? this.dateFormatter.formatDate(value, true, false, false, false, false)
          : '',
    },
  ];

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: 'api',
    endpoint: '',
    customEndpoint: 'store/low-stock/report',
    sortBy: 'current_stock',
    sortDirection: 'asc',
    pageSize: 40,
    scrollPagination: true,
    searchFields: [
      'item_code',
      'product_name',
      'model_number',
      'rack_no',
      'category.name',
      'unit_price',
      'current_stock',
      'minimum_stock',
    ],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Low Stock`,
    showRowCount: true,
    showSearch: true,
    showNewButton: false,
    showDownload: false,
  };

  displayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 118px)',
  };

  constructor(private dateFormatter: DateFormatterService) {}
}
