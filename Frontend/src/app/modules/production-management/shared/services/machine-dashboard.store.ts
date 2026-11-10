import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  EMPTY,
  forkJoin,
  Observable,
  Subject,
  asyncScheduler,
  catchError,
  distinctUntilChanged,
  filter,
  finalize,
  from,
  map,
  merge,
  of,
  share,
  switchMap,
  throttleTime,
} from 'rxjs';
import { CommonService } from '@app/services/common-service/common.service';
import { SocketService } from '@app/services/socket.service';
import { MachineStatesService } from '@app/modules/production-management/shared/services/machine-states.service';
import {
  DEFAULT_MACHINE_DASHBOARD_VIEW,
  MachineDashboardViewType,
  MachineDashboardViewTypeClass,
} from '@shared/enums/machine-dashboard-view';
import {
  MS_PER_DAY,
  factoryDayStart,
  factoryMidnight,
  factoryToday,
  formatFactoryTime,
  formatWallClockTime,
} from '@shared/utilities/date-format';
import {
  MachineDurationService,
  MachineDurations,
  MachineStateEventRow,
} from '@production-module/shared/services/machine-duration.service';
import { MachineRuntimeHistoryService } from '@production-module/shared/services/machine-runtime-history.service';
import { MachineOverviewDataService } from '@production-module/shared/services/machine-overview-data.service';
import {
  MachineProductionChange,
  ProductionRealtimeService,
} from '@production-module/shared/services/production-realtime.service';
import {
  CurrentWorkOrderShift,
  Metric,
  OeeLiveInputs,
  ProductionSummary,
} from '@production-module/shared/interface/interface';
import { MachineConnectivity, connectivityOf } from '@production-module/shared/utils/machine-connectivity';
import {
  MaintenanceRow,
  SensorLimits,
  SensorReading,
  lastMaintenance,
  sensorStatus,
  summarizeMaintenance,
} from '@production-module/shared/utils/machine-condition';

export interface MachineDashboardIdentity {
  id: number | null;
  customId: string;
  name: string;
  view: MachineDashboardViewType;
  /** Sensor flags from the machine master (`has_temperature` / `has_rpm`). */
  hasTemperature: boolean;
  hasRpm: boolean;
}

/** Shown until the machine record loads, and kept if it cannot be loaded. */
export interface MachineDashboardPlaceholder {
  customId: string;
  name: string;
}

export type MachineLoadState = 'loading' | 'ready' | 'error';

export type TodayEventsState = 'loading' | 'ready' | 'error';

/** One of today's state events, parsed once per fetch (not per tick). `endMs: null` = still open. */
export interface TodayStateEvent {
  stateId: number;
  startMs: number;
  endMs: number | null;
  start: string;
  end: string | null;
}

/** One of today's state events for display; `end: null` = still open (duration keeps counting). */
export interface StateChangeItem {
  stateId: number;
  start: string;
  end: string | null;
  seconds: number;
}

export interface MachineDashboardStatus {
  stateId: number | null;
  label: string;
  icon: string;
  color: string;
  tint: string;
  /** `counts_as_productive` of the current state; `null` while the state is unknown. */
  productive: boolean | null;
}

interface MachineRecord {
  id: number;
  custom_id: string | null;
  machine_name: string | null;
  dashboard_view?: string | null;
  has_temperature?: boolean | null;
  has_rpm?: boolean | null;
}

interface MachineConfigLimitsRow {
  max_rpm: number | null;
  min_rpm: number | null;
  max_temp: number | null;
  min_temp: number | null;
}

interface SensorDataRow {
  timestamp: string;
  temperature: number | string;
}

/** `from_pie` sensor payloads are re-broadcast in `to_frontend` keyed by the machine's custom id. */
interface SensorTelemetryItem {
  machineId?: string | number;
  value?: string | number;
  timestamp?: string;
}

/** `to: null` = live window running through the end of the current factory day. */
interface OverviewRange {
  from: Date;
  to: Date | null;
}

