# Implementation Plan: Yarn Submission to Store

## Context

Spinning mill MES. Production flow Blow Room → Carding → Drawframe → Fly Frame → Ring Frame → Autoconer covers spinning itself. Nothing tracks the handover after Autoconer: doffing → QC → pack → weigh/tally → GTN → GRN → reconciliation. Finished-yarn stock never actually increases anywhere today. This plan adds that handover as a new feature spanning Backend (Laravel 11) and Frontend (Angular 17), reusing the Store module's existing MRR-style workflow pattern rather than inventing a new one.

Status: **plan only, no code written yet** — for review before implementation starts.

## Current-state summary (verified in codebase)

- No `lot`, `batch`, `production_log`, GTN, or GRN table exists anywhere in Backend or Frontend. Confirmed via full-repo grep.
- `count_types` table exists (added same day as this plan, commit `d33b4739`) but is completely unwired — no FK from any table references it. Model is a bare `HasCustomId` stub.
- `work_orders` exists: `id, is_active, custom_id, product_id→products, quantity, status (native ENUM: pending/in_progress/completed/cancelled), scheduled_start, actual_start`. `machines()` belongsToMany via `work_order_machines` pivot.
- `employee_shifts` exists (`id, is_active, custom_id, name, start_time, end_time, is_night, ...`). Convention elsewhere: FK column `shift_id → employee_shifts`.
- `machine_groups.is_autocon` (bool, added `2026_06_14`) already flags which machine groups are Autoconers — "must be doffed from Autoconer" is enforceable today with zero new schema.
- `employees.user_id` is nullable — most floor operators have **no login**, so `created_by`→`users` cannot double as "who physically doffed this."
- Closest existing analogue for a GRN-style receiving doc: `material_receipts` + `material_receipt_items` + `material_receipt_logs` (Purchase/Store domain). Its controller (`MaterialReceiptController`) shows the pattern to copy: `DB::transaction()` + `lockForUpdate()` on receive, delta-only increments, status always re-derived server-side from source quantities, never trusted from the client.
- Status-transition guard pattern: `App\Models\Store\PurchaseRequisition` — `private const STATUS_TRANSITIONS` map + `static::updating()` hook throwing `ValidationException` on illegal transition. This is the model to copy for the new lot/transfer status machines.
- No FormRequest/API-Resource classes anywhere — validation is inline `$request->validate()`, responses are plain `response()->json()`. Simple lookup tables skip controller/service and go straight through `Lodata::discover()` (OData CRUD). Multi-step workflow entities get a real thin Controller + fat Service (`RequisitionController`+`RequisitionService`), **plus** usually also `Lodata::discover()` for read-only grid listing.
- **Backend has no permission enforcement on REST controllers at all** — confirmed zero hits for `->can(`, `Gate::`, permission middleware anywhere in `app/Http/Controllers`/`app/Services`. Everything sits behind `auth:sanctum` only. Permission checks are Angular-frontend-only (`PermissionGuard` + `RolePermissionService`), except Lodata OData routes (`LodataSpatieMiddleware` + `PermissionRegistry`, currently only `MarketPrices` registered). **This is a pre-existing gap, flagged under Risks — not something this feature is expected to fix repo-wide, but new backend endpoints should not quietly inherit it without a decision.**
- Roles today (Spatie, `RoleSeeder.php`): `super-admin, admin, accountant, user, employee, sales-head, sales-person`. No operator/supervisor/store-keeper role exists.
- `HasCustomId` trait: auto-generates `custom_id` on create (via `IdGeneratorSettingsSeeder` entries) and auto-writes an `ActivityLog` row on every insert/update/delete. Every new entity needs one seeder row.
- Frontend: `store-management/` module has one folder per entity (list + `-form/` subfolder), OData-backed `ag-grid-table`, UI5 dialogs. `inventory-management/` is an empty unused placeholder. No lot/GTN/GRN UI exists. Status badges via shared `AgGridStatusBadgeComponent` + per-domain enum with a `gmStatusBadge()` helper (see `store-management/shared/enum/spr-status.ts`).

## Proposed schema

### `production_lots` (header — doffing → QC → pack → weigh)

Un-namespaced model (`App\Models\ProductionLot`), matching `WorkOrder`/`Machine`. Transactional-doc conventions: `custom_id` unique, `status` string+enum, `softDeletes()`.

