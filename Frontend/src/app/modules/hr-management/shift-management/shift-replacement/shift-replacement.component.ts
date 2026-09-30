import { Component, EventEmitter, OnInit, Output, ViewChild } from "@angular/core";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { saveMode } from "@shared/enums/saveMode";
import { Localization } from "@shared/utilities/localization";
import { ValueState } from "@shared/utilities/value-state-wrapper";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import { AgGridTableColumn, AgGridTableODataSourceConfig, AgGridTableToolbarConfig, GridTableColumnDataType } from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { CommonService } from "@app/services/common-service/common.service";
import { ToastService } from "@app/services/toast-service/toast.service";
import { EmployeeShift } from "@app/modules/hr-management/shared/models/employeeShift";
import { ReplacementFormComponent } from "@app/modules/hr-management/shift-management/shift-replacement/replacement-form/replacement-form.component";
import { DateFormatterService } from "@app/shared/utilities/date-format";

@Component({
  selector: "app-shift-replacement",
  templateUrl: "./shift-replacement.component.html",
  styleUrl: "./shift-replacement.component.scss",
})
export class ShiftReplacementComponent implements OnInit {
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent<any>;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<any>();

  @ViewChild("shiftreplacementform")
  shiftreplacementform!: ReplacementFormComponent;

  EmployeeShift = EmployeeShift;
  employeeShift = new EmployeeShift();
  columns: AgGridTableColumn<any>[] = [];
  odata: boolean;
  saveMode: string = saveMode.POST;
  open: boolean = false;
  loading: boolean = false;
  localization = Localization;
  insertTitle: string = $localize`New`;
  headerTitle: string = `${this.localization.Shift} ${this.localization.OverridesLog}`;
  ToastType: "add" | "edit" | "error" = "add";
  validationMessage = Localization.requiredField;

  valueStateOptions = {
    name: ValueState.None,
    start_time: ValueState.None,
    end_time: ValueState.None,
  };

  dataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'ShiftOverrides',
    expand: 'shift,replacementEmployee,absentEmployee',
    searchFields: ['custom_id', 'shift.name', 'absentEmployee.first_name', 'absentEmployee.last_name', 'replacementEmployee.first_name', 'replacementEmployee.last_name', 'type'],
    pageSize: 50,
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.headerTitle,
    showSearch: true,
    showRowCount: true,
    showNewButton: false,
    showDownload: false,
    showSegmentButton: false,
  };


  constructor(
    private rolePermissionService: RolePermissionService,
    private commonService: CommonService,
    private toastService: ToastService,
    private dateFormatter: DateFormatterService,
  ) {
    this.odata = this.commonService.odata;
  }

  ngOnInit(): void {
    this.columns = this.buildColumns();
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    return [
      {
        field: 'custom_id',
        headerName: $localize`ID`,
        minWidth: 110,
        sort: 'desc',
      },
      {
        colId: 'shift_name',
        headerName: $localize`Shift`,
        minWidth: 130,
        valueGetter: (params: any) => params.data?.shift?.name ?? '',
      },
      {
        colId: 'absent_employee',
        headerName: $localize`Swap Employee Name`,
        minWidth: 180,
        valueGetter: (params: any) => {
          const d = params.data?.absentEmployee;
          return d ? `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim() : '';
        },
      },
      {
        colId: 'replacement_employee',
        headerName: $localize`Replacement Employee Name`,
        minWidth: 200,
        valueGetter: (params: any) => {
          const d = params.data?.replacementEmployee;
          return d ? `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim() : '';
        },
      },
      {
        field: 'date',
        headerName: $localize`Roster Date`,
        minWidth: 130,
        filter: false, floatingFilter: false,
      },
      {
        field: 'created_at',
        headerName: $localize`Action Date`,
        minWidth: 130,
        filter: false, floatingFilter: false,
        dataType: GridTableColumnDataType.Date,
        valueFormatter: ({ value }: any) =>
          value
            ? this.dateFormatter.formatDate(value, true, false, false, false, false)
            : '',
      },
      {
        field: 'type',
        headerName: $localize`Changed Type`,
        minWidth: 140,
      },
    ];
  }

  processData(event: any) {
    this.refreshTable.emit(event);
  }

  newOverRides() {
    this.shiftreplacementform.shiftOverride = new EmployeeShift();
    this.shiftreplacementform.open = true;
    this.shiftreplacementform.saveMode = saveMode.POST;
  }

  editShiftOverride(data: any) {
    this.shiftreplacementform.shiftOverride = new EmployeeShift().deserialize(
      data
    );
    this.shiftreplacementform.selectedShift = data;
    this.shiftreplacementform.open = true;
    this.shiftreplacementform.saveMode = saveMode.PUT;
    this.shiftreplacementform.populatedData();
  }
}
