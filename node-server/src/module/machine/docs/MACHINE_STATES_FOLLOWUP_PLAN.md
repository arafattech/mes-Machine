# Follow-up: Optimizations + Default-State Admin UI

## Context

The dynamic machine-status rework (see [`CONTEXT.md`](CONTEXT.md) §15 for the shipped
architecture) replaced the hardcoded 5-value status vocabulary with a `machine_states`
table + `machine_has_states` pivot. Runtime testing surfaced four follow-up items: three
are pure performance fixes in the new hot paths (node-server's per-tick status derivation,
the frontend's per-card state lookups, and duplicate un-cached DB reads in the
OEE/shift-breakdown calculation services), and one is a real feature gap — `is_default` is
fully supported end-to-end on the backend but has no UI anywhere, so every machine today
silently depends on the "fall back to Inactive by name" safety net instead of an explicit
admin choice. All four are independent; none change existing behavior for a machine that
doesn't opt into a default.

## Item 1 — Resolve active/idle/fault/inactive role IDs once per tick, not once per machine

**File:** `node-server/src/module/machine/runtime/channel-mapping.service.ts`

`pollConfigs()` loops over every machine config once per tier tick, calling `deriveStatus()`
per machine, which unconditionally calls `detectContradictionFault()`. That function does
`for (const meta of statesById.values())` to find the active/idle/fault state ids/meta — a
full linear scan of the tiny (~5-10 row) `statesById` map, repeated once per machine per tick
even though `statesById` is identical for every machine in that tick. `deriveStatus()`'s own
"no candidate, no default" fallback (scanning for a state named `'inactive'`) has the same
pattern, but only runs for machines with no candidate and no configured default.

**Fix:**
1. Add a `resolveStatusRoles(statesById)` private method doing **one** combined pass over
   `statesById.values()`, returning `{ activeId, idleId, faultMeta, inactiveId }` (all
   `| null`). Preserve current "last match wins" semantics on duplicate names by keeping the
   same iteration order (the map already preserves insertion order from
   `loadMachineStatesMap`).
2. In `pollConfigs()`, call `const roles = this.resolveStatusRoles(statesById);` once, right
   after `statesById` is resolved — not inside the per-machine loop.
3. Change `deriveStatus()` and `detectContradictionFault()` to accept `roles` instead of
   re-deriving active/idle/fault/inactive ids from `statesById` themselves.
   `deriveStatus()` keeps its own `statesById` param too — still needed for the genuine O(1)
   per-channel priority lookup (`statesById.get(entry.machine_state_id)?.priority`), which is
   not a scan and shouldn't change.
4. Fallback branch becomes `if (roles.inactiveId !== null) return { stateId: roles.inactiveId, channel: null };`.

**Must preserve exactly:** if `machine_states` doesn't have all of active/idle/fault/inactive
tagged, the corresponding `roles.*` field is `null` and every downstream check behaves
identically to today (already guarded by existing null-checks, now reading from `roles`
instead of re-scanning). No change to debounce, persistence, or broadcast logic — only how
the role ids are looked up.

**Verify:** `cd node-server && npx tsc --noEmit -p tsconfig.json` (ignore the pre-existing
unrelated `supertest` e2e-spec error). Then live-check: with node-server running, curl
`/api/machine/{id}/overview` before and after touching the file to confirm identical output
for the same machine state; watch the poll logs for a machine with real Active/Idle channels
and confirm status still resolves correctly; disconnect a PLC and confirm it still falls back
to Inactive/its configured default exactly as before.

---

## Item 2 — O(1) name lookup + memoized per-card state resolution (frontend)

**Files:**
- `Frontend/src/app/shared/services/machine-states.service.ts`
- `Frontend/src/app/modules/production-management/shared/components/machine-status-card/machine-status-card.component.ts`

`MachineStatesService.getByName()` does `[...map.values()].find(...)` — a linear scan, called
once per machine per tick from `MachineBoardComponent.updateCardsFromResults()`, and again
via `MachineStatusCardComponent`'s private `resolvedState` getter, which itself is
re-invoked by ~6 separate public getters (`badgeText`, `statusDesign`, `statusColorVar`,
`statusIcon`, `isNonProductive`, `loadValue`, `loadValueState`) — each re-evaluated on every
Angular change-detection cycle since they're plain getters bound in the template, not
memoized. `durations`/`temp`/`rpm` etc. change every tick independently of `activity`, so CD
re-runs and re-scans far more often than `activity` actually changes.

**Fix:**
1. In `MachineStatesService`, add a second signal `statesByName = signal<Map<string, MachineState>>(new Map())`,
   built in the same `tap` inside `loadAll()` alongside `statesById`. Rewrite `getByName()` to
   `return name ? this.statesByName().get(name.toLowerCase()) : undefined;` — O(1).
   Preserve exact tie-break behavior on a (rare, admin-caused) duplicate name: build the map
   so the **first** occurrence in `states` array order wins, not the last (guard with
   `if (!map.has(key)) map.set(key, s)` when constructing it), matching today's `find()`
   semantics exactly.
