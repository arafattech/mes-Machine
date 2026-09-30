# Purchase Management — Comparative Study

## Separate Component Docs
- [COMPARATIVE_STUDY_LIST_COMPONENT_CONTEXT.md](COMPARATIVE_STUDY_LIST_COMPONENT_CONTEXT.md) — `ComparativeStudyComponent` two-panel list doc with TS, HTML, SCSS, selector, datasources
- [COMPARATIVE_QUOTE_FORM_COMPONENT_CONTEXT.md](COMPARATIVE_QUOTE_FORM_COMPONENT_CONTEXT.md) — embedded quote detail/edit and create-PO dialog doc

## Files

```
purchese-management/comparative-study/
├── comparative-study.component.ts
├── comparative-study.component.html
└── comparative-study.component.scss
```

## Route

| Path | Component | Permission |
|------|-----------|------------|
| `purchase/comparative-study` | `ComparativeStudyComponent` | `PURCHESE_SR_REQUEST` |

---

## ComparativeStudyComponent

### Selector
`app-comparative-study`

### Purpose
Two-panel side-by-side view comparing supplier quotes against SPR.
Left panel: approved SPRs list. Right panel: all quotes for selected SPR.
Creates PO from selected quote (with confirm dialog).

### Layout

```
┌─────────────────────────┬──────────────────────────────────────┐
│  Requisitions           │  Supplier Comparison - SPR-XXXXXX    │
│  (AgGridTable)          │  (AgGridTable  #quoteAgGridRef)       │
│  #requisitionAgGridRef  │  filterQuery:                         │
│  filterQuery:           │  purchase_requisition_id eq {id}      │
│  status=APPROVED        │                                       │
│  type=SPR               │  Actions col: View|Edit|Delete|PO     │
└─────────────────────────┴──────────────────────────────────────┘
```

Grid: `lg:grid-cols-2`, height `calc(100vh-60px)`.

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `requisitions` | `any[]` | Loaded from left grid `processData` output |
| `selectedRequisition` | `any` | Currently highlighted SPR row |
| `selectedRequisitionId` | `number\|null` | ID used in right grid filter |
| `requisitionFilterQuery` | `string` | `"status eq 'APPROVED' and type eq 'SPR'"` — static |
| `quoteFilterQuery` | `string` | `purchase_requisition_id eq {id}` — updates on SPR row click; ag-grid `ngOnChanges` auto-reloads right grid |
| `selectedQuote` | `any` | Quote opened in details dialog |
| `quoteDraft` | `any` | Mutable copy of quote for dialog edits |
| `quoteItemRows` | `any[]` | Flattened items for inner items grid |
| `awarding` | `boolean` | Loading flag during PO creation — gates Create PO button via `disabled` fn |
| `quoteDetailsOpen` | `boolean` | Quote details dialog open state |
| `quoteDetailsEditing` | `boolean` | Edit mode toggle in quote dialog |
| `quoteSaving` | `boolean` | Saving spinner in quote dialog |
| `createPoConfirmOpen` | `boolean` | PO creation confirm dialog open state |
| `pendingCreateQuote` | `any` | Quote held pending confirmation |
| `requisitionColumns` | `AgGridTableColumn[]` | Built by `buildRequisitionColumns()` in `ngOnInit` |
| `quoteColumns` | `AgGridTableColumn[]` | Built by `buildQuoteColumns()` in `ngOnInit` |
| `quoteItemColumns` | `any[]` | Built by `quoteItemTableColumn()` in constructor — CustomGridTable format |

### Key Methods

