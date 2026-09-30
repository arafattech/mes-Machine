import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { CapacityFormComponent } from '@app/modules/base-data-management/capacity-management/capacity-form/capacity-form.component';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { Permissions } from '@app/shared/enums/permissions';
import { saveMode } from '@app/shared/enums/saveMode';
import { Capacity } from '@app/shared/model/capacity';
import { Localization } from '@app/shared/utilities/localization';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';

@Component({
  selector: 'app-capacity-list',
  templateUrl: './capacity-list.component.html',
  styleUrl: './capacity-list.component.scss',
})
export class CapacityListComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<Capacity>;
  @ViewChild('capacityForm') capacityFormRef!: CapacityFormComponent;

  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();

  public permissions = Permissions;
  public saveMode: string = saveMode.POST;
  Capacity = new Capacity().deserialize({});

  gridId = 'base-data-capacity-list';
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<Capacity> = {
    type: 'odata',
    endpoint: 'Capacities',
    searchFields: ['name', 'custom_id'],
    pageSize: 40,
    scrollPagination: true,
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Capacity`} ${$localize`List`}`,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(Permissions.BASE_DATA_CAPACITY_CREATE),
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
        headerName: `${$localize`Capacity`} ${$localize`Name`}`,
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

  newCapacity(): void {
    this.Capacity = new Capacity().deserialize({});
    this.capacityFormRef.open = true;
    this.saveMode = saveMode.POST;
  }

  editCapacity(data: any): void {
    this.Capacity = new Capacity().deserialize(data);
    this.capacityFormRef.open = true;
    this.saveMode = saveMode.PUT;
  }

  deleteClick(id: any): void {
    this.IsDelete.emit(`Capacities/${id}`);
  }
}
