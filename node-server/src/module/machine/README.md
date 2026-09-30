# Machine Module

This module is the node-server machine telemetry and status engine for the MES platform. It owns the real-time acquisition path for shop-floor machines, state derivation, Socket.IO broadcasting, persistence of machine state transitions, and read-heavy machine overview calculations.

## What this module does

- Acquires machine signal data from PLC/relay devices through the configured transport.
- Derives machine runtime state and emits live updates to the Angular frontend.
- Persists state-transition history and counters to MySQL.
- Exposes calculation endpoints for the machine overview and work-order detail screens.

## Runtime modes

The module supports two acquisition pipelines:

1. Channel-mapping mode (default)
   - Enabled when `CHANNEL_MAPPING_ENABLED` is not `false`.
   - Uses the grouped PLC/channel poller in [runtime/channel-mapping.service.ts](runtime/channel-mapping.service.ts).
   - Preferred for fleets with many machines because it polls per PLC instead of one worker per machine.

2. Legacy worker mode
   - Enabled when `CHANNEL_MAPPING_ENABLED=false`.
   - Uses the per-machine worker orchestrator in [runtime/machine-runtime.service.ts](runtime/machine-runtime.service.ts).
   - Keeps the older worker-thread-based pipeline alive for backward compatibility.

## Key entry points

- [machine.module.ts](machine.module.ts) — Nest module wiring.
- [machine.service.ts](machine.service.ts) — Socket.IO gateway and frontend broadcast state.
- [runtime/machine-config.service.ts](runtime/machine-config.service.ts) — config loading, Redis caching, and machine override handling.
- [runtime/channel-mapping.service.ts](runtime/channel-mapping.service.ts) — default channel-based status poller.
- [runtime/machine-runtime.service.ts](runtime/machine-runtime.service.ts) — legacy worker orchestration.
- [runtime/machine-state-tracker.service.ts](runtime/machine-state-tracker.service.ts) — persisted state-transition writer and runtime broadcast.
- [machine-calculations.service.ts](machine-calculations.service.ts) — machine overview and work-order aggregation endpoints.
- [sync-engine/sync.machine.ts](sync-engine/sync.machine.ts) — Redis stream to MySQL sync worker.

## Important contracts to preserve

- Socket.IO events: `snapshot`, `message`, `to_frontend`, `plc`, `machine_status_runtime`.
- `machine_state_events` semantics: transitions are persisted once per confirmed state change and are broadcast to the runtime channel.
- Redis cache keys used by config loading: `machine:channel_configs`, `machine:runtime_configs`, `machine:states_map`.
- The optional override file [machines.example.json](machines.example.json) and its runtime behavior.

## Environment variables worth knowing

- `CHANNEL_MAPPING_ENABLED`
- `CHANNEL_MAPPING_INTERVAL_MS`
- `CHANNEL_PLC_TIMEOUT_MS`
- `CHANNEL_PLC_STATUS_PATH`
- `CHANNEL_READ_COUNTS`
- `MACHINE_FRONTEND_BROADCAST_MS`
- `MACHINE_CONFIG_CACHE_TTL_MS`
- `MACHINE_MAX_CONCURRENT_WORKERS`

## Editing checklist for future AI changes

1. Identify whether the change affects channel-mapping mode, legacy worker mode, or both.
2. Preserve the existing Socket.IO payload shapes unless the frontend contract is also updated.
3. Keep transition persistence idempotent and avoid duplicate writes for the same state.
4. If config loading changes, verify the Redis cache invalidation and override behavior.
5. Prefer shared helpers and existing services over introducing new ad-hoc logic.

## Suggested reading order

- [docs/CONTEXT.md](docs/CONTEXT.md) for architecture and data flow.
- [docs/AI_AGENT_GUIDE.md](docs/AI_AGENT_GUIDE.md) for implementation notes and common pitfalls.
- [docs/PROTOCOLS_DATA.md](docs/PROTOCOLS_DATA.md) for PLC/ESP protocol details.
