# Production Management — Machine Board

## Files
```
machine-board/
├── machine-board.component.ts
├── machine-board.component.html
└── machine-board.component.scss
```

## Routes
- `/production` (index, under `LayoutComponent`) — `MachineBoardComponent` — `PRODUCTION_DASHBOARD`

## Component
[MACHINE_BOARD_COMPONENT_CONTEXT.md](MACHINE_BOARD_COMPONENT_CONTEXT.md)

## Key Relationships
- Consumes `ProductionService.machines$` / `hallList$` (hall filter itself is driven by `LayoutComponent`, not this component). `machines$` now carries `oee`, `machinehalls[]`, `machinegroups[]` (`$expand` added — see [PRODUCTION_SERVICE_CONTEXT.md](../shared/PRODUCTION_SERVICE_CONTEXT.md)).
- Consumes `SocketService.on('to_frontend')` directly for live telemetry (status badge, temp/rpm, shot count). `MachineDurationService` no longer shares this subscription — it listens to a separate `machine_status_runtime` event instead (server-computed, transition-only).
- Consumes `MachineDurationService.snapshot(key)` per machine, refreshed on a local 1s `interval`, now bound through to `machine-status-card` via `[durations]`.
- Renders `status-card` (summary tiles) and `machine-status-card` (per-machine tiles) from `shared/components/`.
- Navigates to `/production/mco` with query params on card click — see [Machine key / navigation contract](#machine-key--navigation-contract) below.

## Machine key / navigation contract
`detailsPage(machine)` navigates with:
```ts
queryParams: { id: machine.custom_id, machineId: machine.id, name: machine.machine_name, status: machine.status }
```
`MachineOverviewComponent` reads these back and uses `machineId` (→ `String(machineId)`) as the key into `MachineDurationService.snapshot()`. If this contract changes on either side, live durations on `/mco` silently break (no error — `snapshot()` returns a zeroed default for an unknown key).

## Notes
- Socket handler accepts a single telemetry object *or* an array (`Array.isArray(data) ? data : [data]`) — backend may batch or send singly.
- Telemetry-to-machine matching tries `id`, then `custom_id`, then digits-only `custom_id` in that order (`getMachineData()`) — see [module-overview/context.md](../module-overview/context.md) for why.
- `to_frontend` items now also carry `lastSeenAt` (epoch ms the PLC last actually responded) — this component doesn't read it directly; `MachineDurationService` has its own separate `to_frontend` subscription that does, folding it into `snapshot()`'s `lastSeenAt` field so it flows through `machine.durations` → `machine-status-card`'s `[durations]` binding for free (see [MACHINE_DURATION_SERVICE_CONTEXT.md](../shared/MACHINE_DURATION_SERVICE_CONTEXT.md)).
