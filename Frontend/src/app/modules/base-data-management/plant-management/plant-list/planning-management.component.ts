import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { PlantFormComponent } from '@app/modules/base-data-management/plant-management/plant-form/plant-form.component';
import { saveMode } from '@app/shared/enums/saveMode';
import { Plant } from '@app/shared/model/plant';
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
  selector: 'app-planning-management',
  templateUrl: './planning-management.component.html',
  styleUrl: './planning-management.component.scss',
})
export class PlanningManagementComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<Plant>;
  @ViewChild('plantForm') plantFormrtRef!: PlantFormComponent;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<string>();

  public permissions = Permissions;
  public saveMode: string = saveMode.POST;
  plant = new Plant().deserialize({});
  gridId = 'base-data-plant-list';
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<Plant> = {
    type: 'odata',
    endpoint: 'Plants',
    searchFields: ['name', 'custom_id'],
    pageSize: 40,
    scrollPagination: true,
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Plant`} ${$localize`List`}`,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(Permissions.BASE_DATA_PLANT_CREATE),
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
      { field: 'name', headerName: `${$localize`Plant`} ${$localize`Name`}`, minWidth: 180 },
      {
        field: 'created_at',
        headerName: Localization.CreatedAt,
        minWidth: 130,
        filter: false,
      },
    ];
  }

  processData(_event?: any): void {
    this.refreshTable.emit();
    this.agGridRef?.refreshGridData(true);
  }

  newPlant(): void {
    this.plant = new Plant().deserialize({});
    this.plantFormrtRef.open = true;
    this.saveMode = saveMode.POST;
  }

  editPlant(data: any): void {
    this.plant = new Plant().deserialize(data);
    this.plantFormrtRef.open = true;
    this.saveMode = saveMode.PUT;
  }

  deleteClick(id: string): void {
    this.IsDelete.emit(`Plants/${id}`);
  }
}