/** What the OEE figures are computed from, for explaining them on screen. */
export interface OeeInputs {
  activeSeconds: number;
  totalSeconds: number;
  totalCount: number;
  goodCount: number;
  /** Quality denominator in kg; `null` when Quality isn't measured (non-kg products). */
  qualityTotal: number | null;
  idealCycleSeconds: number | null;
}

interface OeeLiveSnapshot {
  inputs: OeeLiveInputs;
  /** Client-clock instant the server snapshot describes. */
  snapshotAt: number;
  /** Exclusive end of the queried window — accrual stops there. */
  windowEnd: number;
}

const NUMERIC_KEY = /^\d+$/;
const RECENT_STATE_CHANGES = 20;
/** Readings kept for the temperature trend (stored history + live pushes). */
const TEMPERATURE_HISTORY = 30;
const NO_LIMITS: SensorLimits = { minTemp: null, maxTemp: null, minRpm: null, maxRpm: null };
/** Shot pushes arrive every couple of seconds while a machine runs; "what is running now" only
 * needs to follow them loosely. */
const CURRENT_WORK_ORDER_REFRESH_MS = 15_000;

const sameJson = <T>(a: T, b: T): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Per-page state shared by the dashboard host and whichever view it renders. Provided by
 * `MachineOverviewComponent` (one instance per page, destroyed with it), so nothing leaks between
 * machines or survives navigation. Holds the single realtime pipeline for the machine; views
 * subscribe to `changes$` for their own panel refetches instead of opening another one.
 */
