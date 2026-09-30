# Production Module — Full A-Z MES Enhancement Roadmap

## Context

Production Management today is a **real-time machine-monitoring + OEE dashboard**, not a full MES production suite. Three layers exist:

- **node-server** (NestJS/Prisma): live acquisition (MQTT/Modbus/API), machine state tracking, OEE calc endpoints. Actively developed, perf-tuned for scale (`node-server/src/module/machine/docs/CHANGES_2026_07_26_SCALE_TIERS_ABC.md`).
- **Backend** (Laravel/Lodata): WorkOrder CRUD, machine config CRUD, OData read surface. Two eras coexist — a Feb-2025 scaffold (`WorkOrderRouting`, `ProductionLine`, `QualityInspection`, `Operation`, `Capacity`, `Material`) that's pure empty stubs with zero wiring, and an actively-developed machine-tracking layer (2026).
- **Frontend** `@production-module`: board + `/mco` detail page, work-order execution tab, manual good/scrap logging, plus work-order *planning* CRUD (`production-plan-log/work-order-management` — moved here from `@base-data-module`).

Confirmed gaps (from docs + code, audited 2026-07-26):
- `machine_production_targets` has zero UI — Target always reads 0 (the single biggest documented gap).
- No Quality signal anywhere — `quality_inspections` stub, no defect entry, no reason codes, no NCR/disposition workflow.
- No BOM/material consumption at all (`work_order_routings` has no FK to `operations`, no material link) — confirmed via grep, zero hits for "bom".
- No downtime reason codes — `machine_state_events` records state transitions but never *why* a stop happened.
- No scheduling/capacity planning, no maintenance integration, no andon/alerting, no labor tracking, no traceability/genealogy, no scheduled reporting/export.
- **Live security gap**: `PermissionRegistry::getMap()` only maps `MarketPrices` — every other OData entity (`WorkOrders`, `Machines`, `QualityInspections`, `MachineProductionCounts/Targets`, etc.) is gated by auth only, not by the granular permissions already defined for them. Any authenticated user can create/update/delete work orders, machines, quality records via OData today.
- A **separate, unbuilt mill/textile domain** is already spec'd in `workflow.md` + `mes-implementation-plan.md` (raw cotton ledgers, waste tracking, shift/packing production, yarn transfer approval chain, monthly MIS) — extends `store-management`, not this module. Folded into this roadmap as Phase 12 per product decision.

This roadmap is implemented phase-by-phase across future sessions; order is re-prioritizable.

---

## Immediate flag (independent of phasing)

**Fix `PermissionRegistry::getMap()`** (`Backend/app/Services/PermissionRegistry.php`) to include `WorkOrder`, `Machine`, `Operation`, `QualityInspection`, `ProductionLine`, `Capacity`, `MachineProductionCount`, `MachineProductionTarget`, `MachineHasConfig` mapped to their existing `Permission` enum values. This is a live authorization hole, not a feature gap — fix first regardless of which phase gets picked up next.

---

## Phase sequencing (recommended order, re-orderable)

| # | Phase | Effort | Unlocks |
|---|-------|--------|---------|
| 1 | Foundation completion | S | Target UI, config fields — closes documented "biggest gap" |
| 2 | Downtime reason codes | S–M | Root-cause visibility on every non-productive minute already tracked |
| 3 | Quality management | M | Real Quality OEE factor, NCR/disposition workflow |
| 4 | Routing & BOM | M–L | Material consumption, real routing, prerequisite for traceability |
| 5 | Traceability & genealogy | M | Lot/batch trace, depends on Phase 4 |
| 6 | Scheduling & capacity planning | L | Gantt, finite-capacity, calendar |
| 7 | Maintenance integration | M | PM schedule, breakdown-from-andon |
| 8 | Andon / alerts & notifications | M | Real-time escalation, depends on Phases 2 & 7 |
| 9 | Labor & workforce | M | Operator assignment, labor efficiency |
| 10 | Advanced analytics & reporting | M–L | Dashboards, exports, Pareto, forecasting, TOC bottleneck |
| 11 | Mobile/tablet & offline resilience | M | Shop-floor UX, resilience |
| 12 | Mill/textile production domain | XL | Folded-in per existing workflow.md spec, phases 0–6 of `mes-implementation-plan.md` |
| 13 | Platform/scale hardening | M (ongoing) | Multi-plant, deferred node-server perf items already flagged in docs |