| Column | Type | Notes |
|---|---|---|
| `custom_id` | string, unique | prefix `LOT-` |
| `work_order_id` | FK→work_orders, nullable, nullOnDelete | not every lot maps cleanly to one WO |
| `machine_id` | FK→machines, nullable, nullOnDelete | must belong to an `is_autocon` group — validated in service, not DB constraint |
| `hall_id` | FK→halls, nullable, nullOnDelete | denormalized snapshot for reporting |
| `shift_id` | FK→employee_shifts, nullable, nullOnDelete | reuse verbatim, same column name as `machine_production_counts.shift_id` |
| `operator_id` | FK→employees, nullable, nullOnDelete | who physically doffed/packed — may have no login |
| `created_by` | FK→users, nullable, nullOnDelete | who keyed it into the MES, `auth()->id()` |
| `product_id` | FK→products, nullOnDelete | finished-goods SKU; GRN increments its `current_stock` |
| `count_type_id` | FK→count_types, nullable, nullOnDelete | **wires up the unused table** — nullable so incomplete master data doesn't hard-block |
| `lot_date` | date | |
| `doffed_at` | datetime, nullable | |
| `total_cones`, `total_bags` | unsigned int, default 0 | server-computed cache from `production_lot_items` |
| `gross_weight_kg`, `net_weight_kg` | decimal(10,2), nullable | server-computed cache, not independently editable |
| `qc_status` | string, nullable (`PASSED`/`FAILED`) | gate before packing, not a status-chain step |
| `qc_checked_by`, `qc_checked_at`, `qc_remark` | FK→users / datetime / text | |
| `packed_by`, `packed_at` | FK→users / datetime | |
| `variance_cones` | int, nullable, signed | set at GRN receive |
| `reconciled_by`, `reconciled_at`, `reconcile_remark` | sign-off fields | |
| `status` | string, default `DOFFED` | see state machine below |
| `rejected_reason` | text, nullable | |
| + `timestamps`, `softDeletes` | | |

Indexes: `(machine_id, lot_date)`, `(work_order_id)`.

### `production_lot_items` (one row per bag/carton)

Not optional for MVP — "counts can't mix in one pack" is already satisfied at the lot level (one lot = one `count_type_id`/`product_id`), so this table's only job is splitting cones across bags, which weighing/tally is inherently per-bag.

| Column | Type |
|---|---|
| `production_lot_id` | FK→production_lots, cascadeOnDelete |
| `bag_no` | unsigned int |
| `cone_count` | unsigned int |
| `gross_weight_kg`, `net_weight_kg` | decimal(10,2) |
| `remark` | text, nullable |
| `timestamps` | |

No `custom_id` on line rows — matches `material_receipt_items`.

### GTN/GRN — tradeoffs, then recommendation

| | Separate GTN + GRN tables | Single `store_transfers` (status-evolving) |
|---|---|---|
| Pro | Clean 1:1 doc separation; mirrors "PO vs MRR" mental model | No duplicated columns; matches how `MaterialReceipt` already conflates receipt+receiving in this codebase |
| Con | Almost every GRN column would just restate the GTN row (supplier/lot/qty context) | Header status is a derived aggregate, not a raw fact — needs discipline to always recompute server-side |
| Fit here | Purchasing's PO:MRR is legitimately many-to-one/partial over weeks | GTN→GRN here is close to 1:1 per lot, confirmed in one sitting — no incremental-ledger need like `material_receipt_logs` |

**Recommendation: one table, `store_transfers` (header) + `store_transfer_items` (one row per lot in the transfer), no separate GRN table, no ledger table.** The receiving action is a single-sitting confirm, not `MaterialReceipt`'s multi-week incremental top-up — the audit trail that `material_receipt_logs` exists for is already covered by `store_transfer_items`' own receive fields plus the automatic `ActivityLog` row `HasCustomId` writes on every change.

| Table | Key columns |
|---|---|
| `store_transfers` | `custom_id` unique (prefix `GTN-`), `transferred_by`→users, `received_by`→users (denormalized aggregate), `from_hall_id`→halls, `transfer_date`, `received_date` nullable, `vehicle_no`, `remarks`, `status` default `DISPATCHED`, `rejected_reason`, timestamps, softDeletes |
| `store_transfer_items` | `store_transfer_id`→store_transfers cascade, `production_lot_id`→production_lots cascade, `qty_out_cones` (snapshot at dispatch), `gross_weight_kg_out`/`net_weight_kg_out`, `qty_in_cones` nullable, `net_weight_kg_in` nullable, `variance_cones` (server-computed = in − out), `status` default `PENDING`, `received_by`→users, `received_at`, `remark`, timestamps |

Header `status` is never client-set — always re-derived from item statuses inside the same `DB::transaction()`+`lockForUpdate()` pattern as `MaterialReceiptController::receiveSingleItem()`.

## Status flow

### `production_lots.status` — `App\Enums\Production\LotStatus`

```
DOFFED ──┬──> QC_FAILED ──> CANCELLED
         └──> PACKED ──> PENDING_TRANSFER ──┬──> RECEIVED ──> RECONCILED
                              ▲             └──> REJECTED ──┘ (resubmit)
                              └───────────────────┘
any non-terminal state ──> CANCELLED
```

