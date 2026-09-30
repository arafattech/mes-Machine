# Store Management — Local Material Receipt (MRR)

## Files

```
local-material-receipt/
├── local-material-receipt.component.ts   ← local MRR list
├── local-material-receipt.component.html
├── local-material-receipt.component.scss
└── mrr-from/
    ├── mrr-from.component.ts   ← shared MRR create/edit dialog (items grid = ag-grid)
    └── mrr-from.component.html
```

## Route
`/store/local-material-receipt` — guard: `STORE_LOCAL_MRR`

---

## LocalMaterialReceiptComponent

### Selector
`app-local-material-receipt`

### Purpose
Lists Material Receipt Records for locally-sourced POs (`source eq 'LOCAL'`). Supports create, view, and PDF generation.

### Layout — dashboard-style redesign (no longer an AG Grid list of MRRs)

Rebuilt away from a full AG Grid "list of MRRs on the left" toward a **selector bar + item-progress panel + log grid** layout (reference: a Dribbble inventory-dashboard design the user linked). Top-to-bottom / left-to-right:

1. **Selector bar** (`flex` row, top): a searchable `ui5-combobox` (`mrrOptions`, debounced `onMrrSearchInput`) to pick which MRR to view, a row of plain `ui5-button` status toggles (All / Partial / Completed / Cancelled — **not** `ui5-segmented-button`, see gotcha below) with a small inline `ui5-busy-indicator[size="S"]` sitting right next to them, a **centered summary tile** (Received/Due — see below), then **info** / **edit** / PDF / New action buttons on the right.
   - **info** icon → `viewItem(selectedMrr)` → full `MRRFromComponent`, always `readOnly = true` (pure view-only, any status).
   - **edit** icon (next to info) → `editMrr(selectedMrr)` → the same full `MRRFromComponent`, but **editable** (`readOnly` only when `COMPLETED`/`CANCELLED`) — lets the user change header fields (supplier, PO, dates, invoice/LC/vehicle no) and the full items grid, not just one product's receiving qty.
   - The log grid's own "Receive" button (and clicking a left-panel card then wanting to receive) instead opens `ReceiveQtyFormComponent` (`openReceiveDialog()`) — a separate, minimal single-product dialog, not the full form. `editMrr()` and `openReceiveDialog()` are two distinct entry points into two different dialogs — don't conflate them.

**Centering trick**: two `<div class="flex-1"></div>` spacers, one on each side of the summary tile — since both grow equally, the tile lands visually centered without needing a 3-column grid layout. The tile itself (`*ngIf="selectedMrr"`) shows `Received: {{ totalReceivedQty }}` / `Due: {{ totalDueQty }}` (an `Items: {{ productProgressList.length }}` field was tried and dropped per explicit feedback — just the two quantity totals), and turns green (`border-green-300 bg-green-50 text-green-700`) when `totalDueQty === 0 && totalRequiredQty > 0` — i.e. everything on the MRR has been fully received.
2. **Left panel** (`grid-cols-[320px_1fr]`, fixed 320px): one card per product in the selected MRR, each showing product name, `received/required` text, and a `ui5-progress-indicator` (`valueState: 'Positive'` once ≥100%).
3. **Right panel**: the MRR Log grid (unchanged design/columns) + the 4-tile summary strip below it (unchanged from the prior iteration).

There is **no more "list of all MRRs" grid** on this page — `MaterialReceipts` are now only reachable via the combobox. `AgGridActionCellRendererComponent`/`AgGridStatusBadgeComponent`/`AgGridTableRowAction` imports were dropped along with the old grid/columns/dataSource/toolbarConfig/displayConfig/segmentButtonItems/`agGridRef`/`buildColumns()`/`onMrrDataLoaded()`.

**`ui5-segmented-button` gotcha (same one documented in `calender-management/context.md`)**: its `pressed` state is driven by the component's own internal click handling, not by external `[attr.pressed]`/property bindings — binding `[pressed]="statusFilter === 'x'"` will not visually reflect programmatic state changes. Used plain `ui5-button`s with `[design]="statusFilter === 'x' ? 'Emphasized' : 'Default'"` instead, exactly like the calendar's bonus-mode toggle fix.

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `mrrOptions` | `any[]` | Combobox source — full `MaterialReceipts` records (same `EXPAND` as the old list `dataSource`), refetched on search/status-filter/save |
| `selectedMrrLabel` | `string` | Combobox `[value]` — set to `custom_id` on selection |
| `statusFilter` | `'all'\|'partial'\|'completed'\|'cancelled'` | Drives the OData `$filter`; default `'partial'` |
| `selectedMrr` | `any` | Currently viewed MRR (full record from `mrrOptions`) |
| `saveMode` | `'POST'\|'PUT'` | Create vs update |
| `selectedData` | `any` | Row passed to MRR dialog |
| `formRef` | `MRRFromComponent` | `#MRRFrom` |
| `mrrLogGridRef` | `AgGridTableComponent` | `#mrrLogGridRef` |
| `loading` | `boolean` | Set `true`/`false` (including in every error path) around `getMrrOptions()`, `onMrrChange()`, and `refreshMrrLog()` — see "Loading indicator" below |

