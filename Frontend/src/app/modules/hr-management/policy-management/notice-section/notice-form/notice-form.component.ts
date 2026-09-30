import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NoticeTargetAudience } from '@app/modules/hr-management/shared/enums/noticeTargetAudience';
import { Notice } from '@app/modules/hr-management/shared/models/notice';
import { NoticeEmployee } from '@app/modules/hr-management/shared/models/noticsEmployee';
import { AuthService } from '@app/services/auth-service/auth.service';
import { CommonService } from '@app/services/common-service/common.service';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { SocketService } from '@app/services/socket.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { saveMode } from '@shared/enums/saveMode';
import { Employee } from '@shared/model/employee';
import { Localization } from '@shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';

@Component({
  selector: 'app-notice-form',
  templateUrl: './notice-form.component.html',
  styleUrl: './notice-form.component.scss',
})
export class NoticeFormComponent {
  @Input() notice: Notice = new Notice();
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<any>();
  @Input() employee: Employee = new Employee();

  public valueState = ValueState;
  departments: any[] = [];
  employeeList: Employee[] = [];
  isLoading: boolean = false;
  isopen: boolean = false;
  isViewOpen: boolean = false;
  RequireAcknowledgement: string = `${$localize`Require`} ${$localize`Acknowledgement`} `;
  localization = Localization;
  saveMode: string = saveMode.POST;
  notices = Notice;
  api: boolean = false;
  NoticeTargetAudience = NoticeTargetAudience;
  targetType: NoticeTargetAudience = NoticeTargetAudience.ALL;
  selectedDepartmentIds: number[] = [];
  selectedEmployeeIds: number[] = [];
  allNoticeEmployees: NoticeEmployee[] = [];
  htmlContent: string = '';
  viewNoticeData: Notice = new Notice();
  noticeList = new Notice();
  NoticeEmployeeList: NoticeEmployee = new NoticeEmployee();
  NoticeEmployee = NoticeEmployee;
  selectedNoticeId: number | undefined;
  selectedTab = 'NoticeDetail';
  ToastType: 'add' | 'edit' | 'error' = 'add';
  validationMessage = Localization.requiredField;
  valueStateOptions = {
    title: ValueState.None,
    content: ValueState.None,
    published_at: ValueState.None,
  };

  constructor(
    private rolePermissionService: RolePermissionService,
    private commonService: CommonService,
    private toastService: ToastService,
    private authService: AuthService,
    private socketService: SocketService,
  ) {}

  ngOnInit(): void {
    this.initDepartment();
    this.GetEmployees();
    this.getEmployeeNotice();
  }

  getEmployeeNotice() {
    this.commonService.get(`NoticesEmployees`).subscribe({
      next: (res: any) => {
        this.allNoticeEmployees = res.value;
      },
      error: (err) => {
        console.error('Error fetching employee notices:', err);
      },
    });
  }

  checkValidation(event: any, field: string) {
    const value = event.target.value ?? '';
    let values = '';
    switch (field) {
      case 'content':
        values = this.htmlContent || '';
        if (!values || !values.trim()) {
          this.valueStateOptions.content = ValueState.Negative;
        } else {
          this.valueStateOptions.content = ValueState.None;
        }
        break;
      case 'title':
        this.valueStateOptions.title = !value.trim()
          ? ValueState.Negative
          : ValueState.None;
        this.noticeList.title = value;
        break;
    }
  }

