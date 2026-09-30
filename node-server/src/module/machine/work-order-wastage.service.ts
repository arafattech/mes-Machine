import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { CacheAside, GetRedisClient } from 'config/redis/config.redis';

export interface WastageAllocationRow {
  machine_id: number;
  machine_name: string | null;
  allocated_qty_kg: number;
}

export interface WastageTypeBreakdown {
  wastage_type_id: number;
  wastage_type_name: string | null;
  total_qty_kg: number;
  percent_of_total: number;
}

export interface WorkOrderWastageDetail {
  total_qty_kg: number;
  by_type: WastageTypeBreakdown[];
  allocations_by_type: Record<number, WastageAllocationRow[]>;
}

interface TypeAccumulator {
  name: string | null;
  total: number;
  machineTotals: Map<number, { name: string | null; total: number }>;
}

/**
 * Read-side rollup over `machine_wastage_entries`/`machine_wastage_allocations` for one
 * work order, optionally narrowed to a shift and/or a single date — the "distributed by
 * wastage type" + "overall per type per work order" views. Writes (and the proportional
 * distribution across machines) stay in Laravel (`WorkOrderController::logWastage`); only
 * this read-heavy grouping lives here, same split already established for
 * `machine_production_counts` via `WorkOrderDetailService`.
 */
@Injectable()
export class WorkOrderWastageService {
  private readonly logger = new Logger(WorkOrderWastageService.name);
  private readonly redis = GetRedisClient();
  private readonly cacheTtlMs = Number(process.env.MACHINE_CALC_CACHE_TTL_MS ?? 8000);

  constructor(private readonly prisma: PrismaService) {}

  async detail(idStr: string, shiftIdStr?: string, date?: string): Promise<WorkOrderWastageDetail> {
    let id: bigint;
    try {
      id = BigInt(idStr);
    } catch {
      throw new NotFoundException('Work order not found');
    }

    const shiftId = shiftIdStr ? Number(shiftIdStr) : null;
    const cacheKey = `machine:calc:wo-wastage:${id.toString()}:${shiftId ?? 'all'}:${date ?? 'all'}`;
    return CacheAside(
      this.redis,
      cacheKey,
      this.cacheTtlMs,
      () => this.computeDetail(id, shiftId, date),
      (stage, error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Cache ${stage} failed for ${cacheKey}: ${message}`);
      },
    );
  }

  private async computeDetail(id: bigint, shiftId: number | null, date?: string): Promise<WorkOrderWastageDetail> {
    const workOrder = await this.prisma.work_orders.findUnique({ where: { id }, select: { id: true } });
    if (!workOrder) throw new NotFoundException('Work order not found');

    const entries = await this.prisma.machine_wastage_entries.findMany({
      where: {
        work_order_id: id,
        ...(shiftId ? { shift_id: shiftId } : {}),
        ...(date ? { entry_date: new Date(date) } : {}),
      },
      include: {
        machine_wastage_types: { select: { name: true } },
        machine_wastage_allocations: { include: { machines: { select: { machine_name: true } } } },
      },
    });

    const byTypeMap = new Map<number, TypeAccumulator>();
    let grandTotal = 0;

    for (const entry of entries) {
      const typeId = Number(entry.wastage_type_id);
      const qty = Number(entry.qty_kg);
      grandTotal += qty;

      const typeAcc = byTypeMap.get(typeId) ?? {
        name: entry.machine_wastage_types?.name ?? null,
        total: 0,
        machineTotals: new Map<number, { name: string | null; total: number }>(),
      };
      typeAcc.total += qty;

      for (const allocation of entry.machine_wastage_allocations) {
        const machineId = Number(allocation.machine_id);
        const machineAcc = typeAcc.machineTotals.get(machineId) ?? {
          name: allocation.machines?.machine_name ?? null,
          total: 0,
        };
        machineAcc.total += Number(allocation.allocated_qty_kg);
        typeAcc.machineTotals.set(machineId, machineAcc);
      }

      byTypeMap.set(typeId, typeAcc);
    }

    const byType: WastageTypeBreakdown[] = [];
    const allocationsByType: Record<number, WastageAllocationRow[]> = {};

    for (const [typeId, acc] of byTypeMap) {
      byType.push({
        wastage_type_id: typeId,
        wastage_type_name: acc.name,
        total_qty_kg: round2(acc.total),
        percent_of_total: grandTotal > 0 ? round1((acc.total / grandTotal) * 100) : 0,
      });

      allocationsByType[typeId] = [...acc.machineTotals.entries()].map(([machineId, m]) => ({
        machine_id: machineId,
        machine_name: m.name,
        allocated_qty_kg: round2(m.total),
      }));
    }

    return { total_qty_kg: round2(grandTotal), by_type: byType, allocations_by_type: allocationsByType };
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
