import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import moment from 'moment';
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import { CommonService } from '@app/services/common-service/common.service';

@Component({
  selector: 'app-raw-cotton-received',
  templateUrl: './raw-cotton-received.component.html',
})
export class RawCottonReceivedComponent {
  @ViewChild('agGridRawCottonRef') agGridRawCottonRef!: AgGridTableComponent;

  @Output() IsExportXls: EventEmitter<void> = new EventEmitter<void>();

  dateRangeValue = '';
  dataSource: AgGridTableODataSourceConfig<any>;

  columns: AgGridTableColumn<any>[] = [
    { field: 'lc_no', headerName: $localize`L/C No`, minWidth: 150 },
    { field: 'supplier_name', headerName: $localize`Name of Supplier`, minWidth: 190 },
    { field: 'origin_name', headerName: $localize`Name of Origin`, minWidth: 160 },
    { field: 'received_lot_bale', headerName: $localize`Received Lot (Bale)`, minWidth: 155 },
    { field: 'received_lot_net_weight_kg', headerName: $localize`Received Lot Net Weight (Kg)`, minWidth: 195 },
    { field: 'rate_per_kg', headerName: $localize`Rate in $ (USD)`, minWidth: 140 },
    { field: 'avg_rate_per_bale', headerName: $localize`Avg Wt. per Bale (Kg)`, minWidth: 165 },
    { field: 'last_receiving_date', headerName: $localize`Last Receiving Date`, minWidth: 155 },
    { field: 'lc_no_short', headerName: $localize`L/C No (Short)`, minWidth: 145 },
    { field: 'opening_stock_bale', headerName: $localize`Opening Stock (In Bale)`, minWidth: 175 },
    { field: 'opening_stock', headerName: $localize`Opening Stock (In Kg)`, minWidth: 165 },
    { field: 'received_in_bale', headerName: $localize`Received (In Bale)`, minWidth: 145 },
    { field: 'received_in_kg', headerName: $localize`Received (In Kg)`, minWidth: 140 },
    { field: 'issue_to_production_bale', headerName: $localize`Issue to Prod. (In Bale)`, minWidth: 175 },
    { field: 'issue_to_production_kg', headerName: $localize`Issue to Prod. (In Kg)`, minWidth: 170 },
    { field: 'delivery_sales_bale', headerName: $localize`Delivery/Sales (Bale)`, minWidth: 165 },
    { field: 'delivery_sales_kg', headerName: $localize`Delivery/Sales (Kg)`, minWidth: 160 },
    { field: 'weight_gain_store_kg', headerName: $localize`Weight Gain (Kg)`, minWidth: 145 },
    { field: 'waste_gain_kg', headerName: $localize`Weight Short (Kg)`, minWidth: 145 },
    { field: 'tare_gain_store_kg', headerName: $localize`Tare Gain (Kg)`, minWidth: 135 },
    { field: 'tare_loss_store_kg', headerName: $localize`Tare Loss (Kg)`, minWidth: 135 },
    { field: 'stock_in_bale', headerName: $localize`Closing Stock (In Bale)`, minWidth: 165 },
    { field: 'closing_stock_kg', headerName: $localize`Closing Stock (In Kg)`, minWidth: 165 },
  ];

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Raw Cotton Received`,
    showRowCount: true,
    showSearch: true,
    showNewButton: false,
    showResetButton: true,
    showDownload: true,
  };

  displayConfig: AgGridTableDisplayConfig = { gridHeight: 'calc(100vh - 118px)' };

  private static readonly DETAILS_EXPAND =
    'receipt($expand=supplier),product($expand=category,uom),receivedBy';

  detailsOpen = false;
  detailsLoading = false;
  detailsRow: any = null;
  detailsLog: any = null;

  constructor(private commonService: CommonService) {
    const today = moment();
    this.dateRangeValue = `${today.format('DD/MM/YYYY')} - ${today.format('DD/MM/YYYY')}`;
    this.dataSource = {
      type: 'api', endpoint: '', customEndpoint: 'store/raw-cotton-received/report',
      filter: this.buildDateFilter(today, today), pageSize: 40, scrollPagination: true,
      sortBy: 'received_date', sortDirection: 'desc',
      searchFields: ['lc_no', 'supplier_name', 'origin_name', 'item_code', 'product_name'],
    };
  }

  onDateRangeStringChange(value: string): void {
    const [from, to] = value.split(' - ');
    const start = moment(from, 'DD/MM/YYYY');
    const end = moment(to, 'DD/MM/YYYY');
    if (!start.isValid() || !end.isValid()) return;
    this.dateRangeValue = value;
    this.dataSource = { ...this.dataSource, filter: this.buildDateFilter(start, end) };
  }

  resetFilters(): void {
    const today = moment();
    this.dateRangeValue = `${today.format('DD/MM/YYYY')} - ${today.format('DD/MM/YYYY')}`;
    this.dataSource = { ...this.dataSource, filter: this.buildDateFilter(today, today) };
  }

  exportRawCottonReceived(_event: any) {
    this.IsExportXls.emit();
  }

  getExportPayload(): any {
    const [from, to] = this.dateRangeValue.split(' - ');
    return {
      from: moment(from, 'DD/MM/YYYY').format('YYYY-MM-DD'),
      to: moment(to, 'DD/MM/YYYY').format('YYYY-MM-DD'),
    };
  }

  getExportFileName(): string {
    const params = this.getExportPayload();
    return `raw-cotton-received-${params.from}-to-${params.to}.xlsx`;
  }

  private buildDateFilter(start: moment.Moment, end: moment.Moment): string {
    return `received_date ge ${start.format('YYYY-MM-DD')} and received_date le ${end.format('YYYY-MM-DD')}`;
  }

  viewDetails(row: any): void {
    this.detailsRow = row;
    this.detailsLog = null;
    this.detailsOpen = true;
    this.detailsLoading = true;

    this.commonService
      .get(`MaterialReceiptLogs(${row.id})?$expand=${RawCottonReceivedComponent.DETAILS_EXPAND}`)
      .subscribe({
        next: (res: any) => {
          this.detailsLog = res;
          this.detailsLoading = false;
        },
        error: (err: any) => {
          console.error(err);
          this.detailsLoading = false;
        },
      });
  }

  closeDetails(): void {
    this.detailsOpen = false;
    this.detailsRow = null;
    this.detailsLog = null;
  }
}
