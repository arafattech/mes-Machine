# Production Module — Improvement Plan (All Tracks)

Companion to `production-module-roadmap.md` (feature roadmap), `oee-foundation-fixes-plan.md`, `wastage-management-plan.md`, and `MISSING_INPUTS.md`. Consolidates the concrete next improvements into one executable plan: **security → hygiene → foundation → wastage fast-follows → big features**, in dependency-safe order.

**Status of prior plans (verified against code 2026-08-16):**
- ✅ Production Target CRUD (`base-data-management/machine-management/machine-production-target/`)
- ✅ `ideal_cycle_seconds` end-to-end (`MachineConfigController.php:124`, `MachineHasConfig.php:26`, `MachineConfig.ts`, `machine-config.component.html:238`)
- ✅ Wastage logging + reporting (`machine_wastage_entries`/`allocations`, `WorkOrderController::logWastage`, node-server `wastage-detail`, `LogWastageComponent`, `WorkOrderDetailComponent` Wastage tab)
- ❌ `PermissionRegistry::getMap()` still maps only `MarketPrices` (live auth gap)
- ❌ Max/Min RPM & Temp form fields still absent (`machine-config.component.html`)
- ❌ Duplicate `production` route (`production-routing.module.ts:27-40`)

---

## Track B — Security fix (FIRST; live authorization hole)

**B1.** `Backend/app/Services/PermissionRegistry.php` — extend `getMap()` beyond `MarketPrices` to wire OData entity sets → existing `Permissions::*` enums: `WorkOrder`, `Machine`, `Operation`, `QualityInspection`, `ProductionLine`, `Capacity`, `MachineProductionCount`, `MachineProductionTarget`, `MachineHasConfig`.

- **Verification:** low-privilege user → previously-open OData write now 403s (roadmap's own check).
- **Docs:** update roadmap "Immediate flag" note.

---

## Track A — Code hygiene (low-risk, fast)

| # | Change | File |
|---|--------|------|
| A1 | Delete second duplicate `production` route (keep one) | `production-routing.module.ts` |
| A2 | `implements OnInit, OnDestroy`; full teardown via `takeUntilDestroyed`; remove dead `machines` field | `layout/layout.component.ts` |
| A3 | Type `hallList$`→`Observable<Hall[]>`, `machines$`→`Observable<Machine[]>` (consumers already typed) | `shared/services/production.service.ts` |
| A4a | Remove unused `tick` signal (or wire consumers to it) | `shared/services/machine-duration.service.ts` |
| A4b | Remove unused `runTime` input + its `[runTime]` binding | `machine-status-card.component.ts` + `machine-board.component.html` |
| A4c | Remove unused `OverviewTile`, `MachineData`, `SubItem` (grep first) | `shared/interface/interface.ts`, `shared/utils/types.ts` |
| A4d | Remove unused `BarChartComponent` imports | `store/purchese/sales` modules |
| A5 | Docs sync: document `production` route in route table; align group label ("Plan & Production Log" vs "Plans & Production Logs") | `module-overview/context.md`, `layout.component.ts` |

---

## Track C — Foundation completion (finishes roadmap Phase 1)

**C1.** Add Max RPM / Min RPM / Max Temp / Min Temp numeric inputs to `machine-config.component.html`, bound to existing `MachineConfig` fields. Backend + OData already ready. Closes `MISSING_INPUTS.md` #1.

**C2.** Telemetry field overload: `T`→`temp`+`hours`, `S`→`rpm`+`load` in `machine-board.component.ts checkStatus()`. Fix requires the real temperature schema from node-server (`docs/CONTEXT.md` §13); until then, hide the misleading tiles.

**C3.** ⚠️ **Open decision — Quality signal:**
- (a) Hardware reject-counter channel in node-server (`channel-mapping.service.ts` / `config_has_channels`) — automatic, per-machine PLC work.
- (b) Manual `quality_inspections` entry UI (table/model/OData exist, zero UI today) + blend into Quality calc in `node-server/.../machine-calculations.service.ts`.

Gates both Phase-1 Quality and Track D2 (Phase 3).

---

## Track E — Wastage fast-follows (self-contained, high value)

**E1.** `/mco` Wastage tile (`ProductionOverviewComponent`) — sum this machine's `machine_wastage_allocations` instead of (or alongside) `scrap_count`. **Confirm semantics first** — changes an existing tile's meaning (docs flag this).

**E2.** Fleet-wide Wastage Report — date-range Pareto by wastage type across all work orders. Read from node-server (new method in `work-order-wastage.service.ts` or a fleet endpoint in `CalculationsModule`); UI reuses `BarChartComponent` + `app-ag-grid-table`; entry point from `WastageLogListComponent` toolbar.

---

## Track D — Big features (sequence per roadmap dependencies)

| Ref | Roadmap Phase | Scope | Depends on |
|-----|---------------|-------|-----------|
| D1 | 2 — Downtime reason codes | `downtime_reasons` lookup (admin-configurable, `machine_states` pattern), nullable `downtime_reason_id` on state events, operator prompt on non-productive transition, Pareto chart in `/mco` Overview | — |
| D2 | 3 — Quality management | Wire `QualityInspection`, defect reason codes, hold/quarantine, disposition; Quality tab on `/mco` | **C3** |
| D3 | 4–5 — Routing/BOM + traceability | Fix `work_order_routings` FK → `operations`; `operation_positions` FKs; `bill_of_materials`+`bom_lines`; backflush on log; lot genealogy | D2 |
| D4 | 6 — Scheduling/capacity | `working_calendar` (shared w/ mill domain), Gantt scheduler (design spike), finite-capacity check | C1 (`ideal_cycle_seconds`) |
| D5 | 7–8 — Maintenance + Andon | PM schedule per `MAINTENANCE_SCHEDULING_PLAN.md`, maintenance WO auto-creation, alert escalation (reuse `Notification`) | D1 |
| D6 | 9–11 — Labor, analytics, mobile | operator→machine/shift join; PDF/Excel exports per `Backend/app/Exports`; tablet/offline UX | C1 |
| D7 | 12 — Mill/textile domain | Build `mes-implementation-plan.md` verbatim (extends `store-management`) | XL effort |
| D8 | 13 — Platform hardening | Redis socket adapter, retention/archival, drop dual-write `status` columns, run pending `bucket_ended_at` index migration (user runs) | ongoing |

---

## Suggested execution order

1. **B** → **A** → **C1** (quick wins, low risk, unblock config-driven OEE).
2. **E1** → **E2** (small, real business value).
3. **C3** decision → then **D1** → **D2** → **D3** → **D4** → **D5** → **D6**.
4. **D7** (mill domain) as its own large project; **D8** woven in continuously.

## Verification approach (every item)

- `--pretend` migrations for user review; user runs real migrations.
- `tsc --noEmit` + `ng build` clean for frontend; `php artisan route:list` unaffected where no new routes.
- OEE-affecting items (C, D1–D2): spot-check Availability/Performance/Quality vs hand-calculated values from raw `machine_state_events`/`machine_production_counts` for one real machine.
- Docs context files updated in the same task as each code change (`Frontend/CLAUDE.md` §12).

## Open decisions (block only where noted)

1. **C3** — Quality: hardware channel vs manual `quality_inspections` UI (gates D2).
2. **E1** — `/mco` Wastage tile semantics (replace or supplement `scrap_count`).
3. **D7** — confirm the mill domain is starting now vs later; module boundary (`store-management`).