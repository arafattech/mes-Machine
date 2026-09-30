import {
  Component,
  EventEmitter,
  Output,
  ViewChild,
} from '@angular/core';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { UomFormComponent } from '@base-data-module/product-management/uom/uom-form/uom-form.component';
import { saveMode } from '@shared/enums/saveMode';
import { Uom } from '@shared/model/uom';
import { Permissions } from '@app/shared/enums/permissions';
import {
  AgGridTableComponent,
} from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';

@Component({
  selector: 'app-uom-list',
  templateUrl: './uom-list.component.html',
  styleUrl: './uom-list.component.scss',
})
export class UomListComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<Uom>;
  @ViewChild('uomForm') uomFormRef!: UomFormComponent;

  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<any>();

  uom = new Uom().deserialize({});
  public saveMode: string = saveMode.POST;
  public permissions = Permissions;

  gridId = 'base-data-uom-list';
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<Uom> = {
    type: 'odata',
    endpoint: 'Uoms',
    searchFields: ['name', 'custom_id'],
    pageSize: 40,
    scrollPagination: true,
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: 'UOM List',
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: 'New',
    showNewButton: this.rolePermissionService.hasPermission(Permissions.BASE_DATA_UOM_CREATE),
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
        headerName: $localize`Name`,
        minWidth: 180,
      },
      {
        field: 'created_at',
        headerName: $localize`Created On`,
        minWidth: 130,
        filter: false,
        floatingFilter: false,
      },
    ];
  }

  processData(event: any): void {
    this.refreshTable.emit(event);
    this.agGridRef?.refreshGridData(true);
  }

  newUom(): void {
    this.uom = new Uom().deserialize({});
    this.uomFormRef.open = true;
    this.saveMode = saveMode.POST;
  }

  editUom(data: any): void {
    this.uom = new Uom().deserialize(data);
    this.uomFormRef.open = true;
    this.saveMode = saveMode.PUT;
  }

  deleteClick(id: any): void {
    this.IsDelete.emit(`Uoms/${id}`);
  }
}
