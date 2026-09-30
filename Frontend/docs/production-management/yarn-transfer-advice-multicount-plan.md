# Plan: Multi-Count Yarn Batches & Transfer Advice

## Context

The "Yarn Submission to Store" feature built earlier this session (`production_lots` → QC → pack → `store_transfers` → receive → reconcile) assumed **one lot = one yarn count**. Real paper documents from the mill (shown by the user) prove that's wrong: their physical "Lot No" (e.g. "Lot 63") is a batch identifier that spans **multiple counts** (34KH, 32KH, 30KH, 26KH-W, 24KH all under Lot 63 in one "Finished Yarn Transfer Advice Report"), and the same count can reappear under a *different* Lot No weeks later ("30/1 KH" under both Lot 56A and Lot 63 in their stock report). Forcing the user through a separate "New Lot" dialog per count is the direct symptom of that wrong assumption.

Separately, this session discovered `Frontend/docs/production-management/workflow.md` + `mes-implementation-plan.md` — an **already-written, verified-against-real-numbers spec** for exactly this mill's paper flow (raw cotton ledgers, waste, shift/packing production, yarn transfer with a 4-role approval chain, monthly MIS), folded into the roadmap as "Phase 12 — Mill/Textile Production Domain." Its `packing_production` + `yarn_transfer_advice`/`_line` entities are the correct shape for this problem — but the full Phase 12 (raw cotton, waste, monthly MIS, generic approval engine) is a separate XL effort, explicitly out of scope here.

**Decision (confirmed with user):** pull in the `yarn_transfer_advice` naming/approval-chain/serial-range shape now, rather than a narrow patch — but keep per-bag weighing (floor staff weigh every bag individually; the spec's pure `kg ÷ 50 = bag_count` aggregate is not how this mill actually works, so `production_lot_items` stays). This plan reconciles both: restructure the packing side into a **batch header + per-count lines** shape (so one session creates N counts together, sharing a lot_no) while keeping bag-level detail as the line items under each count, and rebuild the transfer side as `yarn_transfer_advices`/`_lines` with the real prepared→HOD→store→GM approval chain and bag-serial ranges.

## Current state (what exists today, built this session)

- `production_lots` — one row per **(machine, count, date)** doffing session: `machine_id, hall_id, shift_id, operator_id, work_order_id, product_id, count_type_id, lot_date, qc_status/qc_checked_by/qc_checked_at, packed_by/packed_at, total_cones/total_bags/gross/net (cached), variance_cones, reconciled_*, status`. No `lot_no` field — the mill's physical lot identifier isn't captured anywhere.
- `production_lot_items` — one row per bag: `production_lot_id, bag_no (resets to 1 per lot), cone_count, gross_weight_kg, net_weight_kg, remark`. `bag_no` is frontend-computed (`items.length + 1`), not a real serial — doesn't match the paper's large, continuously-incrementing serials (e.g. "10627–10775").
- `store_transfers`/`store_transfer_items` — GTN-style: header (`transferred_by, from_hall_id, transfer_date, status: DISPATCHED/PARTIAL/COMPLETED/CANCELLED`) + one item per `production_lot_id`, single-step receive (no HOD/GM approval), no bag-serial-range fields.
- Frontend: `production-lot-form` (Details/QC/Bags tabs, lifecycle stepper, inline bag grid — all built and tested this session) + `yarn-transfer-form` (multi-lot picker, per-item receive/reject/reconcile cards).
- Today's UX pain (user's direct complaint): creating N counts under one physical lot requires N full "New Lot" round-trips (Details → QC → Bags → Pack, five times for Lot 63's five counts) — there's no shared "batch" context.
- `App\Enums\Production\LotStatus`, `App\Enums\Store\StoreTransferStatus/StoreTransferItemStatus`, `App\Services\ProductionLotService`, `App\Services\Store\StoreTransferService` — the status-guard and thin-controller/fat-service patterns here stay; only the entity shapes change.

## Target schema

### `production_lots` — repurposed as the **batch header**

Loses its per-count fields (moved to the new child table below); gains the shared physical-lot identity.

| Column | Change |
|---|---|
| `lot_no` | **new**, `string` nullable indexed — the mill's own physical/mixing lot number (e.g. `"63"`), free text, no FK (matches spec's `packing_production.lot_no` — this is deliberately *not* tied to a raw-cotton-lot master, which is separate Phase-12 scope) |
| `machine_id`, `hall_id`, `shift_id`, `operator_id`, `work_order_id`, `lot_date`, `doffed_at`, `created_by` | unchanged — shared batch context |
| `count_type_id`, `product_id`, `qc_*`, `packed_*`, `total_cones`, `total_bags`, `gross_weight_kg`, `net_weight_kg`, `variance_cones`, `reconciled_*`, `status`, `rejected_reason` | **removed** — moved to `production_lot_counts` |

