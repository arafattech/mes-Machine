import { Component, ViewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { Permissions } from '@app/shared/enums/permissions';
import { saveMode } from '@app/shared/enums/saveMode';
import { ToastService } from '@app/services/toast-service/toast.service';
import { CommonService } from '@app/services/common-service/common.service';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { ScheduleFrequency } from '@production-module/shared/interface/interface';
import { ScheduleFrequencyFormComponent } from '@base-data-module/machine-management/schedule-frequency/schedule-frequency-form/schedule-frequency-form.component';

@Component({
  selector: 'app-schedule-frequency-list',
  templateUrl: './schedule-frequency-list.component.html',
})
export class ScheduleFrequencyListComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<ScheduleFrequency>;
  @ViewChild('frequencyForm') frequencyFormRef!: ScheduleFrequencyFormComponent;

  public permissions = Permissions;
  public saveMode: string = saveMode.POST;

  frequencyToDelete: ScheduleFrequency | null = null;
  deleteDialogOpen = false;
  deleting = false;

  gridId = 'production-schedule-frequency-list';

  dataSource: AgGridTableODataSourceConfig<ScheduleFrequency> = {
    type: 'api',
    endpoint: '',
    customEndpoint: 'schedule-frequencies',
    fromCustomPaginator: true,
    searchFields: ['name'],
    pageSize: 40,
    scrollPagination: true,
    sortBy: 'name',
    sortDirection: 'asc',
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Schedules Frequency`,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(
      Permissions.PRODUCTION_ADMIN,
    ),
  };

  columns: AgGridTableColumn<ScheduleFrequency>[] = [
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
      field: 'name',
      headerName: $localize`Name`,
      minWidth: 200,
    },
    {
      field: 'interval_days',
      headerName: $localize`Repeat Every (days)`,
      minWidth: 180,
    },
  ];

  constructor(
    public rolePermissionService: RolePermissionService,
    private readonly commonService: CommonService,
    private readonly toastService: ToastService,
  ) {}

  processData(): void {
    this.agGridRef?.refreshGridData(true);
  }

  newFrequency(): void {
    this.saveMode = saveMode.POST;
    this.frequencyFormRef.openDialog(null);
  }

  editFrequency(row: ScheduleFrequency): void {
    this.saveMode = saveMode.PUT;
    this.frequencyFormRef.openDialog(row);
  }

  deleteClick(row: ScheduleFrequency): void {
    this.frequencyToDelete = row;
    this.deleteDialogOpen = true;
  }

  closeDeleteDialog(): void {
    this.deleteDialogOpen = false;
    this.frequencyToDelete = null;
  }

  confirmDelete(): void {
    if (!this.frequencyToDelete) return;
    this.deleting = true;
    this.commonService
      .delete(`schedule-frequencies/${this.frequencyToDelete.id}`, undefined, false)
      .subscribe({
        next: () => {
          this.deleting = false;
          this.closeDeleteDialog();
          this.toastService.show('delete');
          this.processData();
        },
        error: (err: HttpErrorResponse) => {
          this.deleting = false;
          this.closeDeleteDialog();
          this.toastService.show('error', err.error?.errors?.id?.[0]);
        },
      });
  }
}
