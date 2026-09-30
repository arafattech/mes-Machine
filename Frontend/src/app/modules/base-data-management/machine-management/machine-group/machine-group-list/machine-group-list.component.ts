import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { MachineGroup } from '@app/shared/model/machineGroup';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { MachineGroupFormComponent } from '@app/modules/base-data-management/machine-management/machine-group/machine-group-form/machine-group-form.component';
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
  selector: 'app-machine-group-list',
  templateUrl: './machine-group-list.component.html',
  styleUrl: './machine-group-list.component.scss',
})
export class MachineGroupListComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<MachineGroup>;
  @ViewChild('machineGroupForm') machineGroupFormRef!: MachineGroupFormComponent;

  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();

  public permissions = Permissions;
  public saveMode: string = saveMode.POST;
  machineGroup: MachineGroup = new MachineGroup().deserialize({});

  gridId = 'base-data-machine-group-list';
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<MachineGroup> = {
    type: 'odata',
    endpoint: 'MachineGroups',
    searchFields: ['name', 'custom_id'],
    pageSize: 40,
    scrollPagination: true,
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Machine`} ${$localize`Group`}`,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: $localize`New`,
    showNewButton: true,
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
        headerName: `${$localize`Group`} ${$localize`Name`}`,
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

  newMachineGroup(): void {
    this.machineGroup = new MachineGroup().deserialize({});
    this.machineGroupFormRef.open = true;
    this.saveMode = saveMode.POST;
  }

  editMachineGroup(data: any): void {
    this.machineGroup = new MachineGroup().deserialize(data);
    this.machineGroupFormRef.open = true;
    this.saveMode = saveMode.PUT;
  }

  deleteClick(id: any): void {
    this.IsDelete.emit(`MachineGroups/${id}`);
  }
}
