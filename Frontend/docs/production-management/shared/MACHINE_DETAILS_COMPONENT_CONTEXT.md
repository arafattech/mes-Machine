# MACHINE_DETAILS_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `shared/components/machine-details/machine-details.component.ts` |
| **HTML file** | `shared/components/machine-details/machine-details.component.html` |
| **Selector** | `app-machine-details` |
| **Component type** | Non-standalone, purely presentational (no logic beyond the input) |
| **Purpose** | Displays machine identity (id, name) and configured RPM/temp thresholds inside a `ui5-card` |
| **Used by** | `MachineOverviewComponent` (`/mco` page) — **currently commented out**, not removed. The Overview tab's left column shows the Shift Breakdown grid in this spot instead (see [MACHINE_OVERVIEW_COMPONENT_CONTEXT.md](MACHINE_OVERVIEW_COMPONENT_CONTEXT.md)). Re-enable by uncommenting the block in `machine-overview.component.html`; this component itself is unchanged and still fully wired if reinstated |

---

## Inputs (@Input)

| Input | Type | Default |
|---|---|---|
| `machine` | `{ id: string; name: string; status: string; maxRpm: number; minRpm: number; maxTemp: number; minTemp: number } \| null` | `null` |

No outputs, no internal state, no methods.

`maxRpm`/`minRpm`/`maxTemp`/`minTemp` are now **real** — sourced by the caller from `MachineHasConfigs` via `MachineOverviewDataService.getSpecs()` (was hardcoded `3000/2500/100/20` before). Most machines have these columns `null` in the DB today (no data-entry UI exists yet to set them — see [MISSING_INPUTS.md](../../../src/app/modules/production-management/shared/components/machine-overview/MISSING_INPUTS.md#1-maxmin-rpm-maxmin-temp-machine-details-card)), which this component now handles as a deliberate empty state rather than an error.

---

## Template Structure

```
ui5-card
├── "Machine Details" header
├── Machine Info section: Machine ID, Machine Name (each "N/A" if missing)
└── Configs section (2×2 grid): Max RPM, Min RPM, Max Temp, Min Temp
      truthy  → colored card (purple/amber/rose/amber), value shown
      falsy   → muted gray card, dashed border, italic "Not configured" text
```

## Notes
- **Fixed 2026-07-07**: previously every config tile used a colored card regardless of value, showing literal text `"N/A"` when falsy — visually indistinguishable from a real 0-ish value or a data problem. Since real DB `null` for these columns is now the *common* case (not hardcoded mock anymore), each of the 4 tiles got an `[ngClass]` toggle: truthy → original colored card; falsy → muted `bg-gray-50 border-dashed border-gray-200` card with gray icon/text and `"Not configured"` (italic) instead of `"N/A"`. Reads as an expected empty state rather than a broken one.
- Type is still inlined on the `@Input` rather than referencing a shared model/interface — if this shape needs to be reused elsewhere, promote it to `shared/interface/interface.ts`.
- A legitimate `0` value still displays as "not configured" (`!machine?.maxRpm` is truthy for `0`) — acceptable today since these thresholds are physically never zero for a real machine; revisit if that assumption changes.
- Currently always fed real (if often-null) threshold data by its only caller — see [MACHINE_OVERVIEW_COMPONENT_CONTEXT.md](MACHINE_OVERVIEW_COMPONENT_CONTEXT.md#known-gaps).
