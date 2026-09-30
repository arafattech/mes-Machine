# Store & Production MES — Implementation Plan

Companion to `workflow.md` (the spec). This doc maps each spec section to concrete
backend/frontend deliverables, phased per the spec's own section 10 ordering, refined
against this codebase's actual conventions.

**Module home:** extends the existing `store-management` module (new subfolders + sidebar
entries + routes) rather than a new top-level module — keeps procurement and mill-floor
operations under one existing shell.

## Conventions this plan follows

| Concern | Existing pattern reused | Applied here |
|---|---|---|
| New domain namespace | `Store/`, `Purchase/`, `IotMonitor/` under Models/Controllers/Services/Enums | New `MillProduction/` namespace throughout backend |
| Simple master CRUD, zero controller | `Capacity` model + `HasCustomId`, `Lodata::discover(Capacity::class)` | `RawCottonLot`, `WasteType`, `Buyer`, `CountConversionFactor`, `CountBagWeight`, `ApprovalChainStep` |
| CRUD needing business logic | `Store\RequisitionController` (thin) → `Services\Store\RequisitionService` (fat, transactional) | Ledger entry, packing entry, transfer advice, approval advance, month-close |
| Audit / ID generation | `HasCustomId` trait | Every new model |
| Frontend module home | Existing `store-management` module (`store-layout.component.ts`, `store-management-routing.module.ts`, `store-management.module.ts`) | **Extended**, not replaced — new feature folders + sidebar entries + routes added here |
| Grid + create/edit dialog | `capacity-management/capacity-list` + `capacity-form` (`app-ag-grid-table`, `ui5-dialog`, `saveMode` POST/PUT) | Every master/grid screen |
| Excel export | `excel-import-export.component.ts` + `Backend/app/Exports/AttendanceExport.php` pattern | MIS report + ledger exports |
| PDF export | `Store\MaterialReceiptController::generatePdf` + `resources/views/pdf-templates/*.blade.php` (dompdf, already installed) | 4 of the 5 printable reports |
| Permission gating | `RolePermissionService.hasPermission('X')`, seeded via `PermissionSeeder.php` grouped array | New `MILL_*` permission group |
| Roles | `RoleSeeder.php` (`super-admin, admin, accountant, user, employee, sales-head, sales-person`) | Add `hod`, `gm`, `director`, `store-incharge`, `store-officer` |

---

## Phase 0 — Scaffolding

**Backend:** new dirs `Backend/app/{Models,Http/Controllers,Services,Enums}/MillProduction/`.
Extend `RoleSeeder.php` with the 5 new roles. New `MillProductionPermissionSeeder.php` (or a
new group inside `PermissionSeeder.php`) for all permissions listed per phase below.

**Frontend:** no new top-level module. Inside the existing `store-management` module:
- New feature folders: `raw-cotton/`, `waste-tracking/`, `shift-production/`, `packing-production/`,
  `yarn-transfer/`, `buyer-allocation/`, `monthly-mis/`, `mill-settings/` — each following the
  existing sibling folder shape (`item-inventory/`, `local-material-receipt/`, etc.), i.e. flat
  `<feature>-list` + `<feature>-form` component pairs, not `-management` suffixed.
- Add routes for each into the existing `store-management-routing.module.ts`.
- Add sidebar entries into the existing `store-layout.component.ts`'s `sidebarMenu` array
  (new group, e.g. "Mill Production").
- Declare new components in the existing `store-management.module.ts`.
- `Frontend/src/app/shared/enums/permissions.ts` — new `MILL_*` block.
- `Frontend/src/app/shared/model/mill-production/` — new folder for Deserializable model
  classes (mirrors `@shared/model/capacity.ts`).

**Verification:** confirm new sidebar entries appear under the existing Store Management
nav, gated by a placeholder permission granted only to `super-admin` initially; empty list
screens render without console errors.

---

## Phase 1 — Schema + core ledgers (spec 3.1–3.4, formulas 5.1–5.2, carry-forward constraint)

