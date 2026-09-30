import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { Employee } from "@app/shared/model/employee";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import { AgGridTableColumn, AgGridTableODataSourceConfig, AgGridTableToolbarConfig,AgGridTableDisplayConfig, GridTableColumnDataType, } from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { AgGridBooleanCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component";
import { AgGridStatusBadgeComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component";
import { CommonService } from "@app/services/common-service/common.service";
import { Localization } from "@app/shared/utilities/localization";
import moment from "moment";
import { ThemeService } from "@app/services/theme.service";
import { Permissions } from "@app/shared/enums/permissions";
@Component({
  selector: 'app-payroll-process',
  templateUrl: './payroll-process.component.html',
  styleUrl: './payroll-process.component.scss',
})
export class PayrollProcessComponent implements OnInit {
  constructor(
    private rolePermissionService: RolePermissionService,
    private commonService: CommonService,
    private cdr: ChangeDetectorRef,
    public theme: ThemeService,
    public permission: RolePermissionService,
  ) {
    this.payrolltableProcessCol = this.buildColumns();
  }

  headerTitle = $localize`Employee Payroll status`;
  Employee = Employee;
  employeeListTitle: string = `${$localize`Employee`} ${$localize`List`}`;
  Overview: string = `${$localize`Overview`}`;
  PayrollLog: string = `${$localize`Payroll`} ${$localize`Log`}`;
  ActivityLog: string = `${$localize`Activity`} ${$localize`Log`}`;
  EmployeeIdNo: string = `${$localize`Employee`} ${$localize`ID:`}`;
  selectedEmployee = new Employee().deserialize({});
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  isPayrollLoading = false;
  isPayrollGenerated = false;
  localize = Localization;
  employeePayrollInfo: any;
  casualLeave: any;
  medicalLeave: any;
  casualLeaveTaken: number = 0;
  medicalLeaveTaken: number = 0;
  selectedRowsId: number | undefined = undefined;
  employeLeaveinYear: any[] = [];
  departmentList: any[] = [];
  employeeTypeList: any[] = [];
  employeeTypeSelectedIds: number[] = [];
  GeneratedEmployeePayroll: any[] = [];
  hrNotes: string = '';
  @ViewChild('employeepayrolltable')
  employeepayrolltable?: AgGridTableComponent<any>;
  selectedDepartmentId: number | undefined = undefined;
  payrollDate = moment().format("DD-MM-YYYY");
  yearOptions: number[] = [];
  selectedYear: number = moment().year();
  monthOptions: { id: string; text: string; start: string; end: string; disabled: boolean }[] = [];
  selectedMonthId: string = "";
  public permissions = Permissions;
  start: string = "";
  end: string = "";
  selectedEmployeeForPayroll: any[] = [];
  selectedEmployeeRowsForPayroll: any[] = [];
  private pendingSelectAll = false;
  moment = moment;
  isPyarollConfirmedDiaglog = false;
  isPayrollPreviewLoading = false;
  payrollPreviewList: any[] = [];
  payrolltableProcessCol: AgGridTableColumn<any>[] = [];
  filterQuery: string = '';
  @ViewChild('payrollPreviewTable')
  payrollPreviewTable?: AgGridTableComponent<any>;

  payrollPreviewDataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };

  payrollPreviewToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Selected Employees`,
    showSearch: true,
    showRowCount: true,
    showNewButton: false,
    showDownload: false,
    showScanner: false,
  };

  payrollPreviewDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: '280px',
  };

  payrollPreviewColumns: AgGridTableColumn<any>[] = [
    { field: "employee_id", headerName: $localize`Employee ID`, minWidth: 110, hide: true },
    { field: "employee_no", headerName: $localize`Employee ID`, minWidth: 110, filter: false, floatingFilter: false },
    { field: "employee_name", headerName: $localize`Employee Name`, minWidth: 160, filter: false, floatingFilter: false },
    { field: "designation", headerName: $localize`Designation`, minWidth: 140, filter: false, floatingFilter: false },
    { field: "total_attendance", headerName: $localize`Attendance`, minWidth: 110, type: "numericColumn", filter: false, floatingFilter: false },
    { field: "total_holidays", headerName: $localize`Holidays`, minWidth: 100, type: "numericColumn", filter: false, floatingFilter: false },
    { field: "nightshift_attendance", headerName: $localize`Night Shift`, minWidth: 110, type: "numericColumn", filter: false, floatingFilter: false },
    { field: "gross_salary", headerName: $localize`Gross Salary`, minWidth: 120, type: "numericColumn", filter: false, floatingFilter: false },
    { field: "tax", headerName: $localize`Tax`, minWidth: 100, type: "numericColumn", filter: false, floatingFilter: false },
    { field: "total_deductions", headerName: $localize`Deductions`, minWidth: 120, type: "numericColumn", filter: false, floatingFilter: false },
    { field: "net_salary", headerName: $localize`Net Salary`, minWidth: 120, type: "numericColumn", filter: false, floatingFilter: false },
  ];

  dataSource: AgGridTableODataSourceConfig = {
    type: "odata",
    endpoint: "Employees",
    searchFields: ['employee_no', 'first_name', 'last_name', 'designation.name', 'salary.total_salary'],
    pageSize: 50,
    expand: 'designation,supervisor,salary,employeeType',
    filter: 'is_active eq true',
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.employeeListTitle,
    showSearch: true,
    showRowCount: true,
    showNewButton: false,
    showDownload: false,
    showScanner: false,
    showResetButton: true,
  };

  displayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 180px)',
  };

  private buildColumns(): AgGridTableColumn<any>[] {
    return [
      {
        field: 'is_active',
        headerName: $localize`Active`,
        minWidth: 60,
        width: 70,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
        floatingFilter: false,
      },
      {
        field: 'employee_no',
        headerName: `${$localize`Employee`} ${$localize`ID`}`,
        minWidth: 100,
      },
      {
        field: 'first_name',
        headerName: $localize`First Name`,
        minWidth: 100,
      },
      {
        field: 'last_name',
        headerName: $localize`Last Name`,
        minWidth: 100,
      },
      {
        colId: 'salary.total_salary',
        headerName: $localize`Salary`,
        minWidth: 110,
        dataType: GridTableColumnDataType.Number,
        valueGetter: (params: any) => params.data?.salary?.total_salary ?? 0,
      },
      {
        colId: 'designation_name',
        headerName: $localize`Designation`,
        minWidth: 120,
        valueGetter: (params: any) => params.data?.designation?.name ?? '',
      },
      {
        colId: 'employeeType.name',
        headerName: $localize`Employee Type`,
        minWidth: 120,
        valueGetter: (params: any) => params.data?.employeeType?.name ?? '',
      },
      {
        field: 'joining_date',
        headerName: $localize`Join Date`,
        minWidth: 100,
        filter: false,
        floatingFilter: false,
      },
      {
        colId: 'payroll_status',
        headerName: $localize`Payroll Status`,
        minWidth: 110,
        width: 120,
        filter: false,
        floatingFilter: false,
        sortable: false,
        valueGetter: (params: any) =>
          this.GeneratedEmployeePayroll?.some(
            (data: any) => data.employee_id === params.data?.id,
          )
            ? 'GENERATED'
            : 'PENDING',
        cellRenderer: AgGridStatusBadgeComponent,
      },
    ];
  }

  ngOnInit(): void {
    this.fetchDepartment();
    this.fetchEmployeeTypes();
    this.applyDefaultDateRange();
    this.initGeneratedPayroll(this.start, this.end);
  }

  onResetPayroll() {
    this.employeeTypeSelectedIds = [];
    this.filterQuery = '';
    this.pendingSelectAll = false;
    this.applyDefaultDateRange();
    this.clearPayrollSelection();
    this.dataSource = {
      ...this.dataSource,
      filter: this.getEmployeeFilterQuery(),
    };
    // Force ngOnChanges on ag-grid-table so ResolveDataSource is updated before resetGridState
    this.cdr.detectChanges();
    this.employeepayrolltable?.resetGridState();
    this.initGeneratedPayroll(this.start, this.end, false);
  }

  private buildYearOptions(): void {
    const currentYear = moment().year();
    this.yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);
  }

  // Always lists all 12 months of the selected year. Months that haven't
  // completed yet (the current month, or any future month) are flagged
  // `disabled` — they can't be generated yet — rather than hidden.
  private buildMonthOptions(year: number): void {
    const lastCompletedMonth = moment().startOf("month").subtract(1, "month");
    this.monthOptions = Array.from({ length: 12 }, (_, i) => {
      const monthMoment = moment({ year, month: i });
      return {
        id: monthMoment.format("YYYY-MM"),
        text: monthMoment.format("MMMM"),
        start: monthMoment.clone().startOf("month").utc().toISOString(),
        end: monthMoment.clone().endOf("month").utc().toISOString(),
        disabled: monthMoment.isAfter(lastCompletedMonth),
      };
    }).reverse();
  }

  private applyDefaultDateRange(): void {
    this.buildYearOptions();
    this.selectedYear = moment().year();
    this.buildMonthOptions(this.selectedYear);

    const latestMonth = this.monthOptions.find((month) => !month.disabled);
    if (!latestMonth) return;

    this.selectedMonthId = latestMonth.id;
    this.start = latestMonth.start;
    this.end = latestMonth.end;
  }

  get selectedMonthText(): string {
    return this.monthOptions.find((option) => option.id === this.selectedMonthId)?.text ?? "";
  }

  onYearChange(event: any) {
    const selectedYear = Number(event.detail.item?.id ?? event.detail.selectedOption?.id);
    if (!selectedYear) return;

    this.selectedYear = selectedYear;
    this.buildMonthOptions(selectedYear);

    const latestMonth = this.monthOptions.find((month) => !month.disabled);
    this.selectedMonthId = latestMonth?.id ?? "";
    this.start = latestMonth?.start ?? "";
    this.end = latestMonth?.end ?? "";
    this.initGeneratedPayroll(this.start, this.end);
  }

  onMonthChange(event: any) {
    const selectedId = event.detail.item?.id ?? event.detail.selectedOption?.id;
    const month = this.monthOptions.find((option) => option.id === selectedId);
    if (!month || month.disabled) return;

    this.selectedMonthId = month.id;
    this.start = month.start;
    this.end = month.end;
    this.initGeneratedPayroll(this.start, this.end);
  }

  fetchDepartment() {
    this.commonService.get('Departments', true).subscribe({
      next: (res: any) => {
        this.departmentList = res.value.map((item: any) => ({
          id: item.id,
          text: item.name,
        }));
      },
      error: (err: any) => {
        console.error('Error to fetch data', err);
      },
    });
  }

  fetchEmployeeTypes() {
    this.commonService
      .get('EmployeeTypes?$filter=is_active eq true', true)
      .subscribe({
        next: (res: any) => {
          this.employeeTypeList = (res.value ?? []).map((item: any) => ({
            id: item.id,
            text: item.name,
          }));
        },
        error: (err: any) => {
          console.error('Error to fetch employee types', err);
        },
      });
  }

  selectEmployeeType(event: any) {
    this.employeeTypeSelectedIds = event.detail.items.map((item: any) =>
      parseInt(item.id),
    );

    let filterByEmployeeType = '';
    if (this.employeeTypeSelectedIds.length > 0) {
      filterByEmployeeType = this.employeeTypeSelectedIds
        .map((id: number) => `employee_type_id eq ${id}`)
        .join(' or ');
    }

    this.filterQuery = filterByEmployeeType;

    this.clearPayrollSelection();
    this.employeepayrolltable?.clearSelection();
    this.pendingSelectAll = this.employeeTypeSelectedIds.length > 0;
    this.dataSource = {
      ...this.dataSource,
      filter: this.getEmployeeFilterQuery(),
    };
    this.employeepayrolltable?.refreshGridData(true);
  }

  onRowSelect(row: any) {
    if (!row?.id) {
      this.selectedEmployee = new Employee().deserialize({});
      this.employeePayrollInfo = undefined;
      this.hrNotes = '';
      return;
    }
    const startDate = moment(this.start).format('DD-MM-YYYY');
    const endDate = moment(this.end).format('DD-MM-YYYY');
    this.initializePayrollInfo(row.id, startDate, endDate);
    this.selectedEmployee = {
      ...row,
      department:
        this.departmentList.find((item) => item.id === row.department_id)
          ?.text ?? 'N/A',
    };
  }

  onSelectionChanged(rows: any[]) {
    this.selectedEmployeeForPayroll = rows.map((row: any) => row.id);
    this.selectedEmployeeRowsForPayroll = rows;
    this.syncPayrollGeneratedState();
  }

  onDataLoaded() {
    if (this.pendingSelectAll) {
      this.pendingSelectAll = false;
      this.employeepayrolltable?.gridContext.toggleSelectAll(true);
    }
  }

  initializePayrollInfo(
    employeeId: number | undefined,
    start_date: string,
    end_date: string,
  ) {
    this.isPayrollLoading = true;
    this.commonService
      .get(
        `employePayrollStatus/${employeeId}/${start_date}/${end_date}`,
        false,
      )
      .subscribe({
        next: (res: any) => {
          this.isPayrollLoading = false;
          this.employeePayrollInfo = res;
          this.hrNotes = this.employeePayrollInfo?.hr_notes;
          this.getLeavesType();
          this.calculateLeaveTaken();
        },
        error: (err: any) => {
          console.error('Error fetching employee data:', err);
          this.isPayrollLoading = false;
        },
      });
  }

  getLeavesType() {
    const leaveTypes = this.employeePayrollInfo?.leaveStatus?.leaveTypes || [];
    this.casualLeave = leaveTypes.find((type: any) => type.id === 2);
    this.medicalLeave = leaveTypes.find((type: any) => type.id === 1);
  }

  calculateLeaveTaken() {
    this.casualLeaveTaken =
      (this.employeePayrollInfo?.leaveStatus?.leaveInYear || []).find(
        (leave: any) => leave.leave_type_id === 2,
      )?.total ?? 0;
    this.medicalLeaveTaken =
      (this.employeePayrollInfo?.leaveStatus?.leaveInYear || []).find(
        (leave: any) => leave.leave_type_id === 1,
      )?.total ?? 0;
  }

  getDesignationName(employee: any): string {
    const designation = employee?.designation;
    return typeof designation === 'object'
      ? designation?.name || designation?.title || ''
      : designation || employee?.designation_name || '';
  }

  initGeneratedPayroll(stdate: string, endate: string, refreshGrid = true) {
    this.isPayrollLoading = true;
    this.commonService
      .get(
        `Payrolls?$filter=start_date le ${endate} and end_date ge ${stdate}&$select=id,employee_id,created_at&$top=3000`,
      )
      .subscribe({
        next: (res: any) => {
          this.isPayrollLoading = false;
          this.GeneratedEmployeePayroll = res?.value ?? [];
          this.syncPayrollGeneratedState();
          if (refreshGrid && this.employeepayrolltable) {
            this.employeepayrolltable.refreshGridData(true);
          }
          if (this.selectedEmployee?.id) {
            const startDate = moment(this.start).format('DD-MM-YYYY');
            const endDate = moment(this.end).format('DD-MM-YYYY');
            this.initializePayrollInfo(
              this.selectedEmployee.id,
              startDate,
              endDate,
            );
          }
        },
        error: (err: any) => {
          console.error('Error fetching employee data:', err);
          this.isPayrollLoading = false;
        },
      });
  }

  isPayrollGeneratedInMonth(
    employeeId: number | undefined,
    start_date: string,
    end_date: string,
  ) {
    this.isPayrollLoading = true;
    this.commonService
      .get(
        `isGeneratedPayrollInMonth/${employeeId}/${start_date}/${end_date}`,
        false,
      )
      .subscribe({
        next: (res: any) => {
          this.isPayrollLoading = false;
          this.isPayrollGenerated = res?.status ? true : false;
        },
        error: (err: any) => {
          console.error('Error fetching employee data:', err);
          this.isPayrollLoading = false;
        },
      });
  }

  openPayrollConfirmDialog() {
    this.isPyarollConfirmedDiaglog = true;
    this.loadPayrollPreview();
  }

  loadPayrollPreview() {
    if (!this.selectedEmployeeForPayroll.length) {
      this.payrollPreviewList = [];
      return;
    }

    this.isPayrollPreviewLoading = true;
    const startDate = moment(this.start).format('DD-MM-YYYY');
    const endDate = moment(this.end).format('DD-MM-YYYY');

    this.commonService
      .post<
        Record<number, any>
      >('employePayrollStatusBulk', { employee_ids: this.selectedEmployeeForPayroll, start_date: startDate, end_date: endDate }, false)
      .subscribe({
        next: (results: Record<number, any>) => {
          this.payrollPreviewList = this.selectedEmployeeRowsForPayroll.map((row: any) => {
            const res = results?.[row.id];
            return {
              employee_id: row?.id,
              employee_no: row?.employee_no,
              employee_name: `${row?.first_name ?? ""} ${row?.last_name ?? ""}`.trim(),
              designation: row?.designation?.name ?? "",
              total_attendance: res?.employeeAttendance?.totalAttendenceInMonth ?? 0,
              total_holidays: res?.employeeAttendance?.holiday ?? 0,
              nightshift_attendance: res?.employeeAttendance?.nightShiftAttendances ?? 0,
              net_salary: Math.max(0, Number(res?.netSalary ?? 0)),
              gross_salary: res?.grossSalary ?? 0,
              tax: res?.employeeDeducations?.tax ?? 0,
              total_deductions: res?.employeeDeducations?.total_deductions ?? 0,
            };
          });
          this.payrollPreviewDataSource = { ...this.payrollPreviewDataSource, data: this.payrollPreviewList };
          this.isPayrollPreviewLoading = false;
          setTimeout(() => this.payrollPreviewTable?.refreshGridData(true));
        },
        error: (err: any) => {
          console.error('Error loading payroll preview', err);
          this.isPayrollPreviewLoading = false;
        },
      });
  }

  removePreviewEmployee(row: any) {
    const employeeId = Number(row?.employee_id);
    if (!employeeId) return;

    this.payrollPreviewList = this.payrollPreviewList.filter(
      (item) => Number(item.employee_id) !== employeeId,
    );
    this.selectedEmployeeForPayroll = this.selectedEmployeeForPayroll.filter(
      (id: any) => Number(id) !== employeeId,
    );
    this.selectedEmployeeRowsForPayroll =
      this.selectedEmployeeRowsForPayroll.filter(
        (row: any) => Number(row.id) !== employeeId,
      );
    this.payrollPreviewDataSource = {
      ...this.payrollPreviewDataSource,
      data: this.payrollPreviewList,
    };
    setTimeout(() => this.payrollPreviewTable?.refreshGridData(true));

    this.employeepayrolltable?.getGridApi()?.forEachNode((node: any) => {
      if (Number(node.data?.id) === employeeId) {
        node.setSelected(false, false, 'api');
      }
    });
    this.syncPayrollGeneratedState();
  }

  get displayedNetSalary(): number {
    return Math.max(0, Number(this.employeePayrollInfo?.netSalary ?? 0));
  }

  get totalPreviewGrossSalary(): number {
    return this.payrollPreviewList.reduce(
      (sum, item) => sum + Number(item.gross_salary ?? 0),
      0,
    );
  }

  get totalPreviewDeductions(): number {
    return this.payrollPreviewList.reduce(
      (sum, item) => sum + Number(item.total_deductions ?? 0),
      0,
    );
  }

  get totalPreviewNetSalary(): number {
    return this.payrollPreviewList.reduce(
      (sum, item) => sum + Number(item.net_salary ?? 0),
      0,
    );
  }

  closePayrollConfirmDialog() {
    this.isPyarollConfirmedDiaglog = false;
    this.payrollPreviewList = [];
    this.payrollPreviewDataSource = {
      ...this.payrollPreviewDataSource,
      data: [],
    };
  }

  generatePayroll() {
    if (!this.selectedEmployeeForPayroll.length) {
      return;
    }

    const payload = {
      hr_notes: this.hrNotes,
      employee_ids: this.selectedEmployeeForPayroll,
    };
    this.isPayrollLoading = true;
    let startDate = moment(this.start).format('DD-MM-YYYY');
    let endDate = moment(this.end).format('DD-MM-YYYY');
    this.commonService
      .post(`generatePayroll/${startDate}/${endDate}`, payload, false)
      .subscribe({
        next: () => {
          this.isPayrollLoading = false;
          this.isPyarollConfirmedDiaglog = false;
          this.payrollPreviewList = [];
          this.payrollPreviewDataSource = {
            ...this.payrollPreviewDataSource,
            data: [],
          };
          this.initGeneratedPayroll(this.start, this.end);
        },
        error: (err: any) => {
          console.error('Error to generate payroll', err);
          this.isPayrollLoading = false;
          this.isPyarollConfirmedDiaglog = false;
        },
      });
  }

  private syncPayrollGeneratedState() {
    if (!this.selectedEmployeeForPayroll?.length) {
      this.isPayrollGenerated = false;
      return;
    }
    this.isPayrollGenerated = this.selectedEmployeeForPayroll.every((id: any) =>
      this.GeneratedEmployeePayroll?.some((payroll: any) => payroll.employee_id === id),
    );
  }

  getEmployeeFilterQuery() {
    const baseFilter = 'is_active eq true';
    return this.filterQuery
      ? `${baseFilter} and ${this.filterQuery}`
      : baseFilter;
  }

  private clearPayrollSelection() {
    this.selectedEmployeeForPayroll = [];
    this.syncPayrollGeneratedState();
    this.selectedEmployee = new Employee().deserialize({});
    this.employeePayrollInfo = undefined;
    this.hrNotes = '';
    this.isPayrollLoading = false;
  }
}
