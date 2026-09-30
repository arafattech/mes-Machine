import { Component, EventEmitter, Output, ViewChild } from "@angular/core";
import { CommonService } from "@app/services/common-service/common.service";
import { ToastService } from "@app/services/toast-service/toast.service";
import { Localization } from "@app/shared/utilities/localization";
import { EmployeeBonus } from "@app/modules/hr-management/shared/models/employeeBonus";
import moment from "moment";
import {
  AgGridTableColumn,
  AgGridTableComponent,
} from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import {
  AgGridTableODataSourceConfig,
  AgGridTableToolbarActionEvent,
  AgGridTableToolbarConfig,
  AgGridToolbarFilter,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { AgGridStatusBadgeComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component";

@Component({
  selector: "app-employee-bonuses",
  templateUrl: "./employee-bonuses.component.html",
})
export class EmployeeBonusesComponent {
  @ViewChild("agGridBonusesRef") agGridBonusesRef!: AgGridTableComponent;
  @ViewChild("agGridPayModeEmployeeRef")
  agGridPayModeEmployeeRef!: AgGridTableComponent;
  @ViewChild("agGridConfirmPayRef") agGridConfirmPayRef!: AgGridTableComponent;

  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsExportXls: EventEmitter<void> = new EventEmitter<void>();

  private readonly payableBonusTypes = new Set([
    "OVERTIME",
    "OVERTIMEBONUS",
    "RAMADAN",
    "EXTRASHIFT",
    "HOLIDAYBONUS",
    "HOLIDAYOVERTIME",
  ]);

  EmployeeBonus = EmployeeBonus;
  employeeBonus: EmployeeBonus = new EmployeeBonus().deserialize({});
  localization = Localization;
  headerTitle: string = $localize`Bonus Lists`;
  isDialogOpen: boolean = false;

  confirmPayColumns: AgGridTableColumn<any>[] = [];
  confirmPayDataSource: AgGridTableODataSourceConfig<any> = {
    type: "odata",
    endpoint: "",
    staticData: true,
    data: [],
  };
  confirmPayToolbarConfig: AgGridTableToolbarConfig = {
    showSearch: false,
    showRowCount: false,
    showNewButton: false,
    showDownload: false,
  };

  public dateRangeValue: string;
  public dateRangeFilter: string;
  public mainTableFilter: string;

  public bonusTypeToolbarFilters: AgGridToolbarFilter[] = [];
  public bonusTypeFilter = "";
  public selectedBonusTypeId = "";
  public selectedBonusTypeName = "";
  private bonusTypeNameById = new Map<string, string>();

  public payMode = false;
  public selectedPayEmployee: any = null;
  public payModeEmployeeId: number | null = null;
  public payModeSelectedRows: any[] = [];
  public markPaidRows: any[] = [];

  public isMarkPaidDialogOpen = false;
  public markPaidTotal = 0;
  public isConfirmPayLoading = false;
  private _payModeAutoSelected = false;

  bonusesColumns: AgGridTableColumn<any>[] = [];
  bonusesDataSource: AgGridTableODataSourceConfig<any>;
  bonusesToolbarConfig: AgGridTableToolbarConfig;

  payModeEmployeeColumns: AgGridTableColumn<any>[] = [];
  payModeEmployeeDataSource: AgGridTableODataSourceConfig<any> = {
    type: "odata",
    endpoint: "",
    staticData: true,
    data: [],
  };
  payModeEmployeeToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Employees`,
    showSearch: true,
    showRowCount: true,
    showNewButton: false,
  };

  get hasPayModeSelection(): boolean {
    return (
      this.payMode &&
      this.payModeSelectedRows.some(
        (row: any) => !this.isRowPaid(row) && this.isPayableBonus(row),
      )
    );
  }

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
  ) {
    const today = moment();
    const sevenDaysAgo = moment().subtract(6, "days");
    this.dateRangeValue = `${sevenDaysAgo.format("DD/MM/YYYY")} - ${today.format("DD/MM/YYYY")}`;
    this.dateRangeFilter = this.buildDateCondition(sevenDaysAgo, today);
    this.mainTableFilter = this.dateRangeFilter;

    this.bonusesColumns = this.buildBonusesColumns();
    this.bonusesDataSource = {
      type: "odata",
      endpoint: "EmployeeBonuses",
      expand: "employee,shift,bonusType,bonusConfig,attendanceLog",
      sortDirection: "desc",
      sortBy: "attendance_date",
      filter: this.mainTableFilter,
      pageSize: 50,
    };
    this.bonusesToolbarConfig = {
      headerTitle: this.headerTitle,
      showSearch: true,
      showRowCount: true,
      showDownload: true,
      showNewButton: false,
      showExtraButton: false,
      extraButtonText: $localize`Mark as Paid`,
    };
  }

  ngOnInit(): void {
    this.payModeEmployeeColumns = this.buildPayModeEmployeeColumns();
    this.confirmPayColumns = this.buildConfirmPayColumns();
    this.getBonusTypes();
  }

  getBonusTypes(): void {
    this.commonService.get<{ value: any[] }>("BonusTypes", true).subscribe({
      next: (res) => {
        const options = (res?.value ?? []).map((bonusType: any) => ({
          value: String(bonusType.id),
          label: bonusType.name,
        }));
        this.bonusTypeNameById = new Map(
          options.map((option: { value: string; label: string }) => [option.value, option.label]),
        );
        this.bonusTypeToolbarFilters = options.length
          ? [{
              id: "bonus_type",
              type: "select",
              placeholder: $localize`Filter by Bonus Type`,
              clearLabel: $localize`All`,
              options,
            }]
          : [];
      },
      error: (err: any) => {
        console.error("Error fetching bonus types:", err);
      },
    });
  }

  onToolbarAction(event: AgGridTableToolbarActionEvent): void {
    if (event.actionId !== "filter:bonus_type") return;
    this.selectedBonusTypeId = event.value ? String(event.value) : "";
    this.selectedBonusTypeName = this.bonusTypeNameById.get(this.selectedBonusTypeId) ?? "";
    this.bonusTypeFilter = this.selectedBonusTypeId
      ? `bonus_type_id eq ${this.selectedBonusTypeId}`
      : "";
    this.rebuildMainTableFilter();
  }

  private buildDateCondition(start: moment.Moment, end: moment.Moment): string {
    return `attendance_date ge ${start.format("YYYY-MM-DD")} and attendance_date le ${end.format("YYYY-MM-DD")}`;
  }

  private rebuildMainTableFilter(): void {
    const parts: string[] = [];
    if (this.dateRangeFilter) parts.push(this.dateRangeFilter);
    if (this.bonusTypeFilter) parts.push(this.bonusTypeFilter);
    if (this.payMode && this.payModeEmployeeId) {
      parts.push(`emp_id eq ${this.payModeEmployeeId}`);
    }

    this.mainTableFilter = parts.join(" and ");
    this.bonusesDataSource = { ...this.bonusesDataSource, filter: this.mainTableFilter };
    this.bonusesToolbarConfig = {
      ...this.bonusesToolbarConfig,
      showExtraButton: this.hasPayModeSelection,
    };
  }

  private loadPayModeEmployees(): void {
    const url = `EmployeeBonuses?$filter=${this.dateRangeFilter}&$expand=employee($expand=employeeSection)&$top=1000`;

    this.commonService.get<{ value: any[] }>(url, true).subscribe({
      next: (res) => {
        const seen = new Map<number, any>();
        (res?.value ?? []).forEach((bonus: any) => {
          const emp = bonus.employee;
          if (emp?.id != null && !seen.has(emp.id)) seen.set(emp.id, emp);
        });
        this.payModeEmployeeDataSource = {
          ...this.payModeEmployeeDataSource,
          data: Array.from(seen.values()),
        };
      },
    });
  }

  onDateRangeChange(value: string) {
    if (!value || !value.includes(" - ")) return;

    const [from, to] = value.split(" - ");
    const start = moment(from, "DD/MM/YYYY");
    const end = moment(to, "DD/MM/YYYY");
    if (!start.isValid() || !end.isValid()) return;

    this.dateRangeValue = value;
    this.dateRangeFilter = this.buildDateCondition(start, end);
    this.rebuildMainTableFilter();
    if (this.payMode) this.loadPayModeEmployees();
  }

  onMainSwitchChange(checked: boolean) {
    this.payMode = !!checked;
    this.payModeSelectedRows = [];
    this.markPaidRows = [];
    this._payModeAutoSelected = false;

    if (!this.payMode) {
      this.selectedPayEmployee = null;
      this.payModeEmployeeId = null;
    }

    this.rebuildMainTableFilter();

    if (this.payMode) {
      this.loadPayModeEmployees();
      setTimeout(() => {
        this.agGridPayModeEmployeeRef?.getGridApi()?.sizeColumnsToFit();
        const api = this.agGridPayModeEmployeeRef?.getGridApi();
        const firstNode = api?.getDisplayedRowAtIndex(0);
        if (firstNode?.data && !this._payModeAutoSelected) {
          this._payModeAutoSelected = true;
          firstNode.setSelected(true);
          this.onPayEmployeeSelect(firstNode.data);
        }
      }, 250);
    }
  }

  onPayModeEmployeeDataLoaded(count: number): void {
    if (!this.payMode || this._payModeAutoSelected || !count) return;
    this._payModeAutoSelected = true;
    setTimeout(() => {
      const api = this.agGridPayModeEmployeeRef?.getGridApi();
      const firstNode = api?.getDisplayedRowAtIndex(0);
      if (!firstNode?.data) return;
      firstNode.setSelected(true);
      this.onPayEmployeeSelect(firstNode.data);
    }, 0);
  }

  onPayEmployeeSelect(emp: any) {
    if (!emp) return;
    this.selectedPayEmployee = emp;
    this.payModeEmployeeId = emp?.id ?? null;
    this.payModeSelectedRows = [];
    this.markPaidRows = [];
    this.rebuildMainTableFilter();
  }

  onPayModeRowSelect(rows: any[]) {
    if (!this.payMode) return;
    this.payModeSelectedRows = rows;
    this.bonusesToolbarConfig = {
      ...this.bonusesToolbarConfig,
      showExtraButton: this.hasPayModeSelection,
    };
  }

  private buildBonusesColumns(): AgGridTableColumn<any>[] {
    return [
      {
        colId: "employee.employee_no",
        headerName: $localize`Employee No`,
        minWidth: 140,
        valueGetter: (params: any) => params.data?.employee?.employee_no ?? "",
      },
      {
        colId: "employee.first_name",
        headerName: $localize`First Name`,
        minWidth: 150,
        valueGetter: (params: any) => params.data?.employee?.first_name ?? "",
      },
      {
        colId: "employee.last_name",
        headerName: $localize`Last Name`,
        minWidth: 150,
        valueGetter: (params: any) => params.data?.employee?.last_name ?? "",
      },
      {
        field: "status",
        headerName: $localize`Status`,
        minWidth: 120,
        sortable: false,
        filter: false,
        cellRenderer: AgGridStatusBadgeComponent,
        valueGetter: (params: any) => this.formatBonusStatus(params.data),
      },
      {
        field: "bonus_type",
        headerName: $localize`Bonus Type`,
        minWidth: 150,
        valueGetter: (params: any) => this.formatBonusType(params.data),
      },
      {
        field: "amount",
        headerName: $localize`Bonus Amount`,
        minWidth: 140,
        type: "numericColumn",
        filter: "agNumberColumnFilter",
      },
      {
        field: "attendance_date",
        headerName: $localize`Attendance Date`,
        minWidth: 150,
        filter: false,
      },
      {
        colId: "shift.name",
        headerName: $localize`Shift`,
        minWidth: 140,
        isSelected: false,
        valueGetter: (params: any) => params.data?.shift?.name ?? "",
      },
      {
        field: "created_at",
        headerName: $localize`Created On`,
        minWidth: 130,
        filter: false,
      },
    ];
  }

  buildPayModeEmployeeColumns(): AgGridTableColumn<any>[] {
    return [
      {
        field: "employee_no",
        headerName: $localize`Emp No`,
        minWidth: 120,
      },
      {
        field: "first_name",
        headerName: $localize`First Name`,
        minWidth: 140,
      },
      {
        field: "last_name",
        headerName: $localize`Last Name`,
        minWidth: 140,
      },
      {
        colId: "employeeSection.id",
        headerName: $localize`Section`,
        minWidth: 140,
        valueGetter: (params: any) => params.data?.employeeSection?.name ?? "",
      },
    ];
  }

  buildConfirmPayColumns(): AgGridTableColumn<any>[] {
    return [
      {
        colId: "employee.employee_no",
        headerName: $localize`Emp No`,
        minWidth: 120,
        valueGetter: (params: any) => params.data?.employee?.employee_no ?? "",
      },
      {
        colId: "employee",
        headerName: $localize`Employee Name`,
        minWidth: 160,
        valueGetter: (params: any) => this.getEmployeeName(params.data?.employee),
      },
      {
        field: "bonus_type",
        headerName: $localize`Bonus Type`,
        minWidth: 150,
        valueGetter: (params: any) =>
          params.data?.bonusType?.name || params.data?.bonus_type || "",
      },
      {
        field: "attendance_date",
        headerName: $localize`Attendance Date`,
        minWidth: 150,
        filter: false,
      },
      {
        field: "amount",
        headerName: $localize`Amount`,
        minWidth: 120,
        type: "numericColumn",
        filter: "agNumberColumnFilter",
      },
    ];
  }

  viewEmployeeBonus(data: any) {
    this.employeeBonus = new EmployeeBonus().deserialize(data);
    this.isDialogOpen = true;
  }

  processData(_event?: any) {
    this.agGridBonusesRef?.refreshGridData(true);
  }

  CloseDialog() {
    this.isDialogOpen = false;
    this.employeeBonus = new EmployeeBonus().deserialize({});
  }

  getRowData(row: any): any {
    return row?.original ?? row;
  }

  getBonusStatus(data: any): string {
    if (data?.is_paid === true || data?.isPaid === true) return "PAID";
    return String(data?.status ?? "").toUpperCase();
  }

  isEmployeeBonusPaid(data: any): boolean {
    return this.getBonusStatus(data) === "PAID";
  }

  isRowPaid(row: any): boolean {
    return this.isEmployeeBonusPaid(this.getRowData(row));
  }

  private normalizeBonusType(value: any): string {
    return String(value ?? "")
      .replace(/[^a-z0-9]/gi, "")
      .toUpperCase();
  }

  isPayableBonus(row: any): boolean {
    const data = this.getRowData(row);
    const normalizedType = this.normalizeBonusType(this.getBonusType(data));
    return this.payableBonusTypes.has(normalizedType);
  }

  formatBonusStatus(data: any): string {
    return this.isEmployeeBonusPaid(data) ? "PAID" : "UNPAID";
  }

  getEmployeeName(employee: any): string {
    if (!employee) return "";
    return `${employee.first_name || ""} ${employee.last_name || ""}`.trim();
  }

  getBonusType(data: any): string {
    return data?.bonusType?.name || data?.bonus_type || "";
  }

  formatBonusType(data: any): string {
    const bonusType = this.getBonusType(data);
    return bonusType === "HOLIDAY_OVERTIME"
      ? $localize`Holiday Overtime Bonus`
      : bonusType;
  }

  formatDisplayValue(value: any): string {
    return value === null || value === undefined || value === ""
      ? "--"
      : String(value);
  }

  openMarkPaidDialog() {
    if (!this.payMode) return;

    this.markPaidRows = this.payModeSelectedRows.filter(
      (row: any) => !this.isRowPaid(row) && this.isPayableBonus(row),
    );
    if (!this.markPaidRows.length) return;

    this.markPaidTotal = this.markPaidRows.reduce(
      (sum: number, row: any) =>
        sum + Number((row.original ?? row).amount ?? 0),
      0,
    );
    this.confirmPayDataSource = {
      ...this.confirmPayDataSource,
      data: this.markPaidRows.map((row: any) => row.original ?? row),
    };
    this.isMarkPaidDialogOpen = true;
  }

  closeMarkPaidDialog() {
    this.isMarkPaidDialogOpen = false;
    this.markPaidRows = [];
    this.markPaidTotal = 0;
    this.confirmPayDataSource = { ...this.confirmPayDataSource, data: [] };
  }

  confirmMarkPaid() {
    this.isMarkPaidDialogOpen = false;
    this.onPayModeAction();
  }

  exportEmployeeBonuses(_event: any) {
    this.IsExportXls.emit();
  }

  getExportPayload(): any {
    const [from, to] = this.dateRangeValue.split(" - ");
    const params: any = {
      from: moment(from, "DD/MM/YYYY").format("YYYY-MM-DD"),
      to: moment(to, "DD/MM/YYYY").format("YYYY-MM-DD"),
    };
    if (this.selectedBonusTypeName) {
      params.bonus_type = this.selectedBonusTypeName;
    }
    if (this.payMode && this.payModeEmployeeId) {
      params.emp_id = this.payModeEmployeeId;
    }
    return params;
  }

  getExportFileName(): string {
    const params = this.getExportPayload();
    const typeSegment = params.bonus_type ? `-${String(params.bonus_type).toLowerCase()}` : "";
    return `employee-bonuses-${params.from}-to-${params.to}${typeSegment}.xlsx`;
  }

  onPayModeAction() {
    if (!this.markPaidRows.length) return;

    const ids = this.markPaidRows
      .filter((row: any) => !this.isRowPaid(row) && this.isPayableBonus(row))
      .map((row: any) => (row.original ?? row).id)
      .filter(Boolean);

    if (!ids.length) return;

    this.commonService
      .put("employee-bonuses/bulk-mark-paid", { ids }, false)
      .subscribe({
        next: () => {
          this.toastService.show("edit");
          this.payModeSelectedRows = [];
          this.markPaidRows = [];
          this.markPaidTotal = 0;
          this.rebuildMainTableFilter();
        },
        error: (err: any) => {
          console.error(err);
          this.toastService.show("error");
        },
      });
  }
}
