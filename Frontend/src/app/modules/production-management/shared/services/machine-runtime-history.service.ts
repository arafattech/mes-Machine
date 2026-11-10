import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CommonService } from '@app/services/common-service/common.service';
import { AmChartDataset } from '@production-module/shared/components/am-activity-chart/am-activity-chart.component';
import { MachineStateEventRow } from '@production-module/shared/services/machine-duration.service';
import { MachineStatesService } from '@app/modules/production-management/shared/services/machine-states.service';
import { MS_PER_DAY, factoryDateKey, factoryDayStart, formatFactoryDayMonth } from '@shared/utilities/date-format';

const MS_PER_HOUR = 3_600_000;

/** Hours per `machine_states.id` actually observed for one factory calendar day (`date` = its midnight) — dynamic,
 * not a fixed Active/Idle/Inactive set (that set silently dropped Maintenance/Fault
 * from the Activity chart before this was generalized). */
export interface DailyStateBreakdown {
  date: Date;
  hoursByState: Record<number, number>;
}

/** One state's share of a range — downtime analysis rows. */
export interface StateRangeSummary {
  stateId: number;
  seconds: number;
  events: number;
  longestSeconds: number;
}

export interface MachineRangeAnalysis {
  daily: DailyStateBreakdown[];
  stateSummary: StateRangeSummary[];
}

/**
 * Historical reporting over `MachineStateEvents` (per-day breakdown, day drill-down)
 * for an arbitrary caller-supplied date range. Kept separate from `MachineDurationService`,
 * which is a live "today" singleton snapshot, not a range-query service — mixing the two
 * would conflate a live cache with reporting.
 */
@Injectable({ providedIn: 'root' })
export class MachineRuntimeHistoryService {
  constructor(
    private readonly common: CommonService,
    private readonly machineStates: MachineStatesService,
  ) {}

  /** Raw state-event rows overlapping `[start, end)`, clipped by the caller. */
  async getEventsInRange(
    machineKey: string,
    start: Date,
    end: Date,
  ): Promise<MachineStateEventRow[]> {
    if (!machineKey) return [];
    const filter =
      `machine_id eq ${machineKey} and started_at le ${end.toISOString()}` +
      ` and (ended_at eq null or ended_at ge ${start.toISOString()})`;
    const res = await firstValueFrom(
      this.common.get<{ value: MachineStateEventRow[] }>(
        `MachineStateEvents?$filter=${filter}&$orderby=started_at asc`,
      ),
    );
    return res?.value ?? [];
  }

  /** One `MachineStateEvents` fetch over `[from, to)`, reduced two ways: per-day state hours (activity
   * chart) and per-state totals / event counts / longest event (downtime analysis). */
  async getRangeAnalysis(machineKey: string, from: Date, to: Date): Promise<MachineRangeAnalysis> {
    const rows = await this.getEventsInRange(machineKey, from, to);
    return {
      daily: this.toDailyBreakdown(rows, from, to),
      stateSummary: this.summarizeByState(rows, from, to),
    };
  }

  /** Per-state hours per calendar day over `[from, to)` — feeds both the line and bar charts. */
  private toDailyBreakdown(rows: MachineStateEventRow[], from: Date, to: Date): DailyStateBreakdown[] {
    const msByDay = new Map<string, Record<number, number>>();
    for (const row of rows) {
      if (row.machine_state_id == null) continue;
      const clipped = this.clip(row, from, to);
      if (!clipped) continue;
      for (const { date, ms } of this.splitByDay(...clipped)) {
        const key = this.dayKey(date);
        const bucket = msByDay.get(key) ?? {};
        bucket[row.machine_state_id] = (bucket[row.machine_state_id] ?? 0) + ms;
        msByDay.set(key, bucket);
      }
    }

    const days: DailyStateBreakdown[] = [];
    for (let cursor = factoryDayStart(from); cursor < to; cursor = new Date(cursor.getTime() + MS_PER_DAY)) {
      const bucketMs = msByDay.get(this.dayKey(cursor)) ?? {};
      const hoursByState: Record<number, number> = {};

      // Overlapping/duplicate DB records can push a day's summed state time past
      // 24h. Scale every state down proportionally so the bar still totals 24h
      // without dropping states — a greedy per-state cap would zero out every
      // state after the first (Object.entries order for numeric keys is
      // ascending by id, so Active always wins and the rest silently vanish).
      const totalRawMs = Object.values(bucketMs).reduce((sum, ms) => sum + ms, 0);
      const scale = totalRawMs > MS_PER_DAY ? MS_PER_DAY / totalRawMs : 1;

      for (const [stateId, ms] of Object.entries(bucketMs)) {
        const scaledMs = ms * scale;
        if (scaledMs > 0) {
          hoursByState[Number(stateId)] = scaledMs / MS_PER_HOUR;
        }
      }
      days.push({ date: cursor, hoursByState });
    }
    return days;
  }

