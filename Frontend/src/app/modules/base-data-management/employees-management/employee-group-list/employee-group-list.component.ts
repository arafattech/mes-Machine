import {
  Component,
  EventEmitter,
  Output,
  ViewChild,
} from "@angular/core";
import { forkJoin } from "rxjs";
import { CommonService } from "@app/services/common-service/common.service";
import { EmployeeGroup } from "@app/modules/hr-management/shared/models/employeeGroup";
import { Localization } from "@shared/utilities/localization";
import { saveMode } from "@shared/enums/saveMode";
import { ValueState } from "@shared/utilities/value-state-wrapper";
import { ToastService } from "@app/services/toast-service/toast.service";
import { EmployeeGroupFormComponent } from "@base-data-module/employees-management/employee-group-list/employee-group-form/employee-group-form.component";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { Permissions } from "@app/shared/enums/permissions";
import { EmployeeShift } from "@app/modules/hr-management/shared/models/employeeShift";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { AgGridBooleanCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component";

@Component({
  selector: "app-employee-group-list",
  templateUrl: "./employee-group-list.component.html",
  styleUrl: "./employee-group-list.component.scss",
})
export class EmployeeGroupListComponent {
  @Output() IsDelete = new EventEmitter<any>();
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() refreshGroupEmployeeTable: EventEmitter<void> = new EventEmitter<void>();
  @ViewChild("employeegroupAssociate") employeegroupAssociate!: EmployeeGroupFormComponent;
  @ViewChild("groupTableRef") groupTableRef?: AgGridTableComponent<any>;

  public localization = Localization;
  insertTitle = `${this.localization.Assign}`;
  headerTitle = `${$localize`Employee`}`;
  GroupHeaderTitle = $localize`Group List`;
  employeeGroup = new EmployeeGroup();
  isListCollapsed = false;
  open = false;
  isopen = false;
  loading = false;
  ToastType: "add" | "edit" | "error" = "add";
  isTabCollapsed = false;
  selectedGroupId: number | null = null;
  selectedEmployeeIds: number[] = [];
  pendingRemoveEmployeeIds: number[] = [];
  validationMessage = Localization.requiredField;
  IsLoading = false;
  isRemoveEmplyee = false;
  public permissionEnum = Permissions;
  employeeShifts: EmployeeShift[] = [];
  selectedShiftName = "";
  saveMode: string = saveMode.POST;
  valueStateOptions = { name: ValueState.None };

  groupColumns: AgGridTableColumn<any>[] = [
    {
      field: "is_active",
      headerName: $localize`Active`,
      cellRenderer: AgGridBooleanCellRendererComponent,
      filter: false,
      sortable: false,
      floatingFilter: false,
      width: 90,
      minWidth: 80,
    },
    { field: "custom_id", headerName: $localize`Custom ID`, minWidth: 120, sort: "desc" },
    { field: "name", headerName: $localize`Name`, minWidth: 180 },
    {
      field: "is_permanent",
      headerName: $localize`Permanent`,
      cellRenderer: AgGridBooleanCellRendererComponent,
      filter: false,
      sortable: false,
      floatingFilter: false,
      minWidth: 110,
    },
  ];

  employeeColumns: AgGridTableColumn<any>[] = [
    {
      field: "is_active",
      headerName: $localize`Active`,
      cellRenderer: AgGridBooleanCellRendererComponent,
      filter: false,
      sortable: false,
      floatingFilter: false,
      width: 90,
      minWidth: 80,
    },
    { field: "employee_no", 
      headerName: $localize`Employee ID`, 
      minWidth: 130 
    },
    { field: "first_name", 
      headerName: $localize`First Name`, 
      minWidth: 130,
      sortable: false,
    },
    { field: "last_name", 
      headerName: $localize`Last Name`, 
      minWidth: 130,
      sortable: false, 
    },
    {
      field: "designation.name",
      headerName: $localize`Designation`,
      minWidth: 150,
      sortable: false,
      valueGetter: (params: any) => params.data?.designation?.name ?? "",
    },
    {
      field: "department.name",
      headerName: $localize`Department`,
      minWidth: 150,
      sortable: false,
      valueGetter: (params: any) => params.data?.department?.name ?? "",
    },
    {
      field: "employeeType.name",
      headerName: $localize`Type`,
      minWidth: 150,
      sortable: false,
      valueGetter: (params: any) => params.data?.employeeType?.name ?? "",
    },
    {
      field: "employeeSection.name",
      headerName: $localize`Section`,
      minWidth: 150,
      sortable: false,
      valueGetter: (params: any) => params.data?.employeeSection?.name ?? "",
    },
  ];

  groupDataSource: AgGridTableODataSourceConfig = {
    type: "odata",
    endpoint: "EmployeeGroups",
    pageSize: 50,
    sortBy: "custom_id",
    sortDirection: "desc",
    searchFields: ['name', 'custom_id'],
  };

  groupToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.GroupHeaderTitle,
    showSearch: true,
    showRowCount: true,
    addButtonText: 'New',
    showNewButton:
      this.permission.hasPermission(this.permissionEnum.HR_EMPLOYEE_GROUP_CREATE) ||
      this.permission.hasPermission(this.permissionEnum.BASE_DATA_EMPLOYEE_GROUP_CREATE),
    showDownload: false,
    showScanner: false,
    showSegmentButton: true,
  };

  groupDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: "calc(100vh - 120px)",
  };

  employeeDataSource: AgGridTableODataSourceConfig = {
    type: "odata",
    endpoint: "",
    expand: "department,designation,employeeType,employeeSection",
    pageSize: 50,
    filter: "",
    searchFields: ['first_name', 'last_name', 'employee_no'],
  };

  employeeToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.headerTitle,
    addButtonText: this.insertTitle,
    showSearch: true,
    showRowCount: true,
    showNewButton: false,
    showDownload: false,
    showScanner: false,
    showExtraButton: false,
    extraButtonText: $localize`Remove`,
    extraButtonDesign: 'Negative',
    extraButtonDisable: true,
  };

  employeeDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: "calc(100vh - 120px)",
  };

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
    public permission: RolePermissionService
  ) {
    this.initEmployeeShifts();
  }

  initEmployeeShifts() {
    this.commonService
      .get("EmployeeShifts?$filter=is_active eq true", true)
      .subscribe({
        next: (res: any) => {
          this.employeeShifts = (res.value || []).map((item: any) =>
            new EmployeeShift().deserialize(item)
          );
          this.selectedShiftName = this.getShiftName(this.employeeGroup.shift_id);
        },
        error: (err: any) => console.error(err),
      });
  }

  getShiftName(shiftId: number | null | undefined): string {
    if (!shiftId) return "";
    return (
      this.employeeShifts.find((s) => Number(s.id) === Number(shiftId))?.name || ""
    );
  }

  onShiftChange(event: any) {
    const selectedItem = event?.detail?.item;
    if (!selectedItem) {
      this.employeeGroup.shift_id = null;
      this.selectedShiftName = "";
      return;
    }
    this.employeeGroup.shift_id = Number(selectedItem.id);
    this.selectedShiftName = selectedItem.text ?? "";
  }

  onPermanentChange() {
    if (!this.employeeGroup.is_permanent) {
      this.employeeGroup.shift_id = null;
      this.selectedShiftName = "";
    }
  }

  processData(data: any) {
    const rows = Array.isArray(data?.[0]) ? data[0] : data;
    if (!Array.isArray(rows) || rows.length === 0) {
      if (this.selectedGroupId === null) this.clearGroupSelection();
      return;
    }

    if (this.selectedGroupId === null) {
      this.applyGroupSelection(rows[0]);
    }

    const targetId = String(this.selectedGroupId ?? "");
    if (!targetId) return;

    setTimeout(() => {
      const api = this.groupTableRef?.getGridApi();
      if (!api) return;
      api.forEachNode((node: any) => {
        if (String(node.data?.id ?? "") === targetId) node.setSelected(true, false, "api");
      });
    }, 0);
  }

  selectedRowData(row: any) {
    if (!row?.id) return;
    this.applyGroupSelection(row);
    const targetId = String(row.id);
    setTimeout(() => {
      const api = this.groupTableRef?.getGridApi();
      if (!api) return;
      api.forEachNode((node: any) => {
        if (String(node.data?.id ?? "") === targetId) node.setSelected(true, false, "api");
      });
    }, 0);
  }

  applyGroupSelection(group: any) {
    this.selectedGroupId = group.id;
    this.employeegroupAssociate.selectedGroupId = this.selectedGroupId;
    this.employeeDataSource = {
      ...this.employeeDataSource,
      endpoint: "Employees",
      filter: `group_id eq ${this.selectedGroupId} and is_active eq true`,
    };
    this.employeeToolbarConfig = {
      ...this.employeeToolbarConfig,
      showNewButton: true,
    };
  }

  clearGroupSelection() {
    this.selectedGroupId = null;
    if (this.employeegroupAssociate) {
      this.employeegroupAssociate.selectedGroupId = null;
    }
    this.employeeDataSource = { ...this.employeeDataSource, endpoint: "", filter: "" };
    this.employeeToolbarConfig = {
      ...this.employeeToolbarConfig,
      showNewButton: false,
      showExtraButton: false,
      extraButtonDisable: true,
    };
  }

  onEmployeeSelectionChanged(rows: any[]) {
    this.selectedEmployeeIds = rows.map((row) => row.id).filter((id): id is number => typeof id === "number");
    this.employeeToolbarConfig = {
      ...this.employeeToolbarConfig,
      showExtraButton: this.selectedEmployeeIds.length > 0,
      extraButtonText: this.selectedEmployeeIds.length
        ? `${$localize`Remove`} (${this.selectedEmployeeIds.length})`
        : $localize`Remove`,
      extraButtonDisable: this.selectedEmployeeIds.length === 0,
    };
  }

  refreshEmployeeTable() {
    if (this.selectedGroupId === null) {
      this.employeeDataSource = { ...this.employeeDataSource, endpoint: "", filter: "" };
    } else {
      this.employeeDataSource = {
        ...this.employeeDataSource,
        endpoint: "Employees",
        filter: `group_id eq ${this.selectedGroupId}`,
      };
    }
  }

  refreshGroupTable() {
    setTimeout(() => this.groupTableRef?.refreshGridData(true));
  }

  deleteGroup(data: any) {
    this.IsDelete.emit(`EmployeeGroups/${data.id}`);
  }

  onRemoveFromGroup(data: any) {
    const employeeId = data?.id;
    if (!employeeId) return;
    this.pendingRemoveEmployeeIds = [employeeId];
    this.isRemoveEmplyee = true;
  }

  onBulkRemoveFromGroup() {
    if (!this.selectedEmployeeIds.length) return;
    this.pendingRemoveEmployeeIds = [...this.selectedEmployeeIds];
    this.isRemoveEmplyee = true;
  }

  removeFromGroup() {
    if (!this.pendingRemoveEmployeeIds.length) {
      this.isRemoveEmplyee = false;
      return;
    }

    this.IsLoading = true;
    forkJoin(
      this.pendingRemoveEmployeeIds.map((employeeId) =>
        this.commonService.put(`Employees(${employeeId})`, { group_id: null }, true)
      )
    ).subscribe({
      next: () => {
        this.IsLoading = false;
        this.isRemoveEmplyee = false;
        this.pendingRemoveEmployeeIds = [];
        this.selectedEmployeeIds = [];
        this.employeeToolbarConfig = {
          ...this.employeeToolbarConfig,
          showExtraButton: false,
          extraButtonText: $localize`Remove`,
          extraButtonDisable: true,
        };
        this.employeegroupAssociate.refreshTable.emit();
        this.refreshEmployeeTable();
      },
      error: (err: any) => {
        this.IsLoading = false;
        console.error(err);
      },
    });
  }

  onCLickListCollapsed() {
    this.isListCollapsed = !this.isListCollapsed;
  }

  onCLickTabCollapsed() {
    this.isTabCollapsed = !this.isTabCollapsed;
  }

  checkValidation(event: any, field: string) {
    const value = event.target.value ? event.target.value : "";
    if (field === "name") {
      if (!value.trim()) {
        this.valueStateOptions.name = ValueState.Negative;
      } else {
        this.employeeGroup.name = value;
        this.valueStateOptions.name = ValueState.None;
      }
    }
  }

  validateForm(): boolean {
    if (!this.employeeGroup.name?.trim()) {
      this.valueStateOptions.name = ValueState.Negative;
      return false;
    }
    return true;
  }

  editGroup(data: any) {
    this.employeeGroup = new EmployeeGroup().deserialize(data);
    this.selectedShiftName = this.getShiftName(this.employeeGroup.shift_id);
    this.saveMode = saveMode.PUT;
    this.open = true;
  }

  newGroup() {
    this.employeeGroup = new EmployeeGroup().deserialize({});
    this.selectedShiftName = "";
    this.saveMode = saveMode.POST;
    this.open = true;
  }

  newEmployee() {
    this.isopen = true;
  }

  saveGroup() {
    if (!this.validateForm()) return;
    this.loading = true;

    const request$ =
      this.saveMode === saveMode.POST
        ? this.commonService.post("EmployeeGroups", this.employeeGroup.toOdata(), true)
        : this.commonService.put(
            `EmployeeGroups(${this.employeeGroup.id})`,
            this.employeeGroup.toOdata(),
            true
          );

    this.ToastType = this.saveMode === saveMode.POST ? "add" : "edit";

    request$.subscribe({
      next: (res: any) => {
        this.refreshTable.emit();
        if (this.saveMode === saveMode.POST && res?.id != null) {
          this.applyGroupSelection(res);
        }
        this.refreshGroupTable();
        this.toastService.show(this.ToastType);
        this.closeDialog();
      },
      error: (err: any) => {
        console.error("Error saving group", err);
        this.toastService.show("error");
        this.closeDialog();
      },
    });
  }

  closeDialog() {
    this.open = false;
    this.loading = false;
    this.employeeGroup = new EmployeeGroup().deserialize({});
    this.selectedShiftName = "";
  }
}
