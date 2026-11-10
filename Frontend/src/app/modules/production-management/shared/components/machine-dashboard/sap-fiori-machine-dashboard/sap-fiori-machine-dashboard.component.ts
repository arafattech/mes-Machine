// import '@ui5/webcomponents-fiori/dist/DynamicPage.js';
// import '@ui5/webcomponents-fiori/dist/DynamicPageTitle.js';
// import '@ui5/webcomponents/dist/Breadcrumbs.js';
// import '@ui5/webcomponents/dist/BreadcrumbsItem.js';
// import '@ui5/webcomponents/dist/Toolbar.js';
// import '@ui5/webcomponents/dist/ToolbarButton.js';
// import '@ui5/webcomponents/dist/Title.js';
// import '@ui5/webcomponents/dist/Label.js';
// import '@ui5/webcomponents/dist/Text.js';
// import '@ui5/webcomponents/dist/Tag.js';
// import '@ui5/webcomponents/dist/Icon.js';
// import '@ui5/webcomponents/dist/Card.js';
// import '@ui5/webcomponents/dist/CardHeader.js';
// import '@ui5/webcomponents/dist/ProgressIndicator.js';
// import '@ui5/webcomponents/dist/SegmentedButton.js';
// import '@ui5/webcomponents/dist/SegmentedButtonItem.js';
// import '@ui5/webcomponents/dist/Table.js';
// import '@ui5/webcomponents/dist/TableHeaderRow.js';
// import '@ui5/webcomponents/dist/TableHeaderCell.js';
// import '@ui5/webcomponents/dist/TableRow.js';
// import '@ui5/webcomponents/dist/TableCell.js';
// import '@ui5/webcomponents/dist/BusyIndicator.js';
// import '@ui5/webcomponents/dist/Button.js';
// import '@ui5/webcomponents/dist/Link.js';
import { DecimalPipe } from '@angular/common';
import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  OnInit,
  Output,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { EMPTY, Subject, asyncScheduler, catchError, filter, from, map, merge, of, switchMap, throttleTime } from 'rxjs';
import { CommonService } from '@app/services/common-service/common.service';
import { MachineStatesService } from '@app/modules/production-management/shared/services/machine-states.service';
import { DurationPipe } from '@production-module/shared/pipes/duration.pipe';
import { TimeAgoPipe } from '@production-module/shared/pipes/time-ago.pipe';
import { MachineDashboardStore } from '@production-module/shared/services/machine-dashboard.store';
import { MachineOverviewDataService } from '@production-module/shared/services/machine-overview-data.service';
import {
  MachineRuntimeHistoryService,
  StateRangeSummary,
} from '@production-module/shared/services/machine-runtime-history.service';
import { CurrentShift, MachineProductionLogRow, WorkOrderDetail } from '@production-module/shared/interface/interface';
import {
  getWorkOrderStatusLabel,
} from '@production-module/shared/utils/work-order-status.util';
import { MACHINE_CONNECTIVITY_META } from '@production-module/shared/utils/machine-connectivity';
import { dueText, limitsText } from '@production-module/shared/utils/machine-condition';
import {
  DailyGood,
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
  MS_PER_DAY,
  factoryDayStart,
  factoryMonthStart,
  formatFactoryDate,
  formatFactoryDateTime,
} from '@shared/utilities/date-format';

type FioriPeriod = 'today' | 'month';
type TagDesign = 'Positive' | 'Critical' | 'Neutral';
type AnalysisState = 'loading' | 'ready' | 'error';

interface ProductionLogDisplayRow {
  date: string;
  shift: string;
  workOrder: string;
  good: number;
  scrap: number;
}

/** Rows per table that fit the page at the dashboard's target height — the page never scrolls. */
const RECENT_PRODUCTION_LOGS = 5;
const RECENT_STATE_CHANGES = 5;
const MAX_LOSSES_SHOWN = 3;
/** The only states the "Biggest losses" card ranks (Fault etc. are left out). */
const LOSS_STATE_NAMES = ['Inactive', 'Idle', 'Maintenance'];
/** Narrower "today by state" segments carry their hours in the tooltip only. */
const MIN_LABELLED_SEGMENT_PCT = 9;
/** Shot-driven production pushes arrive every couple of seconds while a machine runs; the
 * recent-log table and the daily micro chart only need to follow them loosely. */
