import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { MachineConfigService } from '@module/machine/runtime/machine-config.service';
import { CacheAside, GetRedisClient } from 'config/redis/config.redis';
import { GetCalcVersion } from '@module/machine/realtime/production-events';
import { isKgUom, qualityPercent } from '@module/machine/quality';

interface RollupRow {
  machine_id: number;
  machine_name: string | null;
  shift_id: number | null;
  shift_name: string | null;
  shift_color: string | null;
  good_count: number;
  scrap_count: number;
  total_count: number;
  started_at: Date;
  ended_at: Date;
}

interface MachineWindow {
  start: Date;
  end: Date;
  totalCount: number;
  goodCount: number;
}

export interface WorkOrderOee {
  availability: number | null;
  performance: number | null;
  quality: number | null;
  efficiency: number | null;
}

interface WorkOrderOeeResult {
  overall: WorkOrderOee;
  /** Same 4 figures, scoped to one machine's own window/config/counts — keyed by `machine_id`. */
  byMachine: Record<number, WorkOrderOee>;
}

/**
 * Execution rollup for a work order: every machine+shift combination that has
 * logged production against it (`machine_production_counts`), summed, plus
 * overall progress against the work order's target quantity. A work order can
 * be planned across several machines (`planned_machines`, via the
 * `work_order_machines` pivot) — the execution rollup (`machines`) reports
 * what actually ran, which may differ from what was planned.
 *
 * Planning/CRUD for work orders stays in Laravel (`WorkOrderController`) —
 * only this read-heavy rollup calculation lives here.
 */
@Injectable()
export class WorkOrderDetailService {
  private readonly logger = new Logger(WorkOrderDetailService.name);
  private readonly redis = GetRedisClient();
  // Same short-TTL rationale as MachineCalculationsService — long enough to absorb
  // repeat dashboard polling, short enough to never visibly disagree with a
  // just-broadcast transition.
  private readonly cacheTtlMs = Number(process.env.MACHINE_CALC_CACHE_TTL_MS ?? 8000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly machineConfigService: MachineConfigService,
  ) {}

