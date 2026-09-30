# PRODUCTION_SERVICE — Service Context

## Overview

| Property | Value |
|---|---|
| **File** | `shared/services/production.service.ts` |
| **Class** | `ProductionService extends CommonService` |
| **Provided in** | `root` (singleton) |
| **Resource** | `productions` (declared `protected resource`, inherited from `CommonService` base contract — not directly used by any method here since both methods build explicit paths) |
| **Purpose** | Loads and caches the hall list and the currently-selected machine list, exposed as `BehaviorSubject`-backed observables |

---

## Public API

| Member | Type | Purpose |
|---|---|---|
| `isLoading` | `boolean` | True while `loadHallList()` request is in flight |
| `isMachinesLoading` | `boolean` | True while `loadMachines()` request is in flight |
| `hallList$` | `Observable<any[]>` | Emits the current hall list |
| `machines$` | `Observable<any[]>` | Emits the current machine list (all or hall-filtered) |
| `loadHallList()` | `void` | `GET Halls?$expand=machines&$filter=is_active eq true or is_active eq 1` |
| `loadMachines(type: string \| number)` | `void` | `'all-machines'` → `GET Machines?$filter=...&$expand=machinegroups,machinehalls`; else → `GET Halls(${type})/machines?$filter=...&$expand=machinegroups,machinehalls` |
| `refreshHallList()` | `void` | Alias for `loadHallList()` |

---

## Lifecycle
Constructor calls `loadHallList()` immediately — hall data starts loading the moment the service is first injected anywhere in the app (root singleton, so effectively at first navigation into any route that injects it, typically `LayoutComponent`).

---

## Response Unwrapping Pattern
Both `loadHallList()` and `loadMachines()` use `response?.value || response` — tolerates either a raw OData `{value: [...]}` envelope or a bare array, defends against an unexpected response shape without throwing.

## Error Handling
Both methods reset the relevant `BehaviorSubject` to `[]` on error and log via `console.error` — no user-facing error surface (no toast). Consistent across both methods.

---

## Consumers

| Consumer | Uses |
|---|---|
| `LayoutComponent` | `hallList$` (sidenav build), `loadMachines()` (nav click), `isLoading` (busy indicator) |
| `MachineBoardComponent` | `machines$`, `hallList$` (hall combobox in Full-Screen mode), `loadMachines()` (once on `ngOnInit` mount — refetches so revisiting the route without a full browser reload gets current data — and again on hall combobox change), `isMachinesLoading` |

---

## Known Gaps
- `$expand=machinegroups,machinehalls` was added to both `loadMachines()` branches specifically to populate `Machine.machinegroups[]`/`Machine.machinehalls[]` for `machine-status-card`'s (currently disabled/commented) location badges and any future consumer needing hall/group membership — confirm the nested-nav-path expand (`Halls(id)/machines?$expand=...`) still resolves correctly through lodata if touching this.
- `hallList$` / `machines$` typed `Observable<any[]>` rather than `Observable<Hall[]>` / `Observable<Machine[]>` despite both models existing under `@shared/model/*` and being the actual runtime shape consumed downstream — tightening these types is a safe, non-breaking cleanup.
- `resource = 'productions'` is declared (required by the `CommonService` base class contract) but never referenced by either method — both build their OData paths as string literals instead.
- No caching/dedup — every `loadMachines()` call issues a fresh HTTP request even if the same `type` was just requested (e.g. rapid hall-switch clicks).
