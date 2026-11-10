import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { CountType } from '@app/shared/model/countType';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { CountTypeFormComponent } from '@app/modules/base-data-management/count-type-management/count-type-form/count-type-form.component';
import { saveMode } from '@app/shared/enums/saveMode';
import { Localization } from '@app/shared/utilities/localization';
import { Permissions } from '@app/shared/enums/permissions';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';

@Component({
  selector: 'app-count-type-list',
  templateUrl: './count-type-list.component.html',
  styleUrl: './count-type-list.component.scss',
})
export class CountTypeListComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<CountType>;
  @ViewChild('countTypeForm') countTypeFormRef!: CountTypeFormComponent;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<string>();

  public permissions = Permissions;
  public saveMode: string = saveMode.POST;
  countType = new CountType().deserialize({});
  gridId = 'base-data-count-type-list';
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<CountType> = {
    type: 'odata',
    endpoint: 'CountTypes',
    searchFields: ['name', 'custom_id', 'prefix'],
    pageSize: 40,
    scrollPagination: true,
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Count`} ${$localize`Type`}`,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(
      Permissions.BASE_DATA_COUNT_TYPE_CREATE,
    ),
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
        floatingFilter: false,
      },
      { field: 'custom_id', headerName: $localize`ID`, minWidth: 100 },
      { field: 'name', headerName: $localize`Name`, minWidth: 180 },
      { field: 'prefix', headerName: $localize`Prefix`, minWidth: 120 },
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

  newCountType(): void {
    this.countType = new CountType().deserialize({});
    this.countTypeFormRef.open = true;
    this.saveMode = saveMode.POST;
  }

  editCountType(data: any): void {
    this.countType = data;
    this.countTypeFormRef.open = true;
    this.saveMode = saveMode.PUT;
  }

  deleteClick(id: string): void {
    this.IsDelete.emit(`CountTypes/${id}`);
  }
}
