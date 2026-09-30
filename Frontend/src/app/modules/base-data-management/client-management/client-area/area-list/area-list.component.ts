import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { ClientAreaFormComponent } from '@base-data-module/client-management/client-area/client-area-form/client-area-form.component';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { Permissions } from '@app/shared/enums/permissions';
import { saveMode } from '@shared/enums/saveMode';
import { ClientArea } from '@app/shared/model/clientArea';
import { Localization } from '@app/shared/utilities/localization';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';

@Component({
  selector: 'app-area-list',
  templateUrl: './area-list.component.html',
  styleUrl: './area-list.component.scss',
})
export class AreaListComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<ClientArea>;
  @ViewChild('clientAreaForm') clientAreaFormRef!: ClientAreaFormComponent;

  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();
  @Output() IsSuccessChanges: EventEmitter<void> = new EventEmitter<void>();

  public permissions = Permissions;
  public saveMode: string = saveMode.POST;
  clientArea: ClientArea = new ClientArea().deserialize({});

  gridId = 'base-data-client-area-list';
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<ClientArea> = {
    type: 'odata',
    endpoint: 'ClientAreas',
    searchFields: ['name', 'custom_id'],
    pageSize: 40,
    scrollPagination: true,
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Client`} ${$localize`Area`}`,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(Permissions.BASE_DATA_CLIENT_AREA_CREATE),
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
        minWidth: 100,
      },
      {
        field: 'name',
        headerName: `${$localize`Area`} ${$localize`Name`}`,
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
    this.IsSuccessChanges.emit();
    this.agGridRef?.refreshGridData(true);
  }

  newClientArea(): void {
    this.clientArea = new ClientArea().deserialize({});
    this.clientAreaFormRef.open = true;
    this.saveMode = saveMode.POST;
  }

  editClientArea(data: any): void {
    this.clientArea = new ClientArea().deserialize(data);
    this.clientAreaFormRef.open = true;
    this.saveMode = saveMode.PUT;
  }

  deleteClick(id: any): void {
    this.IsDelete.emit(`ClientAreas/${id}`);
  }
}