| Method | Description |
|--------|-------------|
| `ngOnInit()` | Builds `requisitionColumns` + `quoteColumns` |
| `handleRequisitionData(event)` | Left grid `processData` output — `event[0]` = rows array; auto-selects first row if none selected |
| `handleRowSelect(event)` | SPR row click — `event` = row data directly (ag-grid); calls `setSelectedRequisition(event)` |
| `setSelectedRequisition(req)` | Updates `quoteFilterQuery`; ag-grid `ngOnChanges` triggers right grid auto-reload |
| `openQuoteDetails(quote)` | Opens view dialog; maps `quoteItems` to flat `quoteItemRows` |
| `editQuoteDetails(quote)` | Opens dialog in edit mode |
| `enableQuoteEdit()` | Sets `quoteDetailsEditing=true`, clones `quoteDraft.quoteItems` |
| `closeQuoteDetails()` | Resets all dialog state |
| `saveQuoteDetails()` | PUT `purchase/quotes/{id}`; calls `quoteAgGridRef?.refreshGridData(true)` |
| `deleteQuote(quote)` | `window.confirm` then DELETE; calls `quoteAgGridRef?.refreshGridData(true)` |
| `confirmCreatePurchaseOrder(quote)` | Opens confirm dialog (blocked if PO already exists) |
| `proceedCreatePurchaseOrder()` | Calls `createPurchaseOrder()` after confirm |
| `createPurchaseOrder(quote)` | Fetches next PO ID via `getCustomId`, POSTs to `create-order-from-quote`; calls `quoteAgGridRef?.refreshGridData(true)` |
| `hasActivePurchaseOrder(quote)` | `true` if quote has non-canceled PO — used in `disabled` fn of Create PO action |
| `getQuoteItemPriceSummary(quote)` | Returns `"ItemName - price, ..."` for Item Summary column |
| `getQuoteItemStatusLabel(status)` | Delegates to `PurchaseOrderStatusClass.getLabel()` |

### API Calls

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `PurchaseRequisitions?$filter=status eq 'APPROVED' and type eq 'SPR'&$expand=department,purchaseQuotes($expand=supplier)` | Left grid (ag-grid OData) |
| GET | `PurchaseQuotes?$filter=purchase_requisition_id eq {id}&$expand=supplier,quoteItems($expand=item),purchaseOrders` | Right grid (ag-grid OData) |
| GET | `getCustomId({ model: 'purchase_orders', prefix: 'PO', field: 'custom_id' })` | Next PO ID before create |
| POST | `purchase/requisitions/{spr_id}/create-order-from-quote` | Create PO from selected quote |
| PUT | `purchase/quotes/{id}` | Save edited quote from details dialog |
| DELETE | `purchase/quotes/{id}` | Delete quote |

---

## Left Grid — Requisition (`buildRequisitionColumns()`)

### Config (`app-ag-grid-table`)

| Input | Value |
|-------|-------|
| `url` | `PurchaseRequisitions` |
| `expandQuery` | `department,purchaseQuotes($expand=supplier)` |
| `filterQuery` | `requisitionFilterQuery` (static) |
| `gridId` | `comparative-requisitions` |
| `sortBy` | `id` desc |
| `searchFields` | `['custom_id']` |
| `selectionMode` | `Single` |
| `gridHeight` | `calc(100vh - 120px)` |
| `(processData)` | `handleRequisitionData($event)` — `event[0]` = rows array |
| `(rowClick)` | `handleRowSelect($event)` — `event` = row data directly |

### Columns

| Field / colId | Header | Notes |
|---------------|--------|-------|
| `custom_id` | SPR No | `width: 150` |
| `urgency` | Urgency | `AgGridIconTextCellRendererComponent`; `sortable: false`; HIGH=warning amber, other=activity-2 slate |
| `department_name` | Department | `valueGetter` → `department.name`, `flex: 1`, `sortable: false` |
| `quotes_count` | Quotes | `valueGetter` → `purchaseQuotes.length`, `width: 100`, `sortable: false` |

---

## Right Grid — Quotes (`buildQuoteColumns()`)

### Config (`app-ag-grid-table`)

| Input | Value |
|-------|-------|
| `url` | `PurchaseQuotes` |
| `expandQuery` | `supplier,quoteItems($expand=item),purchaseOrders` |
| `filterQuery` | `quoteFilterQuery` — starts as `purchase_requisition_id eq 0` (empty); auto-reloads when SPR selected |
| `gridId` | `comparative-quotes` |
| `sortBy` | `id` desc |
| `searchFields` | `['custom_id']` |
| `selectionMode` | `Single` |
| `gridHeight` | `calc(100vh - 120px)` |
| `headerTitle` | Dynamic — `'Supplier Comparison - ' + selectedRequisition.custom_id` |

### Columns

