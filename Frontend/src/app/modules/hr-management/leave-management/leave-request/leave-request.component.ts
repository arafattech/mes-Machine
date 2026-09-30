import { Component, EventEmitter, Output, ViewChild } from "@angular/core";
import { AuthService } from "@app/services/auth-service/auth.service";
import { CommonService } from "@app/services/common-service/common.service";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { ToastService } from "@app/services/toast-service/toast.service";
import { Employee } from "@app/shared/model/employee";
import { Department } from "@app/shared/model/department";
import { LeaveRequests } from "@app/modules/hr-management/shared/models/leaveRequests";
import { Localization } from "@app/shared/utilities/localization";
import { ValueState } from "@shared/utilities/value-state-wrapper";
import { SpecialDate } from '@app/shared/components/calender/calender.component';
import { Permissions } from "@app/shared/enums/permissions";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import { AgGridTableColumn, AgGridTableODataSourceConfig, AgGridTableToolbarConfig, GridTableColumnDataType } from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { DateFormatterService } from "@app/shared/utilities/date-format";
import { AgGridStatusBadgeComponent, AgGridActionCellRendererComponent, AgGridApprovalProgressCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component";
import { AgGridTableRowAction } from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { SocketService } from "@app/services/socket.service";
import { AngularEditorConfig } from "@kolkov/angular-editor";
import { environment } from "@env/environment";
import { MediaService } from "@app/services/media-service";
import { AttachmentUploadComponent } from "@shared/components/attachment-upload/attachment-upload.component";
import "@ui5/webcomponents-fiori/dist/Wizard.js";
import "@ui5/webcomponents-fiori/dist/WizardStep.js";

interface LeaveApprovalStep {
  id: number;
  name: string;
  designation: string;
  photoUrl: string;
  isRequired: boolean;
  status: 'approved' | 'rejected' | 'pending';
  isCurrentUser: boolean;
  isCurrentStep: boolean;
}

interface ApproverPreviewRow {
  id: number;
  name: string;
  designation: string;
  photoUrl: string;
  isRequired: boolean;
}
@Component({
  selector: "app-leave-request",
  templateUrl: "./leave-request.component.html",
  styleUrl: "./leave-request.component.scss",
})
export class LeaveRequestComponent {
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() updateCalendar: EventEmitter<string[]> = new EventEmitter<string[]>();
  leaveRequests = LeaveRequests;
  localization = Localization;
  headerTitle: string = ` ${this.localization.Leave} ${this.localization.Lists}`;
  loading: boolean = false;
  employee: Employee | null = null;
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent<any>;
  @ViewChild("leaveTypeCombo") leaveTypeCombo: any;
  @ViewChild("calendarComponent") calendarComponent!: any;
  @ViewChild("attachmentUploadRef") attachmentUploadRef?: AttachmentUploadComponent;
  @ViewChild("viewAttachmentUploadRef") viewAttachmentUploadRef?: AttachmentUploadComponent;
  filterApproved = "supervisor_status eq 'approved'";
  LeaveRequest = new LeaveRequests();
  leaveTypes: any[] = [];
  odata: boolean = false;
  htmlContent: string = "";
  isViewOpen: boolean = false;
  isReadOnly: boolean = false;
  preSelectedLeaveDays: any[] = [];
  takenLeaveDates: string[] = [];
  leaveRequest: any[] = [];
  takenLeaveDatesByType: any = {};
  weekendDates: string[] = [];
  weekendItems: any[] = [];
  calendarSpecialDates: SpecialDate[] = [];
  supervisorApprovedDates: string[] = [];
  pendingApprovedLeaveDates: string[] = [];
  holidayTypes: any[] = [];

  currentStep = 1;
  leaveApprovalSteps: LeaveApprovalStep[] = [];
  loadingLeaveApprovalSteps = false;
  leaveApprovalStepsConfirmed = false;
  approvalProgress = new Map<number, { approved: number; rejected: number; total: number }>();

  applyCurrentStep = 1;
  applyApprovalPreview: ApproverPreviewRow[] = [];
  loadingApplyApprovalPreview = false;

  insertTitle: string = $localize`Apply Leave`;
  reasonEditorConfig: AngularEditorConfig = {
    editable: true,
    height: "20rem",
    minHeight: "20rem",
    maxHeight: "20rem",
  };
  applyOpen: boolean = false;
  applyLoading: boolean = false;
  public valueState = ValueState;
  validationMessage = Localization.requiredField;
  validationMessageLeaveType: string = "";
  selectedLeaveDays: string[] = [];
  departments: Department[] = [];
  employeeList: Employee[] = [];
  selectedEmployee: Employee | null = null;
  employeeTitle: string = "";
  deptTitle: string = "";
  selectedDepartmentId: number | null = null;
  isEmployeeSearchLoading: boolean = false;
  private employeeSearchTimer: ReturnType<typeof setTimeout> | null = null;
  valueStateOptions = {
    employee: ValueState.None,
    leaveType: ValueState.None,
    reason: ValueState.None,
  };
  LeaveRequestTable: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'LeaveRequests',
    expand: 'leavetype,weekeend,employee($expand=department),supervisor,createdBy,leaveDates($count=true)',
    searchFields: ['leavetype.name','employee.employee_no', 'employee.first_name', 'employee.last_name', 'supervisor.first_name', 'supervisor.last_name', 'createdBy.name', 'supervisor_status', 'hr_status', 'final_status'],
    pageSize: 50,
    sortBy: 'created_at',
    sortDirection: 'desc',
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.headerTitle,
    addButtonText: this.insertTitle,
    showNewButton: true,
    showDownload: false,
  };


  constructor(
    private rolePermissionService: RolePermissionService,
    private commonService: CommonService,
    private authService: AuthService,
    private toastService: ToastService,
    private dateFormatter: DateFormatterService,
    private socketService: SocketService,
    private mediaService: MediaService,
  ) { }

  attachmentSubmitAttempted = false;

  get showAttachmentErrorForApply(): boolean {
    return this.attachmentSubmitAttempted && this.requiresDocumentForApply && !this.attachmentUploadRef?.fileCount;
  }

  get requiresDocumentForApply(): boolean {
    const typeId = Number(this.LeaveRequest.leave_type_id);
    if (!typeId) return false;
    const leaveType = this.leaveTypes.find((t) => Number(t.id) === typeId);
    return !!leaveType?.document_required;
  }

  ngOnInit() {
    this.fetchLeaveTypes();
    this.getDepartments();
    this.LeaveRequestTable = this.buildColumns();
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    return [
      {
        colId: 'leavetype.name',
        headerName: $localize`Leave Type`,
        minWidth: 130,
        valueGetter: (params: any) => {
          const leaveId = params.data?.leave_type_id;
          const type = this.leaveTypes.find((t) => t.id === leaveId);
          return type ? type.name : '';
        },
      },
      {
        colId: 'employee.first_name',
        headerName: $localize`Employee Name`,
        minWidth: 180,
        valueGetter: (params: any) => {
          const e = params.data?.employee;
          return e ? `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim() : '';
        },
      },
      {
        colId: 'employee.employee_no',
        headerName: $localize`Employee ID`,
        minWidth: 120,
        valueGetter: (params: any) => params.data?.employee?.employee_no ?? '',
      },
      {
        colId: 'employee.department.name',
        headerName: $localize`Department`,
        minWidth: 150,
        valueGetter: (params: any) => params.data?.employee?.department?.name ?? '',
      },
      {
        colId: 'createdBy.name',
        headerName: $localize`Created By`,
        minWidth: 150,
        valueGetter: (params: any) => params.data?.createdBy?.name ?? '',
      },
      {
        colId: 'supervisor.first_name',
        headerName: $localize`Supervisor First Name`,
        minWidth: 160,
        valueGetter: (params: any) => params.data?.supervisor?.first_name ?? '',
      },
      {
        colId: 'supervisor.last_name',
        headerName: $localize`Supervisor Last Name`,
        minWidth: 160,
        valueGetter: (params: any) => params.data?.supervisor?.last_name ?? '',
      },
      {
        colId: 'total_days',
        headerName: $localize`Total Day(s)`,
        minWidth: 110,
        filter: false, floatingFilter: false,
        valueGetter: (params: any) => params.data?.['leaveDates@count'] ?? '',
      },
      {
        colId: 'approval_status',
        headerName: $localize`Status`,
        minWidth: 110,
        width: 120,
        sortable: false,
        filter: false, floatingFilter: false,
        cellRenderer: AgGridStatusBadgeComponent,
        valueGetter: (p: any) => this.getApprovalStatus(p.data?.id),
      },
      {
        colId: 'approval_progress',
        headerName: $localize`Approval Progress`,
        minWidth: 160,
        width: 170,
        sortable: false,
        filter: false, floatingFilter: false,
        cellRenderer: AgGridApprovalProgressCellRendererComponent,
        valueGetter: (p: any) => this.approvalProgress.get(p.data?.id) ?? null,
      },
      {
        field: 'created_at',
        headerName: $localize`Applied On`,
        minWidth: 130,
        filter: false, floatingFilter: false,
        dataType: GridTableColumnDataType.Date,
        valueFormatter: ({ value }: any) =>
          value
            ? this.dateFormatter.formatDate(value, true, false, false, false, false)
            : '',
      },
      {
        colId: 'actions',
        headerName: $localize`Action`,
        width: 100,
        minWidth: 100,
        pinned: 'right',
        lockPinned: true,
        sortable: false,
        filter: false,
        floatingFilter: false,
        editable: false,
        cellRenderer: AgGridActionCellRendererComponent,
        cellRendererParams: (_params: any) => ({
          actions: [
            {
              id: 'view',
              label: '',
              icon: 'information',
              design: 'Transparent',
              tooltip: $localize`View Details`,
            } as AgGridTableRowAction<any>,
          ],
          onAction: (_actionId: string, row: any) => {
            this.viewLeave(row);
          },
        }),
      },
    ];
  }
    fetchHolidayTypes() {
      this.commonService.get('HolidayTypes', true).subscribe({
        next: (res: any) => {
          this.holidayTypes = res.value || [];
          this.fetchWeekends();
        },
        error: (err) => console.error('Error fetching holiday types:', err),
      });
    }

    private formatToDateString(date: any): string {
      if (!date) return '';
      return date.toString().split('T')[0].split(' ')[0];
    }

    fetchWeekends() {
      if (!this.employee?.id) return;
      this.commonService.get(`hrm/employee-weekends?employee_id=${this.employee.id}`, false).subscribe({
        next: (res: any) => {
          this.weekendItems = (res || []).filter((item: any) => item.type !== 'LEAVE');
          this.weekendDates = this.weekendItems.map((item: any) =>
            this.formatToDateString(item.weekend_date)
          );
          this.processCalendarData();
          this.mergeCalendarDates();
          this.fetchTakenLeaveDates();
        },
        error: (err) => console.error('Error fetching weekends:', err),
      });
    }

    fetchTakenLeaveDates() {
      if (!this.employee?.id) return;

      this.commonService.get(`hrm/leave-taken?employee_id=${this.employee.id}`, false)
        .subscribe((res: any) => {
          this.takenLeaveDatesByType = res || {};

          const rawDates = Object.values(this.takenLeaveDatesByType).flat();
          this.takenLeaveDates = rawDates.map((date: any) => this.formatToDateString(date));

          this.processCalendarData();
          this.mergeCalendarDates();
        });
    }

    processCalendarData() {
      const allSpecialDates: SpecialDate[] = [];
      this.weekendItems.forEach((item: any) => {
        const typeUpper = (item.type ?? '').toUpperCase().replace(/\s+/g, '_');
        const isWeekend = typeUpper === 'WEEKEND';
        const holidayType = this.holidayTypes.find(
          (type: any) => type.name.toUpperCase().replace(/\s+/g, '_') === typeUpper
        );
        allSpecialDates.push({
          date: this.formatToDateString(item.weekend_date),
          type: holidayType?.name ?? item.type ?? 'Weekend',
          color: holidayType?.color ?? (isWeekend ? '#7e7e7eff' : '#ff4444ff'),
          isWeekend,
        });
      });
      this.calendarSpecialDates = [...allSpecialDates];
    }

    mergeCalendarDates() {
      const allDisabledDates = [
        ...this.takenLeaveDates,
        ...this.weekendDates,
      ];
      this.takenLeaveDates = [...new Set(allDisabledDates)].filter(
        date => !this.preSelectedLeaveDays.includes(date)
      );
    }
  isDateDisabled(date: string) {
    return this.takenLeaveDates.includes(date);
  }
  processData(event: any) {
    this.refreshTable.emit(event);
  }
  viewLeave(data: any) {
    this.isViewOpen = true;
    this.currentStep = 1;
    this.employee = data.employee;
    this.preSelectedLeaveDays = Object.values(data.weekeend || {}).map(
      (date: any) => date.leave_date
    );
    this.LeaveRequest = new LeaveRequests().deserialize(data);
    this.htmlContent = data.reason;
    this.isReadOnly = true;
    this.fetchHolidayTypes();
    setTimeout(() => {
      this.updateCalendar.emit(this.preSelectedLeaveDays);
    }, 100);

    if (this.hasApprovalChain) {
      this.loadLeaveApprovalSteps();
    } else {
      this.leaveApprovalSteps = [];
      this.leaveApprovalStepsConfirmed = false;
    }

    setTimeout(() => this.viewAttachmentUploadRef?.loadInputImages(), 100);
  }

  get hasApprovalChain(): boolean {
    return !!this.LeaveRequest.leavetype?.approval_type_id;
  }

  readonly viewAttachmentStepIndex = 2;
  readonly viewApproversStepIndex = 3;
  readonly viewMaxStep = 3;

  goToStep(step: number): void {
    if (step < 1 || step > this.viewMaxStep) return;
    this.currentStep = step;
  }

  nextStep(): void {
    this.goToStep(this.currentStep + 1);
  }

  prevStep(): void {
    this.goToStep(this.currentStep - 1);
  }

  onWizardStepChange(event: any): void {
    const index = Number(event?.detail?.step?.dataset?.step);
    if (!Number.isNaN(index) && index >= 1) {
      this.currentStep = index;
    }
  }

  loadLeaveApprovalSteps() {
    const leaveRequestId = this.LeaveRequest.id;
    if (!leaveRequestId) return;

    this.leaveApprovalSteps = [];
    this.loadingLeaveApprovalSteps = true;
    this.leaveApprovalStepsConfirmed = false;

    const cacheBust = `_=${Date.now()}`;
    this.commonService.get(`leave-requests/${leaveRequestId}/approvers?${cacheBust}`, false).subscribe({
      next: (res: any) => {
        const rows = (res?.data ?? []) as any[];
        const sorted = [...rows].sort(
          (a, b) => Number(a.pivot?.sequence_index ?? 0) - Number(b.pivot?.sequence_index ?? 0),
        );

        const currentEmployeeId = Number(localStorage.getItem('employee_id'));
        const currentIndex = sorted.findIndex((row) => row.status !== 'approved');

        this.leaveApprovalSteps = sorted.map((row, index) => {
          const media = (row.media ?? [])[0];
          return {
            id: row.id,
            name: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
            designation: row.designation?.name ?? '',
            photoUrl: media ? `${environment.ServerApi}/storage/${media.id}/${media.file_name}` : '',
            isRequired: !!row.pivot?.is_required,
            status: (row.status ?? 'pending') as 'approved' | 'rejected' | 'pending',
            isCurrentUser: !!currentEmployeeId && row.id === currentEmployeeId,
            isCurrentStep: index === currentIndex,
          };
        });
        this.loadingLeaveApprovalSteps = false;
        this.leaveApprovalStepsConfirmed = true;
      },
      error: () => {
        this.leaveApprovalSteps = [];
        this.loadingLeaveApprovalSteps = false;
        this.leaveApprovalStepsConfirmed = false;
      },
    });
  }

  onGridDataLoaded(data: any): void {
    const rows = Array.isArray(data?.[0]) ? data[0] : data;
    if (!Array.isArray(rows) || rows.length === 0) return;

    const ids = rows.map((row: any) => row.id).filter((id: any) => id != null);
    if (!ids.length) return;

    this.commonService.get(`leave-requests/progress?ids=${ids.join(',')}`, false).subscribe({
      next: (res: any) => {
        const total = res?.total ?? {};
        const approved = res?.approved ?? {};
        const rejected = res?.rejected ?? {};
        ids.forEach((id: number) => {
          this.approvalProgress.set(id, {
            approved: Number(approved[id] ?? 0),
            rejected: Number(rejected[id] ?? 0),
            total: Number(total[id] ?? 0),
          });
        });
        this.agGridRef?.getGridApi()?.refreshCells({
          force: true,
          columns: ['approval_status', 'approval_progress'],
        });
      },
      error: () => {},
    });
  }

  private getApprovalStatus(leaveRequestId?: number): string {
    const progress = this.approvalProgress.get(leaveRequestId ?? -1);
    if (!progress) return 'PENDING';
    if (progress.rejected > 0) return 'REJECTED';
    if (progress.total > 0 && progress.approved >= progress.total) return 'APPROVED';
    return 'PENDING';
  }

  fetchLeaveTypes() {
    this.commonService.get("LeaveTypes", true).subscribe({
      next: (res: any) => {
        this.leaveTypes = res.value ?? [];
      },
      error: (err) => {
        console.error("Error fetching leave types:", err);
      },
    });
  }
  getLeaveTypeName(id: number): string {
    const type = this.leaveTypes.find((leaveTpye) => leaveTpye.id === id);
    return type ? type.name : "";
  }
  CloseDialog() {
    this.isViewOpen = false;
    this.loading = false;
    this.currentStep = 1;
    this.leaveApprovalSteps = [];
    this.leaveApprovalStepsConfirmed = false;
  }

  getDepartments() {
    this.commonService.get('Departments?$filter=is_active eq true').subscribe({
      next: (res: any) => (this.departments = res.value ?? []),
      error: (err) => console.error('Error fetching departments:', err),
    });
  }

  onChangeDepartment(event: any) {
    const selectedItem = event.detail.item;
    this.selectedDepartmentId = selectedItem ? Number(selectedItem.value) : null;
    this.deptTitle = selectedItem?.text ?? "";
    this.loadEmployeesByDepartments();
  }

  loadEmployeesByDepartments(search?: string) {
    const term = search?.trim().toLowerCase();
    let url = 'Employees?$filter=is_active eq true';
    if (this.selectedDepartmentId) {
      url += ` and department_id eq ${this.selectedDepartmentId}`;
    }
    if (term) {
      url += ` and (contains(tolower(employee_no),'${term}') or contains(tolower(first_name),'${term}') or contains(tolower(last_name),'${term}'))`;
    }
    this.isEmployeeSearchLoading = true;
    this.commonService.get(url).subscribe({
      next: (res: any) => {
        this.employeeList = (res.value ?? []).map((item: any) => new Employee().deserialize(item));
        this.isEmployeeSearchLoading = false;
      },
      error: (err) => {
        console.error('Error fetching employees:', err);
        this.isEmployeeSearchLoading = false;
      },
    });
  }

  onEmployeeSearchInput(event: any) {
    const value = event?.target?.value ?? '';
    if (this.employeeSearchTimer) clearTimeout(this.employeeSearchTimer);
    this.employeeSearchTimer = setTimeout(() => this.loadEmployeesByDepartments(value), 300);
  }

  onChangeEmployee(event: any) {
    const selectedItem = event.detail.item;
    if (!selectedItem) return;
    const found = this.employeeList.find((e) => Number(e.id) === Number(selectedItem.id));
    this.selectedEmployee = found ?? null;
    this.employeeTitle = selectedItem.text;
    this.valueStateOptions.employee = ValueState.None;
    this.preSelectedLeaveDays = [];
    this.selectedLeaveDays = [];
    this.LeaveRequest.leave_type_id = undefined;
    this.updateCalendar.emit([]);
    this.fetchHolidayTypesForApply();
  }

  fetchHolidayTypesForApply() {
    this.commonService.get('HolidayTypes', true).subscribe({
      next: (res: any) => {
        this.holidayTypes = res.value || [];
        this.fetchWeekendsForApply();
      },
      error: (err) => console.error('Error fetching holiday types:', err),
    });
  }

  fetchWeekendsForApply() {
    if (!this.selectedEmployee?.id) return;
    this.commonService.get(`hrm/employee-weekends?employee_id=${this.selectedEmployee.id}`, false).subscribe({
      next: (res: any) => {
        this.weekendItems = (res || []).filter((item: any) => item.type !== 'LEAVE');
        this.weekendDates = this.weekendItems.map((item: any) =>
          this.formatToDateString(item.weekend_date)
        );
        this.processCalendarData();
        this.mergeCalendarDates();
        this.fetchTakenLeaveDatesForApply();
      },
      error: (err) => console.error('Error fetching weekends:', err),
    });
  }

  fetchTakenLeaveDatesForApply() {
    if (!this.selectedEmployee?.id) return;
    this.commonService.get(`hrm/leave-taken?employee_id=${this.selectedEmployee.id}`, false)
      .subscribe((res: any) => {
        this.takenLeaveDatesByType = res || {};
        const rawDates = Object.values(this.takenLeaveDatesByType).flat();
        this.takenLeaveDates = rawDates.map((date: any) => this.formatToDateString(date));
        this.processCalendarData();
        this.mergeCalendarDates();
      });
  }

  onDateSelectionChange(event: string[]) {
    this.selectedLeaveDays = event;
    this.validationMessageLeaveType = "";
  }

  onLeaveTypeChange(event: any) {
    const selectedItem = event.detail.item;
    this.LeaveRequest.leave_type_id = selectedItem ? Number(selectedItem.value) : undefined;
    this.validationMessageLeaveType = "";
    this.valueStateOptions.leaveType = ValueState.None;
  }

  get hasApprovalChainForApply(): boolean {
    return !!this.selectedLeaveTypeApprovalTypeId;
  }

  private get selectedLeaveTypeApprovalTypeId(): number | null {
    const typeId = this.LeaveRequest.leave_type_id;
    if (!typeId) return null;
    const leaveType = this.leaveTypes.find((t) => Number(t.id) === Number(typeId));
    return leaveType?.approval_type_id ?? null;
  }

  readonly applyAttachmentStepIndex = 2;
  readonly applyApproversStepIndex = 3;
  readonly applyMaxStep = 3;

  applyGoToStep(step: number): void {
    if (step < 1 || step > this.applyMaxStep) return;
    this.applyCurrentStep = step;
    if (step === this.applyApproversStepIndex) {
      this.loadApplyApprovalPreview();
    }
  }

  applyNextStep(): void {
    this.applyGoToStep(this.applyCurrentStep + 1);
  }

  applyPrevStep(): void {
    this.applyGoToStep(this.applyCurrentStep - 1);
  }

  onApplyWizardStepChange(event: any): void {
    const index = Number(event?.detail?.step?.dataset?.step);
    if (!Number.isNaN(index) && index >= 1) {
      this.applyCurrentStep = index;
    }
  }

  loadApplyApprovalPreview() {
    const approvalTypeId = this.selectedLeaveTypeApprovalTypeId;
    if (!approvalTypeId) {
      this.applyApprovalPreview = [];
      return;
    }

    this.loadingApplyApprovalPreview = true;
    this.commonService.get(`approval-types/${approvalTypeId}/approvers`, false).subscribe({
      next: (res: any) => {
        const rows = (res?.data ?? []) as any[];
        const sorted = [...rows].sort(
          (a, b) => Number(a.pivot?.sequence_index ?? 0) - Number(b.pivot?.sequence_index ?? 0),
        );
        this.applyApprovalPreview = sorted.map((row) => {
          const media = (row.media ?? [])[0];
          return {
            id: row.id,
            name: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
            designation: row.designation?.name ?? '',
            photoUrl: media ? `${environment.ServerApi}/storage/${media.id}/${media.file_name}` : '',
            isRequired: !!row.pivot?.is_required,
          };
        });
        this.loadingApplyApprovalPreview = false;
      },
      error: () => {
        this.applyApprovalPreview = [];
        this.loadingApplyApprovalPreview = false;
      },
    });
  }

  get leaveBalance(): { used: number; total: number; remaining: number; percent: number } | null {
    const typeId = this.LeaveRequest.leave_type_id;
    if (!typeId) return null;
    const leaveType = this.leaveTypes.find((t) => Number(t.id) === Number(typeId));
    if (!leaveType) return null;

    const total = Number(leaveType.max_days) || 0;
    const year = new Date().getFullYear();
    const takenDates: string[] = this.takenLeaveDatesByType[typeId] || [];
    const usedInYear = takenDates.filter(
      (d: string) => d && parseInt(d.split('-')[0], 10) === year
    ).length;

    const used = usedInYear + this.selectedLeaveDays.length;
    const remaining = Math.max(total - used, 0);
    const percent = total > 0 ? Math.min(Math.round((used / total) * 100), 100) : 0;

    return { used, total, remaining, percent };
  }

  checkApplyValidation(field: string) {
    if (field === 'reason') {
      const content = this.htmlContent || "";
      this.valueStateOptions.reason = (!content.trim()) ? ValueState.Negative : ValueState.None;
    }
  }

  newLeave() {
    this.LeaveRequest = new LeaveRequests().deserialize({});
    this.selectedEmployee = null;
    this.employeeTitle = "";
    this.deptTitle = "";
    this.selectedDepartmentId = null;
    this.preSelectedLeaveDays = [];
    this.selectedLeaveDays = [];
    this.takenLeaveDates = [];
    this.calendarSpecialDates = [];
    this.htmlContent = "";
    this.applyCurrentStep = 1;
    this.applyApprovalPreview = [];
    this.attachmentSubmitAttempted = false;
    if (this.attachmentUploadRef) {
      this.attachmentUploadRef.fileArr = [];
      this.attachmentUploadRef.fileCount = 0;
    }
    this.loadEmployeesByDepartments();
    this.applyOpen = true;
  }

  validateApplyForm(): boolean {
    let isValid = true;
    this.valueStateOptions.employee = ValueState.None;
    this.valueStateOptions.leaveType = ValueState.None;
    this.valueStateOptions.reason = ValueState.None;

    if (!this.selectedEmployee?.id) {
      this.valueStateOptions.employee = ValueState.Negative;
      isValid = false;
    }
    if (!this.LeaveRequest.leave_type_id) {
      this.valueStateOptions.leaveType = ValueState.Negative;
      isValid = false;
    }
    if (!this.htmlContent?.trim()) {
      this.valueStateOptions.reason = ValueState.Negative;
      isValid = false;
    }
    if (!this.selectedLeaveDays.length) {
      this.validationMessageLeaveType = this.validationMessage;
      isValid = false;
    }
    if (this.requiresDocumentForApply && !this.attachmentUploadRef?.fileCount) {
      this.attachmentSubmitAttempted = true;
      this.applyGoToStep(this.applyAttachmentStepIndex);
      isValid = false;
    }
    return isValid;
  }

  saveLeaveRequest() {
    if (!this.validateApplyForm()) return;
    this.applyLoading = true;

    const payload = {
      employee_id: this.selectedEmployee!.id,
      leave_type_id: this.LeaveRequest.leave_type_id,
      dates: this.selectedLeaveDays,
      reason: this.htmlContent,
    };

    this.commonService.post("hrm/leave-requests", payload, false).subscribe({
      next: (res: any) => {
        this.mediaService.setId(String(res.id));
        const user = this.authService.user();
        this.socketService.emit('hrm-leave:applied', {
          model_id: 0,
          model_custom_id: '',
          sender_id: user?.id ?? 0,
          sender_name: user?.name ?? '',
          recipient_user_ids: res?.recipient_user_ids ?? [],
        });
        this.toastService.show("add");
        this.refreshTable.emit();
        this.agGridRef?.refreshGridData(true);
        this.CloseApplyDialog();
      },
      error: (err) => {
        console.error("Error applying leave:", err);
        this.applyLoading = false;
        this.toastService.show("error");
      },
    });
  }

  CloseApplyDialog() {
    this.applyOpen = false;
    this.applyLoading = false;
    this.applyCurrentStep = 1;
    this.applyApprovalPreview = [];
    this.attachmentSubmitAttempted = false;
    if (this.attachmentUploadRef) {
      this.attachmentUploadRef.fileArr = [];
      this.attachmentUploadRef.fileCount = 0;
    }
    this.selectedEmployee = null;
    this.employeeTitle = "";
    this.deptTitle = "";
    this.selectedDepartmentId = null;
    this.preSelectedLeaveDays = [];
    this.selectedLeaveDays = [];
    this.takenLeaveDates = [];
    this.calendarSpecialDates = [];
    this.htmlContent = "";
    this.LeaveRequest = new LeaveRequests();
    this.validationMessageLeaveType = "";
    this.valueStateOptions.employee = ValueState.None;
    this.valueStateOptions.leaveType = ValueState.None;
    this.valueStateOptions.reason = ValueState.None;
    if (this.leaveTypeCombo) {
      this.leaveTypeCombo.value = "";
      this.leaveTypeCombo.selectedItem = null;
    }
    if (this.calendarComponent) {
      this.calendarComponent.selectedDates = [];
    }
  }
}
