import { Metric, ProductionSummary } from '@production-module/shared/interface/interface';
import { OeeInputs } from '@production-module/shared/services/machine-dashboard.store';
import { StateRangeSummary } from '@production-module/shared/services/machine-runtime-history.service';
import { formatFactoryDayMonth } from '@shared/utilities/date-format';

/**
 * Presentation logic shared by the OEE & Production and SAP Fiori dashboards, so both explain the
 * same authoritative figures (node-server OEE, production overview, state events) the same way.
 * Pure functions — no requests, no new business rules.
 */

/** One OEE factor (Availability, Performance or Quality) with the inputs behind it. */
export interface CascadeStep {
  label: string;
  /** The factor itself (e.g. "57 %"); "—" when not measured. */
  text: string;
  /** The factor as a number, `null` when not measured. */
  value: number | null;
  /** The factor as a bar fill, 0–100 (0 when not measured); the rest of the bar is the loss at this step. */
  progress: number;
  measured: boolean;
  /** The real inputs behind the factor, or how to start measuring it. */
  detail: string;
}

export interface DailyGood {
  date: string;
  good: number;
}

/** One day of good output for a production micro chart, scaled to the best day. */
export interface DailyGoodBar {
  label: string;
  heightPct: number;
}

/** A non-productive state's share of the period. */
export interface LossRow {
  stateId: number;
  seconds: number;
  hours: string;
  /** Share of all tracked time in the period, one decimal. */
  share: number;
  stops: number;
  longestSeconds: number;
}

const numberFormat = new Intl.NumberFormat();

export function clampPercent(value: number | null): number {
  return value === null ? 0 : Math.max(0, Math.min(100, value));
}

export function percentText(value: number | null): string {
  return value === null ? '—' : `${value} %`;
}

/** `12.5 h` — long periods read better in hours than as hh:mm:ss. */
export function hoursText(seconds: number): string {
  return `${(seconds / 3600).toFixed(1)} h`;
}

/**
 * The three OEE factors — Availability (stops), Performance (slow running), Quality (rejects) —
 * each on its own 0–100 scale. `metrics` is the store's `[Availability, Performance, Quality, Efficiency]`.
 */
export function buildOeeCascade(metrics: Metric[], inputs: OeeInputs | null): CascadeStep[] {
  const [availability, performance, quality] = metrics;
  if (!availability || !performance || !quality) return [];

  const a = availability.value;
  const p = performance.value;
  const q = quality.value;

  return [
    {
      label: availability.label,
      text: percentText(a),
      value: a,
      progress: clampPercent(a),
      measured: a !== null,
      detail: inputs
        ? $localize`Running ${hoursText(inputs.activeSeconds)} of ${hoursText(inputs.totalSeconds)} tracked`
        : $localize`No state time recorded in this period`,
    },
    {
      label: performance.label,
      text: percentText(p),
      value: p,
      progress: clampPercent(p),
      measured: p !== null,
      detail:
        p !== null && inputs?.idealCycleSeconds
          ? $localize`${numberFormat.format(inputs.totalCount)} pieces at ${inputs.idealCycleSeconds} s ideal cycle`
          : $localize`Set the ideal cycle time in machine config to measure speed`,
    },
    {
      label: quality.label,
      text: percentText(q),
      value: q,
      progress: clampPercent(q),
      measured: q !== null,
      detail:
        q !== null && inputs?.qualityTotal
          ? $localize`${numberFormat.format(inputs.goodCount)} good of ${numberFormat.format(inputs.qualityTotal)} kg incl. wastage`
          : $localize`Measured only when every product is counted in kg`,
    },
  ];
}

/** Achieved vs target in %, `null` when no target applies (never shown as 0 %). */
export function achievementPercent(production: ProductionSummary | null): number | null {
  if (!production?.productionTarget) return null;
  return Math.round((production.productionAchieved / production.productionTarget) * 1000) / 10;
}

/** Good of total, "—" when nothing was produced. */
export function yieldText(production: ProductionSummary | null): string {
  if (!production?.machineTotal) return '—';
  return `${Math.round((production.machineOk / production.machineTotal) * 1000) / 10} %`;
}

export function toDailyGoodBars(rows: DailyGood[]): DailyGoodBar[] {
  const best = Math.max(0, ...rows.map((r) => r.good));
  return rows.map((r) => ({
    label: `${formatFactoryDayMonth(r.date)} — ${numberFormat.format(r.good)}`,
    heightPct: best > 0 ? Math.max(2, (r.good / best) * 100) : 2,
  }));
}

export function dailyGoodRange(rows: DailyGood[]): { from: string; to: string } {
  return {
    from: rows.length ? formatFactoryDayMonth(rows[0].date) : '',
    to: rows.length ? formatFactoryDayMonth(rows[rows.length - 1].date) : '',
  };
}

/** Spoken summary of the micro chart. (No ":" right after a placeholder — `$localize` would
 * parse it as a metadata block and throw at runtime.) */
export function dailyGoodSummary(rows: DailyGood[]): string {
  const best = rows.reduce<DailyGood | null>((top, r) => (!top || r.good > top.good ? r : top), null);
  return best && best.good > 0
    ? $localize`Best day ${formatFactoryDayMonth(best.date)} with ${numberFormat.format(best.good)} good`
    : $localize`No good output in this period`;
}

/**
 * Non-productive states of the period, largest first; share is of all tracked time. `onlyStateIds`
 * narrows the ranking to those states without changing the share's denominator.
 */
export function biggestLosses(
  summary: StateRangeSummary[],
  productiveIds: Set<number>,
  limit: number,
  onlyStateIds?: Set<number>,
): LossRow[] {
  const total = summary.reduce((sum, s) => sum + s.seconds, 0);
  return summary
    .filter((s) => !productiveIds.has(s.stateId) && (!onlyStateIds || onlyStateIds.has(s.stateId)))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, limit)
    .map((s) => ({
      stateId: s.stateId,
      seconds: s.seconds,
      hours: hoursText(s.seconds),
      share: total > 0 ? Math.round((s.seconds / total) * 1000) / 10 : 0,
      stops: s.events,
      longestSeconds: s.longestSeconds,
    }));
}
