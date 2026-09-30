import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { ClientArea } from '@shared/model/clientArea';
import { ClientNote } from '@shared/model/clientNote';
import { saveMode } from '@shared/enums/saveMode';
import { Client } from '@shared/model/client';
import { ClientFormComponent } from '@base-data-module/client-management/client-form/client-form.component';
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
  selector: 'app-client-management',
  templateUrl: './client-management.component.html',
  styleUrl: './client-management.component.scss',
})
export class ClientManagementComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<Client>;
  @ViewChild('clientForm') clientFormRef!: ClientFormComponent;

  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<any>();

  public permissions = Permissions;
  public saveMode: string = saveMode.POST;
  client = new Client();

  gridId = 'base-data-client-list';
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<Client> = {
    type: 'odata',
    endpoint: 'Clients',
    expand: 'areas,notes',
    searchFields: ['name', 'custom_id'],
    pageSize: 40,
    scrollPagination: true,
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Client`} ${$localize`List`}`,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(Permissions.BASE_DATA_CLIENT_CREATE),
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
        headerName: `${$localize`Client`} ${$localize`Name`}`,
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

  newClient(): void {
    this.clientFormRef.client = new Client().deserialize({});
    this.clientFormRef.selectedTab = 'coreData';
    this.clientFormRef.open = true;
    this.clientFormRef.saveMode = saveMode.POST;
  }

  editClient(items: any): void {
    this.clientFormRef.client.deserialize(items);
    this.clientFormRef.selectedTab = 'coreData';
    this.clientFormRef.open = true;
    this.clientFormRef.saveMode = saveMode.PUT;

    const area = items.areas?.[0];
    this.clientFormRef.SelectedArea = new ClientArea().deserialize(area ?? {});
    this.clientFormRef.clientAreaName = area?.name ?? '';

    const note = items.notes?.[0];
    this.clientFormRef.SelectedNote = new ClientNote().deserialize(note ?? {});
    this.clientFormRef.clientNoteName = note?.name ?? '';

    this.clientFormRef.sameAsBillTo = items.ship_to === items.bill_to;
    this.clientFormRef.initializeAddMoreState(items);
  }

  deleteClick(id: any): void {
    this.IsDelete.emit(`Clients/${id}`);
  }
}
