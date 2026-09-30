import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { ItemSubCategory } from '@shared/model/itemSubCategory';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { SubCategoryFormComponent } from '@base-data-module/product-management/item-sub-category/sub-category-form/sub-category-form.component';
import { saveMode } from '@shared/enums/saveMode';
import { Localization } from '@shared/utilities/localization';
import { Permissions } from '@app/shared/enums/permissions';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';

@Component({
  selector: 'app-sub-category-list',
  templateUrl: './sub-category-list.component.html',
  styleUrl: './sub-category-list.component.scss',
})
export class SubCategoryListComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<ItemSubCategory>;
  @ViewChild('subCategoryForm') subCategoryFormRef!: SubCategoryFormComponent;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<string>();

  public permissions = Permissions;
  public saveMode: string = saveMode.POST;
  gridId = 'base-data-item-sub-category-list';
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<ItemSubCategory> = {
    type: 'odata',
    endpoint: 'ItemSubCategories',
    expand: 'category($select=id,name)',
    searchFields: ['name', 'custom_id', 'category.name'],
    pageSize: 40,
    scrollPagination: true,
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`SubCategory`} ${$localize`List`}`,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(
      Permissions.BASE_DATA_ITEM_SUBCATEGORY_CREATE,
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
      {
        field: 'category.name',
        headerName: Localization.Category,
        minWidth: 180,
        valueGetter: (params: any) => params.data?.category?.name ?? '',
      },
      {
        field: 'name',
        headerName: Localization.subCatagoryName,
        minWidth: 180,
      },
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

  newSubCategory(): void {
    this.subCategoryFormRef.open = true;
    this.saveMode = saveMode.POST;
    this.subCategoryFormRef.categoryTitle = '';
  }

  editSubCategory(data: any): void {
    this.subCategoryFormRef.itemSubCategory.deserialize(data);
    this.subCategoryFormRef.open = true;
    this.saveMode = saveMode.PUT;
    this.subCategoryFormRef.categoryTitle = data.category?.name ?? '';
  }

  deleteClick(id: string): void {
    this.IsDelete.emit(`ItemSubCategories/${id}`);
  }
}