  validateForm(): boolean {
    let isValid = true;
    if (!this.noticeList.title?.trim()) {
      this.valueStateOptions.title = ValueState.Negative;
      isValid = false;
    }
    if (!this.htmlContent || !this.htmlContent.trim()) {
      this.valueStateOptions.content = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  saveNotice() {
    this.isLoading = true;
    let url = '';
    let request$;

    const payload: any = {
      ...this.noticeList,
      content: this.htmlContent,
      target_audience: this.targetType,
      published_at: this.NoticeEmployeeList.published_at,
      is_acknowledged: this.NoticeEmployeeList.is_acknowledged,
      is_read: this.NoticeEmployeeList.is_read,
    };
    switch (this.targetType) {
      case NoticeTargetAudience.DEPARTMENT:
        payload.departments = this.selectedDepartmentIds;
        break;
      case NoticeTargetAudience.INDIVIDUAL:
        payload.employees = this.selectedEmployeeIds;
        break;
      case NoticeTargetAudience.ALL:
        payload.employees = this.employeeList.map((employees) => employees.id);
        break;
    }
    if (this.saveMode === saveMode.POST) {
      url = 'hrm/notices';
      this.ToastType = 'add';
      request$ = this.commonService.post(url, payload, false);
    } else if (this.saveMode === saveMode.PUT) {
      url = `hrm/notices/${this.noticeList.id}`;
      this.ToastType = 'edit';
      request$ = this.commonService.put(url, payload, false);
    }

    request$?.subscribe({
      next: (res: any) => {
        const wasPublished = this.noticeList.is_active === true;
        this.CloseDialog();
        this.refreshTable.emit();
        this.toastService.show(this.ToastType);
        this.isLoading = false;
        if (wasPublished) {
          const user = this.authService.user();
          this.socketService.emit('hrm-notice:created', {
            model_id: res?.data?.id ?? 0,
            model_custom_id: res?.data?.custom_id ?? String(res?.data?.id ?? ''),
            sender_id: user?.id ?? 0,
            sender_name: user?.name ?? '',
            recipient_user_ids: res?.recipient_user_ids ?? [],
          });
        }
      },
      error: (err: any) => {
        console.error('Notice API Call Error:', err);
        this.CloseDialog();
        this.toastService.show('error');
        this.isLoading = false;
      },
    });
  }

  onTargetTypeChange(event: any) {
    const val = event.detail.selectedOption.value;
    this.targetType = val;

    switch (this.targetType) {
      case NoticeTargetAudience.ALL:
        this.selectedEmployeeIds = this.employeeList
          .map((emp) => emp.id)
          .filter((id): id is number => typeof id === 'number');
        this.selectedDepartmentIds = [];
        break;

      case NoticeTargetAudience.DEPARTMENT:
      case NoticeTargetAudience.INDIVIDUAL:
        this.selectEmployeeDepartmentId();
        break;

      default:
        this.selectedEmployeeIds = [];
        this.selectedDepartmentIds = [];
        break;
    }
  }

  selectEmployeeDepartmentId() {
    this.selectedEmployeeIds = [];
    this.selectedDepartmentIds = [];
  }

  getDepartment(event: any) {
    const selected = event.detail.items;
    this.selectedDepartmentIds = selected.map((department: any) =>
      Number(department.id)
    );
  }

  selectedEmployeesChange(event: any) {
    if (this.targetType !== NoticeTargetAudience.ALL) {
      const selected = event.detail.items;
      this.selectedEmployeeIds = selected.map((employees: any) =>
        Number(employees.id)
      );
    }
  }

  initDepartment() {
    this.commonService.get('Departments?$filter=is_active eq true').subscribe({
      next: (res: any) => {
        this.departments = res.value;
      },
      error: (err) => {
        console.error('Error fetching departments:', err);
      },
    });
  }

  GetEmployees() {
    this.isLoading = true;
    this.commonService
      .get('Employees?&$top=10000&$orderby=id desc & filter=is_active eq true', true)
      .subscribe({
        next: (res: any) => {
          this.employeeList = res.value;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Employee fetch error', err);
          this.isLoading = false;
        },
      });
  }

  onTabSelect(event: any) {
    this.selectedTab = event.detail.tab.id;
  }

  saveAsDraft() {
    if (!this.validateForm()) return;
    this.isLoading = true;
    this.noticeList.is_active = false;
    this.saveNotice();
  }
  publishNotice() {
    if (!this.validateForm()) return;
    this.isLoading = true;
    this.noticeList.is_active = true;
    this.saveNotice();
  }

  CloseDialog() {
    this.resetForm();
    this.isopen = false;
    this.isViewOpen = false;
    this.isLoading = false;
    this.targetType = NoticeTargetAudience.ALL;
    this.selectedDepartmentIds = [];
    this.selectedEmployeeIds = [];
    this.NoticeEmployeeList = new NoticeEmployee();
  }
  resetForm() {
    this.noticeList = new Notice();
    this.htmlContent = '';
    this.valueStateOptions = {
      title: ValueState.None,
      content: ValueState.None,
      published_at: ValueState.None,
    };
  }
}
