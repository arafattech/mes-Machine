import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { Operation } from '@shared/model/operation';
import { OperationManagementFormComponent } from '@base-data-module/oparation-management/operation-management-form/operation-management-form.component';
import { saveMode } from '@shared/enums/saveMode';
import { Permissions } from '@app/shared/enums/permissions';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableRowAction,
  AgGridTableToolbarConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';
import { AgGridActionCellRendererComponent } from '@shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component';

@Component({
  selector: 'app-oparation-management-list',
  templateUrl: './oparation-management-list.component.html',
  styleUrl: './oparation-management-list.component.scss',
})
export class OparationManagementListComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<Operation>;
  @ViewChild('operationForm')
  operationFormRef!: OperationManagementFormComponent;

  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<any>();

  public permissions = Permissions;

  gridId = 'base-data-operation-list';
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<Operation> = {
    type: 'odata',
    endpoint: 'Operations',
    expand: 'products',
    searchFields: ['operation_name', 'custom_id', 'products.product_name'],
    pageSize: 40,
    scrollPagination: true,
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: 'Operations List',
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: 'New',
    showNewButton: this.rolePermissionService.hasPermission(
      Permissions.BASE_DATA_OPERATION_CREATE,
    ),
  };


  constructor(
    private router: Router,
    public rolePermissionService: RolePermissionService,
  ) {
    this.columns = this.buildColumns();
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    const canEdit = this.rolePermissionService.hasPermission(
      Permissions.BASE_DATA_OPERATION_EDIT,
    );
    const canDelete = this.rolePermissionService.hasPermission(
      Permissions.BASE_DATA_OPERATION_DELETE,
    );
    const canInfo = this.rolePermissionService.hasPermission(
      Permissions.BASE_DATA_OPERATION_INFO,
    );

    const rowActions: AgGridTableRowAction<any>[] = [];
    if (canEdit) {
      rowActions.push({
        id: 'edit',
        label: '',
        icon: 'edit',
        tooltip: $localize`Edit`,
      });
    }
    if (canDelete) {
      rowActions.push({
        id: 'delete',
        label: '',
        icon: 'delete',
        tooltip: $localize`Delete`,
        design: 'Negative',
      });
    }
    if (canInfo) {
      rowActions.push({
        id: 'info',
        label: '',
        icon: 'information',
        tooltip: $localize`Info`,
      });
    }

    const cols: AgGridTableColumn<any>[] = [
      {
        field: 'is_active',
        headerName: $localize`Active`,
        minWidth: 80,
        width: 90,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
      },
      {
        field: 'custom_id',
        headerName: $localize`ID`,
        minWidth: 100,
        width: 110,
      },
      {
        field: 'operation_name',
        headerName: `${$localize`Operations`} ${$localize`Name`}`,
        minWidth: 180,
      },
      {
        field: 'standard_cycle_time',
        headerName: `${$localize`Cycle`} ${$localize`Time`}`,
        minWidth: 130,
        hide: true,
      },
      {
        field: 'products.product_name',
        headerName: `${$localize`Item`} ${$localize`Name`}`,
        minWidth: 180,
        sortable: false,
        valueGetter: (params: any) => params.data?.products?.product_name ?? '',
      },
      {
        field: 'created_at',
        headerName: $localize`Created On`,
        minWidth: 130,
        filter: false,
      },
    ];

    if (rowActions.length > 0) {
      cols.push({
        field: 'actions',
        headerName: $localize`Actions`,
        width: 160,
        minWidth: 160,
        pinned: 'right',
        lockPinned: true,
        sortable: false,
        filter: false,
        editable: false,
        cellRenderer: AgGridActionCellRendererComponent,
        cellRendererParams: {
          actions: rowActions,
          onAction: (actionId: string, row: any) => {
            switch (actionId) {
              case 'edit':
                this.editOperation(row);
                break;
              case 'delete':
                this.IsDelete.emit(`Operations/${row.id}`);
                break;
              case 'info':
                this.navigateToInfo(row);
                break;
            }
          },
        },
      });
    }

    return cols;
  }

  newOperation(): void {
    this.operationFormRef.operations.deserialize({});
    this.operationFormRef.open = true;
    this.operationFormRef.saveMode = saveMode.POST;
    this.operationFormRef.productTitle = '';
  }

  editOperation(data: any): void {
    this.operationFormRef.operations.deserialize(data);
    this.operationFormRef.productTitle = data.products?.product_name ?? '';
    this.operationFormRef.open = true;
    this.operationFormRef.saveMode = saveMode.PUT;
  }

  navigateToInfo(data: any): void {
    this.router.navigate([`/base-data/operation-info/${data.id}`]);
  }

  processData(event: any): void {
    this.refreshTable.emit(event);
    this.agGridRef?.refreshGridData(true);
  }
}
