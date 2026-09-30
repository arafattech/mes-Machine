# Store Management — Documentation Index

## Module Root
`src/app/modules/store-management/`
Module file: `store-management.module.ts`
Alias: `@store-module/*`

## Feature Areas

| Folder | Description |
|--------|-------------|
| [store-home/](store-home/context.md) | Analytics dashboard — purchase stats, latest POs |
| [purchase-order/](purchase-order/context.md) | PO list + create/edit dialog — shared with purchase-management |
| [purchase-requisition/](purchase-requisition/context.md) | SPR list (type=SPR) — sidebar label "Indent"; create/view; store team creates SPRs (Indents) |
| [store-requisition/](store-requisition/context.md) | SR list (type=SR) — sidebar label "SR Requisition" under "SR Management"; create/view; department-filtered for non-admins |
| [sr-request/](sr-request/context.md) | SR two-level approval view — sidebar label "SR Request" under "SR Management"; view + approve/reject + final approve |
| [item-return/](item-return/context.md) | Items Return — return items against an already-issued SR; department → issued SR → items grid; Approve/Reject (no status dropdown) |
| [local-material-receipt/](local-material-receipt/context.md) | Local MRR list — create/view/PDF; source=LOCAL |
| [imported-material-receipt/](imported-material-receipt/context.md) | Imported MRR list — create/view/PDF; source=IMPORTED |
| [item-inventory/](item-inventory/context.md) | Product/item list with stock status — sidebar label "Inventory" (top of nav); view/edit/download |
| [idle-inventory/](idle-inventory/context.md) | Date-range report for idle items — REST API, static data mode |
| [low-stock/](low-stock/context.md) | Items where `current_stock <= minimum_stock` — REST API, static data mode |
| [reminder/](reminder/context.md) | Reminders tied to partial Local MRR — store creates, purchase acknowledges via "I have read"; component reused (routed, not re-declared) from `purchase-management` too |
| [stock-ledger/](stock-ledger/context.md) | Per-product stock ledger report — REST + static-report grid, Excel export; **no permission guard** (deliberately left open) |
| [raw-cotton-received/](raw-cotton-received/context.md) | Daily raw-cotton receipt events — L/C, supplier, origin, quantity, rate, product stock |
| [return-mrr/](return-mrr/context.md) | Whole-receipt MRR return — reverses stock, persists audit history (`mrr_returns`/`mrr_return_items`); **no permission guard** (deliberately left open) |

## Route Base
`/store` — layout: `StoreLayoutComponent`

## Sidebar Menu Labels & Order
Display labels and ordering only — **routes and permissions are unchanged**.

| Sidebar Label | Route | Notes |
|---------------|-------|-------|
| Inventory | `item-inventory` | renamed from "Item Inventory"; moved to TOP of Store Management nav (above Local MRR) |
| SR Management → SR Request | `sr-requests` | menu group renamed from "Indent Management"; "SR Request" is now the first submenu |
| SR Management → SR Requisition | `store-requisition` | second submenu (after "SR Request") |
| Indent | `purchase-requisition` | renamed from "Purchase Requisition" |
| Outbound → Return MRR | `return-mrr` | moved from the flat top-level nav list into the "Outbound" sidebar group (alongside SR Management, Sales Dispatch) |
| Inbound → Return SR | `item-return` | renamed from "Items Return"; moved out of Outbound → SR Management's subItems into Inbound as a flat item (alongside Local MRR, Imported MRR) — route/permission unchanged |

| Path | Component | Permission |
|------|-----------|------------|
| `store-analytics` | `StoreHomeComponent` | `STORE_ANALYTICS` |
| `purchase-order` | `PurchaseOrderComponent` | `STORE_PURCHASE_ORDER` |
| `local-material-receipt` | `LocalMaterialReceiptComponent` | `STORE_LOCAL_MRR` |
| `imported-material-receipt` | `ImportedMaterialReceiptComponent` | `STORE_LOCAL_MRR` |
| `raw-cotton-received` | `RawCottonReceivedComponent` | `STORE_LOCAL_MRR` |
| `purchase-requisition` | `PurchaseRequisitionComponent` | `STORE_PURCHASE_REQUISITION` |
| `store-requisition` | `StoreRequisitionComponent` | `STORE_STORE_REQUISITION` |
| `sr-requests` | `SrRequestComponent` | `STORE_SR_REQUEST` |
| `item-return` | `ItemReturnComponent` | `STORE_ITEM_RETURN` |
| `item-inventory` | `ItemInventoryComponent` | `STORE_ITEM_INVENTORY` |
| `idle-inventory` | `IdleInventoryComponent` | `STORE_IDLE_INVENTORY` |
| `low-stock` | `LowStockComponent` | `STORE_LOW_STOCK` |
| `reminders` | `ReminderComponent` | `STORE_REMINDERS` (also routed from `/purchase-management/reminders` with route `data: { context: 'purchase' }`) |

