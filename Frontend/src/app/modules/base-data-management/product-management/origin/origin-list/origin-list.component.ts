import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import { AgGridTableColumn, AgGridTableODataSourceConfig, AgGridTableToolbarConfig } from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { Permissions } from '@app/shared/enums/permissions';
import { saveMode } from '@shared/enums/saveMode';
import { Origin } from '@shared/model/origin';
import { OriginFormComponent } from '../origin-form/origin-form.component';

@Component({
  selector: 'app-origin-list',
  templateUrl: './origin-list.component.html',
})
export class OriginListComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<Origin>;
  @ViewChild('originForm') originFormRef!: OriginFormComponent;
  @Output() IsDelete = new EventEmitter<any>();

  origin = new Origin().deserialize({});
  saveMode = saveMode.POST;
  permissions = Permissions;
  gridId = 'base-data-origin-list';
  columns: AgGridTableColumn<any>[] = [
    { field: 'is_active', headerName: $localize`Active`, minWidth: 80, width: 90, cellRenderer: AgGridBooleanCellRendererComponent, filter: false, sortable: false, floatingFilter: false },
    { field: 'custom_id', headerName: $localize`ID`, minWidth: 110 },
    { field: 'name', headerName: $localize`Name`, minWidth: 180 },
    { field: 'created_at', headerName: $localize`Created On`, minWidth: 130, filter: false, floatingFilter: false },
  ];
  dataSource: AgGridTableODataSourceConfig<Origin> = { type: 'odata', endpoint: 'Origins', searchFields: ['name', 'custom_id'], pageSize: 40, scrollPagination: true };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Origin List`, showSearch: true, showRowCount: true, showSegmentButton: true, addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(Permissions.BASE_DATA_ORIGIN_CREATE),
  };

  constructor(public rolePermissionService: RolePermissionService) {}

  processData(): void { this.agGridRef?.refreshGridData(true); }
  newOrigin(): void { this.origin = new Origin().deserialize({}); this.saveMode = saveMode.POST; this.originFormRef.open = true; }
  editOrigin(data: any): void { this.origin = new Origin().deserialize(data); this.saveMode = saveMode.PUT; this.originFormRef.open = true; }
  deleteClick(id: any): void { this.IsDelete.emit(`Origins/${id}`); }
}
