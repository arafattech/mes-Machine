# Store Management — Items Return

## Files

```
item-return/
├── item-return.component.ts          ← list (list-only, no inline dialog)
├── item-return.component.html
├── item-return.component.scss
└── item-return-form/
    ├── item-return-form.component.ts   ← create/view dialog (Approve/Reject, no status dropdown)
    ├── item-return-form.component.html
    └── item-return-form.component.scss
```

## Route
`/store/item-return` — guard: `STORE_ITEM_RETURN`. Nav entry: sidebar "SR Management" group, after "SR Requisition" (label "Items Return").

---

## Concept
A return is raised against a department's **already-issued** SR (a `PurchaseRequisitions` row with `type='SR'` and `status='FINAL_APPROVAL'`) — items were physically handed to the department, and some quantity is coming back to the store. It is NOT a free-form product picker: the item list is always derived from the chosen SR's `sprItems`.

Flow: pick **Department** → pick that department's **Issued SR** → the SR's items populate an ag-grid table with an editable **Return Qty** column, capped per-row at `SR Qty − Previously Returned` → **Submit** (new, always `PENDING`) or **Approve/Reject** (existing).

## Backend — two tables

```
item_returns              (header)
├── custom_id
├── purchase_requisition_id   → purchase_requisitions.id (the issued SR)
├── department_id             → departments.id (nullable)
├── requested_by              → users.id (nullable)
├── reason, return_date
├── status                    PENDING | APPROVED | REJECTED  (App\Enums\Store\ItemReturnStatus)
├── is_received                boolean, default false
└── soft-deletes

item_return_items         (lines — one per SR item being returned)
├── item_return_id            → item_returns.id, cascade delete
├── purchase_requisition_item_id → purchase_requisition_items.id
├── product_id                 → products.id (denormalized for display)
├── received_quantity          snapshot at time of return
└── return_quantity            (NOT capped by DB constraint — see validation below)
```

Migrations: `2026_07_05_162250_create_item_returns_table.php`, `2026_07_05_162251_create_item_return_items_table.php` (own files — split from an earlier combined migration; keep FK-dependent tables in separate files run in filename order).

Models: `App\Models\Store\ItemReturn` (hasMany `returnItems`), `App\Models\Store\ItemReturnItem` (belongsTo `itemReturn`, `purchaseRequisitionItem`, `product`). Both registered via `Lodata::discover()` in `AppServiceProvider` → `/odata/ItemReturns`, `/odata/ItemReturnItems`.

### Also added to `purchase_requisition_items`
`return_quantity` (integer, **nullable**, default 0) — cumulative quantity returned against that SR item across all *approved* returns. Migration: `2026_07_05_183046_add_return_quantity_to_purchase_requisition_items_table.php`.

> **Nullable gotcha (bit us once)**: this column was first added as non-nullable. Lodata requires every non-nullable column to be present in the insert payload — it does NOT fall back to the MySQL column default. Since `RequisitionFromComponent`'s SR/SPR item-creation payload has no idea `return_quantity` exists, every new `PurchaseRequisitionItems` insert across the *entire app* started failing with `property_not_nullable` until the column was made `nullable()->default(0)`. Same class of bug bit `purchase_orders.is_imported` / `purchase_requisitions.is_imported` separately — see purchase-order context. **Any new boolean/counter column added to a Lodata-exposed table must be nullable unless every caller is updated to send it.**

