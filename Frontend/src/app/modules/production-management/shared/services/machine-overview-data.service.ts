import { Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { CommonService } from '@app/services/common-service/common.service';
import {
  AssignedWorkOrder,
  CurrentWorkOrderShift,
  MachineSpecs,
  Metric,
  ProductionSummary,
  ShiftBreakdownRow,
  ShiftOption,
  WorkOrderDetail,
  WorkOrderWastageDetail,
} from '@production-module/shared/interface/interface';
import { MetricColor, MetricIcon } from '@production-module/shared/utils/types';

export interface DailyProductionRow {
  date: string;
  good: number;
  scrap: number;
}

/** Presentational metadata for each OEE tile — not business data, kept separate from its value/delta. */
const OEE_TILE_META: Record<string, { icon: MetricIcon; color: MetricColor }> = {
  'Product Availability': { icon: 'box', color: 'green' },
  'M/C Performance': { icon: 'cog', color: 'purple' },
  Quality: { icon: 'sparkles', color: 'orange' },
  'M/C Efficiency': { icon: 'wrench', color: 'rose' },
};

const ZERO_SPECS: MachineSpecs = { maxRpm: 0, minRpm: 0, maxTemp: 0, minTemp: 0 };

interface MachineHasConfigRow {
  max_rpm: number | null;
  min_rpm: number | null;
  max_temp: number | null;
  min_temp: number | null;
}

interface CurrentWorkOrderResponse {
  work_order: {
    id: number;
    custom_id: string | null;
    product_name: string | null;
    quantity: number;
    status: string | null;
  } | null;
  shift: {
    id: number;
    name: string;
    start_time: string;
    end_time: string;
    color: string | null;
  } | null;
  bucket_started_at: string | null;
}

const EMPTY_CURRENT_WORK_ORDER_SHIFT: CurrentWorkOrderShift = {
  workOrder: null,
  shift: null,
};

interface WorkOrderDetailResponse {
  work_order: {
    id: number;
    custom_id: string | null;
    product_name: string | null;
    quantity: number;
    status: string | null;
    scheduled_start: string | null;
    actual_start: string | null;
    planned_machines: { id: number; machine_name: string | null }[];
  };
  machines: {
    machine_id: number;
    machine_name: string | null;
    shift_id: number | null;
    shift_name: string | null;
    shift_color: string | null;
    good_count: number;
    scrap_count: number;
    total_count: number;
    started_at: string | null;
    ended_at: string | null;
  }[];
  totals: {
    good_count: number;
    scrap_count: number;
    total_count: number;
    quantity_target: number | null;
    percent_complete: number | null;
  };
  oee: {
    availability: number | null;
    performance: number | null;
    quality: number | null;
    efficiency: number | null;
  };
  oee_by_machine: Record<
    number,
    { availability: number | null; performance: number | null; quality: number | null; efficiency: number | null }
  >;
}

interface WorkOrderWastageDetailResponse {
  total_qty_kg: number;
  by_type: {
    wastage_type_id: number;
    wastage_type_name: string | null;
    total_qty_kg: number;
    percent_of_total: number;
  }[];
  allocations_by_type: Record<
    number,
    { machine_id: number; machine_name: string | null; allocated_qty_kg: number }[]
  >;
}

const EMPTY_WORK_ORDER_WASTAGE_DETAIL: WorkOrderWastageDetail = {
  totalQtyKg: 0,
  byType: [],
  allocationsByType: {},
};

const EMPTY_WORK_ORDER_DETAIL: WorkOrderDetail = {
  workOrder: null,
  machines: [],
  totals: {
    goodCount: 0,
    scrapCount: 0,
    totalCount: 0,
    quantityTarget: null,
    percentComplete: null,
  },
  oeeMetrics: [],
  oeeByMachine: {},
};

interface MachineOverviewResponse {
  target: number;
  achieved: number;
  ok: number;
  total: number;
  waste: number;
  oee: {
    availability: number | null;
    performance: number | null;
    quality: number | null;
    efficiency: number | null;
  };
}

interface ShiftBreakdownResponse {
  rows: {
    date: string;
    shift_id: number;
    shift_name: string;
    shift_color: string | null;
    states: { machine_state_id: number; name: string; color: string | null; seconds: number }[];
    total_seconds: number;
  }[];
}

/**
 * Consumption-side abstraction for the machine specs / production summary / OEE data shown on
 * `MachineOverviewComponent`. Both methods hit real backend endpoints — see MISSING_INPUTS.md
 * (component folder) for exactly why some values still read 0/null (empty tables, no config UI
 * yet) despite the data path itself being real.
 */
@Injectable({ providedIn: 'root' })
export class MachineOverviewDataService {
  constructor(private readonly common: CommonService) {}

  /** Real: `machine_has_configs` already carries these thresholds and is OData-exposed. */
  getSpecs(machineKey: string): Observable<MachineSpecs> {
    if (!machineKey) return of(ZERO_SPECS);

    return this.common
      .get<{ value: MachineHasConfigRow[] }>(
        `MachineHasConfigs?$filter=machine_id eq ${machineKey} and is_active eq true&$select=max_rpm,min_rpm,max_temp,min_temp`,
      )
      .pipe(
        map((res) => {
          const row = res?.value?.[0];
          if (!row) return ZERO_SPECS;
          return {
            maxRpm: row.max_rpm ?? 0,
            minRpm: row.min_rpm ?? 0,
            maxTemp: row.max_temp ?? 0,
            minTemp: row.min_temp ?? 0,
          };
        }),
        catchError(() => of(ZERO_SPECS)),
      );
  }

  /**
   * Real: `GET /api/machine/{id}/overview` — node-server (NestJS/Prisma), not Laravel.
   * Moved here because node-server already owns the write-side of
   * `machine_state_events`/`machine_production_counts`, so calculation endpoints over
   * those tables live next to their writer instead of duplicated in Laravel too.
   * All 4 OEE tiles come from this single call over the same window so
   * `Efficiency = Availability × Performance × Quality` actually holds on screen —
   * Availability is deliberately NOT computed separately/live on the frontend, since an
   * independently-computed Availability previously drifted from the one baked into Efficiency.
   * Performance/Quality/Efficiency come back `null` until `machine_has_configs.ideal_cycle_seconds`
   * is set and node-server starts writing `machine_production_counts` — rendered as 0, not faked.
   */
  getOverview(
    machineKey: string,
    from: Date,
    to: Date,
  ): Observable<{ production: ProductionSummary; oeeMetrics: Metric[] }> {
    if (!machineKey) return of(this.emptyOverview(from, to));

    const url = `machine/${machineKey}/overview?from=${from.toISOString()}&to=${to.toISOString()}`;

    return this.common.get<MachineOverviewResponse>(url, false, true).pipe(
      map((res) => ({
        production: {
          periodLabel: this.formatRange(from, to),
          productionTarget: res.target,
          productionAchieved: res.achieved,
          machineOk: res.ok,
          machineTotal: res.total,
          wastage: res.waste,
          unit: 'kg',
        },
        oeeMetrics: [
          this.toMetric('Product Availability', res.oee.availability),
          this.toMetric('M/C Performance', res.oee.performance),
          this.toMetric('Quality', res.oee.quality),
          this.toMetric('M/C Efficiency', res.oee.efficiency),
        ],
      })),
      catchError(() => of(this.emptyOverview(from, to))),
    );
  }

  /**
   * Real: `GET /api/machine/{id}/shift-breakdown` — node-server. One row per (day × shift)
   * in [from, to) — Active/Idle/Inactive/Maintenance hours split by which shift they fell
   * in, since this plant's PLCs report state only and there's no other way to see per-shift
   * performance than reconstructing each shift's time-of-day window per day.
   */
  getShiftBreakdown(machineKey: string, from: Date, to: Date): Observable<ShiftBreakdownRow[]> {
    if (!machineKey) return of([]);

    const url = `machine/${machineKey}/shift-breakdown?from=${from.toISOString()}&to=${to.toISOString()}`;

    return this.common.get<ShiftBreakdownResponse>(url, false, true).pipe(
      map((res) =>
        res.rows.map((row) => ({
          date: row.date,
          shiftId: row.shift_id,
          shiftName: row.shift_name,
          shiftColor: row.shift_color,
          states: row.states.map((s) => ({
            machineStateId: s.machine_state_id,
            name: s.name,
            color: s.color,
            hours: s.seconds / 3600,
          })),
          totalHours: row.total_seconds / 3600,
        })),
      ),
      catchError(() => of([])),
    );
  }

  /**
   * Real: `GET /api/machine/{id}/daily-production` — node-server. Daily breakdown of good vs scrap counts.
   */
  getDailyProduction(machineKey: string, from: Date, to: Date): Observable<DailyProductionRow[]> {
    if (!machineKey) return of([]);

    const url = `machine/${machineKey}/daily-production?from=${from.toISOString()}&to=${to.toISOString()}`;

    return this.common.get<{ rows: DailyProductionRow[] }>(url, false, true).pipe(
      map((res) => res.rows),
      catchError(() => of([])),
    );
  }

  /**
   * Real: `GET /api/machine/{id}/current-work-order` — node-server, not Laravel (see
   * `getOverview()` doc for why calculation endpoints live there now).
   * Always the single latest `machine_production_counts` bucket — not windowed by the page's
   * date-range filter, since "what's running right now" isn't a historical-report concept.
   * Returns nulls (rendered as an empty state, not faked) until node-server has written at
   * least one bucket for this machine.
   */
  getCurrentWorkOrderShift(machineKey: string): Observable<CurrentWorkOrderShift> {
    if (!machineKey) return of(EMPTY_CURRENT_WORK_ORDER_SHIFT);

    return this.common
      .get<CurrentWorkOrderResponse>(`machine/${machineKey}/current-work-order`, false, true)
      .pipe(
        map((res) => ({
          workOrder: res.work_order
            ? {
                id: res.work_order.id,
                customId: res.work_order.custom_id,
                productName: res.work_order.product_name,
                quantity: res.work_order.quantity,
                status: res.work_order.status,
              }
            : null,
          shift: res.shift
            ? {
                id: res.shift.id,
                name: res.shift.name,
                startTime: res.shift.start_time,
                endTime: res.shift.end_time,
                color: res.shift.color,
              }
            : null,
        })),
        catchError(() => of(EMPTY_CURRENT_WORK_ORDER_SHIFT)),
      );
  }

  /**
   * Real: `GET /api/work-orders/{id}/detail` — node-server, not Laravel (see
   * `getOverview()` doc for why calculation endpoints live there now). Planning/CRUD for
   * work orders (`store`/`update`/`assignedWorkOrders`) stays in Laravel — only this
   * read-heavy rollup moved. Rollup across every machine+shift that has logged
   * `machine_production_counts` buckets against this work order — a work order isn't
   * pinned to one machine at execution time, only `work_order_machines` (the plan) is.
   */
  getWorkOrderDetail(workOrderId: number): Observable<WorkOrderDetail> {
    if (!workOrderId) return of(EMPTY_WORK_ORDER_DETAIL);

    return this.common
      .get<WorkOrderDetailResponse>(`work-orders/${workOrderId}/detail`, false, true)
      .pipe(
        map((res) => ({
          workOrder: {
            id: res.work_order.id,
            customId: res.work_order.custom_id,
            productName: res.work_order.product_name,
            quantity: res.work_order.quantity,
            status: res.work_order.status,
            scheduledStart: res.work_order.scheduled_start,
            actualStart: res.work_order.actual_start,
            plannedMachines: res.work_order.planned_machines.map((m) => ({
              id: m.id,
              machineName: m.machine_name,
            })),
          },
          machines: res.machines.map((m) => ({
            machineId: m.machine_id,
            machineName: m.machine_name,
            shiftId: m.shift_id,
            shiftName: m.shift_name,
            shiftColor: m.shift_color,
            goodCount: m.good_count,
            scrapCount: m.scrap_count,
            totalCount: m.total_count,
            startedAt: m.started_at,
            endedAt: m.ended_at,
          })),
          totals: {
            goodCount: res.totals.good_count,
            scrapCount: res.totals.scrap_count,
            totalCount: res.totals.total_count,
            quantityTarget: res.totals.quantity_target,
            percentComplete: res.totals.percent_complete,
          },
          oeeMetrics: [
            this.toMetric('Product Availability', res.oee.availability),
            this.toMetric('M/C Performance', res.oee.performance),
            this.toMetric('Quality', res.oee.quality),
            this.toMetric('M/C Efficiency', res.oee.efficiency),
          ],
          oeeByMachine: Object.fromEntries(
            Object.entries(res.oee_by_machine ?? {}).map(([machineId, oee]) => [
              Number(machineId),
              [
                this.toMetric('Product Availability', oee.availability),
                this.toMetric('M/C Performance', oee.performance),
                this.toMetric('Quality', oee.quality),
                this.toMetric('M/C Efficiency', oee.efficiency),
              ],
            ]),
          ),
        })),
        catchError(() => of(EMPTY_WORK_ORDER_DETAIL)),
      );
  }

  /**
   * Real: `GET /api/work-orders/{id}/wastage-detail` — node-server, same "read-heavy
   * calculation lives next to the tables it already owns" split as `getWorkOrderDetail()`.
   * Writes (`ProductionLogService.submitWastage`) stay in Laravel. `shiftId`/`date` are both
   * optional filters — omitting both gives the whole-work-order total, matching this feature's
   * "per WO" / "per shift per WO" / "per day per WO" reporting scopes from one endpoint.
   */
  getWorkOrderWastageDetail(
    workOrderId: number,
    filter?: { shiftId?: number | null; date?: string | null },
  ): Observable<WorkOrderWastageDetail> {
    if (!workOrderId) return of(EMPTY_WORK_ORDER_WASTAGE_DETAIL);

    let url = `work-orders/${workOrderId}/wastage-detail`;
    const params: string[] = [];
    if (filter?.shiftId) params.push(`shift_id=${filter.shiftId}`);
    if (filter?.date) params.push(`date=${encodeURIComponent(filter.date)}`);
    if (params.length) url += `?${params.join('&')}`;

    return this.common.get<WorkOrderWastageDetailResponse>(url, false, true).pipe(
      map((res) => ({
        totalQtyKg: res.total_qty_kg,
        byType: res.by_type.map((t) => ({
          wastageTypeId: t.wastage_type_id,
          wastageTypeName: t.wastage_type_name,
          totalQtyKg: t.total_qty_kg,
          percentOfTotal: t.percent_of_total,
        })),
        allocationsByType: Object.fromEntries(
          Object.entries(res.allocations_by_type ?? {}).map(([typeId, rows]) => [
            Number(typeId),
            rows.map((r) => ({
              machineId: r.machine_id,
              machineName: r.machine_name,
              allocatedQtyKg: r.allocated_qty_kg,
            })),
          ]),
        ),
      })),
      catchError(() => of(EMPTY_WORK_ORDER_WASTAGE_DETAIL)),
    );
  }

  /** Real: `GET /api/machine/{id}/work-orders` — work orders planned for this machine
   * (via `work_order_machines`) that are still pending/in_progress. The pick-list for
   * manual production-count entry, independent of any `machine_production_counts` bucket. */
  getAssignedWorkOrders(machineKey: string): Observable<AssignedWorkOrder[]> {
    if (!machineKey) return of([]);

    return this.common
      .get<{
        work_orders: {
          id: number;
          custom_id: string | null;
          product_name: string | null;
          quantity: number;
          status: string | null;
        }[];
      }>(`machine/${machineKey}/work-orders`, false)
      .pipe(
        map((res) =>
          res.work_orders.map((wo) => ({
            id: wo.id,
            customId: wo.custom_id,
            productName: wo.product_name,
            quantity: wo.quantity,
            status: wo.status,
          })),
        ),
        catchError(() => of([])),
      );
  }

  /** Real: `EmployeeShifts` OData (already discovered) — the shared shift master, reused
   * here as the shift picker for manual production-count entry. */
  getActiveShifts(): Observable<ShiftOption[]> {
    return this.common
      .get<{
        value: {
          id: number;
          name: string;
          start_time: string;
          end_time: string;
          color: string | null;
        }[];
      }>('EmployeeShifts?$filter=is_active eq true&$select=id,name,start_time,end_time,color')
      .pipe(
        map((res) =>
          (res.value ?? []).map((s) => ({
            id: s.id,
            name: s.name,
            startTime: s.start_time,
            endTime: s.end_time,
            color: s.color,
          })),
        ),
        catchError(() => of([])),
      );
  }

  /** Real: `POST /api/machine/{id}/production-count` — manual entry since this plant's
   * PLCs report state only, not piece counts. Backend computes total_count and the bucket
   * time window; this just forwards the operator's inputs. */
  logProductionCount(
    machineKey: string,
    payload: { workOrderId: number; shiftId: number; goodCount: number; scrapCount: number },
  ): Observable<void> {
    return this.common
      .post<void>(`machine/${machineKey}/production-count`, {
        work_order_id: payload.workOrderId,
        shift_id: payload.shiftId,
        good_count: payload.goodCount,
        scrap_count: payload.scrapCount,
      }, false);
  }

  private toMetric(label: string, value: number | null): Metric {
    return { label, value: value ?? 0, ...OEE_TILE_META[label] };
  }

  private emptyOverview(from: Date, to: Date): { production: ProductionSummary; oeeMetrics: Metric[] } {
    return {
      production: {
        periodLabel: this.formatRange(from, to),
        productionTarget: 0,
        productionAchieved: 0,
        machineOk: 0,
        machineTotal: 0,
        wastage: 0,
        unit: 'kg',
      },
      oeeMetrics: [
        this.toMetric('Product Availability', null),
        this.toMetric('M/C Performance', null),
        this.toMetric('Quality', null),
        this.toMetric('M/C Efficiency', null),
      ],
    };
  }

  private formatRange(from: Date, to: Date): string {
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${fmt(from)} – ${fmt(to)}`;
  }
}
