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
import { saveMode } from "@shared/enums/saveMode";
import { BlackList } from "@app/modules/hr-management/shared/models/blackList";
import { Employee } from "@shared/model/employee";
import { User } from "@shared/model/user";
import { Localization } from "@shared/utilities/localization";
import { ValueState } from "@shared/utilities/value-state-wrapper";
import { Permissions } from "@app/shared/enums/permissions";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import { AgGridTableColumn, AgGridTableODataSourceConfig, AgGridTableRowAction, AgGridTableToolbarConfig, GridTableColumnDataType } from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { DateFormatterService } from "@app/shared/utilities/date-format";
import { AgGridBooleanCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component";
import { AgGridActionCellRendererComponent, AgGridStatusBadgeComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component";
@Component({
  selector: "app-black-list",
  templateUrl: "./black-list.component.html",
  styleUrl: "./black-list.component.scss",
})
export class BlackListComponent implements OnInit {
  @ViewChild("employeeCombo") employeeCombo: any;
  @Output() RefreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<any>();
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent<any>;
  isViewOpen: boolean = false;
  isrevokeOpen: boolean = false;
  viewBlackListData: BlackList = new BlackList();
  insertTitle: string = $localize`New`;
  headerTitle: string = `${$localize`Black`} ${$localize`list`}`;
  isOpenDialog: boolean = false;
  saveMode: string = saveMode.POST;
  localization = Localization;
  EmployeeBlackLists = BlackList;
  EmployeeBlackList = new BlackList();
  employee: Employee | null = null;
  blackList: BlackList = new BlackList().deserialize({});
  ToastType: "add" | "edit" | "error" = "add";
  validationMessage = Localization.requiredField;
  isLoading: boolean = false;
  htmlContent: string = "";
  employeeList: Employee[] = [];
  userList: User[] = [];
  employeeName = "";
  public valueState = ValueState;
  public permissions = Permissions;
  public dialogMode: "VIEW" | "REVOKE" = "VIEW";

  BlacklistTable: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'EmployeeBlacklists',
    expand: 'user,employee',
    pageSize: 50,
    searchFields: ['employee.employee_no', 'employee.first_name', 'employee.last_name', 'reason', 'status'],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.headerTitle,
    addButtonText: this.insertTitle,
    showNewButton: false,
    showSearch: true,
    showRowCount: true,
    showDownload: false,
    showSegmentButton: true,
    button1Text: $localize`All`,
    button2Text: $localize`Reverted`,
    button3Text: $localize`Blacklisted`,
  };


  valueStateOptions = {
    employee_id: ValueState.None,
    reason: ValueState.None,
    remarks: ValueState.None,
  };

  constructor(
    public rolePermissionService: RolePermissionService,
    public commonService: CommonService,
    private authService: AuthService,
    private toastService: ToastService,
    private dateFormatter: DateFormatterService,
  ) {}

  ngOnInit(): void {
    this.toolbarConfig = {
      ...this.toolbarConfig,
      showNewButton: this.rolePermissionService.hasPermission(this.permissions.HR_BLACK_LIST_CREATE),
    };
    this.initializeEmployees();
    this.BlacklistTable = this.buildColumns();
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    return [
      {
        colId: 'employee_no',
        headerName: $localize`Employee ID`,
        minWidth: 130,
        valueGetter: (params: any) => params.data?.employee?.employee_no ?? '',
      },
      {
        colId: 'employee_first_name',
        headerName: $localize`First Name`,
        minWidth: 130,
        valueGetter: (params: any) => params.data?.employee?.first_name ?? '',
      },
      {
        colId: 'employee_last_name',
        headerName: $localize`Last Name`,
        minWidth: 130,
        valueGetter: (params: any) => params.data?.employee?.last_name ?? '',
      },
      {
        field: 'reason',
        headerName: $localize`Reason`,
        minWidth: 150,
      },
      {
        colId: 'added_by',
        headerName: $localize`Added by`,
        minWidth: 130,
        valueGetter: (params: any) => params.data?.user?.name ?? '',
      },
      {
        field: 'revoke_reason',
        headerName: $localize`Revoke Reason`,
        minWidth: 150,
      },
      {
        field: 'status',
        headerName: $localize`Status`,
        minWidth: 120,
        filter: false, floatingFilter: false,
        valueGetter: ({ data }: any) => data?.status ? 'reverted' : 'blacklisted',
        cellRenderer: AgGridStatusBadgeComponent,
      },
      {
        field: 'created_at',
        headerName: $localize`Created On`,
        minWidth: 130,
        filter: false, floatingFilter: false,
        dataType: GridTableColumnDataType.Date,
        valueFormatter: ({ value }: any) =>
          value
            ? this.dateFormatter.formatDate(value, true, false, false, false, false)
            : '',
      },
      {
        field: 'actions',
        headerName: $localize`Actions`,
        width: 120,
        minWidth: 120,
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
              id: 'revoke',
              label: '',
              icon: 'media-reverse',
              tooltip: $localize`Revoke`,
              design: 'Positive',
              visible: (row: any) => !row.status && this.rolePermissionService.hasPermission(this.permissions.HR_BLACK_LIST_CREATE),
            },
            {
              id: 'view',
              label: '',
              icon: 'information',
              tooltip: $localize`View`,
              design: 'Transparent',
            },
            // {
            //   id: 'edit',
            //   label: '',
            //   icon: 'edit',
            //   tooltip: $localize`Edit`,
            //   design: 'Default',
            //   visible: () => this.rolePermissionService.hasPermission(this.permissions.HR_BLACK_LIST_CREATE),
            // },
            
          ] as AgGridTableRowAction<any>[],
          onAction: (actionId: string, row: any) => {
            if (actionId === 'view') this.viewBlackList(row, 'VIEW');
            if (actionId === 'edit') this.EditBlackList(row);
            if (actionId === 'revoke') this.viewBlackList(row, 'REVOKE');
          },
        },
      },
    ];
  }

  saveBlackList() {
    if (!this.validateForm()) {
      return;
    }

    this.isLoading = true;
    let url = "";
    let request$;
    const currentUser = this.authService.user();
    const payload = {
      ...this.blackList,
      added_by: currentUser.id,
      remarks: this.htmlContent,
      employee: undefined,
      user: undefined,
    };
    if (this.saveMode === saveMode.POST) {
      url = "EmployeeBlacklists";
      this.ToastType = "add";
      request$ = this.commonService.post(url, payload, true);
    } else if (this.saveMode === saveMode.PUT) {
      url = `EmployeeBlacklists(${this.blackList.id})`;
      this.ToastType = "edit";
      request$ = this.commonService.put(url, payload, true);
    }

    if (request$) {
      request$.subscribe({
        next: (res: any) => {
          const employeePayload = {
            is_active: false,
          };
          this.commonService
            .post(`employee/blacklist/${this.blackList.employee_id}`, {}, false)
            .subscribe({
              next: () => {
                this.initializeEmployees();
                this.CloseDialog();
                this.RefreshTable.emit();
                this.agGridRef?.refreshGridData(true);
                this.toastService.show(this.ToastType);
              },
              error: (err: any) => {
                console.error("Error updating employee status:", err);
                this.CloseDialog();
                this.toastService.show("error");
              },
            });
        },
        error: (err: any) => {
          console.error("Error saving leave request:", err);
          this.CloseDialog();
          this.toastService.show("error");
        },
      });
    }
  }

  checkPermission(data: string) {
    const permission = data;
    const isPermissions = this.rolePermissionService.hasPermission(permission);
    return isPermissions;
  }

  checkValidation(event: any, field: string) {
    const value = event.target.value ? event.target.value : "";
    let values = "";
    switch (field) {
      case "remarks":
        values = this.htmlContent || "";
        if (!values || !values.trim()) {
          this.valueStateOptions.remarks = ValueState.Negative;
        } else {
          this.valueStateOptions.remarks = ValueState.None;
        }
        break;
      case "reason":
        if (!value || !value.trim()) {
          this.valueStateOptions.reason = ValueState.Negative;
        } else {
          this.valueStateOptions.reason = ValueState.None;
        }
        break;
    }
  }
  validateForm(): boolean {
    let isValid = true;
    if (!this.htmlContent || !this.htmlContent.trim()) {
      this.valueStateOptions.remarks = ValueState.Negative;
      isValid = false;
    }
    if (!this.blackList.reason || !this.blackList.reason.trim()) {
      this.valueStateOptions.reason = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  newBlackList() {
    this.EmployeeBlackList = new BlackList().deserialize({});
    this.isOpenDialog = true;
    this.saveMode = saveMode.POST;
  }

  EditBlackList(data: any) {
    this.blackList = new BlackList().deserialize(data);
    this.saveMode = saveMode.PUT;
    this.htmlContent = data.remarks;
    this.isOpenDialog = true;
    if (data.employee) {
      this.employeeName = `${data.employee.employee_no} - ${
        data.employee.first_name
      } ${data.employee.last_name ?? ""}`;
    }
  }

  viewBlackList(data: any, mode: "VIEW" | "REVOKE" = "VIEW") {
    this.dialogMode = mode;
    this.blackList = new BlackList().deserialize(data);
    this.isViewOpen = true;
    if (data.employee) {
      this.employeeName = `${data.employee.employee_no} - ${
        data.employee.first_name
      } ${data.employee.last_name ?? ""}`;
    }
  }
  revokeBlackList() {
    const payload = {
      status: true,
      revoke_reason: this.blackList.revoke_reason,
    };
    this.commonService
      .put(`EmployeeBlacklists/${this.blackList.id}`, payload, true)
      .subscribe({
        next: () => {
          this.revokedata(this.viewBlackListData);
          this.CloseDialog();
          this.agGridRef?.refreshGridData(true);
          this.toastService.show("edit");
        },
        error: (err) => {
          console.error("Error revoking blacklist:", err);
          this.CloseDialog();
          this.toastService.show("error");
        },
      });
  }

  revokedata(data: any) {
    console.log("Revoking blacklist for employee ID:", data); // Debug log to check employee ID
    this.commonService
      .post(`employee/blacklist-revoked/${data.employee_id}`, {}, false)
      .subscribe({
        next: () => {
          this.initializeEmployees();
          this.CloseDialog();
          this.agGridRef?.refreshGridData(true);
          this.toastService.show("edit");
        },
        error: (err) => {
          console.error("Error updating employee status:", err);
          this.CloseDialog();
          this.toastService.show("error");
        },
      });
  }
  selectedEmployee(data: any) {
    this.blackList.employee_id = data.detail.item.id;
  }

  initializeEmployees() {
    this.isLoading = true;
    this.commonService
      .get("Employees?&$top=10000&$filter=is_active eq true")
      .subscribe({
        next: (response: any) => {
          this.employeeList = response.value;
          this.isLoading = false;
        },
        error: (err) => {
          console.error("Employee fetch Error", err);
          this.isLoading = false;
        },
      });
  }
  CloseDialog() {
    this.valueStateOptions.reason = ValueState.None;
    this.valueStateOptions.remarks = ValueState.None;
    this.blackList = new BlackList();
    this.isOpenDialog = false;
    this.isViewOpen = false;
    this.isLoading = false;
    this.blackList.reason = "";
    this.employeeName = "";
    this.htmlContent = "";
    if (this.employeeCombo) {
      this.employeeCombo.value = "";
      this.employeeCombo.selectedItem = null;
    }
  }
}
