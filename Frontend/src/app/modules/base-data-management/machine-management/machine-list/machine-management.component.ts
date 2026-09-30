import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { Machine } from '@shared/model/machine';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { saveMode } from '@shared/enums/saveMode';
import { MachineFormComponent } from '@base-data-module/machine-management/machine-form/machine-form.component';
import { Localization } from '@app/shared/utilities/localization';
import { Permissions } from '@app/shared/enums/permissions';
import { MachineGroup } from '@shared/model/machineGroup';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';

@Component({
  selector: 'app-machine-management',
  templateUrl: './machine-management.component.html',
  styleUrl: './machine-management.component.scss',
})
export class MachineManagementComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<Machine>;
  @ViewChild('machineForm') machineFormRef!: MachineFormComponent;

  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();

  public permissions = Permissions;
  isLoading = false;
  public isListCollapsed = false;
  public isTabCollapsed = true;
  public showPanelToggleIcons = false;

  gridId = 'base-data-machine-list';
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<Machine> = {
    type: 'odata',
    endpoint: 'Machines',
    expand: 'states,machinegroups,machinehalls,machinewastagetypes',
    searchFields: ['machine_name', 'custom_id'],
    pageSize: 40,
    scrollPagination: true,
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Machine`} ${$localize`List`}`,
    showSearch: true,
    showScanner: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(Permissions.BASE_DATA_MACHINE_CREATE),
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
        field: 'machine_name',
        headerName: `${$localize`Machine`} ${$localize`Name`}`,
        minWidth: 180,
      },
      {
        field: 'oee',
        headerName: $localize`OEE`,
        minWidth: 100,
        filter: 'agNumberColumnFilter',
        type: 'numericColumn',
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

  newMachine(): void {
    this.isTabCollapsed = false;
    this.showPanelToggleIcons = true;
    this.machineFormRef.resetForm();
    this.machineFormRef.machine = new Machine().deserialize({});
    this.machineFormRef.saveMode = saveMode.POST;
    this.machineFormRef.open = true;
  }

  editMachine(data: any): void {
    this.isTabCollapsed = false;
    this.showPanelToggleIcons = true;
    this.machineFormRef.resetForm();
    this.machineFormRef.machine = new Machine().deserialize(data);
    this.machineFormRef.saveMode = saveMode.PUT;
    this.machineFormRef.SelectedGroup = new MachineGroup().deserialize(
      data.machinegroups?.[0] ?? {},
    );
    this.machineFormRef.machineTitleGroup = data.machinegroups?.[0]?.name ?? '';
    this.machineFormRef.setMachineHall(data.machinehalls ?? []);
    this.machineFormRef.setMachineState(data.states ?? []);
    this.machineFormRef.setMachineWastageType(data.machinewastagetypes ?? []);
    this.machineFormRef.LoadMachineGroup();
    this.machineFormRef.open = true;
  }

  handleRowSelect(row: any): void {
    this.editMachine(row);
  }

  deleteClick(id: any): void {
    this.IsDelete.emit(`Machines(${id})`);
  }

  onCLickTabCollapsed(): void {
    this.isTabCollapsed = !this.isTabCollapsed;
  }

  onCLickListCollapsed(): void {
    this.isListCollapsed = !this.isListCollapsed;
  }

  cancelEdit(): void {
    this.isTabCollapsed = true;
    this.showPanelToggleIcons = false;
  }
}