---

## Phase 1 — Foundation Completion (close existing documented gaps)

**Goal:** make what already exists actually work end-to-end.
- **Production Target UI**: form (target_qty, effective_from/to, per machine+WO+shift) writing to `machine_production_targets`. New Laravel controller/routes (model exists, empty). Frontend: new form under `base-data-module` or a tab on `/mco`, following existing `LogProductionEntryComponent` dialog pattern.
- **Machine config field gaps**: add `ideal_cycle_seconds`, `max_rpm/min_rpm/max_temp/min_temp` inputs to `machine-config` form in `base-data-management/machine-management`. Columns + OData exposure already exist — pure UI gap. Unlocks real Performance-factor OEE (currently null for almost all machines).
- **Fix telemetry field-overload bug**: `machine-board.component.ts checkStatus()` maps `T`→both `temp`/`hours`, `S`→both `rpm`/`load`. Needs real schema field for temperature (currently always 0 per node-server docs) — coordinate with node-server hardware/protocol fix, otherwise remove the misleading temp/rpm tiles until real sensor data exists.
- **Immediate security flag** (above) done here too.

## Phase 2 — Downtime Reason Codes & Pareto

**Goal:** turn `machine_state_events` from "what state, how long" into "what state, how long, *why*".
- New `downtime_reasons` lookup table (code, label, category: planned/unplanned, active flag) — same pattern as `machine_states` (admin-configurable, color/icon).
- Extend `machine_state_events` (or new `machine_state_event_reasons` join) with nullable `downtime_reason_id`, populated via operator prompt when a machine enters a non-`counts_as_productive` state for > configurable threshold (socket-driven prompt, mirrors existing `machine_status_runtime` event consumption in `MachineDurationService`).
- Reporting: Pareto chart (reuse `bar-chart` shared component) of downtime minutes by reason, per machine/hall/date-range — new tab or card in `/mco` Overview.
- Backend aggregation lives in node-server `machine-calculations.service.ts` (co-located with existing Availability calc which already reads `machine_state_events`).

## Phase 3 — Quality Management

**Goal:** replace the fake "100%" Quality tile with a real inspection/defect workflow.
- Wire the existing empty `QualityInspection` model: fillable fields, `belongsTo(WorkOrder)`, controller (store/index following `WorkOrderController`'s custom-REST pattern since Lodata alone won't cover workflow transitions).
- Add: defect reason codes (lookup, same admin-configurable pattern as `machine_states`/`downtime_reasons`), inspection checkpoint entry (operator or QC role), hold/quarantine flag on a production-count bucket, disposition workflow (rework/scrap/accept) with audit trail.
- Frontend: new "Quality" tab on `/mco` (peer to existing Overview/Work-Order tabs), defect entry dialog (reuse `LogProductionEntryComponent` dialog shell/pattern).
- node-server: Quality OEE factor already computed as `good/total` from `machine_production_counts` — extend to also read defect-detail table for a real reject-reason breakdown alongside the scrap count.
- Permission: gate behind new/existing `QUALITY_MGMT` permission enum value (already defined, unused).

## Phase 4 — Routing & BOM

**Goal:** real operation sequencing + material consumption (currently zero BOM concept in the codebase).
- Fix `work_order_routings`: add FK to `operations`, add `machine_id`/work-center assignment per step, per-step planned vs actual cycle time.
- Fix `operation_positions`: convert `product_id`/`machine_id` to real `foreignId` constraints (currently plain unconstrained ints despite the model declaring `belongsTo` relations).
- New `bill_of_materials` + `bom_lines` (product_id → component product_id, qty-per, uom) — net-new, no existing table to build on.
- Backflush: on `MachineController::logProductionCount` (or its node-server equivalent), deduct BOM-line quantities × good_count from a material stock table — requires a stock/inventory table (check `store-management` module first; likely reusable rather than net-new, confirm before building).
- This phase is a prerequisite for Phase 5 (traceability needs to know what materials went into what lot).

