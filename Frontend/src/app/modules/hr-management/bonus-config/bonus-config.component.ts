import {
  Component,
  EventEmitter,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { Localization } from "@app/shared/utilities/localization";
import { Permissions } from "@app/shared/enums/permissions";
import { saveMode } from "@app/shared/enums/saveMode";
import { CommonService } from "@app/services/common-service/common.service";
import { ValueState } from "@shared/utilities/value-state-wrapper";
import { ToastService } from "@app/services/toast-service/toast.service";
import { BonusConfig } from "@app/modules/hr-management/shared/models//bonusConfig";
import { ApplicableBonus } from "@app/modules/hr-management/shared/enums/applicableBonus";
import { CalculationType } from "@app/modules/hr-management/shared/enums/calculationType";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import { AgGridTableColumn, AgGridTableODataSourceConfig, AgGridTableToolbarConfig, GridTableColumnDataType } from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { AgGridBooleanCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component";
import { DateFormatterService } from "@app/shared/utilities/date-format";

@Component({
  selector: "app-bonus-config",
  templateUrl: "./bonus-config.component.html",
})
export class BonusConfigComponent implements OnInit {
  @Output() IsDelete = new EventEmitter<any>();
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent<any>;

  public permissions = Permissions;
  public localization = Localization;
  public validationMessage = Localization.requiredField;
  saveMode: string = saveMode.POST;
  headerTitle = $localize`Bonus Config`;
  BonusConfig = BonusConfig;
  bonusConfig: BonusConfig = new BonusConfig();
  applicableBonus = Object.values(ApplicableBonus);
  calculationTypes = Object.values(CalculationType);
  open = false;
  loading = false;
  ToastType: "add" | "edit" | "error" = "add";

  valueStateOptions = {
    name: ValueState.None,
    calculation_type: ValueState.None,
    applicable_to: ValueState.None,
    bonus_type_id: ValueState.None,
  };

  public columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'BonusConfigs',
    expand: 'bonusType,department',
    pageSize: 50,
    searchFields: ['custom_id', 'name', 'bonusType.name', 'department.name', 'calculation_type'],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.headerTitle,
    addButtonText: $localize`New`,
    showSearch: true,
    showRowCount: true,
    showNewButton: false,
    showDownload: false,
    showScanner: false,
    showSegmentButton: true,
  };


  public departments: any[] = [];
  public bonusTypes: any[] = [];
  public employees: any[] = [];
  public departmentName = "";
  public bonusTypeName = "";
  public employeeName = "";

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
    public permission: RolePermissionService,
    private dateFormatter: DateFormatterService,
  ) {}

  ngOnInit(): void {
    this.columns = this.buildColumns();
    this.toolbarConfig = {
      ...this.toolbarConfig,
      showNewButton: this.permission.hasPermission(this.permissions.HR_BONUS_CONFIG_CREATE),
    };
    this.initDepartments();
    this.initBonusTypes();
    this.initEmployees();
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
        minWidth: 100,
        sort: 'desc',
      },
      {
        field: 'name',
        headerName: $localize`Name`,
        minWidth: 150,
      },
      {
        colId: 'bonus_type_name',
        headerName: $localize`Bonus Type`,
        minWidth: 150,
        valueGetter: (params: any) => params.data?.bonusType?.name ?? '',
      },
      {
        colId: 'department_name',
        headerName: $localize`Department`,
        minWidth: 150,
        valueGetter: (params: any) => params.data?.department?.name ?? '',
      },
      {
        field: 'calculation_type',
        headerName: $localize`Type`,
        minWidth: 120,
      },
      {
        field: 'applicable_to',
        headerName: $localize`Applies To`,
        minWidth: 120,
      },
      {
        field: 'amount',
        headerName: $localize`Amount`,
        minWidth: 100,
        type: 'numericColumn',
      },
      {
        field: 'created_at',
        headerName: $localize`Created`,
        minWidth: 130,
        filter: false, floatingFilter: false,
        dataType: GridTableColumnDataType.Date,
        valueFormatter: ({ value }: any) =>
          value
            ? this.dateFormatter.formatDate(value, true, false, false, false, false)
            : '',
      },
    ];
  }

  processData(event?: any): void {
    this.refreshTable.emit();
    this.agGridRef?.refreshGridData(true);
  }

  initDepartments() {
    this.commonService
      .get("Departments?$filter=is_active eq true", true)
      .subscribe({
        next: (res: any) => {
          this.departments = res.value || [];
          this.setDepartmentName();
        },
      });
  }

  initEmployees() {
    this.commonService.get("Employees?$filter=is_active eq true", true).subscribe({
      next: (res: any) => {
        this.employees = res.value || [];
        this.setEmployeeName();
      },
    });
  }

  initBonusTypes() {
    this.commonService.get("BonusTypes", true).subscribe({
      next: (res: any) => {
        this.bonusTypes = res.value || [];
        this.setBonusTypeName();
      },
    });
  }

  setDepartmentName() {
    if (!this.departments?.length) return;

    const selected = this.departments.find(
      (dept) => dept.id === this.bonusConfig.department_id,
    );

    this.departmentName = selected?.name || "";
  }

  setEmployeeName() {
    if (!this.employees?.length) return;

    const selected = this.employees.find(
      (emp) => Number(emp.id) === Number(this.bonusConfig.employee_id),
    );

    this.employeeName = selected
      ? `${selected.employee_no} - ${selected.first_name} ${selected.last_name}`
      : "";
  }


  setBonusTypeName() {
    if (!this.bonusTypes?.length) return;

    const selected = this.bonusTypes.find(
      (type) => type.id === this.bonusConfig.bonus_type_id,
    );

    this.bonusTypeName = selected?.name || "";
  }

  onApplicableChange(event: any) {
    const value = event?.target?.value;

    if (!this.applicableBonus.includes(value)) {
      this.bonusConfig.applicable_to = "";
      this.clearApplicableSelection();
      return;
    }

    this.bonusConfig.applicable_to = value;
    this.valueStateOptions.applicable_to = ValueState.None;
    this.clearApplicableSelection(value);
  }

  clearApplicableSelection(keepType: string = "") {
    this.bonusConfig.group_id = null;

    if (keepType !== ApplicableBonus.DEPARTMENT) {
      this.bonusConfig.department_id = null;
      this.departmentName = "";
    }

    if (keepType !== ApplicableBonus.EMPLOYEE) {
      this.bonusConfig.employee_id = null;
      this.employeeName = "";
    }
  }

  onCalculationTypeChange(event: any) {
    const value = event?.target?.value;

    if (!this.calculationTypes.includes(value)) {
      this.bonusConfig.calculation_type = "";
      return;
    }

    this.bonusConfig.calculation_type = value;
  }

  onBonusTypeChange(event: any) {
    const item = event.detail.item;
    if (item) {
      this.bonusConfig.bonus_type_id = Number(item.id);
      this.bonusTypeName = item.text || "";
      this.valueStateOptions.bonus_type_id = ValueState.None;
    }
  }

  onDepartmentChange(event: any) {
    const item = event.detail.item;
    if (item) {
      this.bonusConfig.department_id = Number(item.id);
      this.departmentName = item.text || "";
    }
  }

  onEmployeeChange(event: any){
    const item = event.detail.item;
    if (item) {
      this.bonusConfig.employee_id = Number(item.id);
      this.employeeName = item.text || "";
    }
  }

  checkValidation(event: any, field: string) {
    const value = event.target.value ? event.target.value : "";

    switch (field) {
      case "name":
        if (!value.trim()) {
          this.valueStateOptions.name = ValueState.Negative;
        } else {
          this.bonusConfig.name = value;
          this.valueStateOptions.name = ValueState.None;
        }
        break;
      case "bonus_type_id":
        if (!this.bonusConfig.bonus_type_id) {
          this.valueStateOptions.bonus_type_id = ValueState.Negative;
        } else {
          this.valueStateOptions.bonus_type_id = ValueState.None;
        }
        break;
      case "calculation_type":
        if (!value.trim()) {
          this.valueStateOptions.calculation_type = ValueState.Negative;
        } else {
          this.bonusConfig.calculation_type = value;
          this.valueStateOptions.calculation_type = ValueState.None;
        }
        break;
      case "applicable_to":
        if (!value.trim()) {
          this.valueStateOptions.applicable_to = ValueState.Negative;
        } else {
          this.bonusConfig.applicable_to = value;
          this.valueStateOptions.applicable_to = ValueState.None;
        }
        break;

      default:
        break;
    }
  }

  validateForm(): boolean {
    let isValid = true;
    if (!this.bonusConfig.name?.trim()) {
      this.valueStateOptions.name = ValueState.Negative;
      isValid = false;
    }
    if (!this.bonusConfig.bonus_type_id) {
      this.valueStateOptions.bonus_type_id = ValueState.Negative;
      isValid = false;
    }
    if (!this.bonusConfig.calculation_type?.trim()) {
      this.valueStateOptions.calculation_type = ValueState.Negative;
      isValid = false;
    }
    if (!this.bonusConfig.applicable_to?.trim()) {
      this.valueStateOptions.applicable_to = ValueState.Negative;
      isValid = false;
    }
    if (
      this.bonusConfig.applicable_to === ApplicableBonus.DEPARTMENT &&
      !this.bonusConfig.department_id
    ) {
      isValid = false;
    }
    if (
      this.bonusConfig.applicable_to === ApplicableBonus.EMPLOYEE &&
      !this.bonusConfig.employee_id
    ) {
      isValid = false;
    }

    return isValid;
  }

  newBonusConfig() {
    this.resetBonusConfigForm();
    this.saveMode = saveMode.POST;
    this.open = true;
  }

  editBonusConfig(data: any) {
    this.bonusConfig = new BonusConfig().deserialize(data);
    this.saveMode = saveMode.PUT;
    this.open = true;
    this.setDepartmentName();
    this.setBonusTypeName();
    this.setEmployeeName();
  }

  deleteClick(data: any) {
    if (!data?.id) return;
    this.IsDelete.emit(`BonusConfigs/${data.id}`);
  }

  saveBonusConfig() {
    if (!this.validateForm()) {
      return;
    }

    this.loading = true;
    let url = "";
    let request$;

    if (this.saveMode === saveMode.POST) {
      url = "hrm/bonus-configs";
      this.ToastType = "add";
      request$ = this.commonService.post(url, this.bonusConfig, false);
    } else {
      url = `hrm/bonus-configs/${this.bonusConfig.id}`;
      this.ToastType = "edit";
      request$ = this.commonService.put(url, this.bonusConfig, false);
    }

    request$?.subscribe({
      next: () => {
        this.processData();
        this.toastService.show(this.ToastType);
        this.closeDialog();
      },
      error: (err) => {
        console.error(err);
        this.toastService.show(err?.status === 422 ? "exist" : "error");
        this.loading = false;
      },
    });
  }

  closeDialog() {
    this.open = false;
    this.loading = false;
    this.resetBonusConfigForm();
  }

  resetBonusConfigForm() {
    this.bonusConfig = new BonusConfig().deserialize({});
    this.departmentName = "";
    this.bonusTypeName = "";
    this.employeeName = "";

    this.valueStateOptions = {
      name: ValueState.None,
      calculation_type: ValueState.None,
      applicable_to: ValueState.None,
      bonus_type_id: ValueState.None,
    };
  }
}