2. In `MachineStatusCardComponent`, implement `OnChanges` and cache the resolved state:
   ```ts
   private _resolvedState?: MachineState;
   ngOnChanges(changes: SimpleChanges): void {
     if (changes['activity']) this._resolvedState = this.machineStates.getByName(this.activity);
   }
   private get resolvedState() { return this._resolvedState; }
   ```
   `ngOnChanges` fires on first bind too (any `@Input()`'s first assignment counts as a
   change), so no separate `ngOnInit` handling needed — behavior on first render is identical
   to today.

**Verify:** `cd Frontend && npx tsc -p tsconfig.app.json --noEmit`, then the real `ng serve`
build log (not just tsc) per this repo's established convention. Browser-check the Machine
Board: badge text/color/icon/load bar must render identically to before for machines in
different states; flip a machine's state via the backend and confirm the card updates on the
next tick (proves the memoization invalidates correctly on `activity` change).

---

## Item 3 — Reuse the existing `machine:states_map` Redis cache in the calculation services

**Files:**
- `node-server/src/module/machine/machine-calculations.service.ts` (`loadStatesMap()`,
  `loadProductiveStateIds()`)
- `node-server/src/module/machine/work-order-detail.service.ts` (`loadProductiveStateIds()`
  only — this file has **no** `loadStatesMap()`/color-needing method; don't touch anything
  else in it)
- `node-server/src/module/machine/calculations.module.ts`
- `node-server/src/module/machine/runtime/machine-runtime.types.ts` (`MachineStateMeta`)
- `node-server/src/module/machine/runtime/machine-config.service.ts` (`loadMachineStatesMap()`)

Both calculation services hit Prisma directly on every HTTP request for `machine_states`
data that's already Redis-cached (key `machine:states_map`, written by
`MachineConfigService.loadMachineStatesMap()`, same TTL/fire-and-forget pattern as
`machine:channel_configs`/`machine:runtime_configs`).

**Fix:**
1. `loadProductiveStateIds()` in **both** services: inject `MachineConfigService`, replace
   the Prisma query with
   `const statesById = await this.machineConfigService.loadMachineStatesMap(); return new Set([...statesById.values()].filter(s => s.counts_as_productive).map(s => s.id));`
   — no gap, `MachineStateMeta` already has `counts_as_productive`.
2. `loadStatesMap()` in `machine-calculations.service.ts` needs `{name, color}`, but
   `MachineStateMeta` only has `{id, name, priority, counts_as_productive}` — no `color`.
   **Resolution: extend `MachineStateMeta` to include `color: string | null`.**
   - Add `color: true` to the Prisma `select` in `loadMachineStatesMap()` and `color: row.color`
     to the mapped metas.
   - This changes the cached JSON shape for `machine:states_map` (additive field only,
     backward-compatible — a stale cached blob without `color` self-heals on the next TTL
     write, default 10s, no manual flush needed).
   - `loadStatesMap()` becomes a thin wrapper:
     `const statesById = await this.machineConfigService.loadMachineStatesMap(); return new Map([...statesById.entries()].map(([id, s]) => [id, { name: s.name, color: s.color }]));`
3. Wire `MachineConfigService` into `calculations.module.ts`'s `providers` (it only depends
   on `PrismaService`, already provided there — don't import the whole `MachineModule`, that
   would needlessly pull in `ChannelMappingService`/`MqttChannelSource`/etc. into an
   HTTP-only module).

**Verify:** `cd node-server && npx tsc --noEmit -p tsconfig.json`. Before/after comparison:
save `curl /api/machine/{id}/overview`, `/api/machine/{id}/shift-breakdown`,
`/api/work-orders/{id}/detail` output pre-change, diff post-change — must be byte-identical
except timing. `redis-cli GET machine:states_map` — confirm the cached JSON includes `color`
after the first request post-deploy.

---

## Item 4 — Admin UI: designate a default state per machine

**Why now:** `MachineController::machineAssociate` already validates and persists
`default_state_id`/`is_default` — fully working, just unreachable. Every machine currently
has `is_default=false` on all tagged states, relying on the Inactive-name fallback
(`channel-mapping.service.ts`) instead of an explicit admin choice.