const PRODUCTION_REFRESH_MS = 15_000;
/** OEE factor bars: one red → orange → yellow → light green → green gradient across the whole track. */
const OEE_GRADIENT = `linear-gradient(to right, ${[
  'var(--sapNegativeColor, #d32030)',
  'var(--sapCriticalColor, #e9730c)',
  '#f0ab00',
  '#8fbf3f',
  'var(--sapPositiveColor, #107e3e)',
].join(', ')})`;

/**
 * `MachineDashboardViewType.SAP_FIORI` — the same authoritative machine data presented as a SAP
 * Fiori object page, built from UI5 Web Components (`ui5-breadcrumbs`, `ui5-card`, `ui5-table`,
 * `ui5-progress-indicator`, `ui5-tag`, `ui5-segmented-button`). Figures explain themselves: OEE
 * with the inputs behind each factor, production with yield and output per day, and the period's
 * biggest losses. Theming comes from the active UI5 theme; no hard-coded colours.
 */
@Component({
  selector: 'app-sap-fiori-machine-dashboard',
  standalone: true,
  imports: [DecimalPipe, DurationPipe, TimeAgoPipe],
  templateUrl: './sap-fiori-machine-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  host: { class: 'flex h-full flex-col' },
})
export class SapFioriMachineDashboardComponent implements OnInit {
  @Output() logProduction = new EventEmitter<void>();