### Loading indicator — small inline, not a full-page overlay

`loading` toggles a single `ui5-busy-indicator[size="S"]` placed inline right after the status-filter
button row (`[delay]="0" [active]="loading"`). Deliberately small and scoped to the toolbar, not a
full-page skeleton/spinner overlay — a skeleton-loader and a full spinner-overlay design were both
tried during this work and reverted; the small inline indicator next to the status buttons is the
final state. Covers the three fetches that can take a moment (`getMrrOptions()`, `onMrrChange()`,
`refreshMrrLog()`), including their error branches, so it never gets stuck "on" after a failed request.

### Permissions

| Permission | Effect |
|------------|--------|
| `STORE_LOCAL_MRR_VIEW` | Shows the info/PDF icon buttons in the selector bar |
| `STORE_LOCAL_MRR_CREATE` | Shows the New button |

### Key Methods

| Method | Description |
|--------|-------------|
| `getMrrOptions(search?)` | Fetches `MaterialReceipts?$filter=source eq 'LOCAL'{status}{search}&$expand=...&$orderby=custom_id desc&$top=50`. When there's no search term: if an MRR is already selected, re-finds and reassigns `selectedMrr` to its freshly-fetched copy (see gotcha below); otherwise auto-selects the first result. |
| `onMrrSearchInput(event)` | Debounced (300ms) → `getMrrOptions(value)` |
| `onStatusFilterChange(status)` | Sets `statusFilter`, clears selection + log state, refetches `mrrOptions` |
| `onMrrChange(event)` | Looks up the picked combobox id in `mrrOptions` (already full records — no extra fetch needed), sets `selectedMrr`, builds the log product-filter options, calls `refreshMrrLog` |
| `newItem()` | Opens form POST mode; calls `formRef.reset()` + `formRef.getCustomId()` |
| `viewItem(event)` | Opens form PUT mode **always readonly** (`info` icon in the selector bar) — pure view-only, regardless of MRR status |
| `openReceiveDialog()` | Looks up the currently `selectedProductId` inside `productProgressList`, no-ops if either is unset, then calls `receiveFormRef.openFor(selectedMrr, item)` — wired to the log grid's own "Receive" button (`showNewButton:true`, `addButtonText:'Receive'`, `(newButtonClick)`) |
| `editMrr(event)` | Opens the full `MRRFromComponent` PUT-editable (`readOnly` only when `COMPLETED`/`CANCELLED`) — wired to the selector bar's **edit** icon; no-ops if `!event?.id` |
| `openPdf(row)` | POST `store/material-receipts/${row.id}/pdf` as blob; opens in new tab; fallback to `<a download>` |
| `saveEvent()` | Refetches `mrrOptions` AND refetches the MRR Log for the just-saved MRR directly (see below) — does NOT rely on any grid reselect timing |

### Left panel — item progress cards, click-to-filter the log

**Sourced from `productProgressList` (receiptItems + purchaseOrder.poItems), NOT from the log.** Originally built from `latestLogPerProduct` (derived from `mrrLogAllRows`) — but a just-created MRR has **zero** `MaterialReceiptLog` rows (see "Create is header-only" above: creation never logs, never receives), so the left panel showed nothing at all for a brand-new MRR. `productProgressList` instead reads `selectedMrr.receiptItems` directly (already loaded via the `EXPAND` string on `mrrOptions` — no extra fetch), matches each receipt item's `po_item_id` against `selectedMrr.purchaseOrder.poItems` for `required_quantity`, and — since `syncReceiptItems()`/`createReceiptItemsShell()` both **append** a new `MaterialReceiptItem` row per event rather than updating one in place — takes the **latest (highest `id`) row per `product_id`** for `received_quantity`. This means every product on the MRR shows up at 0% immediately after creation, before anything has ever been received.

**Search bar + count above the list** (`*ngIf="selectedMrr"`, `shrink-0`, above the scrollable card list): a `ui5-input` (search icon slot) bound to `productSearchTerm`/`onProductSearchInput()`, client-side filtering `productProgressList` by `product_name` (case-insensitive `includes`) via the `filteredProductProgressList` getter — no debounce/server round-trip needed since the data is already fully loaded in memory. Next to it, a `{{ filteredProductProgressList.length }}/{{ productProgressList.length }}` count label. The card list itself moved into its own `flex-1 overflow-y-auto` inner div (was on the outer container) so the search bar stays fixed/visible while only the cards scroll. Two distinct empty states: "No items on this MRR" (`productProgressList` itself is empty) vs "No products match your search" (items exist but the filter matched none).

