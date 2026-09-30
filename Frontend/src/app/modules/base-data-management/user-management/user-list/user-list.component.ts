import {
  Component,
  EventEmitter,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { User } from '@shared/model/user';
import { saveMode } from '@shared/enums/saveMode';
import { UserFormComponent } from '@base-data-module/user-management/user-form/user-form.component';
import { Localization } from '@app/shared/utilities/localization';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
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
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss',
})
export class UserListComponent implements OnInit {
  @ViewChild('agGridRef') agGridRef!: AgGridTableComponent<User>;
  @ViewChild('userForm') userFormRef!: UserFormComponent;
  @Output() refreshTable = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<string>();

  Users = new User();
  columns: AgGridTableColumn<User>[] = [];
  public readonly localization = Localization;
  public readonly permissions = Permissions;
  public saveMode: string = saveMode.POST;

  dataSource: AgGridTableODataSourceConfig<User> = {
    type: 'api',
    endpoint: '',
    customEndpoint: 'users',
    expand: 'roles',
    sortBy: 'id',
    sortDirection: 'desc',
    pageSize: 40,
    scrollPagination: true,
    searchFields: ['custom_id', 'name', 'email', 'phone'],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`User List`,
    addButtonText: $localize`New`,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    showNewButton: this.rolePermissionService.hasPermission(
      Permissions.BASE_DATA_USER_CREATE,
    ),
  };

  actionButtons: AgGridCustomButton[] = [
    {
      id: 'edit',
      icon: 'edit',
      design: 'Transparent',
      tooltip: $localize`Edit`,
      hide: () =>
        !this.rolePermissionService.hasPermission(Permissions.BASE_DATA_USER_EDIT),
      onClick: (row: User) => this.editUser(row),
    },
    {
      id: 'delete',
      icon: 'delete',
      design: 'Negative',
      tooltip: $localize`Delete`,
      hide: () =>
        !this.rolePermissionService.hasPermission(Permissions.BASE_DATA_USER_DELETE),
      onClick: (row: User) => this.IsDelete.emit(`Users/${row.id}`),
    },
  ];

  constructor(public rolePermissionService: RolePermissionService) {
    this.columns = this.buildColumns();
  }

  ngOnInit(): void {}

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
        field: 'created_at',
        headerName: $localize`Created At`,
        minWidth: 130,
        filter: false,
      },
    ];
  }

  processData(_event?: any): void {
    this.refreshTable.emit();
    this.agGridRef?.refreshGridData(true);
  }

  newUser(): void {
    this.userFormRef.user = new User().deserialize({});
    this.userFormRef.open = true;
    this.saveMode = saveMode.POST;
  }

  editUser(data: User): void {
    this.userFormRef.user.deserialize(data);
    this.userFormRef.open = true;
    this.userFormRef.selectedTab = 'coreData';
    this.userFormRef.Roles = (data as any).roles ?? [];
    this.saveMode = saveMode.PUT;
  }
}
