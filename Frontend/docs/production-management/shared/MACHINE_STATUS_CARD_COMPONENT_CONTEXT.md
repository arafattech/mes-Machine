# MACHINE_STATUS_CARD_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `shared/components/machine-status-card/machine-status-card.component.ts` |
| **HTML file** | `shared/components/machine-status-card/machine-status-card.component.html` |
| **Selector** | `machine-status-card` |
| **Component type** | Non-standalone presentational tile, `ChangeDetectionStrategy.OnPush` |
| **Purpose** | Per-machine status tile. Two independent template branches — Compact (dense row layout) vs everything else (Detailed/Full-Screen — fixed-size card with progress bar) |
| **Used by** | `MachineBoardComponent` (one per machine in `results`) |

---

## Inputs (@Input)

| Input | Type | Purpose |
|---|---|---|
| `activity` | `string` (required, no default) | An admin-defined `machine_states.name`, uppercased (e.g. `"ACTIVE"`, or any custom state) — resolved against `machine_states` via `MachineStatesService.getByName()`, not a fixed 5-value union. Drives badge text/color/icon and metric masking rules |
| `has_temperature` | `boolean` (required) | Gates temperature row/column rendering |
| `has_rpm` | `boolean` (required) | Gates load row/column rendering |
| `temp` | `number \| null \| undefined` | Current temperature |
| `maxRate` | `number \| null \| undefined` | Load alert threshold |
| `maxTemp` | `number \| null \| undefined` | Temp alert threshold |
| `rpm` | `number \| null \| undefined` | Current load value (0–100 clamped by `loadPercent`) |
| `label` | `string` (required) | Machine display name |
| `runTime` | `number` (required) | Declared, no longer read by the template — both branches now show `currentStatusSeconds` in the slot that used to show `runTime` (see Known Gaps) |
| `durations` | `MachineDurations \| undefined` | Live per-state durations, **now bound by `MachineBoardComponent`'s template** (`[durations]="machine.durations"`) — feeds `currentStatusSeconds`/`availabilityPercent` below |
| `viewMode` | `ViewMode` | Default `ViewMode.DETAILED` — controls which template branch renders |
| `oee` | `number \| null \| undefined` | Raw `Machine.oee` DB column — Detailed-branch KPI tile, currently **commented out** in the template (disabled, not removed) |
| `hallName` | `string \| null \| undefined` | First `machinehalls[0].name` — Detailed-branch location badge, currently **commented out** |
| `groupName` | `string \| null \| undefined` | First `machinegroups[0].name` — Detailed-branch location badge, currently **commented out** |
| `shotCount` | `number \| null \| undefined` | Live socket `P` field (legacy-worker mode only) — Detailed-branch KPI tile, currently **commented out** |

---

## ViewChild

| Ref | Type | Purpose |
|---|---|---|
| `popover` (`#popover`) | `ElementRef` | Imperatively opened/closed on hover of the over-temp/over-load alert icon |

---

## Local Types
```ts
type MachineLoadState = 'Positive' | 'Negative' | 'None';                           // ui5-progress-indicator valueState
```

---

## Palette resolution (via `MachineStatesService`)

The old per-activity static maps (`labelMap`/`designMap`/`colorVarMap`/`iconMap`, each a `Record` keyed by the fixed ACTIVE/IDLE/MAINTENANCE/INACTIVE/FAULT union) are gone. Every getter below reads off `resolvedState`, a **memoized** private getter:

```ts
private _resolvedState?: MachineState;
ngOnChanges(changes: SimpleChanges): void {
  if (changes['activity']) this._resolvedState = this.machineStates.getByName(this.activity);
}
private get resolvedState(): MachineState | undefined { return this._resolvedState; }
```

`resolvedState` only recomputes when `activity` itself changes (via `OnChanges`), not on every change-detection cycle — `durations`/`temp`/`rpm` etc. change independently on every socket tick and would otherwise re-trigger a lookup on every CD pass through each of the ~6 getters below that read it, even though only `activity` actually determines the result. `MachineStatesService.getByName()` itself is an O(1) indexed `Map` lookup (a second `statesByName` signal built alongside `statesById` on load), not a linear scan.

| Getter | Source |
|---|---|
| `badgeText` | `resolvedState?.name ?? activity ?? 'Unknown'` |
| `statusColorVar` | `resolvedState?.color ?? '--sapNeutralColor'` |
| `statusIcon` | `resolvedState?.icon ?? 'question-mark'` |

