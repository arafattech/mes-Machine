import { Component, Input, ViewChild } from '@angular/core';
import { ProductionLogFormComponent } from '@production-module/production-plan-log/Production-logs/production-log-form/production-log-form.component';
import { ActivatedRoute } from '@angular/router';
import { ValueFormatterParams } from 'ag-grid-community';
import moment from 'moment';
import { finalize } from 'rxjs';
import { timer } from 'rxjs/internal/observable/timer';
import { Subscription } from 'rxjs/internal/Subscription';
import {
  AmChartDataPoint,
  AmChartDataset,
} from '@production-module/shared/components/am-activity-chart/am-activity-chart.component';
import { DivergentBarData } from '@production-module/shared/components/am-divergent-stacked-bar/am-divergent-stacked-bar.component';
import { DateHours } from '@production-module/shared/utils/types';
import { CommonService } from '@app/services/common-service/common.service';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { Permissions } from '@app/shared/enums/permissions';
import { MachineStatesService } from '@app/modules/production-management/shared/services/machine-states.service';
import {
  MachineDurations,
  MachineDurationService,
  MachineStateEventRow,
} from '@production-module/shared/services/machine-duration.service';
import {
  DailyStateBreakdown,
  MachineRuntimeHistoryService,
} from '@production-module/shared/services/machine-runtime-history.service';
import { MachineOverviewDataService } from '@production-module/shared/services/machine-overview-data.service';
import { DurationPipe } from '@production-module/shared/pipes/duration.pipe';
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@shared/components/ag-grid-table/types/ag-grid-table.types';
import { Metric, ShiftBreakdownRow } from '../../interface/interface';

interface DrillDownRow {
  machineStateId: number | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
}

/** Seconds per `machine_states.id`, dynamic — not a fixed active/idle/inactive/maintenance set. */
type DrillDownSummary = Partial<Record<number, number>>;

const durationPipe = new DurationPipe();
const DATE_RANGE_FORMAT = 'DD/MM/YYYY';

@Component({
  selector: 'app-machine-overview',
  templateUrl: './machine-overview.component.html',
  styleUrl: './machine-overview.component.scss',
})
export class MachineOverviewComponent {
  @Input() status = 'ACTIVE';
  @ViewChild('logFormRef') logFormRef!: ProductionLogFormComponent;

  durations: MachineDurations = {
    perState: {},
    current: null,
    currentSeconds: 0,
    total: 0,
    lastSeenAt: null,
  };
  machineKey: string | null = null;
  private sub?: Subscription;

  /** True once the user has explicitly picked a range — drives the "showing a snapshot" hint text. */
  isFiltered = false;

  loadingActivity = false;
  loading7Days = false;
  loadingOEE = false;
  loadingShiftBreakdown = false;
  loadingSpecs = false;
  loadingStates = false;

  target = 0;
  achieved = 0;
  ok = 0;
  total = 0;
  waste = 0;
  machineData: {
    id: string;
    name: string;
    status: string;
    maxRpm: number;
    minRpm: number;
    maxTemp: number;
    minTemp: number;
  } | null = null;

  menuItems = ['Machine Board', 'Production Orders'];
  canConfigureMachines = false;

  selectedTab: 'overview' | 'workOrder' = 'overview';

  onTabSelect(event: any): void {
    this.selectedTab = event.detail.tab.id;
  }

  /** Bumped after a manual production log so `app-machine-work-orders` re-fetches its
   * open-work-order list + default selection — a fresh log can resolve a new "current"
   * work order or change an existing one's status. */
  workOrderRefreshToken = 0;

  /** Live header badge (icon/label/color/tint) driven by the machine's current
   * `machine_state_id` (`durations.current`) via `MachineStatesService` — the single
   * source of truth for state display, not a hardcoded per-status map. */
  get statusIcon(): string {
    return this.machineStates.getIcon(this.durations.current);
  }

  get statusLabel(): string {
    return this.machineStates.getLabel(this.durations.current);
  }

  get statusColor(): string {
    return this.machineStates.getColor(this.durations.current);
  }

  get statusTint(): string {
    return this.machineStates.getTint(this.durations.current);
  }

  /** Default: start of current month through now. Inclusive end-of-day once the user picks an explicit range. */
  rangeFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  rangeTo = new Date();
  /** rangeTo is an exclusive query boundary (day-after for picker ranges); this holds the actual inclusive end date for display. */
  rangeToDisplay = new Date();
  dateRangeValue = '';
  maxDate = moment().format('DD-MM-YYYY');

