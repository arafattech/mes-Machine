import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { MachineConfigService } from '@module/machine/runtime/machine-config.service';
import { CacheAside, GetRedisClient } from 'config/redis/config.redis';
import { GetCalcVersion } from '@module/machine/realtime/production-events';
import moment from 'moment';
import { shiftWindowForDay } from '@module/machine/shift-window';
import { isKgUom, qualityDenominator, qualityPercent } from '@module/machine/quality';

/**
 * Read-heavy aggregation queries for the Angular machine-overview page — OEE,
 * "what's running now", and the shift-wise state breakdown. Moved here (out of
 * the Laravel backend) because node-server already owns the write-side of
 * `machine_state_events`/`machine_production_counts`, so the aggregation logic
 * lives next to the tables it reads instead of duplicated across two services.
 * CRUD for work orders / production-count logging stays in Laravel — only
 * calculation endpoints live here.
 */
@Injectable()
export class MachineCalculationsService {
  private readonly logger = new Logger(MachineCalculationsService.name);
  private readonly redis = GetRedisClient();
  // Short enough to never visibly disagree with a just-broadcast machine_status_runtime
  // transition, long enough to absorb a dashboard's repeat polling of an unchanged range.
  private readonly cacheTtlMs = Number(process.env.MACHINE_CALC_CACHE_TTL_MS ?? 8000);
  // Rejects rather than silently truncates — an unbounded findMany over a huge range
  // would otherwise load an unbounded result set into memory.
  private readonly maxRangeDays = Number(process.env.MACHINE_CALC_MAX_RANGE_DAYS ?? 400);

  constructor(
    private readonly prisma: PrismaService,
    private readonly machineConfigService: MachineConfigService,
  ) {}

  private parseId(id: string): bigint {
    try {
      const parsed = BigInt(id);
      if (parsed <= 0n) throw new Error('non-positive');
      return parsed;
    } catch {
      throw new NotFoundException('Invalid machine id');
    }
  }

  private assertRangeWithinLimit(from: moment.Moment, to: moment.Moment): void {
    const days = to.diff(from, 'days');
    if (days > this.maxRangeDays) {
      throw new BadRequestException(
        `Requested range (${days} days) exceeds the maximum allowed (${this.maxRangeDays} days)`,
      );
    }
  }

  /** Cache-aside under the machine's calc version (bumped by `ProductionRealtimeService` on
   * every production / wastage / config / target write), so a refetch triggered by a
   * realtime push never gets the pre-change result. */
  private async cachedForMachine<T>(machineId: bigint, key: string, compute: () => Promise<T>): Promise<T> {
    const version = await GetCalcVersion(this.redis, 'machine', machineId);
    return this.cached(`machine:calc:${key}:${machineId}:v${version}`, compute);
  }