The status `ui5-tag` no longer uses the `design` attribute (which only accepts a fixed 7-token palette — Positive/Critical/Negative/Information/Neutral/Set1/Set2 — unable to represent an arbitrary admin-picked color). Instead the template overrides Tag's own base CSS custom properties directly, scoped to that one tag instance via `[style.--var]` bindings:

```html
<ui5-tag
  [style.--sapNeutralBackground]="statusColorVar"
  [style.--sapNeutralBorderColor]="statusColorVar"
  [style.--sapTextColor]="'#ffffff'"
>
```

`--sapNeutralBackground`/`--sapNeutralBorderColor`/`--sapTextColor` are exactly the vars Tag's shadow-DOM CSS reads when no `design` is set (i.e. the default "Neutral" baseline — see `@ui5/webcomponents/dist/css/themes/Tag.css`). CSS custom properties inherit through the shadow boundary, so setting them via inline `style` on the host element overrides just that instance, leaving every other `ui5-tag` on the page untouched. This makes the tag's color fully DB-driven (`machine_states.color`, admin-editable) instead of a fixed 5-state palette — the icon (`statusIcon`, above) was already DB-driven; this closes the color half of that same gap.

Lookup is by **name**, not id — this component only ever receives a telemetry string (from `deriveActivity()`/`machine_status_runtime`'s `status` field), never a `machine_state_id`. `MachineStatesService.getByName()` does a case-insensitive match.

---

## Computed Getters

| Getter | Logic |
|---|---|
| `badgeText` / `statusColorVar` / `statusIcon` | See "Palette resolution" above |
| `isNonProductive` | `!(resolvedState?.counts_as_productive ?? false)` — replaces the old literal `activity === 'MAINTENANCE' \|\| 'IDLE' \|\| 'FAULT'` masking checks in the template (temperature/load `"--"` masking) so a custom admin-defined non-productive state masks correctly too. Note: this is a slight behavior generalization — Idle previously masked load but not temperature; both are now masked identically for any non-productive state, since `machine_states` has no separate "mask temperature" flag to preserve that finer distinction |
| `currentStatusSeconds` | `null` if `durations?.current == null`, else `durations.currentSeconds` — live elapsed seconds **since the current state was entered**, resetting to 0 on every transition. Deliberately distinct from `durations.perState[current]`, which keeps accumulating today's full total for that state across repeat visits (used by the State Durations panel elsewhere, not here) — a card's "time in this status" timer must reset on state change, not carry forward earlier same-day time in that state. This is the single source for both branches' "time in current status" display (there is no longer a separate Run/Idle/Inactive breakdown — see Known Gaps) |
| `availabilityPercent` | `null` if `!durations?.total`, else `round(productiveSeconds / durations.total * 100)`, where `productiveSeconds` sums `durations.perState[id]` across every `id` in `MachineStatesService.getProductiveIds()` — today's productive time as a % of all tracked time, generalized from a hardcoded "Active" bucket |
| `lastSeenAt` | `durations?.lastSeenAt ?? null` — epoch ms this machine's PLC last actually responded, from `MachineDurationService`'s `to_frontend`-fed tracking (see [MACHINE_DURATION_SERVICE_CONTEXT.md](MACHINE_DURATION_SERVICE_CONTEXT.md)). Independent of `activity`'s resolved state — a machine correctly showing "Inactive" can still be either legitimately idle-but-connected or genuinely PLC-silent; this is how the two are told apart. Rendered via `{{ lastSeenAt \| timeAgo }}` (`TimeAgoPipe`, `shared/pipes/time-ago.pipe.ts`), **Detailed branch only** — see Template Structure |
| `isOverTemp` | `has_temperature && temp != null && maxTemp != null && temp >= maxTemp` |
| `isOverLoad` | `has_rpm && rpm != null && maxRate != null && rpm >= maxRate` |
| `loadValue` | `resolvedState?.counts_as_productive ? loadPercent : 0` |
| `loadValueState` | `isOverLoad → 'Negative'`; else `resolvedState?.counts_as_productive ? 'Positive' : 'None'` |
| `loadPercent` | `rpm` clamped to `[0, 100]` |
| `alertHeader` | `'Over Temperature & Load'` / `'Over Temperature'` / `'Over Load'` / `null` |

---

## Methods

| Method | Description |
|--------|-------------|
| `ngOnInit()` | Sets `fullLabel` — truncates `label` to 10 chars + `'...'` if `temp !== null \|\| rpm !== null`, else uses full label unmodified |
| `onResize` (`@HostListener('window:resize')`) | Calls `checkScreenWidth` |
| `checkScreenWidth(width)` | `< 1420px` → truncate `fullLabel` to 5 chars; else full `label` — **independent truncation rule from `ngOnInit`'s**, can conflict (resize after init overwrites the 10-char truncation with a 5-char one, or restores full label, regardless of the temp/rpm condition that gated the original truncation) |
| `openPopover()` / `closePopover()` | Toggle `popover.nativeElement.open` — triggered by `mouseenter`/`mouseleave` on the alert icon |

---

## Template Structure (two branches, `viewMode === COMPACT` vs else)

**Compact branch** (`class="machine-card max-w-full rounded-[10px] px-4 py-2.5 flex flex-col gap-2"`, no fixed size):
```
Row 1: status tag + truncated name (fullLabel) + alert icon/popover
Row 2: temperature (if has_temperature) · load % (if has_rpm) · currentStatusSeconds (always rendered, "history" icon slot — replaced runTime)
```
No last-seen text in this branch — deliberately Detailed/Card-only (dense compact tiles stay dense). The two dead duplicate-markup comment blocks that used to sit here (a standalone Row-1.5 timer, and a second duplicate Uptime block after Row 2) have been deleted outright.

**Detailed/else branch** (`class="machine-card rounded-2xl h-[200px] w-full p-2.5 flex flex-col overflow-hidden"` — **fixed height and width so every card in the board grid is uniform**, `overflow-hidden` clips if content ever exceeds the fixed height):
```
Header: status dot + full label + alert icon + status tag
Last seen: `Last seen {{ lastSeenAt | timeAgo }}` — *ngIf="lastSeenAt != null", small metric-label text between the header and the divider
Divider
Metrics grid (1–3 cols depending on has_temperature/has_rpm): Temperature · Load · Uptime (shows currentStatusSeconds, "--" if null)
KPI row (flex-wrap, not a fixed grid): OEE tile (commented out) · Shot Count tile (commented out) · Availability tile (active, labeled "KPI" in the UI, shows availabilityPercent%) — only rendered if oee/shotCount/availabilityPercent != null
Load section: wrapped in `mt-auto pt-1.5` so it's pinned to the bottom of the fixed-height card regardless of how much content is above it — label + ui5-progress-indicator [value]="loadValue" [valueState]="loadValueState"
```

Masking rules baked into both branches:
- `isNonProductive` → temperature shows `"--"`.
- `isNonProductive` → load shows `"--"`.
- Uptime/history slot shows `"--"` only when `currentStatusSeconds` is `null` (no `durations` bound yet) — it is **not** masked by activity, since it already reflects whichever activity is current.

---

## Known Gaps
- **The former Run/Idle/Inactive 3-way duration breakdown (Compact "Row 3" and Detailed "Live per-state durations") has been removed entirely**, in both branches. All "how long has this machine been in a state" information now lives in the single `currentStatusSeconds` value shown in the Uptime/history slot.
- The two dead duplicate-markup comment blocks noted in earlier versions of this doc ("safe to delete if touching this block again") have since been deleted — no longer present, nothing to clean up here anymore.
- `runTime` `@Input` is no longer read anywhere in the template but is still declared and still populated by `MachineBoardComponent` (`[runTime]="machine.hours"`) — dead prop, safe to remove once confirmed no other consumer needs it.
- OEE, Shot Count, and location (hall/group) badges are wired end-to-end (inputs populated, `$expand` in place on `ProductionService`) but their template blocks are **commented out**, not deleted — only `availabilityPercent` ("KPI") is currently visible in the Detailed branch's KPI row.
- Two independent, differently-triggered label-truncation rules (`ngOnInit` content-based 10-char vs `checkScreenWidth` viewport-based 5-char threshold `1420px`) can produce inconsistent results depending on resize timing — consolidate into one rule if touching this component.
- `activity` is intentionally an arbitrary string now (not a fixed union) — any name not matching a row in `machine_states` (e.g. a stale/renamed state, or a typo upstream) falls through to `resolvedState === undefined` and every getter's `?? fallback`, which is safe but silently masks bad upstream data the same way the old fixed map did.
- Fixed `h-[200px]` on the Detailed branch is a hand-picked value sized to fit the current content mix (header + metrics + one KPI row + load bar) with the paddings/gaps as of this writing — re-check if a future content addition needs more vertical room, since `overflow-hidden` will silently clip rather than grow.
