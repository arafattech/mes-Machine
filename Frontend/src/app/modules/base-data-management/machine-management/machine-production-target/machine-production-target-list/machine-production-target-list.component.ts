import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { MachineProductionTarget } from '@shared/model/machineProductionTarget';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { MachineProductionTargetFormComponent } from '@base-data-module/machine-management/machine-production-target/machine-production-target-form/machine-production-target-form.component';
import { saveMode } from '@shared/enums/saveMode';
import { Localization } from '@app/shared/utilities/localization';
import { formatFactoryDate } from '@shared/utilities/date-format';
import { Permissions } from '@app/shared/enums/permissions';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  GridTableColumnDataType,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';

@Component({
  selector: 'app-machine-production-target-list',
  templateUrl: './machine-production-target-list.component.html',
})
export class MachineProductionTargetListComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<MachineProductionTarget>;
  @ViewChild('machineProductionTargetForm') machineProductionTargetFormRef!: MachineProductionTargetFormComponent;

  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();

  public permissions = Permissions;
  public saveMode: string = saveMode.POST;
  machineProductionTarget: MachineProductionTarget = new MachineProductionTarget().deserialize({});

  gridId = 'base-data-machine-production-target-list';

  dataSource: AgGridTableODataSourceConfig<MachineProductionTarget> = {
    type: 'odata',
    endpoint: 'MachineProductionTargets',
    expand: 'machine,workOrder,shift',
    pageSize: 40,
    scrollPagination: true,
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Machine`} ${$localize`Production Target`}`,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(Permissions.BASE_DATA_MACHINE_PRODUCTION_TARGET_CREATE),
  };

  readonly columns: AgGridTableColumn<any>[] = [
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
      colId: 'machine.machine_name',
      headerName: $localize`Machine`,
      minWidth: 160,
      flex: 1,
      filter: false,
      sortable: false,
      valueGetter: (p) => p.data?.machine?.machine_name ?? '',
    },
    {
      colId: 'work_order.custom_id',
      headerName: $localize`Production Order`,
      minWidth: 140,
      filter: false,
      sortable: false,
      valueGetter: (p) => p.data?.work_order?.custom_id ?? '',
    },
    {
      colId: 'shift.name',
      headerName: $localize`Shift`,
      minWidth: 120,
      filter: false,
      sortable: false,
      valueGetter: (p) => p.data?.shift?.name ?? '',
    },
    {
      field: 'target_qty',
      headerName: $localize`Target Qty`,
      minWidth: 120,
      filter: false,
      sortable: false,
      dataType: GridTableColumnDataType.Number,
    },
    {
      field: 'effective_from',
      headerName: $localize`Effective From`,
      minWidth: 140,
      filter: false,
      sortable: false,
      dataType: GridTableColumnDataType.Date,
    },
    {
      field: 'effective_to',
      headerName: $localize`Effective To`,
      minWidth: 140,
      filter: false,
      sortable: false,
      dataType: GridTableColumnDataType.Date,
    },
    {
      field: 'created_at',
      headerName: Localization.CreatedAt,
      minWidth: 130,
      filter: false,
      floatingFilter: false,
      sortable: false,
      valueFormatter: ({ value }: any) => formatFactoryDate(value),
    },
  ];

  constructor(public rolePermissionService: RolePermissionService) {}

  processData(_event?: any): void {
    this.refreshTable.emit();
    this.agGridRef?.refreshGridData(true);
  }

  newProductionTarget(): void {
    this.machineProductionTarget = new MachineProductionTarget().deserialize({});
    this.machineProductionTargetFormRef.open = true;
    this.saveMode = saveMode.POST;
  }

  editProductionTarget(data: any): void {
    this.machineProductionTarget = new MachineProductionTarget().deserialize(data);
    this.machineProductionTargetFormRef.open = true;
    this.saveMode = saveMode.PUT;
  }

  deleteClick(id: any): void {
    this.IsDelete.emit(`MachineProductionTargets/${id}`);
  }
}
