# OEE Foundation Fixes — Performance & Production Target

## Post-implementation notes (2026-08-02, live browser verification)

Both fixes built and verified against the running dev stack (`ng serve` + RoadRunner + node-server), not just `tsc`/`ng build`:

- **Production Target CRUD**: created a real row (Ring 25, target 500, effective 2026-08-02) via the new UI — `POST /odata/MachineProductionTargets` succeeded, grid re-read it back with `$expand=machine` resolving the machine name correctly. Confirms the `discoverRelationship()` additions work.
- **`ideal_cycle_seconds`**: entering a value and saving returned "Edited successfully" with no error, **but the value did not persist** — re-opening the edit dialog showed the field empty again. Root cause: `App\Models\MachineHasConfig::$fillable` never listed `ideal_cycle_seconds`, so Eloquent's mass-assignment silently dropped it even though the controller's validation accepted it. **Fixed** by adding it to `$fillable` (`Backend/app/Models/MachineHasConfig.php`). This app's Laravel runs under RoadRunner, which does not hot-reload — the fix requires an `rr` restart (not performed here, per this repo's own dev-environment convention of the user managing long-running processes) before Performance will actually read a non-null value end-to-end.
- Also caught two unrelated frontend display bugs while testing the "Wastage by Type" section built earlier this session (not part of this plan's own scope, but adjacent code touched during testing): `<app-bar-chart>` was missing its `title` input (rendered the literal placeholder text "Chart Title" — the component's own template does render it, contrary to what its context doc claimed) and the shift/date filter's "Clear" button set `wastageFilterDate` to `null`, which `ui5-date-picker`'s `[(ngModel)]` displayed as the literal text "undefined" instead of leaving the field empty. Both fixed (real title text; empty-string sentinel instead of `null`).

## Context

Audited current OEE calc state (2026-08-02, fresh read of `node-server/src/module/machine/machine-calculations.service.ts` + `work-order-detail.service.ts`):

- **Availability**: real today — `active_seconds/total_seconds` from `machine_state_events`, driven by admin-configurable `machine_states.counts_as_productive`. No work needed.
- **Performance**: formula is already correct (`min(100, total_count*ideal_cycle_seconds/active_seconds*100)`) but reads `null` for every machine because `machine_has_configs.ideal_cycle_seconds` (column exists, migration `2026_07_07_100000_...`) has **no path to ever be set** — missing from `MachineConfigController::validatePayload()`'s accepted fields, missing from the `MachineConfig` frontend model, missing from `machine-config.component.html`'s form. Pure UI/validation gap, zero calc-logic work.
- **Target**: `machine-calculations.service.ts` already reads the currently-effective `machine_production_targets` row correctly — but nothing has ever written a row there. No Laravel controller, no frontend form/service reference anywhere. `MachineProductionTarget` **is** already Lodata-discovered (`AppServiceProvider.php:179`), just missing `discoverRelationship()` calls (unlike its neighbor `MachineProductionCount`, lines 176-178) and a UI.
- **Quality**: real math (`good/total` from `machine_production_counts`), sourced from manual operator entry (`LogProductionEntryComponent`) since there's no reject-sensor hardware. **Per your decision: keep as-is, no changes** — this plan does not touch Quality.
- **Efficiency**: `availability × performance × quality`, already correct — will start reading real values automatically once Performance is unblocked (Quality/Availability are already real).

Explicitly out of scope for this plan (confirmed with you): fleet-wide/plant-wide KPI dashboard (none exists today — `production-dashboard` component dir is empty, no rollup service) and any Quality/scrap-signal change. Two additional pre-existing issues surfaced during the audit, flagged but **not** fixed here since they're unrelated to Performance/Target: `PermissionRegistry::getMap()` still only maps `MarketPrices` (live authorization gap on every other OData entity, already flagged in the module's own roadmap doc as "fix first regardless of phase" — separate task); `machines.oee` static column is fully dead (never read/written anywhere) — candidate for dropping later, not touched here.

## Fix 1 — Wire `ideal_cycle_seconds` into the machine config form

**Backend** (`Backend/app/Http/Controllers/MachineConfigController.php::validatePayload()`, ~line 120, alongside `max_rpm`/`min_rpm`): add
```php
'ideal_cycle_seconds' => ['nullable', 'numeric', 'min:0'],
```
No migration needed — column already exists.

**Frontend model** (`Frontend/src/app/modules/base-data-management/shared/model/MachineConfig.ts`): add `ideal_cycle_seconds?: number;` field (currently absent from the class entirely, unlike `max_rpm` which is at least a hidden grid column — this one has zero frontend representation).

**Frontend form** (`Frontend/.../machine-management/machine-config/machine-config.component.html`): add one `ui5-input type="Number" [(ngModel)]="machineConfig.ideal_cycle_seconds"` next to "Timeout (sec)"/"Server Call (sec)" in the existing "Timers and Type Selection row" (~line 208) — same card, same row, identical binding pattern already used for `shot_buffer`/`timeout_sec`/`server_call_sec`. No new card/section needed.

That's the entire fix — three small, isolated edits, no new component, no route change.

## Fix 2 — Production Target entry UI (new CRUD, mirrors `machine-wastage-type` exactly)

`machine_production_targets` schema (`machine_id`, nullable `work_order_id`/`shift_id`, `target_qty`, `effective_from`, `effective_to` nullable, `is_active`) is already shaped for **explicit manual entry** (not a WO-quantity-prorated derivation) — confirmed by the table's own migration comment and the fact `target_qty`/`effective_from`/`effective_to`/`is_active` only make sense as directly-entered fields. Builds a plain OData CRUD screen, same shape as the recently-built `machine-wastage-type` feature (`MachineWastageTypeListComponent`/`MachineWastageTypeFormComponent`, `base-data-management/machine-management/machine-wastage-type/`) — that one already proves plain Lodata OData (auto POST/PUT/DELETE off `Lodata::discover()`, no custom controller) is this repo's established pattern for simple CRUD with no workflow logic.