## Key Design Patterns

### ag-grid Table (all list views)
All main list components use `app-ag-grid-table` with OData (except idle-inventory and low-stock, which use REST + static data mode).

### Shared Dialog Components (NOT migrated to ag-grid)
These inner dialog/form components still use `app-custom-grid-table` for item tables:
- `RequisitionFromComponent` — shared by SPR, SR, and SR-request views
- `MRRFromComponent` — shared by local and imported MRR
- `ItemDetailsComponent` — item detail/edit form

### Technology Stack
- Angular `.tsx` extension (most components) — Angular TypeScript, not JSX
- `app-ag-grid-table` — all list views
- `app-custom-grid-table` — inner dialog item tables
- OData via `CommonService` (default) — most endpoints
- REST via `CommonService.get(url, false)` — idle-inventory report, low-stock report
- SAP UI5 Web Components — UI elements
- `AgGridStatusBadgeComponent` — status badge cell renderer (selector: `app-ag-grid-status-badge`)
- `AgGridActionCellRendererComponent` — row action buttons
- `statusStyles` — `@shared/utilities/statusStyles` maps status key → `{ backgroundColor, label, color? }`

### Segment Buttons → Filter Pattern
All list components with segment buttons update `dataSource` via spread:
```typescript
this.dataSource = { ...this.dataSource, filter: newFilter };
```
ag-grid detects the reference change and refreshes automatically.

### Save/Refresh Pattern
After dialog save: `agGridRef?.refreshGridData(true)`

### PDF Generation Pattern
MRR components (local + imported) POST to `store/material-receipts/${id}/pdf` as blob,
open in new tab; fall back to `<a download>` if popup blocked.

### Two-Level Requisition Approval (Indent/SPR + SR)
Both SPR (Indent Requests) and SR (SR Request) use the same two-level flow:
```
SUBMITTED → (Level-1 approve) APPROVED → (Level-2 final approve) FINAL_APPROVAL
                ↘ REJECTED            ↘ REJECTED
```
- **Level-1** (GM): gated by `PURCHESE_SPR_APPROVAL` (SPR) / `STORE_SR_APPROVAL` (SR). Sets `approved_by` + `approved_at`.
- **Level-2** (final): gated by its OWN permission `PURCHESE_SPR_FINAL_APPROVAL` (SPR) / `STORE_SR_FINAL_APPROVAL` (SR) — `canFinalApprove = hasPermission(<final perm>)` (no longer `!canApprove`). Flips `APPROVED → FINAL_APPROVAL`, sets `final_approved_by` + `final_approved_at`, and decrements stock. A user may hold both perms (can do both levels).
- Both actions happen inside the shared `RequisitionFromComponent` dialog (Approve/Reject/Cancel) — no separate ✓ row icon.
- **Stock timing**: decrement moved to final approval (was on first approval). Final approval calls REST `store/requisitions-final-approve` (`RequisitionController@finalApproveRequisition`) which validates status==APPROVED, does stock, sets status + audit.
- **Segment → status mapping** (both screens):
  - Submitted = `SUBMITTED or APPROVED` (APPROVED rows are GM-approved, awaiting final).
  - Approved = `FINAL_APPROVAL` only (fully approved).
  - Rejected = `REJECTED`.
- **Status badge**: SPR + SR list status columns use `AgGridStatusBadgeComponent`; `FINAL_APPROVAL` → green "Final Approved" (see `statusStyles`).
- **Transition guard**: enforced server-side in `PurchaseRequisition::booted()` `updating` for `type ∈ {SPR, SR}` (allowed: SUBMITTED→APPROVED/REJECTED, APPROVED→FINAL_APPROVAL/REJECTED).
- New status `FINAL_APPROVAL` added to FE `SprStatus` enum + BE `App\Enums\Store\SprStatus`.
- New columns on `purchase_requisitions`: `approved_at`, `final_approved_by`, `final_approved_at`.

