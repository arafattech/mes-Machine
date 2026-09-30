import {
  Component,
  EventEmitter,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { Designation } from "@app/modules/hr-management/shared/models/designation";
import { promotionType } from "@app/modules/hr-management/shared/enums/promotionType";
import { Promotion } from "@app/modules/hr-management/shared/models/promotion";
import { CommonService } from "@app/services/common-service/common.service";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { ToastService } from "@app/services/toast-service/toast.service";
import { AgGridTableComponent, AgGridTableToolbarActionEvent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import {
  AgGridCustomButton,
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  AgGridToolbarFilter,
  GridTableColumnDataType,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { AgGridStatusBadgeComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component";
import { saveMode } from "@app/shared/enums/saveMode";
import { Permissions } from "@app/shared/enums/permissions";
import { Department } from "@app/shared/model/department";
import { Employee } from "@app/shared/model/employee";
import { Localization } from "@app/shared/utilities/localization";
import { ValueState } from "@shared/utilities/value-state-wrapper";
import moment from "moment";
@Component({
  selector: "app-promotion-management",
  templateUrl: "./promotion-management.component.html",
  styleUrl: "./promotion-management.component.scss",
})
export class PromotionManagementComponent implements OnInit {
  @ViewChild("promotionTableRef") promotionTableRef!: AgGridTableComponent<any>;
  @Output() refreshTable = new EventEmitter<void>();
  @Output() IsExportXls = new EventEmitter<void>();

  insertTitle = $localize`New`;
  headerTitle = $localize`Promotion list`;
  isDialogOpen = false;
  localization = Localization;
  validationMessage = Localization.requiredField;
  saveMode = "POST";
  isLoading = false;
  promotion = new Promotion();
  approveTarget: any = null;
  isApproveLoading = false;
  column: AgGridTableColumn<any>[] = [];

    dataSource: AgGridTableODataSourceConfig<any> = {
    type: "api",
    endpoint: "",
    customEndpoint: "/hrm/promotions",
    sortBy: "promotion_date",
    sortDirection: "desc",
    filter: "",
    pageSize: 40,
    scrollPagination: true,
    searchFields: ["custom_id", "promotion_title", "old_designation", "new_designation", "status"],
  };

    toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.headerTitle,
    addButtonText: this.insertTitle,
    showSearch: true,
    showRowCount: true,
    showNewButton: this.permission.hasPermission(Permissions.HR_PROMOTION_CREATE),
    showExtraButton: true,
    extraButtonText: $localize`Reset`,
    showDownload: true,
  };

  activeSegmentId = "all";


  get canShowActions(): boolean {
    return (
      this.permission.hasPermission(this.permissions.HR_PROMOTION_LIST) ||
      this.permission.hasPermission(this.permissions.HR_PROMOTION_EDIT)
    );
  }

  actionButtons: AgGridCustomButton[] = [
    {
      id: "info",
      icon: "information",
      design: "Transparent",
      tooltip: $localize`Information`,
      onClick: (row: any) => this.onRowSelect(row),
    },
    {
      id: "approve",
      icon: "accept",
      design: "Positive",
      tooltip: $localize`Approve`,
      hide: (row: any) =>
        !(
          this.permission.hasPermission(this.permissions.HR_PROMOTION_EDIT) &&
          this.canApprovePromotion(row) &&
          this.hasSalaryIncrement(row)
        ),
      onClick: (row: any) => this.openApproveDialog(row),
    },
  ];

  employees: Employee[] = [];
  departments: Department[] = [];
  designations: Designation[] = [];
  employeeTypes: any[] = [];
  promotionOptionsLoaded = false;
  promotionTypes = Object.values(promotionType);
  selectedEmployeeDepartmentName = "";
  EmployeeTypeSelectedId: number | null = null;
  employeeTypeToolbarFilters: AgGridToolbarFilter[] = [];
  isViewMode = false;
  isApproveDialogOpen = false;
  approveEffectiveDate = '';
  incrementType: 'fixed' | 'percentage' = 'fixed';
  incrementPercentage: number | undefined = undefined;
  permissions = Permissions;

  segmentButtonItems = [
    { id: "all",      name: $localize`All`,      defaultSelect: true, filter: "" },
    { id: "pending",  name: $localize`Pending`,               filter: "status eq 'pending'" },
    { id: "approved", name: $localize`Approved`,              filter: "status eq 'approved'" },
    { id: "declined", name: $localize`Declined`,              filter: "status eq 'declined'" },
    { id: "expired",  name: $localize`Expired`,               filter: "status eq 'expired'" },
  ];

  valueStateOptions = {
    employee_id: ValueState.None,
    promotion_title: ValueState.None,
    promotion_type: ValueState.None,
    old_designation: ValueState.None,
    new_designation: ValueState.None,
    old_department_id: ValueState.None,
    new_department_id: ValueState.None,
    old_salary: ValueState.None,
    new_salary: ValueState.None,
    salary_increment: ValueState.None,
    promotion_date: ValueState.None,
    effective_date: ValueState.None,
  };
  constructor(
    public permission: RolePermissionService,
    private commonService: CommonService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.column = this.tableColumn();
    this.ensurePromotionOptionsLoaded();
  }

  onResetPromotion() {
    this.EmployeeTypeSelectedId = null;
    this.promotionTableRef?.resetLegacySegment();
    this.applyPromotionFilter();
  }

  private rebuildEmployeeTypeToolbarFilters(): void {
    this.employeeTypeToolbarFilters = [
      {
        id: 'employeeType',
        type: 'select',
        placeholder: $localize`Select Employee Type`,
        options: this.employeeTypes,
      },
    ];
  }

  onEmployeeTypeToolbarAction(event: AgGridTableToolbarActionEvent): void {
    if (event.actionId !== 'filter:employeeType') return;

    const value = event.value as string;
    this.EmployeeTypeSelectedId = value ? Number(value) : null;
    this.applyPromotionFilter();
  }

  applyPromotionFilter() {
    const filter = this.EmployeeTypeSelectedId != null
      ? `employee_type_id eq ${this.EmployeeTypeSelectedId}`
      : "";
    this.dataSource = { ...this.dataSource, filter };
  }

  onSegmentChange(event: any): void {
    this.activeSegmentId = event?.id ?? event?.value ?? "all";
  }

  downloadButtonClick(): void {
    this.IsExportXls.emit();
  }

  getExportPayload(): { status: string; employee_type_ids?: number[] } {
    const payload: { status: string; employee_type_ids?: number[] } = {
      status: this.activeSegmentId || "all",
    };
    if (this.EmployeeTypeSelectedId != null) {
      payload.employee_type_ids = [this.EmployeeTypeSelectedId];
    }
    return payload;
  }

  getExportFileName(): string {
    const segment = this.activeSegmentId && this.activeSegmentId !== "all" ? `_${this.activeSegmentId}` : "";
    return `promotion-list${segment}.xlsx`;
  }

  tableColumn(): AgGridTableColumn<any>[] {
    return [
      {
        field: "is_active",
        headerName: $localize`Active`,
        dataType: GridTableColumnDataType.Boolean,
        isSelected: true,
        width: 70,
        minWidth: 60,
      },
      { field: "custom_id", headerName: `${$localize`Custom`} ${$localize`ID`}`, isSelected: false },
      {
        colId: "employee_id",
        headerName: $localize`Employee No`,
        isSelected: true,
        sortable: false,
        valueGetter: (p: any) => p.data?.employee?.employee_no || p.data?.employee_id || "-",
      },
      {
        colId: "employee_name",
        headerName: $localize`Employee Name`,
        isSelected: true,
        sortable: false,
        filter: false,
        valueGetter: (p: any) => {
          const e = p.data?.employee;
          return e ? `${e.first_name || ""} ${e.last_name || ""}`.trim() : "-";
        },
      },
      {
        field: "employee.joining_date",
        headerName: $localize`Joining Date`,
        isSelected: true,
        sortable: false,
        Cell: ({ value }) => this.formatDateForDisplay(value),
      },
      {
        field: "employee.employee_type.name",
        headerName: $localize`Employee Type`,
        isSelected: true,
        sortable: false,
        Cell: ({ value }) => value || "-",
      },
      {
        field: "employee.employee_section.name",
        headerName: $localize`Employee Section`,
        isSelected: true,
        sortable: false,
        Cell: ({ value }) => value || "-",
      },
      { field: "promotion_title", headerName: $localize`Promotion Title`, isSelected: false },
      {
        field: "promotion_type",
        headerName: $localize`Promotion Type`,
        isSelected: true,
        Cell: ({ value }) => this.getPromotionTypeLabel(value),
      },
      { field: "old_designation", headerName: $localize`Old Designation`, isSelected: false },
      { field: "new_designation", headerName: $localize`New Designation`, isSelected: false },
      {
        field: "old_department_id",
        headerName: $localize`Old Department`,
        isSelected: false,
        sortable: false,
        Cell: ({ row }) =>
          row?.oldDepartment?.name || row?.old_department?.name || this.getDepartmentName(row?.old_department_id) || "-",
      },
      {
        field: "new_department_id",
        headerName: $localize`New Department`,
        isSelected: false,
        sortable: false,
        Cell: ({ row }) =>
          row?.newDepartment?.name || row?.new_department?.name || this.getDepartmentName(row?.new_department_id) || "-",
      },
      {
        field: "old_salary",
        headerName: $localize`Old Salary`,
        isSelected: true,
        type: "numericColumn",
        Cell: ({ value }) => this.formatNumber(value),
      },
      {
        field: "new_salary",
        headerName: $localize`New Salary`,
        isSelected: true,
        sortable: false,
        Cell: ({ row }) => this.renderNewSalaryCell(row),
      },
      {
        field: "salary_increment",
        headerName: $localize`Increment`,
        isSelected: true,
        type: "numericColumn",
        Cell: ({ value }) => this.formatNumber(value),
      },
      {
        field: "promotion_date",
        headerName: $localize`Promotion Date`,
        isSelected: true,
        Cell: ({ value }) => this.formatDateForDisplay(value),
      },
      {
        field: "effective_date",
        headerName: $localize`Effective Date`,
        isSelected: true,
        Cell: ({ value }) => this.formatDateForDisplay(value),
      },
      {
        field: "eligibility_date",
        headerName: $localize`Eligible Date`,
        isSelected: false,
        Cell: ({ value }) => this.formatDate(value),
      },
      {
        field: "expires_at",
        headerName: $localize`Expires At`,
        isSelected: false,
        Cell: ({ value }) => this.formatDate(value),
      },
      {
        field: "status",
        headerName: $localize`Status`,
        isSelected: true,
        cellRenderer: AgGridStatusBadgeComponent,
      },
      {
        field: "approved_by.name",
        headerName: $localize`Executed By`,
        isSelected: true,
        sortable: false,
      },
      {
        field: "created_at",
        headerName: this.localization.CreatedAt,
        isSelected: false,
        filter: false,
      },
    ];
  }

  private renderNewSalaryCell(row: any): string {
    const oldVal = parseFloat(row?.old_salary);
    const newVal = parseFloat(row?.new_salary);
    const hasNew = !isNaN(newVal);
    const diff = hasNew && !isNaN(oldVal) ? newVal - oldVal : 0;
    const isUp = diff > 0;
    const isDown = diff < 0;
    const bar = isUp || isDown
      ? `<div style="width:3px;align-self:stretch;border-radius:2px;background:${isUp ? "#16a34a" : "#dc2626"};flex-shrink:0"></div>`
      : "";
    const badge = isUp || isDown
      ? `<span style="background:${isUp ? "#dcfce7" : "#fee2e2"};color:${isUp ? "#15803d" : "#b91c1c"};padding:1px 6px;border-radius:9999px;font-size:.68rem;font-weight:700;white-space:nowrap">${isUp ? "+" : ""}${this.formatNumber(diff)}</span>`
      : "";
    return `<div style="display:flex;align-items:center;gap:6px">${bar}<span>${hasNew ? this.formatNumber(newVal) : "-"}</span>${badge}</div>`;
  }


  onRowSelect(row: any) {
    this.openPromotionDialog(row, ["approved", "declined"].includes(row?.status));
  }

  openPromotionDialog(row: any, isLocked: boolean) {
    this.promotion = new Promotion().deserialize(row);

    if (!this.promotion.effective_date) {
      this.promotion.effective_date = moment().format('YYYY-MM-DD');
    }

    if (this.promotion.increment_type === 'percentage') {
      this.incrementType = 'percentage';
      this.incrementPercentage = this.parseNumber(this.promotion.inc_value);
    } else {
      this.incrementType = 'fixed';
      this.incrementPercentage = undefined;
    }

    this.updateSalaryIncrementFromNewSalary();

    if (row?.employee || row?.employees) {
      this.setCurrentEmployeeInfo(row.employee || row.employees, false);
    }

    this.isViewMode = isLocked;
    this.saveMode = saveMode.PUT;
    this.isDialogOpen = true;

    if (!isLocked) {
      this.ensurePromotionOptionsLoaded();
    }
  }

  newPromotion() {
    this.promotion = new Promotion().deserialize({});
    this.promotion.effective_date = moment().format('YYYY-MM-DD');
    this.incrementType = 'fixed';
    this.incrementPercentage = undefined;
    this.isViewMode = false;
    this.saveMode = saveMode.POST;
    this.isDialogOpen = true;
    this.ensurePromotionOptionsLoaded();
  }

  CloseDialog() {
    this.insertTitle = this.localization.New;
    this.isLoading = false;
    this.isViewMode = false;
    this.isDialogOpen = false;
    this.promotion = new Promotion();
    this.incrementType = 'fixed';
    this.incrementPercentage = undefined;
    this.valueStateOptions = {
      employee_id: ValueState.None,
      promotion_title: ValueState.None,
      promotion_type: ValueState.None,
      old_designation: ValueState.None,
      new_designation: ValueState.None,
      old_department_id: ValueState.None,
      new_department_id: ValueState.None,
      old_salary: ValueState.None,
      new_salary: ValueState.None,
      salary_increment: ValueState.None,
      promotion_date: ValueState.None,
      effective_date: ValueState.None,
    };
    this.selectedEmployeeDepartmentName = "";
  }

  processData(event?: any) {
    this.refreshTable.emit(event);
    this.promotionTableRef?.refreshGridData(true);
  }

  checkValidation(event: any, field: string) {
    const value = event.target?.value || "";
    switch (field) {
      case "promotion_type":
        this.valueStateOptions.promotion_type = value?.trim() ? ValueState.None : ValueState.Negative;
        break;
      case "new_designation":
        this.valueStateOptions.new_designation = ValueState.None;
        break;
      case "new_department":
        this.valueStateOptions.new_department_id = ValueState.None;
        break;
      case "new_salary":
      case "salary_increment":
        this.valueStateOptions[field] = (value === "" || value === null || value === undefined)
          ? ValueState.Negative : ValueState.None;
        break;
      case "promotion_date":
        this.valueStateOptions.promotion_date = value?.trim() ? ValueState.None : ValueState.Negative;
        break;
    }
  }

  validateForm(): boolean {
    let isValid = true;
    this.updateNewSalary();

    if (!this.promotion.employee_id) {
      this.valueStateOptions.employee_id = ValueState.Negative; isValid = false;
    }
    if (!this.promotion.promotion_type?.trim()) {
      this.valueStateOptions.promotion_type = ValueState.Negative; isValid = false;
    }
    if (this.promotion.old_salary == null) {
      this.valueStateOptions.old_salary = ValueState.Negative; isValid = false;
    }
    if (this.promotion.salary_increment == null) {
      this.valueStateOptions.salary_increment = ValueState.Negative; isValid = false;
    }
    if (this.promotion.new_salary == null) {
      this.valueStateOptions.salary_increment = ValueState.Negative; isValid = false;
    }
    if (!this.promotion.promotion_date?.trim()) {
      this.valueStateOptions.promotion_date = ValueState.Negative; isValid = false;
    }
    return isValid;
  }

  onEmployeeChange(event: any) {
    if (!event.detail?.item) return;
    this.promotion.employee_id = Number(event.detail.item.id);
    this.valueStateOptions.employee_id = ValueState.None;
    const cached = this.getEmployeeById(this.promotion.employee_id);
    if (cached) this.setCurrentEmployeeInfo(cached);
    this.loadEmployeeDetails(this.promotion.employee_id);
  }

  onEmployeeInput(event: any) {
    if (!event.target?.value?.trim()) {
      this.promotion.employee_id = undefined;
      this.promotion.old_designation = "";
      this.promotion.old_department_id = undefined;
      this.promotion.old_salary = undefined;
      this.promotion.new_salary = undefined;
      this.promotion.salary_increment = undefined;
      this.selectedEmployeeDepartmentName = "";
      this.valueStateOptions.employee_id = ValueState.Negative;
    }
  }

  onPromotionTypeChange(event: any) {
    this.promotion.promotion_type = event.detail?.item?.id || event.target?.value || "";
    this.checkValidation(event, "promotion_type");
  }

  onPromotionTypeInput(event: any) {
    if (!event.target?.value?.trim()) this.promotion.promotion_type = "";
    this.checkValidation(event, "promotion_type");
  }

  onTextInput(event: any, field: "promotion_title" | "new_designation") {
    this.promotion[field] = event.target?.value || "";
    if (field === "new_designation") this.checkValidation(event, field);
  }

  onDesignationChange(event: any, field: "old_designation" | "new_designation") {
    this.promotion[field] = event.detail?.item?.text || event.target?.value || "";
    if (field === "new_designation") this.checkValidation(event, field);
  }

  onDepartmentChange(event: any, field: "old_department_id" | "new_department_id") {
    this.promotion[field] = this.parseNumber(event.detail?.item?.id);
    if (field === "new_department_id") this.checkValidation(event, "new_department");
  }

  onDepartmentInput(event: any, field: "old_department_id" | "new_department_id") {
    if (!event.target?.value?.trim()) this.promotion[field] = undefined;
    if (field === "new_department_id") this.checkValidation(event, "new_department");
  }

  onIncrementTypeChange(event: any) {
    const id = event.detail?.item?.id || '';
    this.incrementType = id === 'percentage' ? 'percentage' : 'fixed';
    this.incrementPercentage = undefined;
    this.promotion.salary_increment = undefined;
    this.promotion.new_salary = undefined;
    this.promotion.increment_type = this.incrementType;
    this.promotion.inc_value = undefined;
  }

  onSalaryInput(event: any, field: "salary_increment") {
    const inputValue = this.parseNumber(event.target?.value);
    if (this.incrementType === 'percentage') {
      this.incrementPercentage = inputValue;
      const oldSalary = this.parseNumber(this.promotion.old_salary);
      this.promotion.salary_increment = inputValue !== undefined && oldSalary !== undefined
        ? Number(((oldSalary * inputValue) / 100).toFixed(2))
        : undefined;
      this.promotion.increment_type = 'percentage';
      this.promotion.inc_value = inputValue;
    } else {
      this.promotion[field] = inputValue;
      this.promotion.increment_type = 'fixed';
      this.promotion.inc_value = inputValue;
    }
    this.updateNewSalary();
    this.checkValidation(event, field);
  }

  onDateChange(event: any, field: "promotion_date" | "effective_date") {
    this.promotion[field] = this.normalizeDateForApi(event.target?.value || event.detail?.value || "");
    if (field === "promotion_date") this.checkValidation(event, field);
  }


  savePromotion() {
    if (!this.validateForm()) return;
    this.isLoading = true;

    this.promotion.increment_type = this.incrementType;
    this.promotion.inc_value = this.incrementType === 'percentage'
      ? this.incrementPercentage
      : this.promotion.salary_increment;

    const payload = this.promotion.toOdata();
    const isPost = this.saveMode === saveMode.POST;
    const req$ = isPost
      ? this.commonService.post("hrm/promotions", payload, false)
      : this.commonService.put(`hrm/promotions/${this.promotion.id}`, payload, false);

    req$.subscribe({
      next: (res) => {
        this.processData(res);
        this.toastService.show(isPost ? "add" : "edit");
        this.CloseDialog();
      },
      error: (err) => {
        console.error(err);
        this.isLoading = false;
        this.toastService.show("error");
      },
    });
  }

  canApprovePromotion(row: any): boolean {
    return ["pending", "expired"].includes(row?.status);
  }

  hasSalaryIncrement(row: any): boolean {
    const increment = this.parseNumber(row?.salary_increment);
    return increment !== undefined && increment !== 0;
  }

  openApproveDialog(row: any) {
    this.approveTarget = row;
    this.approveEffectiveDate = row.effective_date || moment().format('YYYY-MM-DD');
    this.isApproveLoading = false;
    this.isApproveDialogOpen = true;
  }

  onApproveEffectiveDateChange(event: any) {
    this.approveEffectiveDate = this.normalizeDateForApi(event.target?.value || event.detail?.value || '');
  }

  getApproveIncrementDisplay(): string {
    if (this.approveTarget?.increment_type === 'percentage') {
      return this.approveTarget?.inc_value != null ? this.approveTarget.inc_value + ' %' : '-';
    }
    return this.approveTarget?.salary_increment != null
      ? this.formatNumber(this.approveTarget.salary_increment)
      : '-';
  }

  closeApproveDialog() {
    if (this.isApproveLoading) return;
    this.approveTarget = null;
    this.isApproveDialogOpen = false;
  }

  confirmApprovePromotion() {
    if (!this.approveTarget || this.isApproveLoading) return;
    this.isApproveLoading = true;
    this.approvePromotion(this.approveTarget);
  }

  rejectApprovePromotion() {
    if (!this.approveTarget || this.isApproveLoading) return;
    this.isApproveLoading = true;
    this.approvePromotion(this.approveTarget, 'declined');
  }

  approvePromotion(row: any, status: 'approved' | 'declined' = 'approved') {
    if (!row?.id) return;
    this.commonService
      .post(`hrm/promotions/${row.id}/approve`, {
        status,
        effective_date: this.approveEffectiveDate || moment().format("YYYY-MM-DD"),
        promotion_date: row.promotion_date || moment().format("YYYY-MM-DD"),
        new_designation: row.new_designation,
        new_department_id: row.new_department_id,
        new_salary: row.new_salary,
        note: row.note,
      }, false)
      .subscribe({
        next: () => {
          this.isApproveLoading = false;
          this.closeApproveDialog();
          this.applyPromotionFilter();
          this.refreshTable.emit();
          this.toastService.show(status === 'approved' ? 'approve' : 'edit');
        },
        error: (err) => {
          this.isApproveLoading = false;
          console.error(err);
          this.toastService.show("error");
        },
      });
  }

  loadPromotionOptions() {
    if (this.promotionOptionsLoaded) return;
    this.commonService.get(`hrm/promotions/options`, false).subscribe({
      next: (response: any) => {
        this.employees = response.employees || [];
        this.departments = response.departments || [];
        this.designations = response.designations || [];
        this.employeeTypes = response.employeeTypes || [];
        this.rebuildEmployeeTypeToolbarFilters();
        this.promotionOptionsLoaded = true;
      },
      error: (err) => console.error("Error fetching promotion options:", err),
    });
  }

  ensurePromotionOptionsLoaded() {
    if (!this.promotionOptionsLoaded) this.loadPromotionOptions();
  }

  loadEmployeeDetails(employeeId: number) {
    this.commonService.get(`hrm/promotions/employees/${employeeId}`, false).subscribe({
      next: (response: any) => this.setCurrentEmployeeInfo(response),
      error: (err) => console.error("Error fetching employee details:", err),
    });
  }

  setCurrentEmployeeInfo(employee: any, overwriteExisting = true) {
    const designationName = this.getEmployeeDesignationName(employee);
    const departmentId = this.getEmployeeDepartmentId(employee);
    const departmentName = this.getEmployeeDepartmentName(employee);
    const totalSalary = this.getEmployeeTotalSalary(employee);

    if (overwriteExisting || !this.promotion.old_designation) this.promotion.old_designation = designationName;
    if (overwriteExisting || !this.promotion.old_department_id) this.promotion.old_department_id = departmentId;
    if (overwriteExisting || this.promotion.old_salary == null) this.promotion.old_salary = totalSalary;

    this.selectedEmployeeDepartmentName = departmentName;
    if (totalSalary !== undefined) this.valueStateOptions.old_salary = ValueState.None;
    this.updateNewSalary();
  }

  getEmployeeName(employeeId?: number): string {
    const e = this.getEmployeeById(employeeId);
    return e ? `${e.employee_no || ""} - ${e.first_name || ""} ${e.last_name || ""}`.trim() : "";
  }

  getOldDepartmentName(): string {
    return this.getDepartmentName(this.promotion.old_department_id) || this.selectedEmployeeDepartmentName;
  }

  getDepartmentName(departmentId?: number): string {
    if (!departmentId) return "";
    return this.departments.find(d => Number(d.id) === Number(departmentId))?.name || "";
  }

  getPromotionTypeLabel(type?: string): string {
    switch (type?.toLowerCase()) {
      case promotionType.REGULAR.toLowerCase():        return $localize`Regular`;
      case promotionType.SPECIAL.toLowerCase():        return $localize`Special`;
      case promotionType.PERFORMANCE_BASED.toLowerCase(): return $localize`Performance based`;
      default: return type || "";
    }
  }

  getPromotionStatusLabel(status?: string): string {
    switch (status) {
      case "pending":  return $localize`Pending`;
      case "approved": return $localize`Approved`;
      case "declined": return $localize`Declined`;
      case "expired":  return $localize`Expired`;
      default: return status || "";
    }
  }

  updateNewSalary() {
    const old = this.parseNumber(this.promotion.old_salary);
    const inc = this.parseNumber(this.promotion.salary_increment);
    this.promotion.new_salary = (old !== undefined && inc !== undefined)
      ? Number((old + inc).toFixed(2))
      : undefined;
  }

  updateSalaryIncrementFromNewSalary() {
    const old = this.parseNumber(this.promotion.old_salary);
    const newSal = this.parseNumber(this.promotion.new_salary);
    const inc = this.parseNumber(this.promotion.salary_increment);
    if (old === undefined || newSal === undefined || inc !== undefined) return;
    this.promotion.salary_increment = Number((newSal - old).toFixed(2));
  }

  getEmployeeById(employeeId?: number): Employee | undefined {
    if (!employeeId) return undefined;
    return this.employees.find(e => Number(e.id) === Number(employeeId));
  }

  getEmployeeDesignationName(employee: any): string {
    if (!employee) return "";
    return employee.designation?.name
      || employee.designation_name
      || (typeof employee.designation === "string" ? employee.designation : "")
      || this.getDesignationName(employee.designation_id);
  }

  getDesignationName(designationId?: number): string {
    if (!designationId) return "";
    return this.designations.find(d => Number(d.id) === Number(designationId))?.name || "";
  }

  getEmployeeDepartmentId(employee: any): number | undefined {
    return this.parseNumber(employee?.department_id || employee?.department?.id);
  }

  getEmployeeDepartmentName(employee: any): string {
    if (!employee) return "";
    if (typeof employee.department === "string") return employee.department;
    return employee.department?.name || this.getDepartmentName(employee.department_id);
  }

  getEmployeeTotalSalary(employee: any): number | undefined {
    const salary = Array.isArray(employee?.salary)
      ? employee.salary[0]
      : employee?.salary || employee?.employee_salaries?.[0];
    return this.parseNumber(salary?.total_salary);
  }

  parseNumber(value: any): number | undefined {
    if (value === "" || value === null || value === undefined) return undefined;
    const n = Number(value);
    return Number.isNaN(n) ? undefined : n;
  }

  formatNumber(value: any): string {
    if (value === null || value === undefined || value === "") return "-";
    return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatDate(value: any): string {
    if (!value) return "-";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
  }

  formatDateForDisplay(value: any): string {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  }

  formatDateForPicker(value: any): string {
    if (!value) return "";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : this.formatDateForDisplay(d);
  }

  normalizeDateForApi(value: string): string {
    if (!value) return "";
    const parts = value.split("-");
    if (parts.length !== 3) return value;
    const [first, second, third] = parts;
    return first.length === 4 ? value : `${third}-${second}-${first}`;
  }
}