  async detail(idStr: string) {
    let id: bigint;
    try {
      id = BigInt(idStr);
    } catch {
      throw new NotFoundException('Work order not found');
    }

    const version = await GetCalcVersion(this.redis, 'wo', id);
    const cacheKey = `machine:calc:wo-detail:${id.toString()}:v${version}`;
    return CacheAside(this.redis, cacheKey, this.cacheTtlMs, () => this.computeDetail(id), (stage, error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Cache ${stage} failed for ${cacheKey}: ${message}`);
    });
  }

  private async computeDetail(id: bigint) {
    const workOrder = await this.prisma.work_orders.findUnique({
      where: { id },
      include: {
        products: { include: { uoms: { select: { name: true } } } },
        work_order_machines: { include: { machines: true } },
      },
    });
    if (!workOrder) throw new NotFoundException('Work order not found');

    const [buckets, wastageAllocations] = await Promise.all([
      this.prisma.machine_production_counts.findMany({
        where: { work_order_id: id },
        include: { machines: true, employee_shifts: true },
      }),
      // kg logged via the Wastage Log against this WO, split per machine by Laravel —
      // widens Quality's denominator exactly like `MachineCalculationsService.overview()`,
      // so the work-order and machine screens agree.
      this.prisma.machine_wastage_allocations.findMany({
        where: { machine_wastage_entries: { work_order_id: id } },
        select: { machine_id: true, allocated_qty_kg: true },
      }),
    ]);

    const loggedWastageByMachine = new Map<string, number>();
    for (const allocation of wastageAllocations) {
      const key = allocation.machine_id.toString();
      loggedWastageByMachine.set(key, (loggedWastageByMachine.get(key) ?? 0) + Number(allocation.allocated_qty_kg));
    }

    const rowsByKey = new Map<string, RollupRow>();
    // Per-machine (not per machine+shift) window — this WO's whole engagement on that
    // machine, used only for the OEE Availability/Performance calc below.
    const machineWindowById = new Map<string, MachineWindow>();

    for (const bucket of buckets) {
      const key = `${bucket.machine_id}:${bucket.shift_id ?? 'none'}`;
      let row = rowsByKey.get(key);
      if (!row) {
        row = {
          machine_id: Number(bucket.machine_id),
          machine_name: bucket.machines?.machine_name ?? null,
          shift_id: bucket.shift_id !== null ? Number(bucket.shift_id) : null,
          shift_name: bucket.employee_shifts?.name ?? null,
          shift_color: bucket.employee_shifts?.color ?? null,
          good_count: 0,
          scrap_count: 0,
          total_count: 0,
          started_at: bucket.bucket_started_at,
          ended_at: bucket.bucket_ended_at,
        };
        rowsByKey.set(key, row);
      }

      row.good_count += bucket.good_count;
      row.scrap_count += bucket.scrap_count;
      row.total_count += bucket.total_count;
      if (bucket.bucket_started_at < row.started_at) row.started_at = bucket.bucket_started_at;
      if (bucket.bucket_ended_at > row.ended_at) row.ended_at = bucket.bucket_ended_at;

      const machineKey = bucket.machine_id.toString();
      const window = machineWindowById.get(machineKey);
      if (!window) {
        machineWindowById.set(machineKey, {
          start: bucket.bucket_started_at,
          end: bucket.bucket_ended_at,
          totalCount: bucket.total_count,
          goodCount: bucket.good_count,
        });
      } else {
        if (bucket.bucket_started_at < window.start) window.start = bucket.bucket_started_at;
        if (bucket.bucket_ended_at > window.end) window.end = bucket.bucket_ended_at;
        window.totalCount += bucket.total_count;
        window.goodCount += bucket.good_count;
      }
    }

    const rows = [...rowsByKey.values()];
    const totalGood = rows.reduce((sum, row) => sum + row.good_count, 0);
    const totalScrap = rows.reduce((sum, row) => sum + row.scrap_count, 0);
    const totalCount = rows.reduce((sum, row) => sum + row.total_count, 0);
    const loggedWastageKg = [...loggedWastageByMachine.values()].reduce((sum, kg) => sum + kg, 0);
    const oee = await this.computeOee(
      machineWindowById,
      totalGood,
      totalCount,
      loggedWastageByMachine,
      isKgUom(workOrder.products?.uoms?.name),
    );

    return {
      work_order: {
        id: Number(workOrder.id),
        custom_id: workOrder.custom_id,
        product_name: workOrder.products?.product_name ?? null,
        quantity: workOrder.quantity,
        status: workOrder.status,
        scheduled_start: workOrder.scheduled_start,
        actual_start: workOrder.actual_start,
        planned_machines: workOrder.work_order_machines.map((wom) => ({
          id: Number(wom.machines.id),
          machine_name: wom.machines.machine_name,
        })),
      },
      machines: rows.map((row) => ({
        machine_id: row.machine_id,
        machine_name: row.machine_name,
        shift_id: row.shift_id,
        shift_name: row.shift_name,
        shift_color: row.shift_color,
        good_count: row.good_count,
        scrap_count: row.scrap_count,
        total_count: row.total_count,
        started_at: row.started_at,
        ended_at: row.ended_at,
      })),
      totals: {
        good_count: totalGood,
        scrap_count: totalScrap,
        total_count: totalCount,
        logged_wastage_kg: Math.round(loggedWastageKg * 100) / 100,
        quantity_target: workOrder.quantity,
        percent_complete: workOrder.quantity
          ? Math.round(Math.min(100, (totalGood / workOrder.quantity) * 100) * 10) / 10
          : null,
      },
      oee: oee.overall,
      oee_by_machine: oee.byMachine,
    };
  }

  /**
   * OEE scoped to this one work order — not a machine, not a date range. Availability
   * and Performance are approximated per machine: each machine's overall engagement
   * window for this WO is its earliest `bucket_started_at` → latest `bucket_ended_at`
   * across every bucket logged against it (buckets chain end-to-end per machine with no
   * gaps, so this window is a close real approximation of "how long this machine spent
   * on this job," not just the sum of its individual bucket durations). `machine_state_events`
   * for the involved machines are fetched once (not per machine) over the union of all
   * windows, then each event is clipped in-memory to its OWN machine's window before being
   * summed — same clip-and-sum idiom used throughout this module, just windowed per machine
   * instead of one shared range.
   *
   * Performance uses the AVERAGE configured `ideal_cycle_seconds` across the involved
   * machines, same documented approximation `ProductionDashboardService.fleetPerformance`
   * uses — a true per-machine-weighted figure would need per-machine active-seconds joined
   * to per-machine counts, more than this endpoint needs to compute exactly.
   *
   * Also returns a per-machine breakdown (`byMachine`) alongside the aggregate — the
   * per-machine active/total seconds are already split out below (`secondsByMachine`) to
   * build the aggregate, so deriving each machine's own Availability/Performance/Quality/
   * Efficiency costs no extra queries, just per-machine reads off maps already in memory.
   * Unlike the aggregate, per-machine Performance uses that machine's OWN
   * `ideal_cycle_seconds` (not the average) — exact rather than approximated, since no
   * cross-machine blending is needed once scoped to one machine.
   */
  private async computeOee(
    machineWindowById: Map<string, MachineWindow>,
    totalGood: number,
    totalCount: number,
    loggedWastageByMachine: Map<string, number>,
    countsInKg: boolean,
  ): Promise<WorkOrderOeeResult> {
    const empty: WorkOrderOee = { availability: null, performance: null, quality: null, efficiency: null };
    if (!machineWindowById.size) {
      return { overall: empty, byMachine: {} };
    }

    const machineIds = [...machineWindowById.keys()].map((id) => BigInt(id));
    const overallStart = new Date(Math.min(...[...machineWindowById.values()].map((w) => w.start.getTime())));
    const overallEnd = new Date(Math.max(...[...machineWindowById.values()].map((w) => w.end.getTime())));

    // Split the still-open (ended_at IS NULL) and already-closed (ended_at > overallStart)
    // branches into two queries instead of one OR — each lands cleanly on the existing
    // [machine_id, started_at] / [machine_id, ended_at] composite indexes; a single
    // combined OR can't use either composite cleanly. Mutually exclusive on ended_at,
    // so a plain concat needs no dedup.
    const eventSelect = { machine_id: true, machine_state_id: true, started_at: true, ended_at: true } as const;
    const [openEvents, closedEvents, productiveStateIds] = await Promise.all([
      this.prisma.machine_state_events.findMany({
        where: { machine_id: { in: machineIds }, started_at: { lt: overallEnd }, ended_at: null },
        select: eventSelect,
      }),
      this.prisma.machine_state_events.findMany({
        where: {
          machine_id: { in: machineIds },
          started_at: { lt: overallEnd },
          ended_at: { gt: overallStart },
        },
        select: eventSelect,
      }),
      this.loadProductiveStateIds(),
    ]);
    const events = [...openEvents, ...closedEvents];

    const secondsByMachine = new Map<string, { active: number; total: number }>();
    for (const event of events) {
      const machineKey = event.machine_id.toString();
      const window = machineWindowById.get(machineKey);
      if (!window) continue;

      const start = event.started_at > window.start ? event.started_at : window.start;
      const rawEnd = event.ended_at ?? new Date();
      const end = rawEnd < window.end ? rawEnd : window.end;
      if (end <= start) continue;

      const seconds = (end.getTime() - start.getTime()) / 1000;
      const bucket = secondsByMachine.get(machineKey) ?? { active: 0, total: 0 };
      bucket.total += seconds;
      if (event.machine_state_id !== null && productiveStateIds.has(Number(event.machine_state_id))) {
        bucket.active += seconds;
      }
      secondsByMachine.set(machineKey, bucket);
    }

    let activeSeconds = 0;
    let totalSeconds = 0;
    for (const bucket of secondsByMachine.values()) {
      activeSeconds += bucket.active;
      totalSeconds += bucket.total;
    }

    const configs = await this.prisma.machine_has_configs.findMany({
      where: { machine_id: { in: machineIds }, is_active: true, ideal_cycle_seconds: { not: null } },
      select: { machine_id: true, ideal_cycle_seconds: true },
    });
    const avgIdealCycleSeconds = configs.length
      ? configs.reduce((sum, c) => sum + (c.ideal_cycle_seconds ?? 0), 0) / configs.length
      : null;
    const idealCycleByMachine = new Map<string, number>();
    for (const config of configs) {
      const key = config.machine_id.toString();
      if (!idealCycleByMachine.has(key) && config.ideal_cycle_seconds !== null) {
        idealCycleByMachine.set(key, config.ideal_cycle_seconds);
      }
    }

    const machinesTotalCount = [...machineWindowById.values()].reduce((sum, w) => sum + w.totalCount, 0);

    const availability = totalSeconds > 0 ? round1((activeSeconds / totalSeconds) * 100) : null;
    const performance = avgIdealCycleSeconds && activeSeconds > 0
      ? round1(Math.min(100, ((machinesTotalCount * avgIdealCycleSeconds) / activeSeconds) * 100))
      : null;
    const loggedWastageKg = [...loggedWastageByMachine.values()].reduce((sum, kg) => sum + kg, 0);
    const quality = qualityPercent({ good: totalGood, total: totalCount, wastageKg: loggedWastageKg, countsInKg });
    const efficiency = availability !== null && performance !== null && quality !== null
      ? round1((availability * performance * quality) / 10000)
      : null;

    const byMachine: Record<number, WorkOrderOee> = {};
    for (const [machineKey, window] of machineWindowById) {
      const seconds = secondsByMachine.get(machineKey);
      const idealCycleSeconds = idealCycleByMachine.get(machineKey) ?? null;

      const mAvailability = seconds && seconds.total > 0 ? round1((seconds.active / seconds.total) * 100) : null;
      const mPerformance = idealCycleSeconds && seconds && seconds.active > 0
        ? round1(Math.min(100, ((window.totalCount * idealCycleSeconds) / seconds.active) * 100))
        : null;
      const mQuality = qualityPercent({
        good: window.goodCount,
        total: window.totalCount,
        wastageKg: loggedWastageByMachine.get(machineKey) ?? 0,
        countsInKg,
      });
      const mEfficiency = mAvailability !== null && mPerformance !== null && mQuality !== null
        ? round1((mAvailability * mPerformance * mQuality) / 10000)
        : null;

      byMachine[Number(machineKey)] = {
        availability: mAvailability,
        performance: mPerformance,
        quality: mQuality,
        efficiency: mEfficiency,
      };
    }

    return { overall: { availability, performance, quality, efficiency }, byMachine };
  }

  /** The set of `machine_states.id` that count toward OEE Availability — replaces `state === 'active'`. */
  /** The set of `machine_states.id` that count toward OEE Availability — reuses the
   * shared Redis-cached states map instead of a fresh uncached Prisma query. */
  private async loadProductiveStateIds(): Promise<Set<number>> {
    const statesById = await this.machineConfigService.loadMachineStatesMap();
    return new Set(
      [...statesById.values()].filter((meta) => meta.counts_as_productive).map((meta) => meta.id),
    );
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
