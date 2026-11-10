import { CUSTOM_ELEMENTS_SCHEMA, ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { MachineStatesService } from '@app/modules/production-management/shared/services/machine-states.service';
import { MachineDashboardHeaderComponent } from '@production-module/shared/components/machine-dashboard/machine-dashboard-header/machine-dashboard-header.component';
import { MachineConditionComponent } from '@production-module/shared/components/machine-dashboard/machine-condition/machine-condition.component';
import { DurationPipe } from '@production-module/shared/pipes/duration.pipe';
import { MachineDashboardStore } from '@production-module/shared/services/machine-dashboard.store';
import { MACHINE_CONNECTIVITY_META } from '@production-module/shared/utils/machine-connectivity';
import { MS_PER_DAY, factoryMidnight, formatFactoryTime } from '@shared/utilities/date-format';

/** One segment on a state lane, positioned on a fixed 00:00–24:00 axis. */
interface LaneSegment {
  leftPct: number;
  widthPct: number;
}

/** One lane per machine state — states with similar colours (e.g. Inactive / Fault) stay distinct. */
interface StateLane {
  stateId: number;
  name: string;
  color: string;
  seconds: number;
  segments: LaneSegment[];
}

/** One lamp of the andon stack light; exactly one is lit (the current state), if known. */
interface AndonLamp {
  stateId: number;
  name: string;
  icon: string;
  color: string;
  dim: string;
  lit: boolean;
}

const TIMELINE_TICKS = ['00:00', '06:00', '12:00', '18:00', '24:00'];
/** Faint hour guides inside each lane, at the inner ticks. */
const LANE_GUIDES = [25, 50, 75];
/** Changes shorter than this (sensor flicker) are muted so real stops stand out. */
const BRIEF_CHANGE_SECONDS = 60;
/** Newest-first rows that fit the panel at the dashboard's target height — no inner scrolling. */
const RECENT_CHANGES_SHOWN = 12;

/**
 * `MachineDashboardViewType.RUNTIME_STATUS` — a glanceable operator / wall-display screen built
 * around an andon stack light and the time spent in the current state, with today's runtime
 * figures, per-state lanes and the latest state changes. Fits the viewport; nothing scrolls.
 * Live figures come from the store's 1 s tick; today's state events from the store's feed,
 * refetched only when the machine changes state or the socket resyncs.
 */
@Component({
  selector: 'app-machine-runtime-dashboard',
  standalone: true,
  imports: [MachineDashboardHeaderComponent, MachineConditionComponent, DurationPipe],
  templateUrl: './machine-runtime-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  host: { class: 'block h-full' },
})
export class MachineRuntimeDashboardComponent implements OnInit {
  protected readonly store = inject(MachineDashboardStore);
  private readonly machineStates = inject(MachineStatesService);
  private readonly events = this.store.todayStateEvents;
  /** Epoch ms of today's factory midnight; recomputed only when the factory day rolls over. */
  private readonly dayStartMs = computed(() => factoryMidnight(this.store.factoryDay()).getTime());
  protected readonly timelineTicks = TIMELINE_TICKS;
  protected readonly laneGuides = LANE_GUIDES;
  protected readonly connectivity = computed(() => MACHINE_CONNECTIVITY_META[this.store.connectivity()]);

  protected readonly andon = computed<AndonLamp[]>(() => {
    const current = this.store.durations().current;
    return this.machineStates.getAll().map((state) => ({
      stateId: state.id!,
      name: this.machineStates.getLabel(state.id),
      icon: this.machineStates.getIcon(state.id),
      color: this.machineStates.getColor(state.id),
      dim: this.machineStates.getTint(state.id),
      lit: state.id === current,
    }));
  }, { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) });

  /** Today's total in the current state (earlier visits included), next to the continuous timer. */
  protected readonly currentStateToday = computed(() => {
    const durations = this.store.durations();
    return durations.current == null ? 0 : durations.perState[durations.current] ?? 0;
  });

  /** Instant the current state was entered, derived from the live "time in state" counter. */
  protected readonly stateSince = computed(() => {
    const durations = this.store.durations();
    return durations.current == null ? '' : formatFactoryTime(new Date(Date.now() - durations.currentSeconds * 1000));
  });

  /** Today's live totals split by `counts_as_productive`. */
  protected readonly today = computed(() => {
    const durations = this.store.durations();
    const productiveIds = this.machineStates.getProductiveIds();
    let productiveSeconds = 0;
    for (const [stateId, seconds] of Object.entries(durations.perState)) {
      if (seconds && productiveIds.has(Number(stateId))) productiveSeconds += seconds;
    }
    return {
      productiveSeconds,
      nonProductiveSeconds: durations.total - productiveSeconds,
      runtimePct: durations.total > 0 ? Math.round((productiveSeconds / durations.total) * 1000) / 10 : null,
    };
  });

  /** Today's time split by state as a conic-gradient ring (no chart library), plus its spoken form. */
  protected readonly dayRing = computed(() => {
    const { perState, total } = this.store.durations();
    if (!total) return { background: 'var(--sapList_Background, #f5f6f7)', label: $localize`No state time recorded today yet` };
    let elapsed = 0;
    const stops: string[] = [];
    const parts: string[] = [];
    for (const state of this.machineStates.getAll()) {
      const seconds = perState[state.id!] ?? 0;
      if (!seconds) continue;
      const from = (elapsed / total) * 100;
      elapsed += seconds;
      const to = (elapsed / total) * 100;
      stops.push(`${this.machineStates.getColor(state.id)} ${from}% ${to}%`);
      parts.push(`${this.machineStates.getLabel(state.id)} ${Math.round(to - from)} %`);
    }
    return { background: `conic-gradient(${stops.join(', ')})`, label: $localize`Today: ${parts.join(', ')}` };
  });

  /** Fixed 00:00–24:00 axis: closed segments keep their geometry; only the open one grows. */
  protected readonly lanes = computed<StateLane[]>(() => {
    const durations = this.store.durations();
    const dayStart = this.dayStartMs();
    const now = Date.now();
    const segmentsByState = new Map<number, LaneSegment[]>();
    for (const event of this.events()) {
      const start = Math.max(event.startMs, dayStart);
      const end = Math.min(event.endMs ?? now, now);
      if (end <= start) continue;
      const segments = segmentsByState.get(event.stateId) ?? [];
      segments.push({
        leftPct: ((start - dayStart) / MS_PER_DAY) * 100,
        widthPct: ((end - start) / MS_PER_DAY) * 100,
      });
      segmentsByState.set(event.stateId, segments);
    }
    return this.machineStates.getAll().map((state) => ({
      stateId: state.id!,
      name: this.machineStates.getLabel(state.id),
      color: this.machineStates.getColor(state.id),
      seconds: durations.perState[state.id!] ?? 0,
      segments: segmentsByState.get(state.id!) ?? [],
    }));
  });

  protected readonly nowPct = computed(() => {
    this.store.durations();
    return ((Date.now() - this.dayStartMs()) / MS_PER_DAY) * 100;
  });

  protected readonly stateChangesToday = computed(() => this.store.stateChangesToday().length);
  protected readonly lastTransition = computed(() => this.store.stateChangesToday().at(-1)?.start ?? '');

  protected readonly recentChanges = computed(() =>
    this.store.recentStateChanges().slice(0, RECENT_CHANGES_SHOWN).map((change) => ({
      ...change,
      label: this.machineStates.getLabel(change.stateId),
      icon: this.machineStates.getIcon(change.stateId),
      color: this.machineStates.getColor(change.stateId),
      tint: this.machineStates.getTint(change.stateId),
      brief: change.end !== null && change.seconds < BRIEF_CHANGE_SECONDS,
    })),
  );
  protected readonly olderChangesHidden = computed(() =>
    Math.max(0, this.stateChangesToday() - RECENT_CHANGES_SHOWN),
  );

  ngOnInit(): void {
    this.store.loadTodayEvents();
  }
}
