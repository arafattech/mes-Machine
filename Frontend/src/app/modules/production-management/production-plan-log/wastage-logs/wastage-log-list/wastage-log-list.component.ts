import { Component, OnInit, ViewChild } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { AgGridTableComponent } from '@shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  GridTableColumnDataType,
} from '@shared/components/ag-grid-table/types/ag-grid-table.types';
import { LogWastageComponent } from '@production-module/production-plan-log/wastage-logs/log-wastage/log-wastage.component';
import { ProductionLogService } from '@production-module/shared/services/production-log.service';
import moment from 'moment';
import { formatFactoryDate, formatFactoryDateTime } from '@shared/utilities/date-format';

@Component({
  selector: 'app-ag-grid-machines-wastage-types-cell-renderer',
  template: `
    <div style="display:flex;align-items:center;gap:0.75rem;height:100%">
      <div style="display:flex;align-items:center;gap:0.25rem;">
        <ui5-icon name="machine"></ui5-icon>
        <span>{{ mc }}</span>
      </div>
      <div style="display:flex;align-items:center;gap:0.25rem;">
        <ui5-icon name="delete"></ui5-icon>
        <span>{{ wc }}</span>
      </div>
    </div>
  `,
})
export class AgGridMachinesWastageTypesCellRendererComponent implements ICellRendererAngularComp {
  mc = 0;
  wc = 0;

  agInit(params: ICellRendererParams): void {
    this.update(params);
  }

  refresh(params: ICellRendererParams): boolean {
    this.update(params);
    return true;
  }

  private update(params: ICellRendererParams): void {
    const data = params.data;
    this.mc = data?.machine_count ?? 0;
    this.wc = data?.wastage_type_count ?? 0;
  }
}

/**
 * Logged wastage entries grouped by submission (work order + shift + date), matching
 * `ProductionLogListComponent`'s group-level list presentation.
 */
@Component({
  selector: 'app-wastage-log-list',
  templateUrl: './wastage-log-list.component.html',
})
export class WastageLogListComponent implements OnInit {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<any>;
  @ViewChild('wastageFormRef') wastageFormRef!: LogWastageComponent;

