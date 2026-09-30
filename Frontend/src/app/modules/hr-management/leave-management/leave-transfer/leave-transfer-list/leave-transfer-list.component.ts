import { Component, EventEmitter, OnInit, Output, ViewChild } from "@angular/core";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { saveMode } from "@shared/enums/saveMode";
import { CommonService } from "@app/services/common-service/common.service";
import { Localization } from "@app/shared/utilities/localization";
import { EmployeeHolidaySwap } from "@app/modules/hr-management/shared/models/leaveTransfer";
import { LeaveTransferFormComponent } from "@app/modules/hr-management/leave-management/leave-transfer/leave-transfer-form/leave-transfer-form.component";
import { Permissions } from "@app/shared/enums/permissions";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import { AgGridTableColumn, AgGridTableODataSourceConfig, AgGridTableToolbarConfig, GridTableColumnDataType } from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { DateFormatterService } from "@app/shared/utilities/date-format";
@Component({
  selector: "app-leave-transfer-list",
  templateUrl: "./leave-transfer-list.component.html",
  styleUrl: "./leave-transfer-list.component.scss",
})
export class LeaveTransferListComponent implements OnInit {
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent<any>;
  @ViewChild("leaveTransferForm")
  leaveTransferFormRef!: LeaveTransferFormComponent;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();
  @Output() EmployeeAssets = new EventEmitter<any>();
  isLoading: boolean = false;
  employeeHolidaySwap = EmployeeHolidaySwap;
  localization = Localization;
  public saveMode: string = saveMode.POST;
  headerTitle: string = `${$localize`Holiday`} ${$localize`Swap`} ${$localize`Logs`}`;
  insertTitle: string = $localize`New`;
  isViewOpen: boolean = false;
  permission = Permissions;
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'EmployeeHolidaySwaps',
    expand: 'employee',
    searchFields: ['employee.employee_no', 'employee.first_name', 'employee.last_name', 'type'],
    pageSize: 50,
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.headerTitle,
    addButtonText: this.insertTitle,
    showSearch: true,
    showRowCount: true,
    showNewButton: false,
    showDownload: false,
    showSegmentButton: false,
  };


  constructor(
    public rolePermissionService: RolePermissionService,
    private commonService: CommonService,
    private dateFormatter: DateFormatterService,
  ) {}

  ngOnInit(): void {
    this.columns = this.buildColumns();
    this.toolbarConfig = {
      ...this.toolbarConfig,
      showNewButton: this.rolePermissionService.hasPermission(this.permission.HR_HOLIDAY_SWAP_CREATE),
    };
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    return [
      {
        colId: 'employee_name',
        headerName: $localize`Employee Name`,
        minWidth: 180,
        valueGetter: (params: any) => {
          const e = params.data?.employee;
          return e ? `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim() : '-';
        },
      },
      {
        colId: 'employee_no',
        headerName: $localize`Employee ID`,
        minWidth: 130,
        valueGetter: (params: any) => params.data?.employee?.employee_no ?? '',
      },
      {
        field: 'original_holiday_date',
        headerName: $localize`Original Date`,
        minWidth: 140,
        filter: false, floatingFilter: false,
      },
      {
        field: 'swapped_holiday_date',
        headerName: $localize`Transfer To`,
        minWidth: 140,
        filter: false, floatingFilter: false,
      },
      {
        field: 'type',
        headerName: $localize`Swap Type`,
        minWidth: 130,
      },
      {
        field: 'created_at',
        headerName: $localize`Created On`,
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

  processData(event: any) {
    this.refreshTable.emit(event);
    this.agGridRef?.refreshGridData(true);
  }

  newLeaveTransfer() {
    this.leaveTransferFormRef.open = true;
    this.saveMode = saveMode.POST;
  }
}
