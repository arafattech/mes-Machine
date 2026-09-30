import { Component, EventEmitter, OnInit, Output, ViewChild } from "@angular/core";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { Localization } from "@app/shared/utilities/localization";
import { saveMode } from "@app/shared/enums/saveMode";
import { CommonService } from "@app/services/common-service/common.service";
import { ValueState } from "@shared/utilities/value-state-wrapper";
import { ToastService } from "@app/services/toast-service/toast.service";
import { EmployeeSection } from "@app/modules/hr-management/shared/models/employeeSection";
import { Permissions } from "@app/shared/enums/permissions";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import { AgGridTableColumn, AgGridTableODataSourceConfig, AgGridTableToolbarConfig, GridTableColumnDataType } from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { AgGridBooleanCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component";
import { DateFormatterService } from "@app/shared/utilities/date-format";

@Component({
  selector: 'app-employee-section-management',
  templateUrl: './employee-section-management.component.html',
})
export class EmployeeSectionManagementComponent implements OnInit {
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent<EmployeeSection>;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();
  permissions = Permissions;
  insertTitle: string = $localize`New`;
  headerTitle: string = $localize`Employee Section`;
  isDialogOpen: boolean = false;
  public localization = Localization;
  public validationMessage = Localization.requiredField;
  saveMode = "POST";
  isLoading: boolean = false;
  employeeSection: EmployeeSection = new EmployeeSection();
  columns: AgGridTableColumn<EmployeeSection>[] = [];
  dataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'EmployeeSections',
    pageSize: 50,
    searchFields: ['custom_id', 'name'],
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.headerTitle,
    addButtonText: this.insertTitle,
    showSearch: true,
    showRowCount: true,
    showNewButton: this.permission.hasPermission(this.permissions.HR_EMPLOYEE_SECTION_CREATE),
    showDownload: false,
    showScanner: false,
    showSegmentButton: true,
  };
  valueStateOptions = {
    name: ValueState.None,
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

  private buildColumns(): AgGridTableColumn<EmployeeSection>[] {
    return [
      {
        field: 'is_active',
        headerName: $localize`Active`,
        minWidth: 80,
        width: 90,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
        floatingFilter: false,
      },
      {
        field: 'is_attendanceBonus',
        headerName: $localize`Attendance Bonus`,
        minWidth: 140,
        width: 150,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
        floatingFilter: false,
      },
      {
        field: 'is_overtimeBonus',
        headerName: $localize`Overtime Bonus`,
        minWidth: 140,
        width: 150,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
        floatingFilter: false,
      },
      {
        field: 'custom_id',
        headerName: `${$localize`Custom`} ${$localize`ID`}`,
        minWidth: 120,
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

  processData(event?: any) {
    this.refreshTable.emit(event);
    this.agGridRef?.refreshGridData(true);
  }

  deleteClick(id: any): void {
    this.IsDelete.emit(`EmployeeSections/${id}`);
  }

  checkValidation(event: any, field: string) {
    const value = event.target.value ? event.target.value : "";

    switch (field) {
      case "name":
        if (!value.trim()) {
          this.valueStateOptions.name = ValueState.Negative;
        } else {
          this.employeeSection.name = value;
          this.valueStateOptions.name = ValueState.None;
        }
        break;

      default:
        break;
    }
  }

  validateForm(): boolean {
    let isValid = true;
    if (!this.employeeSection.name?.trim()) {
      this.valueStateOptions.name = ValueState.Negative;
      isValid = false;
    }

    return isValid;
  }

  saveSection() {
    if (!this.validateForm()) {
      return;
    }
    this.isLoading = true;
    this.normalizeBonusFlags();

    if (this.saveMode === saveMode.POST) {
      this.http.post("EmployeeSections", this.employeeSection.toOdata(), true).subscribe({
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
        .put(`EmployeeSections(${this.employeeSection.id})`, this.employeeSection.toOdata(), true)
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

  editSection(row: any) {
    this.employeeSection = new EmployeeSection().deserialize(row);
    this.saveMode = saveMode.PUT;
    this.isDialogOpen = true;
  }

  newSection() {
    this.employeeSection = new EmployeeSection().deserialize({});
    this.saveMode = saveMode.POST;
    this.isDialogOpen = true;
  }

  normalizeBonusFlags() {
    this.employeeSection.is_attendanceBonus = !!this.employeeSection.is_attendanceBonus;
    this.employeeSection.is_overtimeBonus = !!this.employeeSection.is_overtimeBonus;
  }

  CloseDialog() {
    this.insertTitle = this.localization.New;
    this.isLoading = false;
    this.isDialogOpen = false;
    this.employeeSection = new EmployeeSection();
    this.valueStateOptions = {
      name: ValueState.None,
    };
  }
}