### Return-quantity cap — SR Qty minus already-returned, not received qty
`ItemReturnItem::booted()` `saving` hook:
```php
$prItem = PurchaseRequisitionItem::whereKey($item->purchase_requisition_item_id)->first(['required_quantity', 'return_quantity']);
$remaining = max(0, (int) $prItem?->required_quantity - (int) $prItem?->return_quantity);
if ((int) $item->return_quantity > $remaining) {
    throw ValidationException::withMessages(['return_quantity' => 'Return quantity cannot exceed the remaining SR quantity.']);
}
```
Deliberately **not** capped at `received_quantity` — the cap is `required_quantity − return_quantity` (SR qty minus what's already been returned in prior approved returns), matching the frontend's `remaining_quantity` field. `received_quantity` on the line is stored only as an audit snapshot, unused for validation.

### Approve → merge into the SR item + restock the product
`ItemReturn::booted()`:
- `updating` hook — on `status` transition `PENDING → APPROVED` (checked via `isDirty('status')` + `getOriginal('status')`), for each `returnItems` line, row-locked in a `DB::transaction`:
  - `purchase_requisition_items.received_quantity -= line.return_quantity` (floored at 0) — department no longer holds that stock.
  - `purchase_requisition_items.return_quantity += line.return_quantity` — cumulative counter.
  - `products.current_stock += line.return_quantity` — returned stock physically goes back into the store (`(string)((int)$product->current_stock + ...)`, since `current_stock` is a `string` column).
- `updated` hook — on `status` changing to `APPROVED`/`REJECTED`, calls the app's existing generic activity-log helper: `ActivityLogController::createLog($itemReturn, 'approved'|'rejected')`. Reuses the polymorphic `ActivityLogs` table (`model_type = App\Models\Store\ItemReturn`) — no new logs table.

Approving twice is safe — the `updating` hook only fires the merge on the exact `PENDING → APPROVED` transition (checked against `getOriginal('status')`), not on every save while already `APPROVED`.

---

## Frontend

### ItemReturnComponent (list)
Thin — mirrors `SrRequestComponent`'s shape: grid + `@ViewChild` into the form component, no inline dialog markup.

| Property | Purpose |
|----------|---------|
| `dataSource` | OData `ItemReturns`, expand `department,requestBy,purchaseRequisition,returnItems($expand=product($expand=uom),purchaseRequisitionItem)`; `searchFields: ['custom_id','purchaseRequisition.custom_id','department.name']`; `sortBy:'custom_id', sortDirection:'desc'` |
| `formRef` | `#itemReturnForm` → `ItemReturnFormComponent` |

Row actions: **info only** (`STORE_ITEM_RETURN_VIEW`) — no edit/delete icons, no delete-confirm dialog. `viewItemReturn(row)` → `formRef.editItemReturn(row)`.

Columns: Return No, SR No (`purchaseRequisition.custom_id`), Department, Items (count), Return Qty (sum of `returnItems[].return_quantity`), Return Date, Status (badge).

### ItemReturnFormComponent (dialog)
Structured like `RequisitionFromComponent` — separate component, `@Input saveMode/selectedData`, `@Output saveEvent`, ag-grid items table with `#childComponentRef`, `$batch` for line writes.

**Fields**: Return No (readonly, `getCustomId({model:'item_returns', prefix:'IR', field:'custom_id'})`), Department combobox, Issued SR combobox (filtered `type eq 'SR' and status eq 'FINAL_APPROVAL' and department_id eq <selected>`, `&$orderby=id desc` — newest issued SR first), Return Date, Reason. **No status dropdown** — replaced by Approve/Reject buttons (see below). Items grid is always rendered (no `*ngIf` gate on SR selection — was gated, removed per redesign; grid is just empty until a SR is picked).

**Items grid columns**: Item Code, Name, SR Qty (`required_quantity`), Unit (`uom`), Previously Returned, Remaining Qty (`required_quantity − previously_returned`), **Return Qty** — the only editable column, `inlineEditor: {type:'stepInput', min:0, maxField:'remaining_quantity', disabledWhenMaxZero:true, disabled: isApproved()}`. Current Stock and Received Qty columns were deliberately removed (not shown).

**Footer buttons — mode-gated, no status dropdown**:
| `saveMode` | Buttons |
|------------|---------|
| `'POST'` (new) | **Submit** only → `submit()` sets `status='PENDING'`, calls `save()` |
| `'PUT'` (existing) | **Approve** / **Reject** → `approve()`/`reject()` set `status` then call `save()`; both `[disabled]` when `isApproved()` |

**`isApproved()` reads a snapshot, not live status** — `public alreadyApproved: boolean`, set once in `editItemReturn()` from the loaded row's original status, `false` in `reset()`. **Do not** derive `isApproved()` from `itemReturn.status` directly: `approve()` mutates `itemReturn.status = 'APPROVED'` *before* calling `save()` → `validateForm()`, so a live check would self-block the very save that's approving it.

Once `isApproved()` is true: Department/SR comboboxes, Return Date, Reason, and the items-grid inline editor all go `readonly`/`disabled`; `validateForm()` hard-returns `false`. Terminal state — no further edits.

**Save flow** (`save()` → `saveBatchRequest()`):
1. POST/PUT the `ItemReturns` header.
2. One `$batch` request for all lines: `return_quantity > 0` → POST (new) or PUT (existing, has `item_return_item_id`); `return_quantity === 0` on a previously-saved line → DELETE. Mirrors `RequisitionFromComponent`'s `updateBatchRequest` pattern.

**Edit-mode line hydration** (`editItemReturn`): `previously_returned` must exclude *this return's own* already-merged contribution if the return is already `APPROVED` (its `return_quantity` is already folded into `purchase_requisition_items.return_quantity` by the approve hook) — otherwise "Remaining Qty" would double-subtract:
```typescript
const previouslyReturnedExcludingThis = isApprovedAlready
  ? Math.max(0, previouslyReturned - returnQuantity)
  : previouslyReturned;
```

### Model (`@shared/model/itemReturn.ts`)
```typescript
purchase_requisition_id, department_id, requested_by, reason, return_date,
status = 'PENDING', is_received = false, custom_id
```
`toOdata()` strips relation objects (`purchaseRequisition`, `department`, `requestBy`, `returnItems`) and timestamps. `is_received` defaults `false` in the model specifically because the DB column is non-nullable with no client-supplied value otherwise — same Lodata gotcha as above, fixed frontend-side here instead of loosening the column.

### Permissions
`STORE_ITEM_RETURN`, `STORE_ITEM_RETURN_CREATE`, `STORE_ITEM_RETURN_EDIT`, `STORE_ITEM_RETURN_DELETE` (unused now — no delete UI), `STORE_ITEM_RETURN_VIEW`. Seeded in both `PermissionSeeder` and `BtlPermissionSeeder`.

### Not implemented (considered, rejected during design)
- A Logs/Items tab container — removed; approve/reject activity is logged server-side (`ActivityLogs`) but not surfaced in this dialog.
- Server-side `PermissionRegistry` enforcement for the `ItemReturns` OData entity set — left client-side-only permission gating, consistent with `PurchaseRequisitions` (which also has no registry entry).
