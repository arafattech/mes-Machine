import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { Department } from '@app/shared/model/department';
import { Localization } from '@app/shared/utilities/localization';
import { saveMode } from '@app/shared/enums/saveMode';
import { CommonService } from '@app/services/common-service/common.service';
import { ValueState } from '@shared/utilities/value-state-wrapper';
import { ToastService } from '@app/services/toast-service/toast.service';
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
import { SocketService } from '@app/services/socket.service';
import { AuthService } from '@app/services/auth-service/auth.service';
import { User } from '@app/shared/model/user';

@Component({
  selector: 'app-department-management',
  templateUrl: './department-management.component.html',
  styleUrl: './department-management.component.scss',
})
export class DepartmentManagementComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<Department>;

  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();

  public permissions = Permissions;
  isDialogOpen: boolean = false;
  public localization = Localization;
  public validationMessage = Localization.requiredField;
  saveMode = 'POST';
  isLoading: boolean = false;
  department: Department = new Department();
  valueStateOptions = {
    name: ValueState.None,
  };

  gridId = 'base-data-department';
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<Department> = {
    type: 'odata',
    endpoint: 'Departments',
    searchFields: ['name', 'custom_id'],
    pageSize: 40,
    sortBy: "id",
    sortDirection: "desc",
    scrollPagination: true,
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Departments`,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(Permissions.BASE_DATA_DEPARTMENT_CREATE),
  };

  private authUser: User = new User();
  private pendingDeleteData: { id: number; custom_id?: string } | null = null;

  constructor(
    public rolePermissionService: RolePermissionService,
    private http: CommonService,
    private toastService: ToastService,
    private socketService: SocketService,
    private authService: AuthService,
  ) {
    this.authUser = this.authService.user();
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
        headerName: $localize`Custom ID`,
        minWidth: 120,
      },
      {
        field: 'name',
        headerName: $localize`Name`,
        minWidth: 180,
      },
      {
        field: 'created_at',
        headerName: Localization.CreatedAt,
        minWidth: 130,
        filter: false,
        floatingFilter: false,
        valueFormatter: ({ value }: any) =>
          value ? new Date(value).toLocaleDateString() : '',
      },
    ];
  }

  processData(event?: any): void {
    this.refreshTable.emit(event);
    this.agGridRef?.refreshGridData(true);
    if (this.pendingDeleteData) {
      this.triggerDepartmentNotification('base-data-department:deleted', this.pendingDeleteData);
      this.pendingDeleteData = null;
    }
  }

  checkValidation(event: any, field: string): void {
    const value = event.target.value ? event.target.value : '';

    switch (field) {
      case 'name':
        if (!value.trim()) {
          this.valueStateOptions.name = ValueState.Negative;
        } else {
          this.department.name = value;
          this.valueStateOptions.name = ValueState.None;
        }
        break;

      default:
        break;
    }
  }

  checkPermission(data: string): boolean {
    return this.rolePermissionService.hasPermission(data);
  }

  validateForm(): boolean {
    let isValid = true;
    if (!this.department.name?.trim()) {
      this.valueStateOptions.name = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  saveDepartment(): void {
    if (!this.validateForm()) return;

    this.isLoading = true;

    if (this.saveMode === saveMode.POST) {
      this.http.post('Departments', this.department, true).subscribe({
        next: (res: any) => {
          this.processData(res);
          this.toastService.show('add');
          this.CloseDialog();
          this.triggerDepartmentNotification('base-data-department:created', res);
        },
        error: (err) => {
          console.error(err);
          this.toastService.show('error');
        },
      });
    }

    if (this.saveMode === saveMode.PUT) {
      this.http
        .put(`Departments(${this.department.id})`, this.department, true)
        .subscribe({
          next: (res: any) => {
            this.processData(res);
            this.toastService.show('edit');
            this.CloseDialog();
            this.triggerDepartmentNotification('base-data-department:updated', res);
          },
          error: (err) => {
            console.error(err);
            this.toastService.show('error');
          },
        });
    }
  }

  editDepartment(row: any): void {
    this.department = new Department().deserialize(row);
    this.saveMode = saveMode.PUT;
    this.isDialogOpen = true;
  }

  newDepartment(): void {
    this.department = new Department().deserialize({});
    this.saveMode = saveMode.POST;
    this.isDialogOpen = true;
  }

  deleteClick(row: any): void {
    this.pendingDeleteData = { id: row.id, custom_id: row.custom_id };
    this.IsDelete.emit(`Departments/${row.id}`);
  }

  private triggerDepartmentNotification(event: string, dept: { id: number; custom_id?: string }): void {
    this.socketService.emit(event, {
      model_id: dept.id,
      model_custom_id: dept.custom_id ?? dept.id,
      sender_id: this.authUser.id,
      sender_name: this.authUser.name,
    });
  }

  CloseDialog(): void {
    this.isLoading = false;
    this.isDialogOpen = false;
    this.department = new Department();
    this.valueStateOptions = {
      name: ValueState.None,
    };
  }
}