### `production_lot_counts` — **new**, one row per count within a batch

This is what today's `production_lots` row was, minus the batch-context columns (those live on the parent now). Carries its own `custom_id` (`LOTC-` prefix) since it has an independent multi-stage lifecycle and gets referenced individually by transfer lines.

```
id, custom_id (unique, prefix LOTC-)
production_lot_id      FK → production_lots, cascadeOnDelete
count_type_id          FK → count_types, nullable, nullOnDelete
product_id             FK → products, nullable, nullOnDelete
total_cones, total_bags        unsigned int, default 0   -- cached from items
gross_weight_kg, net_weight_kg decimal(10,2), nullable    -- cached from items
qc_status, qc_checked_by, qc_checked_at, qc_remark
packed_by, packed_at
variance_cones          int, nullable
reconciled_by, reconciled_at, reconcile_remark
status                  string, default DOFFED  -- same LotStatus enum/guard as today, just relocated
rejected_reason         text, nullable
timestamps, softDeletes
```

Why per-count status stays independent (not rolled up to the batch): one count in a batch can fail QC while its siblings pass — that's already true today structurally, just now made explicit by living on its own row instead of forcing one-count-per-batch.

### `production_lot_items` — bags, retargeted + real serials

- FK changes: `production_lot_id` → `production_lot_count_id` (FK → `production_lot_counts`, cascadeOnDelete).
- `bag_no` semantics change: **mill-wide continuous serial per count type**, not per-batch. Backed by a new `count_types.last_bag_serial` (unsigned int, default 0) counter, incremented atomically (`lockForUpdate()` + increment, same transactional-safety pattern as `MaterialReceiptController::receiveSingleItem`) when a bag is recorded — the frontend no longer computes `bag_no` client-side.
- Bonus: this makes the spec's "next batch's first serial must equal previous last serial + 1" constraint **structurally impossible to violate** (serials are assigned atomically in sequence) rather than something to validate after the fact — an improvement over the spec's own manual-entry-plus-validation approach.

### `yarn_transfer_advices` — renamed from `store_transfers`, real approval chain

