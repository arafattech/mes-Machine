# QUALITY_EFFICIENCY_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `shared/components/quality-efficiency/quality-efficiency.component.ts` |
| **HTML file** | `shared/components/quality-efficiency/quality-efficiency.component.html` |
| **Selector** | `app-quality-efficiency` |
| **Component type** | Non-standalone, `ChangeDetectionStrategy.OnPush` |
| **Purpose** | Single OEE-style metric tile — icon, label, value, optional delta indicator — in one of 3 visual variants |
| **Used by** | `MachineOverviewComponent`, 4 instances: 1 `variant="hero"` (M/C Efficiency) + 3 `variant="compact"` (Availability/Performance/Quality). All 4 now real data from `MachineController::overview` |

---

## Inputs (@Input)

| Input | Type | Required/Default |
|---|---|---|
| `metric` | `Metric` (`{ label, value, unit?, delta?, icon?: MetricIcon, color?: MetricColor }`) | Yes (`{ required: true }`) |
| `variant` | `'default' \| 'compact' \| 'hero'` | `'default'` |

No outputs.

**Added 2026-07-07**: `variant` — lets one caller (`MachineOverviewComponent`) render the same 4-metric array with the composite `M/C Efficiency` tile visually dominant (large gradient card, bigger number, icon on the right) and the 3 contributing factors as smaller tiles beneath it, instead of 4 visually-identical boxes. Non-breaking — existing/default usage is unaffected.

---

## Methods / Computed

| Member | Logic |
|---|---|
| `colorClasses(color = 'green')` | Maps `MetricColor` → Tailwind class triple: `green`→`bg-green-50 text-green-600 ring-green-100`, `purple`→purple set, `orange`→orange set, `rose`→rose set. Shared across all 3 variants |
| `deltaInfo` (getter) | `d = metric.delta ?? 0`; `up = d >= 0`; returns `{ arrow: '▲'/'▼', cls: 'text-emerald-600'/'text-rose-600', abs: formatted absolute value }` |
| `formatValue(v, unit = '%')` | `` `${v}${unit}` `` |

---

## Template Structure

The icon SVG markup (`ngSwitch` on `metric.icon`: box / cog / sparkles / wrench / `'?'` default) is defined **once** in a shared `<ng-template #iconTpl>` and reused via `*ngTemplateOutlet` across both layouts below — avoids duplicating the 4 inline SVG paths per variant.

```
variant === 'hero':
  gradient card (rose-50→white), icon badge on the right (h-16 w-16)
  ├── label (uppercase, small)
  └── value (text-4xl, bold) + delta

variant === 'default' | 'compact':
  card, icon badge on the left
  ├── icon badge — h-12 w-11 (default) or h-9 w-9 (compact)
  └── label (text-sm/text-xs) + value (text-2xl/text-lg) + delta
```

## Notes
- Icons are inline SVGs per case, no external icon library — matches repo convention of avoiding extra UI dependencies beyond UI5 for icon-like decoration where SVG suffices.
- `MetricIcon`/`MetricColor` unions must stay in sync with `colorClasses`'s map and the template's `ngSwitch` cases — adding a new icon/color value requires updating both this component and the union type in `utils/types.ts`.
- `variant` is purely presentational — it does not change what `metric` data means or how it's computed; that logic lives entirely in the caller (`MachineOverviewDataService`).