```php
private const STATUS_TRANSITIONS = [
    'DOFFED'            => ['QC_FAILED', 'PACKED', 'CANCELLED'],
    'QC_FAILED'         => ['CANCELLED'],
    'PACKED'            => ['PENDING_TRANSFER', 'CANCELLED'],
    'PENDING_TRANSFER'  => ['RECEIVED', 'REJECTED', 'CANCELLED'],
    'REJECTED'          => ['PENDING_TRANSFER', 'CANCELLED'],
    'RECEIVED'          => ['RECONCILED'],
    'RECONCILED'        => [],
    'CANCELLED'         => [],
];
```

- **QC** is a gate before `PACKED`, not a chain state — `pack()` throws unless `qc_status === 'PASSED'`. `QC_FAILED` is the one real branch needed (scrapped/held lot, must not reach packing).
- **Store rejection** (`PENDING_TRANSFER → REJECTED`) allows resubmit (`REJECTED → PENDING_TRANSFER`) since goods never left custody — no need to redo pack/weigh, just the paperwork.
- **Short/excess receiving is a flag, not a status** — `variance_cones` is always computed and stored on `RECEIVED`, zero or not. `RECONCILED` stays a separate terminal status because sign-off (who approved shrinkage, when) is a real accounting requirement even at zero variance: auto-transition `RECEIVED → RECONCILED` when `variance_cones === 0`, require explicit `reconcile()` (store-manager/admin permission) when non-zero.

`store_transfer_items.status`: `PENDING → RECEIVED | REJECTED`, recomputed server-side; the service updates the linked `production_lot.status` in the same transaction so the two never drift. `store_transfers.status` (header aggregate): `DISPATCHED → PARTIAL | COMPLETED`, `→ CANCELLED` — same recompute-from-children shape as `MaterialReceipt`.

## Roles / permissions

Add two roles (job-title style, matching existing `accountant`/`sales-head` convention): **`production-supervisor`**, **`store-keeper`**. No third `store-manager` role yet — reconciliation sign-off goes to `admin` (+ optionally `store-keeper`) as a permission grant now, splittable into its own role later at zero migration cost.

```
PRODUCTION_LOT
PRODUCTION_LOT_CREATE / _EDIT / _DELETE / _VIEW
PRODUCTION_LOT_QC
PRODUCTION_LOT_PACK
PRODUCTION_LOT_GTN_SUBMIT
PRODUCTION_LOT_GTN_RECALL

STORE_YARN_GRN
STORE_YARN_GRN_VIEW
STORE_YARN_GRN_RECEIVE
STORE_YARN_GRN_REJECT
STORE_YARN_RECONCILE
```

Wire into `PermissionSeeder.php`'s `PRODUCTION`/`STORE` blocks, `RoleSeeder.php`'s role+grant list, and frontend `shared/enums/permissions.ts`.

## API surface

`App\Http\Controllers\ProductionLotController` (flat, like `WorkOrderController`) + `App\Services\ProductionLotService` for production side. `App\Http\Controllers\Store\StoreTransferController` + `App\Services\Store\StoreTransferService` added to the *existing* `Route::prefix('store')` group in `routes/api.php`.

```
Route::middleware(['auth:sanctum'])->group(function () {
    Route::post('production/lots', [ProductionLotController::class, 'store']);
    Route::put('production/lots/{productionLot}', [ProductionLotController::class, 'update']);
    Route::post('production/lots/{productionLot}/qc', [ProductionLotController::class, 'recordQc']);
    Route::post('production/lots/{productionLot}/items', [ProductionLotController::class, 'addItem']);
    Route::put('production/lots/{productionLot}/items/{item}', [ProductionLotController::class, 'updateItem']);
    Route::delete('production/lots/{productionLot}/items/{item}', [ProductionLotController::class, 'deleteItem']);
    Route::post('production/lots/{productionLot}/pack', [ProductionLotController::class, 'pack']);
    Route::post('production/lots/{productionLot}/cancel', [ProductionLotController::class, 'cancel']);

    Route::prefix('store')->group(function () {
        Route::post('transfers', [StoreTransferController::class, 'store']);
        Route::put('transfers/{storeTransfer}', [StoreTransferController::class, 'update']);
        Route::post('transfers/{storeTransfer}/recall', [StoreTransferController::class, 'recall']);
        Route::post('transfers/{storeTransfer}/items/{item}/receive', [StoreTransferController::class, 'receiveItem']);
        Route::post('transfers/{storeTransfer}/items/{item}/reject', [StoreTransferController::class, 'rejectItem']);
        Route::post('transfers/{storeTransfer}/items/{item}/reconcile', [StoreTransferController::class, 'reconcileItem']);
    });
});
```