  protected readonly store = inject(MachineDashboardStore);
  protected readonly machineStates = inject(MachineStatesService);
  private readonly common = inject(CommonService);
  private readonly runtimeHistory = inject(MachineRuntimeHistoryService);
  private readonly overviewData = inject(MachineOverviewDataService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly productionLogsLoad$ = new Subject<void>();
  private readonly periodAnalysisLoad$ = new Subject<void>();
  private readonly periodProductionLoad$ = new Subject<void>();
  private readonly workOrderDetailLoad$ = new Subject<number | null>();

  protected readonly period = signal<FioriPeriod>('today');
  protected readonly productionLogs = signal<ProductionLogDisplayRow[]>([]);
  protected readonly productionLogsLoading = signal(true);
  protected readonly productionLogsFailed = signal(false);
  private readonly periodSummary = signal<StateRangeSummary[]>([]);
  protected readonly periodAnalysisState = signal<AnalysisState>('loading');
  private readonly periodProduction = signal<DailyGood[]>([]);
  private readonly workOrderDetail = signal<WorkOrderDetail | null>(null);

  protected readonly connectivity = computed(() => MACHINE_CONNECTIVITY_META[this.store.connectivity()]);
  protected readonly stateTagDesign = computed<TagDesign>(() => this.tagDesignFor(this.store.status().stateId));

  protected readonly periodLabel = computed(() => {
    const day = this.store.factoryDay();
    const today = formatFactoryDate(day);
    return this.period() === 'today' ? today : `${formatFactoryDate(`${day.slice(0, 8)}01`)} – ${today}`;
  });

  // ── OEE ────────────────────────────────────────────────────────────────────
  protected readonly oeeGradient = OEE_GRADIENT;
  protected readonly oeeText = computed(() => percentText(this.store.metrics()[3]?.value ?? null));
  /** Availability → Performance → Quality, each with the inputs behind it (or how to measure it). */
  protected readonly oeeSteps = computed(() =>
    buildOeeCascade(this.store.metrics(), this.store.oeeInputs()).map((step) => ({
      ...step,
      displayValue: step.measured ? step.text : $localize`Not measured`,
      // Keeps the gradient anchored to the full track, so the fill reveals it instead of squeezing it.
      fillSize: step.progress > 0 ? `${10000 / step.progress}% 100%` : '100% 100%',
    })),
  );

  // ── Production ─────────────────────────────────────────────────────────────
  protected readonly achievement = computed(() => achievementPercent(this.store.production()));
  protected readonly achievementProgress = computed(() => clampPercent(this.achievement()));
  /** Target met → Positive; otherwise neutral (no business rule defines a "behind target" threshold). */
  protected readonly achievementState = computed(() => ((this.achievement() ?? 0) >= 100 ? 'Positive' : 'None'));
  protected readonly achievementText = computed(() => {
    const value = this.achievement();
    return value === null ? '' : `${value} %`;
  });
  protected readonly yieldText = computed(() => yieldText(this.store.production()));
  /** Output per day only makes sense across several days — shown for "Month to date". */
  protected readonly dailyGood = computed(() =>
    this.period() === 'month' ? toDailyGoodBars(this.periodProduction()) : [],
  );
  protected readonly dailyGoodRange = computed(() => dailyGoodRange(this.periodProduction()));
  protected readonly dailyGoodSummary = computed(() => dailyGoodSummary(this.periodProduction()));

  // ── Losses ─────────────────────────────────────────────────────────────────
  private readonly lossStateIds = computed(
    () =>
      new Set(
        LOSS_STATE_NAMES.map((name) => this.machineStates.getByName(name)?.id).filter((id): id is number => id !== undefined),
      ),
  );
  protected readonly losses = computed(() =>
    biggestLosses(this.periodSummary(), this.machineStates.getProductiveIds(), MAX_LOSSES_SHOWN, this.lossStateIds()).map((loss) => ({
      ...loss,
      label: this.machineStates.getLabel(loss.stateId),
      icon: this.machineStates.getIcon(loss.stateId),
      color: this.machineStates.getColor(loss.stateId),
      tint: this.machineStates.getTint(loss.stateId),
    })),
  );
  /** Today's split by state as one bar (live), under the period's losses. */
  protected readonly todaySplit = computed(() => {
    const { perState, total } = this.store.durations();
    return this.machineStates
      .getAll()
      .filter((state) => (perState[state.id!] ?? 0) > 0)
      .map((state) => {
        const seconds = perState[state.id!] ?? 0;
        const percent = total > 0 ? Math.round((seconds / total) * 1000) / 10 : 0;
        return {
          stateId: state.id!,
          color: this.machineStates.getColor(state.id),
          percent,
          hours: hoursText(seconds),
          /** Hours are written inside the segment only when it is wide enough to hold them. */
          showHours: percent >= MIN_LABELLED_SEGMENT_PCT,
          title: `${this.machineStates.getLabel(state.id)} ${hoursText(seconds)} (${percent} %)`,
        };
      });
  });
  protected readonly todaySplitLabel = computed(() =>
    this.todaySplit().map((s) => s.title).join(', ') || $localize`No state time recorded today yet`,
  );

  // ── Current production order + shift ──────────────────────────────────────
  /** What this machine is working on: order progress across all its machines, this machine's
   * share, and how far the current shift has run. */
  protected readonly order = computed(() => {
    const current = this.store.currentWorkOrder()?.workOrder;
    const detail = this.workOrderDetail();
    if (!current) return null;
    const totals = detail?.workOrder?.id === current.id ? detail.totals : null;
    const machineId = Number(this.store.machineKey());
    const thisMachineGood = (detail?.machines ?? [])
      .filter((row) => row.machineId === machineId)
      .reduce((sum, row) => sum + row.goodCount, 0);
    const planned = totals?.quantityTarget ?? current.quantity;
    const produced = totals?.goodCount ?? null;
    const percent = totals?.percentComplete ?? (produced !== null && planned ? (produced / planned) * 100 : null);
    return {
      customId: current.customId || `#${current.id}`,
      product: current.productName || '—',
      status: getWorkOrderStatusLabel(current.status),
      planned,
      produced,
      progress: clampPercent(percent === null ? null : Math.round(percent * 10) / 10),
      progressText: percent === null ? $localize`Not started` : `${Math.round(percent * 10) / 10} %`,
      progressState: percent !== null && percent >= 100 ? 'Positive' : 'None',
      thisMachineGood,
      thisMachineShare: produced ? `${Math.round((thisMachineGood / produced) * 1000) / 10} %` : '—',
      machineCount: detail?.workOrder?.plannedMachines.length ?? null,
      startedAt: detail?.workOrder?.actualStart ? formatFactoryDateTime(detail.workOrder.actualStart) : '—',
    };
  });

  protected readonly shift = computed(() => {
    const shift = this.store.currentWorkOrder()?.shift;
    if (!shift) return null;
    this.store.durations();
    const elapsed = shiftElapsed(shift, Date.now() - factoryDayStart().getTime());
    return {
      name: shift.name,
      window: this.store.shiftWindow(),
      progress: elapsed.percent,
      left: elapsed.leftText,
    };
  });

  // ── Machine condition (header tags) ────────────────────────────────────────
  /** Maintenance as one Fiori tag: running → Critical, next scheduled → Information (Critical
   * when overdue), nothing planned → Neutral with the last one done. The reason is in the text. */
  protected readonly maintenanceTag = computed(() => {
    const m = this.store.maintenance();
    if (m.kind === 'active') {
      this.store.durations();
      const elapsed = Math.max(0, Math.floor((Date.now() - m.sinceMs) / 1000));
      return {
        design: 'Critical',
        icon: 'wrench',
        text: $localize`In maintenance, ${m.reason}`,
        detail: $localize`since ${m.since}`,
        elapsed,
      };
    }
    if (m.kind === 'scheduled') {
      this.store.durations();
      return {
        design: m.overdue ? 'Critical' : 'Information',
        icon: 'appointment-2',
        text: $localize`Maintenance ${m.when}, ${m.reason}`,
        detail: dueText(m.dueMs, Date.now()),
        elapsed: null,
      };
    }
    const last = this.store.lastMaintenance();
    return {
      design: 'Neutral',
      icon: 'accept',
      text: $localize`No maintenance scheduled`,
      detail: last ? $localize`last done ${last.endedAt}, ${last.reason}` : '',
      elapsed: null,
    };
  });

  protected readonly temperatureTag = computed(() => {
    if (!this.store.machine()?.hasTemperature) return null;
    const t = this.store.temperature();
    const design = t.status === 'high' ? 'Negative' : t.status === 'low' ? 'Information' : t.status === 'normal' ? 'Positive' : 'Neutral';
    return {
      design,
      text: t.value === null ? $localize`No reading` : `${Math.round(t.value * 10) / 10} °C`,
      tooltip: limitsText(t.min, t.max, '°C'),
    };
  });

  protected readonly rpmTag = computed(() => {
    if (!this.store.machine()?.hasRpm) return null;
    const { minRpm, maxRpm } = this.store.sensorLimits();
    return { text: $localize`No reading`, tooltip: limitsText(minRpm, maxRpm, 'rpm') };
  });

  // ── Tables ─────────────────────────────────────────────────────────────────
  protected readonly stateChanges = computed(() =>
    this.store.recentStateChanges().slice(0, RECENT_STATE_CHANGES).map((change) => ({
      ...change,
      label: this.machineStates.getLabel(change.stateId),
      icon: this.machineStates.getIcon(change.stateId),
      color: this.machineStates.getColor(change.stateId),
    })),
  );
  protected readonly stateChangesFooter = computed(() => {
    const total = this.store.stateChangesToday().length;
    return total > RECENT_STATE_CHANGES
      ? $localize`Latest ${RECENT_STATE_CHANGES} of ${total} state changes today`
      : '';
  });
  protected readonly stateChangesNoData = computed(() =>
    this.store.todayEventsState() === 'error'
      ? $localize`State history could not be loaded.`
      : $localize`No state changes recorded today.`,
  );
  protected readonly productionLogsNoData = computed(() =>
    this.productionLogsFailed()
      ? $localize`Production logs could not be loaded.`
      : $localize`No production logged on this machine yet.`,
  );

  constructor() {
    // Reload the order rollup whenever the machine starts working on a different order.
    effect(
      () => {
        const id = this.store.currentWorkOrder()?.workOrder?.id ?? null;
        untracked(() => this.workOrderDetailLoad$.next(id));
      },
      { allowSignalWrites: true },
    );

    // (Re)applies the window on load and at factory midnight, so a display left open overnight
    // moves on to the new day / month instead of silently widening the window.
    effect(
      () => {
        this.store.factoryDay();
        untracked(() => this.applyPeriod());
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    this.store.loadTodayEvents();
    this.store.loadCurrentWorkOrder();
    this.store.loadMachineCondition();
    this.initProductionLogsLoader();
    this.initPeriodLoaders();
    this.initWorkOrderDetailLoader();

    const productionChanges$ = this.store.changes$.pipe(
      filter((change) => change.kind === 'production'),
      throttleTime(PRODUCTION_REFRESH_MS, asyncScheduler, { leading: true, trailing: true }),
    );
    const resync$ = this.store.changes$.pipe(filter((change) => change.kind === 'resync'));
    const stateChanges$ = this.store.changes$.pipe(filter((change) => change.kind === 'state'));

    merge(productionChanges$, resync$)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.productionLogsLoad$.next();
        this.periodProductionLoad$.next();
        this.workOrderDetailLoad$.next(this.store.currentWorkOrder()?.workOrder?.id ?? null);
      });
    merge(stateChanges$, resync$)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.periodAnalysisLoad$.next());

    this.productionLogsLoad$.next();
  }