**Backend — no new controller, just relationship exposure** (`Backend/app/Providers/AppServiceProvider.php`, right after line 179's `Lodata::discover(MachineProductionTarget::class)`):
```php
Lodata::getEntitySet('MachineProductionTargets')->discoverRelationship('machine');
Lodata::getEntitySet('MachineProductionTargets')->discoverRelationship('workOrder');
Lodata::getEntitySet('MachineProductionTargets')->discoverRelationship('shift');
```
Mirrors `MachineProductionCounts`' own 3 lines immediately above it. `MachineProductionTarget` model already has all 3 `belongsTo` relations (`Backend/app/Models/MachineProductionTarget.php`) — nothing to add there.

**Frontend — new folder** `base-data-management/machine-management/machine-production-target/{machine-production-target-list, machine-production-target-form}/`, copying `machine-wastage-type`'s two components field-for-field in structure:
- New model `Frontend/src/app/shared/model/machineProductionTarget.ts` (same `Deserializable`/`toOdata()` shape as `machineWastageType.ts`): `id`, `machine_id`, `machine_name?` (display-only, populated from `$expand=machine`), `work_order_id?`, `shift_id?`, `target_qty`, `effective_from`, `effective_to?`, `is_active`.
- **List** (`MachineProductionTargetListComponent`): `dataSource: {type:'odata', endpoint:'MachineProductionTargets', expandQuery:'machine,workOrder,shift'}`, columns Active / Machine / Work Order / Shift / Target Qty / Effective From / Effective To — same `AgGridBooleanCellRendererComponent` for Active, same toolbar/new-button-permission pattern as `MachineWastageTypeListComponent`.
- **Form** (`MachineProductionTargetFormComponent`): Machine combobox (required, reuse whatever machine-picker source `machine-config.component.ts` already uses for `Machines`), Work Order combobox (optional, `WorkOrders?$filter=status ne 'cancelled'`, same query already used in `ProductionLogFormComponent`), Shift combobox (optional, `EmployeeShifts?$filter=is_active eq true`), Target Qty number input (required), Effective From / Effective To date pickers, Active switch. `AddProductionTarget()` posts/puts to `MachineProductionTargets`/`MachineProductionTargets(${id})` via `commonService.post/put(url, model.toOdata(), true)` — identical to `MachineWastageTypeFormComponent.AddWastageType()`.

**Permission** (new group, matching `BASE_DATA_MACHINE_WASTAGE_TYPE*`'s exact shape):
- `Frontend/src/app/shared/enums/permissions.ts`: `BASE_DATA_MACHINE_PRODUCTION_TARGET`, `_LIST`, `_CREATE`, `_EDIT`, `_DELETE`.
- `Backend/database/seeders/PermissionSeeder.php`: same 5 strings, same `BASE_DATA` group, next to the existing `MACHINE_WASTAGE_TYPE` block (~line 166).

**Routing + sidebar**:
- `base-data-management-routing.module.ts`: new route `machine-production-target` → `MachineProductionTargetListComponent`, guarded by `Permissions.BASE_DATA_MACHINE_PRODUCTION_TARGET` — same shape as the `machine-wastage-type` route (~line 216).
- `base-data-management.module.ts`: declare both new components.
- `base-data-management-layout.component.ts` (~line 199, same "Machine Management" `subItems` array `machine-wastage-type` already sits in): new sidebar item "Machine Production Target" → `machine-production-target`.

## Critical files
- `Backend/app/Http/Controllers/MachineConfigController.php` — 1-line validation addition
- `Backend/app/Providers/AppServiceProvider.php` — 3-line relationship discovery addition
- `Backend/database/seeders/PermissionSeeder.php` — 5-line permission addition
- `Frontend/src/app/modules/base-data-management/shared/model/MachineConfig.ts` — add `ideal_cycle_seconds`
- `Frontend/.../machine-management/machine-config/machine-config.component.html` — 1 new input
- `Frontend/src/app/shared/model/machineProductionTarget.ts` — new model
- `Frontend/.../machine-management/machine-production-target/` — 2 new components (list + form), copying `machine-wastage-type`'s exact shape
- `Frontend/src/app/shared/enums/permissions.ts`, `base-data-management-routing.module.ts`, `base-data-management.module.ts`, `base-data-management-layout.component.ts` — wiring, each a small addition next to the existing `machine-wastage-type` entry

## Verification
- Backend: `php artisan route:list` unaffected (no new custom routes — pure OData); hit `POST /odata/MachineProductionTargets` directly (curl) with a real `machine_id`, confirm 201 and the row appears via `GET /odata/MachineProductionTargets?$expand=machine,workOrder,shift`.
- Frontend: `tsc --noEmit` clean, `ng build --configuration=production` clean. Manual: open Base Data → Machine Management → "Machine Production Target", create one row for a real machine with `effective_from` = today, `target_qty` = e.g. 500; open Base Data → Machine Management → "Machine Configuration", edit a machine, set Ideal Cycle (sec) to a real value, save.
- End-to-end: open that machine's `/mco` page (or hit `GET /api/machine/{id}/overview` directly) and confirm Target and M/C Performance now read real non-zero numbers instead of 0/null — cross-check Performance by hand: `total_count * ideal_cycle_seconds / active_seconds * 100`.
- Run `php artisan db:seed --class=PermissionSeeder` (or the full seeder) yourself to grant the new permission to relevant roles — not run automatically here.
