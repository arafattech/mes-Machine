import { Component, DestroyRef, EventEmitter, OnInit, Output, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ValueFormatterParams } from 'ag-grid-community';
import { EMPTY, Subject, finalize, switchMap } from 'rxjs';
import { AmChartDataPoint, AmChartDataset } from '@production-module/shared/components/am-activity-chart/am-activity-chart.component';
import { DivergentBarData } from '@production-module/shared/components/am-divergent-stacked-bar/am-divergent-stacked-bar.component';
import { MachineStatesService } from '@app/modules/production-management/shared/services/machine-states.service';
import { MachineDashboardStore } from '@production-module/shared/services/machine-dashboard.store';
import { MachineStateEventRow } from '@production-module/shared/services/machine-duration.service';
import {
  DailyStateBreakdown,
  MachineRuntimeHistoryService,
  StateRangeSummary,
} from '@production-module/shared/services/machine-runtime-history.service';
import { MachineOverviewDataService } from '@production-module/shared/services/machine-overview-data.service';
import {
  MachineProductionChange,
  ProductionRealtimeService,
} from '@production-module/shared/services/production-realtime.service';
import { DurationPipe } from '@production-module/shared/pipes/duration.pipe';
import {
  CascadeStep,
  DailyGood,
  DailyGoodBar,
  achievementPercent,
  biggestLosses,
  buildOeeCascade,
  clampPercent,
  dailyGoodRange,
  dailyGoodSummary,
  hoursText,
  percentText,
  toDailyGoodBars,
  yieldText,
} from '@production-module/shared/utils/oee-insights';
import {
  MachineProductionLogRow,
  ShiftBreakdownRow,
  ShiftOption,
} from '@production-module/shared/interface/interface';
import {
  MS_PER_DAY,
  factoryDateKey,
  factoryDayStart,
  factoryMidnight,
  factoryMonthStart,
  factoryToday,
  formatFactoryDate,
  formatFactoryDateTime,
  formatFactoryDayMonth,
  fromPickerDate,
} from '@shared/utilities/date-format';
import { AgGridTableComponent } from '@shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  GridTableColumnDataType,
} from '@shared/components/ag-grid-table/types/ag-grid-table.types';

interface DrillDownRow {
  machineStateId: number | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
}

/** Seconds per `machine_states.id`, dynamic — not a fixed active/idle/inactive/maintenance set. */
type DrillDownSummary = Partial<Record<number, number>>;

interface DowntimeRow extends StateRangeSummary {
  productive: boolean;
  category: string;
  share: number;
}

type OeeDashboardTab = 'overview' | 'downtime' | 'productionLog' | 'workOrder';

const MAX_LOSSES_SHOWN = 3;
/** Narrower "today by state" segments carry their hours in the tooltip only. */
const MIN_LABELLED_SEGMENT_PCT = 9;

const durationPipe = new DurationPipe();

/**
 * `MachineDashboardViewType.OEE_PRODUCTION` — the analytical dashboard: state durations, shift
 * breakdown, activity / production charts and OEE for a date range, plus downtime analysis and the
 * machine's production log. Machine identity, live state, OEE figures and the realtime feed come
 * from the host's `MachineDashboardStore`.
 */
@Component({
  selector: 'app-oee-production-dashboard',
  templateUrl: './oee-production-dashboard.component.html',
  styleUrl: './oee-production-dashboard.component.scss',
  host: { class: 'block h-full' },
})
export class OeeProductionDashboardComponent implements OnInit {
  @Output() logProduction = new EventEmitter<void>();
  @ViewChild('productionLogGrid') productionLogGrid?: AgGridTableComponent<MachineProductionLogRow>;

