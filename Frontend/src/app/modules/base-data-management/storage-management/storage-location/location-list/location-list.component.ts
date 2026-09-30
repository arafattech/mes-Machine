import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { StorageLocation } from '@app/shared/model/storage_location';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { StorageLocationFormComponent } from '@app/modules/base-data-management/storage-management/storage-location/storage-location-form/storage-location-form.component';
import { saveMode } from '@app/shared/enums/saveMode';
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
  selector: 'app-location-list',
  templateUrl: './location-list.component.html',
  styleUrl: './location-list.component.scss',
})
export class LocationListComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<StorageLocation>;
  @ViewChild('storageLocationForm') storageLocationFormRef!: StorageLocationFormComponent;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<string>();

  public Permissions = Permissions;
  public saveMode: string = saveMode.POST;
  gridId = 'base-data-storage-location-list';
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<StorageLocation> = {
    type: 'odata',
    endpoint: 'StorageLocations',
    searchFields: ['name', 'custom_id'],
    pageSize: 40,
    scrollPagination: true,
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Location`} ${$localize`List`}`,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(Permissions.BASE_DATA_STORAGE_LOCATION_CREATE),
  };


  constructor(public rolePermissionService: RolePermissionService) {
    this.columns = this.buildColumns();
  }

  buildColumns(): AgGridTableColumn<any>[] {
    return [
      {
        field: 'is_active',
        headerName: $localize`Active`,
        minWidth: 80,
        width: 90,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
      },
      { field: 'custom_id', headerName: $localize`ID`, minWidth: 100 },
      { field: 'name', headerName: `${$localize`Location`} ${$localize`Name`}`, minWidth: 180 },
      {
        field: 'created_at',
        headerName: Localization.CreatedAt,
        minWidth: 130,
        filter: false,
      },
    ];
  }

  newLocation(): void {
    this.storageLocationFormRef.open = true;
    this.storageLocationFormRef.saveMode = saveMode.POST;
  }

  editLocation(data: any): void {
    this.storageLocationFormRef.open = true;
    this.storageLocationFormRef.storageLocation = data;
    this.storageLocationFormRef.saveMode = saveMode.PUT;
  }

  deleteClick(id: string): void {
    this.IsDelete.emit(`StorageLocations/${id}`);
  }

  processData(_event?: any): void {
    this.agGridRef?.refreshGridData(true);
  }
}