@Injectable()
export class MachineDashboardStore {
  private readonly common = inject(CommonService);
  private readonly socket = inject(SocketService);
  private readonly durationService = inject(MachineDurationService);
  private readonly machineStates = inject(MachineStatesService);
  private readonly overviewData = inject(MachineOverviewDataService);
  private readonly realtime = inject(ProductionRealtimeService);
  private readonly runtimeHistory = inject(MachineRuntimeHistoryService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly key$ = new BehaviorSubject<string | null>(null);
  private readonly identityLoad$ = new Subject<boolean>();
  private readonly currentWorkOrderLoad$ = new Subject<void>();
  private readonly overviewLoad$ = new Subject<boolean>();
  private readonly todayEventsLoad$ = new Subject<void>();
  private readonly conditionLoad$ = new Subject<void>();
  private readonly localChanges$ = new Subject<MachineProductionChange>();
  private placeholder: MachineDashboardPlaceholder = { customId: '', name: '' };
  private overviewRange: OverviewRange | null = null;
  private todayEventsEnabled = false;
  private currentWorkOrderEnabled = false;
  private conditionEnabled = false;

  private readonly serverMetrics = signal<Metric[]>([]);
  private readonly oeeLive = signal<OeeLiveSnapshot | null>(null);

  readonly machineKey = signal<string | null>(null);
  readonly machine = signal<MachineDashboardIdentity | null>(null);
  readonly machineLoad = signal<MachineLoadState>('loading');
  readonly view = computed(() => this.machine()?.view ?? DEFAULT_MACHINE_DASHBOARD_VIEW);

  readonly currentWorkOrder = signal<CurrentWorkOrderShift | null>(null);
  /** `06:00 AM – 02:00 PM` of the current shift, `''` when no shift is known. */
  readonly shiftWindow = computed(() => {
    const shift = this.currentWorkOrder()?.shift;
    return shift ? `${formatWallClockTime(shift.startTime)} – ${formatWallClockTime(shift.endTime)}` : '';
  });
  readonly production = signal<ProductionSummary | null>(null);
  readonly overviewLoading = signal(false);

  // ── Machine condition (opt-in via `loadMachineCondition()`) ───────────────
  private readonly maintenanceRows = signal<MaintenanceRow[]>([]);
  readonly maintenanceState = signal<TodayEventsState>('loading');
  readonly sensorLimits = signal<SensorLimits>(NO_LIMITS);
  /** Ascending by time; stored history first, then live readings as they arrive. */
  private readonly temperatureReadings = signal<SensorReading[]>([]);

  private readonly maintenanceStateId = computed(() => this.machineStates.getByName('Maintenance')?.id ?? null);
  readonly maintenance = computed(() =>
    summarizeMaintenance(this.maintenanceRows(), this.durations().current === this.maintenanceStateId()),
  );
  readonly lastMaintenance = computed(() => lastMaintenance(this.maintenanceRows()));

  readonly temperature = computed(() => {
    const readings = this.temperatureReadings();
    const latest = readings.at(-1) ?? null;
    const { minTemp, maxTemp } = this.sensorLimits();
    return {
      value: latest?.value ?? null,
      atMs: latest?.atMs ?? null,
      status: sensorStatus(latest?.value ?? null, minTemp, maxTemp),
      min: minTemp,
      max: maxTemp,
      trend: readings.map((r) => r.value),
    };
  });

  /** Factory calendar date (`YYYY-MM-DD`); changes only at factory midnight. */
  readonly factoryDay = computed(() => {
    this.durationService.tick();
    return factoryToday();
  });

  private readonly todayEvents = signal<MachineStateEventRow[]>([]);
  readonly todayEventsState = signal<TodayEventsState>('loading');

  /** Today's state events (ascending), loaded only once a view calls `loadTodayEvents()`. */
  readonly todayStateEvents = computed<TodayStateEvent[]>(() =>
    this.todayEvents()
      .filter((e) => e.machine_state_id != null)
      .map((e) => ({
        stateId: e.machine_state_id as number,
        startMs: Date.parse(e.started_at),
        endMs: e.ended_at ? Date.parse(e.ended_at) : null,
        start: formatFactoryTime(e.started_at),
        end: e.ended_at ? formatFactoryTime(e.ended_at) : null,
      })),
  );

  /** Events that started today — the state carried over from yesterday is not a change. */
  readonly stateChangesToday = computed<TodayStateEvent[]>(() => {
    const dayStart = factoryMidnight(this.factoryDay()).getTime();
    return this.todayStateEvents().filter((e) => e.startMs >= dayStart);
  });

  /** Latest state changes first; only the open one's duration changes on the 1 s tick. */
  readonly recentStateChanges = computed<StateChangeItem[]>(() => {
    this.durationService.tick();
    const now = Date.now();
    return this.todayStateEvents()
      .slice(-RECENT_STATE_CHANGES)
      .reverse()
      .map((e) => ({
        stateId: e.stateId,
        start: e.start,
        end: e.end,
        seconds: Math.max(0, Math.round(((e.endMs ?? now) - e.startMs) / 1000)),
      }));
  });

  /** Live per-state durations, re-read on `MachineDurationService`'s 1 s tick — no own timer. */
  readonly durations = computed<MachineDurations>(() => {
    this.durationService.tick();
    return this.durationService.snapshot(this.machineKey());
  });

  readonly status = computed<MachineDashboardStatus>(() => {
    const stateId = this.durations().current;
    const state = this.machineStates.getState(stateId);
    return {
      stateId,
      label: this.machineStates.getLabel(stateId),
      icon: this.machineStates.getIcon(stateId),
      color: this.machineStates.getColor(stateId),
      tint: this.machineStates.getTint(stateId),
      productive: state ? !!state.counts_as_productive : null,
    };
  }, { equal: sameJson });

  readonly connectivity = computed<MachineConnectivity>(() => {
    this.durationService.tick();
    return connectivityOf(this.durations().lastSeenAt, Date.now());
  });

  /** OEE tiles from the last server snapshot, advanced every tick while a state is open —
   * Availability / Performance / OEE change with time, not only on writes. No request. */
  readonly metrics = computed<Metric[]>(() => {
    const live = this.oeeLive();
    if (live?.inputs.openStateProductive == null) return this.serverMetrics();
    this.durationService.tick();
    const elapsedMs = Math.min(Date.now(), live.windowEnd) - live.snapshotAt;
    return this.overviewData.liveOeeMetrics(live.inputs, elapsedMs / 1000);
  }, { equal: sameJson });

  /** The inputs behind the OEE figures, advanced on the same tick as `metrics` so the numbers
   * explaining Availability / Performance / Quality always agree with them. `null` before the first
   * overview response or when the window has no live inputs. */
  readonly oeeInputs = computed<OeeInputs | null>(() => {
    const live = this.oeeLive();
    if (!live) return null;
    const { inputs } = live;
    let accrued = 0;
    if (inputs.openStateProductive !== null) {
      this.durationService.tick();
      accrued = Math.max(0, Math.floor((Math.min(Date.now(), live.windowEnd) - live.snapshotAt) / 1000));
    }
    return {
      activeSeconds: inputs.activeSeconds + (inputs.openStateProductive ? accrued : 0),
      totalSeconds: inputs.totalSeconds + accrued,
      totalCount: inputs.totalCount,
      goodCount: inputs.goodCount,
      qualityTotal: inputs.qualityTotal,
      idealCycleSeconds: inputs.idealCycleSeconds,
    };
  }, { equal: sameJson });

  /** Push-driven changes for the current machine (node-server events + local production logs). */
  readonly changes$: Observable<MachineProductionChange> = merge(
    this.key$.pipe(
      distinctUntilChanged(),
      switchMap((key) => (key ? this.realtime.machineChanges$(key) : EMPTY)),
    ),
    this.localChanges$,
  ).pipe(share());

  constructor() {
    this.initIdentityLoader();
    this.initCurrentWorkOrderLoader();
    this.initOverviewLoader();
    this.initTodayEventsLoader();
    this.initConditionLoader();
    this.listenForTemperature();

    this.changes$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((change) => {
      this.reloadOverview(false);
      if (this.todayEventsEnabled && change.kind !== 'production') this.todayEventsLoad$.next();
      if (this.conditionEnabled && change.kind !== 'production') this.conditionLoad$.next();
      if (change.kind !== 'resync') return;
      if (this.currentWorkOrderEnabled) this.currentWorkOrderLoad$.next();
      this.identityLoad$.next(false);
    });

    this.changes$
      .pipe(
        filter((change) => this.currentWorkOrderEnabled && change.kind === 'production' && change.workOrderIds.length > 0),
        throttleTime(CURRENT_WORK_ORDER_REFRESH_MS, asyncScheduler, { leading: true, trailing: true }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.currentWorkOrderLoad$.next());

    // "Today" rolls over at factory midnight on displays left open overnight.
    effect(
      () => {
        this.factoryDay();
        untracked(() => {
          if (this.todayEventsEnabled) this.todayEventsLoad$.next();
        });
      },
      { allowSignalWrites: true },
    );
  }

  /** Switches the page to another machine. Every machine-scoped value is cleared first so a
   * slow response for the previous machine can never render under the new one. */
  setMachine(rawKey: string | null, placeholder: MachineDashboardPlaceholder): void {
    this.placeholder = placeholder;
    // Only numeric ids are usable — anything else is treated as "no machine" so no view renders.
    const key = rawKey && NUMERIC_KEY.test(rawKey) ? rawKey : null;
    if (key !== null && key === this.key$.value && this.machineLoad() !== 'error') return;

    this.machineKey.set(key);
    this.machine.set(null);
    this.currentWorkOrder.set(null);
    this.production.set(null);
    this.serverMetrics.set([]);
    this.oeeLive.set(null);
    this.overviewRange = null;
    this.todayEvents.set([]);
    this.todayEventsState.set('loading');
    this.todayEventsEnabled = false;
    this.currentWorkOrderEnabled = false;
    this.conditionEnabled = false;
    this.maintenanceRows.set([]);
    this.maintenanceState.set('loading');
    this.sensorLimits.set(NO_LIMITS);
    this.temperatureReadings.set([]);
    this.key$.next(key);

    if (!key) {
      this.machineLoad.set('error');
      return;
    }
    this.identityLoad$.next(true);
  }

  retry(): void {
    if (this.key$.value) this.identityLoad$.next(true);
  }

  /** Activates the overview (production + OEE) feed for a window; views without OEE never call it. */
  setOverviewRange(from: Date, to: Date | null): void {
    this.overviewRange = { from, to };
    this.overviewLoad$.next(true);
  }

  /** Activates the "what is the machine working on" feed (order / product / shift). Views that
   * show only machine states (Runtime) never call it, so they issue no production requests. */
  loadCurrentWorkOrder(): void {
    this.currentWorkOrderEnabled = true;
    this.currentWorkOrderLoad$.next();
  }

  /** Activates maintenance + sensor data (limits, stored temperature history, live readings).
   * Maintenance is refetched on state changes (activation flips the state) and resyncs. */
  loadMachineCondition(): void {
    this.conditionEnabled = true;
    this.conditionLoad$.next();
  }

  /** Activates the today's-state-events feed (refetched on state changes and resyncs only). */
  loadTodayEvents(): void {
    this.todayEventsEnabled = true;
    this.todayEventsState.set('loading');
    this.todayEventsLoad$.next();
  }

  reloadOverview(showLoading: boolean): void {
    if (this.overviewRange) this.overviewLoad$.next(showLoading);
  }

  /** A production entry was just logged from this page — refresh everything without waiting
   * for the push that will follow. */
  notifyProductionLogged(): void {
    this.localChanges$.next({ kind: 'resync', workOrderIds: [] });
  }

  private initIdentityLoader(): void {
    this.identityLoad$
      .pipe(
        switchMap((showLoading) => {
          const key = this.key$.value;
          if (!key) return EMPTY;
          if (showLoading) this.machineLoad.set('loading');
          return this.common
            .get<MachineRecord>(`Machines(${key})?$select=id,custom_id,machine_name,dashboard_view,has_temperature,has_rpm`)
            .pipe(
              map((record): MachineDashboardIdentity | null => this.toIdentity(record)),
              catchError(() => of(null)),
              map((identity) => ({ identity, showLoading })),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ identity, showLoading }) => {
        if (identity) {
          this.machine.set(identity);
          this.machineLoad.set('ready');
          return;
        }
        // A silent refresh (reconnect) keeps whatever is already on screen — unless nothing has
        // loaded yet (it may have superseded the initial load).
        if (!showLoading && this.machineLoad() === 'ready') return;
        this.machine.set({
          id: null,
          customId: this.placeholder.customId,
          name: this.placeholder.name,
          view: DEFAULT_MACHINE_DASHBOARD_VIEW,
          hasTemperature: false,
          hasRpm: false,
        });
        this.machineLoad.set('error');
      });
  }

  private initCurrentWorkOrderLoader(): void {
    this.currentWorkOrderLoad$
      .pipe(
        switchMap(() => {
          const key = this.key$.value;
          return key ? this.overviewData.getCurrentWorkOrderShift(key) : EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((current) => this.currentWorkOrder.set(current));
  }

  /** Production summary + all 4 OEE tiles from one call over one window, so
   * Efficiency = Availability × Performance × Quality holds on screen. */
  private initOverviewLoader(): void {
    this.overviewLoad$
      .pipe(
        switchMap((showLoading) => {
          const key = this.key$.value;
          const range = this.overviewRange;
          if (!key || !range) return EMPTY;
          if (showLoading) this.overviewLoading.set(true);
          const to = range.to ?? this.endOfFactoryDay();
          return this.overviewData.getOverview(key, range.from, to).pipe(
            map((overview) => ({ ...overview, key, windowEnd: to.getTime() })),
            finalize(() => this.overviewLoading.set(false)),
          );
        }),
        // `setMachine` emits nothing here, so a response for the previous machine can still arrive.
        filter(({ key }) => key === this.key$.value),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ production, oeeMetrics, oeeLive, windowEnd }) => {
        this.production.set(production);
        this.serverMetrics.set(oeeMetrics);
        this.oeeLive.set(
          oeeLive ? { inputs: oeeLive, snapshotAt: Date.now() - oeeLive.ageMs, windowEnd } : null,
        );
      });
  }

  private initTodayEventsLoader(): void {
    this.todayEventsLoad$
      .pipe(
        switchMap(() => {
          const key = this.key$.value;
          if (!key) return EMPTY;
          const dayStart = factoryDayStart();
          return from(
            this.runtimeHistory.getEventsInRange(key, dayStart, new Date(dayStart.getTime() + MS_PER_DAY)),
          ).pipe(
            catchError(() => of(null)),
            map((rows) => ({ key, rows })),
          );
        }),
        filter(({ key }) => key === this.key$.value),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ rows }) => {
        if (rows) this.todayEvents.set(rows);
        // A failed refresh keeps the rows already on screen; only an empty view shows the error.
        this.todayEventsState.set(rows || this.todayEvents().length ? 'ready' : 'error');
      });
  }

  /** Maintenance rows for this machine + sensor limits + stored temperature history, together. */
  private initConditionLoader(): void {
    this.conditionLoad$
      .pipe(
        switchMap(() => {
          const key = this.key$.value;
          if (!key) return EMPTY;
          const maintenance$ = this.common
            .get<{ data: MaintenanceRow[] }>(`machine/maintenance?$top=20&$skip=0&$filter=machine_id eq ${key}`, false)
            .pipe(map((res) => res?.data ?? null), catchError(() => of(null)));
          const limits$ = this.common
            .get<{ value: MachineConfigLimitsRow[] }>(
              `MachineHasConfigs?$filter=machine_id eq ${key} and is_active eq true&$select=max_rpm,min_rpm,max_temp,min_temp`,
            )
            .pipe(map((res) => res?.value?.[0] ?? null), catchError(() => of(null)));
          const history$ = this.common
            .get<{ value: SensorDataRow[] }>(
              `MachineSensorData?$filter=machine_id eq ${key}&$orderby=timestamp desc&$top=${TEMPERATURE_HISTORY}&$select=timestamp,temperature`,
            )
            .pipe(map((res) => res?.value ?? []), catchError(() => of([] as SensorDataRow[])));
          return forkJoin([maintenance$, limits$, history$]).pipe(map((result) => ({ key, result })));
        }),
        filter(({ key }) => key === this.key$.value),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ result: [maintenance, limits, history] }) => {
        if (maintenance) this.maintenanceRows.set(maintenance);
        this.maintenanceState.set(maintenance || this.maintenanceRows().length ? 'ready' : 'error');
        if (limits) {
          this.sensorLimits.set({
            minTemp: limits.min_temp,
            maxTemp: limits.max_temp,
            minRpm: limits.min_rpm,
            maxRpm: limits.max_rpm,
          });
        }
        const stored = history
          .map((row) => ({ value: Number(row.temperature), atMs: Date.parse(row.timestamp) }))
          .filter((r) => Number.isFinite(r.value) && Number.isFinite(r.atMs))
          .reverse();
        if (stored.length) this.temperatureReadings.set(stored);
      });
  }