### Permissions (approval + MRR additions)
| Permission | Module | Effect |
|------------|--------|--------|
| `PURCHESE_SPR_APPROVAL` | PURCHESE group | Level-1 Indent (SPR) approval — shows Approve/Reject in dialog |
| `PURCHESE_SPR_FINAL_APPROVAL` | PURCHESE group | Level-2 Indent (SPR) final approval |
| `STORE_SR_APPROVAL` | STORE group | Level-1 SR approval — shows Approve/Reject in dialog |
| `STORE_SR_FINAL_APPROVAL` | STORE group | Level-2 SR final approval |

### Status display — two derived columns (frontend-only)
Backend `status` is unchanged; lists derive two badge columns from it (`gmStatusBadge` / `generalStatusBadge` in `spr-status.ts`, rendered via `AgGridStatusBadgeComponent`). No new DB column.

| backend `status` | GM Status | Status |
|------------------|-----------|--------|
| SUBMITTED | Pending (amber) | Pending (amber) |
| APPROVED | Approved (green) | Pending (amber) |
| FINAL_APPROVAL | Approved | Approved |
| REJECTED | Rejected | Rejected |

Badge keys: `'pending'` (waiting/amber, from `statusStyles.pending`), `'APPROVED'`, `'REJECTED'`. Applied on all four list screens (Indent Requests, Indent Requisition, SR Request, SR Requisition) — `status` column replaced by **GM Status** then **Status**.

### Indent Type / Order Type — `is_imported`, not urgency
Badge column present on Indent Requisition, SR Requisition, Indent Requests (purchase-management), and Purchase Order lists — despite the "Indent Type" name, it's driven by `is_imported` (`LOCAL`/`FOREIGN`), not `urgency`. `statusStyles.ts` keys: `LOCAL`, `FOREIGN` (and separately `LOW`/`MEDIUM`/`HIGH` exist for actual urgency badges elsewhere). `is_imported` flows: set on the SPR/SR at creation → inherited onto the PO when created from a quote (`PurchaseOrderWorkflowController::createPurchaseOrderFromQuote`) → drives which POs appear in the Local vs Imported MRR "PI/Indent List" combobox (`MRRFromComponent.getPOList()`, filtered by `source`).

### GM-approval locks quantities (Indent/SR)
Once a requisition's `status` is `APPROVED` (GM-approved) or beyond, both the requested quantity and `approved_qty` lock permanently in `RequisitionFromComponent` — computed directly off `this.Spr.status`, not solely inherited from the parent's `showNewButton`. See purchase-requisition context "canEditQty" / "canEditApproved" for the exact gates.

### Lodata non-nullable-column gotcha (bit us 3x this session)
Lodata requires every **non-nullable** column to be present in the create/update payload — it never falls back to the MySQL column default. Adding a non-nullable boolean/counter column to any Lodata-exposed table (`purchase_orders.is_imported`, `purchase_requisitions.is_imported`, `purchase_requisition_items.return_quantity` all hit this) silently breaks every insert that doesn't know about the new column, across the whole app, not just the feature that added it. **Always add new columns on Lodata-exposed tables as `nullable()->default(...)`** unless every existing caller is updated in the same change.

### `custom_id` generator (`/api/generate-id`) — one bad row poisons the whole prefix
SR/SPR/PO/etc `custom_id` values are generated via `idGeneratorController::generateCustomCode` → `haruncpi/laravel-id-generator`'s `IdGenerator::generate()`. With a prefix, it runs **raw SQL** `SELECT MAX(custom_id) WHERE custom_id LIKE 'PREFIX-%'` and increments the numeric suffix. Two sharp edges:
- **Raw SQL bypasses Eloquent's soft-delete scope.** A soft-deleted row with that prefix still counts toward `MAX()`.
- **`MAX()` on a VARCHAR is lexicographic, not numeric.** A single row like `custom_id = "SR-TEST-NULLABLE"` outranks `"SR-000045"` (`T` > `0` in ASCII) — the generator then does `(int)"TEST-N" == 0`, `+1`, and resets the whole prefix back to `PREFIX-000001` for every future call, silently, no error.
- **Fix when this happens**: find the offending row with `Model::withTrashed()->where('custom_id', 'like', 'PREFIX%')->get()` and `withTrashed()->forceDelete()` it — a plain `find()->forceDelete()` silently no-ops on an already-soft-deleted row (`find()` excludes trashed rows), which is how this one slipped through.
- **Prevention**: never leave test/scratch data using a real prefix (`SR-`, `SPR-`, `PI-`, etc.) — use an obviously-fake prefix (`ZZZ-TEST-...`) or hard-delete test rows with `withTrashed()->forceDelete()`, not `find()->forceDelete()`.