Reads (grids) via Lodata: `Lodata::discover(ProductionLot::class / ProductionLotItem::class / StoreTransfer::class / StoreTransferItem::class)` in `AppServiceProvider::boot()`. `IdGeneratorSettingsSeeder.php` gets two new rows (`ProductionLot`→`LOT-`, `StoreTransfer`→`GTN-`).

## Frontend

New sibling folders under `Frontend/src/app/modules/production-management/` (`production-lot/` + `production-lot-form/`) and `store-management/` (rename/reuse the empty `inventory-management/` placeholder, or add `yarn-transfer/` + `yarn-transfer-form/`), following the `count-type-list`/`count-type-form` CRUD template for lists and the `production-log-form` tabbed-dialog-with-editable-grid template for the pack/weigh entry screen (bags-as-editable-grid rows mirrors its per-machine editable `goodCount` column). Status badges via existing `AgGridStatusBadgeComponent` + a new `production-management/shared/enum/lot-status.ts` (mirrors `store-management/shared/enum/spr-status.ts`'s `gmStatusBadge()` pattern). Route guards via `PermissionGuard` + new `Permissions` entries, matching `store-management-routing.module.ts`'s existing per-route `data: { permission: ... }` shape.

## Risks / open questions

1. **Backend has zero permission enforcement on REST controllers today** (confirmed, repo-wide). New `ProductionLotController`/`StoreTransferController` endpoints will inherit that gap unless explicitly decided otherwise — recommend adding real `$this->authorize()`/Gate checks on these new controllers even though no other Store controller does, since this feature crosses a stock-increasing boundary. Flag for explicit decision, not silently copy the gap forward.
2. **`machine_id`→Autoconer is enforced in service code, not a DB constraint** — a bad `machine_id` from a bypassed endpoint (e.g. Node-server integration) could tag a lot to a non-Autoconer machine. Acceptable for MVP; note if node-server ever writes lots directly.
3. **`count_types` has zero validation/format today** (`prefix` field, no regex, no uniqueness) — wiring it as a nullable FK is safe, but count-spec data quality (is "34/1" vs "34/1 KH" one row or two?) is a master-data decision outside this feature's scope; flag to the user before go-live.
4. **`quality_inspections` table exists but is a dead scaffold** (`work_order_id` + `defect_count` only, no lot awareness) — not reused; the new `qc_status`/`qc_checked_by` fields on `production_lots` supersede it for this flow. Confirm this doesn't need to be unified with existing QC screens if any exist elsewhere.
5. **No `store-manager` role** — reconciliation approval temporarily lands on `admin`, which may be too broad in practice; revisit after MVP usage shows who actually signs off.
6. **`operator_id`→employees has no enforced link to which machine that employee actually operates** — data entry relies on the person filling the form correctly; no cross-check against a machine-operator assignment table (none exists).

## Phased rollout

**Phase 1 — MVP (core handover, no variance tooling):**
- `production_lots`, `production_lot_items`, `store_transfers`, `store_transfer_items` migrations + models + enums.
- `ProductionLotController`/`Service`: create, QC record, add/edit/delete items, pack, cancel.
- `StoreTransferController`/`Service`: submit GTN, recall, receive item (sets `qty_in_cones`, computes `variance_cones`, but no reconcile step yet — `RECEIVED` is terminal for MVP).
- Two new roles + permission set, seeded.
- Frontend: lot list/form (production-management), transfer list/receive screen (store-management), status badges.
- `IdGeneratorSettingsSeeder` + Lodata discovery for grids.

**Phase 2 — QC/variance/reconciliation:**
- `RECEIVED → RECONCILED` transition + `reconcileItem` endpoint, permission, and UI (variance approval screen, remarks).
- Reject/resubmit flow (`REJECTED → PENDING_TRANSFER`) UI.
- Reporting: variance dashboards, lot traceability (doff → pack → transfer → receive) drill-through, tying into existing `machine_production_counts` for spinning-wastage cross-checks.
- Decide + implement backend permission enforcement (Risk 1) if approved.

## Verification (once implemented)

- Migrate on a local/staging DB (`--pretend` first to sanity-check SQL), seed roles/permissions/id-generator rows.
- Exercise full happy path via API client: create lot → QC pass → add items → pack → submit GTN → receive (zero variance) → auto-reconciled.
- Exercise variance path: receive with qty mismatch → confirm `variance_cones` set, status stays `RECEIVED` until explicit `reconcile()`.
- Exercise illegal transition (e.g. `DOFFED → RECEIVED` directly) → confirm `ValidationException` from the status-guard.
- Frontend: run dev server, walk through lot creation, GTN submission, and store receive screens as both roles (`production-supervisor`, `store-keeper`) to confirm permission gating.
