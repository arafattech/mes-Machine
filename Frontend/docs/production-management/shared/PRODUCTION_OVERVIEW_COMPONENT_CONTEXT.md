# PRODUCTION_OVERVIEW_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `shared/components/production-overview/production-overview.component.ts` |
| **HTML file** | `shared/components/production-overview/production-overview.component.html` |
| **Selector** | `app-production-overview` |
| **Component type** | Non-standalone, `ChangeDetectionStrategy.OnPush` |
| **Purpose** | Fixed 4-tile KPI card: Production Target, Good Units (ok/total), Production Achieved, Wastage |
| **Used by** | `MachineOverviewComponent` (`/mco` page, right column — now fed real values from `MachineController::overview`, though they read 0 until `machine_production_counts`/`machine_production_targets` have data — see [MACHINE_OVERVIEW_COMPONENT_CONTEXT.md](MACHINE_OVERVIEW_COMPONENT_CONTEXT.md#known-gaps)) |

---

## Inputs (@Input)

| Input | Type | Default |
|---|---|---|
| `periodLabel` | `string` | `'May, 2024'` |
| `productionTarget` | `number` | `72000` |
| `productionAchieved` | `number` | `62000` |
| `machineOk` | `number` | `72` |
| `machineTotal` | `number` | `80` |
| `wastage` | `number` | `160` |
| `unit` | `string` | `'kg'` |
| `compact` | `boolean` | `false` |

No outputs.

---

## Template Structure

```
Header: "Production Overview" title + period-label button (non-functional dropdown chevron, no click handler)
KPI grid (2 cols, sm+):
├── Production Target   (purple) — {{ productionTarget | number }} {{ unit }}
├── Good Units            (emerald) — {{ machineOk }} / out of {{ machineTotal }}
├── Production Achieved  (amber) — {{ productionAchieved | number }} {{ unit }}
└── Wastage               (rose) — {{ wastage | number }} {{ unit }}
```

`compact` input toggles Tailwind spacing/text-size classes throughout (`p-3` vs `p-5 sm:p-6`, `text-xl` vs `text-2xl`, etc.) — purely cosmetic density switch, no logic branches.

## Notes
- **Fixed 2026-07-07**: the "Machine Status" label was mislabeled — this component is only ever used on the single-machine `/mco` page, but the wording ("Machine Status ... out of ...") read like a fleet-wide "N machines OK out of M total" stat, which doesn't make sense for a one-machine page. It actually renders `machineOk`/`machineTotal` = this machine's good/total shot counts for the period — a quality ratio, not a fleet count. Relabeled to "Good Units" to match what it actually shows. No input/output contract change, no other consumer exists (confirmed via `grep -rl "<app-production-overview"`).
- The period-label button renders a chevron icon but has no `(click)` handler — either a stub for a future date-range picker or dead UI; do not assume it opens anything. (The real date-range picker added to `/mco` lives in `MachineOverviewComponent`'s own template, separate from this button.)
- All 7 inputs are fully data-driven/reusable — the caller (`MachineOverviewComponent`) now sources them from `MachineOverviewDataService.getOverview()` (real backend call) instead of hardcoding; see [MACHINE_OVERVIEW_COMPONENT_CONTEXT.md](MACHINE_OVERVIEW_COMPONENT_CONTEXT.md) for why the numbers are still 0 today.
