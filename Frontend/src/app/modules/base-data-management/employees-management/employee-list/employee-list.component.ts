import { Component, EventEmitter, Output, ViewChild } from "@angular/core";
import { Employee } from "@shared/model/employee";
import { saveMode } from "@shared/enums/saveMode";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { EmployeeFormComponent } from "@base-data-module/employees-management/employee-form/employee-form.component";
import { Localization } from "@app/shared/utilities/localization";
import { Permissions } from "@app/shared/enums/permissions";
import { CommonService } from "@app/services/common-service/common.service";
import { ToastService } from "@app/services/toast-service/toast.service";
import moment from "moment";
import { ActivityLog } from "@shared/model/activitylog";
import { EmployeeSalary } from "@app/modules/hr-management/shared/models/EmployeeSalary";
import {
  AgGridTableCellEditEvent,
  AgGridTableColumn,
  AgGridTableComponent,
} from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import { AgGridBooleanCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component";
import {
  AgGridMultiSelectData,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  AgGridToolbarFilter,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { AgGridTableToolbarActionEvent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
@Component({
  selector: "app-employee-list",
  templateUrl: "./employee-list.component.html",
  styleUrl: "./employee-list.component.scss",
})
export class EmployeeListComponent {
  @ViewChild("employeeForm") employeeFormRef!: EmployeeFormComponent;
  @ViewChild("employeeAssetTableEdit")
  employeeAssetTableEdit!: AgGridTableComponent;
  @ViewChild("agGridTable") agGridTable!: AgGridTableComponent;
  @Output() IsInsertXls: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsExportXls: EventEmitter<void> = new EventEmitter<void>();
  EmployList = Employee;
  EmployeeData = new Employee();
  EmployeeID: any;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();
  column: any;
  isDelete: boolean = false;
  isLoading: boolean = false;
  ToastType: string = "";
  insertTitle: string = $localize`New`;
  public localization = Localization;
  headerTitle: string = `${$localize`Employee`} ${$localize`List`}`;
  public saveMode: string = saveMode.POST;
  public permissions = Permissions;
  selectedEmployees: any[] = [];
  selectedEmployeeIds: number[] = [];
  selectedEmployeeCount: number = 0;
  selectedEmployeeRowIndexes: Record<number, number> = {};
  isBulkStatusDialogOpen: boolean = false;
  isBulkStatusLoading: boolean = false;
  bulkEmployeeStatus: boolean = true;
  selectedEmployeesDataSource: AgGridTableODataSourceConfig<any> = {
    type: "odata",
    endpoint: "",
    staticData: true,
    data: [],
  };
  selectedEmployeesToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: "Selected Employees",
    showNewButton: false,
    showSearch: true,
    showRowCount: false,
    showSegmentButton: false,
    showDownload: false,
  };
  selectedEmployeesDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: "360px",
  };
  showEmployeeLog: boolean = false;
  selectedEmployeeLogTab: "overview" | "payroll" | "activity" = "overview";
  selectedEmployeeForLog: any | null = null;
  employeePayrollStatusInfo: any = null;
  employeeActivityLogs: ActivityLog[] = [];
  employeeLogDateRange: string = "";
  employeeLogStart: string = "";
  employeeLogEnd: string = "";
  employeeLogMaxDate: string = "";
  isEmployeeLogExporting: boolean = false;
  isEmployeeLogLoading: boolean = false;
  employeeLogError: string = "";
  private readonly employeeLogSwitchStorageKey =
    "employee-list-show-employee-log";
  private employeeLogCache = new Map<
    string,
    {
      employeePayrollStatusInfo: any;
      employeeActivityLogs: ActivityLog[];
    }
  >();

  private EmployeeLogCheck: string = "";
  private employeeLogLoaded: string = "";
  selectedRowIndexes: Record<number, boolean> = {};

  selectedEmployeeColumn: AgGridTableColumn<any>[] = [];
  DesignationLists: { id: number; name: string }[] = [];
  DesignationFilterLists: { value: number; text: string }[] = [];
  DepartmentLists: { id: number; name: string }[] = [];
  GroupLists: { id: number; name: string }[] = [];

  private selectedDepartmentIds: number[] = [];
  private selectedDesignationIds: number[] = [];

  columns: AgGridTableColumn<any>[] = [];
  gridId: string = "employee-list";
  employeeLogToolbarFilters: AgGridToolbarFilter[] = [];

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: "odata",
    endpoint: "Employees",
    expand:
      "media,assets,salary,department,supervisor,designation,employeeType,employeeSection,group",
    searchFields: [
      "employee_no",
      "first_name",
      "last_name",
      "email",
      "contact_number",
    ],
    pageSize: 50,
    sortBy: "created_at",
    sortDirection: "desc",
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: "Employees",
    showSearch: true,
    showRowCount: true,
    showDownload: true,
    showUpload: true,
    showSegmentButton: true,
    addButtonText: 'New',
    showNewButton:
      this.rolePermissionService.hasPermission(
        Permissions.BASE_DATA_EMPLOYEE_ADD,
      ) ||
      this.rolePermissionService.hasPermission(
        Permissions.HR_EMPLOYEE_CREATE,
      ),
  };

  constructor(
    public rolePermissionService: RolePermissionService,
    private commonservices: CommonService,
    private toastService: ToastService,
  ) {
    this.columns = this.buildColumns();
    this.selectedEmployeeTableColum();
    this.initDepartements();
    this.initDesignations();
    this.initGroups();
    this.restoreEmployeeLogSwitchState();
    this.initEmployeeLogDateRange();
    this.employeeLogToolbarFilters = [
      { id: 'employeeLog', type: 'switch', label: 'Report', defaultChecked: this.showEmployeeLog },
    ];
  }

  activeInactiveFunction() {
    if (!this.selectedEmployeeCount) {
      return;
    }

    this.bulkEmployeeStatus = true;
    this.isBulkStatusDialogOpen = true;
    setTimeout(() => this.syncSelectedEmployeesTable());
  }

  onEmployeeLogSwitchChange(checked: boolean) {
    this.showEmployeeLog = !!checked;
    this.persistEmployeeLogSwitchState();
    if (this.showEmployeeLog && this.selectedEmployeeForLog?.id) {
      this.selectedEmployeeLogTab = "overview";
      this.loadEmployeeLogData(this.selectedEmployeeForLog.id);
    }
  }

  onEmployeeLogToolbarAction(event: AgGridTableToolbarActionEvent) {
    if (event.actionId === 'filter:employeeLog') {
      this.onEmployeeLogSwitchChange(event.value as boolean);
    }
  }

  onEmployeeLogTabChange(tab: "payroll" | "overview" | "activity") {
    this.selectedEmployeeLogTab = tab;
  }

  initEmployeeLogDateRange() {
    this.employeeLogStart = moment()
      .subtract(1, "month")
      .startOf("day")
      .toISOString();
    this.employeeLogEnd = moment().endOf("day").toISOString();
    this.employeeLogMaxDate = moment().format("DD-MM-YYYY");
    this.employeeLogDateRange = `${moment(this.employeeLogStart).format("DD-MM-YYYY")} - ${moment(this.employeeLogEnd).format("DD-MM-YYYY")}`;
  }

  onEmployeeLogDateRangeChange(event: any) {
    this.employeeLogDateRange =
      event?.detail?.value ?? this.employeeLogDateRange;
    const [startDate, endDate] = (this.employeeLogDateRange || "").split(" - ");
    if (!startDate || !endDate) {
      return;
    }

    this.employeeLogStart = moment(startDate, "DD-MM-YYYY")
      .startOf("day")
      .toISOString();
    this.employeeLogEnd = moment(endDate, "DD-MM-YYYY")
      .endOf("day")
      .toISOString();

    if (this.showEmployeeLog && this.selectedEmployeeForLog?.id) {
      this.loadEmployeeLogData(this.selectedEmployeeForLog.id);
    }
  }

  exportEmployeeLog() {
    const employeeId = this.selectedEmployeeForLog?.id;
    if (!employeeId || !this.canExportEmployeeLog()) {
      return;
    }

    this.isEmployeeLogExporting = true;
    const start = moment(this.employeeLogStart).format("YYYY-MM-DD");
    const end = moment(this.employeeLogEnd).format("YYYY-MM-DD");

    this.commonservices
      .post<Blob>(
        `employee-log/export-pdf`,
        {
          employee_id: employeeId,
          start: this.employeeLogStart,
          end: this.employeeLogEnd,
        },
        false,
        undefined,
        "blob",
      )
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `employee-log-${start}-to-${end}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          this.isEmployeeLogExporting = false;
        },
        error: (error: any) => {
          console.error("Error exporting employee log", error);
          this.isEmployeeLogExporting = false;
        },
      });
  }

  exportEmployeeListPdf() {
    if (!this.selectedEmployeeIds.length || this.isEmployeeLogExporting) return;

    this.isEmployeeLogExporting = true;
    this.commonservices
      .post<Blob>(
        `employee-log/export-list-pdf`,
        {
          employee_ids: this.selectedEmployeeIds,
          start: this.employeeLogStart,
          end: this.employeeLogEnd,
        },
        false,
        undefined,
        "blob",
      )
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          const startLabel = moment(this.employeeLogStart).format("YYYY-MM-DD");
          const endLabel = moment(this.employeeLogEnd).format("YYYY-MM-DD");
          a.download = `employee-report-${startLabel}-to-${endLabel}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          this.isEmployeeLogExporting = false;
        },
        error: (error: any) => {
          console.error("Error exporting employee list", error);
          this.isEmployeeLogExporting = false;
        },
      });
  }

  canExportEmployeeLog(): boolean {
    const employeeId = this.selectedEmployeeForLog?.id;
    if (
      !employeeId ||
      !this.employeeLogStart ||
      !this.employeeLogEnd ||
      this.isEmployeeLogLoading ||
      this.isEmployeeLogExporting
    ) {
      return false;
    }

    return this.employeeLogLoaded === this.getEmployeeLogCacheKey(employeeId);
  }

  get isMultipleEmployeesSelected(): boolean {
    return this.selectedEmployeeCount > 1;
  }

  onRowSelect(clickedEmployee: any) {
    if (!clickedEmployee) return;
    this.selectedEmployeeForLog = clickedEmployee;
    if (this.showEmployeeLog && clickedEmployee?.id) {
      this.selectedEmployeeLogTab = "overview";
      this.loadEmployeeLogData(clickedEmployee.id);
    }
  }

  onSelectionChanged(rows: any[]) {
    this.selectedEmployees = rows;
    this.selectedEmployeeIds = rows.map((emp: any) => emp.id);
    this.selectedEmployeeCount = rows.length;

    if (!this.selectedEmployeeForLog && rows.length) {
      this.selectedEmployeeForLog = rows[0];
    } else if (
      this.selectedEmployeeForLog &&
      !rows.some((r: any) => r.id === this.selectedEmployeeForLog?.id)
    ) {
      this.selectedEmployeeForLog = rows[0] ?? null;
    }

    this.toolbarConfig = {
      ...this.toolbarConfig,
      showExtraButton: rows.length > 0,
      extraButtonText: rows.length ? `Action (${rows.length})` : 'Action',
      extraButtonDisable: rows.length === 0,
    };

    this.syncSelectedEmployeesTable();
  }

  isEmployeeLogTabSelected(tab: "payroll" | "overview" | "activity"): boolean {
    return this.selectedEmployeeLogTab === tab;
  }

  getSelectedEmployeeLogDisplayName(): string {
    const employee = this.selectedEmployeeForLog;
    if (!employee) {
      return "Select an employee";
    }

    const name = [employee.first_name, employee.last_name]
      .filter(Boolean)
      .join(" ");
    return `${name || "Employee"}${employee.employee_no ? ` (${employee.employee_no})` : ""}`;
  }

  getSelectedEmployeePayrollLogSummary(): Array<{
    label: string;
    value: string;
  }> {
    const latest = this.employeePayrollStatusInfo || {};
    const employee = this.selectedEmployeeForLog || {};

    return [
      {
        label: "Total Salary",
        value: this.formatMoneyValue(
          latest?.employeeSalary?.total_salary ??
            latest?.employeeSalary?.totalSalary ??
            latest?.grossSalary ??
            employee?.salary?.total_salary ??
            employee?.salary?.totalSalary,
        ),
      },
      {
        label: "Attendance",
        value: this.formatMoneyValue(
          latest?.employeeAttendance?.totalAttendenceInMonth ??
            latest?.employeeAttendance?.totalAttendance ??
            latest?.total_attendance,
        ),
      },
      {
        label: "Holiday",
        value: this.formatMoneyValue(latest?.employeeAttendance?.holiday),
      },
      {
        label: "Night Shift Attendances",
        value: this.formatMoneyValue(
          latest?.employeeAttendance?.nightShiftAttendances,
        ),
      },
      { label: "Total Bonus", value: this.formatMoneyValue(latest?.bonuses) },
      {
        label: "Overtime Bonus",
        value: this.formatMoneyValue(latest?.overtime ?? 0),
      },
      {
        label: "Side Bill",
        value: this.formatMoneyValue(
          latest?.sideBill ??
            latest?.side_bill ??
            latest?.employeeBonuses?.sideBill ??
            0,
        ),
      },
      {
        label: "Night Shift Bonus",
        value: this.formatMoneyValue(
          latest?.employeeBonuses?.nightShiftAttendenceBonus ??
            latest?.nightshift_bonus,
        ),
      },
      {
        label: "Attendance Bonus",
        value: this.formatMoneyValue(
          latest?.employeeBonuses?.attendenceBonuses ??
            latest?.attendance_bonus,
        ),
      },
      {
        label: "Payable Days",
        value: this.formatMoneyValue(latest?.total_payable_days),
      },
      {
        label: "Leave Balance",
        value: this.formatMoneyValue(latest?.leaveStatus?.leaveBalance),
      },
      {
        label: "Total Weekend",
        value: this.formatMoneyValue(latest?.total_weekend),
      },
    ];
  }

  getSelectedEmployeeOverviewSummary(): Array<{
    label: string;
    value: string;
  }> {
    const employee = this.selectedEmployeeForLog || {};
    return [
      { label: "Department", value: this.getSelectedEmployeeDepartment() },
      { label: "Designation", value: this.getSelectedEmployeeDesignation() },
      { label: "Status", value: this.getSelectedEmployeeStatus() },
      { label: "Supervisor", value: this.getSelectedEmployeeSupervisor() },
      { label: "Joined Date", value: this.getSelectedEmployeeJoinedDate() },
      { label: "Email", value: this.getSelectedEmployeeEmail() },
      { label: "Phone", value: this.getSelectedEmployeePhone() },
      { label: "Salary", value: this.getSelectedEmployeeSalary() },
    ];
  }

  getSelectedEmployeeLeaveStatusSummary(): Array<{
    label: string;
    value: string;
  }> {
    const latest = this.employeePayrollStatusInfo || {};
    const leaveStatus = latest?.leaveStatus || {};
    const leaveTypes = Array.isArray(leaveStatus?.leaveTypes)
      ? leaveStatus.leaveTypes
      : [];
    const getLeaveDays = (leaveName: string) => {
      const matchedLeave = leaveTypes.find(
        (leave: any) =>
          (leave?.name || "").toLowerCase() === leaveName.toLowerCase(),
      );

      return matchedLeave?.days;
    };

    return [
      {
        label: "Leave Balance",
        value: this.formatMoneyValue(leaveStatus?.leaveBalance),
      },
      {
        label: "Leave in Year",
        value: this.formatMoneyValue(
          Array.isArray(leaveStatus?.leaveInYear)
            ? leaveStatus.leaveInYear.length
            : leaveStatus?.leaveInYear,
        ),
      },
      {
        label: "Leave in Month",
        value: this.formatMoneyValue(
          Array.isArray(leaveStatus?.leaveInMonth)
            ? leaveStatus.leaveInMonth.length
            : leaveStatus?.leaveInMonth,
        ),
      },
      {
        label: "Medical Leave",
        value: this.formatMoneyValue(getLeaveDays("Medical Leave")),
      },
      {
        label: "Casual Leave",
        value: this.formatMoneyValue(getLeaveDays("Casual Leave")),
      },
    ];
  }

  getSelectedEmployeeActivityLogs(): Array<{
    title: string;
    subtitle: string;
  }> {
    return this.employeeActivityLogs.map((log) => ({
      title: `${this.getActivityLogActionLabel(log.action_type)} - ${log.model_custom_id || log.model_id || "-"}`,
      subtitle: log.created_at
        ? moment(log.created_at).format("DD-MM-YYYY hh:mm A")
        : "-",
    }));
  }

  private formatMoneyValue(value: any): string {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    return `${value}`;
  }

  private getActivityLogActionLabel(actionType: string): string {
    if (actionType === "insert") return "Created";
    if (actionType === "delete") return "Deleted";
    return "Updated";
  }

  private restoreEmployeeLogSwitchState() {
    try {
      const storedValue = window.localStorage.getItem(
        this.employeeLogSwitchStorageKey,
      );
      this.showEmployeeLog = storedValue === "true";
    } catch (error) {
      this.showEmployeeLog = false;
    }
  }

  private persistEmployeeLogSwitchState() {
    try {
      window.localStorage.setItem(
        this.employeeLogSwitchStorageKey,
        String(this.showEmployeeLog),
      );
    } catch (error) {
      // Ignore storage failures so the UI still works normally.
    }
  }

  private loadEmployeeLogData(employeeId: number) {
    const cacheKey = this.getEmployeeLogCacheKey(employeeId);
    this.EmployeeLogCheck = cacheKey;
    const cached = this.employeeLogCache.get(cacheKey);
    if (cached) {
      this.employeePayrollStatusInfo = cached.employeePayrollStatusInfo;
      this.employeeActivityLogs = cached.employeeActivityLogs;
      this.employeeLogError = "";
      this.employeeLogLoaded = cacheKey;
      this.isEmployeeLogLoading = false;
      return;
    }

    this.isEmployeeLogLoading = true;
    this.employeeLogLoaded = "";
    this.employeeLogError = "";
    const start = moment(this.employeeLogStart).format("DD-MM-YYYY");
    const end = moment(this.employeeLogEnd).format("DD-MM-YYYY");

    this.commonservices
      .get(`employePayrollStatus/${employeeId}/${start}/${end}`, false)
      .subscribe({
        next: (res: any) => {
          if (this.EmployeeLogCheck !== cacheKey) {
            return;
          }

          this.employeePayrollStatusInfo = res || {};
          this.employeeActivityLogs = [];

          this.commonservices
            .get(
              `ActivityLogs?$expand=user&$filter=model_type eq 'App\\\\Models\\\\Employee' and model_id eq ${employeeId}&$orderby=created_at desc&$top=5`,
              true,
            )
            .subscribe({
              next: (activityRes: any) => {
                if (this.EmployeeLogCheck !== cacheKey) {
                  return;
                }

                this.employeeActivityLogs = (activityRes?.value ?? []).map(
                  (item: any) => new ActivityLog().deserialize(item),
                );
                this.employeeLogCache.set(cacheKey, {
                  employeePayrollStatusInfo: this.employeePayrollStatusInfo,
                  employeeActivityLogs: this.employeeActivityLogs,
                });
                this.employeeLogLoaded = cacheKey;
                this.isEmployeeLogLoading = false;
              },
              error: (error: any) => {
                if (this.EmployeeLogCheck !== cacheKey) {
                  return;
                }

                console.error("Error loading activity logs", error);
                this.employeeActivityLogs = [];
                this.employeeLogCache.set(cacheKey, {
                  employeePayrollStatusInfo: this.employeePayrollStatusInfo,
                  employeeActivityLogs: this.employeeActivityLogs,
                });
                this.employeeLogLoaded = cacheKey;
                this.isEmployeeLogLoading = false;
              },
            });
        },
        error: (error: any) => {
          if (this.EmployeeLogCheck !== cacheKey) {
            return;
          }

          console.error("Error loading employee payroll status", error);
          this.employeeLogError = "Unable to load employee payroll status.";
          this.employeePayrollStatusInfo = null;
          this.employeeLogLoaded = "";
          this.isEmployeeLogLoading = false;
        },
      });
  }

  private getEmployeeLogCacheKey(employeeId: number): string {
    const start = this.employeeLogStart || "";
    const end = this.employeeLogEnd || "";
    return `${employeeId}|${start}|${end}`;
  }

  getSelectedEmployeeDepartment(): string {
    const employee = this.selectedEmployeeForLog;
    return employee?.department?.name || employee?.department_name || "-";
  }

  getSelectedEmployeeDesignation(): string {
    const employee = this.selectedEmployeeForLog;
    return employee?.designation?.name || employee?.designation_name || "-";
  }

  getSelectedEmployeeSupervisor(): string {
    const employee = this.selectedEmployeeForLog;
    const supervisor = employee?.supervisor;
    const supervisorName = [supervisor?.first_name, supervisor?.last_name]
      .filter(Boolean)
      .join(" ");
    return supervisorName || employee?.supervisor_name_format || "-";
  }

  getSelectedEmployeeStatus(): string {
    const employee = this.selectedEmployeeForLog;
    if (employee?.is_active === true || employee?.is_active === 1) {
      return "Active";
    }

    if (employee?.is_active === false || employee?.is_active === 0) {
      return "Inactive";
    }

    return "-";
  }

  getSelectedEmployeeJoinedDate(): string {
    const employee = this.selectedEmployeeForLog;
    const value = employee?.joining_date || employee?.created_at;
    return value ? moment(value).format("DD-MM-YYYY") : "-";
  }

  getSelectedEmployeeEmail(): string {
    return this.selectedEmployeeForLog?.email || "-";
  }

  getSelectedEmployeePhone(): string {
    return this.selectedEmployeeForLog?.contact_number || "-";
  }

  getSelectedEmployeeSalary(): string {
    const salary = this.selectedEmployeeForLog?.salary?.total_salary;
    return salary !== undefined && salary !== null ? String(salary) : "-";
  }

  handleEmployeeTableData(event: any) {
    const visibleRows = Array.isArray(event?.[0]) ? event[0] : [];

    if (!this.selectedEmployeeForLog && visibleRows.length && this.showEmployeeLog) {
      const firstEmployee = visibleRows[0];
      this.selectedEmployeeForLog = firstEmployee;
      if (firstEmployee?.id) {
        this.selectedEmployeeLogTab = 'overview';
        this.loadEmployeeLogData(firstEmployee.id);
      }
    }
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    const cols: AgGridTableColumn<any>[] = [
      {
        field: "is_active",
        headerName: $localize`Active`,
        width: 90,
        minWidth: 80,
        cellRenderer: AgGridBooleanCellRendererComponent,
        sortable: false,
        filter: false,
      },

      {
        field: "employee_no",
        headerName: $localize`Employee ID`,
        minWidth: 130,
      },

      {
        field: "first_name",
        headerName: $localize`First Name`,
        minWidth: 150,
        sortable: false,
        editor: { type: "text" },
      },

      {
        field: "last_name",
        headerName: $localize`Last Name`,
        minWidth: 150,
        sortable: false,
        editor: { type: "text" },
      },

      {
        field: "email",
        headerName: $localize`Email`,
        minWidth: 220,
        sortable: false,
        editor: { type: "text" },
      },

      {
        field: "contact_number",
        headerName: $localize`Contact Number`,
        minWidth: 150,
        sortable: false,
        editor: { type: "text" },
      },

      {
        colId: "designation.id",
        headerName: $localize`Designation`,
        minWidth: 180,
        sortable: false,

        valueGetter: (params: any) => params.data?.designation?.name ?? "",

        filterControl: {
          type: "multiSelect",
          options: this.DesignationFilterLists,
          placeholder: $localize`Filter designation`,
        },
        editor: {
          type: "select",
          options: this.DesignationLists,
        },
      },

      {
        colId: "department.id",
        headerName: $localize`Department`,
        minWidth: 180,
        sortable: false,

        valueGetter: (params: any) => params.data?.department?.name ?? "",

        filterControl: {
          type: "multiSelect",
          options: this.DepartmentLists,
          placeholder: $localize`Filter department`,
        },
      },

      {
        colId: "group.id",
        headerName: $localize`Group`,
        minWidth: 180,
        sortable: false,

        valueGetter: (params: any) => params.data?.group?.name ?? "",

        filterControl: {
          type: "multiSelect",
          options: this.GroupLists,
          placeholder: $localize`Filter group`,
        },
      },

      {
        colId: "supervisor.id",
        headerName: $localize`Supervisor`,
        minWidth: 180,
        sortable: false,

        valueGetter: (params: any) => params.data?.supervisor?.first_name ?? "",
      },

      {
        field: "salary.total_salary",
        headerName: $localize`Total Salary`,
        minWidth: 140,
        type: "numericColumn",
        filter: "agNumberColumnFilter",
        sortable: false,

        valueGetter: (params: any) => params.data?.salary?.total_salary ?? 0,
      },

      {
        field: "created_at",
        headerName: $localize`Created On`,
        minWidth: 130,
        filter: false,
      },
    ];

    return cols;
  }

  selectedEmployeeTableColum() {
    this.selectedEmployeeColumn = [
      {
        field: "is_active",
        headerName: $localize`Active`,
        cellRenderer: AgGridBooleanCellRendererComponent,
        width: 90,
        minWidth: 80,
        filter: false,
        sortable: false,
      },
      {
        field: "employee_no",
        headerName: `${$localize`Employee`} ${$localize`ID`}`,
        minWidth: 130,
      },
      {
        field: "first_name",
        headerName: `${$localize`First`} ${$localize`Name`}`,
        minWidth: 150,
      },
      {
        field: "last_name",
        headerName: `${$localize`Last`} ${$localize`Name`}`,
        minWidth: 150,
      },
    ];
  }

  columnFilter(event: any) {}

  initDepartements() {
    this.commonservices.get("Departments", true).subscribe({
      next: (res: any) => {
        this.DepartmentLists = res.value.map((item: any) => ({
          value: item.id,
          text: item.name,
        }));
        this.columns = this.buildColumns();
      },
      error: (err) => console.error(err),
    });
  }

  initDesignations() {
    this.commonservices.get("Designations", true).subscribe({
      next: (res: any) => {
        this.DesignationLists = res.value.map((item: any) => ({
          value: item.name,
          text: item.name,
        }));
        this.DesignationFilterLists = res.value.map((item: any) => ({
          value: item.id,
          text: item.name,
        }));
        this.columns = this.buildColumns();
      },
      error: (err) => console.error(err),
    });
  }
  initGroups() {
    this.commonservices.get("EmployeeGroups", true).subscribe({
      next: (res: any) => {
        this.GroupLists = res.value.map((item: any) => ({
          value: item.id,
          text: item.name,
        }));
        this.columns = this.buildColumns();
      },
      error: (err) => console.error(err),
    });
  }
  newEmployee() {
    this.employeeFormRef.EmployeeSalary = new EmployeeSalary().deserialize({});
    this.employeeFormRef.generateCode({
      model: "employees",
      field: "employee_no",
      length: 1,
    });
    this.employeeFormRef.EmployeeName = "";
    this.employeeFormRef.selectedTab = "coreData";
    this.employeeFormRef.sameAsPresentAddress = false;
    this.employeeFormRef.employee = new Employee().deserialize({});
    this.employeeFormRef.itemAttachmentsTab.fileArr = [];
    this.employeeFormRef.itemAttachmentsTab.isEdit = false;
    this.employeeFormRef.itemAttachmentsTab.isPreview = false;
    this.employeeFormRef.open = true;
    this.employeeFormRef.resEmployeeId = null;
    this.employeeFormRef.assetSaveMode = saveMode.POST;
    this.saveMode = saveMode.POST;
  }
  editEmployee(data: any) {
    this.employeeFormRef.selectedTab = "coreData";

    const cleanedData = Object.fromEntries(
      Object.entries(data).filter(
        ([, value]) => value !== null && value !== undefined,
      ),
    );
    this.employeeFormRef.employee.deserialize(cleanedData);
    this.employeeFormRef.EmployeeSalary = data.salary
      ? new EmployeeSalary().deserialize(data.salary)
      : new EmployeeSalary().deserialize({});
    this.employeeFormRef.open = true;
    this.employeeFormRef.message_strip = false;
    this.employeeFormRef.itemAttachmentsTab.isEdit = true;
    this.employeeFormRef.itemAttachmentsTab.isPreview = true;
    this.employeeFormRef.initEmployeeStatus(data.id);
    this.employeeFormRef.departmentName = data.department
      ? data.department.name
      : "";
    this.employeeFormRef.designationName = data.designation
      ? data.designation.name
      : "";
    this.employeeFormRef.employeeTypeName = data.employeeType
      ? data.employeeType.name
      : "";
    this.employeeFormRef.employeeSectionName = data.employeeSection
      ? data.employeeSection.name
      : "";
    this.saveMode = saveMode.PUT;
    this.employeeFormRef.getEmployeeImageData();
    this.employeeFormRef.initDepartment();
    this.employeeFormRef.sameAsPresentAddress =
      data.present_address === data.present_address;

    this.employeeFormRef.resolveSupervisorName(data.supervisor_id);
    this.employeeFormRef.resEmployeeId = data.id;

    setTimeout(() => {
      this.employeeFormRef.RefreshAssetTable.emit();
    }, 0);
  }

  processData(event: any) {
    this.refreshTable.emit(event);
    this.agGridTable?.refreshGridData(true);
  }

  deleteClick(data: any) {
    this.IsDelete.emit(`Employees/${data.id}`);
  }
  uploadButtonClick(event: any) {
    this.IsInsertXls.emit();
  }

  downloadButtonClick(event: any) {
    this.IsExportXls.emit();
  }

  updateSelectedEmployeesStatus() {
    if (!this.selectedEmployeeIds.length) {
      this.closeBulkStatusDialog();
      return;
    }

    this.isBulkStatusLoading = true;
    this.commonservices
      .put(
        "employee/bulk-status-update",
        {
          employee_ids: this.selectedEmployeeIds,
          is_active: this.bulkEmployeeStatus,
        },
        false,
      )
      .subscribe({
        next: () => {
          this.toastService.show("edit");
          this.closeBulkStatusDialog();
          this.clearSelectedEmployees();
          this.agGridTable?.clearSelection();
          this.agGridTable?.refreshGridData(true);
          this.syncSelectedEmployeesTable();
        },
        error: (error: any) => {
          console.error("Error updating employee status", error);
          this.toastService.show("error");
          this.closeBulkStatusDialog();
        },
      });
  }

  removeSelectedEmployee(employee: any) {
    const id = employee?.id;
    if (id == null || this.isBulkStatusLoading) return;

    const rowIndex = this.selectedEmployeeRowIndexes[id];
    this.selectedEmployees = this.selectedEmployees.filter(
      (emp: any) => emp.id !== id,
    );
    this.selectedEmployeeIds = this.selectedEmployeeIds.filter(
      (empId: number) => empId !== id,
    );
    this.selectedEmployeeCount = this.selectedEmployeeIds.length;

    delete this.selectedEmployeeRowIndexes[id];
    if (rowIndex !== undefined) delete this.selectedRowIndexes[rowIndex];

    if (this.selectedEmployeeForLog?.id === id)
      this.selectedEmployeeForLog = this.selectedEmployees[0] ?? null;
    if (this.showEmployeeLog && this.selectedEmployeeForLog?.id)
      this.loadEmployeeLogData(this.selectedEmployeeForLog.id);

    this.agGridTable?.getGridApi()?.getRowNode(String(id))?.setSelected(false);
    this.syncSelectedEmployeesTable();
    if (!this.selectedEmployeeCount) this.closeBulkStatusDialog();
  }

  closeBulkStatusDialog() {
    this.isBulkStatusDialogOpen = false;
    this.isBulkStatusLoading = false;
  }

  resetSelection() {
    this.clearSelectedEmployees();
    this.agGridTable?.clearSelection();
    this.syncSelectedEmployeesTable();
  }

  private clearSelectedEmployees() {
    this.selectedEmployees = [];
    this.selectedEmployeeIds = [];
    this.selectedEmployeeCount = 0;
    this.selectedRowIndexes = {};
    this.selectedEmployeeRowIndexes = {};
    this.selectedEmployeeForLog = null;
  }

  private syncSelectedEmployeesTable() {
    this.selectedEmployeesDataSource = {
      ...this.selectedEmployeesDataSource,
      data: [...this.selectedEmployees],
    };
  }

  onCellEdited(event: AgGridTableCellEditEvent<Employee>): void {
    const row = event.row as any;
    if (!row?.id) return;

    // PATCH the changed field via PUT to the OData entity endpoint
    this.commonservices
      .put<any>(`Employees(${row.id})`, { [event.field]: event.newValue })
      .subscribe({
        next: () => this.toastService.show("edit"),
        error: () => {
          this.toastService.show("error");
          // Reload to revert optimistic display
          this.agGridTable?.refreshGridData(true);
        },
      });
  }
}
