import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { LeaveType } from '@app/shared/model/leaveType';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { LeaveTypeFormComponent } from '@app/modules/hr-management/leave-management/leave-type/leave-type-form/leave-type-form.component';
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
  selector: 'app-leave-type-list',
  templateUrl: './leave-type-list.component.html',
  styleUrl: './leave-type-list.component.scss',
})
export class LeaveTypeListComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<LeaveType>;
  @ViewChild('leaveTypeForm') leaveTypeFormRef!: LeaveTypeFormComponent;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<string>();

  public permissions = Permissions;
  public saveMode: string = saveMode.POST;
  leaveType = new LeaveType().deserialize({});
  gridId = 'hr-leave-type-list';
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<LeaveType> = {
    type: 'odata',
    endpoint: 'LeaveTypes',
    expand: 'approvalType',
    searchFields: ['name'],
    pageSize: 40,
    scrollPagination: true,
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Leave Types`,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(
      Permissions.HR_LEAVE_TYPE_CREATE,
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
        minWidth: 90,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
        floatingFilter: false,
      },
      { field: 'name', headerName: $localize`Name`, minWidth: 180, flex: 1 },
      { field: 'max_days', headerName: $localize`Max Days`, minWidth: 120 },
      {
        field: 'is_paid',
        headerName: $localize`Paid`,
        minWidth: 100,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
        floatingFilter: false,
      },
      {
        field: 'document_required',
        headerName: $localize`Document Required`,
        minWidth: 150,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
        floatingFilter: false,
      },
      {
        colId: 'approval_type.name',
        headerName: $localize`Approval Type`,
        minWidth: 160,
        valueGetter: (params: any) => params.data?.approvalType?.name ?? '',
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

  newLeaveType(): void {
    this.leaveType = new LeaveType().deserialize({});
    this.leaveTypeFormRef.open = true;
    this.saveMode = saveMode.POST;
  }

  editLeaveType(data: any): void {
    this.leaveType = new LeaveType().deserialize(data);
    this.leaveTypeFormRef.open = true;
    this.saveMode = saveMode.PUT;
  }

  deleteClick(id: string): void {
    this.IsDelete.emit(`LeaveTypes/${id}`);
  }
}
