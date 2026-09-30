import { Component, EventEmitter, Output, ViewChild } from "@angular/core";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { saveMode } from "@shared/enums/saveMode";
import { Policy } from "@shared/model/policy";
import { Localization } from "@shared/utilities/localization";
import { ValueState } from "@shared/utilities/value-state-wrapper";
import { CommonService } from "@app/services/common-service/common.service";
import { ToastService } from "@app/services/toast-service/toast.service";
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
  selector: "app-policy-list",
  templateUrl: "./policy-list.component.html",
  styleUrl: "./policy-list.component.scss",
})
export class PolicyListComponent {
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent<any>;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<any>();

  localization = Localization;
  insertTitle: string = $localize`New`;
  headerTitle: string = `${this.localization.Policy} ${this.localization.Lists}`;
  Policy = Policy;
  policy = new Policy();
  saveMode: string = saveMode.POST;
  open: boolean = false;
  loading: boolean = false;
  ToastType: "add" | "edit" | "error" = "add";
  validationMessage = Localization.requiredField;
  valueStateOptions = {
    title: ValueState.None,
    terms: ValueState.None,
    condition: ValueState.None,
  };
  assignedBy: string = "";

  columns: AgGridTableColumn<any>[] = [
    {
      field: "is_active",
      headerName: $localize`Active`,
      minWidth: 80,
      width: 90,
      cellRenderer: AgGridBooleanCellRendererComponent,
      filter: false,
      sortable: false,
      floatingFilter: false,
    },
    {
      field: "id",
      headerName: $localize`ID`,
      minWidth: 80,
      width: 90,
    },
    {
      field: "title",
      headerName: $localize`Title`,
      flex: 1,
      minWidth: 150,
    },
    {
      colId: "assignedBy.name",
      headerName: $localize`Assigned By`,
      flex: 1,
      minWidth: 150,
      valueGetter: (p) => p.data?.assignedBy?.name ?? "",
    },
    {
      field: "created_at",
      headerName: $localize`Created On`,
      minWidth: 130,
      filter: false,
      floatingFilter: false,
      dataType: GridTableColumnDataType.Date,
      valueFormatter: ({ value }: any) =>
        value
          ? this.dateFormatter.formatDate(value, true, false, false, false, false)
          : "",
    },
  ];

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: "odata",
    endpoint: "Policies",
    expand: "user,assignedBy",
    pageSize: 50,
    searchFields: ["title"],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${this.localization.Policy} ${this.localization.Lists}`,
    addButtonText: $localize`New`,
    showSearch: true,
    showRowCount: true,
    showNewButton: true,
    showDownload: false,
  };

  constructor(
    private rolePermissionService: RolePermissionService,
    private commonService: CommonService,
    private toastService: ToastService,
    private dateFormatter: DateFormatterService
  ) {}

  deleteClick(id: any): void {
    this.IsDelete.emit(`Policies/${id}`);
  }

  newPolicy() {
    this.policy = new Policy().deserialize({});
    this.saveMode = saveMode.POST;
    this.open = true;
  }

  editPolicy(data: any) {
    this.policy = new Policy().deserialize(data);
    this.saveMode = saveMode.PUT;
    this.open = true;
  }

  checkValidation(event: any, field: string) {
    const value = event.target.value ? event.target.value : "";

    switch (field) {
      case "title":
        if (!value.trim()) {
          this.valueStateOptions.title = ValueState.Negative;
        } else {
          this.policy.title = value;
          this.valueStateOptions.title = ValueState.None;
        }
        break;

      case "terms":
        if (!value.trim()) {
          this.valueStateOptions.terms = ValueState.Negative;
        } else {
          this.policy.terms = value;
          this.valueStateOptions.terms = ValueState.None;
        }
        break;

      case "condition":
        if (!value.trim()) {
          this.valueStateOptions.condition = ValueState.Negative;
        } else {
          this.policy.condition = value;
          this.valueStateOptions.condition = ValueState.None;
        }
        break;

      default:
        break;
    }
  }

  validateForm(): boolean {
    let isValid = true;

    if (!this.policy.title?.trim()) {
      this.valueStateOptions.title = ValueState.Negative;
      isValid = false;
    }
    if (!this.policy.terms?.trim()) {
      this.valueStateOptions.terms = ValueState.Negative;
      isValid = false;
    }
    if (!this.policy.condition?.trim()) {
      this.valueStateOptions.condition = ValueState.Negative;
      isValid = false;
    }

    return isValid;
  }

  savePolicy() {
    if (!this.validateForm()) return;

    this.loading = true;
    let url = "";
    let request$;
    if (this.saveMode === saveMode.POST) {
      url = "Policies";
      this.ToastType = "add";
      request$ = this.commonService.post(url, this.policy.toOdata(), true);
    } else if (this.saveMode === saveMode.PUT) {
      url = `Policies(${this.policy.id})`;
      this.ToastType = "edit";
      request$ = this.commonService.put(url, this.policy.toOdata(), true);
    }

    if (request$) {
      request$.subscribe({
        next: (res) => {
          this.agGridRef?.refreshGridData(true);
          this.CloseDialog();
          this.toastService.show(this.ToastType);
        },
        error: () => {
          this.CloseDialog();
          this.toastService.show("error");
        },
      });
    }
  }

  CloseDialog() {
    this.open = false;
    this.loading = false;
    this.valueStateOptions.title = ValueState.None;
    this.policy = new Policy().deserialize({});
  }
}