  /** Per-state clipped seconds, event count and longest single event, largest total first. */
  private summarizeByState(rows: MachineStateEventRow[], from: Date, to: Date): StateRangeSummary[] {
    const byState = new Map<number, StateRangeSummary>();
    for (const row of rows) {
      if (row.machine_state_id == null) continue;
      const seconds = this.clippedDurationSeconds(row, from, to);
      if (seconds <= 0) continue;
      const summary = byState.get(row.machine_state_id) ?? {
        stateId: row.machine_state_id,
        seconds: 0,
        events: 0,
        longestSeconds: 0,
      };
      summary.seconds += seconds;
      summary.events += 1;
      summary.longestSeconds = Math.max(summary.longestSeconds, seconds);
      byState.set(row.machine_state_id, summary);
    }
    return [...byState.values()].sort((a, b) => b.seconds - a.seconds);
  }

  /** One series per distinct state observed in `breakdown`, colored via `MachineStatesService`
   * — replaces the old fixed 3-of-5 hardcoding that silently dropped Maintenance/Fault. */
  toStateDatasets(breakdown: DailyStateBreakdown[]): AmChartDataset[] {
    const xLabels = breakdown.map((d) => this.formatDate(d.date));
    const stateIds = new Set<number>();
    for (const day of breakdown) {
      for (const stateId of Object.keys(day.hoursByState))
        stateIds.add(Number(stateId));
    }

    return [...stateIds]
      .sort((a, b) => a - b)
      .map((stateId) => ({
        label: this.machineStates.getLabel(stateId),
        data: breakdown.map((d, i) => ({
          x: xLabels[i],
          y: d.hoursByState[stateId] ?? 0,
        })),
        borderColor: this.machineStates.getColor(stateId),
        backgroundColor: this.machineStates.getColor(stateId),
        fill: true,
      }));
  }

  private formatDate(date: Date): string {
    return formatFactoryDayMonth(date);
  }

  private dayKey(d: Date): string {
    return factoryDateKey(d);
  }

  /** Seconds of a row's overlap with `[start, end)` — a row crossing the window boundary
   * (e.g. a shift starting the day before) must only contribute the portion inside the
   * window, not its full raw span, or per-window totals overcount past their real duration. */
  clippedDurationSeconds(
    row: MachineStateEventRow,
    start: Date,
    end: Date,
  ): number {
    const clipped = this.clip(row, start, end);
    return clipped ? Math.round((clipped[1] - clipped[0]) / 1000) : 0;
  }

  /** Clip a row's interval to `[start, end)`; null if there's no overlap. */
  private clip(
    row: MachineStateEventRow,
    start: Date,
    end: Date,
  ): [number, number] | null {
    const rowStart = Date.parse(row.started_at);
    const rowEnd = row.ended_at ? Date.parse(row.ended_at) : Date.now();
    const from = Math.max(rowStart, start.getTime());
    const to = Math.min(rowEnd, end.getTime());
    return to > from ? [from, to] : null;
  }

  /** Split `[fromMs, toMs)` into per-factory-day chunks so intervals crossing midnight bucket correctly. */
  private splitByDay(
    fromMs: number,
    toMs: number,
  ): Array<{ date: Date; ms: number }> {
    const chunks: Array<{ date: Date; ms: number }> = [];
    let cursor = fromMs;
    while (cursor < toMs) {
      const dayStart = factoryDayStart(cursor);
      const nextMidnight = dayStart.getTime() + MS_PER_DAY;
      const chunkEnd = Math.min(nextMidnight, toMs);
      chunks.push({ date: dayStart, ms: chunkEnd - cursor });
      cursor = chunkEnd;
    }
    return chunks;
  }
}