  gridId = 'wastage-log-list';

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: 'api',
    endpoint: '',
    customEndpoint: 'wastage-logs',
    fromCustomPaginator: true,
    pageSize: 40,
    scrollPagination: true,
    searchFields: ['work_order.custom_id'],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Wastage Log`,
    showSearch: true,
    searchPlaceholder: $localize`Search`,
    showRowCount: true,
    showResetButton: true,
    showNewButton: true,
    addButtonText: $localize`Log Wastage`,
  };

  dateRangeValue = '';
  private dateRangeFilter = '';

  readonly columns: AgGridTableColumn<any>[] = [
    {
      colId: 'work_order.custom_id',
      headerName: $localize`Production Order`,
      minWidth: 140,
      sortable: false,
      filter: false,
      valueGetter: (p) => p.data?.work_order?.custom_id ?? '',
    },
    {
      colId: 'shift.name',
      headerName: $localize`Shift`,
      minWidth: 120,
      sortable: false,
      filter: false,
      valueGetter: (p) => p.data?.shift?.name ?? '',
    },
    {
      field: 'entry_date',
      headerName: $localize`Date`,
      minWidth: 130,
      sortable: false,
      filter: false,
      dataType: GridTableColumnDataType.Date,
    },
    {
      field: 'qty_kg',
      headerName: $localize`Qty (kg)`,
      minWidth: 110,
      sortable: false,
      filter: false,
      dataType: GridTableColumnDataType.Number,
    },
    {
      colId: 'machine_wastage_types_count',
      headerName: $localize`Machines - Wastage Types`,
      minWidth: 180,
      sortable: false,
      filter: false,
      cellRenderer: AgGridMachinesWastageTypesCellRendererComponent,
    },
    {
      field: 'logged_at',
      headerName: $localize`Logged At`,
      minWidth: 160,
      sortable: false,
      filter: false,
      floatingFilter: false,
      valueFormatter: ({ value }: any) => formatFactoryDateTime(value),
    },
  ];

  detailOpen = false;
  detailLoading = false;
  detailSubtitle = '';
  detailRows: any[] = [];
  readonly detailColumns: AgGridTableColumn<any>[] = [
    {
      colId: 'machine.machine_name',
      headerName: $localize`Machine`,
      flex: 1,
      minWidth: 140,
      sortable: false,
      filter: false,
      valueGetter: (p) => p.data?.machine?.machine_name ?? '',
    },
    {
      colId: 'wastage_type.name',
      headerName: $localize`Wastage Type`,
      flex: 1,
      minWidth: 140,
      sortable: false,
      filter: false,
      valueGetter: (p) => p.data?.wastage_type?.name ?? '',
    },
    {
      field: 'allocated_qty_kg',
      headerName: $localize`Allocated (kg)`,
      minWidth: 130,
      sortable: false,
      filter: false,
      dataType: GridTableColumnDataType.Number,
    },
  ];
  detailDataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };
  readonly detailToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Allocations Breakdown`,
    showRowCount: true,
    showSearch: true,
  };
  readonly detailDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: '340px',
  };

  constructor(private readonly productionLogService: ProductionLogService) {}

  ngOnInit(): void {
    const today = moment();
    const monthAgo = moment().subtract(1, 'month');
    this.dateRangeValue = `${monthAgo.format('DD/MM/YYYY')} - ${today.format('DD/MM/YYYY')}`;
    this.dateRangeFilter = this.buildDateRangeCondition(monthAgo, today);
    this.rebuildFilter();
  }

  resetFilters(): void {
    const today = moment();
    const monthAgo = moment().subtract(1, 'month');
    this.dateRangeValue = `${monthAgo.format('DD/MM/YYYY')} - ${today.format('DD/MM/YYYY')}`;
    this.dateRangeFilter = this.buildDateRangeCondition(monthAgo, today);
    this.rebuildFilter();
    this.agGridRef?.clearSearch();
  }

  onDateRangeStringChange(value: string): void {
    if (!value || !value.includes(' - ')) {
      this.dateRangeValue = '';
      this.dateRangeFilter = '';
      this.rebuildFilter();
      return;
    }

    const [from, to] = value.split(' - ');
    const start = moment(from, 'DD/MM/YYYY');
    const end = moment(to, 'DD/MM/YYYY');
    if (!start.isValid() || !end.isValid()) return;

    this.dateRangeValue = value;
    this.dateRangeFilter = this.buildDateRangeCondition(start, end);
    this.rebuildFilter();
  }

  private buildDateRangeCondition(start: moment.Moment, end: moment.Moment): string {
    return `entry_date ge '${start.format('YYYY-MM-DD')}' and entry_date le '${end.format('YYYY-MM-DD')}'`;
  }

  private rebuildFilter(): void {
    this.dataSource = { ...this.dataSource, filter: this.dateRangeFilter || undefined };
  }

  openForm(): void {
    this.wastageFormRef.openDialog();
  }

  refresh(): void {
    this.agGridRef?.refreshGridData(true);
  }

  /** Read-only per-machine and per-type allocation breakdown for one submission group — row info action. */
  viewAllocations(row: any): void {
    const workOrderId = row?.work_order?.id ?? row?.work_order_id;
    const shiftId = row?.shift?.id ?? row?.shift_id;
    const date = row?.entry_date;
    if (!workOrderId) return;

    const workOrderLabel = row?.work_order?.custom_id ?? `WO-${workOrderId}`;
    const shiftLabel = row?.shift?.name ? ` · ${row.shift.name}` : '';
    const dateLabel = date ? ` · ${formatFactoryDate(date)}` : '';

    this.detailSubtitle = `${workOrderLabel}${shiftLabel}${dateLabel}`;
    this.detailOpen = true;
    this.detailLoading = true;
    this.detailRows = [];

    this.productionLogService
      .getWastageGroupDetail(workOrderId, shiftId, date)
      .subscribe((rows) => {
        this.detailRows = rows;
        this.detailDataSource = { ...this.detailDataSource, data: [...rows] };
        this.detailLoading = false;
      });
  }

  closeDetail(): void {
    this.detailOpen = false;
  }
}