**`min-h-0` needed at every level of this flex/grid chain for the scroll to actually clip.** Flex (and grid) items default to `min-height: auto`, which means a flex item won't shrink below its content's natural height even when the container has a fixed/constrained height — so `overflow-y-auto` on the innermost scroll div was a no-op until `min-h-0` was added on: the `grid grid-cols-[320px_1fr]` body row, the left panel's `h-full flex flex-col` wrapper, and the `flex-1 overflow-y-auto` card-list div itself. Without it, the whole left panel (and the page) just grew taller instead of scrolling once the card list overflowed.

**Left panel + bottom-strip tiles background follows the SAP native theme (light/dark), via inline `style`, not a Tailwind arbitrary class.** An earlier attempt used `bg-[var(--sapTile_Background,#fff)]`/`border-[var(--sapTile_BorderColor,#d9d9d9)]` Tailwind arbitrary-value classes and it silently failed to render white in light theme (root cause not fully isolated — Tailwind's arbitrary-value class generation and the `var(...,fallback)` comma syntax don't always play well together depending on build config). Reverted to plain `bg-white`/`border-slate-200` at the time. Now re-implemented using the confirmed-working convention from `notification.component.html` — a literal `style="background: var(--sapTile_Background, #fff); border: 1px solid var(--sapTile_BorderColor, #d9d9d9);"` attribute (or `[style]` binding for the per-card conditional case) — applied to: the left panel wrapper, each unselected card (selected cards keep the Tailwind `border-blue-500 bg-blue-50` highlight, styled via `[ngClass]`, with `[style]` set to `''` in that branch so the inline background doesn't fight the Tailwind selected-state background), and all 5 tiles in the bottom-of-log-grid strip. The top selector-bar Received/Due tile still uses Tailwind `bg-white`/`border-slate-200` (with a `border-green-300 bg-green-50` swap when fully received) — not yet converted, only the left panel + bottom strip were per this request.

Each card: product name (`item.product?.product_name`), a `received_quantity/required_quantity` fraction (e.g. `12/12`) — tried a "Received: X · Due: Y" text variant first, reverted to the plain fraction per explicit feedback — and `progressPercent(item)` (`min(100, round(received/required*100))`) fed into `ui5-progress-indicator`. Empty-state label reads "No items on this MRR" (not "No items received yet" — a product with 0 received is still shown, so that copy would have been misleading).

**`trackBy` is required on the `*ngFor` — without it, every card (and its `ui5-progress-indicator`) re-renders on every click anywhere on the page, not just when data actually changes.** `productProgressList` is a *getter*, re-evaluated on every Angular change-detection cycle — which fires on essentially any click, including clicking a card itself — and it builds a brand-new array of brand-new plain objects each time. Angular's default `*ngFor` identity check (no `trackBy`) compares by object reference, so on every CD tick it sees "all items are new," destroys every card's DOM (progress bar included), and recreates it — visible as the whole left panel flickering/re-rendering on every click. Fixed with `trackByProductId(_index, item) { return Number(item.product_id); }` + `*ngFor="let item of productProgressList; trackBy: trackByProductId"` — Angular now diffs by `product_id` and only touches DOM nodes whose underlying value actually changed.

**Cards are clickable and drive the log grid's row filter.** `selectedProductId` tracks which product is active; clicking a card calls `selectProduct(productId)`, which filters `mrrLogAllRows` down to that product and pushes it into the grid via `mrrLogGridRef.getGridApi().setGridOption('rowData', rows)` (same mechanism the toolbar's "Filter by Product" dropdown already used in `onMrrLogToolbarAction` — both now keep `selectedProductId` in sync so the left-panel highlight and the toolbar dropdown never show a different product than what's actually filtered). Selected card gets `border-2 border-blue-500 bg-blue-50` vs the unselected `border border-slate-200` (the static `border` utility was pulled out of the base class into the `ngClass` ternary itself — combining a static `border` with a conditional `border-2` on the same element is unreliable in Tailwind, so border-width must come from one place).

**Type-coercion gotcha for the selected/highlight comparison**: `item.product_id` and `selectedProductId` must both be compared as `Number` — `selectProduct()` always does `this.selectedProductId = Number(productId)`, and the template's `ngClass` uses `selectedProductId === +item.product_id` (unary `+`) rather than a bare `===`, so a numeric-string vs number mismatch from JSON serialization can't silently break the highlight.

**Stale `selectedMrr` bug — "browser refresh needed to see the new received qty" — fixed.** `saveEvent()` (fired after a successful receive) already called `getMrrOptions()` to refetch `mrrOptions`, but never reassigned `this.selectedMrr` itself — since `productProgressList`/the summary tiles all read `selectedMrr.receiptItems` directly, the component kept rendering the pre-receive numbers from the old object reference until something (e.g. a full page reload) forced a brand-new `selectedMrr`. Fixed in `getMrrOptions()`: when there's no search term and an MRR is already selected, find its updated copy in the freshly-fetched `mrrOptions` and reassign `this.selectedMrr = refreshed` (falls through without touching `selectedProductId`/log state).

**First product auto-selected on MRR selection — set synchronously in `onMrrChange()`, not inside the async log fetch.** Originally computed from `latestLogPerProduct[0]` inside `refreshMrrLog()`'s `.subscribe()` callback — which meant a never-received MRR (empty log) could never auto-select anything. Now `onMrrChange()` sets `selectedProductId` from `productProgressList[0]` immediately (synchronous, no network round-trip needed since `productProgressList` only needs the already-loaded `selectedMrr`), and `refreshMrrLog()`'s job is reduced to just filtering `mrrLogAllRows` by whatever `selectedProductId` already is — it no longer decides the selection itself.

**Why the log-filtering itself still must be baked into the `mrrLogDataSource` assignment, not a follow-up `setGridOption` call**: assigning `mrrLogDataSource` triggers the grid's own `ngOnChanges` → `refreshGridData(true)` reload asynchronously (next change-detection tick), so a synchronous `setGridOption('rowData', filtered)` call made right after the assignment executes *before* that reload runs and gets silently overwritten by it moments later. `selectProduct()` (used for *later* clicks, once the grid is already stable/idle) is safe to call via direct `setGridOption` because there's no simultaneous dataSource reassignment in flight at that point.

### MRR Log panel (right column)

Selecting an MRR (`onMrrChange`) loads `MaterialReceiptLogs?$filter=material_receipt_id eq {id}&$expand=product,receivedBy` into `mrrLogAllRows` (a private array) and mirrors it into `mrrLogDataSource` (`staticData: true`) for the log grid. Log table columns: Product / Required Qty / Received Qty / **Day Received** / Date / Received By / Remark. "Day Received" = the log row's own `receiving_quantity` (what was submitted in that specific transaction) — distinct from "Received Qty" (`received_quantity`), which is the cumulative-within-this-MRR running total as of that row.

**`saveEvent()` gotcha — don't rely on grid reselect timing to refresh the log.** The pre-redesign implementation nulled `selectedMrr` after save and depended on the (now-removed) MRR list grid's "select first row" fallback to re-trigger a log refetch. That's a race: "first row" isn't necessarily the MRR just edited. Fixed by capturing `mrrId = selectedMrr?.id ?? selectedData?.id` and calling `refreshMrrLog(mrrId)` directly in `saveEvent()` — this survived the redesign unchanged.

**Summary tiles below the log grid — all scoped to the selected PRODUCT** (`*ngIf="selectedMrr && selectedProductItem"`, `grid-cols-5` strip). All 5 tile boxes use the same SAP-native inline `style` background/border as the left panel (see below) rather than Tailwind `bg-white`/`border-slate-200`:

| Tile | Source | Scope | Logic |
|------|--------|-------|-------|
| `{{ product_name }}` — Required | `selectedProductItem.required_quantity` | Selected product | Required qty for whichever product card is currently selected |
| Received | `selectedProductItem.received_quantity` | Selected product | Received qty for that same product |
| Due | `dueQty(selectedProductItem)` | Selected product | `max(0, required_quantity - received_quantity)` for that product |
| Days Taken | `daysTakenToReceive` | Selected product | **Count of distinct calendar days** (not a quantity) on which the selected product had a receiving event logged — `new Set(mrrLogAllRows.filter(product match).map(row => toDateString))`. Went through 3 iterations before landing here: MRR-wide quantity sum → per-product quantity sum for "today" → finally reinterpreted per explicit clarification as "how many days did it take to receive this product", i.e. a day-count, not a received-quantity figure at all. |
| Current Stock | `selectedProductItem.product?.current_stock` | Selected product | Straight from the `Product.current_stock` column, already present on `receiptItem.item` (no extra fetch — `current_stock` is a guarded-none column so Lodata returns it on the already-expanded `receiptItems($expand=item(...))` relation without needing `$select`) |

`selectedProductItem` (getter): `productProgressList.find(item => Number(item.product_id) === selectedProductId)`. All 4 tiles in this strip are now scoped to the selected product — superseded the original MRR-wide 4-tile strip (Recently Received / Receiving Qty / Total Received / Due, all log-based, whole-MRR). The separate MRR-wide totals (`totalReceivedQty`/`totalDueQty`/`totalRequiredQty`) still drive the **top selector-bar** tile (Received/Due) independently.

**Selected card's product name is highlighted**: `font-bold` always, `text-blue-700` when `selectedProductId === +item.product_id` else `text-slate-900` — on top of the existing card-level `border-2 border-blue-500 bg-blue-50` selection styling, so the name itself visually stands out, not just the card border/background.

`mrrLogDisplayConfig.gridHeight` is `calc(100vh - 190px)` — one strip below the grid only, nothing above it.

**`totalReceivedQty`/`totalRequiredQty` are sourced from `productProgressList`, not `latestLogPerProduct`** — same reasoning as the left-panel cards: a just-created MRR has no logs yet, so log-based totals would show `0/0` even though the MRR clearly has required quantities. `latestLogPerProduct` (log-based) is still used for `mostRecentLog`/`todayReceivedQty`, which are legitimately about receiving *events* and should show nothing/zero until an event has actually happened.

### PDF Open Logic
```typescript
POST store/material-receipts/${row.id}/pdf → blob
→ URL.createObjectURL(blob)
→ window.open(pdfUrl, '_blank')
→ fallback: <a href download> if popup blocked
→ setTimeout(revokeObjectURL, 100)
```

### Important Caveats
- `MRRFromComponent` shared with `ImportedMaterialReceiptComponent` — same dialog, same `#MRRFrom` ref name.
- `gridId="mrr-log-list-v2"` — the log grid's own column-state localStorage key (the old MRR-list grid's `gridId="local-mrr-list"` no longer exists, that grid was removed).