  /** Live temperature from Pi sensors (`from_pie`), re-broadcast in `to_frontend` by custom id. */
  private listenForTemperature(): void {
    this.socket
      .on('to_frontend')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: SensorTelemetryItem | SensorTelemetryItem[]) => {
        const customId = this.machine()?.customId;
        if (!this.conditionEnabled || !this.machine()?.hasTemperature || !customId) return;
        const items = Array.isArray(data) ? data : [data];
        const item = items.find((i) => i?.machineId != null && String(i.machineId) === customId);
        const value = Number(item?.value);
        if (!item || !Number.isFinite(value)) return;
        const atMs = item.timestamp ? Date.parse(item.timestamp) : Date.now();
        const last = this.temperatureReadings().at(-1);
        if (last && last.atMs === atMs) return;
        this.temperatureReadings.update((readings) =>
          [...readings, { value, atMs: Number.isFinite(atMs) ? atMs : Date.now() }].slice(-TEMPERATURE_HISTORY),
        );
      });
  }

  private toIdentity(record: MachineRecord | null | undefined): MachineDashboardIdentity | null {
    if (record?.id == null) return null;
    return {
      id: record.id,
      customId: record.custom_id ?? this.placeholder.customId,
      name: record.machine_name ?? this.placeholder.name,
      view: MachineDashboardViewTypeClass.resolve(record.dashboard_view),
      hasTemperature: !!record.has_temperature,
      hasRpm: !!record.has_rpm,
    };
  }

  /** Next factory midnight: today's data stays in range however long the page is open, node-server
   * sees the window reaching the present (so it returns live OEE inputs), and its cache key stays
   * stable for the day so viewers share it. */
  private endOfFactoryDay(): Date {
    return new Date(factoryDayStart().getTime() + MS_PER_DAY);
  }
}
