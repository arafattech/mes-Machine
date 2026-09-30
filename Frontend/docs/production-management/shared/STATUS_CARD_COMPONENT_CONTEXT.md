# STATUS_CARD_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `shared/components/status-card/status-card.component.ts` |
| **HTML file** | `shared/components/status-card/status-card.component.html` |
| **Selector** | `status-card` |
| **Component type** | Non-standalone presentational tile (declared in `ProductionModule`) |
| **Purpose** | Single summary tile for the machine-board header row — the fixed Overall Efficiency tile, plus one tile per active `machine_states` row (dynamic, not a fixed Active/Idle/Inactive/Maintenance/Fault set) |
| **Used by** | `MachineBoardComponent` — one instance per entry in `cards`, a `computed()` signal built via `buildCards(results())` off `MachineStatesService.getAll()` — recomputes automatically whenever `results` or the states service's own state changes (see [MACHINE_BOARD_COMPONENT_CONTEXT.md](../machine-board/MACHINE_BOARD_COMPONENT_CONTEXT.md)) |

---

## Inputs (@Input)

| Input | Type | Default | Purpose |
|---|---|---|---|
| `percent` | `number` | `0` | Displayed in the "overall" variant's big number |
| `progress` | `number` | `0` | Drives the bottom progress bar width (`%`) |
| `label` | `string` | `'Overall Efficiency'` | Subtitle text |
| `type` | `'overall' \| number` | `'overall'` | `'overall'` renders the fixed summary tile; any other value is a `machine_states.id` — drives palette/icon (via `MachineStatesService`) and which big-number format renders |
| `count` | `number` | `0` | Numerator for non-overall types (`count/totalMachines`) |
| `totalMachines` | `number \| undefined` | `undefined` | Denominator for non-overall types |

No outputs.

---

## Computed

| Getter | Returns |
|---|---|
| `palette` | `{ icon, color, tint }`. `type === 'overall'` → a fixed `OVERALL_PALETTE` constant (blue/indigo "information" theme). Otherwise resolved live via `MachineStatesService.getIcon/getColor/getTint(type)` — the admin-configured per-state palette, not a hardcoded switch. No more `STATUS_PALETTE` record keyed by a fixed status union. |

---

## Template Structure

- Top 1.5px gradient accent bar (`palette.accent`).
- Icon circle: `ui5-avatar` switched on `type` (overall=`tnt/throughput-backlog`, active=`sys-enter-2`, idle=`stop`, maintenance=`tnt/etl-job`, inactive=`sys-cancel`, fault=`alert`), SVG circle fallback for unknown types.
- Big number: `type === 'overall'` → `{{ percent }}%`; else → `{{ count }}/{{ totalMachines }}` (via `ngSwitch`, `ui5-title`), `N/A` for unrecognized types.
- Subtitle: `{{ label }}`.
- Progress bar: width bound to `progress`, plus `{{ progress }}% of 100%` caption.
- `loading` field exists (always `false`, no `@Input`) — dead branch rendering a busy-indicator that never activates.
- Big-number `ngSwitch` (`active`/`idle`/`maintenance`/`inactive`/`fault`) has an explicit `ui5-title` case per type; `fault` was added alongside the other four, not left to the `N/A` default.

---

## Notes
- `loading` is not exposed as an `@Input` — the busy-indicator branch in the template is unreachable given current usage. Either wire it up as an input or remove the branch if a loading state is never needed here.
- Palette now resolves through the single shared `MachineStatesService` (`@shared/services/machine-states.service.ts`) — adding a new `machine_states` row picks up a tile automatically, no code change needed. `MachineStatusCardComponent` resolves its own palette the same way (by state *name*, since it only receives a telemetry string — see its own context doc), so the two stay in sync without duplicated maps.
