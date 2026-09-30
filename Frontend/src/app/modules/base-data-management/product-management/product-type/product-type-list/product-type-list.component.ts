import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { ProductFormComponent } from '@app/modules/base-data-management/product-management/product-type/product-form/product-form.component';
import { ProductType } from '@app/shared/model/productType';
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
  selector: 'app-oparation-management-list',
  templateUrl: './product-type-list.component.html',
  styleUrl: './product-type-list.component.scss',
})
export class ProductTypeListComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<ProductType>;
  @ViewChild('productForm') productFormRef!: ProductFormComponent;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<string>();

  public permissions = Permissions;
  public saveMode: string = saveMode.POST;
  productType = new ProductType().deserialize({});
  gridId = 'base-data-product-type-list';
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<ProductType> = {
    type: 'odata',
    endpoint: 'ProductTypes',
    searchFields: ['name', 'custom_id'],
    pageSize: 40,
    scrollPagination: true,
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Item`} ${$localize`Type`}`,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(Permissions.BASE_DATA_ITEM_TYPE_CREATE),
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

  newProductType(): void {
    this.productType = new ProductType().deserialize({});
    this.productFormRef.open = true;
    this.saveMode = saveMode.POST;
  }

  editProductType(data: any): void {
    this.productType = new ProductType().deserialize(data);
    this.productFormRef.open = true;
    this.saveMode = saveMode.PUT;
  }

  deleteClick(data: any): void {
    this.IsDelete.emit(`ProductTypes/${data.id}`);
  }
}
