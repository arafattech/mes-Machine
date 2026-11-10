import { Component, ViewChild } from '@angular/core';
import moment from 'moment';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { Permissions } from '@app/shared/enums/permissions';
import { saveMode } from '@app/shared/enums/saveMode';
import { ToastService } from '@app/services/toast-service/toast.service';
import { ValueState } from '@shared/utilities/value-state-wrapper';
import { Localization } from '@shared/utilities/localization';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { AgGridStatusBadgeComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component';
import { MachineMaintenanceService } from '@production-module/shared/services/machine-maintenance.service';
import { MachineMaintenanceSchedule } from '@production-module/shared/interface/interface';
import { DEFAULT_BUFFER_MINUTES } from '@production-module/shared/utils/maintenance-buffer';
import { MachineMaintenanceFormComponent } from '../machine-maintenance-form/machine-maintenance-form.component';
import { DurationPipe } from '@production-module/shared/pipes/duration.pipe';

const durationPipe = new DurationPipe();

@Component({
  selector: 'app-machine-maintenance-list',
  templateUrl: './machine-maintenance-list.component.html',
  styleUrl: './machine-maintenance-list.component.scss',
})
export class MachineMaintenanceListComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<any>;
  @ViewChild('maintenanceForm') maintenanceFormRef!: MachineMaintenanceFormComponent;

  public permissions = Permissions;
  public saveMode: string = saveMode.POST;

  /** Row being edited — handed to the form dialog. */
  selectedSchedule: MachineMaintenanceSchedule | null = null;

  /** Row pending delete confirmation. */
  scheduleToDelete: MachineMaintenanceSchedule | null = null;
  deleteDialogOpen = false;
  deleting = false;
  gridId = 'production-machine-maintenance-list';
  columns: AgGridTableColumn<any>[] = [];

  scheduleToEnd: any = null;
  endDialogOpen = false;
  ending = false;
  maintenanceNote = '';
  maintenanceNoteState: any = ValueState.None;
  valueState = ValueState;
  validationMessage = Localization.requiredField;

  scheduleToView: any = null;
  viewDialogOpen = false;

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: 'api',
    endpoint: '',
    customEndpoint: 'machine/maintenance',
    fromCustomPaginator: true,
    searchFields: ['machine.machine_name', 'reason'],
    pageSize: 40,
    scrollPagination: true,
    // No forced initial sort: leaving sortBy unset means the first load sends no
    // $orderby, so the backend's own default takes over — Scheduled, then Active,
    // then Ended, newest-scheduled first within each (see
    // MachineMaintenanceController::applySort()). Clicking any column header still
    // sorts explicitly as normal.
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Machine Maintenance`} ${$localize`List`}`,
    showSearch: true,
    showRowCount: true,
    addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(
      Permissions.PRODUCTION_ADMIN,
    ),
  };

  /** Row-level operational actions (next to Edit/Delete). */
  customActionButtons = [
     {
      id: 'info',
      text: '',
      icon: 'information',
      tooltip: $localize`Info`,
      design: 'Transparent' as const,
      onClick: (row: any) => this.openViewDialog(row),
    },
    {
      id: 'activate',
      text: '',
      icon: 'play',
      tooltip: $localize`Activate now`,
      design: 'Emphasized' as const,
      hide: (row: any) => row.ended_at != null || row.activated_at != null,
      onClick: (row: any) => this.activate(row),
    },
    {
      id: 'end',
      text: '',
      icon: 'stop',
      tooltip: $localize`End / Cancel`,
      design: 'Negative' as const,
      hide: (row: any) => row.ended_at != null,
      onClick: (row: any) => this.openEndDialog(row),
    },
  ];

  constructor(
    public rolePermissionService: RolePermissionService,
    private readonly maintenanceService: MachineMaintenanceService,
    private readonly toastService: ToastService,
  ) {
    this.columns = this.buildColumns();
    this.dataSource.baseFilter = `scheduled_start_at le ${moment().add(5, 'days').toISOString()}`;
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
        field: 'reason',
        headerName: $localize`Reason`,
        minWidth: 240,
      },
      {
        field: 'scheduled_start_at',
        headerName: $localize`Scheduled Start`,
        minWidth: 160,
        valueFormatter: ({ value }: any) => this.formatScheduledStart(value),
      },
      {
        field: 'activated_at',
        headerName: $localize`Activated At`,
        minWidth: 150,
        valueFormatter: ({ value }: any) => this.formatDateTime(value),
      },
      {
        colId: 'duration_seconds',
        headerName: $localize`Duration`,
        minWidth: 120,
        filter: false,
        floatingFilter: false,
        valueGetter: (p) =>
          p.data?.duration_seconds != null ? durationPipe.transform(p.data.duration_seconds) : '',
      },
      {
        field: 'ended_at',
        headerName: $localize`Ended At`,
        minWidth: 150,
        valueFormatter: ({ value }: any) => this.formatDateTime(value),
      },
      {
        colId: 'ended_by',
        headerName: $localize`Ended By`, 
        minWidth: 180,
        valueGetter: (p) => {
          const endedBy = p.data?.ended_by;
          if (endedBy === 'MANUAL') {
            const userName = p.data?.endedByUser?.name || p.data?.endedByUser?.first_name || p.data?.ended_by_user?.name || p.data?.ended_by_user?.first_name;
            return userName ? `${$localize`MANUAL`} / ${userName}` : $localize`MANUAL`;
          }
          if (endedBy === 'AUTO') return $localize`AUTO`;
          return '';
        },
      },
      {
        field: 'maintenance_note',
        headerName: $localize`Maintenance Note`,
        minWidth: 200,
        valueFormatter: ({ value }: any) => this.stripHtml(value),
      },
      {
        colId: 'status',
        headerName: $localize`Status`,
        minWidth: 130,
        cellRenderer: AgGridStatusBadgeComponent,
        valueGetter: (p) => this.scheduleStatus(p.data),
        // No real `status` column — the multiSelect fragment (`status eq 'scheduled'`,
        // matching this valueGetter's own values) is translated server-side in
        // MachineMaintenanceController::applyFilter()/applySort().
        filterControl: {
          type: 'multiSelect',
          options: [
            { value: 'scheduled', label: $localize`Scheduled` },
            { value: 'active', label: $localize`Active` },
            { value: 'ended', label: $localize`Ended` },
          ],
        },
      },
    ];
  }

  /** SCHEDULED / ACTIVE / ENDED — maps to a statusStyles badge key. */
  private scheduleStatus(row: any): string {
    if (row?.ended_at != null) return 'ended';
    return row?.activated_at != null ? 'active' : 'scheduled';
  }

  /**
   * `activated_at` / `ended_at` are set from `Carbon::now()` on the backend —
   * genuine UTC instants — so plain `moment()` (real UTC → browser-local
   * conversion) is correct here.
   */
  formatDateTime(value: any): string {
    if (!value) return '';
    return moment(String(value)).format('DD/MM/YYYY hh:mm A');
  }

  /**
   * `scheduled_start_at` is a Carbon `datetime` cast serialized with a `Z`
   * suffix, but the stored value is naive local wall-clock time typed by the
   * user into the `<ui5-datetime-picker>` (backend `APP_TIMEZONE` is UTC, not
   * the deployment's local zone, so `Carbon::parse()` mislabels it as UTC) —
   * `moment.utc()` reads the raw numbers instead of re-shifting an
   * already-local value by the browser's local offset on top.
   */
  private formatScheduledStart(value: any): string {
    if (!value) return '';
    return moment.utc(String(value)).format('DD/MM/YYYY hh:mm A');
  }

  /** Grid cells and the details dialog render plain text, so strip markup from the rich-text maintenance note. */
  stripHtml(value: any): string {
    if (!value) return '';
    return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
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
    this.selectedSchedule = this.toSchedule(data);
    this.saveMode = saveMode.PUT;
    this.maintenanceFormRef.openDialog(this.selectedSchedule);
  }

  deleteClick(row: any): void {
    this.scheduleToDelete = this.toSchedule(row);
    this.deleteDialogOpen = true;
  }

  closeDeleteDialog(): void {
    this.deleteDialogOpen = false;
    this.scheduleToDelete = null;
  }

  confirmDelete(): void {
    if (!this.scheduleToDelete) return;
    this.deleting = true;
    this.maintenanceService.remove(this.scheduleToDelete.id).subscribe({
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

  activate(row: any): void {
    this.maintenanceService.activate(row.id).subscribe({
      next: () => {
        this.toastService.show('approve');
        this.processData();
      },
      error: () => this.toastService.show('error'),
    });
  }

  openEndDialog(row: any): void {
    this.scheduleToEnd = row;
    this.maintenanceNote = row.maintenance_note || '';
    this.maintenanceNoteState = ValueState.None;
    this.endDialogOpen = true;
  }

  onMaintenanceNoteInput(value: string): void {
    this.maintenanceNote = value ?? '';
    this.maintenanceNoteState = ValueState.None;
  }

  closeEndDialog(): void {
    this.endDialogOpen = false;
    this.scheduleToEnd = null;
  }

  openViewDialog(row: any): void {
    this.scheduleToView = row;
    this.viewDialogOpen = true;
  }

  closeViewDialog(): void {
    this.viewDialogOpen = false;
    this.scheduleToView = null;
  }

  viewEndedByLabel(row: any): string {
    const endedBy = row?.ended_by;
    if (endedBy === 'MANUAL') {
      const userName = row?.endedByUser?.name || row?.endedByUser?.first_name || row?.ended_by_user?.name || row?.ended_by_user?.first_name;
      return userName ? `${$localize`MANUAL`} / ${userName}` : $localize`MANUAL`;
    }
    if (endedBy === 'AUTO') return $localize`AUTO`;
    return '';
  }

  confirmEnd(): void {
    if (!this.scheduleToEnd) return;
    if (!this.maintenanceNote.trim()) {
      this.maintenanceNoteState = ValueState.Negative;
      return;
    }

    this.ending = true;
    this.maintenanceService.end(this.scheduleToEnd.machine_id, this.maintenanceNote.trim()).subscribe({
      next: () => {
        this.ending = false;
        this.toastService.show(this.scheduleToEnd.activated_at != null ? 'remove' : 'edit');
        this.closeEndDialog();
        this.processData();
      },
      error: () => {
        this.ending = false;
        this.toastService.show('error');
      },
    });
  }

  /** Normalize a raw REST row (snake_case, with eager-loaded `machine`) to the interface. */
  private toSchedule(row: any): MachineMaintenanceSchedule {
    return {
      id: Number(row.id),
      machineId: Number(row.machine_id),
      scheduledStartAt: row.scheduled_start_at ? String(row.scheduled_start_at) : null,
      reason: row.reason ? String(row.reason) : null,
      activatedAt: row.activated_at ? String(row.activated_at) : null,
      endedAt: row.ended_at ? String(row.ended_at) : null,
      endedBy:
        row.ended_by === 'AUTO' || row.ended_by === 'MANUAL' ? row.ended_by : null,
      bufferEnabled: row.buffer_enabled == null ? true : !!row.buffer_enabled,
      bufferMinutes: row.buffer_minutes ?? DEFAULT_BUFFER_MINUTES,
    };
  }
}