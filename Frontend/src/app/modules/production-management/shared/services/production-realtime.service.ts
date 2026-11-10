import { Injectable, inject } from '@angular/core';
import { Observable, asyncScheduler, filter, map, merge, mergeMap, share, throttleTime, timer } from 'rxjs';
import { SocketService } from '@app/services/socket.service';

/** node-server `machine_production_updated` — one coalesced push per window (~1s) listing every
 * machine / work order whose production, wastage, target, config or work-order data changed. */
interface MachineProductionUpdatedEvent {
  machine_ids: number[];
  work_order_ids: number[];
  types: string[];
}

/** Live shot counting pushes up to once per coalesce window (~1s) per producing machine — the
 * page refetches at most this often for shot-only pushes (first immediately, last guaranteed).
 * Human writes (production / wastage logs, configs, targets) are never throttled. */
const SHOT_REFRESH_THROTTLE_MS = 2000;
/** A flapping machine state (e.g. Active↔Idle around a threshold) refetches the overview at most
 * this often (first immediately, last guaranteed). */
const STATE_REFRESH_THROTTLE_MS = 1000;
/** Spreads reconnect resyncs: after a node-server restart every client reconnects at once. */
const RESYNC_JITTER_MS = 2000;

interface MachineStatusRuntimeEvent {
  machine_id: number | string;
}

/**
 * - `production`: production / wastage / target / config data changed (refetch figures);
 * - `state`: the machine changed state — OEE's time-based inputs change slope;
 * - `resync`: socket reconnected — pushes sent while disconnected were lost, refetch everything.
 */
export type ProductionChangeKind = 'production' | 'state' | 'resync';

export interface MachineProductionChange {
  kind: ProductionChangeKind;
  workOrderIds: number[];
}

/**
 * Push-based production / wastage / OEE change feed (replaces polling). Backed by node-server,
 * which receives every write via Redis pub/sub (Laravel observers + its own shot writer) and
 * bumps its calc-cache versions before pushing — so a refetch triggered here is always fresh.
 */
@Injectable({
  providedIn: 'root',
})
export class ProductionRealtimeService {
  private readonly socket = inject(SocketService);

  private readonly productionUpdated$ = this.socket
    .on('machine_production_updated')
    .pipe(share()) as Observable<MachineProductionUpdatedEvent>;
  private readonly stateChanged$ = this.socket
    .on('machine_status_runtime')
    .pipe(share()) as Observable<MachineStatusRuntimeEvent>;
  private readonly reconnected$ = this.socket.onReconnect().pipe(
    mergeMap(() => timer(Math.random() * RESYNC_JITTER_MS)),
    map(() => undefined),
    share(),
  );

  /** Changes relevant to one machine's production / wastage / OEE figures. */
  machineChanges$(machineKey: string): Observable<MachineProductionChange> {
    const machineId = Number(machineKey);
    const forMachine$ = this.productionUpdated$.pipe(
      filter((event) => event?.machine_ids?.includes(machineId) ?? false),
    );
    const isShotOnly = (event: MachineProductionUpdatedEvent) =>
      (event.types ?? []).every((type) => type === 'ProductionShot');
    const toChange = (event: MachineProductionUpdatedEvent): MachineProductionChange => ({
      kind: 'production',
      workOrderIds: event.work_order_ids ?? [],
    });

    return merge(
      forMachine$.pipe(filter((event) => !isShotOnly(event)), map(toChange)),
      forMachine$.pipe(
        filter(isShotOnly),
        throttleTime(SHOT_REFRESH_THROTTLE_MS, asyncScheduler, { leading: true, trailing: true }),
        map(toChange),
      ),
      this.stateChanged$.pipe(
        filter((event) => Number(event?.machine_id) === machineId),
        throttleTime(STATE_REFRESH_THROTTLE_MS, asyncScheduler, { leading: true, trailing: true }),
        map(() => ({ kind: 'state' as const, workOrderIds: [] })),
      ),
      this.reconnected$.pipe(map(() => ({ kind: 'resync' as const, workOrderIds: [] }))),
    );
  }

  /** Production / wastage / work-order changes for one work order, plus reconnect resyncs. */
  workOrderChanges$(workOrderId: number): Observable<void> {
    return merge(
      this.productionUpdated$.pipe(filter((event) => event?.work_order_ids?.includes(workOrderId) ?? false)),
      this.reconnected$,
    ).pipe(map(() => undefined));
  }

  /** Any work-order record saved / deleted (status, quantity, machine assignment). */
  workOrderRecordChanges$(): Observable<void> {
    return this.productionUpdated$.pipe(
      filter((event) => event?.types?.includes('WorkOrder') ?? false),
      map(() => undefined),
    );
  }
}
