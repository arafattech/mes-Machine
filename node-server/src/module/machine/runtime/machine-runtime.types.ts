export type MachineTransport = 'modbus' | 'api';

/**
 * Admin-editable `machine_states` row metadata needed at runtime — replaces
 * the old hardcoded ACTIVE/IDLE/INACTIVE/MAINTENANCE/FAULT vocabulary.
 * `priority` breaks ties when multiple configured channels read HIGH at once;
 * `counts_as_productive` is what OEE Availability sums against instead of a
 * hardcoded `state === 'active'` string comparison.
 */
export type MachineStateMeta = {
  id: number;
  name: string;
  priority: number;
  counts_as_productive: boolean;
  color: string | null;
};

export type MachineInvertConfig = {
  F: boolean;
  P: boolean;
  A: boolean;
  ZH: boolean;
  HK: boolean;
};

/**
 * One row of a machine's channel→state mapping (from `config_has_channels`).
 * `machine_state_id` is a real FK into `machine_states` — an admin-defined,
 * arbitrary state, not one of a fixed hardcoded set.
 */
export type ChannelStatusEntry = {
  channel_id: number;
  machine_state_id: number;
};

/**
 * How ChannelMappingService acquires a machine's DI0..DI9 input array.
 * Independent of `MachineTransport` above, which only drives the legacy
 * per-machine worker's shot-counting/heating pipeline.
 */
export type ChannelReadFrom = 'MQTT' | 'API' | 'MODBUS';

export const DEFAULT_CHANNEL_READ_FROM: ChannelReadFrom = 'API';

export type MachineRuntimeConfig = {
  id: string;
  ip: string;
  // auf_list: string;
  taktzeit: number;
  heating_start: string | null;
  enabled: boolean;
  transport: MachineTransport;
  api_url: string | null;
  api_signal_map: Record<string, number> | null;
  invert: MachineInvertConfig;
  // Poll cadence + request timeout, resolved from DB (seconds → ms).
  // null = fall back to the env/hardcoded default.
  poll_interval_ms: number | null;
  request_timeout_ms: number | null;
  // Channel status mapping (used only when CHANNEL_MAPPING_ENABLED=true).
  live_status_api: string | null;
  channels: ChannelStatusEntry[];
  // This machine's fallback `machine_states.id` when no configured channel
  // reads HIGH (`machine_has_states.is_default`) — replaces the old hardcoded
  // `else -> INACTIVE`. null if the admin hasn't designated one yet.
  default_machine_state_id: number | null;
  // Transport used to acquire `channels`' live inputs (from `read_from`).
  channel_read_from: ChannelReadFrom;
};

/**
 * Lean, Redis-cached subset of `MachineRuntimeConfig` used only by
 * `ChannelMappingService`'s poll loop — deliberately excludes invert flags,
 * the legacy shot-counting `transport`/`api_url`/`api_signal_map`, and
 * `heating_start`, none of which channel status derivation needs.
 */
export type ChannelRuntimeConfig = {
  id: string;
  ip: string;
  // Per-device MQTT identifier (machine_has_configs.id_iot) — an alternative
  // to `ip` for matching a machine to its MqttChannelSource cache entry, for
  // deployments where firmware publishes by device ID rather than IP. Only
  // used when `read_from='MQTT'`; other transports always key by `ip`.
  id_iot: string | null;
  channel_read_from: ChannelReadFrom;
  poll_interval_ms: number | null;
  request_timeout_ms: number | null;
  live_status_api: string | null;
  channels: ChannelStatusEntry[];
  // This machine's fallback `machine_states.id` when no configured channel
  // reads HIGH (`machine_has_states.is_default`) — replaces the old hardcoded
  // `else -> INACTIVE`. null if the admin hasn't designated one yet.
  default_machine_state_id: number | null;
};

export type WorkerDataMessage = {
  type: 'data';
  machineId: string;
  payload: Record<string, unknown>;
};

export type WorkerDeadMessage = {
  type: 'dead';
  machineId: string;
};

export type WorkerErrorMessage = {
  type: 'error';
  machineId: string;
  error: string;
};

/**
 * Reports the Modbus transport's own live TCP connection state on each
 * connect/disconnect edge — replaces a separate `ping`-subprocess reachability
 * check (see `MachineRuntimeService`): a persistent connection succeeding or
 * failing is a stronger, cheaper reachability signal than a redundant ICMP probe.
 */
export type WorkerConnectionMessage = {
  type: 'connection';
  machineId: string;
  connected: boolean;
};

/**
 * Worker threads hold no `PrismaClient` of their own (see `MachineRuntimeService`
 * — one shared connection pool for the whole process instead of one per
 * thread) — DB reads/writes are relayed to the main thread as messages and,
 * for `get_counter`, answered back via `WorkerCounterResultMessage`.
 */
export type WorkerGetCounterMessage = {
  type: 'get_counter';
  machineId: string;
  requestId: string;
};

export type WorkerSaveCounterMessage = {
  type: 'save_counter';
  machineId: string;
  shotNr: number;
  lastCycleTime: number;
  cycleTime: number;
};

export type WorkerSetHeatingStartMessage = {
  type: 'set_heating_start';
  machineId: string;
  timestamp: string;
};

export type WorkerClearHeatingStartMessage = {
  type: 'clear_heating_start';
  machineId: string;
};

export type WorkerRecordProductionShotMessage = {
  type: 'record_production_shot';
  machineId: string;
  isGood: boolean;
};

export type WorkerOutMessage =
  | WorkerDataMessage
  | WorkerDeadMessage
  | WorkerErrorMessage
  | WorkerConnectionMessage
  | WorkerGetCounterMessage
  | WorkerSaveCounterMessage
  | WorkerSetHeatingStartMessage
  | WorkerClearHeatingStartMessage
  | WorkerRecordProductionShotMessage;

export type MachineCounterRow = {
  shot_nr: number;
  last_cycle_time: number;
  cycle_time: number;
};

/** Main thread → worker control/response messages. */
export type WorkerControlMessage =
  | { type: 'stop' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'config_update'; config: Partial<MachineRuntimeConfig> }
  | { type: 'ip_change'; ip: string }
  | { type: 'url_change'; api_url: string }
  | { type: 'counter_result'; requestId: string; counter: MachineCounterRow | null };