  onPeriodChange(event: Event): void {
    const item = (event as CustomEvent<{ selectedItems: HTMLElement[] }>).detail.selectedItems[0];
    const period = item?.dataset['period'];
    if (period !== 'today' && period !== 'month') return;
    this.period.set(period);
    this.applyPeriod();
  }

  onBreadcrumbClick(event: Event): void {
    const route = (event as CustomEvent<{ item: HTMLElement }>).detail.item.dataset['route'];
    if (route) this.router.navigate([route]);
  }

  openProductionOrders(): void {
    this.router.navigate(['/production/work-orders']);
  }

  openProductionLog(): void {
    this.router.navigate(['/production/production-log']);
  }

  retryProductionLogs(): void {
    this.productionLogsLoading.set(true);
    this.productionLogsLoad$.next();
  }

  retryPeriodAnalysis(): void {
    this.periodAnalysisLoad$.next();
  }

  /** Both periods run live through the end of the current factory day. */
  private applyPeriod(): void {
    this.store.setOverviewRange(this.periodStart(), null);
    this.periodAnalysisState.set('loading');
    this.periodAnalysisLoad$.next();
    this.periodProductionLoad$.next();
  }

  private periodStart(): Date {
    return this.period() === 'today' ? factoryDayStart() : factoryMonthStart();
  }

