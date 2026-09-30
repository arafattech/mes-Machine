import { Component, CUSTOM_ELEMENTS_SCHEMA, EventEmitter, OnInit, Output, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { SharedModule } from "@app/shared/shared.module";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { Designation } from "@app/modules/hr-management/shared/models/designation";
import { Localization } from "@app/shared/utilities/localization";
import { saveMode } from "@app/shared/enums/saveMode";
import { CommonService } from "@app/services/common-service/common.service";
import { ValueState } from "@shared/utilities/value-state-wrapper";
import { ToastService } from "@app/services/toast-service/toast.service";
import { Permissions } from "@app/shared/enums/permissions";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import { AgGridTableColumn, AgGridTableODataSourceConfig, AgGridTableToolbarConfig, GridTableColumnDataType } from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { AgGridBooleanCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component";
import { DateFormatterService } from "@app/shared/utilities/date-format";
@Component({
  selector: "app-designation-management",
  standalone: true,
  imports: [CommonModule, SharedModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: "./designation-management.component.html",
  styleUrl: "./designation-management.component.scss",
})
export class DesignationManagementComponent implements OnInit {
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent<Designation>;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();
  permissions = Permissions;
  insertTitle: string = $localize`New`;
  headerTitle: string = $localize`Designations`;
  isDialogOpen: boolean = false;
  public localization = Localization;
  public validationMessage = Localization.requiredField;
  saveMode = "POST";
  isLoading: boolean = false;
  designation: Designation = new Designation();
  columns: AgGridTableColumn<Designation>[] = [];
  dataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'Designations',
    pageSize: 50,
    searchFields: ['custom_id', 'name'],
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.headerTitle,
    addButtonText: this.insertTitle,
    showSearch: true,
    showRowCount: true,
    showNewButton: this.permission.hasPermission(this.permissions.HR_DESIGNATION_CREATE),
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

  private buildColumns(): AgGridTableColumn<Designation>[] {
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
    this.agGridRef?.refreshGridData(true);
  }

  deleteClick(id: any): void {
    this.IsDelete.emit(`Designations/${id}`);
  }

  checkValidation(event: any, field: string) {
    const value = event.target.value ? event.target.value : "";

    switch (field) {
      case "name":
        if (!value.trim()) {
          this.valueStateOptions.name = ValueState.Negative;
        } else {
          this.designation.name = value;
          this.valueStateOptions.name = ValueState.None;
        }
        break;

      default:
        break;
    }
  }

  validateForm(): boolean {
    let isValid = true;
    if (!this.designation.name?.trim()) {
      this.valueStateOptions.name = ValueState.Negative;
      isValid = false;
    }

    return isValid;
  }

  saveDesignation() {
    if (!this.validateForm()) {
      return;
    }
    this.isLoading = true;

    if (this.saveMode === saveMode.POST) {
      this.http.post("Designations", this.designation, true).subscribe({
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
        .put(`Designations(${this.designation.id})`, this.designation, true)
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

  editDesignation(row: any) {
    this.designation = new Designation().deserialize(row);
    this.saveMode = saveMode.PUT;
    this.isDialogOpen = true;
  }

  newDesignation() {
    this.designation = new Designation().deserialize({});
    this.saveMode = saveMode.POST;
    this.isDialogOpen = true;
  }

  CloseDialog() {
    this.insertTitle = this.localization.New;
    this.isLoading = false;
    this.isDialogOpen = false;
    this.designation = new Designation();
    this.valueStateOptions = {
      name: ValueState.None,
    };
  }
}