  private cached<T>(cacheKey: string, compute: () => Promise<T>): Promise<T> {
    return CacheAside(this.redis, cacheKey, this.cacheTtlMs, compute, (stage, error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Cache ${stage} failed for ${cacheKey}: ${message}`);
    });
  }

  /**
   * Production/OEE bundle aggregated over [from, to). Availability comes from
   * `machine_state_events` (real today); Performance needs
   * `machine_has_configs.ideal_cycle_seconds` (usually unset today, so
   * performance/efficiency come back null until it's configured). Waste and Quality
   * include the kg logged via the Wastage Log (`machine_wastage_allocations`) on top of
   * `scrap_count`; Performance stays on the machine's own counts.
   *
   * `live` carries the raw OEE inputs + the instant they were computed, so the frontend can
   * advance Availability/Performance/OEE every second while a state is open (it changes with
   * time, not only on writes) without polling — it refetches only on a realtime push.
   * The frontend mirrors the formulas below (`MachineOverviewDataService.liveOeeMetrics`).
   */
  async overview(machineIdStr: string, fromStr?: string, toStr?: string) {
    const machineId = this.parseId(machineIdStr);
    const machine = await this.prisma.machines.findUnique({ where: { id: machineId } });
    if (!machine) throw new NotFoundException('Machine not found');

    const to = toStr ? moment(toStr) : moment();
    const from = fromStr ? moment(fromStr) : to.clone().startOf('month');
    this.assertRangeWithinLimit(from, to);

    const result = await this.cachedForMachine(machineId, `overview:${from.toISOString()}:${to.toISOString()}`, async () => {
      const [
        { activeSeconds, totalSeconds, openStateProductive, computedAt },
        counts,
        countedUoms,
        wastageByDay,
        targetRow,
        config,
      ] = await Promise.all([
        this.productiveSecondsInRange(machineId, from, to),
        this.prisma.machine_production_counts.aggregate({
          where: {
            machine_id: machineId,
            bucket_started_at: { lt: to.toDate() },
            bucket_ended_at: { gt: from.toDate() },
          },
          _sum: { good_count: true, scrap_count: true, total_count: true },
        }),
        this.countedProductUoms(machineId, from, to),
        this.loggedWastageByDay(machineId, from, to),
        this.prisma.machine_production_targets.findFirst({
          where: {
            machine_id: machineId,
            is_active: true,
            effective_from: { lte: to.toDate() },
            OR: [{ effective_to: null }, { effective_to: { gte: from.toDate() } }],
          },
          orderBy: { effective_from: 'desc' },
          select: { target_qty: true },
        }),
        this.prisma.machine_has_configs.findFirst({
          where: { machine_id: machineId, is_active: true },
          select: { ideal_cycle_seconds: true },
        }),
      ]);

      const good = counts._sum.good_count ?? 0;
      const scrap = counts._sum.scrap_count ?? 0;
      const total = counts._sum.total_count ?? 0;
      const loggedWastage = this.sumValues(wastageByDay);
      // Logged wastage is material lost on top of the counted output, so it widens the
      // Quality denominator rather than eating into `good`. `total`/`achieved` stay the
      // machine's own counts (unchanged contract).
      const qualityInput = {
        good,
        total,
        wastageKg: loggedWastage,
        countsInKg: countedUoms.every(isKgUom),
      };
      const target = targetRow?.target_qty ?? 0;
      const idealCycleSeconds = config?.ideal_cycle_seconds ?? null;

      const availability = totalSeconds > 0 ? round1((activeSeconds / totalSeconds) * 100) : null;
      const performance = idealCycleSeconds && activeSeconds > 0
        ? round1(Math.min(100, (total * idealCycleSeconds / activeSeconds) * 100))
        : null;
      const quality = qualityPercent(qualityInput);
      const efficiency = availability !== null && performance !== null && quality !== null
        ? round1((availability * performance * quality) / 10000)
        : null;

      return {
        target,
        achieved: total,
        ok: good,
        total,
        waste: round2(scrap + loggedWastage),
        logged_wastage_kg: round2(loggedWastage),
        oee: { availability, performance, quality, efficiency },
        live: {
          computed_at: computedAt.toISOString(),
          active_seconds: activeSeconds,
          total_seconds: totalSeconds,
          open_state_productive: openStateProductive,
          ideal_cycle_seconds: idealCycleSeconds,
          total_count: total,
          good_count: good,
          quality_total: qualityDenominator(qualityInput),
        },
      };
    });

    // Computed outside the cache: how old this (possibly cached) snapshot is, measured on the
    // server's own clock, so the client can extrapolate from the true snapshot instant without
    // depending on client/server clock agreement.
    return {
      ...result,
      live: { ...result.live, age_ms: Math.max(0, Date.now() - Date.parse(result.live.computed_at)) },
    };
  }

  /**
   * What's running on the machine right now — the most recent production-count
   * bucket's work order + shift. Independent of `overview()`'s window — always
   * the single latest bucket, not a range aggregate.
   */
  async currentWorkOrder(machineIdStr: string) {
    const machineId = this.parseId(machineIdStr);

    const latest = await this.prisma.machine_production_counts.findFirst({
      where: { machine_id: machineId },
      orderBy: { bucket_started_at: 'desc' },
      include: { work_orders: { include: { products: true } }, employee_shifts: true },
    });

    return {
      work_order: latest?.work_orders ? {
        id: Number(latest.work_orders.id),
        custom_id: latest.work_orders.custom_id,
        product_name: latest.work_orders.products?.product_name ?? null,
        quantity: latest.work_orders.quantity,
        status: latest.work_orders.status,
      } : null,
      shift: latest?.employee_shifts ? {
        id: Number(latest.employee_shifts.id),
        name: latest.employee_shifts.name,
        start_time: latest.employee_shifts.start_time,
        end_time: latest.employee_shifts.end_time,
        color: latest.employee_shifts.color,
      } : null,
      bucket_started_at: latest?.bucket_started_at ?? null,
    };
  }

  /**
   * Shift-wise hours per machine state, one row per (day × shift) in
   * [from, to) — dynamic per whatever `machine_states` rows this machine's
   * event history actually contains, not a fixed Active/Idle/Inactive/
   * Maintenance set. Shifts are plant-wide time-of-day definitions
   * (`employee_shifts`), not stored per machine-state-event, so each day's
   * shift window is reconstructed here — same wraparound idiom already used
   * for HR attendance in the Laravel codebase (`DailyAttendanceService`,
   * `AttendanceCheckoutService::shiftWindow`): only the shift's time-of-day
   * matters, and if end <= start numerically the shift crosses midnight.
   *
   * Every observed state gets an entry — there's no more hardcoded exclusion
   * list (the old version always dropped `fault`). A row's `total_seconds`
   * can still legitimately be less than the full shift length if the machine
   * had no state event at all for part of the window.
   *
   * Two shift definitions covering overlapping clock minutes will double-count
   * a machine's seconds across both rows — inherent to shifts not being tied
   * to individual events, not something this method can resolve.
   */
  async shiftBreakdown(machineIdStr: string, fromStr?: string, toStr?: string) {
    const machineId = this.parseId(machineIdStr);
    const machine = await this.prisma.machines.findUnique({ where: { id: machineId } });
    if (!machine) throw new NotFoundException('Machine not found');

    const to = toStr ? moment(toStr) : moment();
    const from = fromStr ? moment(fromStr) : to.clone().startOf('month');
    this.assertRangeWithinLimit(from, to);

    return this.cachedForMachine(machineId, `shift-breakdown:${from.toISOString()}:${to.toISOString()}`, async () => {
      // Fetched once, reused across every day × shift window below — no query inside the loop.
      const events = await this.prisma.machine_state_events.findMany({
        where: {
          machine_id: machineId,
          started_at: { lt: to.toDate() },
          OR: [{ ended_at: null }, { ended_at: { gt: from.toDate() } }],
        },
        select: { machine_state_id: true, started_at: true, ended_at: true },
      });

      const shifts = await this.prisma.employee_shifts.findMany({
        where: { is_active: true },
        select: { id: true, name: true, start_time: true, end_time: true, color: true },
      });

      const statesById = await this.loadStatesMap();

      const rows: Array<{
        date: string;
        shift_id: number;
        shift_name: string;
        shift_color: string | null;
        states: Array<{ machine_state_id: number; name: string; color: string | null; seconds: number }>;
        total_seconds: number;
      }> = [];

      for (let day = from.clone().startOf('day'); day.isBefore(to); day.add(1, 'day')) {
        for (const shift of shifts) {
          const [windowStart, windowEnd] = shiftWindowForDay(shift, day);
          // Clip the shift window itself to the requested [from, to) — a night shift
          // on the last day can extend past `to`; anything beyond the picked range
          // must not count, same as every other endpoint on this page.
          const clippedStart = moment.max(windowStart, from);
          const clippedEnd = moment.min(windowEnd, to);
          const secondsByState = this.stateSecondsByBucket(events, clippedStart, clippedEnd);

          const states = [...secondsByState.entries()].map(([machineStateId, seconds]) => ({
            machine_state_id: machineStateId,
            name: statesById.get(machineStateId)?.name ?? `State ${machineStateId}`,
            color: statesById.get(machineStateId)?.color ?? null,
            seconds,
          }));
          const totalSeconds = states.reduce((sum, s) => sum + s.seconds, 0);

          rows.push({
            date: day.format('YYYY-MM-DD'),
            shift_id: Number(shift.id),
            shift_name: shift.name,
            shift_color: shift.color,
            states,
            total_seconds: totalSeconds,
          });
        }
      }

      return { rows };
    });
  }

  /**
   * Daily aggregated good and scrap for the machine — `scrap` is `scrap_count` plus the kg
   * logged via the Wastage Log for that day.
   */
  async dailyProduction(machineIdStr: string, fromStr?: string, toStr?: string) {
    const machineId = this.parseId(machineIdStr);
    const to = toStr ? moment(toStr) : moment();
    const from = fromStr ? moment(fromStr) : to.clone().startOf('month');
    this.assertRangeWithinLimit(from, to);

    return this.cachedForMachine(machineId, `daily-production:${from.toISOString()}:${to.toISOString()}`, async () => {
      const [counts, wastageByDay] = await Promise.all([
        this.prisma.machine_production_counts.findMany({
          where: {
            machine_id: machineId,
            bucket_started_at: { lt: to.toDate() },
            bucket_ended_at: { gt: from.toDate() },
          },
          select: { bucket_started_at: true, good_count: true, scrap_count: true },
        }),
        this.loggedWastageByDay(machineId, from, to),
      ]);

      const msByDay = new Map<string, { good: number; scrap: number }>();

      for (const count of counts) {
        if (!count.bucket_started_at) continue;
        const start = moment(count.bucket_started_at);
        const clipStart = moment.max(start, from);
        if (clipStart.isSameOrAfter(to)) continue;

        const dayKey = clipStart.format('YYYY-MM-DD');
        const bucket = msByDay.get(dayKey) ?? { good: 0, scrap: 0 };
        bucket.good += count.good_count;
        bucket.scrap += count.scrap_count;
        msByDay.set(dayKey, bucket);
      }

      const rows: Array<{ date: string; good: number; scrap: number }> = [];
      for (let day = from.clone().startOf('day'); day.isBefore(to); day.add(1, 'day')) {
        const key = day.format('YYYY-MM-DD');
        const bucket = msByDay.get(key) ?? { good: 0, scrap: 0 };
        rows.push({
          date: key,
          good: bucket.good,
          scrap: round2(bucket.scrap + (wastageByDay.get(key) ?? 0)),
        });
      }

      return { rows };
    });
  }

  /**
   * kg allocated to this machine from Wastage Log entries, keyed by `entry_date`
   * (`YYYY-MM-DD`). Written by Laravel (`WorkOrderController::logWastage`), which splits each
   * entry across machines by production share. `entry_date` is a calendar DATE (no time),
   * so the range is matched by local calendar day: `to` is exclusive, hence the -1ms.
   */
  private async loggedWastageByDay(
    machineId: bigint,
    from: moment.Moment,
    to: moment.Moment,
  ): Promise<Map<string, number>> {
    const allocations = await this.prisma.machine_wastage_allocations.findMany({
      where: {
        machine_id: machineId,
        machine_wastage_entries: {
          entry_date: {
            gte: calendarDate(from),
            lte: calendarDate(to.clone().subtract(1, 'ms')),
          },
        },
      },
      select: {
        allocated_qty_kg: true,
        machine_wastage_entries: { select: { entry_date: true } },
      },
    });

    const kgByDay = new Map<string, number>();
    for (const allocation of allocations) {
      const dayKey = moment.utc(allocation.machine_wastage_entries.entry_date).format('YYYY-MM-DD');
      kgByDay.set(dayKey, (kgByDay.get(dayKey) ?? 0) + Number(allocation.allocated_qty_kg));
    }
    return kgByDay;
  }

  private sumValues(values: Map<string, number>): number {
    let sum = 0;
    for (const value of values.values()) sum += value;
    return sum;
  }

  /** id → {name, color} for every active `machine_states` row — small table, one query per request. */
  /** Thin wrapper over the shared Redis-cached `machine:states_map` — avoids a fresh
   * uncached Prisma query on every request for data that's already cached elsewhere. */
  private async loadStatesMap(): Promise<Map<number, { name: string; color: string | null }>> {
    const statesById = await this.machineConfigService.loadMachineStatesMap();
    return new Map(
      [...statesById.entries()].map(([id, meta]) => [id, { name: meta.name, color: meta.color }]),
    );
  }

  /**
   * Distinct product UoM names of the counts overlapping `[from, to)` — decides whether Quality
   * applies (see `quality.ts`). One indexed round trip on a hot, realtime-refetched path.
   * Buckets without a work order have no product and are left out (only the legacy PLC count
   * writer, disabled under channel mapping, produces them).
   */
  private async countedProductUoms(machineId: bigint, from: moment.Moment, to: moment.Moment): Promise<Array<string | null>> {
    const rows = await this.prisma.$queryRaw<Array<{ name: string | null }>>`
      SELECT DISTINCT u.name
      FROM machine_production_counts c
      JOIN work_orders w ON w.id = c.work_order_id
      JOIN products p ON p.id = w.product_id
      LEFT JOIN uoms u ON u.id = p.uom_id
      WHERE c.machine_id = ${machineId}
        AND c.bucket_started_at < ${to.toDate()}
        AND c.bucket_ended_at > ${from.toDate()}`;
    return rows.map((row) => row.name);
  }

  /** The set of `machine_states.id` that count toward OEE Availability — replaces
   * `state === 'active'`. Reuses the shared Redis-cached states map. */
  private async loadProductiveStateIds(): Promise<Set<number>> {
    const statesById = await this.machineConfigService.loadMachineStatesMap();
    return new Set(
      [...statesById.values()].filter((meta) => meta.counts_as_productive).map((meta) => meta.id),
    );
  }

  /** Per-state seconds within [start, end), clipping already-fetched events in memory — dynamic, one entry per state actually observed (no fixed bucket set, no hardcoded exclusion). */
  private stateSecondsByBucket(
    events: Array<{ machine_state_id: bigint | null; started_at: Date; ended_at: Date | null }>,
    start: moment.Moment,
    end: moment.Moment,
  ): Map<number, number> {
    const seconds = new Map<number, number>();

    for (const event of events) {
      if (event.machine_state_id === null) continue;

      const eventStart = moment(event.started_at);
      const eventEnd = event.ended_at ? moment(event.ended_at) : moment();
      const clipStart = moment.max(eventStart, start);
      const clipEnd = moment.min(eventEnd, end);
      if (clipEnd.isSameOrBefore(clipStart)) continue;

      const stateId = Number(event.machine_state_id);
      seconds.set(stateId, (seconds.get(stateId) ?? 0) + clipEnd.diff(clipStart, 'seconds'));
    }

    return seconds;
  }

  /** [activeSeconds, totalSeconds] for a machine over [from, to), clipping each event to the window. `activeSeconds` sums whichever states are flagged `counts_as_productive`, not a hardcoded state name. */
  private async productiveSecondsInRange(
    machineId: bigint,
    from: moment.Moment,
    to: moment.Moment,
  ): Promise<{
    activeSeconds: number;
    totalSeconds: number;
    /** Productive flag of the still-open state when the window reaches now; `null` when no state
     * is open or the window ended in the past — nothing keeps accruing, so nothing to extrapolate. */
    openStateProductive: boolean | null;
    computedAt: moment.Moment;
  }> {
    const [events, productiveStateIds] = await Promise.all([
      this.prisma.machine_state_events.findMany({
        where: {
          machine_id: machineId,
          started_at: { lt: to.toDate() },
          OR: [{ ended_at: null }, { ended_at: { gt: from.toDate() } }],
        },
        select: { machine_state_id: true, started_at: true, ended_at: true },
      }),
      this.loadProductiveStateIds(),
    ]);

    const now = moment();
    const windowReachesNow = to.isSameOrAfter(now);
    let activeSeconds = 0;
    let totalSeconds = 0;
    let openStateProductive: boolean | null = null;

    for (const event of events) {
      const isProductive =
        event.machine_state_id !== null && productiveStateIds.has(Number(event.machine_state_id));
      if (event.ended_at === null && windowReachesNow) openStateProductive = isProductive;

      const start = moment.max(moment(event.started_at), from);
      const end = moment.min(event.ended_at ? moment(event.ended_at) : now, to);
      if (end.isSameOrBefore(start)) continue;

      const seconds = end.diff(start, 'seconds');
      totalSeconds += seconds;
      if (isProductive) activeSeconds += seconds;
    }

    return { activeSeconds, totalSeconds, openStateProductive, computedAt: now };
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A local calendar day as the UTC-midnight `Date` Prisma uses for MySQL `DATE` columns. */
function calendarDate(value: moment.Moment): Date {
  return new Date(`${value.format('YYYY-MM-DD')}T00:00:00.000Z`);
}