## Phase 5 — Traceability & Genealogy

**Goal:** lot/batch-level forward/backward trace.
- New `production_lots` (or reuse a WO+date+shift composite as the lot key if per-lot granularity isn't required — confirm with stakeholders before designing schema).
- Link `machine_production_counts` buckets to a lot; link consumed BOM materials (Phase 4) to the same lot.
- Forward trace (lot → where material went) / backward trace (finished lot → raw material batches consumed) reports.
- Depends entirely on Phase 4 landing first (BOM consumption is the data source for genealogy).

## Phase 6 — Scheduling & Finite Capacity Planning

**Goal:** move from "work orders exist" to "work orders are sequenced against real machine availability."
- `working_calendar` (holiday/shift exclusions) — already flagged as needed in the mill spec too, build once, share across both domains.
- Gantt-style scheduler UI (drag-drop resequencing) — new shared component, evaluate reusing AG Grid Enterprise's Gantt/timeline chart vs a dedicated lib (needs a design spike, flag as open decision).
- Finite-capacity check: given `machine_has_configs`/`ideal_cycle_seconds` (Phase 1) + `working_calendar`, warn on overcommit before confirming a WO's machine/shift assignment.
- Sits in `production-module/production-plan-log/work-order-management` (planning side) with read integration into `/mco`.

## Phase 7 — Maintenance Integration

**Goal:** connect machine state (`Maintenance`) to an actual maintenance workflow, per the repo's own forward-looking `node-server/src/module/machine/docs/MAINTENANCE_SCHEDULING_PLAN.md`.
- Preventive maintenance schedule (interval or usage-hour-based) per machine → auto-creates a maintenance work order, transitions machine to `Maintenance` state via existing `MachineStateTrackerService`.
- Breakdown maintenance request: manual trigger or Andon-originated (Phase 8), ticket lifecycle (open/assigned/resolved).
- Read `MAINTENANCE_SCHEDULING_PLAN.md` in full before designing — it may pre-empt parts of this phase.

## Phase 8 — Andon / Alerts & Notifications

**Goal:** push proactive signals instead of requiring someone to look at a dashboard.
- Threshold rules: downtime-in-state > X minutes (uses Phase 2 data), target miss projected by shift-end, quality-reject-rate spike, machine offline/`lastSeenAt` stale.
- Delivery: reuse existing Socket.IO (`to_frontend`/room pattern already in `machine.service.ts`) for in-app; new channel for email/push (check if a notification service already exists elsewhere in the repo before building one).
- Escalation chain (unacknowledged alert bumps to next role) — configurable, similar shape to the mill spec's `approval_chain_step`/`approval_log` engine (Phase 12) — worth designing once, reusing for both if timelines allow.

## Phase 9 — Labor & Workforce Management

**Goal:** tie a person to a machine/shift, measure labor efficiency alongside OEE.
- Operator-to-machine/shift assignment (new join table), referencing existing `Employee`/`EmployeeShift` models (already used by `machine_production_counts.shift_id` and the frontend's `getActiveShifts`).
- Labor efficiency metric: actual output vs standard (needs `ideal_cycle_seconds` from Phase 1).
- Skill matrix / certification-gated machine assignment — lower priority within this phase, stretch goal.

## Phase 10 — Advanced Analytics & Reporting

**Goal:** turn raw OEE/downtime/quality data into decision-grade output.
- Shift handover report, daily production report (PDF/Excel export) — check `Backend/app/Exports` for an existing export pattern before building new.
- Executive multi-hall/multi-plant dashboard (rollup of existing per-machine `/mco` data).
- Downtime Pareto (built in Phase 2) surfaced here as a first-class report, not just a card.
- Stretch/advanced: OEE trend + simple forecasting, bottleneck analysis (Theory of Constraints — identify the machine/step most often the schedule-limiting factor), sensor-trend anomaly detection — research-heavy, lower confidence on scope/effort until Phases 1–9 give clean underlying data.

## Phase 11 — Mobile/Tablet & Offline Resilience

**Goal:** shop-floor-usable UI, resilient to network blips.
- Tablet-optimized layouts for log-production/defect-entry dialogs (touch targets, larger tap zones) — `/mco` already responsive-aware per `layout/context.md`'s 1020px breakpoint, extend that pattern.
- Offline-tolerant entry: the mill spec (`workflow.md`) already descopes true offline sync (service worker/IndexedDB) as "materially bigger" and defaults to localStorage draft-save for v1 — apply the same descoping decision here unless full offline sync becomes a hard requirement.

## Phase 12 — Mill/Textile Production Domain (folded in)

**Goal:** build the already-spec'd raw-cotton/yarn-mill domain from `workflow.md` + `mes-implementation-plan.md`, as later phases of this same roadmap.
- Follow the existing phase-0-through-6 plan already written in `mes-implementation-plan.md` verbatim — it's already scoped, don't re-design.
- Core entities per that spec: `raw_cotton_lot`/`raw_cotton_daily_ledger`, `waste_type`/`waste_daily_ledger`, `shift_production`, `packing_production`, `yarn_transfer_advice(_line)`, `buyer`/`buyer_allocation`, `working_calendar` (shared with Phase 6), `monthly_mis_summary`, `approval_chain_step`/`approval_log` (generic state-machine, shared design opportunity with Phase 8's escalation chain).
- Extends `store-management`, not `production-management` — confirm module boundary/routing placement before starting.
- Open questions already flagged in the spec itself (count-conversion-factor table, costing method, reconciliation tolerance, buyer allocation granularity, role naming ambiguity) need client answers before implementation — do not guess these, they're explicitly marked unconfirmed in the source doc.

## Phase 13 — Platform / Scale Hardening (ongoing, cross-cutting)

**Goal:** keep the real-time layer correct as scope/scale grows.
- Items already identified but explicitly deferred in node-server docs: adaptive polling cadence, Redis-backed Socket.IO adapter (needed once >1 node-server instance), sharded acquisition tier, `machine_state_events` retention/archival strategy, Prisma `connection_limit` sizing (pending real pool-wait metrics), removal of the legacy dual-write `status` enum columns once the `machine_state_id` FK migration window closes.
- Multi-plant/multi-tenant considerations if this MES ever serves more than one physical site — currently single-tenant implicit throughout (no plant_id anywhere).
- Run the pending-but-unrun migration: `2026_07_26_000001_add_bucket_ended_at_index_to_machine_production_counts_table.php` (already written) — user runs it.

---

## Cross-cutting notes for every phase

- **Permissions**: every new entity needs its permission mapped in `PermissionRegistry::getMap()` from day one — don't repeat the current gap.
- **OData vs custom REST**: follow the established split — plain CRUD → Lodata OData; anything with workflow/pivot-sync/validation logic → custom Laravel controller (pattern: `WorkOrderController`, `MachineConfigController`).
- **Laravel vs node-server**: writes and simple CRUD stay in Laravel; range/aggregation-heavy reads co-locate in node-server next to the tables it already owns (pattern: `machine-calculations.service.ts`, `work-order-detail.service.ts`).
- **Admin-configurable lookups**: `downtime_reasons`, defect reason codes, etc. should follow the `machine_states` pattern (color/icon/active flag/admin CRUD screen) rather than hardcoded enums — this repo has explicitly moved away from hardcoded status enums once already (5-value → dynamic `machine_states`).
- **Frontend patterns to reuse, not reinvent**: `LogProductionEntryComponent` dialog shape for any new "operator logs something against a WO+shift" screen; `ag-grid-table` shared component for any new list/grid; `bar-chart`/`line-chart` shared wrappers for any new charts; root-singleton service pattern (`ProductionService`, `MachineDurationService`) for anything that must survive route navigation.

## Verification approach (once phases start landing)

- Each phase: `--pretend` migrations for user to review before running; `tsc --noEmit` / Angular build clean; manual smoke test of the new screen against a running dev instance.
- OEE-affecting phases (1, 2, 3): spot-check computed Availability/Performance/Quality against hand-calculated values from raw `machine_state_events`/`machine_production_counts` rows for one real machine.
- Security fix (permission map): verify with a low-privilege test user that a previously-open OData write now 403s.
