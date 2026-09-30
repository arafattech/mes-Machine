import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { Asset } from '@app/shared/model/asset';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { saveMode } from '@shared/enums/saveMode';
import { AssetFormComponent } from '@app/modules/base-data-management/asset-management/asset-form/asset-form.component';
import { Localization } from '@app/shared/utilities/localization';
import { Permissions } from '@app/shared/enums/permissions';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';

@Component({
  selector: 'app-asset-list',
  templateUrl: './asset-list.component.html',
  styleUrl: './asset-list.component.scss',
})
export class AssetListComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<Asset>;
  @ViewChild('assetsForm') assetsFormRef!: AssetFormComponent;

  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();

  public permissions = Permissions;
  public saveMode: string = saveMode.POST;

  gridId = 'base-data-asset-list';
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<Asset> = {
    type: 'odata',
    endpoint: 'Assets',
    expand: 'employeeHasAssets($expand=employee)',
    searchFields: ['name', 'custom_id'],
    pageSize: 40,
    scrollPagination: true,
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Assets`} ${$localize`List`}`,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(Permissions.BASE_DATA_ASSET_CREATE),
  };

  constructor(public rolePermissionService: RolePermissionService) {
    this.columns = this.buildColumns();
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    return [
      {
        field: 'is_active',
        headerName: $localize`Active`,
        minWidth: 80,
        width: 90,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
        floatingFilter: false,
      },
      {
        field: 'custom_id',
        headerName: $localize`ID`,
        minWidth: 110,
      },
      {
        field: 'name',
        headerName: $localize`Asset Name`,
        minWidth: 180,
      },
      {
        field: 'created_at',
        headerName: Localization.CreatedAt,
        minWidth: 130,
        filter: false,
        floatingFilter: false,
      },
    ];
  }

  processData(_event?: any): void {
    this.refreshTable.emit();
    this.agGridRef?.refreshGridData(true);
  }

  newAsset(): void {
    this.assetsFormRef.open = true;
    this.saveMode = saveMode.POST;
  }

  editAsset(data: any): void {
    this.saveMode = saveMode.PUT;
    this.assetsFormRef.asset = data;
    this.assetsFormRef.open = true;
  }

  deleteClick(id: any): void {
    this.IsDelete.emit(`Assets/${id}`);
  }
}
