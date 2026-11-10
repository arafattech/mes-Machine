import { Component, ViewChild } from '@angular/core';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { Permissions } from '@app/shared/enums/permissions';
import { saveMode } from '@app/shared/enums/saveMode';
import { ToastService } from '@app/services/toast-service/toast.service';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { MaintenanceWorkTypeClass } from '@production-module/shared/enums/maintenance-work-type';
import { formatDate, formatDateTime, formatTime } from '@shared/utilities/date-format';
import { MachineMaintenanceScheduleFormComponent } from '../machine-maintenance-schedule-form/machine-maintenance-schedule-form.component';
import { CommonService } from '@app/services/common-service/common.service';

@Component({
  selector: 'app-machine-maintenance-schedule-list',
  templateUrl: './machine-maintenance-schedule-list.component.html',
  styleUrls: ['./machine-maintenance-schedule-list.component.scss'],
})
export class MachineMaintenanceScheduleListComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<any>;
  @ViewChild('maintenanceForm') maintenanceFormRef!: MachineMaintenanceScheduleFormComponent;

  public permissions = Permissions;
  public saveMode: string = saveMode.POST;

  selectedSchedule: any | null = null;
  scheduleToDelete: any | null = null;
  deleteDialogOpen = false;
  deleting = false;

  gridId = 'production-machine-maintenance-schedule-list';
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: 'api',
    endpoint: '',
    customEndpoint: 'maintenance-schedules',
    fromCustomPaginator: true,
    searchFields: ['machine.machine_name', 'frequency.name'],
    pageSize: 40,
    scrollPagination: true,
    sortBy: 'id',
    sortDirection: 'desc',
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Machine Maintenance Schedule`,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(
      Permissions.PRODUCTION_ADMIN,
    ),
  };

  constructor(
    public rolePermissionService: RolePermissionService,
    private readonly commonService: CommonService,
    private readonly toastService: ToastService,
  ) {
    this.columns = this.buildColumns();
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    return [
      {
        colId: 'machine.machine_name',
        headerName: $localize`Machine`,
        minWidth: 180,
        valueGetter: (p) => p.data?.machine?.machine_name ?? '',
      },
      {
        field: 'start_date',
        headerName: $localize`Start Date`,
        minWidth: 160,
        valueFormatter: ({ value }: any) => formatDate(value),
      },
      {
        field: 'scheduled_time',
        headerName: $localize`Scheduled Time`,
        minWidth: 160,
        valueFormatter: ({ value }: any) => formatTime(value),
      },
      {
        colId: 'frequency.name',
        headerName: $localize`Frequency`,
        minWidth: 160,
        valueGetter: (p) => p.data?.frequency?.name ?? '',
      },
      {
        field: 'type_of_work',
        headerName: $localize`Type of Works`,
        minWidth: 180,
        valueGetter: (p) => MaintenanceWorkTypeClass.getLabel(p.data?.type_of_work),
      },
      {
        field: 'is_active',
        headerName: $localize`Status`,
        minWidth: 150,
        valueGetter: (p) => (p.data?.is_active ? $localize`Active` : $localize`Inactive`),
      },
      {
        field: 'next_maintenance_date',
        headerName: $localize`Next Maintenance Date`,
        minWidth: 240,
        // A schedule never completed keeps a past date; flag it instead of showing it as upcoming.
        valueFormatter: (p) => {
          const next = formatDateTime(p.value);
          const overdueDays: number | null = p.data?.overdue_days ?? null;
          return overdueDays === null ? next : `${next} · ${$localize`Overdue (${overdueDays} days)`}`;
        },
        cellClass: (p) => (p.data?.overdue_days != null ? 'maintenance-overdue' : ''),
      },
    ];
  }

  processData(_event?: any): void {
    this.agGridRef?.refreshGridData(true);
  }

  newSchedule(): void {
    this.selectedSchedule = null;
    this.saveMode = saveMode.POST;
    this.maintenanceFormRef.openDialog(null);
  }

  editSchedule(data: any): void {
    this.selectedSchedule = data;
    this.saveMode = saveMode.PUT;
    this.maintenanceFormRef.openDialog(this.selectedSchedule);
  }

  deleteClick(row: any): void {
    this.scheduleToDelete = row;
    this.deleteDialogOpen = true;
  }

  closeDeleteDialog(): void {
    this.deleteDialogOpen = false;
    this.scheduleToDelete = null;
  }

  confirmDelete(): void {
    if (!this.scheduleToDelete) return;
    this.deleting = true;
    this.commonService
      .delete(`maintenance-schedules/${this.scheduleToDelete.id}`, undefined, false)
      .subscribe({
        next: () => {
          this.deleting = false;
          this.closeDeleteDialog();
          this.toastService.show('delete');
          this.processData();
        },
        error: () => {
          this.deleting = false;
          this.toastService.show('error');
        },
      });
  }
}