### Migrations
| Table | Notes |
|---|---|
| `raw_cotton_lots` | Per 3.1 + `is_active`, `custom_id`. `avg_wt_per_bale_kg` computed in service, not a DB generated column (portable, testable, divide-by-zero-guarded). |
| `raw_cotton_daily_ledgers` | fk `lot_id` cascade, 3.2 fields, `unique(['lot_id','ledger_date'])`, `is_locked` boolean (flips true once a later day's ledger depends on this row's closing — enforces append-only per spec section 11). Add `weight_gain_reason`/`tare_adjustment_reason` nullable strings (required-if-nonzero, per alert list section 8 — not in the spec's literal table but needed to satisfy its own alert). |
| `waste_types` | `id, name, is_active, custom_id`. Seed the 11 names from 3.3. |
| `waste_daily_ledgers` | fk `waste_type_id`, 3.4 fields, `unique(['waste_type_id','ledger_date'])`, `is_locked`, `weight_gain_loss_reason` nullable. |

### Models (`Backend/app/Models/MillProduction/`)
`RawCottonLot` (`HasCustomId`, `hasMany(RawCottonDailyLedger)`), `RawCottonDailyLedger`
(`belongsTo(RawCottonLot)`), `WasteType` (`HasCustomId`, `hasMany(WasteDailyLedger)`),
`WasteDailyLedger` (`belongsTo(WasteType)`).

### OData vs custom REST
- `RawCottonLot`, `WasteType`: **pure OData CRUD** (`Capacity` pattern) — `Lodata::discover(...)`
  in `AppServiceProvider.php`, no controller.
- `RawCottonDailyLedger`, `WasteDailyLedger`: **OData for reads (grids/exports), custom REST
  for writes.** Writes must: auto-populate `opening_*` from the prior day's `closing_*`
  (never user-entered — this **is** the carry-forward constraint), compute `closing_*` per
  formula 5.1/5.2, require a reason code when gain/loss/tare ≠ 0, and refuse writes to
  `is_locked` rows. Register entity sets read-only in Lodata (`setInsertable(false)` etc. —
  confirm exact method names against the installed `flat3/lodata` version).
  - `RawCottonLedgerController::store()` → `RawCottonLedgerService::createEntry()` (thin/fat
    split, mirrors `RequisitionService`): look up prior row, hard-fail if caller's `opening_*`
    doesn't match prior `closing_*`, validate reason codes, compute closing, persist, lock the
    previous row.
  - `WasteLedgerController` → `WasteLedgerService::createEntry()`, same shape for formula 5.2.

### Angular (under `store-management/raw-cotton/`, `store-management/waste-tracking/`)
- `raw-cotton-lot-list` + `raw-cotton-lot-form` — `capacity-management` pattern verbatim
  against OData `RawCottonLots`.
- `waste-type-list` + `waste-type-form` — same, against `WasteTypes`.
- `raw-cotton-ledger-entry` — dedicated form (not grid-inline-edit): pick lot+date, shows
  `opening_*` read-only (fetched from latest prior row), fills received/issued/delivered/
  gain/loss/tare, reason-code input conditionally required client-side (mirrors server
  rule), submits via `commonService.post('mill-production/raw-cotton-ledger', payload, false)`
  (REST, third arg `false`).
- `raw-cotton-ledger-grid` — read-only `app-ag-grid-table` on OData `RawCottonDailyLedgers`,
  feeds report #1 (section 4).
- `waste-ledger-entry` + `waste-ledger-grid` — same shape for waste, feeds report #2.

**Permissions:** `MILL_RAW_COTTON_LOT_LIST/CREATE/EDIT/DELETE`,
`MILL_RAW_COTTON_LEDGER_LIST/CREATE`, `MILL_WASTE_TYPE_LIST/CREATE/EDIT/DELETE`,
`MILL_WASTE_LEDGER_LIST/CREATE`.

### Verification
1. Lot with 100 bales / 21,500kg → `avg_wt_per_bale_kg = 215.0`.
2. Day-1 ledger (received only) → correct closing, opening=0 (first row).
3. Day-2 ledger → opening auto-fills from day-1 closing; tampering with opening is rejected.
4. Non-zero `weight_gain_kg` with no reason → blocking 422.
5. Edit day-1 after day-2 exists → rejected (`is_locked`).
6. Repeat 1–5 for waste against formula 5.2.

---

## Phase 2 — Production & packing (spec 3.5–3.6, formulas 5.3, 5.5)

### Migrations
| Table | Notes |
|---|---|
| `shift_productions` | 3.5 fields, `section` enum, `unique(['production_date','section'])`. `day_total_kg` as a MySQL **stored generated column** (`rc+ra+rb`, no cross-row dependency, safe to compute in DB here unlike Phase 1's ledgers). |
| `packing_productions` | 3.6 fields. `count_name` varchar + nullable `product_id` FK (see decision below). `per_bag_kg` sourced from `count_bag_weights`, not hardcoded. `bag_count` computed server-side, integer-only enforced. |
| `count_bag_weights` | Answers open question 1 without guessing: `id, count_name (unique), per_bag_kg, effective_from`. Seeded to 50kg default; per-count override ready but hidden in UI until client confirms it's needed. |

**Decision point (flag in doc, confirm before this phase):** each distinct yarn count
(e.g. "34/1 KH") = a row in the existing `products` table, reusing existing product CRUD,
rather than a new "count master" table. `packing_productions`/`yarn_transfer_advice_line`/
`buyer_allocations` keep `count_name` as denormalized varchar (matches paper source exactly)
**plus** optional `product_id` for reporting joins — nullable at first so entry isn't blocked.

### Models
`ShiftProduction` (`HasCustomId`), `PackingProduction` (`HasCustomId`, optional
`belongsTo(Product)`), `CountBagWeight` (`HasCustomId`).

### OData vs REST
- `ShiftProduction`, `CountBagWeight`: **pure OData CRUD**.
- `PackingProduction`: **custom REST** — `PackingProductionController` →
  `PackingProductionService::createEntry()` looks up `per_bag_kg`, computes `bag_count`,
  throws blocking 422 if non-integer (implements section 8's alert directly, not silent
  rounding).

### Angular (`store-management/shift-production/`, `store-management/packing-production/`)
- `shift-production-entry` — simple multi-row form, one row per section.
- `shift-production-grid` — OData read, feeds report #3 alongside Phase-1 ledger snapshots.
- `packing-production-entry` — posts to REST endpoint, shows server-computed `bag_count`
  (never client-trusted).
- `packing-production-grid` — OData read.
- `count-bag-weight-list/form` — small admin config screen, `capacity-management` pattern.

**Note on section 11's "offline-tolerant shift-floor entry":** descope to a simple
localStorage draft-save before submit for v1; true offline sync (service worker + IndexedDB
queue) is a materially bigger addition — flag separately if the client insists on it.

**Permissions:** `MILL_SHIFT_PRODUCTION_LIST/CREATE/EDIT`, `MILL_PACKING_PRODUCTION_LIST/CREATE`,
`MILL_COUNT_BAG_WEIGHT_LIST/CREATE/EDIT`.

### Verification
1. Carding month total 578,705kg / 30 working days → `avg_kg_per_day = 19,290.17`. Finished
   Yarn: 545,068.51 / 30 → `18,168.95`.
2. Packing: 1350→27 bags, 1500→30, 7450→149, 500→10, 8200→164 — exact, no rounding.
3. Non-divisible `production_kg` (e.g. 1351/50) → blocking 422.

---

## Phase 3 — Yarn transfer & approvals (spec 3.7, formula 5.4, section 7, serial-continuity)

This phase builds the **generic approval-chain engine** every later approvable document reuses.

### 3A. Generic approval-chain engine

**`approval_chain_steps`** (config): `id, document_type, step_order, role, step_name,
is_active`, `unique(['document_type','step_order'])`. Seeded via
`ApprovalChainStepSeeder.php` encoding section 7's table:
- `YARN_TRANSFER_ADVICE`: 1=preparer(no role gate), 2=hod, 3=store-incharge, 4=gm.
- `DAILY_WASTAGE_REPORT`: 1=store-officer, 2=?("M(Store)" — **confirm**: same as
  `store-incharge` or a distinct "store-manager" role?), 3=gm, 4=director.
- `DAILY_SHIFTWISE_PRODUCTION_REPORT`: 1=store-manager, 2=gm, 3=director.
- `MONTHLY_MIS`: 1=gm, 2=director (plus: only generatable once all daily ledgers for the
  month are fully approved — enforced in Phase 5's MIS service, not here).

**`approval_logs`** (transaction, per spec 3.11 exactly): `id, document_type, document_id,
role, user_id, action(submitted/approved/rejected/received), timestamp, comment`.
Append-only, no `updated_at`.

**`ApprovalService`** (`Backend/app/Services/MillProduction/ApprovalService.php`):
`currentStep()`, `canAct()`, `advance()` (transactional, writes `approval_log` row, updates
document status; rejection sends the document back to draft for correction, matching
"corrections after lock need a new dated adjustment entry").

**`ApprovalController`** (one generic controller for all document types):
`POST mill-production/approvals/{documentType}/{documentId}/act`,
`GET mill-production/approvals/{documentType}/{documentId}/history`. Not OData — pure
state-machine logic, same reasoning as `RequisitionController::approveRequisition`.

**Angular shared pieces:**
- `Frontend/src/app/shared/services/approval.service.ts` — wraps the two REST endpoints +
  `getConfiguredChain(documentType)` against a read-only OData `ApprovalChainSteps` set.
- `Frontend/src/app/shared/components/approval-action/approval-action.component.ts` —
  `@Input()` documentType/documentId/currentStatus; shows Approve/Reject/Receive only if the
  user holds a **permission** for that step (e.g. `MILL_YARN_TRANSFER_APPROVE_HOD`) — reuses
  `RolePermissionService`, gates on permission strings not raw role names, consistent with
  the rest of the app.
- `approval-history-timeline` component — reusable read-only audit view of `approval_logs`.

### 3B. Yarn transfer advice
`yarn_transfer_advices` (header, `status` enum draft/hod_approved/store_received/
gm_approved/locked — per-role approver columns become **derivable from `approval_logs`**,
not duplicated, avoiding the exact hardcoded-per-role anti-pattern the spec wants to move
away from) + `yarn_transfer_advice_lines` (3.7 line fields + computed `bags_in_batch`/
`total_weight_kg` per 5.4).

**Custom REST required** (not OData) for: formula 5.4 computation, the **serial-continuity
hard constraint** (next `first_bag_serial` must equal previous `last_bag_serial + 1` —
blocking), approval-chain integration, and lock-on-GM-approval.
`YarnTransferAdviceController` → `YarnTransferAdviceService`: `createOrUpdateDraft()`,
`validateSerialContinuity()`, `submitForApproval()` (delegates to `ApprovalService`).

### Angular
`yarn-transfer-advice-list` (OData read + status badge), `yarn-transfer-advice-form`
(header + dedicated line-item editor with live serial-continuity check via a
`GET .../next-expected-serial?count_name=&lot_no=` helper), `approval-action` +
`approval-history-timeline` dropped into the detail view.

### 3C. Buyer & allocation (spec 3.8, bundled here as downstream of yarn transfer)
`buyers` (pure OData CRUD). `buyer_allocations` (3.8 fields, `buyer_id` nullable for "odd
stock"). Custom REST controller for: whole-bag-vs-partial-kg validation (open question 6 —
schema supports both, UI defaults to whole-bag-only until confirmed) and a running-balance
check against available finished-yarn stock for that count/lot.

**Permissions:** `MILL_YARN_TRANSFER_LIST/CREATE/EDIT`, `MILL_YARN_TRANSFER_APPROVE_HOD`,
`MILL_YARN_TRANSFER_APPROVE_STORE_RECEIVE`, `MILL_YARN_TRANSFER_APPROVE_GM`,
`MILL_BUYER_LIST/CREATE/EDIT`, `MILL_BUYER_ALLOCATION_CREATE`.

### Verification
1. Reproduce spec's worked example: packing entries totaling 380 bags / 19,000kg across 5
   lines → matching transfer-advice lines → totals reconcile exactly (first blocking rule
   in section 6, tested here, formalized in Phase 4).
2. Serial gap on a second batch for same count/lot → blocking.
3. Walk an advice through all 4 roles (4 different logged-in users) — each sees only their
   step's button, `approval_logs` accumulates correctly, status locks after GM approval.
4. Edit a locked advice → rejected server-side, no edit affordance in UI.
5. Over-allocate a buyer beyond available stock → blocking.

---

## Phase 4 — Reconciliation layer (spec section 6)

Validation layer, not new entities. `ReconciliationService` houses each check as a callable
returning `{passed, severity, message, details}`, used both live and in month-close.

| Rule | Where it runs | Severity |
|---|---|---|
| Packing total == transfer-advice total, per day | On advice submission + re-verified at month-close | Blocking |
| Sum monthly `issued_to_prod_kg` == MIS consumption table | Month-close only (monthly aggregate) | Blocking |
| Sum monthly `delivery_transfer_kg` == MIS waste table | Month-close only | Blocking |
| Day N closing == Day N+1 opening | Structurally prevented by Phase 1's service — this becomes a defensive re-verification at month-close (catches bugs/direct DB edits, not a live gate) | Blocking (month-close) |
| `realization% + waste% ≈ 100%` | Live warning intra-month, blocking at month-close | Warning / Blocking |
| Bag count non-integer | On packing entry (Phase 2) | Blocking |
| Bag serial gap/overlap | On advice entry (Phase 3) | Blocking |

New: `Console/Commands/MillProduction/CloseMonthCommand.php`
(`php artisan mill-production:close-month {year} {month}`) — runs all checks; aborts with
exact failing rule/date/lot if any blocking check fails (feeds Phase 6's alerts).
`ReconciliationController::status()` — read-only live-status endpoint for a pre-close
checklist UI.

**Tolerance** for the ≈100% check is **open question 5** — new
`mill_production_settings.mis_reconciliation_tolerance_pct` config value, default 2.0%
per the spec's own hint (no generic Settings model exists in this codebase currently —
confirmed by search — so this is a new small key-value table).

### Angular
`month-close` component — checklist UI (not a grid), one row per rule with pass/warn/fail
`ui5-badge`, "Run Month-Close" button gated by `MILL_MONTH_CLOSE`, disabled while any
blocking rule fails, drill-down links into offending rows. `ui5-message-strip` for
warning(Warning)/blocking(Negative) visual distinction.

### Verification
1. Engineer a packing/advice mismatch → blocks advice submission with a clear delta message.
2. Month with <2% realization+waste gap → passes with warning; >2% → month-close aborts.
3. Confirm rule 4 (carry-forward) genuinely can't be triggered through normal UI (Phase 1
   prevents it structurally) — verify via a direct test-DB edit that month-close still
   catches it, proving the check has real defensive value.

---

## Phase 5 — Monthly MIS rollup & reporting (spec 3.10, formulas 5.6–5.8, section 4's 5 reports)

**`monthly_mis_summaries`** — an explicit **snapshot**, not a live view (per spec 3.10's own
wording), written only by the month-close command. `is_final` boolean (false=provisional
preview, true=locked-official) plus `computed_at`. Columns per 3.10 +
`count_conversion_factor_snapshot` (JSON, for auditability if config changes later).

**`count_conversion_factors`** (open question 2): `id, count_name (unique),
conversion_factor, effective_from`. Seed empty — **do not guess values**; UI shows
"Not configured" rather than a fabricated number until the client supplies the real table.

### OData vs REST
- `CountConversionFactor`: pure OData CRUD.
- `MonthlyMisSummary`: OData discover, read-only (all mutation disabled) — only writer is
  the month-close command.
- **Custom REST required:**
  - `MisController::preview()` — computes formulas 5.6–5.8 **live from daily ledgers**
    (not the snapshot), fulfilling the spec's core principle ("MIS numbers must always
    derive from the daily ledgers"). `MisRollupService` — one method per formula
    (`openingWip`, `actualConsumption`, `yarnRealizationPct`, `totalWastePct`,
    `avgProductionPerDay`, `avgCount`, `invisibleWastagePct`), independently testable
    against the spec's worked numbers.
  - `MisController::finalize()` — HTTP trigger for `CloseMonthCommand`, gated by
    `MILL_MONTH_CLOSE` + the GM→Director chain (`ApprovalService`, `document_type =
    'MONTHLY_MIS'`), refuses to run unless Phase 4's reconciliation is all-clear.

### The 5 printable reports — concrete mapping

| # | Report | Source | Format | New files |
|---|---|---|---|---|
| 1 | Daily Raw Cotton Report | `raw_cotton_daily_ledgers` | PDF + Excel | `pdf-templates/mill-raw-cotton-report.blade.php`, `Exports/MillProduction/RawCottonLedgerExport.php` |
| 2 | Daily Wastage Report | `waste_daily_ledgers` | PDF + Excel | `pdf-templates/mill-wastage-report.blade.php`, `Exports/MillProduction/WasteLedgerExport.php` |
| 3 | Daily Shiftwise Production & Store Report | `shift_productions`+`packing_productions`+ledger snapshot | PDF + Excel | `pdf-templates/mill-shiftwise-report.blade.php`, `Exports/MillProduction/ShiftwiseReportExport.php` |
| 4 | Finished Yarn Transfer Advice | `yarn_transfer_advices`/lines | PDF (formal signed document, matches `MaterialReceiptController`'s printable-voucher precedent) | `pdf-templates/mill-yarn-transfer-advice.blade.php` |
| 5 | Monthly MIS Report | `monthly_mis_summaries` / live preview | Excel primary (pivot-friendly), PDF secondary | `Exports/MillProduction/MonthlyMisExport.php`, `pdf-templates/mill-monthly-mis-report.blade.php` |

Each PDF route mirrors `MaterialReceiptController::generatePdf`'s exact call shape. Each
Excel export mirrors `excel-import-export` component's contract (`Export()` →
`commonService.post<Blob>(url, payload, false, headers, 'blob')` → object-URL download).

### Angular
`monthly-mis` component — month/year picker, calls `preview` (REST, live) for an unclosed
month or reads `MonthlyMisSummaries` (OData) for a closed one, with a badge distinguishing
"Provisional" vs "Final — locked". Sub-tables for the raw-material-consumption and
finished-yarn-production breakdowns (section 4 item 5). `mill-reports` launcher screen
listing all 5 with Export/Print buttons.

**Permissions:** `MILL_MIS_VIEW`, `MILL_MIS_CLOSE_MONTH`, `MILL_MIS_APPROVE_DIRECTOR`,
`MILL_REPORT_EXPORT`.

### Verification
Hand-check every number against the spec's own worked examples:
1. `actual_consumption_kg = 526,068.51`, `/29 working days = 18,140.29`.
2. `yarn_realization_pct = 85.96%`, `total_waste_pct = 13.04%`, sum ≈99.00% (warning, not
   blocking, per spec's own observed example).
3. `avg_count = 27.44`.
4. Per-waste-type % sums correctly; `invisible_wastage_pct` is derived, never a manual
   input field anywhere in the UI.
5. `finalize()` blocked on a month where Phase 4 reconciliation isn't clean, with a message
   naming the failing check.
6. Generate all 5 reports for a closed month, spot-check totals against on-screen grids.

---

## Phase 6 — Alerts & dashboards (spec section 8)

**Reuse:** `Notification` model (`Backend/app/Models/Notification.php`) already has
`recipient_id`, `sender_id`, `model_type`, `model_id`, `is_read` — directly reusable, no new
notification table. Reuse the existing bell-icon delivery UI (find and reuse its consumer
component rather than rebuilding).

**New:** `AlertService` — one method per section-8 alert:
1–2 (bag count, serial gap): already blocking at entry (Phases 2–3) — surfaced as rejected-
   submission toasts, not standing notifications; no extra work.
3 (opening≠prior closing): structurally prevented (Phase 1); alert becomes month-close's
   defensive-check failure notification if it ever fires.
4 (realization/waste deviates from trailing 30-day average): genuinely new — **confirm**
   whether "trailing 30-day" means a rolling daily window recomputed from ledgers (this
   plan's default, most consistent with the daily-ledger architecture) or a comparison
   across the last 30 monthly MIS closes.
5 (raw cotton origin stock below reorder point): needs new config — **confirm** whether
   reorder points are per-origin (this plan's default, since `origin` is 3.1's natural
   recurring stock-pool grouping) or per-lot/mill-wide. New `raw_cotton_reorder_config`
   table keyed by `origin`, disabled until configured.
6 (pending approvals older than N days): scheduled query over current-step documents vs
   `mill_production_settings.pending_approval_alert_days`.
7 (gain/loss without reason code): already blocking (Phase 1) — re-verify no OData write
   path bypasses it.

New `Console/Commands/MillProduction/RunDailyAlertsCommand.php` (scheduled) for alerts 4–6.
New `mill_production_settings` key-value table (no generic Settings model exists in this
codebase to reuse — confirmed) holding the 3 threshold configs.

### Angular
Dashboard landing view (KPI tiles: today's raw cotton stock, today's waste %, pending
approvals count) + alerts panel reusing the existing notification-bell consumer, filtered to
this feature's `model_type` values. `mill-settings` — admin screen for the 3 thresholds.

**Permissions:** `MILL_DASHBOARD_VIEW`, `MILL_SETTINGS_EDIT`.

### Verification
1. Engineer a >threshold realization deviation → `Notification` row created, visible in
   existing bell UI.
2. Configure a reorder point, drop stock below it → fires once, not daily (needs a dedupe
   guard — check existing `Notification` dedupe pattern first, otherwise add one).
3. Leave an advice pending past the configured age → surfaces on dashboard (section 8
   explicitly says "dashboard, not just email" — no email integration needed for v1).

---

## Open questions — how this plan defers each rather than guessing

| # | Question (from spec §9 + this plan) | How it's parameterized |
|---|---|---|
| 1 | Per-bag weight varies by count? | `count_bag_weights` config table, defaults 50kg, per-count override ready but hidden |
| 2 | Exact "78/1 converted production" factor table | `count_conversion_factors`, seeded empty, UI shows "Not configured" until supplied |
| 3 | FIFO vs weighted-average costing | **Out of scope for v1** per spec's own scope note — `rate_usd_per_kg` captured on the lot, no costing engine built; flagged, not silently defaulted |
| 4 | Working-day calendar / holiday exclusions | New `working_calendar` derived from existing `holidays` (company-wide = `employee_id IS NULL`) + new `plant_weekend_config`, not duplicated holiday storage |
| 5 | Reconciliation tolerance for ≈100% check | `mill_production_settings.mis_reconciliation_tolerance_pct`, default 2.0%, admin-editable |
| 6 | Buyer allocation whole-bag vs partial-kg | Schema supports both; UI defaults whole-bag-only until confirmed |
| 7 | Is Daily Wastage Report's "M(Store)" the same role as Yarn Transfer's `store-incharge`? | Flag for client confirmation before seeding `approval_chain_steps` (Phase 3A) |
| 8 | "Trailing 30-day average" — daily rolling window or last-30-monthly-closes? | Defaults to daily rolling (Phase 6), confirm before building |
| 9 | Reorder-point alert scope — per-origin, per-lot, or mill-wide? | Defaults to per-origin (Phase 6), confirm before building |
| 10 | Is "each yarn count = a Product row" acceptable, or does count need its own master table? | Confirm before Phase 2 — affects `packing_productions`/`yarn_transfer_advice_line` FK shape |

---

## Critical files (reference throughout implementation)

- `Backend/app/Providers/AppServiceProvider.php` — every new model's `Lodata::discover(...)` registration point.
- `Backend/app/Traits/HasCustomId.php` — every new model uses this for ID gen + audit hooks.
- `Backend/app/Services/Store/RequisitionService.php` — thin-controller/fat-service template to copy.
- `Frontend/src/app/modules/base-data-management/capacity-management/` — OData CRUD + dialog pattern template.
- `Frontend/src/app/modules/store-management/store-layout/` + `store-management-routing.module.ts` + `store-management.module.ts` — where all new routes/sidebar entries/declarations get added.
- `Backend/app/Http/Controllers/Store/MaterialReceiptController.php::generatePdf` — dompdf pattern to reuse.
- `Frontend/src/app/shared/components/excel-import-export/excel-import-export.component.ts` — Excel export pattern to reuse.
- `Backend/app/Models/Notification.php` — reuse for all Phase 6 alerts.
- `Frontend/docs/production-management/workflow.md` — the spec; every phase cites it directly.
