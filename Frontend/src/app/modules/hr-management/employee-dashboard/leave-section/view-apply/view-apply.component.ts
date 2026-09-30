import {
  Component,
  EventEmitter,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { AuthService } from "@app/services/auth-service/auth.service";
import { CommonService } from "@app/services/common-service/common.service";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { ToastService } from "@app/services/toast-service/toast.service";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import { AgGridStatusBadgeComponent, AgGridActionCellRendererComponent, AgGridApprovalProgressCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component";
import { AgGridTableColumn, AgGridTableODataSourceConfig, AgGridTableToolbarConfig, AgGridTableRowAction, GridTableColumnDataType, AgGridTableDisplayConfig } from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { DateFormatterService } from "@app/shared/utilities/date-format";
import { LeaveRequests } from "@app/modules/hr-management/shared/models/leaveRequests";
import { Localization } from "@app/shared/utilities/localization";
import { Permissions } from "@app/shared/enums/permissions";
import { SpecialDate } from "@app/shared/components/calender/calender.component";
import { SocketService } from "@app/services/socket.service";
import { environment } from "@env/environment";
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

@Component({
  selector: "app-view-apply",
  templateUrl: "./view-apply.component.html",
  styleUrl: "./view-apply.component.scss",
})
export class ViewApplyComponent implements OnInit {
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  localization = Localization;
  odata: boolean = false;
  leaveRequests = LeaveRequests;
  LeaveRequest = new LeaveRequests();
  leaveColumns: AgGridTableColumn<any>[] = [];
  leaveTypes: any[] = [];
  htmlContent: string = "";
  isViewOpen: boolean = false;
  headerTitle: string = ` ${this.localization.LeaveRequest} ${this.localization.Lists}`;
  loading: boolean = false;
  approvalProgress = new Map<number, { approved: number; rejected: number; total: number }>();

  currentStep = 1;
  leaveApprovalSteps: LeaveApprovalStep[] = [];
  loadingLeaveApprovalSteps = false;
  leaveApprovalStepsConfirmed = false;
  approvingLeaveStep = false;

  displayConfig:AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 193px)',
    }
  dataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'LeaveRequests',
    pageSize: 50,
    expand: 'employee,leavetype,weekeend',
    sortBy: 'created_at',
    sortDirection: 'desc',
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.headerTitle,
    showSearch: true,
    showRowCount: true,
    showNewButton: false,
    showDownload: false,
    showSegmentButton: false,
  };
  isReadOnly: boolean = true;
  selectedRow: any = null;
  preSelectedLeaveDays: any[] = [];
  takenLeaveDates: string[] = [];
  calendarSpecialDates: SpecialDate[] = [];
  holidayDates: string[] = [];
  holidaysData: any[] = [];
  holidayTypes: any[] = [];
  @Output() updateCalendar: EventEmitter<string[]> = new EventEmitter<
    string[]
  >();
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent<any>;
  @ViewChild("viewAttachmentUploadRef") viewAttachmentUploadRef?: AttachmentUploadComponent;
  constructor(
    private rolePermissionService: RolePermissionService,
    private commonService: CommonService,
    private authService: AuthService,
    private toastService: ToastService,
    private dateFormatter: DateFormatterService,
    private socketService: SocketService,
  ) { }
  ngOnInit() {
    this.fetchLeaveTypes();
    this.leaveColumns = this.buildLeaveColumns();
    this.fetchHolidayTypes();
  }

  private formatToDateString(date: any): string {
    if (!date) return '';
    return date.toString().split('T')[0].split(' ')[0];
  }

  fetchHolidayTypes() {
    this.commonService.get('HolidayTypes', true).subscribe({
      next: (res: any) => {
        this.holidayTypes = res.value || [];
        this.fetchHolidays();
      },
      error: (err) => console.error('Error fetching holiday types:', err),
    });
  }

  fetchHolidays() {
    const year = new Date().getFullYear();
    this.commonService.get(`hrm/holidays?year=${year}`, false).subscribe({
      next: (res: any) => {
        this.holidaysData = res || [];
        this.holidayDates = this.holidaysData.map((h: any) =>
          this.formatToDateString(h.start_date)
        );
        this.processCalendarData();
      },
      error: (err) => console.error('Error fetching holidays:', err),
    });
  }

  processCalendarData() {
    const specialDates: SpecialDate[] = [];
    this.holidaysData.forEach((holiday: any) => {
      const holidayType = this.holidayTypes.find((t: any) => t.id === holiday.type_id);
      specialDates.push({
        date: this.formatToDateString(holiday.start_date),
        type: holiday.title || holidayType?.name || 'Holiday',
        color: holidayType?.color ?? '#ff4444ff',
        isWeekend: false,
      });
    });
    this.calendarSpecialDates = specialDates;
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

  private buildLeaveColumns(): AgGridTableColumn<any>[] {
    return [
      {
        colId: 'leave_type',
        headerName: $localize`Leave Type`,
        minWidth: 150,
        valueGetter: (params: any) => params.data?.leavetype?.name ?? '',
      },
      {
        colId: 'employee_name',
        headerName: $localize`Employee Name`,
        minWidth: 180,
        valueGetter: (params: any) => {
          const e = params.data?.employee;
          return e ? `${e.first_name} ${e.last_name ?? ''}`.trim() : '';
        },
      },
      {
        colId: 'employee_no',
        headerName: $localize`Employee ID`,
        minWidth: 120,
        valueGetter: (params: any) => params.data?.employee?.employee_no ?? '',
      },
      {
        colId: 'total_days',
        headerName: $localize`Total Day(s)`,
        minWidth: 120,
        valueGetter: (params: any) => Object.keys(params.data?.weekeend || {}).length,
      },
      {
        colId: 'approval_status',
        headerName: $localize`Status`,
        minWidth: 110,
        width: 120,
        sortable: false,
        filter: false,
        cellRenderer: AgGridStatusBadgeComponent,
        valueGetter: (p: any) => this.getApprovalStatus(p.data?.id),
      },
      {
        colId: 'approval_progress',
        headerName: $localize`Approval Progress`,
        minWidth: 160,
        width: 170,
        sortable: false,
        filter: false,
        cellRenderer: AgGridApprovalProgressCellRendererComponent,
        valueGetter: (p: any) => this.approvalProgress.get(p.data?.id) ?? null,
      },
      {
        field: 'created_at',
        headerName: $localize`Applied On`,
        minWidth: 130,
        dataType: GridTableColumnDataType.Date,
        valueFormatter: ({ value }: any) =>
          value
            ? this.dateFormatter.formatDate(value, true, false, false, false, false)
            : '',
      },
      {
        colId: 'actions',
        headerName: $localize`Action`,
        width: 160,
        minWidth: 160,
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
  viewLeave(data: any) {
    this.selectedRow = data;
    this.currentStep = 1;
    this.preSelectedLeaveDays = Object.values(data.weekeend || {}).map(
      (date: any) => date.leave_date
    );
    this.updateCalendar.emit(this.preSelectedLeaveDays);
    this.LeaveRequest = new LeaveRequests().deserialize(data);
    this.isReadOnly = true;
    this.isViewOpen = true;
    this.htmlContent = data.reason;

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

  get viewApproversStepIndex(): number | null {
    return this.hasApprovalChain ? 3 : null;
  }

  get viewMaxStep(): number {
    return this.viewApproversStepIndex ?? this.viewAttachmentStepIndex;
  }

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

  approveAsCurrentUser() {
    this.recordLeaveDecision('approve');
  }

  rejectAsCurrentUser() {
    this.recordLeaveDecision('reject');
  }

  private recordLeaveDecision(action: 'approve' | 'reject') {
    const leaveRequestId = this.LeaveRequest.id;
    if (!leaveRequestId || this.approvingLeaveStep) return;

    this.approvingLeaveStep = true;
    this.commonService.post(`leave-requests/${leaveRequestId}/approver-${action}`, {}, false).subscribe({
      next: (res: any) => {
        this.approvingLeaveStep = false;
        if (res?.hr_status === 'approved' || res?.hr_status === 'rejected') {
          this.LeaveRequest.hr_status = res.hr_status;
          this.LeaveRequest.final_status = res.final_status;
          const user = this.authService.user();
          const event = res.hr_status === 'approved' ? 'hrm-leave:hr-approved' : 'hrm-leave:hr-rejected';
          this.socketService.emit(event, {
            model_id: leaveRequestId,
            model_custom_id: String(leaveRequestId),
            sender_id: user?.id ?? 0,
            sender_name: user?.name ?? '',
          });
        }
        this.loadLeaveApprovalSteps();
        this.refreshTable.emit();
        this.agGridRef?.refreshGridData(true);
      },
      error: (err) => {
        this.approvingLeaveStep = false;
        this.toastService.show('error');
        if (err?.status === 409) {
          this.loadLeaveApprovalSteps();
        }
      },
    });
  }

  get canActOnLeaveApprovalStep(): boolean {
    if (!this.hasApprovalChain) return false;
    if (!this.leaveApprovalStepsConfirmed) return false;
    if (!this.LeaveRequest.id) return false;

    return this.leaveApprovalSteps.some(
      (step) => step.isCurrentStep && step.isCurrentUser && step.status === 'pending',
    );
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

  CloseDialog() {
    this.isViewOpen = false;
    this.loading = false;
    this.isReadOnly = true;
    this.selectedRow = null;
    this.currentStep = 1;
    this.leaveApprovalSteps = [];
    this.leaveApprovalStepsConfirmed = false;
  }
}
