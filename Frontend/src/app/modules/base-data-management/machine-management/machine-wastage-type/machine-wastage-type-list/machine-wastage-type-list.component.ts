import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { MachineWastageType } from '@app/shared/model/machineWastageType';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { MachineWastageTypeFormComponent } from '@app/modules/base-data-management/machine-management/machine-wastage-type/machine-wastage-type-form/machine-wastage-type-form.component';
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
  selector: 'app-machine-wastage-type-list',
  templateUrl: './machine-wastage-type-list.component.html',
  styleUrl: './machine-wastage-type-list.component.scss',
})
export class MachineWastageTypeListComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<MachineWastageType>;
  @ViewChild('machineWastageTypeForm') machineWastageTypeFormRef!: MachineWastageTypeFormComponent;

  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();

  public permissions = Permissions;
  public saveMode: string = saveMode.POST;
  machineWastageType: MachineWastageType = new MachineWastageType().deserialize({});

  gridId = 'base-data-machine-wastage-type-list';
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<MachineWastageType> = {
    type: 'odata',
    endpoint: 'MachineWastageTypes',
    searchFields: ['name', 'custom_id'],
    pageSize: 40,
    scrollPagination: true,
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Machine`} ${$localize`Wastage Type`}`,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(Permissions.BASE_DATA_MACHINE_WASTAGE_TYPE_CREATE),
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
        headerName: `${$localize`Wastage Type`} ${$localize`Name`}`,
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

  newMachineWastageType(): void {
    this.machineWastageType = new MachineWastageType().deserialize({});
    this.machineWastageTypeFormRef.open = true;
    this.saveMode = saveMode.POST;
  }

  editMachineWastageType(data: any): void {
    this.machineWastageType = new MachineWastageType().deserialize(data);
    this.machineWastageTypeFormRef.open = true;
    this.saveMode = saveMode.PUT;
  }

  deleteClick(id: any): void {
    this.IsDelete.emit(`MachineWastageTypes/${id}`);
  }
}
