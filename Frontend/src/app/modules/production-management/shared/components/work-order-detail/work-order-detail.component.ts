import { Component, DestroyRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import moment from 'moment';
import { ValueFormatterParams } from 'ag-grid-community';
import { MachineOverviewDataService } from '@production-module/shared/services/machine-overview-data.service';
import { ProductionService } from '@production-module/shared/services/production.service';
import { MachineStatesService } from '@app/modules/production-management/shared/services/machine-states.service';
import { SocketService } from '@app/services/socket.service';
import { Machine } from '@shared/model/machine';
import { MachineStatusSignals, deriveActivity } from '@production-module/shared/utils/machine-status';
import {
  Metric,
  PlannedMachine,
  ShiftOption,
  WastageAllocationRow,
  WastageTypeBreakdown,
  WorkOrderDetail,
  WorkOrderMachineBreakdownRow,
  WorkOrderWastageDetail,
} from '@production-module/shared/interface/interface';
import {
  getWorkOrderStatusColor,
  getWorkOrderStatusLabel,
  getWorkOrderStatusTint,
} from '@production-module/shared/utils/work-order-status.util';
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@shared/components/ag-grid-table/types/ag-grid-table.types';
import { ChartDataset } from '@production-module/shared/components/bar-chart/bar-chart.component';

/** A `to_frontend` socket telemetry payload — same shape `MachineBoardComponent` consumes,
 * keyed by `MNR` (a machine's `id` or `custom_id`, sent as-is by the PLC/gateway). */
type SocketTelemetry = MachineStatusSignals & { MNR: string | number };

@Component({
  selector: 'app-work-order-detail',
  templateUrl: './work-order-detail.component.html',
  styleUrl: './work-order-detail.component.scss',
})
export class WorkOrderDetailComponent implements OnChanges {
  @Input() workOrderId: number | null = null;

  readonly getWorkOrderStatusColor = getWorkOrderStatusColor;
  readonly getWorkOrderStatusTint = getWorkOrderStatusTint;
  readonly getWorkOrderStatusLabel = getWorkOrderStatusLabel;

  selectedTab: 'overview' | 'machines' | 'wastage' = 'overview';

  /** Planned-machine list is hidden from the header banner entirely — surfaced instead via
   * a dialog opened from the "Machines Active" KPI card, keeping the banner compact. */
  plannedMachinesDialogOpen = false;

  /** Same app-wide machine list `MachineBoardComponent`'s "All Machines" page reads —
   * fed by `LayoutComponent`'s `productionService.loadMachines('all-machines')` call, not
   * re-fetched here, so this dialog never clobbers a hall-filtered list some other page set. */
  private machines: Machine[] = [];
  /** Latest `to_frontend` telemetry per machine, keyed by `MNR` — same live-status source
   * `MachineBoardComponent`/`machine-status-card` use, just consumed for one lookup here
   * instead of a whole board. */
  private readonly machineDataMap = new Map<string, SocketTelemetry>();

  loading = false;
  detail: WorkOrderDetail | null = null;

  /** Stable reference — reassigned only on a real fetch, matching the drill-down grid's pattern
   * in `machine-overview.component.ts` so change detection doesn't reset the grid needlessly. */
  breakdownDataSource: AgGridTableODataSourceConfig<WorkOrderMachineBreakdownRow> =
    {
      type: 'odata',
      endpoint: '',
      staticData: true,
      data: [],
    };

  readonly toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Machines & Shifts`,
    showSearch: false,
    showRowCount: true,
    showSegmentButton: false,
    showNewButton: false,
  };

  readonly displayConfig: AgGridTableDisplayConfig = {
    gridHeight: '350px',
  };

  wastageLoading = false;
  wastageDetail: WorkOrderWastageDetail | null = null;
  wastageShiftOptions: ShiftOption[] = [];
  wastageFilterShiftId: number | null = null;
  /** `''`, not `null` — `ui5-date-picker`'s `[(ngModel)]` renders a `null` value as the
   * literal text "undefined" instead of leaving the field empty (confirmed live). */
  wastageFilterDate = '';

  wastageDataSource: AgGridTableODataSourceConfig<WastageTypeBreakdown> = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };

  readonly wastageToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Wastage by Type`,
    showSearch: false,
    showRowCount: true,
    showSegmentButton: false,
    showNewButton: false,
  };
  readonly machineAllocationsToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Machine Allocations`,
    showSearch: false,
    showRowCount: true,
    showSegmentButton: false,
    showNewButton: false,
  };

  readonly wastageDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: '350px',
  };

  readonly wastageColumns: AgGridTableColumn<WastageTypeBreakdown>[] = [
    { field: 'wastageTypeName', headerName: $localize`Wastage Type`, flex: 1 },
    { field: 'totalQtyKg', headerName: $localize`Total (kg)` },
    {
      field: 'percentOfTotal',
      headerName: $localize`% of Total`,
      valueFormatter: (p: ValueFormatterParams<WastageTypeBreakdown, number>) =>
        `${p.value ?? 0}%`,
    },
  ];

  wastageChartDatasets: ChartDataset[] = [];

  machineAllocationsOpen = false;
  machineAllocationsSubtitle = '';
  machineAllocations: WastageAllocationRow[] = [];
  readonly machineAllocationColumns: AgGridTableColumn<WastageAllocationRow>[] =
    [
      { field: 'machineName', headerName: $localize`Machine`, flex: 1 },
      { field: 'allocatedQtyKg', headerName: $localize`Allocated (kg)` },
    ];
  machineAllocationsDataSource: AgGridTableODataSourceConfig<WastageAllocationRow> =
    {
      type: 'odata',
      endpoint: '',
      staticData: true,
      data: [],
    };
  readonly machineAllocationsDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: '220px',
  };

  readonly breakdownColumns: AgGridTableColumn<WorkOrderMachineBreakdownRow>[] =
    [
      { field: 'machineName', headerName: $localize`Machine` },
      {
        field: 'shiftName',
        headerName: $localize`Shift`,
        valueFormatter: (
          p: ValueFormatterParams<WorkOrderMachineBreakdownRow, string | null>,
        ) => p.value ?? $localize`—`,
      },
      { field: 'goodCount', headerName: $localize`Good` },
      { field: 'scrapCount', headerName: $localize`Scrap` },
      { field: 'totalCount', headerName: $localize`Total` },
      {
        field: 'startedAt',
        headerName: $localize`First Logged`,
        valueFormatter: (
          p: ValueFormatterParams<WorkOrderMachineBreakdownRow, string | null>,
        ) => (p.value ? new Date(p.value).toLocaleString() : ''),
      },
      {
        field: 'endedAt',
        headerName: $localize`Last Logged`,
        valueFormatter: (
          p: ValueFormatterParams<WorkOrderMachineBreakdownRow, string | null>,
        ) => (p.value ? new Date(p.value).toLocaleString() : ''),
      },
    ];

  constructor(
    private readonly overviewDataService: MachineOverviewDataService,
    private readonly productionService: ProductionService,
    private readonly socketService: SocketService,
    private readonly machineStates: MachineStatesService,
    private readonly destroyRef: DestroyRef,
  ) {
    this.overviewDataService.getActiveShifts().subscribe((shifts) => {
      this.wastageShiftOptions = shifts;
    });

    this.productionService.machines$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((machines) => {
        this.machines = machines;
      });

    this.socketService
      .on('to_frontend')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: SocketTelemetry | SocketTelemetry[]) => {
        const telemetryList = Array.isArray(data) ? data : [data];
        for (const item of telemetryList) {
          if (item?.MNR != null) {
            this.machineDataMap.set(String(item.MNR), item);
          }
        }
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['workOrderId']) return;

    this.selectedTab = 'overview';

    if (!this.workOrderId) {
      this.detail = null;
      this.breakdownDataSource = { ...this.breakdownDataSource, data: [] };
      this.wastageDetail = null;
      this.wastageDataSource = { ...this.wastageDataSource, data: [] };
      this.wastageChartDatasets = [];
      return;
    }

    this.loading = true;
    this.overviewDataService
      .getWorkOrderDetail(this.workOrderId)
      .subscribe((detail) => {
        this.detail = detail;
        this.breakdownDataSource = {
          ...this.breakdownDataSource,
          data: detail.machines,
        };
        this.loading = false;
      });

    this.wastageFilterShiftId = null;
    this.wastageFilterDate = '';
    this.fetchWastageDetail();
  }

  onWastageFilterShiftChange(event: any): void {
    const id = Number(event?.detail?.item?.value);
    this.wastageFilterShiftId = Number.isFinite(id) ? id : null;
    this.fetchWastageDetail();
  }

  onWastageFilterDateChange(): void {
    this.fetchWastageDetail();
  }

  clearWastageFilter(): void {
    this.wastageFilterShiftId = null;
    this.wastageFilterDate = '';
    this.fetchWastageDetail();
  }

  /** Re-fetches the wastage breakdown scoped by the current shift/date filter (both optional,
   * both cleared = whole-work-order total) — the "per shift per WO" / "per day per WO" /
   * "per WO" reporting scopes, all served by the same endpoint. */
  private fetchWastageDetail(): void {
    if (!this.workOrderId) return;

    this.wastageLoading = true;
    this.overviewDataService
      .getWorkOrderWastageDetail(this.workOrderId, {
        shiftId: this.wastageFilterShiftId,
        date: this.wastageFilterDate,
      })
      .subscribe((wastage) => {
        this.wastageDetail = wastage;
        this.wastageDataSource = {
          ...this.wastageDataSource,
          data: wastage.byType,
        };
        this.wastageChartDatasets = [
          {
            label: $localize`Wastage (kg)`,
            data: wastage.byType.map((t) => ({
              x: t.wastageTypeName ?? $localize`Unknown`,
              y: t.totalQtyKg,
            })),
            backgroundColor: 'rgba(220, 38, 38, 0.6)',
            borderColor: 'rgba(220, 38, 38, 1)',
          },
        ];
        this.wastageLoading = false;
      });
  }

  /** Per-machine drill-down behind a wastage-type row's info action. */
  viewMachineAllocations(row: WastageTypeBreakdown): void {
    const rows = this.wastageDetail?.allocationsByType[row.wastageTypeId] ?? [];
    this.machineAllocationsSubtitle = row.wastageTypeName ?? $localize`Unknown`;
    this.machineAllocations = rows;
    this.machineAllocationsDataSource = {
      ...this.machineAllocationsDataSource,
      data: rows,
    };
    this.machineAllocationsOpen = true;
  }

  closeMachineAllocations(): void {
    this.machineAllocationsOpen = false;
  }

  openPlannedMachinesDialog(): void {
    this.plannedMachinesDialogOpen = true;
  }

  closePlannedMachinesDialog(): void {
    this.plannedMachinesDialogOpen = false;
  }

  formatDate(value: string | null): string {
    return value ? moment(value).format('MMM D, YYYY') : $localize`—`;
  }

  trackByMetricLabel = (_: number, metric: Metric): string => metric.label;

  onTabSelect(event: any): void {
    this.selectedTab = event.detail.tab.id;
  }

  get machinesTabLabel(): string {
    return `${$localize`Machines & Shifts`} (${this.detail?.machines.length ?? 0})`;
  }

  get wastageTabLabel(): string {
    return `${$localize`Wastage`} (${this.wastageDetail?.byType.length ?? 0})`;
  }

  /** Distinct machine IDs that have actually logged production against this WO — shared by
   * `activeMachineCount` and `plannedMachinesWithStatus` so both read the same set. */
  private get activeMachineIds(): Set<number> {
    return new Set((this.detail?.machines ?? []).map((row) => row.machineId));
  }

  /** How many of this WO's *planned* machines (`work_order_machines`) have actually
   * logged production against it — planned and executed can diverge (see
   * `work-order-and-log-production.md`), this surfaces that gap at a glance. */
  get activeMachineCount(): number {
    return this.activeMachineIds.size;
  }

  get plannedMachineCount(): number {
    return this.detail?.workOrder?.plannedMachines.length ?? 0;
  }

  /** Planned machines annotated with each one's *live* status (Active/Idle/Inactive/
   * Maintenance/Fault, or an admin-defined custom state) — same source the "All Machines"
   * board reads (`ProductionService.machines$` + `to_frontend` socket telemetry resolved via
   * `deriveActivity`), not whether it has logged production against this specific WO.
   * Drives the per-machine status badge in the "Machines Active" drill-down dialog. */
  get plannedMachinesWithStatus(): (PlannedMachine & {
    statusLabel: string;
    statusColor: string;
    statusTint: string;
  })[] {
    return (this.detail?.workOrder?.plannedMachines ?? []).map((plannedMachine) => {
      const machine = this.machines.find((candidate) => candidate.id === plannedMachine.id);
      const activity = deriveActivity(this.getMachineLiveData(machine));
      const state = this.machineStates.getByName(activity);
      return {
        ...plannedMachine,
        statusLabel: state?.name ?? activity,
        statusColor: state?.color ?? '#6a6d70',
        statusTint: this.machineStates.getTint(state?.id ?? null),
      };
    });
  }

  /** Same id/custom_id/numeric-custom_id fallback matching `MachineBoardComponent` uses to
   * pair a `Machine` row with its `to_frontend` telemetry — telemetry is keyed by whichever
   * of the two the PLC/gateway sends as `MNR`. */
  private getMachineLiveData(
    machine?: Pick<Machine, 'id' | 'custom_id'>,
  ): SocketTelemetry | undefined {
    if (!machine) return undefined;

    const idKey = machine.id != null ? String(machine.id) : null;
    const customIdKey = machine.custom_id != null ? String(machine.custom_id) : null;
    const numericCustomId = customIdKey != null ? customIdKey.replace(/\D/g, '') : null;

    return (
      (idKey ? this.machineDataMap.get(idKey) : undefined) ??
      (customIdKey ? this.machineDataMap.get(customIdKey) : undefined) ??
      (numericCustomId ? this.machineDataMap.get(numericCustomId) : undefined)
    );
  }

  /**
   * Scheduled vs. actual start, in plain language — a real, cheap-to-compute signal of
   * whether this WO got underway on time. Null when either date is missing (nothing to
   * compare) so the template can fall back to not showing the indicator at all rather than
   * fabricating a "0 days" reading that would misleadingly look like "on time".
   */
  get startVariance(): {
    label: string;
    tone: 'positive' | 'warning' | 'neutral';
  } | null {
    const wo = this.detail?.workOrder;
    if (!wo?.scheduledStart || !wo?.actualStart) return null;

    const days = moment(wo.actualStart)
      .startOf('day')
      .diff(moment(wo.scheduledStart).startOf('day'), 'days');
    if (days === 0)
      return { label: $localize`Started on schedule`, tone: 'positive' };
    if (days > 0)
      return { label: $localize`Started ${days} day(s) late`, tone: 'warning' };
    return {
      label: $localize`Started ${Math.abs(days)} day(s) early`,
      tone: 'positive',
    };
  }
}
