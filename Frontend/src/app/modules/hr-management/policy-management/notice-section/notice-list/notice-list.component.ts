import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from "@angular/core";
import { NoticeTargetAudience } from "@app/modules/hr-management/shared/enums/noticeTargetAudience";
import { Notice } from "@app/modules/hr-management/shared/models/notice";
import { NoticeEmployee } from "@app/modules/hr-management/shared/models/noticsEmployee";
import { CommonService } from "@app/services/common-service/common.service";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { saveMode } from "@app/shared/enums/saveMode";
import { Employee } from "@app/shared/model/employee";
import { Localization } from "@app/shared/utilities/localization";
import { NoticeFormComponent } from "../notice-form/notice-form.component";
import { Permissions } from "@app/shared/enums/permissions";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import { AgGridCustomButton, AgGridTableColumn, AgGridTableODataSourceConfig, AgGridTableToolbarConfig, GridTableColumnDataType } from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { AgGridStatusBadgeComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component";
import { DateFormatterService } from "@app/shared/utilities/date-format";
@Component({
  selector: "app-notice-list",
  templateUrl: "./notice-list.component.html",
  styleUrl: "./notice-list.component.scss",
})
export class NoticeListComponent {
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent<any>;
  @ViewChild("feedbackGridRef") feedbackGridRef?: AgGridTableComponent<any>;
  @ViewChild("noticesForm") noticesFormRef!: NoticeFormComponent;

  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<any>();
  @Input() employee: Employee = new Employee();

  saveMode: string = saveMode.POST;
  localization = Localization;
  isLoading: boolean = false;
  isopen = false;
  NoticeTargetAudience = NoticeTargetAudience;
  targetType: NoticeTargetAudience = NoticeTargetAudience.ALL;
  isViewOpen: boolean = false;
  button1Text: string = $localize`All`;
  button2Text: string = $localize`Published`;
  button3Text: string = $localize`Draft`;
  insertTitle: string = this.localization.New;
  headerTitle: string = `${$localize`Notice`} ${$localize`list`}`;
  noticeList = new Notice().deserialize({});
  htmlContent: string = "";
  Notices = Notice;
  notices = new Notice();
  selectedDepartmentIds: number[] = [];
  selectedEmployeeIds: number[] = [];
  allNoticeEmployees: NoticeEmployee[] = [];
  departments: any[] = [];
  employeeList: Employee[] = [];
  NoticeEmployeeList: NoticeEmployee = new NoticeEmployee();
  viewNoticeData: Notice = new Notice();
  selectedNoticeId: number | undefined;
  selectedTab = "NoticeDetail";
  permissions = Permissions;
  employeeFeedback: string = `${$localize`Employee`} ${$localize`list`}`;
  RequireAcknowledgement: string = `${$localize`Require`} ${$localize`Acknowledgement`} `;
  NoticeEmployee = NoticeEmployee;

  NoticeList: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'Notices',
    pageSize: 50,
    searchFields: ['title'],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.headerTitle,
    addButtonText: this.insertTitle,
    showSearch: true,
    showRowCount: true,
    showNewButton: this.permission.hasPermission(this.permissions.HR_NOTICE_CREATE),
    showDownload: false,
    showSegmentButton: true,
    button1Text: $localize`All`,
    button2Text: $localize`Published`,
    button3Text: $localize`Draft`,
  };

  noticeEditButton: AgGridCustomButton[] = [
    {
      id: 'edit',
      icon: 'edit',
      tooltip: $localize`Edit`,
      design: 'Transparent',
      hide: () => !this.permission.hasPermission(this.permissions.HR_NOTICE_EDIT),
      disable: (row: any) => row?.is_active === true,
      onClick: (row: any) => this.editNotice(row),
    },
    {
      id: 'delete',
      icon: 'delete',
      tooltip: $localize`Delete`,
      design: 'Negative',
      hide: () => !this.permission.hasPermission(this.permissions.HR_NOTICE_DELETE),
      disable: (row: any) => row?.is_active === true,
      onClick: (row: any) => this.deleteClick(row.id),
    },
  ];

  constructor(
    public permission: RolePermissionService,
    private commonService: CommonService,
    private cdr: ChangeDetectorRef,
    private dateFormatter: DateFormatterService,
  ) { }

  ngOnInit(): void {
    this.NoticeList = this.buildColumns();
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    return [
      {
        field: 'title',
        headerName: $localize`Title`,
        minWidth: 200,
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
            ? this.dateFormatter.formatDate(value, true, false, false, false, false)
            : '',
      },
    ];
  }

  deleteClick(id: any): void {
    this.IsDelete.emit(`Notices/${id}`);
  }

  newNotice() {
    this.noticesFormRef.noticeList = new Notice();
    this.noticesFormRef.saveMode = saveMode.POST;
    this.noticesFormRef.isopen = true;
  }
  getAudienceType(target_audience: any): NoticeTargetAudience {
    const val = target_audience || "";
    if (val === "DEPARTMENT") {
      return NoticeTargetAudience.DEPARTMENT;
    } else if (val === "INDIVIDUAL") {
      return NoticeTargetAudience.INDIVIDUAL;
    } else {
      return NoticeTargetAudience.ALL;
    }
  }
  editNotice(data: any) {
    this.noticesFormRef.isopen = true;
    this.noticesFormRef.targetType = this.getAudienceType(data.target_audience);
    this.noticesFormRef.isLoading = true;
    this.fetchNoticeDetails(data.id);
  }

  processData(event?: any) {
    this.refreshTable.emit(event);
    this.agGridRef?.refreshGridData(true);
  }

  fetchNoticeDetails(id: number) {
    this.commonService
      .get(
        `Notices(${id})?$expand=employees,departments`
      )
      .subscribe({
        next: (res: any) => {
          this.noticesFormRef.isLoading = false;
          this.getNoticeForm(res);
        },
        error: (err: any) => {
          console.error("Error fetching notice details:", err);
          this.noticesFormRef.isLoading = false;
        },
      });
  }

  getNoticeForm(res: any) {
    this.noticesFormRef.noticeList = res;
    this.noticesFormRef.htmlContent = res.content;
    this.noticesFormRef.saveMode = saveMode.PUT;
    this.noticesFormRef.isopen = true;

    const audience = this.getAudienceType(res.target_audience);

    switch (audience) {
      case NoticeTargetAudience.DEPARTMENT:
        this.noticesFormRef.selectedDepartmentIds =
          res.departments?.map((d: any) => d.id) || [];
        this.noticesFormRef.selectedEmployeeIds = [];
        break;

      case NoticeTargetAudience.INDIVIDUAL:
        this.noticesFormRef.selectedEmployeeIds =
          res.employees?.map((e: any) => e.id) || [];
        this.noticesFormRef.selectedDepartmentIds = [];
        break;

      case NoticeTargetAudience.ALL:
        this.noticesFormRef.selectedEmployeeIds = this.employeeList
          .map((emp) => emp.id)
          .filter((id): id is number => typeof id === "number");
        this.noticesFormRef.selectedDepartmentIds = [];
        break;
    }

    this.commonService
      .get(`NoticesEmployees?$filter=notice_id eq ${res.id}`)
      .subscribe((empRes: any) => {
        let noticeEmployeeData = empRes.value?.[0] || {
          is_acknowledged: false,
          is_read: false,
        };

        this.noticesFormRef.NoticeEmployeeList = new NoticeEmployee().deserialize(noticeEmployeeData);
        this.cdr.detectChanges();
      });
  }

  onTabSelect(event: any) {
    this.selectedTab = event.detail.tab.id;
  }

  viewNotice(data: any) {
    this.viewNoticeData = data;
    this.selectedNoticeId = data.id;
    this.feedbackDataSource = {
      ...this.feedbackDataSource,
      filter: `notice_id eq ${data.id}`,
    };
    this.isViewOpen = true;
    this.isLoading = true;

    this.fatchAcknowledged(data.id);

    setTimeout(() => {
      this.feedbackGridRef?.refreshGridData(true);
    });
  }

  fatchAcknowledged(noticeId: number) {
    this.NoticeEmployeeList = new NoticeEmployee().deserialize({ is_acknowledged: false, is_read: false });

    this.commonService.get(`NoticesEmployees?$filter=notice_id eq ${noticeId}`).subscribe({
      next: (res: any) => {
        let noticeEmployeeData = { is_acknowledged: false, is_read: false };

        if (res.value && res.value.length > 0) {
          noticeEmployeeData = res.value[0];
        }

        this.NoticeEmployeeList = new NoticeEmployee().deserialize(noticeEmployeeData);

        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching notice employee status:', err);
        this.isLoading = false;
      }
    });
  }

  feedbackColumns: AgGridTableColumn<any>[] = [
    {
      colId: "employee.employee_no",
      headerName: $localize`Employee ID`,
      minWidth: 130,
      valueGetter: (p) => p.data?.employee?.employee_no ?? "",
    },
    {
      colId: "employee.first_name",
      headerName: $localize`First Name`,
      flex: 1,
      minWidth: 130,
      valueGetter: (p) => p.data?.employee?.first_name ?? "",
    },
    {
      colId: "employee.last_name",
      headerName: $localize`Last Name`,
      flex: 1,
      minWidth: 130,
      valueGetter: (p) => p.data?.employee?.last_name ?? "",
    },
    {
      field: "is_read",
      headerName: $localize`Read`,
      minWidth: 100,
      valueGetter: ({ data }: any) => data?.is_read ? 'is_read' : 'is_unread',
      cellRenderer: AgGridStatusBadgeComponent,
    },
  ];

  feedbackDataSource: AgGridTableODataSourceConfig<any> = {
    type: "odata",
    endpoint: "NoticesEmployees",
    expand: "employee",
    filter: "notice_id eq 0",
    pageSize: 50,
    searchFields: ["employee.first_name", "employee.last_name"],
  };

  CloseDialog() {
    this.isopen = false;
    this.isViewOpen = false;
    this.isLoading = false;
    this.resetForm();
  }
  resetForm() {
    this.noticeList = new Notice();
    this.htmlContent = "";
    this.selectedTab = "NoticeDetail";
    this.selectedDepartmentIds = [];
    this.selectedEmployeeIds = [];
    this.NoticeEmployeeList = new NoticeEmployee();
  }
}
