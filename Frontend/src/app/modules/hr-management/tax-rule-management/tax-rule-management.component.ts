import { Component, EventEmitter, OnInit, Output, ViewChild } from "@angular/core";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { saveMode } from "@shared/enums/saveMode";
import { Localization } from "@shared/utilities/localization";
import { ValueState } from "@shared/utilities/value-state-wrapper";
import { CommonService } from "@app/services/common-service/common.service";
import { ToastService } from "@app/services/toast-service/toast.service";
import { TaxRule } from "@app/modules/hr-management/shared/models/taxRule";
import { Permissions } from "@app/shared/enums/permissions";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import { AgGridTableColumn, AgGridTableODataSourceConfig, AgGridTableToolbarConfig, GridTableColumnDataType } from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { AgGridBooleanCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component";

@Component({
  selector: "app-tax-rule-management",
  templateUrl: "./tax-rule-management.component.html",
})
export class TaxRuleManagementComponent implements OnInit {
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent<any>;
  @Output() IsDelete = new EventEmitter<any>();
  taxRule = new TaxRule();
  columns: AgGridTableColumn<any>[] = [];
  saveMode: string = saveMode.POST;
  open: boolean = false;
  loading: boolean = false;
  localization = Localization;
  insertTitle: string = $localize`New`;
  headerTitle: string = $localize`Tax Rule List`;
  dataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'TaxRules',
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
  };
  ToastType: "add" | "edit" | "error" = "add";
  validationMessage = Localization.requiredField;
  permissions = Permissions;
  valueStateOptions = {
    name: ValueState.None,
    effective_from: ValueState.None,
  };

  constructor(
    public rolePermissionService: RolePermissionService,
    private commonService: CommonService,
    private toastService: ToastService,
  ) {
    this.toolbarConfig.showNewButton = this.rolePermissionService.hasPermission(this.permissions.HR_TAX_RULE_CREATE);
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
        field: 'salary_from',
        headerName: $localize`Salary From`,
        minWidth: 120,
        dataType: GridTableColumnDataType.Number,
      },
      {
        field: 'salary_to',
        headerName: $localize`Salary To`,
        minWidth: 120,
        dataType: GridTableColumnDataType.Number,
      },
      {
        field: 'is_percentage',
        headerName: $localize`Percentage?`,
        minWidth: 100,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false, sortable: false, floatingFilter: false,
      },
      {
        field: 'tax_rate',
        headerName: $localize`Tax Rate (%)`,
        minWidth: 110,
        dataType: GridTableColumnDataType.Number,
      },
      {
        field: 'fixed_amount',
        headerName: $localize`Fixed Amount`,
        minWidth: 120,
        dataType: GridTableColumnDataType.Number,
      },
      {
        field: 'effective_from',
        headerName: $localize`Effective From`,
        minWidth: 120,
        dataType: GridTableColumnDataType.Date,
      },
      {
        field: 'effective_to',
        headerName: $localize`Effective To`,
        minWidth: 120,
        dataType: GridTableColumnDataType.Date,
      },
    ];
  }

  newTaxRule() {
    this.taxRule = new TaxRule().deserialize({});
    this.saveMode = saveMode.POST;
    this.open = true;
  }

  editTaxRule(data: any) {
    this.taxRule = new TaxRule().deserialize(data);
    this.saveMode = saveMode.PUT;
    this.open = true;
  }

  checkValidation(event: any, field: string) {
    const value = event.target.value ? event.target.value : "";

    switch (field) {
      case "name":
        this.valueStateOptions.name = value.trim() ? ValueState.None : ValueState.Negative;
        break;
      case "effective_from":
        this.valueStateOptions.effective_from = value.trim() ? ValueState.None : ValueState.Negative;
        break;
      default:
        break;
    }
  }

  validateForm(): boolean {
    let isValid = true;

    if (!this.taxRule.name?.trim()) {
      this.valueStateOptions.name = ValueState.Negative;
      isValid = false;
    }

    if (!this.taxRule.effective_from) {
      this.valueStateOptions.effective_from = ValueState.Negative;
      isValid = false;
    }

    return isValid;
  }

  saveTaxRule() {
    if (!this.validateForm()) return;

    this.loading = true;
    let url = "";
    let request$;
    if (this.saveMode === saveMode.POST) {
      url = "TaxRules";
      this.ToastType = "add";
      request$ = this.commonService.post(url, this.taxRule.toOdata(), true);
    } else if (this.saveMode === saveMode.PUT) {
      url = `TaxRules(${this.taxRule.id})`;
      this.ToastType = "edit";
      request$ = this.commonService.put(url, this.taxRule.toOdata(), true);
    }

    if (request$) {
      request$.subscribe({
        next: () => {
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
    this.IsDelete.emit(`TaxRules/${id}`);
  }

  closeDialog() {
    this.open = false;
    this.loading = false;
    this.valueStateOptions.name = ValueState.None;
    this.valueStateOptions.effective_from = ValueState.None;
    this.taxRule = new TaxRule().deserialize({});
  }
}
