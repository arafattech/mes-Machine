# Wastage Management for Production

## Context

`machine_wastage_types` (admin-configurable master) and `machine_has_wastage` (which types apply to which machine, same pattern as `machine_states`/`machinegroups`) already exist — built, CRUD'd in `base-data-management/machine-management/machine-wastage-type/`, wired onto `Machine::machinewastagetypes()`. Nothing consumes them yet. Today "wastage" on `/mco` (`ProductionOverviewComponent`'s tile) is just `machine_production_counts.scrap_count` — a single undifferentiated number per machine, entered manually via `LogProductionEntryComponent` (confirmed in `MISSING_INPUTS.md` gap #3/#4: no type breakdown exists anywhere, and the automatic node-server shot path always writes `scrap_count = 0` for hardware reasons — manual entry is the only real signal).

The requested feature: log total wastage **per type** against a **Work Order** (optionally narrowed to a shift and/or day), have it **auto-distribute across every machine on that WO which has that wastage type assigned**, proportional to each machine's share of output — then report it sliced by shift, by WO, by shift+WO, and by day+WO. This is a new capability, not an extension of the existing per-machine scrap field.

Confirmed with the requester:
- **Unit: kg** (decimal weight, not piece count) — distinct from `good_count`/`scrap_count`'s integer piece semantics.
- **Distribution: proportional to output share** (each eligible machine's share of `total_count` in that WO+date[+shift] scope), **falling back to equal split** when no production has been logged yet for that scope.
- Entry always anchors to a **Work Order** (needed to resolve "which machines") plus an always-present **date** and an **optional shift** — this combination is what yields all four requested reporting scopes (day+WO, shift+WO, WO-only via date range, shift-only via cross-WO query) from one fact table.

## Architecture

### 1. Schema — two new Laravel migrations

**`machine_wastage_entries`** — the ledger, source of truth for what a user actually typed. Append-only (matches this module's existing "always additive, never upsert" convention for `machine_production_counts`; corrections are new dated entries, not edits).
```
id                pk
work_order_id     foreignId -> work_orders (cascade)
wastage_type_id   foreignId -> machine_wastage_types (cascade)
shift_id          foreignId -> employee_shifts, nullable
entry_date        date
qty_kg            decimal(10,2)
created_by        foreignId -> users, nullable
timestamps
index (work_order_id, entry_date), index (wastage_type_id)
```

**`machine_wastage_allocations`** — the computed per-machine split, stored (not recomputed on read) so it's auditable and immediately usable by per-machine reporting without redoing the distribution math every query.
```
id                    pk
wastage_entry_id      foreignId -> machine_wastage_entries (cascade)
machine_id            foreignId -> machines (cascade)
allocated_qty_kg      decimal(10,2)
production_share      decimal(6,5), nullable   -- null when equal-split fallback was used
timestamps
unique (wastage_entry_id, machine_id)
```

Two tables, not one: keeps the user-entered total immutable and separate from the derived split — if the distribution formula changes later, only allocations regenerate, the ledger (source of truth) never does. Mirrors the mill-spec doc's own principle already in this repo (`work-order-and-log-production.md`'s ledger philosophy) even though this is a different domain.

After both migrations: `cd node-server && npx prisma db pull && npx prisma generate` (established convention — node-server's schema is pulled from Laravel's DDL, not owned separately).

### 2. Write path — Laravel (`Backend/app/Http/Controllers/WorkOrderController.php`)

New method `logWastage(Request $request, $id)`, placed alongside the existing `logProductionCounts` (same controller already owns work-order-scoped execution logging):

1. Validate: `wastage_type_id` (exists), `qty_kg` (numeric, `min:0.01`), `shift_id` (nullable, exists), `date` (required date).
2. Resolve eligible machines — machines assigned to this WO **and** carrying this wastage type:
   ```php
   $eligibleMachineIds = $workOrder->machines()
       ->whereHas('machinewastagetypes', fn ($q) => $q->where('machine_wastage_types.id', $validated['wastage_type_id']))
       ->pluck('machines.id');
   ```
   422 (`"No machine on this work order has this wastage type assigned."`) if empty — same guard shape as `logProductionCounts`'s machine-assignment check, don't create an orphaned ledger row with nothing to allocate to.
3. Compute each eligible machine's production share, scoped the same way `productionLogs()` already filters (`whereDate('bucket_started_at', date)`, optional `shift_id`):
   ```php
   $sums = MachineProductionCount::whereIn('machine_id', $eligibleMachineIds)
       ->where('work_order_id', $workOrder->id)
       ->whereDate('bucket_started_at', $validated['date'])
       ->when($validated['shift_id'] ?? null, fn ($q, $sid) => $q->where('shift_id', $sid))
       ->selectRaw('machine_id, SUM(total_count) as total')
       ->groupBy('machine_id')->pluck('total', 'machine_id');
   ```
   If `$sums` sums to 0 (no counts logged yet for that scope) → equal split (`1 / count($eligibleMachineIds)` each, `production_share = null`); otherwise `share = machine's total / sum of all totals`.
4. Allocate `qty_kg * share` per machine, rounded to 2dp; the last machine (by id order) absorbs the rounding remainder so allocations sum **exactly** to the entered `qty_kg` (never silently drift, matching the mill-spec reconciliation principle already documented elsewhere in this repo).
5. `DB::transaction()`: insert the `machine_wastage_entries` row, then one `machine_wastage_allocations` row per eligible machine.
6. Respond `{message, data: {entry, allocations}}`, `201`.

Route (`Backend/routes/api.php`, same `auth:sanctum` group as the neighboring work-order routes):
```php
Route::post('work-orders/{id}/wastages', [WorkOrderController::class, 'logWastage']);
```
Permission: reuse `Permissions::PRODUCTION_LOG` (same screen family as `logProductionCounts`) — no new permission enum needed.

Also add a small read helper for the frontend's type picker:
```php
Route::get('work-orders/{id}/eligible-wastage-types', [WorkOrderController::class, 'eligibleWastageTypes']);
```
`eligibleWastageTypes($id)` returns the distinct `machine_wastage_types` across the WO's assigned machines (`$workOrder->machines()->with('machinewastagetypes')->get()->pluck('machinewastagetypes')->flatten()->unique('id')->values()`) — deliberately a plain custom endpoint rather than relying on nested OData `$expand=machines.machinewastagetypes` (this app has already-confirmed Lodata expand quirks on adjacent entities; a 2-level nested expand isn't worth the risk for one small lookup).

### 3. Read path — node-server (aggregation, same split as `machine_production_counts`)

Per this module's own cross-cutting convention ("range/aggregation-heavy reads co-locate in node-server next to the tables it already owns" — see `work-order-detail.service.ts`), add to the existing `CalculationsModule`:

**`node-server/src/module/machine/work-order-wastage.service.ts`** (new, same shape as `WorkOrderDetailService`):
- `detail(workOrderId, {shiftId?, date?})` — reads `machine_wastage_entries` (optionally filtered by `shift_id`/`entry_date`) joined to `machine_wastage_allocations`, for one work order.
- Groups into: **by wastage type** (`{wastage_type_id, name, total_qty_kg, percent_of_wo_total}` — the "distributed by wastage types" + "overall calculation per type per work order" requirement), and **by type → machine** (each type's allocation rows) for drill-down.
- Same short-TTL `CacheAside` pattern as `WorkOrderDetailService.detail()` (Redis, ~8s TTL) — consistent with the rest of this module, avoids hammering the DB on repeat dashboard polling.

**`node-server/src/module/machine/work-order-wastage.controller.ts`**: `GET /api/work-orders/:id/wastage-detail?shift_id=&date=`.

Register both in `calculations.module.ts`'s `controllers`/`providers` arrays (same wiring as `WorkOrderDetailController`/`WorkOrderDetailService`) — no new module needed, this already is the "read-heavy calculation endpoints" module.

### 4. Frontend

**Model / interfaces** (`Frontend/src/app/modules/production-management/shared/interface/interface.ts`):
```ts
export interface WastageTypeBreakdown { wastageTypeId: number; wastageTypeName: string; totalQtyKg: number; percentOfTotal: number; }
export interface WastageAllocationRow { machineId: number; machineName: string; allocatedQtyKg: number; }
export interface WorkOrderWastageDetail { byType: WastageTypeBreakdown[]; allocationsByType: Record<number, WastageAllocationRow[]>; totalQtyKg: number; }
```

**Entry — new `LogWastageComponent`**, under `production-plan-log/Production-logs/log-wastage/` (sibling to `production-log-form/`, same "work-order-centric, not per-machine" family as `ProductionLogFormComponent` — reuse its dialog shell conventions: `w-[Nvw]` height-auto dialog, `ui5-busy-indicator`, explicit `w-full` on the immediate child per the documented sizing gotcha).

Fields: Work Order combobox (`WorkOrders?$filter=status ne 'cancelled'&$expand=product`, same source `ProductionLogFormComponent` already uses) → Wastage Type combobox (populated from the new `GET work-orders/{id}/eligible-wastage-types` once a WO is picked, disabled until then) → Shift combobox (optional, `MachineOverviewDataService.getActiveShifts()` reused, not duplicated) → Date picker (defaults today) → Qty (kg) `ui5-input type="Number"`. Submit calls a new `ProductionLogService.submitWastage(workOrderId, {wastageTypeId, shiftId, date, qtyKg})` → `POST work-orders/{id}/wastages`.

Opened via a new "Log Wastage" toolbar button on `ProductionLogListComponent`, next to the existing "Log Production" new-button (`toolbarConfig` already supports this shape per the `extraButton` convention documented in this repo's Angular rules) — same page, same permission gate (`Permissions.PRODUCTION_LOG`), no new sidebar entry needed.

**Reporting — new "Wastage" tab on `WorkOrderDetailComponent`** (`shared/components/work-order-detail/`), peer to the existing OEE tiles / progress bar / "Machines & Shifts" grid:
- `MachineOverviewDataService.getWorkOrderWastageDetail(workOrderId, {shiftId?, date?})` → new method hitting the node-server endpoint above, same 1:1-typed-response pattern as `getWorkOrderDetail()`.
- Bar chart (reuse shared `BarChartComponent`, per this module's "reuse bar-chart/line-chart wrappers, don't reinvent" convention) — qty_kg by wastage type.
- `app-ag-grid-table` breakdown grid (Type / Total Kg / % of Total), each row's info action (same pattern `ProductionLogListComponent` uses) drilling into that type's `allocationsByType` rows (Machine / Allocated Kg) in a small nested dialog — same "info icon → nested grid" idiom as `PRODUCTION_LOG_LIST_COMPONENT_CONTEXT.md`'s per-group drill-down.
- Optional shift/date filters at the top of the tab, wired to re-call `getWorkOrderWastageDetail` — gives the "per shift per WO" / "per day per WO" views directly from this same tab; the unfiltered call gives the plain "per WO" overall total.

### Deliberately out of scope for this phase (flag, don't build yet)

- **Per-machine "Wastage" tile** (`ProductionOverviewComponent` on `/mco`) still reads `scrap_count`, untouched here — wiring it to sum this machine's `machine_wastage_allocations` instead (or alongside) is a natural fast-follow once this ledger has real data, but changes an existing tile's meaning and deserves its own confirmation pass.
- **Cross-WO "Wastage Report" page** (fleet-wide, date-range, Pareto-by-type across every work order at once) — the "per shift" scope in isolation (not tied to one WO) really wants this rather than the WO Detail tab; natural Phase 2 once this ledger exists to query, deliberately not designed in detail here to avoid speculative schema for a page with no data yet.
- Editing/deleting a logged wastage entry — matches this module's existing append-only convention (corrections are new dated entries); not building an edit/delete UI now.

## Critical files

**Backend (Laravel)**
- `Backend/database/migrations/` — two new: `create_machine_wastage_entries_table`, `create_machine_wastage_allocations_table`
- `Backend/app/Models/MachineWastageEntry.php`, `MachineWastageAllocation.php` — new, `belongsTo(WorkOrder)`/`belongsTo(MachineWastageType)`/`belongsTo(EmployeeShift)` / `hasMany(MachineWastageAllocation)`+`belongsTo(Machine)` respectively
- `Backend/app/Http/Controllers/WorkOrderController.php` — add `logWastage`, `eligibleWastageTypes`
- `Backend/routes/api.php` — two new routes next to the existing `work-orders/{id}/...` group

**node-server**
- `node-server/src/module/machine/work-order-wastage.service.ts`, `work-order-wastage.controller.ts` — new
- `node-server/src/module/machine/calculations.module.ts` — register both
- After migrations: `npx prisma db pull && npx prisma generate`

**Frontend**
- `Frontend/src/app/modules/production-management/production-plan-log/Production-logs/log-wastage/` — new component
- `Frontend/src/app/modules/production-management/production-plan-log/Production-logs/production-log-list/*` — add "Log Wastage" toolbar button
- `Frontend/src/app/modules/production-management/shared/services/production-log.service.ts` — add `submitWastage`, `getEligibleWastageTypes`
- `Frontend/src/app/modules/production-management/shared/services/machine-overview-data.service.ts` — add `getWorkOrderWastageDetail`
- `Frontend/src/app/modules/production-management/shared/interface/interface.ts` — add the 3 interfaces above
- `Frontend/src/app/modules/production-management/shared/components/work-order-detail/*` — add "Wastage" tab
- **Docs (mandatory per `Frontend/CLAUDE.md` §12):** new/updated context files for `LogWastageComponent`, `ProductionLogListComponent`, `WorkOrderDetailComponent`, `ProductionLogService`, `MachineOverviewDataService` under `Frontend/docs/production-management/` in the same task as the code change — not a follow-up.

## Verification

- `php artisan migrate --pretend` on both new migrations — confirm generated SQL before the user runs them for real.
- `npx prisma db pull && npx prisma generate` in `node-server` — confirm both new models appear with expected columns/relations.
- Backend: `POST work-orders/{id}/wastages` via curl/Postman against a real WO with 2 machines that both have a shared wastage type and existing `machine_production_counts` rows — confirm allocations sum exactly to `qty_kg` and split matches each machine's actual output share; repeat against a WO with zero production counts logged yet — confirm equal split; repeat with a wastage type no assigned machine has — confirm 422.
- Frontend: `tsc --noEmit` clean, Angular build clean. Manual smoke test: open "Plan & Production Log" → "Log Wastage", pick a WO, confirm the type dropdown only shows types actually assigned to that WO's machines, submit, then open that WO's Work Order Detail "Wastage" tab and confirm the breakdown/chart matches what was just submitted, including the shift/date filters narrowing correctly.
- Regression check: existing `LogProductionEntryComponent`/`ProductionLogFormComponent` flows and `/mco`'s existing Wastage tile remain fully untouched (this phase is additive only).
