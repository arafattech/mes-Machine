import { Component, ViewChild } from '@angular/core';
import { User } from '@shared/model/user';
import { Localization } from '@app/shared/utilities/localization';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { Permissions } from '@app/shared/enums/permissions';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridCustomButton,
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';
import { AgGridBadgeListCellRendererComponent } from '@shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component';

@Component({
  selector: 'app-user-bin-list',
  templateUrl: './user-bin-list.component.html',
})
export class UserBinListComponent {
  @ViewChild('agGridRef') agGridRef!: AgGridTableComponent<User>;

  columns: AgGridTableColumn<User>[] = [];
  public readonly localization = Localization;
  public readonly permissions = Permissions;

  dataSource: AgGridTableODataSourceConfig<User> = {
    type: 'api',
    endpoint: '',
    customEndpoint: 'users/trashed',
    expand: 'roles',
    sortBy: 'deleted_at',
    sortDirection: 'desc',
    pageSize: 40,
    scrollPagination: true,
    searchFields: ['custom_id', 'name', 'email', 'phone'],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Recycle Bin`,
    showSearch: true,
    showRowCount: true,
    showNewButton: false,
  };

  actionButtons: AgGridCustomButton[] = [
    {
      id: 'restore',
      icon: 'undo',
      design: 'Emphasized',
      tooltip: $localize`Restore`,
      hide: () =>
        !this.rolePermissionService.hasPermission(Permissions.BASE_DATA_USER_RESTORE),
      onClick: (row: User) => this.restoreUser(row),
    },
  ];

  constructor(
    public rolePermissionService: RolePermissionService,
    private commonService: CommonService,
    private toastService: ToastService,
  ) {
    this.columns = this.buildColumns();
  }

  private buildColumns(): AgGridTableColumn<User>[] {
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
      {
        field: 'custom_id',
        headerName: $localize`ID`,
        minWidth: 100,
        width: 130,
      },
      {
        field: 'name',
        headerName: $localize`Name`,
        minWidth: 160,
      },
      {
        field: 'email',
        headerName: $localize`Email`,
        minWidth: 180,
      },
      {
        field: 'phone',
        headerName: $localize`Phone Number`,
        minWidth: 140,
      },
      {
        colId: 'roles',
        headerName: $localize`Roles`,
        minWidth: 160,
        filter: false,
        sortable: false,
        valueGetter: (params: any) => params.data?.roles ?? [],
        cellRenderer: AgGridBadgeListCellRendererComponent,
      },
      {
        field: 'deleted_at',
        headerName: $localize`Deleted At`,
        minWidth: 150,
        filter: false,
      },
    ];
  }

  restoreUser(row: User): void {
    this.commonService.post(`users/${row.id}/restore`, {}, false).subscribe({
      next: () => {
        this.toastService.show('edit', $localize`User restored successfully`);
        this.agGridRef?.refreshGridData(true);
      },
      error: (error: any) => {
        console.error('Error restoring user', error);
        this.toastService.show('error');
      },
    });
  }
}
