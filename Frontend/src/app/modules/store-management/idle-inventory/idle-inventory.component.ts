import { Component, OnInit } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  AgGridTableDisplayConfig,
  GridTableColumnDataType,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { DateFormatterService } from '@app/shared/utilities/date-format';
import moment from 'moment';

@Component({
  selector: 'app-idle-inventory',
  templateUrl: './idle-inventory.component.html',
})
export class IdleInventoryComponent implements OnInit {
  public dateRangeValue = this.getDefaultRange();

  columns: AgGridTableColumn<any>[] = [
    { field: 'custom_id', headerName: $localize`Idle ID`, minWidth: 110, width: 120 },
    {
      colId: 'item_code',
      headerName: $localize`Item Code`,
      minWidth: 120,
      sortable: false,
      valueGetter: (p: any) => p.data?.product?.item_code ?? '',
    },
    {
      colId: 'product_name',
      headerName: $localize`Item Name`,
      flex: 1,
      minWidth: 150,
      sortable: false,
      valueGetter: (p: any) => p.data?.product?.product_name ?? '',
    },
    { field: 'quantity', headerName: $localize`Quantity`, minWidth: 100, width: 110 },
    { field: 'condition', headerName: $localize`Condition`, minWidth: 120 },
    {
      field: 'last_movement_date',
      headerName: $localize`Last Movement`,
      minWidth: 130,
    },
    {
      field: 'created_date',
      headerName: $localize`Created Date`,
      minWidth: 130,
      dataType: GridTableColumnDataType.Date,
      valueFormatter: ({ value }: any) =>
        value
          ? this.dateFormatter.formatDate(value, true, false, false, false, false)
          : '',
    },
  ];

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Idle Inventory`,
    showRowCount: true,
    showSearch: true,
    showNewButton: false,
    showDownload: false,
  };

  displayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 118px)',
  };

  constructor(
    private commonService: CommonService,
    private dateFormatter: DateFormatterService,
  ) {}

  ngOnInit(): void {
    this.fetchReport(this.dateRangeValue);
  }

  onDateRangeChange(value: string): void {
    if (!value) return;
    this.dateRangeValue = value;
    this.fetchReport(value);
  }

  private fetchReport(rangeValue: string): void {
    const [from, to] = rangeValue.split(' - ');
    const fromDate = moment.utc(from, 'DD/MM/YYYY').startOf('day').format('YYYY-MM-DD');
    const toDate = moment.utc(to, 'DD/MM/YYYY').endOf('day').format('YYYY-MM-DD');
    const url = `store/idle-inventory/report?from=${fromDate}&to=${toDate}`;

    this.commonService.get(url, false).subscribe({
      next: (res: any) => {
        const rows = Array.isArray(res) ? res : (res?.data ?? res?.value ?? []);
        this.dataSource = { ...this.dataSource, data: rows };
      },
    });
  }

  private getDefaultRange(): string {
    const from = moment().startOf('month').format('DD/MM/YYYY');
    const to = moment().format('DD/MM/YYYY');
    return `${from} - ${to}`;
  }
}
