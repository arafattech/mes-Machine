import {
  Component,
  EventEmitter,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { PayrollOverviewComponent } from '@app/modules/hr-management/employee-payroll/payroll-process/payroll-overview/payroll-overview.component';
import moment from 'moment';
import { Payroll } from '@app/modules/hr-management/shared/models/payroll';
import { Localization } from '@shared/utilities/localization';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';

import { from, of } from 'rxjs';
import { catchError, concatMap, map } from 'rxjs/operators';
import {
  AgGridCustomButton,
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableRowAction,
  AgGridTableToolbarActionEvent,
  AgGridTableToolbarConfig,
  AgGridToolbarFilter,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';
import { AgGridActionCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component';

@Component({
  selector: 'app-employee-payroll',
  templateUrl: './employee-payroll.component.html',
  styleUrl: './employee-payroll.component.scss',
})
export class EmployeePayrollComponent implements OnInit {
  @ViewChild('payrolloverview') payrolloverview!: PayrollOverviewComponent;
  @ViewChild('payrolltable') payrolltable?: AgGridTableComponent<any>;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsOpenToastAlert = new EventEmitter<void>();
  @Output() IsInsert: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsEdit: EventEmitter<void> = new EventEmitter<void>();
  payrollList = Payroll;
  isDelete: boolean = false;
  isLoading: boolean = false;
  isViewOpen: boolean = false;
  odata: boolean;
  api: boolean;
  ToastType: string = '';
  localization = Localization;
  insertTitle: string = $localize`New`;
  headerTitle: string = `${$localize`Employee`} ${$localize`Payroll`}`;
  start: string = '';
  end: string = '';
  momentInstance = moment;
  currentDate = moment().format('DD-MM-YYYY');
  payrollcount = 0;
  yearOptions: number[] = [];
  selectedYear: number = moment().subtract(1, 'month').year();
  monthOptions: { id: string; text: string }[] = [];
  selectedMonthIndex: number = moment().subtract(1, 'month').month();
  isDeleteConfirmOpen = false;
  pendingDeletePayroll: any = null;
  payrollToolbarFilters: AgGridToolbarFilter[] = [];
  payrollData = {
    totalrequest: 0,
    avarageSalary: 0,
    totalOutstanding: 0,
    totolEmployee: 0,
    newEmployees: 0,
  };
  payrollTableCol: AgGridTableColumn<any>[] = [];
  payrollFilterQuery: string = '';

  isExportPickerOpen: boolean = false;
  isBulkExporting: boolean = false;
  shiftOptions: { id: number; name: string }[] = [];
  employeeTypeOptions: { id: number; name: string }[] = [];
  selectedShiftIds: number[] = [];
  selectedEmployeeTypeIds: number[] = [];
  exportPickerButtons: AgGridCustomButton[] = [
    {
      id: 'export-picker',
      icon: 'grid',
      tooltip: $localize`Download Payroll by Shift / Employee Type`,
      design: 'Transparent',
    },
  ];

  dataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'Payrolls',
    expand: 'employee($expand=employeeType)',
    pageSize: 50,
    sortBy: 'created_at',
    sortDirection: 'desc',
    searchFields: [
      'employee.first_name',
      'employee.last_name',
      'employee.employee_no',
      'status',
      'payment_method',
      'total_payable_days',
      'gross_salary',
    ],
  };

  displayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 250px)',
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.headerTitle,
    addButtonText: this.insertTitle,
    showSearch: true,
    showRowCount: true,
    showNewButton: false,
    showScanner: false,
    showExtraButton: true,
    extraButtonText: Localization.Reset,
  };

  constructor(
    private commonservices: CommonService,
    private rolePermissionService: RolePermissionService,
    private toastService: ToastService,
  ) {
    this.odata = commonservices.odata;
    this.api = commonservices.api;
  }

  ngOnInit(): void {
    this.buildYearOptions();
    this.buildMonthOptions();
    this.buildPayrollToolbarFilters();
    this.applyMonthRange();
    this.payrollFilterQuery = this.getOdataFilter();
    this.getPayrollData();
    this.loadShiftOptions();
    this.loadEmployeeTypeOptions();
    // this.getEmployeeTypes();

    const rowActions: AgGridTableRowAction<any>[] = [
      { id: 'view', label: '', icon: 'show', tooltip: $localize`View Details`, design: 'Default' },
      { id: 'download', label: '', icon: 'download', tooltip: $localize`Download Payslip`, design: 'Transparent' },
      { id: 'delete', label: '', icon: 'delete', tooltip: $localize`Delete`, design: 'Transparent' },
    ];
    this.payrollTableCol = this.buildColumns(rowActions);
  }

  private buildYearOptions(): void {
    const currentYear = moment().year();
    this.yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);
  }

  private buildMonthOptions(): void {
    this.monthOptions = Array.from({ length: 12 }, (_, i) => ({
      id: String(i),
      text: moment().month(i).format('MMMM'),
    }));
  }

  private applyMonthRange(): void {
    const monthMoment = moment({ year: this.selectedYear, month: this.selectedMonthIndex });
    this.start = monthMoment.clone().startOf('month').utc().toISOString();
    this.end = monthMoment.clone().endOf('month').utc().toISOString();
  }

  private buildPayrollToolbarFilters(): void {
    this.payrollToolbarFilters = [
      {
        id: 'year',
        type: 'select',
        placeholder: $localize`Select Year`,
        clearLabel: $localize`All`,
        options: this.yearOptions.map((year) => ({ value: String(year), label: String(year) })),
        value: String(this.selectedYear),
      },
      {
        id: 'month',
        type: 'select',
        placeholder: $localize`Select Month`,
        clearLabel: $localize`All`,
        options: this.monthOptions.map((month) => ({ value: month.id, label: month.text })),
        value: String(this.selectedMonthIndex),
      },
    ];
  }

  onToolbarAction(event: AgGridTableToolbarActionEvent): void {
    if (event.actionId === 'filter:year') {
      const selectedYear = Number(event.value);
      if (!selectedYear) return;
      this.selectedYear = selectedYear;
      this.applyMonthRange();
      this.buildPayrollToolbarFilters();
      this.applyDateRangeFilter();
    } else if (event.actionId === 'filter:month') {
      if (event.value === '' || event.value === undefined || event.value === null) return;
      this.selectedMonthIndex = Number(event.value);
      this.applyMonthRange();
      this.buildPayrollToolbarFilters();
      this.applyDateRangeFilter();
    }
  }

  getOdataFilter() {
    // this.start/this.end already mark the exact selected month's boundaries
    // (see applyMonthRange) — re-deriving "start/end of day" from them in UTC
    // shifted the boundary backward by the local timezone offset, which is
    // what made e.g. selecting August also pull in July's payroll.
    let filter = `is_active eq true and (start_date le ${this.end} and end_date ge ${this.start})`;
    // if (this.selectedEmployeeTypeId) {
    //   filter += ` and employee/employee_type_id eq ${this.selectedEmployeeTypeId}`;
    // }
    return filter;
  }

  // getEmployeeTypes() {
  //   this.commonservices.get('EmployeeTypes', this.odata).subscribe({
  //     next: (res: any) => {
  //       const options = (res.value ?? []).map((item: any) => ({
  //         value: String(item.id),
  //         label: item.name,
  //       }));
  //       this.employeeTypeToolbarFilters = options.length
  //         ? [{
  //             id: 'employee_type',
  //             type: 'select',
  //             placeholder: $localize`Filter by Employee Type`,
  //             clearLabel: $localize`All`,
  //             options,
  //           }]
  //         : [];
  //     },
  //     error: (err) => console.error('Error fetching employee types:', err),
  //   });
  // }

  // onToolbarAction(event: AgGridTableToolbarActionEvent): void {
  //   if (event.actionId !== 'filter:employee_type') return;
  //   this.selectedEmployeeTypeId = event.value ? Number(event.value) : null;
  //   this.applyDateRangeFilter();
  // }

  private buildColumns(rowActions: AgGridTableRowAction<any>[] = []): AgGridTableColumn<any>[] {
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
        colId: 'employee.employee_no',
        headerName: $localize`Employee ID`,
        minWidth: 80,
        valueGetter: (params: any) => params.data?.employee?.employee_no ?? '',
      },
      {
        colId: 'first_name',
        headerName: $localize`First Name`,
        valueGetter: (params: any) => params.data?.employee?.first_name ?? '',
      },
      {
        colId: 'last_name',
        headerName: $localize`Last Name`,
        valueGetter: (params: any) => params.data?.employee?.last_name ?? '',
      },
      // {
      //   colId: 'employee.employeeType.name',
      //   headerName: $localize`Employee Type`,
      //   valueGetter: (params: any) => params.data?.employee?.employeeType?.name ?? '',
      // },
      {
        field: 'net_salary',
        headerName: $localize`Payable Amount`,
        type: 'numericColumn',
        valueFormatter: (params: any) => `${Math.max(0, Number(params.value ?? 0))}`,
        cellStyle: (params: any) =>
          Math.max(0, Number(params.value ?? 0)) > 0
            ? { color: '#15803d', fontWeight: '600' }
            : null,
      },
      {
        field: 'total_payable_days',
        headerName: $localize`Payable Days`,
        type: 'numericColumn',
      },
      {
        field: 'payment_method',
        headerName: $localize`Payment Method`,
      },
      {
        colId: 'payroll_time',
        headerName: $localize`Payroll Time`,
        filter: false,
        floatingFilter: false,
        valueGetter: (params: any) => {
          const startDate = params.data?.start_date;
          const endDate = params.data?.end_date;
          return startDate && endDate
            ? `${moment.utc(startDate).format('DD/MM/YYYY')} - ${moment.utc(endDate).format('DD/MM/YYYY')}`
            : '';
        },
      },
      {
        field: 'created_at',
        headerName: $localize`Process Date`,
        filter: false,
        floatingFilter: false,
        valueFormatter: ({ value }: any) =>
          value ? moment.utc(value).format('DD/MM/YYYY') : '',
      },
      {
        field: 'total_attendance',
        headerName: $localize`Total Attendance`,
        type: 'numericColumn',
      },
      {
        field: 'total_nightshift',
        headerName: $localize`Total Night`,
        type: 'numericColumn',
      },
      {
        field: 'basic_salary',
        headerName: $localize`Basic Salary`,
        type: 'numericColumn',
      },
      {
        field: 'gross_salary',
        headerName: $localize`Total Salary`,
        type: 'numericColumn',
      },
      {
        field: 'bonuses',
        headerName: $localize`Total Bonus`,
        type: 'numericColumn',
      },
      {
        field: 'allowances',
        headerName: $localize`Allowance`,
        type: 'numericColumn',
      },
      {
        field: 'nightshift_bonus',
        headerName: $localize`Night Shift Bonus`,
        type: 'numericColumn',
      },
      {
        field: 'attendance_bonus',
        headerName: $localize`Attendance Bonus`,
        type: 'numericColumn',
      },
      {
        field: 'ramadan_bonus',
        headerName: $localize`Ramadan Bonus`,
        type: 'numericColumn',
      },
      {
        field: 'holiday_bonus',
        headerName: $localize`Holiday Bonus`,
        type: 'numericColumn',
      },
      {
        field: 'overtime_bonus',
        headerName: $localize`Overtime Bonus`,
        type: 'numericColumn',
      },
      {
        field: 'total_deductions',
        headerName: $localize`Total deductions`,
        type: 'numericColumn',
      },
      {
        field: 'net_salary',
        headerName: $localize`Net Salary`,
        type: 'numericColumn',
        valueFormatter: (params: any) => `${Math.max(0, Number(params.value ?? 0))}`,
      },
      { field: 'hr_notes', headerName: $localize`HR Notes`, minWidth: 150 },
      ...(rowActions.length > 0 ? [{
        field: 'actions',
        headerName: $localize`Actions`,
        minWidth: 140,
        width: 150,
        pinned: 'right' as const,
        lockPinned: true,
        sortable: false,
        filter: false,
        floatingFilter: false,
        editable: false,
        cellRenderer: AgGridActionCellRendererComponent,
        cellRendererParams: {
          actions: rowActions,
          onAction: (actionId: string, row: any) => {
            if (actionId === 'view') this.viewPayrollDetails(row);
            if (actionId === 'download') this.downloadPayrollSlip(row);
            if (actionId === 'delete') this.deleteClick(row);
          },
        },
      }] : []),
    ];
  }

  downloadPayrollSlip(payroll: any) {
    if (!payroll) {
      console.warn('Payroll data is not available');
      return;
    }
    const payload: any = {
      employee_id: payroll.employee_id,
      payroll_id: payroll.id,
      template: 'payslip-hr-pdf',
    };
    this.commonservices
      .post<Blob>('pdf/generate', payload, this.api, undefined, 'blob')
      .subscribe({
        next: (res: Blob) => {
          const blob = new Blob([res], { type: 'application/pdf' });
          this.saveBlobFile(blob, `Payroll_Slip_${payroll.employee.first_name}.pdf`);
        },
        error: (err) => {
          console.error('Failed to generate PDF', err);
        },
      });
  }

  private saveBlobFile(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  }

  BatchApi() {
    return {
      requests: [
        {
          id: '1',
          method: 'GET',
          url: '/odata/Employees/$count?$filter=is_active eq true',
          headers: { 'Content-Type': 'application/json' },
        },
        {
          id: '2',
          method: 'GET',
          url: "/odata/Employees?$count=true&select='@count'",
          headers: { 'Content-Type': 'application/json' },
        },
      ],
    };
  }
  viewPayrollDetails(payroll: any) {
    this.payrolloverview.payrollData = payroll;
    this.payrolloverview.openDialog();
  }

  deleteClick(payroll: any) {
    this.pendingDeletePayroll = payroll;
    this.isDeleteConfirmOpen = true;
  }

  closeDeleteConfirm() {
    this.isDeleteConfirmOpen = false;
    this.pendingDeletePayroll = null;
  }

  confirmDeletePayroll() {
    if (!this.pendingDeletePayroll?.id) return;

    this.commonservices
      .delete(`payrolls/${this.pendingDeletePayroll.id}`, null, false)
      .subscribe({
        next: () => {
          this.toastService.show('delete');
          this.closeDeleteConfirm();
          this.payrolltable?.refreshGridData(true);
          this.getPayrollData();
        },
        error: (err: any) => {
          console.error('Failed to delete payroll', err);
          this.toastService.show('error');
          this.closeDeleteConfirm();
        },
      });
  }
  getPayrollData() {
    const startDate = moment(this.start).format('DD-MM-YYYY');
    const endDate = moment(this.end).format('DD-MM-YYYY');

    this.commonservices
      .get(`payrollcalculate/${startDate}/${endDate}`, false)
      .subscribe({
        next: (res: any) => {
          this.payrollData.totolEmployee = res?.totalEmployee ?? 0;
          this.payrollData.avarageSalary = res?.totalEmployeeSalary ?? 0;
          this.payrollData.totalOutstanding = res?.totalOutstandingPayroll ?? 0;
          this.payrollData.totalrequest = res?.totalRequests ?? 0;
          this.payrollData.newEmployees = res?.newEmployee ?? 0;
        },
        error: (err: any) => {
          console.error('Failed to load payroll summary', err);
        },
      });
  }

  getExportUrl(endpoint: string = 'exportPayroll') {
    const start = moment.utc(this.start).format('YYYY-MM-DD');
    const end = moment.utc(this.end).format('YYYY-MM-DD');
    return `${endpoint}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  }

  applyDateRangeFilter() {
    if (!this.start || !this.end) return;
    this.payrollFilterQuery = this.getOdataFilter();
    this.payrolltable?.refreshGridData(true);
    this.getPayrollData();
  }

  resetFilter() {
    this.selectedYear = moment().subtract(1, 'month').year();
    this.selectedMonthIndex = moment().subtract(1, 'month').month();
    this.applyMonthRange();
    this.buildPayrollToolbarFilters();
    // this.selectedEmployeeTypeId = null;
    this.applyDateRangeFilter();
  }

  loadShiftOptions(): void {
    this.commonservices.get('EmployeeShifts', this.odata).subscribe({
      next: (res: any) => {
        this.shiftOptions = (res.value ?? []).map((item: any) => ({
          id: item.id,
          name: item.name,
        }));
      },
      error: (err) => console.error('Failed to load shifts', err),
    });
  }

  loadEmployeeTypeOptions(): void {
    this.commonservices.get('EmployeeTypes', this.odata).subscribe({
      next: (res: any) => {
        this.employeeTypeOptions = (res.value ?? []).map((item: any) => ({
          id: item.id,
          name: item.name,
        }));
      },
      error: (err) => console.error('Failed to load employee types', err),
    });
  }

  onExportPickerButtonClick(btn: AgGridCustomButton): void {
    if (btn.id === 'export-picker') this.openExportPicker();
  }

  openExportPicker(): void {
    this.selectedShiftIds = [];
    this.selectedEmployeeTypeIds = [];
    this.isExportPickerOpen = true;
  }

  closeExportPicker(): void {
    this.isExportPickerOpen = false;
  }

  toggleShiftSelection(shiftId: number, event: Event): void {
    const checked = !!(event.target as HTMLInputElement)?.checked;
    this.selectedShiftIds = checked
      ? [...this.selectedShiftIds, shiftId]
      : this.selectedShiftIds.filter((selectedId) => selectedId !== shiftId);
  }

  toggleEmployeeTypeSelection(employeeTypeId: number, event: Event): void {
    const checked = !!(event.target as HTMLInputElement)?.checked;
    this.selectedEmployeeTypeIds = checked
      ? [...this.selectedEmployeeTypeIds, employeeTypeId]
      : this.selectedEmployeeTypeIds.filter((selectedId) => selectedId !== employeeTypeId);
  }

  get hasExportSelection(): boolean {
    return this.selectedShiftIds.length > 0 || this.selectedEmployeeTypeIds.length > 0;
  }

  downloadSelectedPayrolls(format: 'excel' | 'pdf'): void {
    if (!this.hasExportSelection || this.isBulkExporting) return;

    const jobs: { param: 'shift_id' | 'employee_type_id'; id: number; name: string }[] = [
      ...this.selectedShiftIds.map((id) => ({
        param: 'shift_id' as const,
        id,
        name: this.shiftOptions.find((shift) => shift.id === id)?.name ?? String(id),
      })),
      ...this.selectedEmployeeTypeIds.map((id) => ({
        param: 'employee_type_id' as const,
        id,
        name: this.employeeTypeOptions.find((employeeType) => employeeType.id === id)?.name ?? String(id),
      })),
    ];

    const endpoint = format === 'pdf' ? 'exportPayrollPdf' : 'exportPayroll';
    const extension = format === 'pdf' ? 'pdf' : 'xlsx';

    this.isBulkExporting = true;
    const skippedNames: string[] = [];

    from(jobs)
      .pipe(
        concatMap((job) =>
          this.commonservices
            .post<Blob>(`${this.getExportUrl(endpoint)}&${job.param}=${job.id}`, {}, this.api, undefined, 'blob')
            .pipe(
              map((blob) => ({ blob, job })),
              catchError(() => of({ blob: null as Blob | null, job })),
            ),
        ),
      )
      .subscribe({
        next: ({ blob, job }) => {
          if (!blob || blob.type.includes('json')) {
            skippedNames.push(job.name);
            return;
          }
          this.saveBlobFile(blob, `Payroll_${job.name}.${extension}`);
        },
        error: (err) => {
          console.error('Bulk payroll export failed', err);
          this.isBulkExporting = false;
        },
        complete: () => {
          this.isBulkExporting = false;
          this.closeExportPicker();

          const downloadedCount = jobs.length - skippedNames.length;
          if (skippedNames.length > 0) {
            this.toastService.show(
              'download',
              downloadedCount > 0
                ? `Downloaded ${downloadedCount} of ${jobs.length}. No payroll data for: ${skippedNames.join(', ')}.`
                : `No payroll data found for: ${skippedNames.join(', ')}.`,
            );
          } else {
            this.toastService.show('download');
          }
        },
      });
  }
}
