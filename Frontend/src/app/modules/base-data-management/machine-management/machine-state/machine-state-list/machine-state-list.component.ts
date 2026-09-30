import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { MachineState } from '@app/shared/model/machineState';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { MachineStateFormComponent } from '@app/modules/base-data-management/machine-management/machine-state/machine-state-form/machine-state-form.component';
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
import { AgGridIconCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component';
import { MachineStatesService } from '@app/modules/production-management/shared/services/machine-states.service';

@Component({
  selector: 'app-machine-state-list',
  templateUrl: './machine-state-list.component.html',
  styleUrl: './machine-state-list.component.scss',
})
export class MachineStateListComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<MachineState>;
  @ViewChild('machineStateForm')
  machineStateFormRef!: MachineStateFormComponent;

  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();

  public permissions = Permissions;
  public saveMode: string = saveMode.POST;
  MachineState = new MachineState().deserialize({});

  gridId = 'base-data-machine-state-list';
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<MachineState> = {
    type: 'odata',
    endpoint: 'MachineStates',
    searchFields: ['name', 'custom_id'],
    pageSize: 40,
    scrollPagination: true,
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Machine`} ${$localize`State`}`,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(
      Permissions.BASE_DATA_MACHINE_STATE_CREATE,
    ),
  };

  constructor(
    public rolePermissionService: RolePermissionService,
    private machineStatesService: MachineStatesService,
  ) {
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
        isSelected: false,
      },
      {
        field: 'icon',
        headerName: $localize`Icon`,
        cellRenderer: AgGridIconCellRendererComponent,
        minWidth: 70,
        width: 80,
        filter: false,
        sortable: false,
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
    // Create/edit/delete on a machine_states row — invalidate the app-wide cached
    // signal so already-running consumers (board tiles, status cards) pick up the new
    // color/icon/name immediately instead of showing whatever was cached at app start.
    this.machineStatesService.refresh().subscribe();
  }

  newMachineState(): void {
    this.MachineState = new MachineState().deserialize({});
    this.machineStateFormRef.open = true;
    this.saveMode = saveMode.POST;
  }

  editMachineState(data: any): void {
    this.MachineState = new MachineState().deserialize(data);
    this.machineStateFormRef.open = true;
    this.saveMode = saveMode.PUT;
  }

  deleteClick(id: any): void {
    this.IsDelete.emit(`MachineStates/${id}`);
  }
}
