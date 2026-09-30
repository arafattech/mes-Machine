import { Component, EventEmitter, OnInit, Output, ViewChild } from "@angular/core";
import { promotionType } from "@app/modules/hr-management/shared/enums/promotionType";
import { CommonService } from "@app/services/common-service/common.service";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import {
  AgGridCustomButton,
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarActionEvent,
  AgGridTableToolbarConfig,
  AgGridToolbarFilter,
  GridTableColumnDataType,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import {
  AgGridActionCellRendererComponent,
  AgGridStatusBadgeComponent,
} from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component";
import moment from "moment";

@Component({
  selector: "app-promotion-history",
  templateUrl: "./promotion-history.component.html",
  styleUrl: "./promotion-history.component.scss",
})
export class PromotionHistoryComponent implements OnInit {
  @ViewChild("historyTableRef") historyTableRef!: AgGridTableComponent<any>;
  @Output() IsExportXls = new EventEmitter<void>();

  headerTitle = $localize`Promotion History`;
  column: AgGridTableColumn<any>[] = [];
  selectedPromotion: any = null;
  isDetailsDialogOpen = false;

  private readonly defaultRangeStart = moment().subtract(1, "months");
  private readonly defaultRangeEnd = moment();

  dateRangeValue = `${this.defaultRangeStart.format("DD/MM/YYYY")} - ${this.defaultRangeEnd.format("DD/MM/YYYY")}`;
  private dateRangeFilter = this.buildDateCondition(this.defaultRangeStart, this.defaultRangeEnd);
  private employeeFilter = "";
  private selectedEmployeeId = "";
  employeeToolbarFilters: AgGridToolbarFilter[] = [];

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: "api",
    endpoint: "",
    customEndpoint: "/hrm/promotions",
    filter: ["status eq 'approved'", this.dateRangeFilter].filter(Boolean).join(" and "),
    sortBy: "promotion_date",
    sortDirection: "desc",
    pageSize: 40,
    scrollPagination: true,
    searchFields: ["custom_id", "promotion_title", "old_designation", "new_designation"],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.headerTitle,
    showSearch: true,
    showRowCount: true,
    showNewButton: false,
    showDownload: true,
    showResetButton: true,
    resetButtonText: $localize`Reset`,
  };

  actionButtons: AgGridCustomButton[] = [
    {
      id: "info",
      icon: "information",
      design: "Transparent",
      tooltip: $localize`Information`,
      onClick: (row: any) => this.openDetails(row),
    },
  ];

  constructor(private commonService: CommonService) {}

  ngOnInit(): void {
    this.column = this.tableColumn();
    this.loadEmployeeOptions();
  }

  private loadEmployeeOptions(): void {
    this.commonService.get(`hrm/promotions/options`, false).subscribe({
      next: (response: any) => {
        const employees = response?.employees ?? [];
        this.employeeToolbarFilters = employees.length
          ? [
              {
                id: "employee",
                type: "select",
                placeholder: $localize`Select Employee`,
                clearLabel: $localize`All Employees`,
                options: employees.map((e: any) => ({
                  value: String(e.id),
                  label: `${e.employee_no || ""} - ${e.first_name || ""} ${e.last_name || ""}`.trim(),
                })),
              },
            ]
          : [];
      },
      error: (err) => console.error("Error fetching employees:", err),
    });
  }

  onToolbarAction(event: AgGridTableToolbarActionEvent): void {
    if (event.actionId !== "filter:employee") return;
    this.selectedEmployeeId = event.value ?? "";
    this.employeeFilter = event.value ? `employee_id eq ${event.value}` : "";
    this.rebuildFilter();
  }

  onDateRangeChange(value: string): void {
    if (!value || !value.includes(" - ")) {
      this.dateRangeValue = "";
      this.dateRangeFilter = "";
      this.rebuildFilter();
      return;
    }

    const [from, to] = value.split(" - ");
    const start = moment(from, "DD/MM/YYYY");
    const end = moment(to, "DD/MM/YYYY");
    if (!start.isValid() || !end.isValid()) return;

    this.dateRangeValue = value;
    this.dateRangeFilter = this.buildDateCondition(start, end);
    this.rebuildFilter();
  }

  private buildDateCondition(start: moment.Moment, end: moment.Moment): string {
    return `promotion_date ge ${start.format("YYYY-MM-DD")} and promotion_date le ${end.format("YYYY-MM-DD")}`;
  }

  private rebuildFilter(): void {
    const parts = ["status eq 'approved'", this.dateRangeFilter, this.employeeFilter].filter(Boolean);
    this.dataSource = { ...this.dataSource, filter: parts.join(" and ") };
  }

  onResetFilters(): void {
    this.dateRangeValue = `${this.defaultRangeStart.format("DD/MM/YYYY")} - ${this.defaultRangeEnd.format("DD/MM/YYYY")}`;
    this.dateRangeFilter = this.buildDateCondition(this.defaultRangeStart, this.defaultRangeEnd);
    this.employeeFilter = "";
    this.selectedEmployeeId = "";
    // New object identity per item (no trackBy on the grid's *ngFor) makes Angular destroy
    // and recreate the combobox DOM node, clearing its displayed text as a side effect —
    // no shared ag-grid-table change needed for this.
    this.employeeToolbarFilters = this.employeeToolbarFilters.map((filter) => ({ ...filter }));
    this.rebuildFilter();
  }

  downloadButtonClick(): void {
    this.IsExportXls.emit();
  }

  getExportPayload(): { from?: string; to?: string; employee_id?: string } {
    const payload: { from?: string; to?: string; employee_id?: string } = {};

    if (this.dateRangeValue?.includes(" - ")) {
      const [from, to] = this.dateRangeValue.split(" - ");
      const start = moment(from, "DD/MM/YYYY");
      const end = moment(to, "DD/MM/YYYY");
      if (start.isValid() && end.isValid()) {
        payload.from = start.format("YYYY-MM-DD");
        payload.to = end.format("YYYY-MM-DD");
      }
    }

    if (this.selectedEmployeeId) payload.employee_id = this.selectedEmployeeId;
    return payload;
  }

  getExportFileName(): string {
    const { from, to } = this.getExportPayload();
    return from && to ? `promotion-history_${from}_to_${to}.xlsx` : "promotion-history.xlsx";
  }

  tableColumn(): AgGridTableColumn<any>[] {
    return [
      {
        colId: "employee_id",
        headerName: $localize`Employee No`,
        sortable: false,
        valueGetter: (p: any) => p.data?.employee?.employee_no || p.data?.employee_id || "-",
      },
      {
        colId: "employee_name",
        headerName: $localize`Employee Name`,
        sortable: false,
        filter: false,
        valueGetter: (p: any) => {
          const e = p.data?.employee;
          return e ? `${e.first_name || ""} ${e.last_name || ""}`.trim() : "-";
        },
      },
      {
        field: "promotion_type",
        headerName: $localize`Promotion Type`,
        Cell: ({ value }) => this.getPromotionTypeLabel(value),
      },
      { field: "old_designation", headerName: $localize`Old Designation` },
      { field: "new_designation", headerName: $localize`New Designation` },
      {
        field: "old_salary",
        headerName: $localize`Old Salary`,
        type: "numericColumn",
        Cell: ({ value }) => this.formatNumber(value),
      },
      {
        field: "new_salary",
        headerName: $localize`New Salary`,
        type: "numericColumn",
        Cell: ({ value }) => this.formatNumber(value),
      },
      {
        field: "salary_increment",
        headerName: $localize`Increment`,
        type: "numericColumn",
        Cell: ({ value }) => this.formatNumber(value),
      },
      {
        field: "promotion_date",
        headerName: $localize`Promotion Date`,
        Cell: ({ value }) => this.formatDate(value),
      },
      {
        field: "effective_date",
        headerName: $localize`Effective Date`,
        Cell: ({ value }) => this.formatDate(value),
      },
      {
        field: "approved_by.name",
        headerName: $localize`Executed By`,
        sortable: false,
      },
      {
        field: "status",
        headerName: $localize`Status`,
        dataType: GridTableColumnDataType.String,
        cellRenderer: AgGridStatusBadgeComponent,
      },
      {
        field: "actions",
        headerName: $localize`Actions`,
        width: 90,
        minWidth: 80,
        pinned: "right",
        lockPinned: true,
        sortable: false,
        filter: false,
        floatingFilter: false,
        editable: false,
        cellRenderer: AgGridActionCellRendererComponent,
        cellRendererParams: {
          actions: this.actionButtons,
          onAction: (actionId: string, row: any) => {
            if (actionId === "info") this.openDetails(row);
          },
        },
      },
    ];
  }

  openDetails(row: any): void {
    this.selectedPromotion = row;
    this.isDetailsDialogOpen = true;
  }

  closeDetails(): void {
    this.isDetailsDialogOpen = false;
    this.selectedPromotion = null;
  }

  getEmployeeName(): string {
    const e = this.selectedPromotion?.employee;
    return e ? `${e.employee_no || ""} - ${e.first_name || ""} ${e.last_name || ""}`.trim() : "-";
  }

  getPromotionTypeLabel(type?: string): string {
    switch (type?.toLowerCase()) {
      case promotionType.REGULAR.toLowerCase(): return $localize`Regular`;
      case promotionType.SPECIAL.toLowerCase(): return $localize`Special`;
      case promotionType.PERFORMANCE_BASED.toLowerCase(): return $localize`Performance based`;
      default: return type || "-";
    }
  }

  formatNumber(value: any): string {
    if (value === null || value === undefined || value === "") return "-";
    return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatDate(value: any): string {
    if (!value) return "-";
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? value
      : `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  }
}
