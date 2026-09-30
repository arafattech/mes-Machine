import { Component, OnInit, ViewChild } from "@angular/core";
import { CommonService } from "@app/services/common-service/common.service";
import moment from "moment";
import { PayrollHistory } from "@app/modules/hr-management/shared/models/payrollHistory";
import { Payroll } from "@app/modules/hr-management/shared/models/payroll";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import { AgGridTableColumn, AgGridTableDisplayConfig, AgGridTableODataSourceConfig, AgGridTableRowAction, AgGridTableToolbarConfig } from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { AgGridBooleanCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component";
import { AgGridActionCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component";

@Component({
  selector: "app-payroll-history",
  templateUrl: "./payroll-history.component.html",
  styleUrls: ["./payroll-history.component.scss"],
})
export class PayrollHistoryComponent implements OnInit {
  @ViewChild("payrollTable") payrollTable?: AgGridTableComponent<any>;
  @ViewChild("historyTable") historyTable?: AgGridTableComponent<any>;
  PayrollHistorys = PayrollHistory;
  payrollHistory = new PayrollHistory();
  payrollList: Payroll[] = [];
  headerTitle = `${$localize`Payroll`}`;
  isListCollapsed = false;
  isTabCollapsed = false;
  historyHeaderTitle = $localize`Payroll History`;
  detailHeaderTitle = $localize`Payroll Details`;
  public start: string = moment().subtract(30, "days").format("YYYY-MM-DD");
  public end: string = moment().format("YYYY-MM-DD");
  selectedPayrollDetails: any[] = [];
  selectedHistory: any[] = [];
  payrollFilterQuery = "";
  historyTablecol: AgGridTableColumn<any>[] = [];
  payrollTablecol: AgGridTableColumn<any>[] = [];
  selectedHistoryRowsId: Record<number, boolean> = {};
  hasInitialHistorySelection = false;

  historyDataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'PayrollHistories',
    pageSize: 50,
    sortBy: 'id',
    sortDirection: 'desc',
    searchFields: ['total_salary','total_employees'],
  };

  historyToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.historyHeaderTitle,
    showSearch: true,
    showRowCount: true,
    showNewButton: false,
    showDownload: false,
    showScanner: false,
  };

  historyDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 118px)',
  };

  payrollDataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'Payrolls',
    pageSize: 50,
    expand: 'employee($expand=salary)',
    searchFields: ['employee.employee_no', 'employee.first_name', 'employee.last_name', 'payment_method'],
  };

  payrollToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.headerTitle,
    showSearch: true,
    showRowCount: true,
    showNewButton: false,
    showDownload: false,
    showScanner: false,
  };

  payrollDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 118px)',
  };

  constructor(private commonService: CommonService) {}

  ngOnInit(): void {
    this.historyTablecol = this.historyColumns();
    this.payrollTablecol = this.payrollColumns();
  }

  historyColumns(): AgGridTableColumn<any>[] {
    return [
      {
        field: 'id',
        hide: true,
        filter: false, sortable: false, floatingFilter: false,
      },
      {
        field: 'is_active',
        headerName: $localize`Active`,
        minWidth: 80, width: 90,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false, sortable: false, floatingFilter: false,
      },
      {
        colId: 'month',
        headerName: $localize`Month`,
        minWidth: 120,
        filter: false, sortable: false,
        valueGetter: (params: any) =>
          params.data?.start_date ? moment(params.data.start_date).format('MMM YYYY') : '',
      },
      {filter:false, sortable: false, field: 'total_employees', headerName: $localize`Total Employees`, minWidth: 140, type: 'numericColumn' },
      {
        filter: false, sortable: false,
        field: 'total_salary', headerName: $localize`Amount`, minWidth: 130, type: 'numericColumn',
        valueFormatter: (params: any) => `${Math.max(0, Number(params.value ?? 0))}`,
      },
      {filter:false, sortable: false, field: 'total_tax', headerName: $localize`Total Tax`, minWidth: 120, type: 'numericColumn' },
      {filter:false, sortable: false, field: 'payment_method', headerName: $localize`Payment Method`, minWidth: 150 },
      {
        field: 'actions',
        headerName: $localize`Actions`,
        minWidth: 90, width: 90,
        pinned: 'right',
        lockPinned: true,
        sortable: false, filter: false, floatingFilter: false, editable: false,
        cellRenderer: AgGridActionCellRendererComponent,
        cellRendererParams: {
          actions: [
            { id: 'export', label: '', icon: 'download', tooltip: $localize`Export Payroll`, design: 'Transparent' },
          ] as AgGridTableRowAction<any>[],
          onAction: (actionId: string, row: any) => {
            if (actionId === 'export') this.exportHistoryPayroll(row);
          },
        },
      },
    ];
  }

  payrollColumns(): AgGridTableColumn<any>[] {
    return [
      {
        field: 'is_active',
        headerName: $localize`Active`,
        minWidth: 80, width: 90,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false, sortable: false, floatingFilter: false,
      },
      {
        colId: 'employee_no',
        headerName: $localize`Employee Id`,
        minWidth: 130,
        valueGetter: (params: any) => params.data?.employee?.employee_no ?? '',
      },
      {
        colId: 'employee_name',
        headerName: $localize`Employee Name`,
        minWidth: 160,
        valueGetter: (params: any) => {
          const e = params.data?.employee;
          return e ? `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim() : '';
        },
      },
      {
        colId: 'employee.salary.total_salary',
        headerName: $localize`Total Salary`,
        minWidth: 130,
        type: 'numericColumn',
        valueGetter: (params: any) => params.data?.employee?.salary?.total_salary ?? 0,
      },
      { field: 'payment_method', headerName: $localize`Payment Method`, minWidth: 150 },
      {
        colId: 'net_salary_display',
        headerName: $localize`Net Salary`,
        minWidth: 130,
        valueGetter: (params: any) =>
          params.data
            ? `${params.data.currency ?? ''} ${Math.max(0, Number(params.data.net_salary ?? 0))}`.trim()
            : '',
      },
    ];
  }

  processData(data: any) {
    const rows = Array.isArray(data?.[0]) ? data[0] : data;

    if (rows && rows.length > 0) {
      this.selectedHistoryRowsId = { 0: true };
      this.selectedRowData(rows[0]);
    } else {
      this.selectedHistory = [];
      this.payrollFilterQuery = "";
      this.hasInitialHistorySelection = false;
    }
  }

  selectedRowData(row: any) {
    if (!row?.id) return;
    this.selectedHistory = row.id;
    this.payrollFilterQuery = `payroll_history_id eq ${this.selectedHistory}`;
    this.hasInitialHistorySelection = true;
    this.refreshPayrollTable();
  }

  refreshPayrollTable() {
    setTimeout(() => {
      this.payrollTable?.refreshGridData(true);
    });
  }

  exportHistoryPayroll(history: any) {
    if (!history?.id) return;

    const start = moment.utc(history.start_date).format('YYYY-MM-DD');
    const end = moment.utc(history.end_date).format('YYYY-MM-DD');

    this.commonService
      .post<Blob>(`exportPayroll?payroll_history_id=${history.id}`, {}, false, undefined, 'blob')
      .subscribe({
        next: (res: Blob) => {
          const url = window.URL.createObjectURL(res);
          const a = document.createElement('a');
          a.href = url;
          a.download = `payroll_${start}_to_${end}.xlsx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        },
        error: (err: any) => console.error('Failed to export payroll', err),
      });
  }

  onCLickListCollapsed() {
    this.isListCollapsed = !this.isListCollapsed;
  }

  onCLickTabCollapsed() {
    this.isTabCollapsed = !this.isTabCollapsed;
  }
}
