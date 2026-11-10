import Redis from 'ioredis';

/**
 * Cross-process "production data changed" channel. Publishers: Laravel
 * (`ProductionEventPublisher`, after commit of production counts / wastage / targets /
 * machine configs / work orders) and node-server's own shot writer. Every node-server
 * instance subscribes (`ProductionRealtimeService`) and pushes to its own sockets, so
 * delivery works with several PM2 instances without a Socket.IO Redis adapter.
 */
export const PRODUCTION_EVENTS_CHANNEL = 'mes:production-events';

export interface ProductionEvent {
  type: string;
  machine_ids: number[];
  work_order_ids: number[];
}

export function PublishProductionEvent(redis: Redis, event: ProductionEvent): Promise<number> {
  return redis.publish(PRODUCTION_EVENTS_CHANNEL, JSON.stringify(event));
}

/** Validates a raw channel message (another process wrote it) — `null` when malformed; ids
 * that aren't positive safe integers are dropped rather than producing `...:NaN` keys. */
export function ParseProductionEvent(message: string): ProductionEvent | null {
  let raw: unknown;
  try {
    raw = JSON.parse(message);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;

  const { type, machine_ids, work_order_ids } = raw as Record<string, unknown>;
  const toIds = (value: unknown): number[] =>
    Array.isArray(value) ? value.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0) : [];

  return {
    type: typeof type === 'string' ? type : 'unknown',
    machine_ids: toIds(machine_ids),
    work_order_ids: toIds(work_order_ids),
  };
}

/**
 * Per-machine / per-work-order cache version, embedded in every `machine:calc:*` key.
 * Calculation keys carry arbitrary ISO ranges, so a write can't compute which keys to
 * drop — one `INCR` instead makes every cached range for that machine / work order
 * unreachable (old entries just expire on their short TTL). O(1), no KEYS/SCAN.
 */
export type CalcVersionScope = 'machine' | 'wo';

// Far longer than any calc TTL (seconds), so expiry can never resurrect a stale entry —
// only stops one key per work order accumulating forever.
const VERSION_KEY_TTL_SECONDS = 7 * 24 * 60 * 60;

function versionKey(scope: CalcVersionScope, id: bigint | number): string {
  return `machine:calc:ver:${scope}:${id.toString()}`;
}

/** Current version (`'0'` before the first change). A Redis failure degrades to `'0'` — the
 * TTL still bounds staleness — and never fails the request. */
export async function GetCalcVersion(
  redis: Redis,
  scope: CalcVersionScope,
  id: bigint | number,
): Promise<string> {
  try {
    return (await redis.get(versionKey(scope, id))) ?? '0';
  } catch {
    return '0';
  }
}

export async function BumpCalcVersions(
  redis: Redis,
  machineIds: Iterable<number>,
  workOrderIds: Iterable<number>,
): Promise<void> {
  const pipeline = redis.pipeline();
  const bump = (key: string) => pipeline.incr(key).expire(key, VERSION_KEY_TTL_SECONDS);
  for (const id of machineIds) bump(versionKey('machine', id));
  for (const id of workOrderIds) bump(versionKey('wo', id));
  await pipeline.exec();
}