---

## ReceiveQtyFormComponent (`local-material-receipt/receive-qty-form/`) — shared local/imported

### Selector
`app-receive-qty-form`

### Purpose
A deliberately minimal dialog for receiving **one product** against the currently selected MRR — MRR (readonly), Product (readonly), Required Qty (readonly), Received Qty (readonly, cumulative-to-date), Receiving Qty (the only editable field). Opened via `openFor(mrr, item)` — no `@Input`s, driven entirely through a public method + `#receiveForm` ViewChild, same shape as `MRRFromComponent`'s `open`/`reset()` pattern but far smaller.

### Why this exists instead of reusing `MRRFromComponent`
The full form always shows every PO line item and every header field (supplier, PO, dates, invoice/LC/vehicle no). The left-panel item-progress cards' "Receive"/edit actions needed a fast, single-purpose action scoped to whichever product card is currently selected — not a detour through the full header+items form. `MRRFromComponent` is still used for **create** (`newItem`) and **readonly view** (`viewItem`, always `formRef.readOnly = true` now — see above).

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `mrrLabel` / `productName` | `string` | Readonly display fields, set in `openFor()` |
| `requiredQuantity` / `receivedQuantity` | `number` | Readonly, from the selected `productProgressList` item |
| `receivingQuantity` | `number` | The only editable field — `ui5-step-input` (`+`/`-` buttons), `min=0`, `[max]="remainingQuantity"` |
| `remainingQuantity` | getter | `max(0, requiredQuantity - receivedQuantity)` |
| `isOverLimit` | getter | `receivingQuantity > remainingQuantity` — drives the step-input's `Negative` value-state + message |
| `canSubmit` | getter | `!loading && receivingQuantity > 0 && !isOverLimit` — drives `[disabled]` on the Submit button |

