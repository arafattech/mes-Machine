import { Component, EventEmitter, OnInit, Output, ViewChild } from "@angular/core";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { saveMode } from "@shared/enums/saveMode";
import { Localization } from "@shared/utilities/localization";
import { ValueState } from "@shared/utilities/value-state-wrapper";
import { CommonService } from "@app/services/common-service/common.service";
import { ToastService } from "@app/services/toast-service/toast.service";
import { HolidayType } from "@app/modules/hr-management/shared/models/holidayType";
import { Permissions } from "@app/shared/enums/permissions";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import { AgGridTableColumn, AgGridTableODataSourceConfig, AgGridTableToolbarConfig } from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { AgGridBooleanCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component";
import { AgGridColorBadgeComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component";

@Component({
  selector: "app-holiday-type-management",
  templateUrl: "./holiday-type-management.component.html",
})
export class HolidayTypeManagementComponent implements OnInit {
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent<any>;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<any>();
  holidayType = new HolidayType();
  columns: AgGridTableColumn<any>[] = [];
  odata: boolean;
  saveMode: string = saveMode.POST;
  open: boolean = false;
  colorDialogOpen: boolean = false;
  selectedColor: string = "";
  loading: boolean = false;
  localization = Localization;
  insertTitle: string = $localize`New`;
  headerTitle: string = $localize`Holiday Type List`;
  dataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'HolidayTypes',
    pageSize: 50,
    searchFields: ['name'],
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
  };

  constructor(
    public rolePermissionService: RolePermissionService,
    private commonService: CommonService,
    private toastService: ToastService,
  ) {
    this.odata = this.commonService.odata;
    this.toolbarConfig.showNewButton = this.rolePermissionService.hasPermission(this.permissions.HR_HOLIDAY_TYPE_CREATE);
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
        field: 'name',
        headerName: $localize`Name`,
        minWidth: 160,
      },
      {
        field: 'color',
        headerName: $localize`Color`,
        minWidth: 140,
        filter: false, floatingFilter: false,
        cellRenderer: AgGridColorBadgeComponent,
      },
    ];
  }

  newHolidayType() {
    this.holidayType = new HolidayType().deserialize({});
    this.saveMode = saveMode.POST;
    this.open = true;
  }

  editHolidayType(data: any) {
    this.holidayType = new HolidayType().deserialize(data);
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
          this.holidayType.name = value;
          this.valueStateOptions.name = ValueState.None;
        }
        break;

      default:
        break;
    }
  }

  validateForm(): boolean {
    let isValid = true;

    if (!this.holidayType.name?.trim()) {
      this.valueStateOptions.name = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  openColorPickerDialog() {
    this.selectedColor = this.holidayType.color || "rgb(0, 128, 0)";
    this.colorDialogOpen = true;
  }

  closeColorPickerDialog() {
    this.colorDialogOpen = false;
  }

  onColorPickerChange(event: any) {
    this.selectedColor = event.target.value;
  }

  confirmColor() {
    this.holidayType.color = this.selectedColor;
    this.colorDialogOpen = false;
  }

  saveHolidayType() {
    if (!this.validateForm()) return;

    if (!this.holidayType.color || !this.holidayType.color.trim()) {
      this.holidayType.color = "rgb(0, 128, 0)";
    }
    this.loading = true;
    let url = "";
    let request$;
    if (this.saveMode === saveMode.POST) {
      url = "HolidayTypes";
      this.ToastType = "add";
      request$ = this.commonService.post(
        url,
        this.holidayType.toOdata(),
        true
      );
    } else if (this.saveMode === saveMode.PUT) {
      url = `HolidayTypes(${this.holidayType.id})`;
      this.ToastType = "edit";
      request$ = this.commonService.put(
        url,
        this.holidayType.toOdata(),
        true
      );
    }

    if (request$) {
      request$.subscribe({
        next: () => {
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

  processData() {
    this.agGridRef?.refreshGridData(true);
  }

  deleteClick(id: any): void {
    this.IsDelete.emit(`HolidayTypes/${id}`);
  }

  closeDialog() {
    this.open = false;
    this.loading = false;
    this.valueStateOptions.name = ValueState.None;
    this.holidayType = new HolidayType().deserialize({});
  }
}
