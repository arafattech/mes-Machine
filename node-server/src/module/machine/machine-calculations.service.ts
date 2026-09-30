import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { MachineConfigService } from '@module/machine/runtime/machine-config.service';
import { CacheAside, GetRedisClient } from 'config/redis/config.redis';
import moment from 'moment';

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
   * performance/efficiency come back null until it's configured).
   */
  async overview(machineIdStr: string, fromStr?: string, toStr?: string) {
    const machineId = this.parseId(machineIdStr);
    const machine = await this.prisma.machines.findUnique({ where: { id: machineId } });
    if (!machine) throw new NotFoundException('Machine not found');

    const to = toStr ? moment(toStr) : moment();
    const from = fromStr ? moment(fromStr) : to.clone().startOf('month');
    this.assertRangeWithinLimit(from, to);

    const cacheKey = `machine:calc:overview:${machineId}:${from.toISOString()}:${to.toISOString()}`;
    return this.cached(cacheKey, async () => {
      const { activeSeconds, totalSeconds } = await this.productiveSecondsInRange(machineId, from, to);

      const counts = await this.prisma.machine_production_counts.aggregate({
        where: {
          machine_id: machineId,
          bucket_started_at: { lt: to.toDate() },
          bucket_ended_at: { gt: from.toDate() },
        },
        _sum: { good_count: true, scrap_count: true, total_count: true },
      });
      const good = counts._sum.good_count ?? 0;
      const scrap = counts._sum.scrap_count ?? 0;
      const total = counts._sum.total_count ?? 0;

      const targetRow = await this.prisma.machine_production_targets.findFirst({
        where: {
          machine_id: machineId,
          is_active: true,
          effective_from: { lte: to.toDate() },
          OR: [{ effective_to: null }, { effective_to: { gte: from.toDate() } }],
        },
        orderBy: { effective_from: 'desc' },
        select: { target_qty: true },
      });
      const target = targetRow?.target_qty ?? 0;

      const config = await this.prisma.machine_has_configs.findFirst({
        where: { machine_id: machineId, is_active: true },
        select: { ideal_cycle_seconds: true },
      });
      const idealCycleSeconds = config?.ideal_cycle_seconds ?? null;

      const availability = totalSeconds > 0 ? round1((activeSeconds / totalSeconds) * 100) : null;
      const performance = idealCycleSeconds && activeSeconds > 0
        ? round1(Math.min(100, (total * idealCycleSeconds / activeSeconds) * 100))
        : null;
      const quality = total > 0 ? round1((good / total) * 100) : null;
      const efficiency = availability !== null && performance !== null && quality !== null
        ? round1((availability * performance * quality) / 10000)
        : null;

      return {
        target,
        achieved: total,
        ok: good,
        total,
        waste: scrap,
        oee: { availability, performance, quality, efficiency },
      };
    });
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

    const cacheKey = `machine:calc:shift-breakdown:${machineId}:${from.toISOString()}:${to.toISOString()}`;
    return this.cached(cacheKey, async () => {
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
          const [windowStart, windowEnd] = this.shiftWindowForDay(shift, day);
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
   * Daily aggregated good and scrap counts for the machine.
   */
  async dailyProduction(machineIdStr: string, fromStr?: string, toStr?: string) {
    const machineId = this.parseId(machineIdStr);
    const to = toStr ? moment(toStr) : moment();
    const from = fromStr ? moment(fromStr) : to.clone().startOf('month');
    this.assertRangeWithinLimit(from, to);

    const cacheKey = `machine:calc:daily-production:${machineId}:${from.toISOString()}:${to.toISOString()}`;
    return this.cached(cacheKey, async () => {
      const counts = await this.prisma.machine_production_counts.findMany({
        where: {
          machine_id: machineId,
          bucket_started_at: { lt: to.toDate() },
          bucket_ended_at: { gt: from.toDate() },
        },
        select: { bucket_started_at: true, good_count: true, scrap_count: true },
      });

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
          scrap: bucket.scrap,
        });
      }

      return { rows };
    });
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

  /** The set of `machine_states.id` that count toward OEE Availability — replaces
   * `state === 'active'`. Reuses the shared Redis-cached states map. */
  private async loadProductiveStateIds(): Promise<Set<number>> {
    const statesById = await this.machineConfigService.loadMachineStatesMap();
    return new Set(
      [...statesById.values()].filter((meta) => meta.counts_as_productive).map((meta) => meta.id),
    );
  }

  /** A shift's real datetime window for one specific calendar day — time-of-day
   * only, the shift row's own stored date is irrelevant. */
  private shiftWindowForDay(
    shift: { start_time: Date; end_time: Date },
    day: moment.Moment,
  ): [moment.Moment, moment.Moment] {
    const dayStr = day.format('YYYY-MM-DD');
    const start = moment(`${dayStr} ${moment(shift.start_time).format('HH:mm:ss')}`);
    const end = moment(`${dayStr} ${moment(shift.end_time).format('HH:mm:ss')}`);
    if (end.isSameOrBefore(start)) {
      end.add(1, 'day');
    }
    return [start, end];
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
  ): Promise<{ activeSeconds: number; totalSeconds: number }> {
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

    let activeSeconds = 0;
    let totalSeconds = 0;

    for (const event of events) {
      const start = moment.max(moment(event.started_at), from);
      const end = moment.min(event.ended_at ? moment(event.ended_at) : moment(), to);
      if (end.isSameOrBefore(start)) continue;

      const seconds = end.diff(start, 'seconds');
      totalSeconds += seconds;
      if (event.machine_state_id !== null && productiveStateIds.has(Number(event.machine_state_id))) {
        activeSeconds += seconds;
      }
    }

    return { activeSeconds, totalSeconds };
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