`onReceivingQuantityChange(event)` reads `event.target.value` from the step-input's `(change)` — same pattern as `AgGridStepInputCellRendererComponent`'s `onChange`. `ui5-step-input` needs its custom element explicitly registered via `import '@ui5/webcomponents/dist/StepInput.js';` in the component (not otherwise loaded app-wide — same reason the AG Grid step-input cell renderer has its own local import).

### Save flow
`save()` POSTs `store/material-receipts/{mrrId}/receive` with just `{ product_id, receiving_quantity }` — no items array, no header fields. On success emits `saveEvent` (both parent components wire this straight to their existing `saveEvent()`, which already refetches `mrrOptions` + `refreshMrrLog()` — no new refresh logic needed).

### Backend — `MaterialReceiptController::receiveSingleItem()` (`POST store/material-receipts/{materialReceipt}/receive`)

Deliberately does **not** reuse `resolveReceiptStatus()` (which only looks at whatever `items` array the client submitted) — a single-product payload would otherwise let one fully-received product prematurely flip the whole MRR to `COMPLETED` while other products are still pending, or vice versa.

Flow:
1. Reject if MRR is already `CANCELLED` or `COMPLETED`.
2. Validate `product_id`/`receiving_quantity`.
3. **Everything else runs inside one `DB::transaction` with `lockForUpdate()`** on both the `PurchaseOrderItem` row and the latest `MaterialReceiptItem` row for that product — find the matching PO item by `product_id` (requisition-only MRRs with no linked PO aren't supported by this endpoint — matches the full form's existing PO-only sourcing of `required_quantity`), look up this MRR's own previously-logged `received_quantity` for that product, cap the new `receiving_quantity` at `poItem->quantity - poItem->received_quantity`.
4. Call the private `syncReceiptItems()` method with a one-item array — this is now the **only** caller of `syncReceiptItems()` (neither `store()` nor `update()` call it anymore — see below).
5. `refreshReceiptStatus()` (new private method): recomputes `PARTIAL`/`COMPLETED` from **every** PO item's current `received_quantity` vs `quantity`, freshly queried from DB — this is what avoids the single-product status bug described above.
6. `markRequisitionCompleteIfNeeded()` (existing, unchanged) runs against the freshly-recomputed status.