  protected readonly store = inject(MachineDashboardStore);
  protected readonly machineStates = inject(MachineStatesService);
  private readonly runtimeHistoryService = inject(MachineRuntimeHistoryService);
  private readonly overviewDataService = inject(MachineOverviewDataService);
  private readonly productionRealtime = inject(ProductionRealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  /** Latest request wins — a slower earlier response can never overwrite a newer one. */
  private readonly last7DaysLoad$ = new Subject<boolean>();
  private readonly periodProductionLoad$ = new Subject<void>();

  /** True once the user has explicitly picked a range — drives the "showing a snapshot" hint text. */
  isFiltered = false;

  loadingActivity = false;
  loading7Days = false;
  loadingShiftBreakdown = false;

  selectedTab: OeeDashboardTab = 'overview';

  /** Bumped after a production change so `app-machine-work-orders` re-fetches its open-work-order
   * list + default selection — a fresh log can resolve a new "current" work order. */
  workOrderRefreshToken = 0;

  /** Default: start of current month through now. Inclusive end-of-day once the user picks an explicit range. */
  rangeFrom = factoryMonthStart();
  rangeTo = new Date();
  /** rangeTo is an exclusive query boundary (day-after for picker ranges); this holds the actual inclusive end date for display. */
  rangeToDisplay = new Date();
  dateRangeValue = '';
  readonly maxDate = formatFactoryDate(factoryToday());

  dailyBreakdown: DailyStateBreakdown[] = [];
  /** Divergent chart — always the last 7 days, not tied to the date-range filter. */
  todayProductionData: DivergentBarData[] = [];
  datasets: AmChartDataset[] = [];
  readonly todayChartTitle = $localize`Good vs wastage, last 7 days`;

  /** OEE (index 3 of the store's metrics). `null` renders "—", never 0. */
  protected readonly oeeText = computed(() => percentText(this.store.metrics()[3]?.value ?? null));

  /**
   * The OEE loss cascade: tracked time → after stops (Availability) → after slow running
   * (Performance) → after rejects (Quality) = OEE. Each step shows the inputs it was computed
   * from, so a low OEE explains itself; an unmeasured factor says what's needed to measure it.
   */
  protected readonly cascade = computed<CascadeStep[]>(() =>
    buildOeeCascade(this.store.metrics(), this.store.oeeInputs()),
  );

  protected readonly yieldText = computed(() => yieldText(this.store.production()));

  /** Good output per day over the selected period (micro chart scaled to the best day). */
  private readonly periodProduction = signal<DailyGood[]>([]);
  protected readonly dailyGood = computed<DailyGoodBar[]>(() => toDailyGoodBars(this.periodProduction()));
  protected readonly sparklineRange = computed(() => dailyGoodRange(this.periodProduction()));
  protected readonly sparklineLabel = computed(() => dailyGoodSummary(this.periodProduction()));

  protected readonly achievement = computed(() => achievementPercent(this.store.production()));
  protected readonly achievementText = computed(() => {
    const value = this.achievement();
    return value === null ? $localize`No target for this period` : `${value} %`;
  });
  protected readonly achievementProgress = computed(() => clampPercent(this.achievement()));
  protected readonly achievementColor = computed(() =>
    (this.achievement() ?? 0) >= 100 ? 'var(--sapPositiveTextColor)' : 'var(--sapTextColor)',
  );

  drillDownOpen = false;
  drillDownLoading = false;
  drillDownTitle = '';
  drillDownSummary: DrillDownSummary = {};
  /** Stable reference, only reassigned on a real fetch — an inline object literal in the template
   * would be recreated on every change-detection pass (e.g. the 1s live tick) and reset the
   * grid's data source needlessly while the dialog is open. */
  drillDownDataSource: AgGridTableODataSourceConfig<DrillDownRow> = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };
  readonly toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`State events`,
    showSearch: false,
    showRowCount: true,
    showSegmentButton: false,
    showNewButton: false,
  };
  readonly displayConfig: AgGridTableDisplayConfig = {
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
  readonly shiftBreakdownToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Time by shift`,
    showSearch: false,
    showRowCount: true,
    showSegmentButton: false,
    showNewButton: false,
  };
  /** Built once `MachineStatesService.loadAll()` resolves — one column per active
   * `machine_states` row, not a fixed Active/Idle/Inactive/Maintenance set. */
  shiftBreakdownColumns: AgGridTableColumn<ShiftBreakdownRow>[] = [];

  /** Today's split by state as one labelled bar (live). */
  protected readonly todaySegments = computed(() => {
    const { perState, total } = this.store.durations();
    return this.machineStates
      .getAll()
      .filter((state) => (perState[state.id!] ?? 0) > 0)
      .map((state) => {
        const seconds = perState[state.id!] ?? 0;
        const percent = total > 0 ? (seconds / total) * 100 : 0;
        return {
          stateId: state.id!,
          color: this.machineStates.getColor(state.id),
          percent,
          hours: hoursText(seconds),
          showHours: percent >= MIN_LABELLED_SEGMENT_PCT,
          title: `${this.machineStates.getLabel(state.id)} ${hoursText(seconds)}`,
        };
      });
  });

  /** Per-state totals for the selected range; productive vs non-productive via `counts_as_productive`. */
  protected readonly downtimeRows = signal<DowntimeRow[]>([]);
  protected readonly productiveSeconds = computed(() =>
    this.downtimeRows().filter((r) => r.productive).reduce((sum, r) => sum + r.seconds, 0),
  );
  protected readonly nonProductiveSeconds = computed(() =>
    this.downtimeRows().filter((r) => !r.productive).reduce((sum, r) => sum + r.seconds, 0),
  );
  protected readonly nonProductiveShare = computed(() => {
    const total = this.productiveSeconds() + this.nonProductiveSeconds();
    return total > 0 ? Math.round((this.nonProductiveSeconds() / total) * 1000) / 10 : null;
  });
  protected readonly stateChangeCount = computed(() => this.downtimeRows().reduce((sum, r) => sum + r.events, 0));
  /** Where the period's time went when the machine wasn't producing — largest first. */
  protected readonly biggestLosses = computed(() =>
    biggestLosses(this.downtimeRows(), this.machineStates.getProductiveIds(), MAX_LOSSES_SHOWN).map((loss) => ({
      ...loss,
      label: this.machineStates.getLabel(loss.stateId),
      color: this.machineStates.getColor(loss.stateId),
    })),
  );
  downtimeDataSource: AgGridTableODataSourceConfig<DowntimeRow> = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };
  readonly downtimeToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Time by state`,
    showSearch: false,
    showRowCount: true,
    showSegmentButton: false,
    showNewButton: false,
  };
  /** Concrete `calc()`, not '100%' — `ag-grid-table`'s internal shell is height:auto, so a
   * percentage collapses to zero. Sized so the whole grid — its bottom edge and the horizontal
   * scrollbar the 8-column "Time by shift" grid needs — stays inside the Downtime tab. */
  readonly downtimeDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 380px)',
  };
  readonly downtimeColumns: AgGridTableColumn<DowntimeRow>[] = [
    {
      field: 'stateId',
      headerName: $localize`State`,
      dataType: GridTableColumnDataType.String,
      valueFormatter: (p: ValueFormatterParams<DowntimeRow, number>) => this.machineStates.getLabel(p.value),
      cellStyle: (p: { value: number | null }) => ({ color: this.machineStates.getColor(p.value), fontWeight: 600 }),
    },
    { field: 'category', headerName: $localize`Category`, dataType: GridTableColumnDataType.String },
    {
      field: 'seconds',
      headerName: $localize`Time`,
      dataType: GridTableColumnDataType.Number,
      valueFormatter: (p: ValueFormatterParams<DowntimeRow, number>) => durationPipe.transform(p.value),
    },
    {
      field: 'share',
      headerName: $localize`Share (%)`,
      dataType: GridTableColumnDataType.Number,
      valueFormatter: (p: ValueFormatterParams<DowntimeRow, number>) => (p.value ?? 0).toFixed(1),
    },
  ];

  /** Server-paged (`$top/$skip`) — never loads the machine's full history. */
  productionLogDataSource: AgGridTableODataSourceConfig<MachineProductionLogRow> = {
    type: 'api',
    endpoint: '',
    customEndpoint: 'production-logs',
    fromCustomPaginator: true,
    pageSize: 40,
    scrollPagination: true,
    searchFields: ['work_order.custom_id'],
  };
  readonly productionLogToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Production Log`,
    showSearch: true,
    searchPlaceholder: $localize`Search production order`,
    showRowCount: true,
    showNewButton: false,
  };
  readonly productionLogDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 215px)',
  };
  productionLogDateRange = '';
  productionLogColumns: AgGridTableColumn<MachineProductionLogRow>[] = this.buildProductionLogColumns([]);

  readonly drillDownColumns: AgGridTableColumn<DrillDownRow>[] = [
    {
      field: 'machineStateId',
      headerName: $localize`State`,
      valueFormatter: (p: ValueFormatterParams<DrillDownRow, number | null>) => this.machineStates.getLabel(p.value),
      cellStyle: (p: { value: number | null }) => ({
        color: this.machineStates.getColor(p.value),
        fontWeight: 600,
      }),
    },
    {
      field: 'started_at',
      headerName: $localize`Start`,
      valueFormatter: (p: ValueFormatterParams<DrillDownRow, string>) => formatFactoryDateTime(p.value),
    },
    {
      field: 'ended_at',
      headerName: $localize`End`,
      valueFormatter: (p: ValueFormatterParams<DrillDownRow, string | null>) =>
        formatFactoryDateTime(p.value) || $localize`In progress`,
    },
    {
      field: 'duration_seconds',
      headerName: $localize`Duration`,
      valueFormatter: (p: ValueFormatterParams<DrillDownRow, number>) => durationPipe.transform(p.value),
    },
  ];

  get periodLabel(): string {
    return `${formatFactoryDate(this.rangeFrom)} – ${formatFactoryDate(this.rangeToDisplay)}`;
  }

  private get machineKey(): string | null {
    return this.store.machineKey();
  }

  ngOnInit(): void {
    this.initLast7DaysLoader();
    this.initPeriodProductionLoader();
    this.machineStates.loadAll().subscribe(() => {
      this.shiftBreakdownColumns = this.buildShiftBreakdownColumns();
    });
    this.overviewDataService
      .getActiveShifts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((shifts) => (this.productionLogColumns = this.buildProductionLogColumns(shifts)));
    this.dateRangeValue = this.formatRange();
    this.applyProductionLogFilter();

    this.loadOverviewData();
    this.loadLast7DaysProduction();

    // Push-driven, no polling: OEE / production summary / current work order are refetched by the store.
    this.store.changes$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((change) => this.onProductionChange(change));

    this.productionRealtime
      .workOrderRecordChanges$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.workOrderRefreshToken++);
  }

  onTabSelect(event: Event): void {
    this.selectedTab = (event as CustomEvent<{ tab: HTMLElement }>).detail.tab.id as OeeDashboardTab;
  }

  onDateRangeChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!value) return;

    const [start, end] = value.split(' - ').map(fromPickerDate);
    if (!start || !end) return;

    this.isFiltered = true;
    this.rangeFrom = factoryMidnight(start);
    this.rangeToDisplay = factoryMidnight(end);
    // Exclusive end boundary — the next factory midnight, so the picked end date is fully included.
    this.rangeTo = new Date(this.rangeToDisplay.getTime() + MS_PER_DAY);
    this.dateRangeValue = value;
    this.loadOverviewData();
  }

  resetDateRange(): void {
    this.isFiltered = false;
    const now = new Date();
    this.rangeFrom = factoryMonthStart();
    this.rangeTo = now;
    this.rangeToDisplay = now;
    this.dateRangeValue = this.formatRange();
    this.loadOverviewData();
  }

  onProductionLogDateRangeChange(value: string): void {
    this.productionLogDateRange = value && value.includes(' - ') ? value : '';
    this.applyProductionLogFilter();
  }

  onPointClick(event: { datasetIndex: number; dataIndex: number; value: AmChartDataPoint }): void {
    const day = this.dailyBreakdown[event.dataIndex];
    if (!day) return;
    const dayEnd = new Date(day.date.getTime() + MS_PER_DAY);
    this.openDrillDown(day.date, dayEnd, $localize`State events of : ${formatFactoryDate(day.date)}`);
  }

  closeDrillDown(): void {
    this.drillDownOpen = false;
  }

  private async openDrillDown(start: Date, end: Date, title: string): Promise<void> {
    if (!this.machineKey) return;
    this.drillDownTitle = title;
    this.drillDownOpen = true;
    this.drillDownLoading = true;
    let rows: DrillDownRow[] = [];
    try {
      const events = await this.runtimeHistoryService.getEventsInRange(this.machineKey, start, end);
      rows = events.map((row) => this.toDrillDownRow(row, start, end));
    } catch {
      rows = [];
    }
    this.drillDownSummary = this.summarizeDrillDownRows(rows);
    this.drillDownDataSource = { ...this.drillDownDataSource, data: rows };
    this.drillDownLoading = false;
  }

  private summarizeDrillDownRows(rows: DrillDownRow[]): DrillDownSummary {
    const summary: DrillDownSummary = {};
    for (const row of rows) {
      if (row.machineStateId == null) continue;
      summary[row.machineStateId] = (summary[row.machineStateId] ?? 0) + row.duration_seconds;
    }
    return summary;
  }

  private toDrillDownRow(row: MachineStateEventRow, start: Date, end: Date): DrillDownRow {
    // Clipped to the requested window — a row crossing the boundary (e.g. a state that
    // started the day before) must only count its portion inside this window, or the
    // summary/duration overcounts past the window's real length.
    return {
      machineStateId: row.machine_state_id,
      started_at: row.started_at,
      ended_at: row.ended_at,
      duration_seconds: this.runtimeHistoryService.clippedDurationSeconds(row, start, end),
    };
  }

  /**
   * Realtime push handler for this view's own panels (silent, no busy overlays):
   * - `state`: nothing here — the store refetches the OEE snapshot;
   * - `production`: the 7-day chart, and the work-order list when a work order was involved;
   * - `resync`: socket reconnected or a log was just entered — refetch all of the above.
   */
  private onProductionChange(change: MachineProductionChange): void {
    if (change.kind === 'state') return;

    this.loadLast7DaysProduction(false);
    this.periodProductionLoad$.next();
    if (change.kind === 'resync' || change.workOrderIds.length > 0) {
      this.workOrderRefreshToken++;
    }
    if (change.kind === 'resync' && this.selectedTab === 'productionLog') {
      this.productionLogGrid?.refreshGridData(true);
    }
  }

  private formatRange(): string {
    return `${formatFactoryDate(this.rangeFrom)} - ${formatFactoryDate(this.rangeTo)}`;
  }

  private loadOverviewData(): void {
    const key = this.machineKey;
    if (!key) return;
    const from = this.rangeFrom;
    const to = this.rangeTo;

    // Default month-to-date runs live through the end of today; a picker range is fixed.
    this.store.setOverviewRange(from, this.isFiltered ? to : null);
    this.periodProductionLoad$.next();

    this.loadingActivity = true;
    this.runtimeHistoryService
      .getRangeAnalysis(key, from, to)
      .then(({ daily, stateSummary }) => {
        this.syncTodayWithLiveDurations(daily);
        this.dailyBreakdown = daily;
        this.datasets = this.runtimeHistoryService.toStateDatasets(daily);
        this.setDowntimeRows(stateSummary);
      })
      .catch(() => {
        this.dailyBreakdown = [];
        this.datasets = [];
        this.setDowntimeRows([]);
      })
      .finally(() => (this.loadingActivity = false));

    this.loadingShiftBreakdown = true;
    this.overviewDataService
      .getShiftBreakdown(key, from, to)
      .pipe(
        finalize(() => (this.loadingShiftBreakdown = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((rows) => {
        const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date));
        this.shiftBreakdownDataSource = { ...this.shiftBreakdownDataSource, data: sorted };
      });
  }

  /** Today's historical bar mirrors the exact live "State Durations" panel. */
  private syncTodayWithLiveDurations(daily: DailyStateBreakdown[]): void {
    const today = factoryToday();
    const todayBreakdown = daily.find((b) => factoryDateKey(b.date) === today);
    if (!todayBreakdown) return;
    const liveHoursByState: Record<number, number> = {};
    for (const [stateId, seconds] of Object.entries(this.store.durations().perState)) {
      if (seconds != null) liveHoursByState[Number(stateId)] = seconds / 3600;
    }
    todayBreakdown.hoursByState = liveHoursByState;
  }

  private setDowntimeRows(summary: StateRangeSummary[]): void {
    const productiveIds = this.machineStates.getProductiveIds();
    const total = summary.reduce((sum, s) => sum + s.seconds, 0);
    const rows = summary.map((s) => {
      const productive = productiveIds.has(s.stateId);
      return {
        ...s,
        productive,
        category: productive ? $localize`Productive` : $localize`Non-productive`,
        share: total > 0 ? (s.seconds / total) * 100 : 0,
      };
    });
    this.downtimeRows.set(rows);
    this.downtimeDataSource = { ...this.downtimeDataSource, data: rows };
  }

  private loadLast7DaysProduction(showLoading = true): void {
    this.last7DaysLoad$.next(showLoading);
  }

  /** Good per day across the selected period, for the production sparkline. */
  private initPeriodProductionLoader(): void {
    this.periodProductionLoad$
      .pipe(
        switchMap(() => {
          if (!this.machineKey) return EMPTY;
          const to = this.isFiltered ? this.rangeTo : new Date(factoryDayStart().getTime() + MS_PER_DAY);
          return this.overviewDataService.getDailyProduction(this.machineKey, this.rangeFrom, to);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((rows) => this.periodProduction.set(rows.map((r) => ({ date: r.date, good: r.good }))));
  }

  private initLast7DaysLoader(): void {
    this.last7DaysLoad$
      .pipe(
        switchMap((showLoading) => {
          if (!this.machineKey) return EMPTY;
          const todayEnd = new Date(factoryDayStart().getTime() + MS_PER_DAY); // exclusive: next factory midnight
          const sevenDaysAgo = new Date(todayEnd.getTime() - 7 * MS_PER_DAY);

          if (showLoading) this.loading7Days = true;
          return this.overviewDataService
            .getDailyProduction(this.machineKey, sevenDaysAgo, todayEnd)
            .pipe(finalize(() => (this.loading7Days = false)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((rows) => {
        const next = rows.map((r) => ({ category: formatFactoryDayMonth(r.date), good: r.good, wastage: r.scrap }));
        // Charts re-animate on every new `data` reference — skip unchanged results.
        if (JSON.stringify(this.todayProductionData) !== JSON.stringify(next)) this.todayProductionData = next;
      });
  }

  /** Fixed `$filter` shapes recognised by `MachineController::applyProductionLogFilter()`. */
  private applyProductionLogFilter(): void {
    const conditions = [`machine_id eq ${this.machineKey}`];
    const [from, to] = this.productionLogDateRange.split(' - ').map(fromPickerDate);
    if (from && to) {
      conditions.push(`bucket_started_at ge '${from}' and bucket_started_at le '${to}'`);
    }
    this.productionLogDataSource = { ...this.productionLogDataSource, filter: conditions.join(' and ') };
  }

  private buildShiftBreakdownColumns(): AgGridTableColumn<ShiftBreakdownRow>[] {
    const stateColumns: AgGridTableColumn<ShiftBreakdownRow>[] = this.machineStates.getAll().map((state) => ({
      colId: `state_${state.id}`,
      headerName: `${state.name} (h)`,
      valueGetter: (p: { data?: ShiftBreakdownRow }) =>
        p.data?.states.find((s) => s.machineStateId === state.id)?.hours ?? 0,
      valueFormatter: (p: ValueFormatterParams<ShiftBreakdownRow, number>) => (p.value ?? 0).toFixed(1),
    }));

    return [
      { field: 'date', headerName: $localize`Date` },
      { field: 'shiftName', headerName: $localize`Shift` },
      ...stateColumns,
      {
        field: 'totalHours',
        headerName: $localize`Total (h)`,
        valueFormatter: (p: ValueFormatterParams<ShiftBreakdownRow, number>) => (p.value ?? 0).toFixed(1),
      },
    ];
  }

  /** Date and count columns set no `dataType`: it would attach number/date column filters that
   * `production-logs` ignores (only the fixed `$filter` shapes are honoured), so they'd silently no-op. */
  private buildProductionLogColumns(shifts: ShiftOption[]): AgGridTableColumn<MachineProductionLogRow>[] {
    return [
      {
        field: 'log_date',
        headerName: $localize`Date`,
        minWidth: 130,
        sortable: false,
        filter: false,
        valueFormatter: ({ value }: ValueFormatterParams<MachineProductionLogRow, string>) => formatFactoryDate(value),
      },
      {
        // Filters the plain `shift_id` column — the shape the backend regex recognises.
        colId: 'shift_id',
        headerName: $localize`Shift`,
        minWidth: 120,
        sortable: false,
        filter: true,
        dataType: GridTableColumnDataType.String,
        valueGetter: (p) => p.data?.shift?.name ?? '',
        filterControl: {
          type: 'multiSelect',
          options: shifts.map((s) => ({ value: String(s.id), label: s.name })),
          placeholder: $localize`Filter by Shift...`,
        },
      },
      {
        colId: 'work_order.custom_id',
        headerName: $localize`Production Order`,
        minWidth: 140,
        sortable: false,
        filter: false,
        dataType: GridTableColumnDataType.String,
        valueGetter: (p) => p.data?.work_order?.custom_id ?? '',
      },
      {
        field: 'good_count',
        headerName: $localize`Good`,
        minWidth: 100,
        sortable: false,
        filter: false,
        type: 'numericColumn',
      },
      {
        field: 'scrap_count',
        headerName: $localize`Scrap`,
        minWidth: 100,
        sortable: false,
        filter: false,
        type: 'numericColumn',
      },
      {
        field: 'total_count',
        headerName: $localize`Total`,
        minWidth: 100,
        sortable: false,
        filter: false,
        type: 'numericColumn',
      },
      {
        field: 'logged_at',
        headerName: $localize`Logged At`,
        minWidth: 160,
        sortable: false,
        filter: false,
        floatingFilter: false,
        valueFormatter: ({ value }: ValueFormatterParams<MachineProductionLogRow, string>) =>
          formatFactoryDateTime(value),
      },
    ];
  }
}
