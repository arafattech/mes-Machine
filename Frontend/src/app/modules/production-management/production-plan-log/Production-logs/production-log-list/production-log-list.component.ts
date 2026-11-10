import { Component, OnInit, ViewChild } from '@angular/core';
import moment from 'moment';
import { formatFactoryDate, formatFactoryDateTime } from '@shared/utilities/date-format';
import { AgGridTableComponent } from '@shared/components/ag-grid-table/ag-grid-table.component';
import { AgGridIconTextCellRendererComponent } from '@shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component';
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  GridTableColumnDataType,
} from '@shared/components/ag-grid-table/types/ag-grid-table.types';
import { ProductionLogFormComponent } from '@production-module/production-plan-log/Production-logs/production-log-form/production-log-form.component';
import { ProductionLogService } from '@production-module/shared/services/production-log.service';
import { MachineOverviewDataService } from '@production-module/shared/services/machine-overview-data.service';
import { ShiftOption } from '@production-module/shared/interface/interface';
@Component({
  selector: 'app-production-log-list',
  templateUrl: './production-log-list.component.html',
})
export class ProductionLogListComponent implements OnInit {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<any>;
  @ViewChild('logFormRef') logFormRef!: ProductionLogFormComponent;

  gridId = 'production-log-list';

  // Must be declared BEFORE `columns` below — field initializers run in declaration order,
  // and `buildColumns()` reads `this.shiftOptions` synchronously at construction time (for
  // the Shift column's `filterControl.options`). Declaring it after `columns` left
  // `shiftOptions` `undefined` when `buildColumns()` ran, throwing on `.map()` and crashing
  // the whole component before it could even render.
  shiftOptions: ShiftOption[] = [];

  columns: AgGridTableColumn<any>[] = this.buildColumns();

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: 'api',
    endpoint: '',
    customEndpoint: 'production-logs',
    fromCustomPaginator: true,
    pageSize: 40,
    scrollPagination: true,
    searchFields: ['work_order.custom_id'],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Production Log`,
    showSearch: true,
    searchPlaceholder: $localize`Search`,
    showRowCount: true,
    showNewButton: true,
    addButtonText: $localize`Log Production`,
  };

  dateRangeValue = '';
  private dateRangeFilter = '';

  detailOpen = false;
  detailLoading = false;
  detailHeaderText = '';
  detailSubtitle = '';
  detailRows: any[] = [];
  readonly detailColumns: AgGridTableColumn<any>[] = [
    {
      colId: 'machine.machine_name',
      headerName: $localize`Machine`,
      minWidth: 150,
      flex: 1,
      sortable: false,
      filter: false,
      valueGetter: (p) => p.data?.machine?.machine_name ?? '',
    },
    {
      field: 'good_count',
      headerName: $localize`Good`,
      minWidth: 110,
      sortable: false,
      filter: false,
      dataType: GridTableColumnDataType.Number,
    },
    {
      field: 'total_count',
      headerName: $localize`Total`,
      minWidth: 110,
      sortable: false,
      filter: false,
      dataType: GridTableColumnDataType.Number,
    },
    {
      field: 'created_at',
      headerName: $localize`Logged At`,
      minWidth: 180,
      sortable: false,
      filter: false,
      floatingFilter: false,
      valueFormatter: ({ value }: any) => formatFactoryDateTime(value),
    },
  ];
  detailDataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };
  readonly detailToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Machines`,
    showRowCount: true,
    showSearch: true,
  };
  readonly detailDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: '300px',
  };

  constructor(
    private readonly productionLogService: ProductionLogService,
    private readonly machineOverviewDataService: MachineOverviewDataService,
  ) {}

  ngOnInit(): void {
    // Column defs build synchronously (before this async load resolves), so the Shift
    // column's `filterControl.options` needs `columns` rebuilt once shifts actually load —
    // otherwise its multi-select filter renders permanently empty.
    this.machineOverviewDataService.getActiveShifts().subscribe((shifts) => {
      this.shiftOptions = shifts;
      this.columns = this.buildColumns();
    });

    const today = moment();
    const monthAgo = moment().subtract(1, 'month');
    this.dateRangeValue = `${monthAgo.format('DD/MM/YYYY')} - ${today.format('DD/MM/YYYY')}`;
    this.dateRangeFilter = this.buildDateRangeCondition(monthAgo, today);
    this.rebuildFilter();
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
    return `bucket_started_at ge '${start.format('YYYY-MM-DD')}' and bucket_started_at le '${end.format('YYYY-MM-DD')}'`;
  }

  /** Shift filtering lives entirely in the Shift column's own `filterControl` (in-header
   * multi-select → `AgGridTableComponent.setColumnOdataFilter()` → merged into `$filter`
   * automatically) — not here. Only the date range is a hand-built `dataSource.filter`. */
  private rebuildFilter(): void {
    this.dataSource = { ...this.dataSource, filter: this.dateRangeFilter || undefined };
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    return [
      {
        colId: 'work_order.custom_id',
        headerName: $localize`Production Order`,
        minWidth: 140,
        sortable: false,
        filter: false,
        valueGetter: (p) => p.data?.work_order?.custom_id ?? '',
      },
      {
        // `colId` deliberately does NOT match the nav path (`shift.name`/`shift/name`) —
        // filtering targets the plain `shift_id` column on `machine_production_counts`
        // directly (matches the backend's own `applyProductionLogFilter()` regex, and
        // sidesteps having to filter through a `shift/any(a:a/name eq ...)` nav-path
        // lambda for every option). Display still reads `shift.name` via `valueGetter`.
        colId: 'shift_id',
        headerName: $localize`Shift`,
        minWidth: 120,
        sortable: false,
        filter: true,
        valueGetter: (params: any) => params.data?.shift?.name ?? '',
        filterControl: {
          type: 'multiSelect',
          options: this.shiftOptions.map((s) => ({ value: String(s.id), label: s.name })),
          placeholder: $localize`Filter by Shift...`,
        },
      },
      {
        field: 'log_date',
        headerName: $localize`Date`,
        minWidth: 140,
        sortable: false,
        filter: false,
        dataType: GridTableColumnDataType.Date,
      },
      {
        field: 'machine_count',
        headerName: $localize`Machines`,
        minWidth: 130,
        sortable: false,
        filter: false,
        cellRenderer: AgGridIconTextCellRendererComponent,
        cellRendererParams: { icon: 'machine' },
      },
      {
        field: 'good_count',
        headerName: $localize`Good`,
        minWidth: 100,
        sortable: false,
        filter: false,
        dataType: GridTableColumnDataType.Number,
      },
      {
        field: 'total_count',
        headerName: $localize`Total`,
        minWidth: 100,
        sortable: false,
        filter: false,
        dataType: GridTableColumnDataType.Number,
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
  }

  openForm(): void {
    this.logFormRef.openDialog();
  }

  refresh(): void {
    this.agGridRef?.refreshGridData(true);
  }

  /** Read-only per-machine breakdown for one (work order, shift, day) group — the row's info action. */
  viewGroupDetail(row: any): void {
    const workOrderId = row?.work_order?.id;
    const shiftId = row?.shift?.id;
    const date = row?.log_date;
    if (!workOrderId) return;

    this.detailSubtitle = `${row.work_order?.custom_id ?? 'WO-' + workOrderId} · ${row.shift?.name ?? ''} · ${formatFactoryDate(date)}`;
    this.detailHeaderText = $localize`Log Details for : ${this.detailSubtitle}`;
    this.detailOpen = true;
    this.detailLoading = true;
    this.detailRows = [];

    this.productionLogService
      .getGroupDetail(workOrderId, shiftId, date)
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