  dailyBreakdown: DailyStateBreakdown[] = [];
  dailyProductionData: DivergentBarData[] = [];
  /** Divergent chart — always today only, not tied to the date-range filter. */
  todayProductionData: DivergentBarData[] = [];
  runtime: DateHours[] = [];
  datasets: AmChartDataset[] = [];
  metrics: Metric[] = [
    { label: 'Product Availability', value: 0, unit: '%', color: 'green', icon: 'box' },
    { label: 'M/C Performance', value: 0, unit: '%', color: 'purple', icon: 'cog' },
    { label: 'Quality', value: 0, unit: '%', color: 'orange', icon: 'sparkles' },
    { label: 'M/C EFFICIENCY', value: 0, unit: '%', color: 'rose', icon: 'wrench' },
  ];

  get todayChartTitle(): string {
    const d = new Date();
    return `Last 7 Days – Good vs Wastage`;
  }

  drillDownOpen = false;
  drillDownLoading = false;
  drillDownTitle = '';
  drillDownRows: DrillDownRow[] = [];
  drillDownSummary: DrillDownSummary = {};
  /** Stable reference, only reassigned on a real fetch — an inline object literal in the template
   * would be recreated on every change-detection pass (e.g. the left panel's 1s tick) and reset
   * the grid's data source needlessly while the dialog is open. */
  drillDownDataSource: AgGridTableODataSourceConfig<DrillDownRow> = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: 'State Events',
    showSearch: false,
    showRowCount: true,
    showSegmentButton: false,
    showNewButton: false,
  };
  displayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 560px)',
  };

  /** Stable reference, reassigned whole-object on refetch — same reasoning as `drillDownDataSource`. */
  shiftBreakdownDataSource: AgGridTableODataSourceConfig<ShiftBreakdownRow> = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    sortDirection: 'asc',
    data: [],
  };
  shiftBreakdownToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: 'Shift Breakdown',
    showSearch: false,
    showRowCount: true,
    showSegmentButton: false,
    showNewButton: false,
  };
  /** Fixed px, not '100%' — `ag-grid-table`'s internal `.ag-grid-table-shell` wrapper is a
   * plain block (height:auto), so a percentage height collapses to zero; this shared
   * component only supports concrete/calc() heights, same as every other usage in the app. */
  shiftBreakdownDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: '400px',
  };
  /** Built once `MachineStatesService.loadAll()` resolves (see constructor) — one column
   * per active `machine_states` row, not a fixed Active/Idle/Inactive/Maintenance set. */
  shiftBreakdownColumns: AgGridTableColumn<ShiftBreakdownRow>[] = [];

  private buildShiftBreakdownColumns(): AgGridTableColumn<ShiftBreakdownRow>[] {
    const stateColumns: AgGridTableColumn<ShiftBreakdownRow>[] =
      this.machineStates.getAll().map((state) => ({
        colId: `state_${state.id}`,
        headerName: `${state.name} (h)`,
        valueGetter: (p: { data?: ShiftBreakdownRow }) =>
          p.data?.states.find((s) => s.machineStateId === state.id)?.hours ?? 0,
        valueFormatter: (p: ValueFormatterParams<ShiftBreakdownRow, number>) =>
          (p.value ?? 0).toFixed(1),
      }));

    return [
      {
        field: 'date',
        headerName: $localize`Date`,
      },
      { field: 'shiftName', headerName: $localize`Shift` },
      ...stateColumns,
      {
        field: 'totalHours',
        headerName: $localize`Total (h)`,
        valueFormatter: (p: ValueFormatterParams<ShiftBreakdownRow, number>) =>
          (p.value ?? 0).toFixed(1),
      },
    ];
  }

  drillDownColumns: AgGridTableColumn<DrillDownRow>[] = [
    {
      field: 'machineStateId',
      headerName: $localize`State`,
      valueFormatter: (p: ValueFormatterParams<DrillDownRow, number | null>) =>
        this.machineStates.getLabel(p.value),
      cellStyle: (p: { value: number | null }) => ({
        color: this.machineStates.getColor(p.value),
        fontWeight: 600,
      }),
    },
    {
      field: 'started_at',
      headerName: $localize`Start`,
      valueFormatter: (p: ValueFormatterParams<DrillDownRow, string>) =>
        p.value ? new Date(p.value).toLocaleString() : '',
    },
    {
      field: 'ended_at',
      headerName: $localize`End`,
      valueFormatter: (p: ValueFormatterParams<DrillDownRow, string | null>) =>
        p.value ? new Date(p.value).toLocaleString() : $localize`In progress`,
    },
    {
      field: 'duration_seconds',
      headerName: $localize`Duration`,
      valueFormatter: (p: ValueFormatterParams<DrillDownRow, number>) =>
        durationPipe.transform(p.value),
    },
  ];

  /** Keeps the same OEE tile component instances across the 30s live refresh instead of
   * destroy/recreate on every new `metrics` array — that recreate was the visible "flash". */
  trackByMetricLabel = (_: number, m: Metric): string => m.label;

  get periodLabel(): string {
    return `${moment(this.rangeFrom).format('MMM D, YYYY')} – ${moment(this.rangeToDisplay).format('MMM D, YYYY')}`;
  }

  constructor(
    private commonService: CommonService,
    private durationService: MachineDurationService,
    private runtimeHistoryService: MachineRuntimeHistoryService,
    private overviewDataService: MachineOverviewDataService,
    private rolePermissionService: RolePermissionService,
    private route: ActivatedRoute,
    public machineStates: MachineStatesService,
  ) {}

  ngOnInit() {
    this.commonService.sidenavHidden.emit(true);
    this.machineStates.loadAll().subscribe(() => {
      this.shiftBreakdownColumns = this.buildShiftBreakdownColumns();
    });
    this.canConfigureMachines = this.rolePermissionService.hasPermission(
      Permissions.BASE_DATA_MACHINE_CONFIG,
    );
    this.dateRangeValue = `${moment(this.rangeFrom).format(DATE_RANGE_FORMAT)} - ${moment(this.rangeTo).format(DATE_RANGE_FORMAT)}`;

    this.route.queryParams.subscribe((params) => {
      this.machineData = {
        id: params['id'] || 'N/A',
        name: params['name'] || 'N/A',
        status: params['status'] || 'N/A',
        maxRpm: 0,
        minRpm: 0,
        maxTemp: 0,
        minTemp: 0,
      };
      this.status = this.machineData.status;
      this.machineKey =
        params['machineId'] != null ? String(params['machineId']) : null;
      this.loadOverviewData();
      this.loadLast7DaysProduction();
    });

    // Live per-state durations from the shared tracker (left panel only), refreshed every second.
    this.sub = timer(0, 1000).subscribe(() => {
      this.durations = this.durationService.snapshot(this.machineKey);
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  openLogProductionForm(): void {
    this.logFormRef.openDialog();
  }

  /** After a manual production-count entry, bump the token so `app-machine-work-orders`
   * re-fetches — the newly logged bucket may resolve a new "current" work order or change
   * an existing one's progress. */
  onProductionLogged(): void {
    this.workOrderRefreshToken++;
    this.loadOverviewData();
    this.loadLast7DaysProduction();
  }

  /** Percentage share of a state's duration within today's total. */
  pct(seconds: number): number {
    if (!this.durations.total) return 0;
    return Math.round((seconds / this.durations.total) * 100);
  }

  private resetRangeToCurrentMonth(): void {
    const now = new Date();
    this.rangeFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    this.rangeTo = now;
    this.rangeToDisplay = now;
  }

  onDateRangeChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    if (!value) return;

    const [startStr, endStr] = value.split(' - ');
    const start = moment(startStr, DATE_RANGE_FORMAT);
    const end = moment(endStr, DATE_RANGE_FORMAT);
    if (!start.isValid() || !end.isValid()) return;

    this.isFiltered = true;
    this.rangeFrom = start.startOf('day').toDate();
    this.rangeToDisplay = end.startOf('day').toDate();
    // Exclusive end boundary — push to the day after so the picked end date is fully included.
    this.rangeTo = end.startOf('day').add(1, 'day').toDate();
    this.dateRangeValue = value;
    this.loadOverviewData();
  }

  resetDateRange(): void {
    this.isFiltered = false;
    this.resetRangeToCurrentMonth();
    this.dateRangeValue = `${moment(this.rangeFrom).format(DATE_RANGE_FORMAT)} - ${moment(this.rangeTo).format(DATE_RANGE_FORMAT)}`;
    this.loadOverviewData();
  }

  onDay(e: DateHours) {
    const dayEnd = new Date(e.date.getTime() + 86_400_000);
    this.openDrillDown(
      e.date,
      dayEnd,
      $localize`${e.date.toLocaleDateString()} state events`,
    );
  }

  onPointClick(event: {
    datasetIndex: number;
    dataIndex: number;
    value: AmChartDataPoint;
  }) {
    const day = this.dailyBreakdown[event.dataIndex];
    if (!day) return;
    const dayEnd = new Date(day.date.getTime() + 86_400_000);
    this.openDrillDown(
      day.date,
      dayEnd,
      $localize`State events of : ${day.date.toLocaleDateString()}`,
    );
  }

  closeDrillDown() {
    this.drillDownOpen = false;
  }

  private async openDrillDown(
    start: Date,
    end: Date,
    title: string,
  ): Promise<void> {
    if (!this.machineKey) return;
    this.drillDownTitle = title;
    this.drillDownOpen = true;
    this.drillDownLoading = true;
    try {
      const rows = await this.runtimeHistoryService.getEventsInRange(
        this.machineKey,
        start,
        end,
      );
      this.drillDownRows = rows.map((row) =>
        this.toDrillDownRow(row, start, end),
      );
    } catch {
      this.drillDownRows = [];
    }
    this.drillDownSummary = this.summarizeDrillDownRows(this.drillDownRows);
    this.drillDownDataSource = {
      ...this.drillDownDataSource,
      data: this.drillDownRows,
    };
    this.drillDownLoading = false;
  }

  private summarizeDrillDownRows(rows: DrillDownRow[]): DrillDownSummary {
    const summary: DrillDownSummary = {};
    for (const row of rows) {
      if (row.machineStateId == null) continue;
      summary[row.machineStateId] =
        (summary[row.machineStateId] ?? 0) + row.duration_seconds;
    }
    return summary;
  }

  private toDrillDownRow(
    row: MachineStateEventRow,
    start: Date,
    end: Date,
  ): DrillDownRow {
    // Clipped to the requested window — a row crossing the boundary (e.g. a state that
    // started the day before) must only count its portion inside this window, or the
    // summary/duration overcounts past the window's real length.
    const durationSeconds = this.runtimeHistoryService.clippedDurationSeconds(
      row,
      start,
      end,
    );
    return {
      machineStateId: row.machine_state_id,
      started_at: row.started_at,
      ended_at: row.ended_at,
      duration_seconds: durationSeconds,
    };
  }

  private loadLast7DaysProduction(): void {
    if (!this.machineKey) return;

    const todayEnd = new Date();
    todayEnd.setHours(0, 0, 0, 0);
    todayEnd.setDate(todayEnd.getDate() + 1); // exclusive: tomorrow midnight

    const sevenDaysAgo = new Date(todayEnd);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7); // 7 days back

    this.loading7Days = true;
    this.overviewDataService
      .getDailyProduction(this.machineKey, sevenDaysAgo, todayEnd)
      .pipe(finalize(() => this.loading7Days = false))
      .subscribe((rows) => {
        this.todayProductionData = rows.map((r) => ({
          category: moment(r.date).format('ddd, MMM D'),
          good:     r.good,
          wastage:  r.scrap,
        }));
      });
  }

  private loadOverviewData(): void {
    if (!this.machineKey) return;
    const key = this.machineKey;
    const from = this.rangeFrom;
    const to = this.rangeTo;

    this.loadingActivity = true;
    this.runtimeHistoryService
      .getDailyBreakdown(key, from, to)
      .then((breakdown) => {
        // Sync today's historical bar with the exact live "State Durations" panel
        const todayStr = new Date().toDateString();
        const todayBreakdown = breakdown.find(b => b.date.toDateString() === todayStr);
        if (todayBreakdown) {
          const liveDurations = this.durationService.snapshot(key);
          const liveHoursByState: Record<number, number> = {};
          if (liveDurations.perState) {
            for (const [sId, seconds] of Object.entries(liveDurations.perState)) {
              if (seconds != null) {
                liveHoursByState[Number(sId)] = seconds / 3600;
              }
            }
          }
          todayBreakdown.hoursByState = liveHoursByState;
        }

        this.dailyBreakdown = breakdown;
        this.runtime = this.runtimeHistoryService.toActiveHours(breakdown);
        this.datasets = this.runtimeHistoryService.toStateDatasets(breakdown);
      })
      .catch(() => {
        this.dailyBreakdown = [];
        this.runtime = [];
        this.datasets = [];
      })
      .finally(() => this.loadingActivity = false);

    this.overviewDataService
      .getDailyProduction(key, from, to)
      .subscribe((rows) => {
        this.dailyProductionData = rows.map((r) => ({
          category: moment(r.date).format('MMM D'),
          good: r.good,
          wastage: r.scrap,
        }));
      });

    this.loadingSpecs = true;
    this.overviewDataService
      .getSpecs(key)
      .pipe(finalize(() => this.loadingSpecs = false))
      .subscribe((specs) => {
        if (!this.machineData) return;
        this.machineData = { ...this.machineData, ...specs };
      });

    // All 4 OEE tiles from one call/window, so Efficiency = Availability × Performance × Quality holds on screen.
    this.loadingOEE = true;
    this.overviewDataService
      .getOverview(key, from, to)
      .pipe(finalize(() => this.loadingOEE = false))
      .subscribe(({ production, oeeMetrics }) => {
        this.target = production.productionTarget;
        this.achieved = production.productionAchieved;
        this.ok = production.machineOk;
        this.total = production.machineTotal;
        this.waste = production.wastage;
        this.metrics = oeeMetrics;
      });

    this.loadingShiftBreakdown = true;
    this.overviewDataService
      .getShiftBreakdown(key, from, to)
      .pipe(finalize(() => this.loadingShiftBreakdown = false))
      .subscribe((rows) => {
        const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date));
        this.shiftBreakdownDataSource = {
          ...this.shiftBreakdownDataSource,
          data: sorted,
        };
      });
  }
}
