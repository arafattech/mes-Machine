import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { ItemCategory } from '@app/shared/model/itemCategory';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { CategoryFormComponent } from '@app/modules/base-data-management/product-management/item-category/category-form/category-form.component';
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

@Component({
  selector: 'app-item-category-list',
  templateUrl: './item-category-list.component.html',
  styleUrl: './item-category-list.component.scss',
})
export class ItemCategoryListComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<ItemCategory>;
  @ViewChild('categoryForm') categoryFormRef!: CategoryFormComponent;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<string>();

  public permissions = Permissions;
  public saveMode: string = saveMode.POST;
  itemCategory = new ItemCategory().deserialize({});
  gridId = 'base-data-item-category-list';
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<ItemCategory> = {
    type: 'odata',
    endpoint: 'ItemCategories',
    searchFields: ['name', 'custom_id', 'prefix'],
    pageSize: 40,
    scrollPagination: true,
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Item`} ${$localize`Category`}`,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(
      Permissions.BASE_DATA_ITEM_CATEGORY_CREATE,
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

  newCategory(): void {
    this.itemCategory = new ItemCategory().deserialize({});
    this.categoryFormRef.open = true;
    this.saveMode = saveMode.POST;
  }

  editCatogry(data: any): void {
    this.itemCategory = data;
    this.categoryFormRef.open = true;
    this.saveMode = saveMode.PUT;
  }

  deleteClick(id: string): void {
    this.IsDelete.emit(`ItemCategories/${id}`);
  }
}