**Race-condition bug fixed**: the PO-item/previously-received reads originally happened *before* the transaction (unlocked) — two near-simultaneous submits (e.g. an accidental double-click on Submit) could both read the same stale "previously received" figure and both insert a row, silently double-counting (symptom: one submitted quantity produces two log rows that don't match what was typed). Fixed by moving those reads inside the transaction under `lockForUpdate()`, so a second request now waits for the first to commit and reads the updated state. The frontend `ReceiveQtyFormComponent.save()` also gained a `if (this.loading) return;` reentrancy guard for the same reason (belt-and-suspenders, not a substitute for the DB-side lock).

**Cumulative-vs-delta increment bug fixed (this is the "false exceed limit" bug)** — `syncReceiptItems()` was incrementing `PurchaseOrderItem.received_quantity` and `Product.current_stock` by `$cumulativeReceived` (`previouslyReceived + newlyReceiving`, i.e. the *running total*) on every single call, instead of by just the newly-received delta. Both of those columns are themselves already-cumulative counters, so every receive after the first one multiply-counted everything received before it — e.g. required 5: receive 4 → `poItem.received_quantity` correctly becomes 4; receive 1 more → `previouslyReceived=4`, `cumulativeReceived=5`, but the old code incremented the counter *by 5* (→ 9 total) instead of by the actual delta of 1 (→ 5 total). The next `remaining = quantity - received_quantity` check then computed a negative/zero remaining and rejected an obviously-valid receive. Fixed by incrementing both `PurchaseOrderItem.received_quantity` (in `syncReceiptItems()`) and `Product.current_stock`/`StockAdjustment.adjustment_quantity` (`applyStockIncrease()`, which now takes an explicit `int $quantityDelta` parameter instead of reading `$receiptItem->received_quantity`) by `$newlyReceiving` only. **Any PO item that already went through more than one receive event before this fix has a corrupted (inflated) `received_quantity` value in the DB** — this fix only stops it from getting *worse*, it does not retroactively repair already-corrupted rows. If a specific product still shows a false "exceeds remaining" error after this fix, that PO item's `received_quantity` needs a one-off manual recompute (sum of the *latest* `MaterialReceiptItem.received_quantity` per MRR for that PO item, across all non-cancelled receipts).

**`rollbackStock()` removed entirely** — it used to run at the top of `update()`, deleting every `MaterialReceiptItem`/`StockAdjustment` row and decrementing `Product.current_stock`/`PurchaseOrderItem.received_quantity` by each row's *cumulative* `received_quantity` (the same cumulative-vs-delta bug class described above, just never fixed for this path since it was believed unreachable). Once `update()` became reachable again via `editMrr()` (see "Header-only edit" below), this destructive rebuild became a real, live bug — editing an MRR's header would silently wipe and attempt to re-derive its entire receiving history from whatever was sitting in the (now always-disabled) items grid, producing bogus "exceeds PO limit" validation errors against quantities that were never actually being resubmitted correctly. Fixed by deleting `rollbackStock()` and `validateReceiptQuantities()` outright and making `update()` never touch items/stock at all (see below) — there was no reason to keep a rebuild path around once receiving moved exclusively to `receiveSingleItem()`.

### Create is header-only — no logs, no stock, zero received

Explicit design decision: creating a new MRR (`store()`) only establishes the header + one `MaterialReceiptItem` row per PO item for required-qty tracking, **always `received_quantity: 0`** — no `MaterialReceiptLog` row, no `Product.current_stock` increment, no `PurchaseOrderItem.received_quantity` increment. Actual receiving happens afterward, exclusively through `receiveSingleItem()` (the "Receive" dialog) — never through `store()` or `update()`.

### `update()` is header-only too — never touches items/stock/PO-item counters

`editMrr()` (the selector bar's **edit** icon, see above) reopens `MRRFromComponent` in editable PUT mode so the user can change supplier/PO/dates/invoice/LC/vehicle-no/remarks — but the items grid's Receiving Qty column is **unconditionally `disabled: true`** now (`tableColum()` no longer takes a `readOnly` param at all — it was only ever used for that one field), for both create and edit. Consequently `update()` was rewritten to match `store()`'s "header-only" philosophy:

- No longer calls `rollbackStock()` (deleted) or `syncReceiptItems()` — `$materialReceipt->update($receiptData)` only, nothing else.
- Status is **preserved** (`$materialReceipt->status`) rather than recomputed from the submitted `items` array via `buildReceiptData()`'s `resolveReceiptStatus()` — that computation is meaningless once items aren't being touched. Only an explicit `status: 'CANCELLED'` in the payload overrides this.
- `validateReceiptQuantities()` (the PO-limit check) was deleted outright — it doesn't make sense to validate receiving quantities on an endpoint that no longer changes them.
- `MRRFromComponent.validateForm()`'s old PUT-mode check ("at least one received quantity must be greater than 0") was removed for the same reason — since receiving is never submitted through this form anymore, that check would have permanently blocked every header-only edit. Both save modes now just require the PO actually has line items.

**Why this matters — the bug this fixed**: with the old `update()` (rollback-then-resync-everything), simply editing an MRR's supplier name would delete all its `MaterialReceiptItem` history, decrement stock/PO counters using the buggy cumulative-not-delta math, then try to re-derive everything from the items grid — which, since the grid was already receiving-locked by this point in the redesign, resubmitted stale/zeroed quantities and tripped the PO-limit validation with confusing numbers (e.g. "already received: 0" for a product that clearly had received quantity shown elsewhere in the UI). Header edits and receiving are now fully decoupled: editing a header field can never affect stock, PO counters, or receiving history, in either direction.

- Backend: `store()` no longer calls `syncReceiptItems()` at all — it calls the new `createReceiptItemsShell()`, which unconditionally writes `received_quantity: 0` / `previous_received_quantity: 0` per item and does nothing else (no log, no stock, no PO-item increment), ignoring whatever `receiving_quantity` the client payload happens to contain. `buildReceiptData()`'s computed status is forced to `PARTIAL` (or `CANCELLED` if explicitly requested) rather than trusting `resolveReceiptStatus($payload['items'])` — nothing has been received yet, so it can never be `COMPLETED` at creation.
- Frontend (`MRRFromComponent`): `getPO()` (the PO-selection step during create) now seeds every row with `receiving_quantity: 0` instead of defaulting to the full `remaining` amount — previously, submitting the create form untouched would silently receive everything immediately. The "Receiving Qty" stepInput column is `disabled` whenever `saveMode === saveMode.POST` (create), on top of the existing `readOnly` gate — receiving is not editable at create time at all, only after the MRR exists. `validateForm()` no longer requires "at least one received quantity > 0" when creating (only that the PO has at least one item) — that check still applies to the (currently unreachable) PUT path.

## MRRFromComponent (shared local/imported MRR dialog)

### Selector
`app-mrr-from`

### Inputs

| Input | Type | Default | Purpose |
|-------|------|---------|---------|
| `saveMode` | `'POST'\|'PUT'` | `'POST'` | Create vs edit mode |
| `source` | `'LOCAL'\|'IMPORTED'` | `'LOCAL'` | Determines which socket event to emit and which Lodata filters/fields apply |

### Items grid — `app-ag-grid-table`
Client-side editable grid driven by a static `dataSource`, not OData.

| Aspect | Detail |
|--------|--------|
| `#childComponentRef` | `AgGridTableComponent` |
| `dataSource` | `{ type:'odata', endpoint:'', staticData:true, data:[] }` — rows live in `selectedItem` |
| `toolbarConfig` | `headerTitle:'Items'`, `showSearch`, `showRowCount`, no New button |
| Field labels | "PI/Indent List"; "Supplier Name" with a "+" add icon button beside the combobox (`openSupplierCreate` → shared `app-supplier-form`) |
| Receipt Date | date picker uses `[attr.max-date]="todayFormatted"` — future dates disabled |
| Imported-only fields (rendered when `source==='IMPORTED'`) | "Commercial Invoice No"; "L/C No"; **"Vehicle No"** (`vehicle_no`, optional) |
| `displayConfig` | `gridHeight: 'calc(100vh - 560px)'` |
| Columns | `item_code`, `product_name`, `uom.name` (colId dot notation), `required_quantity` (read-only), `received_quantity` (read-only), `receiving_quantity` (step-input inline editor), `remark` (input inline editor) |
| Editing | Always-visible inline controls — `inlineEditor` column config drives the renderers |
| Actions | none (`showAction=false`) — items come from the selected PO |

### Always-on inline controls (shared, reusable)
Set on a column via `inlineEditor` (`AgGridTableColumn.inlineEditor`), rendered in every row:

| Config | Renderer | Notes |
|--------|----------|-------|
| `{ type:'stepInput', min, max?, maxField?, step?, disabledWhenMaxZero? }` | `AgGridStepInputCellRendererComponent` | `receiving_quantity` uses `maxField:'remaining_quantity'` + `disabledWhenMaxZero` |
| `{ type:'input', placeholder?, maxLength? }` | `AgGridInlineInputCellRendererComponent` | `remark` free text |

### Supplier quick-create (reuses `app-supplier-form`)
- The "+" button beside Supplier Name combobox (`openSupplierCreate`) opens the shared `SupplierFormComponent` (`#supplierForm`).
- `SupplierFormComponent` emits `@Output() supplierAdded: EventEmitter<Supplier>`; `autoSupplierAdded()` prepends the new supplier to `supplierList` and auto-selects it.

### Data flow
- `syncDataWithGridTable()` reassigns `dataSource` (`{...dataSource, data:[...selectedItem]}`) → ag-grid reloads static rows after `getPO()` / `getReceiptPopulated()`.
- `onSaveType()` and `validateForm()` call `getGridRows()` (grid node data → fallback `selectedItem`); `onSaveType()` first calls `childComponentRef.stopEditing()`.

### `getPOList()` — filtered by `is_imported`, and an `@Input` timing gotcha
`getPOList()` queries `PurchaseOrders?$filter=... and is_imported eq {true|false}` based on `this.source`, so the "PI/Indent List" combobox only shows LOCAL POs in the local dialog and IMPORTED POs in the imported one.

**Gotcha**: `getPOList()` is called once in the constructor — but Angular sets `@Input() source` *after* the constructor runs, *before* `ngOnInit`. So the constructor-time call always saw the default `source='LOCAL'`, regardless of which parent (`ImportedMaterialReceiptComponent`) actually instantiated the dialog. Fixed by also calling `getPOList()` from `reset()` (invoked by both parents' `newItem()`, by which point `source` is correctly bound). `ngOnInit()` itself is still empty — don't rely on it here.

---

## Real-Time Notification (Socket Emit on MRR Create)

`MRRFromComponent` emits a socket event after a successful **POST** (create). The event is source-aware: LOCAL MRR and Imported MRR emit different socket events, which map to different permission strings and notification messages.

### Key properties (notification-related)

| Property | Type | Purpose |
|----------|------|---------|
| `newSrData` | `{ id: number; custom_id?: string } \| null` | Stores the newly created receipt from the API response; cleared after socket emit in `afterSuccessSave()` |
| `authUser` | `User` | Logged-in user from `AuthService`; provides `sender_id` / `sender_name` for the socket payload |

### Flow

```
POST store/material-receipts → success response
  → newSrData = { id: response.id, custom_id: response.custom_id }
  → afterSuccessSave()
      → loading=false, toast, CloseDialog(), saveEvent.emit()
      → triggerSrNotification(newSrData) [if newSrData set]
          → socketService.emit(event, payload)
      → newSrData = null
```

### `triggerSrNotification(sr)`

```typescript
private triggerSrNotification(sr: { id: number; custom_id?: string }): void {
  const event = this.source === 'IMPORTED'
    ? 'store-importedmrr:created'
    : 'store-localrrm:created';
  this.socketService.emit(event, {
    model_id: sr.id,
    model_custom_id: sr.custom_id ?? sr.id,
    sender_id: this.authUser.id,
    sender_name: this.authUser.name,
  });
}
```

Only fires on `saveMode === saveMode.POST` (create). PUT (edit) does not trigger a notification.

### Socket event → permission mapping

| `source` | Socket event emitted | Permission string | PERMISSION_MAP key |
|----------|---------------------|-------------------|--------------------|
| `'LOCAL'` | `store-localrrm:created` | `STORE_LOCAL_MRR_CREATE_NOTIFICATION` | `MaterialReceipt:LOCAL:created` |
| `'IMPORTED'` | `store-importedmrr:created` | `STORE_IMPORTED_MRR_CREATE_NOTIFICATION` | `MaterialReceipt:IMPORTED:created` |

### Backend DB persistence (Laravel Observer)

`Backend/app/Observers/MaterialReceiptObserver.php`, registered in `AppServiceProvider`.

`MaterialReceipt` model has a `getTypeAttribute()` that returns `$this->attributes['source'] ?? ''`. This lets `NotificationService::dispatch()` build the key `MaterialReceipt:LOCAL:created` or `MaterialReceipt:IMPORTED:created` for the PERMISSION_MAP lookup.

> **Lodata gotcha**: uses `saved()` + `wasRecentlyCreated` to fire reliably inside Lodata's DB transaction (same pattern as `DepartmentObserver`).

### Services injected (notification-related)

| Service | Usage |
|---------|-------|
| `SocketService` | `emit(event, payload)` — sends to node-server |
| `AuthService` | `user()` — reads logged-in user for sender info |