| Field / colId | Header | Notes |
|---------------|--------|-------|
| `custom_id` | Quote No | `width: 150` |
| `supplier_name` | Supplier | `valueGetter`, `flex: 1`, `sortable: false` |
| `total_amount` | Total Amount | `width: 150` |
| `valid_until` | Valid Until | `valueFormatter` → `toLocaleDateString()` |
| `items_count` | Items | `valueGetter` → `quoteItems.length`, `width: 90`, `sortable: false` |
| `item_summary` | Item Summary | `valueGetter` → `getQuoteItemPriceSummary()`, `width: 260`, `sortable: false` |
| `status` | Status | `width: 120` |
| `actions` | Actions | `AgGridActionCellRendererComponent`, pinned right, `width: 220` |

### Actions Column

| Action id | Icon | Design | Handler | Disabled condition |
|-----------|------|--------|---------|-------------------|
| `view` | `show` | Transparent | `openQuoteDetails(row)` | — |
| `edit` | `edit` | Transparent | `editQuoteDetails(row)` | — |
| `delete` | `delete` | Negative | `deleteQuote(row)` | — |
| `create-po` | `add` | Emphasized | `confirmCreatePurchaseOrder(row)` | `awarding \|\| hasActivePurchaseOrder(row)` |

---

## Quote Items Columns (`quoteItemTableColumn()`)

Used in quote details dialog inner grid (`CustomGridTableComponent`, `customData=true`, all `isReadOnly=true`).

| Header | Accessor | Notes |
|--------|----------|-------|
| Item Code | `item_code` | readonly |
| Name | `product_name` | readonly |
| Required Qty | `required_quantity` | readonly |
| Quote Qty * | `quantity` | readonly |
| Unit Price * | `unit_price` | readonly |
| Total Price | `total_price` | `Cell` → `quantity × unit_price` computed |
| Delivery Date | `delivery_date` | Date type, readonly |
| Status | `status` | `Cell` → `getQuoteItemStatusLabel()` |

---

## Dialogs

### Quote Details Dialog (`quoteDetailsOpen`)

2-column grid (`grid-cols-2`), all fields readonly unless `quoteDetailsEditing=true`:

| Field | Component | Notes |
|-------|-----------|-------|
| RFQ No | `ui5-input` | readonly always |
| SPR No | `ui5-input` | readonly always |
| Supplier | `ui5-input` | readonly always |
| Quote Date | `ui5-date-picker` | format `yyyy-MM-dd`, readonly always |
| Valid Until | `ui5-date-picker` | format `yyyy-MM-dd`, readonly always |
| Status | `ui5-input` | readonly always |
| Note | `ui5-textarea` | editable when `quoteDetailsEditing=true` |
| Items | `app-custom-grid-table` | col-span-2, `customData=true`, `quoteItemRows` |

Footer: **Save** (editing mode) / **Edit** (view mode) / **Close**

### Create PO Confirm Dialog (`createPoConfirmOpen`)

`state="Critical"`, width `32rem`.
Footer: **Yes, Create** → `proceedCreatePurchaseOrder()` / **Close**

---

## Services Injected

| Service | Usage |
|---------|-------|
| `CommonService` | All HTTP calls, `getCustomId()` for PO ID |
| `ToastService` | add / edit / delete / error notifications |

---

## Important Notes

- Both main grids use `AgGridTableComponent`. React, Button, Icon, Text, TextAlign, ColumnFilterType removed.
- Right grid auto-reloads when `quoteFilterQuery` changes — ag-grid `ngOnChanges` detects binding change, calls `refreshGridData(true)`. No `setTimeout` or manual refresh needed.
- `processData` in ag-grid emits `[rows]` (array wrapping rows array) — same format as custom-grid-table. `event[0]` = rows array.
- `rowClick` in ag-grid emits row data directly — no `detail.row.original` wrapper. `handleRowSelect(event)` uses `event` directly.
- `selectedRowsId` input exists on ag-grid but NOT implemented — row highlight handled natively by ag-grid selection.
- Right grid initial filter `purchase_requisition_id eq 0` → empty state until SPR selected.
- Create PO action `disabled` fn captures `this.awarding` at call time — correctly reflects current component state.
- Inner items dialog grid still uses `CustomGridTableComponent` (`customData=true`).
- `createPurchaseOrder` endpoint targets requisition: `purchase/requisitions/{spr_id}/create-order-from-quote`.
- `hasActivePurchaseOrder` uses `PurchaseOrderStatusClass` from `purchese-management/shared/enum/purchase.enum.ts`.
- `window.confirm` used for delete — no custom dialog.
