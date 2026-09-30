import { Component, EventEmitter, Input, Output } from "@angular/core";
import { Localization } from "@shared/utilities/localization";
import { Employee } from "@shared/model/employee";
import { CommonService } from "@app/services/common-service/common.service";
import { saveMode } from "@shared/enums/saveMode";
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { AgGridBooleanCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component";

@Component({
  selector: "app-employee-group-form",
  templateUrl: "./employee-group-form.component.html",
  styleUrl: "./employee-group-form.component.scss",
})
export class EmployeeGroupFormComponent {
  @Input() open = false;
  @Output() openChange = new EventEmitter<boolean>();
  @Output() onSubmit = new EventEmitter<any[]>();
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  localization = Localization;
  headerTitle = `${this.localization.Employee}`;
  loading = false;
  public selectedGroupId: number | null = null;
  selectedEmployeeIds: number[] = [];
  EmployList = Employee;

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
      field: "employee_no",
      headerName: $localize`Employee Id`,
      minWidth: 130,
    },
    {
      colId: "full_name",
      headerName: $localize`Employee Name`,
      flex: 1,
      minWidth: 160,
      valueGetter: (p) =>
        `${p.data?.first_name ?? ""} ${p.data?.last_name ?? ""}`.trim(),
    },
    {
      field: "designation",
      headerName: $localize`Designation`,
      minWidth: 150,
    },
    {
      colId: "department.name",
      headerName: $localize`Department`,
      minWidth: 150,
      valueGetter: (p) => p.data?.department?.name ?? "",
    },
  ];

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: "odata",
    endpoint: "Employees",
    expand: "department",
    filter: "group_id eq null and is_active eq true",
    pageSize: 50,
    searchFields: ["employee_no", "first_name", "last_name"],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${this.localization.Employee}`,
    showSearch: true,
    showRowCount: true,
    showNewButton: false,
    showDownload: false,
  };

  constructor(private commonService: CommonService) {}

  onRowSelect(selectedRows: any[]) {
    this.selectedEmployeeIds = selectedRows.map((row) => row.id);
  }

  addEmployeeToGroup() {
    const payload = {
      group_id: this.selectedGroupId,
      employee_ids: this.selectedEmployeeIds || [],
    };

    this.commonService
      .post("employee/group-associate", payload, false)
      .subscribe({
        next: () => {
          this.refreshTable.emit();
          this.closeEmployeeDialog();
        },
        error: (error: any) => {
          console.error(error);
        },
      });
  }

  closeEmployeeDialog() {
    this.open = false;
    this.loading = false;
    this.openChange.emit(false);
  }
}