  private periodEnd(): Date {
    return new Date(factoryDayStart().getTime() + MS_PER_DAY);
  }

  private initProductionLogsLoader(): void {
    this.productionLogsLoad$
      .pipe(
        switchMap(() => {
          const key = this.store.machineKey();
          if (!key) return EMPTY;
          return this.common
            .get<{ data: MachineProductionLogRow[] }>(
              `production-logs?$top=${RECENT_PRODUCTION_LOGS}&$skip=0&$filter=machine_id eq ${key}`,
              false,
            )
            .pipe(
              map((res) => res?.data ?? []),
              catchError(() => of(null)),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((rows) => {
        this.productionLogsLoading.set(false);
        this.productionLogsFailed.set(rows === null);
        if (rows) this.productionLogs.set(rows.map(toProductionLogDisplayRow));
      });
  }

  /** Per-state totals for the period (losses) and good per day (micro chart) — latest request wins. */
  private initPeriodLoaders(): void {
    this.periodAnalysisLoad$
      .pipe(
        switchMap(() => {
          const key = this.store.machineKey();
          if (!key) return EMPTY;
          return from(this.runtimeHistory.getRangeAnalysis(key, this.periodStart(), this.periodEnd())).pipe(
            map(({ stateSummary }) => stateSummary),
            catchError(() => of(null)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((summary) => {
        if (summary) this.periodSummary.set(summary);
        this.periodAnalysisState.set(summary ? 'ready' : 'error');
      });

    this.periodProductionLoad$
      .pipe(
        switchMap(() => {
          const key = this.store.machineKey();
          return key ? this.overviewData.getDailyProduction(key, this.periodStart(), this.periodEnd()) : EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((rows) => this.periodProduction.set(rows.map((r) => ({ date: r.date, good: r.good }))));
  }

  private initWorkOrderDetailLoader(): void {
    this.workOrderDetailLoad$
      .pipe(
        switchMap((id) => (id === null ? of(null) : this.overviewData.getWorkOrderDetail(id))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((detail) => this.workOrderDetail.set(detail));
  }

  /** Fiori semantics: productive state → Positive, non-productive → Critical, unknown → Neutral. */
  private tagDesignFor(stateId: number | null): TagDesign {
    const state = this.machineStates.getState(stateId);
    if (!state) return 'Neutral';
    return state.counts_as_productive ? 'Positive' : 'Critical';
  }
}

function toProductionLogDisplayRow(row: MachineProductionLogRow): ProductionLogDisplayRow {
  return {
    date: formatFactoryDate(row.log_date),
    shift: row.shift?.name || '—',
    workOrder: row.work_order?.custom_id || '—',
    good: row.good_count,
    scrap: row.scrap_count,
  };
}

/**
 * How far the current shift has run. Shift start/end are naive wall-clock DATETIMEs (time of day in
 * the UTC slot), so their UTC hours/minutes are the factory clock; overnight shifts wrap midnight.
 */
function shiftElapsed(shift: CurrentShift, msSinceFactoryMidnight: number): { percent: number; leftText: string } {
  const minutes = (value: string) => {
    const date = new Date(value);
    return date.getUTCHours() * 60 + date.getUTCMinutes();
  };
  const start = minutes(shift.startTime);
  const length = (minutes(shift.endTime) - start + 1440) % 1440 || 1440;
  const elapsed = Math.min(length, (Math.floor(msSinceFactoryMidnight / 60_000) - start + 1440) % 1440);
  const left = length - elapsed;
  return {
    percent: Math.round((elapsed / length) * 100),
    leftText: $localize`${Math.floor(left / 60)} h ${left % 60} min left`,
  };
}
