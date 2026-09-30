import { Component } from '@angular/core';
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  GridTableColumnDataType,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { DateFormatterService } from '@app/shared/utilities/date-format';

@Component({
  selector: 'app-sales-dispatch',
  templateUrl: './sales-dispatch.component.html',
})
export class SalesDispatchComponent {
  columns: AgGridTableColumn<any>[] = [
    {
      colId: 'sales_order.order_no',
      headerName: $localize`Sales Order`,
      minWidth: 150,
      valueGetter: (p: any) => p.data?.sales_order?.order_no ?? p.data?.sales_order?.custom_id ?? '',
    },
    {
      colId: 'sales_order.client.name',
      headerName: $localize`Client`,
      minWidth: 160,
      valueGetter: (p: any) => p.data?.sales_order?.client?.name ?? '',
    },
    {
      colId: 'product.item_code',
      headerName: `${$localize`Item`} ${$localize`Code`}`,
      minWidth: 130,
      valueGetter: (p: any) => p.data?.product?.item_code ?? '',
    },
    {
      colId: 'product.product_name',
      headerName: `${$localize`Item`} ${$localize`Name`}`,
      flex: 1,
      minWidth: 180,
      valueGetter: (p: any) => p.data?.product?.product_name ?? '',
    },
    { field: 'adjustment_quantity', headerName: $localize`Dispatch Quantity`, minWidth: 150, width: 160 },
    { field: 'condition', headerName: $localize`Condition`, minWidth: 120, width: 130 },
    {
      field: 'adjustment_date',
      headerName: $localize`Dispatch Date`,
      minWidth: 140,
      dataType: GridTableColumnDataType.Date,
      valueFormatter: ({ value }: any) => value ? this.dateFormatter.formatDate(value, true, false, false, false, false) : '',
    },
  ];

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: 'api',
    endpoint: '',
    customEndpoint: 'store/sales-dispatch/report',
    sortBy: 'adjustment_date',
    sortDirection: 'desc',
    pageSize: 40,
    scrollPagination: true,
    searchFields: ['sales_order.order_no', 'sales_order.client.name', 'product.item_code', 'product.product_name'],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Sales Dispatch`,
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
