import { Component, CUSTOM_ELEMENTS_SCHEMA, EventEmitter, OnInit, Output, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { SharedModule } from "@app/shared/shared.module";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { Localization } from "@app/shared/utilities/localization";
import { saveMode } from "@app/shared/enums/saveMode";
import { CommonService } from "@app/services/common-service/common.service";
import { ValueState } from "@shared/utilities/value-state-wrapper";
import { ToastService } from "@app/services/toast-service/toast.service";
import { EmployeeType } from "@app/modules/hr-management/shared/models/employeeType";
import { Permissions } from "@app/shared/enums/permissions";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  GridTableColumnDataType,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { AgGridBooleanCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component";
import { DateFormatterService } from "@app/shared/utilities/date-format";

@Component({
  selector: "app-employee-type-management",
  standalone: true,
  imports: [CommonModule, SharedModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: "./employee-type-management.component.html",
  styleUrl: "./employee-type-management.component.scss",
})
export class EmployeeTypeManagementComponent implements OnInit {
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent<EmployeeType>;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();
  permissions = Permissions;
  insertTitle: string = $localize`New`;
  headerTitle: string = $localize`Employee Types`;
  isDialogOpen: boolean = false;
  public localization = Localization;
  public validationMessage = Localization.requiredField;
  saveMode = "POST";
  isLoading: boolean = false;
  employeeType: EmployeeType = new EmployeeType();
  columns: AgGridTableColumn<EmployeeType>[] = [];
  valueStateOptions = {
    name: ValueState.None,
  };

  dataSource: AgGridTableODataSourceConfig<EmployeeType> = {
    type: "odata",
    endpoint: "EmployeeTypes",
    pageSize: 50,
    searchFields: ['custom_id', 'name'],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Employee Types`,
    addButtonText: $localize`New`,
    showSearch: true,
    showRowCount: true,
    showDownload: false,
    showNewButton: this.permission.hasPermission(Permissions.HR_EMPLOYEE_TYPE_CREATE),
    showSegmentButton: true,
  };


  constructor(
    public permission: RolePermissionService,
    private http: CommonService,
    private toastService: ToastService,
    private dateFormatter: DateFormatterService,
  ) {}

  ngOnInit(): void {
    this.columns = this.buildColumns();
  }

  private buildColumns(): AgGridTableColumn<EmployeeType>[] {
    return [
      {
        field: 'is_active',
        headerName: $localize`Active`,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
        floatingFilter: false,
      },
      {
        field: 'is_officer_staff',
        headerName: $localize`Officer/Staff`,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
        floatingFilter: false,
      },
      {
        field: 'custom_id',
        headerName: `${$localize`Custom`} ${$localize`ID`}`,
        sort: 'desc',
      },
      {
        field: 'name',
        headerName: $localize`Name`,
        minWidth: 180,
      },
      {
        field: 'created_at',
        headerName: this.localization.CreatedAt,
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

  processData(event?: any) {
    this.refreshTable.emit(event);
    this.agGridRef?.refreshGridData(true);
  }

  deleteClick(id: any): void {
    this.IsDelete.emit(`EmployeeTypes/${id}`);
  }

  checkValidation(event: any, field: string) {
    const value = event.target.value ? event.target.value : "";

    switch (field) {
      case "name":
        if (!value.trim()) {
          this.valueStateOptions.name = ValueState.Negative;
        } else {
          this.employeeType.name = value;
          this.valueStateOptions.name = ValueState.None;
        }
        break;

      default:
        break;
    }
  }

  validateForm(): boolean {
    let isValid = true;
    if (!this.employeeType.name?.trim()) {
      this.valueStateOptions.name = ValueState.Negative;
      isValid = false;
    }

    return isValid;
  }

  saveType() {
    if (!this.validateForm()) {
      return;
    }
    this.isLoading = true;

    if (this.saveMode === saveMode.POST) {
      this.http.post("EmployeeTypes", this.employeeType, true).subscribe({
        next: (res) => {
          this.processData(res);
          this.toastService.show("add");
          this.CloseDialog();
        },
        error: (err) => {
          console.error(err);
          this.toastService.show("error");
        },
      });
    }

    if (this.saveMode === saveMode.PUT) {
      this.http
        .put(`EmployeeTypes(${this.employeeType.id})`, this.employeeType, true)
        .subscribe({
          next: (res) => {
            this.processData(res);
            this.toastService.show("edit");
            this.CloseDialog();
          },
          error: (err) => {
            console.error(err);
            this.toastService.show("error");
          },
        });
    }
  }

  editType(row: any) {
    this.employeeType = new EmployeeType().deserialize(row);
    this.saveMode = saveMode.PUT;
    this.isDialogOpen = true;
  }

  newType() {
    this.employeeType = new EmployeeType().deserialize({});
    this.saveMode = saveMode.POST;
    this.isDialogOpen = true;
  }

  CloseDialog() {
    this.insertTitle = this.localization.New;
    this.isLoading = false;
    this.isDialogOpen = false;
    this.employeeType = new EmployeeType();
    this.valueStateOptions = {
      name: ValueState.None,
    };
  }
}
