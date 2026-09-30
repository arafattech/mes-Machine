import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from "@angular/core";
import { AuthService } from "@app/services/auth-service/auth.service";
import { CommonService } from "@app/services/common-service/common.service";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { ToastService } from "@app/services/toast-service/toast.service";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import { AgGridTableColumn, AgGridTableODataSourceConfig, AgGridTableToolbarConfig, AgGridTableRowAction, GridTableColumnDataType, AgGridTableDisplayConfig } from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { DateFormatterService } from "@app/shared/utilities/date-format";
import { AgGridActionCellRendererComponent, AgGridStatusBadgeComponent, AgGridApprovalProgressCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component";
import { saveMode } from "@shared/enums/saveMode";
import { LeaveRequests } from "@app/modules/hr-management/shared/models/leaveRequests";
import { Localization } from "@shared/utilities/localization";
import { ValueState } from "@shared/utilities/value-state-wrapper";
import moment from "moment";
import { SpecialDate } from '@app/shared/components/calender/calender.component';
import { Permissions } from "@app/shared/enums/permissions";
import { SocketService } from "@app/services/socket.service";
import { MediaService } from "@app/services/media-service";
import { AttachmentUploadComponent } from "@shared/components/attachment-upload/attachment-upload.component";

@Component({
  selector: "app-leave-section",
  templateUrl: "./leave-section.component.html",
  styleUrl: "./leave-section.component.scss",
})
export class LeaveSectionComponent implements OnInit {
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<any>();
  @Output() updateCalendar: EventEmitter<string[]> = new EventEmitter<
    string[]
  >();
  @Input() employee: any;
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent<any>;
  @ViewChild("leaveTypeCombo") leaveTypeCombo: any;
  @ViewChild("calendarComponent") calendarComponent!: any;
  @ViewChild("attachmentUploadRef") attachmentUploadRef?: AttachmentUploadComponent;
  localization = Localization;
  leaveColumns: AgGridTableColumn<any>[] = [];
  insertTitle: string = $localize`Apply Leave`;
  public postMethod = saveMode;
  headerTitle: string = ` ${this.localization.Leave} ${this.localization.Lists}`;
  leaveRequests = LeaveRequests;
  LeaveRequest = new LeaveRequests();
  saveMode: string = saveMode.POST;
  leaveTypes: any[] = [];
  leaveRequest: any[] = [];
  odata: boolean = false;
  open: boolean = false;
  selectedTab: string = 'details';
  loading: boolean = false;
  validationMessageLeaveType: string = "";
  TotalUserLeave: number = 0;
  htmlContent: string = "";
  isViewOpen: boolean = false;
  ToastType: "add" | "edit" | "error" = "add";
  validationMessage = Localization.requiredField;
  selectedLeaveDays: any[] = [];
  preSelectedLeaveDays: any[] = [];
  moment = moment;
  months = new Date().toLocaleString("default", { month: "long" });
  isReadOnly: boolean = false;
  public valueState = ValueState;
  takenLeaveDates: string[] = [];
  takenLeaveDatesByType: any = {};
  weekendDates: string[] = [];
  weekendItems: any[] = [];
  holidayDates: string[] = [];
  calendarSpecialDates: SpecialDate[] = [];
  supervisorApprovedDates: string[] = [];
  pendingApprovedLeaveDates: string[] = [];
  holidayTypes: any[] = [];

  valueStateOptions = {
    leaveType: ValueState.None,
    start_date: ValueState.None,
    end_date: ValueState.None,
    reason: ValueState.None,
  };
  displayConfig:AgGridTableDisplayConfig = {
  gridHeight: 'calc(100vh - 193px)',
  }
  dataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'LeaveRequests',
    expand: 'leavetype,employee,supervisor,weekeend',
    pageSize: 50,
    sortBy: 'created_at',
    sortDirection: 'desc',
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.headerTitle,
    addButtonText: this.insertTitle,
    showSearch: true,
    showRowCount: true,
    showNewButton: true,
    showDownload: false,
    showSegmentButton: false,
  };


  constructor(
    private rolePermissionService: RolePermissionService,
    private commonService: CommonService,
    private toastService: ToastService,
    private authService: AuthService,
    private dateFormatter: DateFormatterService,
    private socketService: SocketService,
    private mediaService: MediaService,
  ) { }

  get requiresDocument(): boolean {
    const typeId = Number(this.LeaveRequest.leave_type_id);
    if (!typeId) return false;
    const leaveType = this.leaveTypes.find((t) => Number(t.id) === typeId);
    return !!leaveType?.document_required;
  }

  attachmentSubmitAttempted = false;
  approvalProgress = new Map<number, { approved: number; rejected: number; total: number }>();

  get showAttachmentError(): boolean {
    return this.attachmentSubmitAttempted && this.requiresDocument && !this.attachmentUploadRef?.fileCount;
  }

  onTabSelect(event: any) {
    event.stopPropagation();
    this.selectedTab = event.detail.tab.id;
    if (this.selectedTab === 'attachment' && (this.saveMode === saveMode.PUT || this.saveMode === saveMode.GET)) {
      this.attachmentUploadRef?.loadInputImages();
    }
  }

  ngOnInit() {
    this.fetchLeaveTypes();
    this.leaveColumns = this.buildLeaveColumns();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes["employee"] && changes["employee"].currentValue) {
      this.agGridRef?.refreshGridData(true);
    }
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
          columns: ['approval_status', 'approval_progress', 'actions'],
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

  private canEditOrDelete(leaveRequestId?: number): boolean {
    if (this.getApprovalStatus(leaveRequestId) !== 'PENDING') return false;
    const progress = this.approvalProgress.get(leaveRequestId ?? -1);
    return !progress || progress.approved === 0;
  }

  private formatToDateString(date: any): string {
    if (!date) return '';
    return date.toString().split('T')[0].split(' ')[0];
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

  fetchWeekends() {
    if (!this.employee?.id) return;
    this.commonService
      .get(`EmployeeHolidaySwaps?$filter=employee_id eq ${this.employee.id} and type eq 'WEEKEND'`)
      .subscribe({
        next: (swapsRes: any) => {
          const swaps = swapsRes?.value ?? [];
          this.commonService.get(`hrm/employee-weekends?employee_id=${this.employee.id}`, false).subscribe({
            next: (res: any) => {
              this.weekendItems = (res || [])
                .filter((item: any) => item.type !== 'LEAVE')
                .map((item: any) => {
                  const originalDate = this.formatToDateString(item.weekend_date);
                  const swap = swaps.find((s: any) => s.original_holiday_date === originalDate);
                  return swap ? { ...item, weekend_date: swap.swapped_holiday_date } : item;
                });
              this.weekendDates = this.weekendItems.map((item: any) =>
                this.formatToDateString(item.weekend_date)
              );
              this.holidayDates = [];
              this.processCalendarData();
              this.mergeCalendarDates();
              this.fetchTakenLeaveDates();
            },
            error: (err) => console.error('Error fetching weekends:', err),
          });
        },
        error: (err) => console.error('Error fetching holiday swaps:', err),
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
      ...this.holidayDates,
      ...this.pendingApprovedLeaveDates,
    ];

    this.takenLeaveDates = [...new Set(allDisabledDates)].filter(
      date => !this.preSelectedLeaveDays.includes(date)
    );
  }

  isDateDisabled(date: string) {
    return this.takenLeaveDates.includes(date);
  }

  onDateSelectionChange(event: string[]) {
    this.selectedLeaveDays = event;
    this.validationMessageLeaveType = "";
    this.valueStateOptions.leaveType = ValueState.None;

    const error = this.validateMedicalCasualLimit();
    if (error) {
      this.validationMessageLeaveType = error;
      this.valueStateOptions.leaveType = ValueState.Negative;
    }
  }

  onDateChange(field: "start_date" | "end_date") {
    this.getRequestedLeaveDays();
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
        colId: 'supervisor_name',
        headerName: $localize`Supervisor Name`,
        minWidth: 180,
        valueGetter: (params: any) => {
          const s = params.data?.supervisor;
          return s ? `${s.first_name} ${s.last_name ?? ''}`.trim() : '';
        },
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
        width: 110,
        minWidth: 110,
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
              id: 'edit',
              label: '',
              icon: 'edit',
              design: 'Transparent',
              tooltip: $localize`Edit`,
              visible: (row: any) => this.canEditOrDelete(row?.id),
            } as AgGridTableRowAction<any>,
            {
              id: 'view',
              label: '',
              icon: 'information',
              design: 'Transparent',
              tooltip: $localize`View Details`,
              visible: (row: any) => !this.canEditOrDelete(row?.id),
            } as AgGridTableRowAction<any>,
            {
              id: 'delete',
              label: '',
              icon: 'delete',
              design: 'Negative',
              tooltip: $localize`Delete`,
              visible: (row: any) => this.canEditOrDelete(row?.id),
            } as AgGridTableRowAction<any>,
          ],
          onAction: (actionId: string, row: any) => {
            if (actionId === 'edit') this.editLeave(row);
            if (actionId === 'view') this.viewLeave(row);
            if (actionId === 'delete') this.IsDelete.emit(`LeaveRequests/${row.id}`);
          },
        }),
      },
    ];
  }

  fetchLeaveRequestEdit(leaveId: number) {
    this.commonService.get(`hrm/leave-request?leave_id=${leaveId}`, false)
      .subscribe((res: any) => {
        if (res.success && res.data) {
          const leaveData = res.data;

          this.preSelectedLeaveDays = leaveData.leave_dates.map(
            (date: any) => date.leave_date
          );

          this.takenLeaveDates = this.takenLeaveDates.filter(
            date => !this.preSelectedLeaveDays.includes(date)
          );

          setTimeout(() => {
            this.updateCalendar.emit(this.preSelectedLeaveDays);
          }, 200);

          this.LeaveRequest = new LeaveRequests().deserialize(leaveData);
          this.htmlContent = leaveData.reason;
        }
      });
  }

  fetchPendingApprovedLeaveDates() {
    if (!this.employee?.id) return;
    const filter = `employee_id eq ${this.employee.id} and tolower(supervisor_status) ne 'rejected' and tolower(hr_status) ne 'rejected' and tolower(final_status) ne 'rejected'`;
    this.commonService.get(`LeaveRequests?$filter=${filter}&$expand=weekeend`, true).subscribe({
      next: (res: any) => {
        const leaves: any[] = res.value ?? [];
        const pendingDates: SpecialDate[] = [];
        const existingDates: string[] = [];
        leaves.forEach((leave: any) => {
          const dates: string[] = Object.values(leave.weekeend || {}).map(
            (d: any) => this.formatToDateString(d.leave_date)
          );
          const isPending = leave.supervisor_status === 'pending';
          dates.forEach((date) => {
            if (date) {
              existingDates.push(date);
              pendingDates.push({
                date,
                type: isPending ? $localize`Pending Leave` : $localize`Approved Leave`,
                color: isPending ? '#f0a800' : '#0070f2',
                isWeekend: false,
              });
            }
          });
        });
        this.calendarSpecialDates = [...this.calendarSpecialDates, ...pendingDates];
        this.pendingApprovedLeaveDates = [...new Set(existingDates)];
        this.mergeCalendarDates();
      },
      error: () => {},
    });
  }

  newLeave() {
    this.LeaveRequest = new LeaveRequests().deserialize({});
    this.saveMode = saveMode.POST;
    this.selectedTab = 'details';
    this.attachmentSubmitAttempted = false;
    this.isReadOnly = false;
    this.open = true;
    this.preSelectedLeaveDays = [];
    this.pendingApprovedLeaveDates = [];
    this.fetchHolidayTypes();
    this.fetchPendingApprovedLeaveDates();
  }

  editLeave(data: any) {
    this.preSelectedLeaveDays = Object.values(data.weekeend || {}).map(
      (date: any) => date.leave_date
    );
    this.fetchLeaveRequestEdit(data.id);
    this.selectedLeaveDays = [...this.preSelectedLeaveDays];
    this.isReadOnly = false;
    this.updateCalendar.emit(this.preSelectedLeaveDays);
    this.LeaveRequest = new LeaveRequests().deserialize(data);
    this.saveMode = saveMode.PUT;
    this.selectedTab = 'details';
    this.attachmentSubmitAttempted = false;
    this.open = true;
    this.htmlContent = data.reason;
    this.pendingApprovedLeaveDates = [];
    this.fetchPendingApprovedLeaveDates();
    setTimeout(() => {
      this.fetchHolidayTypes();
    }, 100);
  }

  viewLeave(data: any) {
    this.preSelectedLeaveDays = Object.values(data.weekeend || {}).map(
      (date: any) => date.leave_date
    );

    this.updateCalendar.emit(this.preSelectedLeaveDays);
    this.isReadOnly = true;
    this.LeaveRequest = new LeaveRequests().deserialize(data);
    this.saveMode = saveMode.GET;
    this.selectedTab = 'details';
    this.attachmentSubmitAttempted = false;
    this.open = true;
    this.htmlContent = data.reason;
  }

  checkValidation(event: any, field: string) {
    const value = event.target.value;

    switch (field) {
      case "leave_type_id":
        if (!value) {
          this.valueStateOptions.leaveType = ValueState.Negative;
          this.validationMessageLeaveType = "";
        } else {
          this.valueStateOptions.leaveType = ValueState.None;
          this.LeaveRequest.leave_type_id = value;

          const typeId = Number(value);
          const leaveType = this.leaveTypes.find(leaveType => leaveType.id === typeId);

          if (leaveType) {
            this.PendingLeaveRequ(typeId, leaveType);
            if (!this.validationMessageLeaveType) {
              this.validationMessageLeaveType = this.validateMedicalCasualLimit() || "";
            }
          }
        }
        break;

      case "reason":
        const content = this.htmlContent || "";
        this.valueStateOptions.reason = (!content.trim()) ? ValueState.Negative : ValueState.None;
        break;
    }
  }

  validateForm(): boolean {
    let isValid = true;
    this.validationMessageLeaveType = "";
    this.valueStateOptions.leaveType = ValueState.None;
    this.valueStateOptions.reason = ValueState.None;

    if (!this.LeaveRequest.leave_type_id) {
      this.valueStateOptions.leaveType = ValueState.Negative;
      this.validationMessageLeaveType = "";
      isValid = false;
    } else {
      const typeId = Number(this.LeaveRequest.leave_type_id);
      const leaveType = this.leaveTypes.find(leaveType => leaveType.id === typeId);

      if (this.saveMode === saveMode.POST && leaveType && this.PendingLeaveRequ(typeId, leaveType)) {
        this.valueStateOptions.leaveType = ValueState.None;
        isValid = false;
      }
      else {
        const limitError = this.validateMedicalCasualLimit();
        if (limitError) {
          this.validationMessageLeaveType = limitError;
          this.valueStateOptions.leaveType = ValueState.None;
          isValid = false;
        }
      }
    }

    if (!this.htmlContent?.trim()) {

      this.valueStateOptions.reason = ValueState.Negative;
      isValid = false;
    }

    if (!this.selectedLeaveDays || this.selectedLeaveDays.length === 0 && this.saveMode === saveMode.POST) {
      if (this.valueStateOptions.leaveType === ValueState.None && !this.validationMessageLeaveType) {
        this.valueStateOptions.leaveType = ValueState.Negative;
      }
      isValid = false;
    }

    if (this.saveMode === saveMode.POST && this.requiresDocument && !this.attachmentUploadRef?.fileCount) {
      this.attachmentSubmitAttempted = true;
      this.selectedTab = 'attachment';
      isValid = false;
    }

    return isValid;
  }

  saveLeaveRequests() {
    if (!this.validateForm()) return;
    this.loading = true;

    const payload = {
      employee_id: this.employee.id,
      leave_type_id: this.LeaveRequest.leave_type_id,
      dates: this.selectedLeaveDays,
      reason: this.htmlContent
    };

    if (this.saveMode === saveMode.PUT && this.LeaveRequest.id) {
      this.commonService.put(`hrm/leave-requests/${this.LeaveRequest.id}`, payload, false).subscribe({
        next: () => {
          this.mediaService.setId(String(this.LeaveRequest.id));
          this.toastService.show("edit");
          this.refreshTable.emit();
          this.CloseDialog();
        },
        error: (err) => {
          this.loading = false;
          this.toastService.show("error");
        }
      });
    } else {
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
          this.CloseDialog();
        },
        error: (err) => {
          this.loading = false;
          this.toastService.show("error");
        }
      });
    }
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

  getLeaveTypeName(id?: number): string {
    if (id == null) return "";
    const type = this.leaveTypes.find((leaveType) => leaveType.id === id);
    return type ? type.name : "";
  }

  private parseDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    const parts = dateStr.split("-").map(Number);
    if (parts[0].toString().length === 4) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    } else {
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
  }

  onLeaveTypeChange(event: any) {
    const selectedItem = event.detail.item;
    this.LeaveRequest.leave_type_id = Number(selectedItem.value);
    this.validationMessageLeaveType = "";
    this.valueStateOptions.leaveType = ValueState.None;

    if (!selectedItem) {
      this.LeaveRequest.leave_type_id = undefined;
      return;
    }

    const selectedLeaveTypeId = Number(selectedItem.value);
    this.LeaveRequest.leave_type_id = selectedLeaveTypeId;

    const leaveType = this.leaveTypes.find(l => l.id === selectedLeaveTypeId);
    if (!leaveType) return;

    if (this.saveMode === saveMode.POST && this.PendingLeaveRequ(selectedLeaveTypeId, leaveType)) {
      this.valueStateOptions.leaveType = ValueState.Negative;
      return;
    }

    const limitError = this.validateMedicalCasualLimit();
    if (limitError) {
      this.validationMessageLeaveType = limitError;
      this.valueStateOptions.leaveType = ValueState.Negative;
      return;
    }

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

  validateMedicalCasualLimit(): string | null {
    if (!this.LeaveRequest.leave_type_id) return null;
    let targetYear = new Date().getFullYear();
    if (this.selectedLeaveDays.length > 0) {
      targetYear = parseInt(this.selectedLeaveDays[0].split('-')[0], 10);
    }

    const type = this.LeaveRequest.leave_type_id;
    const leaveType = this.leaveTypes.find((t) => Number(t.id) === Number(type));
    const maxLimit = Number(leaveType?.max_days) || 0;
    if (!leaveType || maxLimit <= 0) return null;

    const takenDates: string[] = this.takenLeaveDatesByType[type] || [];
    const takenInYear = takenDates.filter((dateStr: string) => {
      if (!dateStr) return false;
      const year = parseInt(dateStr.split('-')[0], 10);
      return year === targetYear;
    });

    const alreadyTaken = takenInYear.length;
    const newlySelected = this.selectedLeaveDays.length;
    const remaining = maxLimit - alreadyTaken;
    if (remaining <= 0 && newlySelected > 0) {
      return `You have only ${remaining} ${leaveType.name} days left for ${targetYear}.`;
    }

    if (newlySelected > remaining) {
      return `You only have ${remaining} ${leaveType.name} days left in ${targetYear}.`;
    }

    return null;
  }

  PendingLeaveRequ(selectedLeaveTypeId: number, leaveType: any): boolean {
    const hasPending = this.employee?.leaves?.some(
      (data: any) =>
        Number(data.leave_type_id) === selectedLeaveTypeId &&
        data.final_status !== "approved" &&
        data.final_status !== "rejected" &&
        data.supervisor_status !== "rejected"
    );

    if (hasPending) {
      this.validationMessageLeaveType = `${leaveType.name} ${this.localization.RequestAlreadyPending}`;
      this.LeaveRequest.leave_type_id = undefined;
      return true;
    }

    return false;
  }

  resetLeaveValidation() {
    this.validationMessageLeaveType = "";
    this.TotalUserLeave = 0;
  }

  getUsedLeaveDays(leaveTypeId: number): number {
    const leaveData = this.employee?.leaves?.length
      ? this.employee.leaves
      : this.leaveRequest;

    if (!leaveTypeId || !leaveData?.length) {
      return 0;
    }

    const selectedStartDate = this.parseDate(
      this.LeaveRequest.start_date || ""
    );
    const selectedYear = selectedStartDate.getFullYear();

    const approvedLeaves = leaveData.filter((data: any) => {
      const start = this.parseDate(data.start_date);
      return (
        data.employee_id === this.employee?.id &&
        Number(data.leave_type_id) === Number(leaveTypeId) &&
        data.final_status === "approved" &&
        start.getFullYear() === selectedYear
      );
    });

    const totalUsed = approvedLeaves.reduce((sum: number, data: any) => {
      const start = this.parseDate(data.start_date);
      const end = this.parseDate(data.end_date);
      const days =
        Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) +
        1;
      return sum + days;
    }, 0);

    return totalUsed;
  }

  getRequestedLeaveDays(): number {
    if (
      !this.LeaveRequest.start_date ||
      !this.LeaveRequest.end_date ||
      !this.LeaveRequest.leave_type_id
    ) {
      return 0;
    }

    const start = this.parseDate(this.LeaveRequest.start_date);
    const end = this.parseDate(this.LeaveRequest.end_date);
    const selectedYear = start.getFullYear();

    let requested =
      Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const leaveType = this.leaveTypes.find(
      (leave) => Number(leave.id) === Number(this.LeaveRequest.leave_type_id)
    );

    if (!leaveType) {
      return requested;
    }

    const totalUsed = this.getUsedLeaveDays(
      Number(this.LeaveRequest.leave_type_id)
    );
    let remainingDays = leaveType.max_days - totalUsed;
    if (remainingDays < 0) remainingDays = 0;

    if (requested > remainingDays) {
      requested = remainingDays;
      this.validationMessageLeaveType = `${this.localization.Youcanselectmaximum} ${remainingDays} ${this.localization.Daysof} ${leaveType.name} ${this.localization.Leave}`;
    } else {
      this.validationMessageLeaveType = "";
    }

    return requested > 0 ? requested : 0;
  }

  processData(event: any) {
    this.refreshTable.emit(event);
  }

  CloseDialog() {
    this.isViewOpen = false;
    this.loading = false;
    this.attachmentSubmitAttempted = false;
    this.valueStateOptions.leaveType = ValueState.None;
    this.valueStateOptions.start_date = ValueState.None;
    this.valueStateOptions.end_date = ValueState.None;
    this.valueStateOptions.reason = ValueState.None;
    this.LeaveRequest = new LeaveRequests();
    this.LeaveRequest.reason = "";
    this.LeaveRequest.start_date = "";
    this.LeaveRequest.end_date = "";
    this.validationMessageLeaveType = "";
    this.htmlContent = "";
    this.pendingApprovedLeaveDates = [];
    if (this.leaveTypeCombo) {
      this.leaveTypeCombo.value = "";
      this.leaveTypeCombo.selectedItem = null;
    }
    if (this.calendarComponent) {
      this.calendarComponent.selectedDates = [];
    }
    if (this.attachmentUploadRef) {
      this.attachmentUploadRef.fileArr = [];
      this.attachmentUploadRef.fileCount = 0;
    }
    this.isReadOnly = false;
    this.saveMode = saveMode.POST;
    this.open = false;
  }
}
