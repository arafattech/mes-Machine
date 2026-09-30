import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { Variant } from '@shared/model/variant';
import { VariantFormComponent } from '@base-data-module/product-management/variant/variant-form/variant-form.component';
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
  selector: 'app-variant',
  templateUrl: './variant.component.html',
  styleUrl: './variant.component.scss',
})
export class VariantComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<Variant>;
  @ViewChild('variantForm') variantFormRef!: VariantFormComponent;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<string>();

  public permissions = Permissions;
  public saveMode: string = saveMode.POST;
  variant = new Variant();
  gridId = 'base-data-variant-list';
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<Variant> = {
    type: 'odata',
    endpoint: 'Variants',
    searchFields: ['name', 'custom_id'],
    pageSize: 40,
    scrollPagination: true,
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: Localization.Variant,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: $localize`New`,
    showNewButton: true,
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

  newVariant(): void {
    this.variant = new Variant().deserialize({});
    this.variantFormRef.open = true;
    this.variantFormRef.saveMode = saveMode.POST;
  }

  editVariant(data: any): void {
    this.variantFormRef.open = true;
    this.variantFormRef.variant = data;
    this.variantFormRef.saveMode = saveMode.PUT;
  }

  deleteClick(id: string): void {
    this.IsDelete.emit(`Variants/${id}`);
  }
}
