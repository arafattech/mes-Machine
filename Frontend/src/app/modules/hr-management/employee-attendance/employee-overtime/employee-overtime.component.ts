import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { Localization } from '@app/shared/utilities/localization';
import { Attendance } from '@app/modules/hr-management/shared/models/attendance';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  GridTableColumnDataType,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { DateFormatterService } from '@app/shared/utilities/date-format';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';
import { AgGridStatusBadgeComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import moment from 'moment';

@Component({
  selector: 'app-employee-overtime',
  templateUrl: './employee-overtime.component.html',
})
export class EmployeeOvertimeComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<Attendance>;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  localization = Localization;
  headerTitle: string = `${this.localization.Overtime} ${this.localization.Lists}`;
  isDialogOpen: boolean = false;
  Attendance = Attendance;
  employeeOvertime: Attendance = new Attendance().deserialize({});
  public columns: AgGridTableColumn<Attendance>[] = [];
  selectedOvertimeDetails: any = null;
  selectedRows: any[] = [];
  isApproving = false;
  isConfirmOpen = false;
  public dateRangeValue = '';
  public dateRangeFilter = '';
  public overtimeHoursFilter = 'overtime_hours ge 1';
  public overtimeMinValue = 1;
  public overtimeMaxHours = 12;
  public overtimeStep = 1;

  get overtimeMinPercent(): number {
    return this.overtimeMaxHours > 0
      ? Math.min(100, (this.overtimeMinValue / this.overtimeMaxHours) * 100)
      : 0;
  }

  selectedOvertimesDataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };

  selectedOvertimesToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Selected Records`,
    showNewButton: false,
    showSearch: true,
    showRowCount: false,
    showSegmentButton: false,
    showDownload: false,
  };

  selectedOvertimesDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: '320px',
  };

  selectedOvertimeColumns: AgGridTableColumn<any>[] = [
    {
      field: 'attendance_date',
      headerName: $localize`Date`,
      minWidth: 130,
      filter: false,
      floatingFilter: false,
      dataType: GridTableColumnDataType.Date,
      valueFormatter: ({ value }: any) =>
        value
          ? this.dateFormatter.formatDate(
              value,
              true,
              false,
              false,
              false,
              false,
            )
          : '',
    },
    {
      colId: 'employee_first_name',
      headerName: $localize`First Name`,
      minWidth: 130,
      filter: false,
      floatingFilter: false,
      valueGetter: (params: any) => params.data?.employee?.first_name ?? '',
    },
    {
      colId: 'employee_last_name',
      headerName: $localize`Last Name`,
      minWidth: 130,
      filter: false,
      floatingFilter: false,
      valueGetter: (params: any) => params.data?.employee?.last_name ?? '',
    },
    {
      field: 'overtime_hours',
      headerName: $localize`Overtime Hours`,
      minWidth: 130,
      filter: false,
      floatingFilter: false,
      type: 'numericColumn',
    },
    {
      colId: 'duty_type',
      headerName: $localize`Duty Type`,
      minWidth: 130,
      filter: false,
      floatingFilter: false,
      cellRenderer: AgGridStatusBadgeComponent,
      valueGetter: (params: any) => params.data?.duty_type ?? '',
    },
  ];

  dataSource: AgGridTableODataSourceConfig = {
    type: 'api',
    endpoint: '',
    customEndpoint: '/hrm/attendance/duty-rows',
    sortBy: 'attendance_date',
    sortDirection: 'desc',
    filter: '',
    pageSize: 40,
    scrollPagination: true,
    searchFields: ['employee_no', 'employee.first_name', 'employee.last_name', 'duty_type', 'overtime_status'],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.headerTitle,
    showSearch: true,
    showRowCount: true,
    showNewButton: false,
    showDownload: false,
    showScanner: false,
    showSegmentButton: false,
    showResetButton: true,
    showExtraButton: false,
    extraButtonText: $localize`Approve`,
    extraButtonDesign: 'Emphasized',
  };

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
    private dateFormatter: DateFormatterService,
  ) {
    const today = moment();
    const sevenDaysAgo = moment().subtract(6, 'days');
    this.dateRangeValue = `${sevenDaysAgo.format('DD/MM/YYYY')} - ${today.format('DD/MM/YYYY')}`;
    this.dateRangeFilter = this.buildDateCondition(sevenDaysAgo, today);
    this.applyFilters();
  }

  ngOnInit(): void {
    this.columns = this.buildColumns();
    this.loadOvertimeHoursRange();
  }

  // The slider's scale should reflect what a shift can actually produce — its
  // ceiling is the longest configured shift's total working hours, not an
  // arbitrary guess. Step drops to 0.5 when any shift's duration isn't a whole
  // number of hours (e.g. "8h 30m"), so the slider can still land on it.
  private loadOvertimeHoursRange(): void {
    this.commonService
      .get('EmployeeShifts?$select=total_working_hours', true)
      .subscribe({
        next: (res: any) => {
          const hoursList: number[] = (res?.value ?? [])
            .map((shift: any) => this.parseWorkingHours(shift.total_working_hours))
            .filter((hours: number) => hours > 0);

          if (!hoursList.length) return;

          this.overtimeMaxHours = Math.ceil(Math.max(...hoursList));
          this.overtimeStep = hoursList.some((hours) => !Number.isInteger(hours))
            ? 0.5
            : 1;
        },
        error: (err) => console.error('Failed to load shift working hours:', err),
      });
  }

  private parseWorkingHours(value?: string): number {
    if (!value) return 0;
    const match = value.match(/(\d+)h\s*(\d+)?m?/i);
    if (!match) return 0;
    const hours = Number(match[1]) || 0;
    const minutes = Number(match[2]) || 0;
    return hours + minutes / 60;
  }

  private buildDateCondition(start: moment.Moment, end: moment.Moment): string {
    return `attendance_date ge ${start.format('YYYY-MM-DD')} and attendance_date le ${end.format('YYYY-MM-DD')}`;
  }

  private applyFilters(): void {
    const filter = [this.dateRangeFilter, this.overtimeHoursFilter]
      .filter((condition) => !!condition)
      .join(' and ');
    this.dataSource = { ...this.dataSource, filter };
  }

  onDateRangeStringChange(value: string): void {
    if (!value || !value.includes(' - ')) return;
    const [from, to] = value.split(' - ');
    const start = moment(from, 'DD/MM/YYYY');
    const end = moment(to, 'DD/MM/YYYY');
    if (!start.isValid() || !end.isValid()) return;
    this.dateRangeValue = value;
    this.dateRangeFilter = this.buildDateCondition(start, end);
    this.applyFilters();
  }

  incrementOvertimeMin(): void {
    this.setOvertimeMinValue(this.overtimeMinValue + this.overtimeStep);
  }

  decrementOvertimeMin(): void {
    this.setOvertimeMinValue(this.overtimeMinValue - this.overtimeStep);
  }

  private setOvertimeMinValue(value: number): void {
    this.overtimeMinValue = Math.min(
      this.overtimeMaxHours,
      Math.max(0, Math.round(value / this.overtimeStep) * this.overtimeStep),
    );
    this.overtimeHoursFilter = `overtime_hours ge ${this.overtimeMinValue}`;
    this.applyFilters();
  }

  resetFilters(): void {
    const today = moment();
    const sevenDaysAgo = moment().subtract(6, 'days');
    this.dateRangeValue = `${sevenDaysAgo.format('DD/MM/YYYY')} - ${today.format('DD/MM/YYYY')}`;
    this.dateRangeFilter = this.buildDateCondition(sevenDaysAgo, today);
    this.overtimeMinValue = 1;
    this.overtimeHoursFilter = 'overtime_hours ge 1';
    this.applyFilters();
  }

  private buildColumns(): AgGridTableColumn<Attendance>[] {
    return [
      {
        field: 'is_active',
        headerName: $localize`Active`,
        minWidth: 80,
        width: 90,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
        floatingFilter: false,
      },
      {
        colId: 'employee_no',
        headerName: $localize`Employee No`,
        minWidth: 130,
        filter: false,
        floatingFilter: false,
        sortable: false,
        valueGetter: (params: any) => params.data?.employee?.employee_no ?? params.data?.employee_no ?? '',
      },
      {
        colId: 'employee.first_name',
        headerName: $localize`First Name`,
        minWidth: 130,
        filter: false,
        floatingFilter: false,
        sortable: false,
        valueGetter: (params: any) => params.data?.employee?.first_name ?? '',
      },
      {
        colId: 'employee.last_name',
        headerName: $localize`Last Name`,
        minWidth: 130,
        filter: false,
        floatingFilter: false,
        sortable: false,
        valueGetter: (params: any) => params.data?.employee?.last_name ?? '',
      },
      {
        field: 'overtime_hours',
        headerName: $localize`Overtime Hours`,
        minWidth: 130,
        type: 'numericColumn',
        filter: false,
        floatingFilter: false,
        valueGetter: (params: any) =>
          params.data?.duty_type === 'OVERTIME'
            ? params.data?.overtime_hours
            : null,
      },
      {
        field: 'attendance_date',
        headerName: $localize`Attendance Date`,
        minWidth: 150,
        filter: false,
        floatingFilter: false,
        dataType: GridTableColumnDataType.Date,
        valueFormatter: ({ value }: any) =>
          value
            ? this.dateFormatter.formatDate(
                value,
                true,
                false,
                false,
                false,
                false,
              )
            : '',
      },
      {
        colId: 'shift.name',
        headerName: $localize`Shift`,
        minWidth: 130,
        filter: false,
        floatingFilter: false,
        sortable: false,
        valueGetter: (params: any) => params.data?.shift?.name ?? '',
      },
      {
        colId: 'duty_type',
        headerName: $localize`Duty Type`,
        minWidth: 130,
        filter: false,
        floatingFilter: false,
        cellRenderer: AgGridStatusBadgeComponent,
        valueGetter: (params: any) => params.data?.duty_type ?? '',
      },
      {
        colId: 'holiday_bonus_mode',
        headerName: $localize`Bonus Mode`,
        minWidth: 130,
        filter: false,
        floatingFilter: false,
        valueGetter: (params: any) => params.data?.duty_type === 'HOLIDAY'
          ? params.data?.holiday_bonus_mode ?? ''
          : '',
      },
      {
        colId: 'holiday_bonus_amount',
        headerName: $localize`Bonus Amount`,
        minWidth: 130,
        type: 'numericColumn',
        filter: false,
        floatingFilter: false,
        valueGetter: (params: any) => params.data?.duty_type === 'HOLIDAY'
          ? params.data?.holiday_bonus_amount ?? null
          : null,
      },
      {
        colId: 'overtime_status',
        headerName: $localize`Status`,
        minWidth: 140,
        filter: false,
        floatingFilter: false,
        cellRenderer: AgGridStatusBadgeComponent,
        valueGetter: (params: any) => this.rowStatus(params.data),
      },
      {
        field: 'created_at',
        headerName: $localize`Created On`,
        minWidth: 130,
        filter: false,
        floatingFilter: false,
        dataType: GridTableColumnDataType.Date,
        valueFormatter: ({ value }: any) =>
          value
            ? this.dateFormatter.formatDate(
                value,
                true,
                false,
                false,
                false,
                false,
              )
            : '',
      },
    ];
  }

  dutyStatus(row: any): string {
    switch (row?.duty_type) {
      case 'OVERTIME':
        return $localize`Overtime`;
      case 'HOLIDAY':
        return $localize`Holiday Bonus`;
      case 'EXTRA_SHIFT':
        return $localize`Extra Shift`;
      default:
        return 'PENDING';
    }
  }

  rowStatus(row: any): string {
    switch (row?.duty_type) {
      case 'OVERTIME':
        return row?.overtime_status ?? 'PENDING';
      case 'HOLIDAY':
        return row?.holiday_bonus_status ?? 'PENDING';
      case 'EXTRA_SHIFT':
        return row?.extra_shift_status ?? 'PENDING';
      default:
        return 'PENDING';
    }
  }

  isRowPending(row: any): boolean {
    switch (row?.duty_type) {
      case 'OVERTIME':
        return row?.overtime_status !== 'APPROVED';
      case 'HOLIDAY':
        return row?.holiday_bonus_status !== 'APPROVED';
      case 'EXTRA_SHIFT':
        return row?.extra_shift_status !== 'APPROVED';
      default:
        return false;
    }
  }

  onSelectionChanged(rows: any[]): void {
    this.selectedRows = rows;
    const hasPending = rows.some((r: any) => this.isRowPending(r));
    this.toolbarConfig = {
      ...this.toolbarConfig,
      showExtraButton: hasPending,
      extraButtonDisable: this.isApproving,
    };
    this.syncSelectedTable();
  }

  removeSelectedRow(row: any): void {
    const id = row?.id;
    if (id == null) return;
    this.selectedRows = this.selectedRows.filter((r: any) => r.id !== id);
    this.agGridRef?.getGridApi()?.getRowNode(String(id))?.setSelected(false);
    this.syncSelectedTable();
    if (!this.selectedRows.length) this.isConfirmOpen = false;
  }

  private syncSelectedTable(): void {
    this.selectedOvertimesDataSource = {
      ...this.selectedOvertimesDataSource,
      data: [...this.selectedRows],
    };
  }

  approveOvertime(): void {
    if (!this.selectedRows.length || this.isApproving) return;
    this.selectedRows = this.selectedRows.filter((r: any) =>
      this.isRowPending(r),
    );
    this.syncSelectedTable();
    if (!this.selectedRows.length) return;
    this.isConfirmOpen = true;
  }

  confirmApprove(): void {
    this.isConfirmOpen = false;
    if (!this.selectedRows.length || this.isApproving) return;

    const items = this.selectedRows
      .map((row: any) => ({ id: row.attendance_log_id, type: row.duty_type }))
      .filter((item) => item.id != null && item.type);

    if (!items.length) return;

    this.isApproving = true;
    this.toolbarConfig = { ...this.toolbarConfig, extraButtonDisable: true };

    this.commonService
      .post('hrm/attendance/approve-overtime', { items }, false)
      .subscribe({
        next: () => {
          this.toastService.show('edit');
          this.selectedRows = [];
          this.isApproving = false;
          this.toolbarConfig = {
            ...this.toolbarConfig,
            showExtraButton: false,
            extraButtonDisable: false,
          };
          this.syncSelectedTable();
          this.agGridRef?.refreshGridData(true);
        },
        error: () => {
          this.toastService.show('error');
          this.isApproving = false;
          this.toolbarConfig = {
            ...this.toolbarConfig,
            extraButtonDisable: false,
          };
        },
      });
  }

  viewOvertimeDetails(data: any) {
    this.employeeOvertime = data;
    this.selectedOvertimeDetails = data;
    this.isDialogOpen = true;
  }

  processData(_event?: any) {
    this.agGridRef?.refreshGridData(true);
  }

  CloseDialog() {
    this.isDialogOpen = false;
    this.employeeOvertime = new Attendance().deserialize({});
  }
}