**Files:**
- `Frontend/src/app/modules/base-data-management/machine-management/machine-form/machine-form.component.ts` (+ `.html`)
- `Frontend/src/app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component.ts`
  (add a new exported radio-cell renderer alongside the existing ones in this file — this is
  where `AgGridBooleanCellRendererComponent`/`AgGridActionCellRendererComponent` already live,
  matches the module's own convention, no new file needed)
- `Frontend/src/app/shared/model/machineState.ts` (add `is_default?: boolean` for the
  edit-load read path)
- `Backend/app/Http/Controllers/MachineController.php` (one new lightweight GET endpoint)
- `Backend/routes/api.php` (register it)

**Confirmed gap to resolve, not hand-wave:** `machine-management.component.ts`'s edit-load
fetches the machine via OData with `expand: 'states,machinegroups,machinehalls'` — verified
this returns plain `MachineState` rows with **no pivot data** (`is_default` is not exposed;
Lodata doesn't surface `belongsToMany` pivot columns through a plain expand). So
pre-populating "which state is currently default" on edit-open needs a small dedicated
backend read, not a frontend-only fix:
- New route: `GET /api/machine/{id}/states` → `MachineController::machineStates($id)` →
  `$machine->states()->get()->map(fn($s) => ['id' => $s->id, 'is_default' => (bool) $s->pivot->is_default])`
  (the `states()` relation already has `->withPivot('is_default')` from this session's
  earlier work). Behind the same `auth:sanctum` group as `machine/associate`.
- `machine-form.component.ts`'s edit-load path calls this new endpoint after `setMachineState()`
  to populate `defaultStateId`.

**Cell renderer:** follow the existing `cellRendererParams` callback convention already used
by `AgGridActionCellRendererComponent` in this same file (a column passes
`cellRendererParams: { onSelect: (row) => this.onDefaultStateSelect(row) }`, the renderer
calls `this.params.onSelect?.(this.params.data)` on click) — simpler than plumbing through
`AgGridTableComponent`'s grid-level `context`, and needs no changes to the shared grid
wrapper itself. New renderer wraps a single `<ui5-radio-button name="defaultStateSelection">`
(same UI5 component already used elsewhere in this codebase, e.g. `attachment-upload.component.html`),
`checked` bound to `params.value`, emitting via the `onSelect` callback on `(change)`.

**`machine-form.component.ts` changes:**
- Add `defaultStateId: number | null = null;`.
- Add a `Default` column to `stateColumns` (after `is_active`, before `custom_id`):
  `valueGetter: (p) => p.data?.id === this.defaultStateId`, `cellRenderer:` the new radio
  renderer, `cellRendererParams: { onSelect: (row: MachineState) => this.onDefaultStateSelect(row) }`,
  `filter: false, sortable: false`.
- `onDefaultStateSelect(row)`: `this.defaultStateId = row.id ?? null; this.updateStateGrid();`
  (re-render so only one row shows checked — `updateStateGrid()` already exists for this
  purpose).
- `RemoveMachineState()`: if the removed row's `id === this.defaultStateId`, reset
  `this.defaultStateId = null` — a removed state can't stay the default (backend 422s on a
  `default_state_id` not in the submitted `machinestate` list).
- `setMachineState()` / edit-load: after fetching, call the new `machine/{id}/states`
  endpoint and set `this.defaultStateId` to whichever returned row has `is_default: true`
  (if any).
- `Associate()`: add `default_state_id: this.defaultStateId` to the posted payload.
- `resetForm()`: also reset `this.defaultStateId = null`.

**Scope guard:** don't touch the generic `AssosiateComponent` (shared multi-select dialog
used by both halls and states) — picking the default happens only in the resulting
`stateColumns` grid after association, keeping that shared dialog untouched and generic.

**Verify:** `npx tsc -p tsconfig.app.json --noEmit` + real `ng serve` build log. Browser:
edit a machine → States tab → associate 2-3 states → click the radio on one row → confirm
only one shows checked → Submit → check the network request body includes correct
`default_state_id` → reopen the same machine and confirm the default is pre-selected. Curl
check the 422 path: `POST machine/associate` with a `default_state_id` not in `machinestate`
→ expect 422 "default_state_id must be one of the assigned states" (already implemented,
just confirming it's still wired after the frontend change).

---

## Sequencing

Items 1-3 are pure perf/caching refactors, zero behavior change, safe to do first and
verify independently via before/after comparison. Item 4 is the only one with real
user-facing surface area (new endpoint + new UI control) — land it last, separately.

### Critical files
- `node-server/src/module/machine/runtime/channel-mapping.service.ts`
- `node-server/src/module/machine/runtime/machine-config.service.ts`
- `node-server/src/module/machine/runtime/machine-runtime.types.ts`
- `node-server/src/module/machine/machine-calculations.service.ts`
- `node-server/src/module/machine/work-order-detail.service.ts`
- `node-server/src/module/machine/calculations.module.ts`
- `Frontend/src/app/shared/services/machine-states.service.ts`
- `Frontend/src/app/modules/production-management/shared/components/machine-status-card/machine-status-card.component.ts`
- `Frontend/src/app/modules/base-data-management/machine-management/machine-form/machine-form.component.ts`
- `Frontend/src/app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component.ts`
- `Backend/app/Http/Controllers/MachineController.php`
- `Backend/routes/api.php`