| Column | Change |
|---|---|
| `custom_id` | prefix changes `GTN-` → `ADV-` (or keep `GTN-`; cosmetic, confirm with user at build time) |
| `prepared_by` (renamed from `transferred_by`), `prepared_at` (= `created_at`) | |
| `hod_approved_by`, `hod_approved_at` | **new** |
| `store_received_by` (renamed from `received_by`), `store_received_at` (renamed/retyped from `received_date` date → datetime) | |
| `gm_approved_by`, `gm_approved_at` | **new** — GM approval is treated as the terminal "locked" state (spec's separate `locked` enum value is folded into `gm_approved` for MVP — flagged in Risks, not silently dropped) |
| `status` | vocabulary changes to spec's: `draft → hod_approved → store_received → gm_approved`, plus `rejected` branch (any approver can bounce it back to `draft` with a reason) and `cancelled` |
| `from_hall_id`, `vehicle_no`, `remarks`, `rejected_reason`, `softDeletes` | unchanged |

### `yarn_transfer_advice_lines` — renamed from `store_transfer_items`, serial-range fields

| Column | Change |
|---|---|
| `advice_id` (renamed from `store_transfer_id`) | |
| `production_lot_count_id` (renamed/retargeted from `production_lot_id`) | still a single FK — one line = one count's full packed output, transferred at once. **Not** building cross-day partial-accumulation (a count's stock built up over several days before one transfer clears it) in this phase — flagged in Risks. |
| `lot_no` | **new**, denormalized copy from the parent batch at line-creation time (survives even if the batch record's lot_no is edited later — matches paper being a point-in-time snapshot) |
| `first_bag_serial`, `last_bag_serial` | **new**, server-computed as `MIN(bag_no)`/`MAX(bag_no)` over that count-line's `production_lot_items` at line-creation time — not manually typed |
| `qty_out_cones`, `gross_weight_kg_out`, `net_weight_kg_out`, `qty_in_cones`, `net_weight_kg_in`, `variance_cones`, `status`, `received_by`, `received_at`, `remark` | unchanged from today's `store_transfer_items` |

## Status flow

`production_lot_counts.status` keeps today's exact `LotStatus` enum + `STATUS_TRANSITIONS` guard (`DOFFED → QC_FAILED/PACKED → PENDING_TRANSFER → RECEIVED/REJECTED → RECONCILED`, `CANCELLED` from any non-terminal state) — no change, just relocated onto the new table.

`yarn_transfer_advices.status` — new chain matching spec section 7:

```
draft ──(HOD approves)──> hod_approved ──(store confirms all lines received)──> store_received ──(GM approves)──> gm_approved (terminal/locked)
  │                          │                        │
  └──(any step rejects)──────┴────────────────────────┘──> rejected ──(resubmit)──> draft
draft/hod_approved ──> cancelled  (before store has received anything)
```

- `draft → hod_approved`: `production-supervisor` submits, `hod` approves (new step, new role).
- `hod_approved → store_received`: existing per-line receive/reject mechanics (already built) drive this — header flips once every line is actioned, matching today's `refreshTransferStatus()` recompute-from-children pattern.
- `store_received → gm_approved`: `gm` signs off (new step, new role) — this is where `production_lot_counts.status` for zero-variance lines auto-reconciles (unchanged from today); non-zero-variance lines still need the explicit `reconcile()` action, which can happen before or after GM approval.
- `rejected`: any of HOD/store/GM can bounce the whole advice back to `draft` with a reason (mirrors `PurchaseRequisition`-style reject-and-resubmit already used elsewhere in Store).

## Roles / permissions

Add **`hod`** and **`gm`** roles (reusing existing `store-keeper` for the paper's "Store Incharge" step rather than adding a redundant role). New permissions:

```
PRODUCTION_LOT_BATCH_CREATE   -- creating a batch + its count-lines (was PRODUCTION_LOT_CREATE)
STORE_YARN_ADVICE_APPROVE_HOD
STORE_YARN_ADVICE_APPROVE_GM
```

Existing `PRODUCTION_LOT_*`/`STORE_YARN_GRN_*`/`STORE_YARN_RECONCILE` permissions carry over unchanged (just now scoped to `production_lot_counts` instead of `production_lots` under the hood — no permission-string changes needed there).

## API surface changes

```
POST   production/lot-batches                          -- create batch header + N count-lines in one call (was N separate `production-lots` POSTs)
PUT    production/lot-batches/{batch}                   -- edit shared header fields (lot_no, machine, shift, date, hall, operator, work order)
POST   production/lot-batches/{batch}/counts            -- add one more count-line to an existing batch
PUT    production/lot-batches/{batch}/counts/{count}    -- (unchanged shape, just repathed) QC/pack/cancel act on {count}, not {batch}
POST   production/lot-batches/{batch}/counts/{count}/qc
POST   production/lot-batches/{batch}/counts/{count}/items      -- add bag (server now assigns bag_no)
PUT    production/lot-batches/{batch}/counts/{count}/items/{item}
DELETE production/lot-batches/{batch}/counts/{count}/items/{item}
POST   production/lot-batches/{batch}/counts/{count}/pack
POST   production/lot-batches/{batch}/counts/{count}/cancel

POST   store/yarn-advices                               -- create draft, pick multiple production_lot_counts (any batches/lot_nos)
PUT    store/yarn-advices/{advice}
POST   store/yarn-advices/{advice}/submit-hod            -- production-supervisor → draft submitted for HOD
POST   store/yarn-advices/{advice}/approve-hod           -- hod
POST   store/yarn-advices/{advice}/reject                -- any approver, any stage
POST   store/yarn-advices/{advice}/lines/{line}/receive  -- store-keeper (unchanged mechanics)
POST   store/yarn-advices/{advice}/lines/{line}/reject
POST   store/yarn-advices/{advice}/approve-gm            -- gm
POST   store/yarn-advices/{advice}/lines/{line}/reconcile
```

`App\Http\Controllers\ProductionLotBatchController` + `ProductionLotCountController` (or one controller, split by resource if it stays clean) + services; `App\Http\Controllers\Store\YarnAdviceController` + `YarnAdviceService`, renamed from today's `StoreTransferController/Service`.

## Frontend changes

- **`production-lot-batch-form`** (replaces `production-lot-form`'s creation flow): header fields (lot_no, machine, hall, shift, operator, work order, date) entered once, then a repeatable **count-line editor** below — "+ Add Count" opens the same Details/QC/Bags tab-set as today's lot form, but scoped per count-line and without re-asking for the shared header fields. This is the direct fix for "creating multiple lots for multiple counts is bad."
- **`yarn-advice-form`** (renamed from `yarn-transfer-form`): lot-picker now selects `production_lot_counts` across any batch/lot_no (unchanged multi-select capability, already built); Lots tab gains a bag-serial-range display per line (`First/Last Bag Serial` — matches the paper columns exactly) and the four approval actions (`Submit for HOD`, `Approve (HOD)`, `Approve (GM)`, `Reject`) gated by the new permissions, alongside the existing per-line receive/reject/reconcile cards.
- Status badges: extend `statusStyles.ts` with `draft/hod_approved/store_received/gm_approved/rejected` entries for the advice header; per-count-line badges reuse existing `LotStatus` styling unchanged.

## Risks / open questions

1. **Existing 4 test lots (`LOT-000001..4`) don't survive this restructure as-is** — splitting `production_lots` into batch+count-line tables means the current rows' count/product/QC/pack data needs either a one-off data migration (copy each existing row's per-count fields into a new `production_lot_counts` row, point its `production_lot_items` at the new id) or manual re-entry. Given this is still test data, recommend a short data-migration script rather than losing it, but flag the choice.
2. **`gm_approved` absorbing spec's separate `locked` state** — spec says "locks on GM approval" but lists them as two enum values; this plan treats GM approval as immediately terminal/locked for MVP. If the mill needs a window between GM-approved and formally-locked (e.g. for late corrections), that's a fast follow-up, not a schema change.
3. **Cross-day accumulation not built**: the paper's "Daily Yarn Delivery & Stock" report shows the same count+lot_no's stock building up over several days before one transfer clears it. This plan keeps today's 1:1 (one count-line's full output → one transfer line) mechanic. Supporting a transfer line that pulls a partial/cross-day bag range for a count+lot_no is real Phase-12 territory (needs the line to reference a bag *range* query, not a single `production_lot_count_id`) — deferred, flagged, not silently narrowed.
4. **`count_types.last_bag_serial` is a single global counter per count** — correct for one mill/one shift-pattern, but if this mill ever runs the same count on multiple sites/lines needing independent serial pools, this needs a scope key added. No evidence that's needed today.
5. **Approval-chain role mapping**: spec's own open question #7 ("is Daily Wastage Report's 'M(Store)' the same role as Yarn Transfer's 'store-incharge'?") is Phase-12-wide, not this plan's problem — but confirm with the user now whether `store-keeper` (already built) is an acceptable stand-in for the paper's "Store Incharge" title, since renaming a role after roles are in use is more disruptive than renaming a table.
6. **Raw-cotton lot linkage** ("full lot traceability... trace back to the raw cotton lot(s)/origin(s) blended into it," spec section 11) is explicitly not addressed here — `lot_no` stays free text with no FK to a raw-cotton-lot master, because that master doesn't exist yet (Phase 12 proper). This plan's `lot_no` is a placeholder that Phase 12 can later backfill with a real FK once `raw_cotton_lots` exists.

## Phased rollout

**Phase A (this plan):**
- Migrations: `production_lots` column drop + `lot_no` add; new `production_lot_counts`; `production_lot_items` FK retarget; `count_types.last_bag_serial`; `store_transfers`→`yarn_transfer_advices` + new approval columns; `store_transfer_items`→`yarn_transfer_advice_lines` + serial-range columns. One-time data migration for the 4 existing test rows (see Risk 1).
- Backend: repath controllers/services per the API surface above; new `hod`/`gm` roles + permissions; bag-serial atomic-increment service.
- Frontend: batch-entry form (header + repeatable count-lines), renamed advice form with 4-stage approval actions + serial-range display.

**Phase 12 (separate, later, per existing roadmap):** raw cotton ledgers, waste tracking, shift/packing daily reports, monthly MIS, generic approval-chain engine, buyer allocation — this plan's `yarn_transfer_advices` becomes that Phase's foundation rather than something rebuilt again.

## Verification

- Recreate the paper's worked example: one batch, `lot_no = "63"`, 5 count-lines (34KH/32KH/30KH/26KH-W/24KH) with bag counts matching 27/30/149/10/164 → one advice bundling all 5 lines → totals reconcile to 380 bags / 19,000 kg exactly (spec's own verified numbers).
- Confirm bag serials never reset within a count across multiple batches (create two batches for the same count on different dates, confirm second batch's first bag serial = first batch's last + 1).
- Walk one advice through all 4 approval stages as 4 different logged-in users (production-supervisor, hod, store-keeper, gm) — confirm each sees only their step's action, and a `reject` at any stage returns it to `draft` correctly.
- Confirm a count-line that fails QC does *not* block its sibling count-lines in the same batch from proceeding to pack/transfer.
