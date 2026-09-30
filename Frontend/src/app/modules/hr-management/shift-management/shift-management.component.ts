import { Component, EventEmitter, OnInit, Output, ViewChild } from "@angular/core";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { saveMode } from "@shared/enums/saveMode";
import { Localization } from "@shared/utilities/localization";
import { ValueState } from "@shared/utilities/value-state-wrapper";
import { CommonService } from "@app/services/common-service/common.service";
import { ToastService } from "@app/services/toast-service/toast.service";
import { EmployeeShift } from "@app/modules/hr-management/shared/models/employeeShift";
import { Permissions } from "@app/shared/enums/permissions";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import { AgGridTableColumn, AgGridTableODataSourceConfig, AgGridTableToolbarConfig } from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { AgGridBooleanCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component";
import { AgGridColorBadgeComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component";
import { formatTime } from "@app/modules/hr-management/shared/utilities/dateTime-format";
@Component({
  selector: "app-shift-management",
  templateUrl: "./shift-management.component.html",
  styleUrl: "./shift-management.component.scss",
})
export class ShiftManagementComponent implements OnInit {
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent<any>;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<any>();
  EmployeeShift = EmployeeShift;
  employeeShift = new EmployeeShift();
  columns: AgGridTableColumn<any>[] = [];
  odata: boolean;
  saveMode: string = saveMode.POST;
  open: boolean = false;
  colorDialogOpen: boolean = false;
  selectedColor: string = "";
  loading: boolean = false;
  localization = Localization;
  insertTitle: string = $localize`New`;
  headerTitle: string = `${this.localization.Shift} ${this.localization.Lists}`;
  dataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'EmployeeShifts',
    pageSize: 50,
    searchFields: ['custom_id', 'name'],
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.headerTitle,
    addButtonText: this.insertTitle,
    showSearch: true,
    showRowCount: true,
    showNewButton: false,
    showDownload: false,
    showSegmentButton: true,
  };
  ToastType: "add" | "edit" | "error" = "add";
  validationMessage = Localization.requiredField;
  permissions = Permissions;
  valueStateOptions = {
    name: ValueState.None,
    start_time: ValueState.None,
    end_time: ValueState.None,
  };

  constructor(
    public rolePermissionService: RolePermissionService,
    private commonService: CommonService,
    private toastService: ToastService,
  ) {
    this.odata = this.commonService.odata;
    this.toolbarConfig.showNewButton = this.rolePermissionService.hasPermission(this.permissions.HR_SHIFT_CREATE);
  }

  ngOnInit(): void {
    this.columns = this.buildColumns();
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    return [
      {
        field: 'is_active',
        headerName: $localize`Active`,
        minWidth: 80, width: 90,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false, sortable: false, floatingFilter: false,
      },
      {
        field: 'custom_id',
        headerName: $localize`ID`,
        minWidth: 110,
        sort: 'desc',
      },
      {
        field: 'name',
        headerName: $localize`Name`,
        minWidth: 160,
      },
      {
        field: 'early_start_time',
        headerName: $localize`Early Start Time`,
        minWidth: 140,
        filter: false, floatingFilter: false,
        valueFormatter: ({ value }: any) => formatTime(value) ?? '',
      },
      {
        field: 'start_time',
        headerName: $localize`Start Time`,
        minWidth: 120,
        filter: false, floatingFilter: false,
        valueFormatter: ({ value }: any) => formatTime(value) ?? '',
      },
      {
        field: 'late_start_time',
        headerName: $localize`Late Start Time`,
        minWidth: 140,
        filter: false, floatingFilter: false,
        valueFormatter: ({ value }: any) => formatTime(value) ?? '',
      },
      {
        field: 'end_time',
        headerName: $localize`End Time`,
        minWidth: 120,
        filter: false, floatingFilter: false,
        valueFormatter: ({ value }: any) => formatTime(value) ?? '',
      },
      {
        field: 'total_working_hours',
        headerName: $localize`Total Working Hours`,
        minWidth: 160,
        filter: false, floatingFilter: false,
      },
      {
        field: 'color',
        headerName: $localize`Color`,
        minWidth: 140,
        filter: false, floatingFilter: false,
        cellRenderer: AgGridColorBadgeComponent,
      },
      {
        field: 'is_night',
        headerName: $localize`Night`,
        minWidth: 100,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false, sortable: false, floatingFilter: false,
      },
      {
        field: 'is_ramadan_bonus',
        headerName: $localize`Ramadan Bonus`,
        minWidth: 130,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false, sortable: false, floatingFilter: false,
      },
    ];
  }

  newShift() {
    this.employeeShift = new EmployeeShift().deserialize({});
    this.saveMode = saveMode.POST;
    this.open = true;
  }

  editShift(data: any) {
    this.employeeShift = new EmployeeShift().deserialize(data);
    this.employeeShift.start_time = formatTime(data.start_time) ?? '';
    this.employeeShift.late_start_time = formatTime(data.late_start_time) ?? '';
    this.employeeShift.early_start_time = formatTime(data.early_start_time) ?? '';
    this.employeeShift.end_time = formatTime(data.end_time) ?? '';
    this.saveMode = saveMode.PUT;
    this.open = true;
  }

  checkValidation(event: any, field: string) {
    const value = event.target.value ? event.target.value : "";

    switch (field) {
      case "name":
        if (!value.trim()) {
          this.valueStateOptions.name = ValueState.Negative;
        } else {
          this.employeeShift.name = value;
          this.valueStateOptions.name = ValueState.None;
        }
        break;

      case "start_time":
        if (!value.trim()) {
          this.valueStateOptions.start_time = ValueState.Negative;
        } else {
          this.employeeShift.start_time = value;
          this.valueStateOptions.start_time = ValueState.None;
        }
        break;

      case "end_time":
        if (!value.trim()) {
          this.valueStateOptions.end_time = ValueState.Negative;
        } else {
          this.employeeShift.end_time = value;
          this.valueStateOptions.end_time = ValueState.None;
        }
        break;

      default:
        break;
    }
  }

  validateForm(): boolean {
    let isValid = true;

    if (!this.employeeShift.name?.trim()) {
      this.valueStateOptions.name = ValueState.Negative;
      isValid = false;
    }
    if (!this.employeeShift.start_time?.trim()) {
      this.valueStateOptions.start_time = ValueState.Negative;
      isValid = false;
    }
    if (!this.employeeShift.end_time?.trim()) {
      this.valueStateOptions.end_time = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  openColorPickerDialog() {
    this.selectedColor = this.employeeShift.color || "rgb(0, 128, 0)";
    this.colorDialogOpen = true;
  }

  closeColorPickerDialog() {
    this.colorDialogOpen = false;
  }

  onColorPickerChange(event: any) {
    this.selectedColor = event.target.value;
  }

  confirmColor() {
    this.employeeShift.color = this.selectedColor;
    this.colorDialogOpen = false;
  }
  calculateTotalWorkingHours(start?: string, end?: string): string {
    if (!start || !end) return "";

    const today = new Date().toISOString().split("T")[0];

    const startDate = new Date(`${today} ${start}`);
    const endDate = new Date(`${today} ${end}`);

    let diff = endDate.getTime() - startDate.getTime();
    if (diff < 0) diff += 24 * 60 * 60 * 1000;

    const hours = Math.floor(diff / 1000 / 60 / 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);

    return `${hours}h ${minutes}m`;
  }

  saveShift() {
    if (!this.validateForm()) return;

    if (!this.employeeShift.color || !this.employeeShift.color.trim()) {
      this.employeeShift.color = "rgb(0, 128, 0)";
    }
    this.employeeShift.total_working_hours = this.calculateTotalWorkingHours(
      this.employeeShift.start_time,
      this.employeeShift.end_time
    );
    this.loading = true;
    let url = "";
    let request$;
    if (this.saveMode === saveMode.POST) {
      url = "EmployeeShifts";
      this.ToastType = "add";
      request$ = this.commonService.post(
        url,
        this.employeeShift.toOdata(),
        true
      );
    } else if (this.saveMode === saveMode.PUT) {
      url = `EmployeeShifts(${this.employeeShift.id})`;
      this.ToastType = "edit";
      request$ = this.commonService.put(
        url,
        this.employeeShift.toOdata(),
        true
      );
    }

    if (request$) {
      request$.subscribe({
        next: (res) => {
          this.refreshTable.emit();
          this.agGridRef?.refreshGridData(true);
          this.closeDialog();
          this.toastService.show(this.ToastType);
        },
        error: () => {
          this.closeDialog();
          this.toastService.show("error");
        },
      });
    }
  }

  processData(event?: any) {
    this.agGridRef?.refreshGridData(true);
  }

  deleteClick(id: any): void {
    this.IsDelete.emit(`EmployeeShifts/${id}`);
  }

  closeDialog() {
    this.open = false;
    this.loading = false;
    this.valueStateOptions.name = ValueState.None;
    this.valueStateOptions.start_time = ValueState.None;
    this.valueStateOptions.end_time = ValueState.None;
    this.employeeShift = new EmployeeShift().deserialize({});
  }
}
