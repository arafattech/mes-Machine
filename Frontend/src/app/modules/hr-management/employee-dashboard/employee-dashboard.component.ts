import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { AuthService } from "@app/services/auth-service/auth.service";
import { CommonService } from "@app/services/common-service/common.service";
import { MediaService } from "@app/services/media-service";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { ToastService } from "@app/services/toast-service/toast.service";
import { saveMode } from "@app/shared/enums/saveMode";
import { LeaveRequests } from "@app/modules/hr-management/shared/models/leaveRequests";
import { NoticeEmployee } from "@app/modules/hr-management/shared/models/noticsEmployee";
import { calculateTotalHours, DateFormatterService } from "@app/shared/utilities/date-format";
import { Localization } from "@app/shared/utilities/localization";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import { AgGridActionCellRendererComponent, AgGridDynamicColorBadgeComponent, AgGridStatusBadgeComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component";
import { AgGridTableColumn, AgGridTableDisplayConfig, AgGridTableODataSourceConfig, AgGridTableRowAction, AgGridTableToolbarConfig, GridTableColumnDataType } from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { calculateHoursFromMinutes } from "@app/modules/hr-management/shared/utilities/dateTime-format";
import { Asset } from "@shared/model/asset";
import { Employee } from "@shared/model/employee";
import moment from "moment";
import { EmployeeHasAsset } from "@app/modules/hr-management/shared/models/employeeHasAsset";
import { Notice } from "@app/modules/hr-management/shared/models/notice";
import { PayrollOverviewComponent } from "@app/modules/hr-management/employee-payroll/payroll-process/payroll-overview/payroll-overview.component";
import { environment } from "@env/environment";
import { EmployeeSettingsComponent } from "@app/modules/hr-management/employee-dashboard/employee-settings/employee-settings.component";
import { ThemeService } from "@app/services/theme.service";
@Component({
  selector: "app-employee-dashboard",
  templateUrl: "./employee-dashboard.component.html",
  styleUrl: "./employee-dashboard.component.scss",
})
export class EmployeeDashboardComponent implements OnInit {
  @ViewChild("payrolloverview") payrolloverview!: PayrollOverviewComponent;
  @ViewChild("employeeSettings") employeeSettings!: EmployeeSettingsComponent;
  @ViewChild("noticeTable") noticeTable?: AgGridTableComponent<any>;
  @ViewChild("payrollTable") payrollTable?: AgGridTableComponent<any>;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Input() employeeId: number | undefined | null = null;

  employeeHasAssets: EmployeeHasAsset[] = [];
  headerTitleNotice: string = `${$localize`Notice`} ${$localize`List`}`;
  headerTitle: string = `${$localize`Employee`} ${$localize`Payroll`}`;
  noticeColumns: AgGridTableColumn<any>[] = [];
  payrollColumns: AgGridTableColumn<any>[] = [];
  assetColumns: AgGridTableColumn<any>[] = [];
  leaveColumns: AgGridTableColumn<any>[] = [];
  employeeRequestColumns: AgGridTableColumn<any>[] = [];
  attendanceColumns: AgGridTableColumn<any>[] = [];
  headerTitleAsset: string = `${$localize`Assets`} ${$localize`List`}`;
  headerTitleSubordinate: string = `${$localize`Subordinate`} ${$localize`List`}`;
  MarkedAsread: string = `${$localize`I`} ${$localize`Have`} ${$localize`Read`}`;
  AttendaneTitle: string = `${$localize`Attendance`} ${$localize`Logs`}`;
  ToastType: "add" | "edit" | "read" | "error" = "add";
  employee: Employee | any = new Employee().deserialize({});
  employeeInfo = Employee;
  notices = Notice;

  EmployeeImage: string | null = null;
  loading = false;
  skeletonProfileRows = Array.from({ length: 5 });
  skeletonDetailRows = Array.from({ length: 12 });
  odata: boolean | undefined;
  api: boolean | undefined;
  userImg: string = "";
  assets = new Asset();
  Asset = Asset;
  leaveTypes: any[] = [];
  successMessage: string = "";
  attendanceLogs: any[] = [];
  attendanceStartDate: string = "";
  attendanceEndDate: string = "";
  notisList: any[] = [];
  PayrollsList: any[] = [];
  leavesList: any[] = [];
  leaveRequests = LeaveRequests;
  LeaveRequest = new LeaveRequests();
  isOpen: boolean = false;
  saveMode: string = saveMode.POST;
  localization = Localization;
  countAttendanceLogs: any;
  selectedEmployee: any = {};
  is_supervisor: boolean = false;
  htmlContent: string = "";
  isViewOpen: boolean = false;
  isRead: boolean = false;
  isLoading: boolean = false;
  NoticeEmployeeList: NoticeEmployee = new NoticeEmployee();
  viewNoticeData: Notice = new Notice();
  allNoticeEmployees: NoticeEmployee[] = [];
  leaveList: { name: string; total: number }[] = [];
  totalLeaves: number = 0;
  EmployeeStatus: any;
  currentDate = moment().format("DD-MM-YYYY");
  employeeCheckInTime: string = "";
  employeeCheckOutTime: string = "";
  moment = moment;

  noticeDataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'NoticesEmployees',
    expand: 'notice',
    pageSize: 50,
  };
  noticeToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.headerTitleNotice,
    showSearch: true,
    showRowCount: false,
    showNewButton: false,
    showDownload: false,
    showSegmentButton: false,
  };
  noticeDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 193px)',
  };

  payrollDataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'Payrolls',
    expand: 'employee',
    pageSize: 50,
  };
  payrollToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.headerTitle,
    showSearch: true,
    showRowCount: true,
    showNewButton: false,
    showDownload: false,
    showSegmentButton: false,
  };
  payrollDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 193px)',
  };

  assetDataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'EmployeeHasAssets',
    expand: 'asset',
    pageSize: 50,
  };
  assetToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.headerTitleAsset,
    showSearch: true,
    showRowCount: true,
    showNewButton: false,
    showDownload: false,
    showSegmentButton: false,
  };
  assetDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 193px)',
  };

  attendanceDataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'AttendanceLogs',
    expand: 'shift,employee($expand=employeeType)',
    pageSize: 50,
  };
  attendanceToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.AttendaneTitle,
    showSearch: true,
    showRowCount: true,
    showNewButton: false,
    showDownload: false,
    showSegmentButton: false,
  };
  attendanceDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 193px)',
  };

  constructor(
    private rolePermissionService: RolePermissionService,
    private commonService: CommonService,
    private mediaService: MediaService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private toastService: ToastService,
    public dateFormate: DateFormatterService,
    public theme: ThemeService
  ) {
    this.odata = commonService.odata;
    this.api = commonService.api;
  }

  ngOnInit(): void {
    this.fetchEmployeeData();
    this.getEmployeeNotice();
    this.noticeColumns = this.buildNoticeColumns();
    this.payrollColumns = this.buildPayrollColumns();
    this.assetColumns = this.buildAssetColumns();
    this.attendanceColumns = this.buildAttendanceColumns();
  }

  fetchEmployeeData() {
    this.loading = true;
    this.authService.getUser().subscribe({
      next: (res: any) => {
        this.loading = false;
        this.employee = res.employee;
        this.fetchShiftFromRosterOrEmployee(this.employee?.id);
        if (this.employee?.id) {
          this.fetchEmployeeInfo(this.employee?.id);
        }
      },
      error: (err) => {
        console.error("Error fetching employee data:", err);
        this.loading = false;
      },
    });
  }

  fetchEmployeeInfo(id: number | null | undefined) {
    if (!id) return;

    this.loading = true;
    this.commonService
      .get(
        `Employees/${id}?$expand=employeeHasAssets($expand=asset),leaves($expand=leavetype,employee),notices($filter=is_active eq true;$orderby=id desc),media,supervisor,department,shift,designation`,
        true
      )
      .subscribe({
        next: (res: any) => {
          this.selectedEmployee = res;
          this.setEmployeeSummaryUI(res.id);
          const media = (this.selectedEmployee.media ?? []).find(
            (item: any) => item.is_standard === true
          );
          this.userImg = media
            ? `${environment.ServerApi}/storage/${media.id}/${media.file_name}`
            : "";
          if (this.EmployeeStatus) {
            this.loading = false;
          } else {
            this.initEmployeeStatus(id);
          }
          this.employeeHasAssets = (res.employeeHasAssets || []).map(
            (item: any) => new EmployeeHasAsset().deserialize(item)
          );

          this.headerTitleAsset = `Asset (${this.employeeHasAssets.length})`;
          this.assetToolbarConfig = { ...this.assetToolbarConfig, headerTitle: this.headerTitleAsset };
          this.PayrollsList = this.selectedEmployee?.payrolls || [];
          this.notisList = this.selectedEmployee?.notices || [];
          this.fetchEmployeeLoadData();
        },
        error: (err) => {
          console.error("Error fetching employee data:", err);
          this.loading = false;
        },
      });
  }

  setEmployeeSummaryUI(employeeId: number | undefined) {
    if (!employeeId || !this.EmployeeStatus?.leaveStatus?.leaveInYear) {
      this.leaveList = [];
      this.totalLeaves = 0;
      return;
    }
    this.leaveList = this.EmployeeStatus.leaveStatus.leaveInYear.map(
      (leave: any) => ({
        name: leave.leave_type?.name ?? 'Unknown',
        total: leave.total ?? 0,
      })
    );
    this.totalLeaves = this.leaveList.reduce((sum, leave) => sum + leave.total, 0);
  }

  fetchShiftFromRosterOrEmployee(id: number) {
    const today = moment().format("YYYY-MM-DD");
    this.commonService
      .get(`AttendanceLogs?$expand=shift&$filter=employee_id eq ${id} and attendance_date eq ${today}&$top=1&$orderby=check_in_time desc`, true)
      .subscribe({
        next: (res: any) => {
          this.selectedEmployee.checkInInfo = res.value[0];
          this.employeeCheckInTime = res.value[0]?.check_in_time;
          this.employeeCheckOutTime = res.value[0]?.check_out_time;
        },
        error: (err) => {
          console.error("Shift check error", err);
        },
      });
  }

  initEmployeeStatus(employeeId: number | undefined) {
    const startDate = moment(this.employee.created_at).format("DD-MM-YYYY");
    const endDate = moment().format("DD-MM-YYYY");
    this.commonService
      .get(`employePayrollStatus/${employeeId}/${startDate}/${endDate}`, false)
      .subscribe({
        next: (res: any) => {
          this.EmployeeStatus = res;
          this.loading = false;
          this.setEmployeeSummaryUI(employeeId);
        },
        error: (err: any) => {
          console.error("Error fetching employee data:", err);
          this.loading = false;
        },
      });
  }

  formatJoiningDate(value: string | null | undefined): string {
    if (!value) return "";
    const parsed = moment.utc(value);
    return parsed.isValid() ? parsed.format("DD-MM-YYYY") : value;
  }

  fetchEmployeeLoadData() {
    setTimeout(() => {
      this.cdr.detectChanges();
      this.noticeTable?.refreshGridData(true);
    });
  }

  private buildNoticeColumns(): AgGridTableColumn<any>[] {
    return [
      {
        colId: 'notice_title',
        headerName: $localize`Title`,
        minWidth: 300,
        valueGetter: (params: any) => params.data?.notice?.title ?? '',
      },
      {
        colId: 'notice_created_at',
        headerName: $localize`Created On`,
        minWidth: 130,
        dataType: GridTableColumnDataType.Date,
        valueGetter: (params: any) => params.data?.notice?.created_at ?? '',
        valueFormatter: ({ value }: any) =>
          value
            ? this.dateFormate.formatDate(value, true, false, false, false, false)
            : '',
      },
      {
        field: 'actions',
        headerName: $localize`Actions`,
        width: 90,
        minWidth: 90,
        pinned: 'right',
        lockPinned: true,
        sortable: false,
        filter: false,
        floatingFilter: false,
        editable: false,
        cellRenderer: AgGridActionCellRendererComponent,
        cellRendererParams: {
          actions: [
            {
              id: 'info',
              label: '',
              icon: 'information',
              tooltip: $localize`View`,
              design: 'Transparent',
            },
          ] as AgGridTableRowAction<any>[],
          onAction: (actionId: string, row: any) => {
            if (actionId === 'info') this.viewNotice(row);
          },
        },
      },
    ];
  }

  private buildPayrollColumns(): AgGridTableColumn<any>[] {
    return [
      {
        field: 'basic_salary',
        headerName: $localize`Basic Salary`,
        minWidth: 130,
      },
      {
        field: 'total_deductions',
        headerName: $localize`Total Deductions`,
        minWidth: 150,
      },
      {
        field: 'bonuses',
        headerName: $localize`Bonus`,
        minWidth: 120,
      },
      {
        field: 'allowances',
        headerName: $localize`Allowance`,
        minWidth: 120,
      },
      {
        field: 'status',
        headerName: $localize`Payment Status`,
        minWidth: 140,
      },
      {
        field: 'payment_method',
        headerName: $localize`Payment Method`,
        minWidth: 150,
      },
      {
        field: 'hr_notes',
        headerName: $localize`Hr Notes`,
        minWidth: 150,
      },
      {
        field: 'net_salary',
        headerName: $localize`Net Salary`,
        minWidth: 130,
        valueFormatter: (params: any) => `${Math.max(0, Number(params.value ?? 0))}`,
      },
      {
        field: 'processed_at',
        headerName: $localize`Process Date`,
        minWidth: 130,
        dataType: GridTableColumnDataType.Date,
        valueFormatter: ({ value }: any) =>
          value
            ? this.dateFormate.formatDate(value, true, false, false, false, false)
            : '',
      },
    ];
  }

  private buildAssetColumns(): AgGridTableColumn<any>[] {
    return [
      {
        colId: 'asset_name',
        headerName: $localize`Asset`,
        minWidth: 150,
        valueGetter: (params: any) => params.data?.asset?.name ?? '',
      },
      {
        field: 'issued_date',
        headerName: $localize`Issue Date`,
        minWidth: 130,
      },
      {
        field: 'return_date',
        headerName: $localize`Return Date`,
        minWidth: 130,
      },
      {
        field: 'remarks',
        headerName: $localize`Remarks`,
        minWidth: 150,
      },
      {
        field: 'note',
        headerName: $localize`Note`,
        minWidth: 150,
      },
    ];
  }


  private buildAttendanceColumns(): AgGridTableColumn<any>[] {
    return [
      {
        colId: 'employee.employee_no',
        headerName: $localize`Employee No`,
        minWidth: 130,
        valueGetter: (params: any) => params.data?.employee?.employee_no ?? '',
      },
      {
        colId: 'employee.first_name',
        headerName: $localize`First Name`,
        minWidth: 130,
        valueGetter: (params: any) => params.data?.employee?.first_name ?? '',
      },
      {
        colId: 'employee.last_name',
        headerName: $localize`Last Name`,
        minWidth: 130,
        valueGetter: (params: any) => params.data?.employee?.last_name ?? '',
      },
      {
        colId: 'employee.employeeType.name',
        headerName: $localize`Emp Type`,
        minWidth: 120,
        valueGetter: (params: any) => params.data?.employee?.employeeType?.name ?? '',
      },
      {
        colId: 'type',
        headerName: $localize`Type`,
        minWidth: 110,
        filter: false,
        floatingFilter: false,
        cellRenderer: AgGridStatusBadgeComponent,
        valueGetter: (params: any) => (params.data?.is_ot ? 'EXTRA' : 'REGULAR'),
      },
      {
        field: 'attendance_date',
        headerName: $localize`Attendance Date`,
        minWidth: 140,
        dataType: GridTableColumnDataType.Date,
        valueFormatter: ({ value }: any) =>
          value
            ? this.dateFormate.formatDate(value, true, false, false, false, false)
            : '',
      },
      {
        field: 'check_in_time',
        headerName: $localize`Check-In Time`,
        minWidth: 130,
        valueFormatter: (params: any) =>
          params.value
            ? this.dateFormate.formatDate(params.value, false, true, true, true, true, true)
            : '',
      },
      {
        field: 'check_out_time',
        headerName: $localize`Check-Out Time`,
        minWidth: 130,
        valueFormatter: (params: any) =>
          params.value
            ? this.dateFormate.formatDate(params.value, false, true, true, true, true, true)
            : '',
      },
      {
        colId: 'working_hour',
        headerName: $localize`Working Hour`,
        minWidth: 130,
        filter: false,
        floatingFilter: false,
        valueGetter: (params: any) =>
          calculateTotalHours(params.data?.check_in_time, params.data?.check_out_time),
      },
      {
        colId: 'shift.name',
        headerName: $localize`Shift`,
        minWidth: 120,
        valueGetter: (params: any) => params.data?.shift?.name ?? '',
        cellRenderer: AgGridDynamicColorBadgeComponent,
        cellRendererParams: {
          colorAccessor: (data: any) => data?.shift?.color,
        },
      },
      {
        field: 'status',
        headerName: $localize`Status`,
        minWidth: 100,
        cellRenderer: AgGridStatusBadgeComponent,
        filterControl: {
          type: 'multiSelect',
          options: [
            { value: 'VALID', label: 'VALID' },
            { value: 'INVALID', label: 'INVALID' },
          ],
        },
      },
      {
        colId: 'overtime',
        headerName: $localize`Overtime`,
        minWidth: 130,
        filter: false,
        floatingFilter: false,
        valueGetter: (params: any) =>
          calculateHoursFromMinutes(params.data?.overtime_minutes, params.data?.over_time || '0h 0m'),
      },
      {
        field: 'created_at',
        headerName: $localize`Created On`,
        minWidth: 130,
        dataType: GridTableColumnDataType.Date,
        valueFormatter: ({ value }: any) =>
          value
            ? this.dateFormate.formatDate(value, true, false, false, false, false)
            : '',
      },
    ];
  }

  getEmployeeNotice() {
    this.commonService.get(`NoticesEmployees`).subscribe({
      next: (res: any) => {
        this.allNoticeEmployees = res.value;
      },
      error: (err) => {
        console.error("Error fetching employee notices:", err);
      },
    });
  }

  viewPayrollDetails(payroll: any) {
    this.payrolloverview.payrollData = payroll;
    this.payrolloverview.openDialog();
  }

  viewNotice(data: any) {
    this.viewNoticeData = new Notice().deserialize(data.notice ?? data);
    this.NoticeEmployeeList = new NoticeEmployee().deserialize(data);
    this.isViewOpen = true;
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  markAsRead(noticesEmployeeId: number) {
    return this.commonService.post(
      `hrm/NoticesEmployees/${noticesEmployeeId}/mark-as-read`,
      {},
      this.api
    );
  }

  onReadChange(event: any) {
    if (event.target.checked) {
      this.UpdateRead();
    }
  }

  UpdateRead() {
    this.isRead = true;
    if (this.NoticeEmployeeList.id) {
      this.markAsRead(this.NoticeEmployeeList.id).subscribe({
        next: (res: any) => {
          this.NoticeEmployeeList.is_read = true;
          this.ToastType = "read";
          this.toastService.show(this.ToastType);
          this.getEmployeeNotice();
          this.noticeTable?.refreshGridData(true);
          this.isRead = false;
        },
        error: (err) => {
          console.error("Mark as read failed", err);
        },
      });
    }
  }

  downloadPayrollSlip(payroll: any) {
    if (!payroll) {
      console.warn("Payroll data is not available");
      return;
    }
    const payload: any = {
      employee_id: payroll.employee_id,
      payroll_id: payroll.id,
      template: "payslip-pdf",
      total_attendance:
        this.EmployeeStatus?.employeeAttendance?.totalAttendenceInMonth ?? 0,
    };

    this.commonService
      .post<Blob>("pdf/generate", payload, this.api, undefined, "blob")
      .subscribe({
        next: (res: Blob) => {
          const filename = `Payroll_Slip_${payroll.employee?.first_name}.pdf`;
          const blob = new Blob([res], { type: "application/pdf" });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        },
        error: (err) => {
          console.error("Failed to generate PDF", err);
        },
      });
  }

  userSettings() {
    this.employeeSettings.open = true;
  }

  // Tabs load their data lazily on first click rather than all at once —
  // seeded with the persisted tab so a reload still shows its content immediately.
  private visitedTabs = new Set<string>([localStorage.getItem('emp_desh_tab') ?? 'My_Profile']);

  onChangeTab(event: any) {
    const selectedTab = event.detail.tab;
    const text = selectedTab.getAttribute('text') ?? '';
    const tabKey = text.trim().replace(/\s+/g, '_');
    localStorage.setItem('emp_desh_tab', tabKey);
    this.visitedTabs.add(tabKey);
  }

  selectedTab(tabIndex: string) {
    return localStorage.getItem('emp_desh_tab') == tabIndex;
  }

  isTabLoaded(tabIndex: string): boolean {
    return this.visitedTabs.has(tabIndex);
  }


  CloseDialog() {
    this.isViewOpen = false;
    this.viewNoticeData = new Notice();
    this.NoticeEmployeeList = new NoticeEmployee();
  }
}
