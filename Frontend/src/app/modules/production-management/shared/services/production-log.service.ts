import { Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { CommonService } from '@app/services/common-service/common.service';
import { EligibleWastageType, ProductionLogEntryRow } from '@production-module/shared/interface/interface';

/**
 * Data access for the "Plan & Production Log" page — global (not per-machine) production-log
 * listing and the multi-machine batch entry modal. Shift options are deliberately NOT
 * duplicated here — delegated to `MachineOverviewDataService.getActiveShifts()`, the existing
 * shared-shift-master lookup already used by the per-machine Log Production dialog on `/mco`.
 */
@Injectable({ providedIn: 'root' })
export class ProductionLogService {
  constructor(private readonly common: CommonService) {}

  /** Real: `WorkOrders` OData entity, `machines` nav property (already exposed — see
   * base-data's work-order list `$expand=product,machines`). Used once a work order is picked
   * in the entry modal, to build one row per machine planned against it. */
  getWorkOrderMachines(workOrderId: number): Observable<ProductionLogEntryRow[]> {
    if (!workOrderId) return of([]);

    return this.common
      .get<{ machines?: { id: number; machine_name: string }[] }>(
        `WorkOrders(${workOrderId})?$expand=machines`,
      )
      .pipe(
        map((res) =>
          (res.machines ?? []).map((m) => ({
            machineId: m.id,
            machineName: m.machine_name,
            goodCount: null,
          })),
        ),
        catchError(() => of([])),
      );
  }

  /** Real: `GET /api/work-orders/{id}/production-logs?shift_id=&date=` (Laravel) — the raw,
   * per-machine rows behind one (work order, shift, day) group on the "Log Production" list
   * grid (that grid shows a machine *count*, not a machine per row — see
   * `ProductionLogListComponent`'s doc comment). Same endpoint the entry modal's History tab
   * calls with no filters; here it's scoped down to exactly one group. */
  getGroupDetail(workOrderId: number, shiftId: number | null | undefined, date: string | null | undefined): Observable<any[]> {
    if (!workOrderId) return of([]);

    let url = `work-orders/${workOrderId}/production-logs`;
    const params: string[] = [];
    if (shiftId) params.push(`shift_id=${shiftId}`);
    if (date) params.push(`date=${encodeURIComponent(date)}`);
    if (params.length) url += `?${params.join('&')}`;

    return this.common
      .get<{ data?: any[] }>(url, false)
      .pipe(
        map((res) => res.data ?? []),
        catchError(() => of([])),
      );
  }

  getWastageGroupDetail(workOrderId: number, shiftId: number | null | undefined, date: string | null | undefined): Observable<any[]> {
    if (!workOrderId) return of([]);

    let url = `wastage-logs-detail?work_order_id=${workOrderId}`;
    if (shiftId) url += `&shift_id=${shiftId}`;
    if (date) url += `&date=${encodeURIComponent(date)}`;

    return this.common
      .get<{ data?: any[] }>(url, false)
      .pipe(
        map((res) => res.data ?? []),
        catchError(() => of([])),
      );
  }

  /** Real: `POST /api/work-orders/{id}/production-counts` (Laravel) — batch write, one
   * `machine_production_counts` row per entry, always additive (never an upsert). Rows with a
   * `null` `goodCount` are filtered out by the caller before this is invoked. */
  submitProductionLog(
    workOrderId: number,
    payload: { date: string; shiftId: number; entries: { machineId: number; goodCount: number }[] },
  ): Observable<void> {
    return this.common.post<void>(
      `work-orders/${workOrderId}/production-counts`,
      {
        date: payload.date,
        shift_id: payload.shiftId,
        entries: payload.entries.map((e) => ({
          machine_id: e.machineId,
          good_count: e.goodCount,
        })),
      },
      false,
    );
  }

  /** Real: `GET /api/work-orders/{id}/eligible-wastage-types` (Laravel) — wastage types
   * shared by at least one machine currently assigned to this work order. Populates
   * `LogWastageComponent`'s type picker once a work order is chosen. */
  getEligibleWastageTypes(workOrderId: number): Observable<EligibleWastageType[]> {
    if (!workOrderId) return of([]);

    return this.common
      .get<{ data?: { id: number; name: string }[] }>(
        `work-orders/${workOrderId}/eligible-wastage-types`,
        false,
      )
      .pipe(
        map((res) => (res.data ?? []).map((t) => ({ id: t.id, name: t.name }))),
        catchError(() => of([])),
      );
  }

  /** Real: `POST /api/work-orders/{id}/wastages` (Laravel) — logs a total wastage quantity
   * (kg) for one type against a work order, optionally scoped to a shift/date. The backend
   * distributes it across every eligible machine proportional to output share (see
   * `WorkOrderController::logWastage`); this just forwards the operator's inputs, always
   * additive, never an upsert. */
  submitWastage(
    workOrderId: number,
    payload: {
      shiftId: number | null;
      date: string;
      entries: { wastageTypeId: number; qtyKg: number }[];
    },
  ): Observable<void> {
    return this.common.post<void>(
      `work-orders/${workOrderId}/wastages`,
      {
        shift_id: payload.shiftId,
        date: payload.date,
        entries: payload.entries.map((e) => ({
          wastage_type_id: e.wastageTypeId,
          qty_kg: e.qtyKg,
        })),
      },
      false,
    );
  }
}
