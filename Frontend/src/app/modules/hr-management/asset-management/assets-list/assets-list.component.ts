import { Component, EventEmitter, Output, ViewChild } from "@angular/core";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import {
  AgGridCustomButton,
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { EmployeeHasAsset } from "@app/modules/hr-management/shared/models/employeeHasAsset";
import { Localization } from "@app/shared/utilities/localization";
import { Permissions } from "@app/shared/enums/permissions";
import { saveMode } from "@shared/enums/saveMode";
import { AssetFormComponent } from "@base-data-module/asset-management/asset-form/asset-form.component";

@Component({
  selector: "app-assets-list",
  templateUrl: "./assets-list.component.html",
  styleUrl: "./assets-list.component.scss",
})
export class AssetsListComponent {
  @ViewChild("assetTableRef") assetTableRef?: AgGridTableComponent<any>;
  @ViewChild("assetsForm") assetsFormRef!: AssetFormComponent;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();

  localization = Localization;
  permissions = Permissions;
  saveMode: string = saveMode.POST;

  isViewOpen = false;
  isListCollapsed = false;
  isTabCollapsed = false;
  selectedAsset: any = null;
  selectedEmployeeRow: any = null;
  employeeTableHeader = $localize`Employees`;
  EmployeeAssetsList: EmployeeHasAsset = new EmployeeHasAsset();

  assetDataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'Assets',
    expand: 'employeeHasAssets($expand=employee)',
    pageSize: 50,
    searchFields: ['name'],
  };

  assetToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Assets`} ${$localize`List`}`,
    showSearch: true,
    showRowCount: true,
    showNewButton: true,
    showDownload: false,
    showSegmentButton: false,
  };

  assetDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 55px)',
  };

  employeeDataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };

  get employeeToolbarConfig(): AgGridTableToolbarConfig {
    return {
      headerTitle: this.employeeTableHeader,
      showSearch: true,
      showRowCount: false,
      showNewButton: false,
      showDownload: false,
      showSegmentButton: false,
    };
  }

  employeeDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 55px)',
  };

  assetColumns: AgGridTableColumn<any>[] = [
    { field: 'name', headerName: $localize`Asset Name`, minWidth: 150 },
    {
      field: 'created_at',
      headerName: $localize`Created On`,
      minWidth: 130,
      filter: false,
      floatingFilter: false,
    },
  ];

  employeeColumns: AgGridTableColumn<any>[] = [
    { field: 'employee_no', headerName: $localize`Emp No`, minWidth: 110 },
    { field: 'name', headerName: $localize`Employee Name`, minWidth: 150 },
    { field: 'issued_date', headerName: $localize`Issue Date`, minWidth: 120 },
    { field: 'return_date', headerName: $localize`Return Date`, minWidth: 120 },
  ];

  employeeActionButtons: AgGridCustomButton[] = [
    {
      id: 'info',
      icon: 'information',
      design: 'Transparent',
      tooltip: $localize`View`,
      onClick: (row: any) => this.viewEmployeesList(row),
    },
  ];

  constructor(private rolePermissionService: RolePermissionService) {}

  onAssetRowClick(row: any): void {
    this.selectedAsset = row;
    const employees = (row.employeeHasAssets || []).map((item: any) => ({
      employee_no: item.employee?.employee_no ?? '',
      name: `${item.employee?.first_name || ''} ${item.employee?.last_name || ''}`.trim(),
      issued_date: item.issued_date ?? '',
      return_date: item.return_date ?? '',
      remarks: item.remarks ?? '',
      note: item.note ?? '',
    }));
    this.employeeTableHeader = `${$localize`Employees`} ${$localize`Using`} ${row.name} (${employees.length})`;
    this.employeeDataSource = { ...this.employeeDataSource, data: employees };
    this.isTabCollapsed = false;
  }

  onAssetDataLoaded(count: number): void {
    if (!count) return;
    setTimeout(() => {
      const api = this.assetTableRef?.getGridApi();
      const firstNode = api?.getDisplayedRowAtIndex(0);
      if (!firstNode?.data) return;
      firstNode.setSelected(true);
      this.onAssetRowClick(firstNode.data);
    }, 0);
  }

  viewEmployeesList(data: any): void {
    this.selectedEmployeeRow = data;
    this.EmployeeAssetsList = new EmployeeHasAsset().deserialize(data);
    this.isViewOpen = true;
  }

  CloseDialog(): void {
    this.isViewOpen = false;
  }

  onCLickListCollapsed(): void {
    this.isListCollapsed = !this.isListCollapsed;
  }

  onCLickTabCollapsed(): void {
    this.isTabCollapsed = !this.isTabCollapsed;
  }

  newAsset(): void {
    this.saveMode = saveMode.POST;
    this.assetsFormRef.open = true;
  }

  processData(_event?: any): void {
    this.refreshTable.emit();
    this.assetTableRef?.refreshGridData(true);
  }
}
