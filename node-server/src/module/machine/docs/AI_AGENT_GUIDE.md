# Machine Module — AI Agent Guide

This guide is meant for future AI assistants and engineers working on the machine module. It focuses on the contracts and invariants most likely to cause regressions if they are changed carelessly.

## Before you edit

1. Decide which runtime path is affected:
   - Channel-mapping mode via [runtime/channel-mapping.service.ts](../runtime/channel-mapping.service.ts)
   - Legacy worker mode via [runtime/machine-runtime.service.ts](../runtime/machine-runtime.service.ts)
   - Shared calculations via [machine-calculations.service.ts](../machine-calculations.service.ts)
2. Read [CONTEXT.md](CONTEXT.md) first for the architecture and data flow.
3. Check whether the change touches Socket.IO payloads, persisted state transitions, or Redis-backed config loading.

## Contracts that are easy to break

### 1. Socket.IO contract

The frontend relies on the gateway in [machine.service.ts](../machine.service.ts) for:

- `snapshot`
- `message`
- `to_frontend`
- `plc`
- `machine_status_runtime`

Do not change the event names or payload shapes without checking the Angular consumers.

### 2. State-transition persistence

State transitions are persisted through [runtime/machine-state-tracker.service.ts](../runtime/machine-state-tracker.service.ts). Both acquisition pipelines funnel through this service so that the same transition write logic is used everywhere.

Keep these rules intact:

- transitions should be idempotent for a steady state
- a state change should produce one persisted transition row and one runtime broadcast
- the code should not create duplicate rows for the same machine during repeated ticks

### 3. Channel mapping vs. legacy worker path

These are separate runtime implementations with different scaling properties:

- Channel mapping is the default and is optimized for grouped PLC polling.
- Legacy workers are still used when `CHANNEL_MAPPING_ENABLED=false`.

A change that works for one path may break the other if it assumes the wrong transport semantics.

### 4. Config caching and overrides

[runtime/machine-config.service.ts](../runtime/machine-config.service.ts) loads Redis-cached machine config data, and [machines.example.json](../machines.example.json) provides local overrides.

If you change config shapes or load logic, verify:

- cache keys and TTL behavior
- override file application
- channel config vs runtime config separation

## Common pitfalls

- Adding a DB write inside the worker path without preserving ordering can create duplicate or lost updates.
- Changing the status names or IDs without checking the machine-state tables can break the frontend and analytics.
- Touching the channel acquisition logic without preserving the shared lookup/counter helpers can break all three transports.
- Changing the `machine_status_runtime` payload shape without coordinating the frontend integration will break the runtime UI.

## Suggested change strategy

- Make the smallest change that solves the issue.
- Add or update one focused doc note if the change changes module behavior or contracts.
- Re-check the runtime mode selection before implementing or validating a fix.
