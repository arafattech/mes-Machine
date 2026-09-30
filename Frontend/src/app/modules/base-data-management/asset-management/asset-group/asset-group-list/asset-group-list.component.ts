import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { AssetGroup } from '@app/shared/model/assetGroup';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { AssetGroupFormComponent } from '@base-data-module/asset-management/asset-group/asset-group-form/asset-group-form.component';
import { saveMode } from '@shared/enums/saveMode';
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
  selector: 'app-asset-group-list',
  templateUrl: './asset-group-list.component.html',
  styleUrl: './asset-group-list.component.scss',
})
export class AssetGroupListComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<AssetGroup>;
  @ViewChild('assetsGroupForm') assetsFormRef!: AssetGroupFormComponent;

  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();

  public permissions = Permissions;
  public saveMode: string = saveMode.POST;

  gridId = 'base-data-asset-group-list';
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<AssetGroup> = {
    type: 'odata',
    endpoint: 'AssetGroups',
    searchFields: ['name', 'custom_id'],
    pageSize: 40,
    scrollPagination: true,
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Assets`} ${$localize`Group`} ${$localize`List`}`,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(Permissions.BASE_DATA_ASSET_GROUP_CREATE),
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
        headerName: $localize`Name`,
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

  newAssetGroup(): void {
    this.assetsFormRef.open = true;
    this.saveMode = saveMode.POST;
  }

  editAssetGroup(data: any): void {
    this.assetsFormRef.open = true;
    this.assetsFormRef.assetGroup.deserialize(data);
    this.saveMode = saveMode.PUT;
  }

  deleteClick(id: any): void {
    this.IsDelete.emit(`AssetGroups/${id}`);
  }
}
