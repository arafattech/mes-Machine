# Purchase Management — Quotation Management (RFQ)

## Separate Component Docs
- [QUOTATION_LIST_COMPONENT_CONTEXT.md](QUOTATION_LIST_COMPONENT_CONTEXT.md) — `QuotationManagementComponent` list doc with TS, HTML, SCSS, selector, route, datasource, toolbar
- [QUOTATION_FORM_COMPONENT_CONTEXT.md](QUOTATION_FORM_COMPONENT_CONTEXT.md) — embedded RFQ / Quotation form dialog doc

## Files

```
purchese-management/quotation-management/
├── quotation-management.component.ts
├── quotation-management.component.html
└── quotation-management.component.scss

purchese-management/shared/model/
└── purchaseQuote.ts
```

## Route

| Path | Component | Permission |
|------|-----------|------------|
| `purchase/rf-quotations` | `QuotationManagementComponent` | `PURCHESE_SR_REQUEST` |

---

## QuotationManagementComponent

### Selector
`app-quotation-management`

### Purpose
Manages RFQ / supplier quotes linked to approved SPRs. Each quote captures per-item pricing from supplier for given SPR. Quote locks once PO created from it (`isQuoteLocked`).

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `quote` | `any` | Current quote object in dialog |
| `saveMode` | `'POST'\|'PUT'` | Create vs update |
| `selectedData` | `any` | Row clicked — used for lock check and PUT id |
| `requisitions` | `any[]` | Approved SPR list for dropdown |
| `suppliers` | `any[]` | Supplier list for dropdown |
| `requisitionTitle` | `string` | Display value for SPR combobox |
| `supplierTitle` | `string` | Display value for Supplier combobox |
| `itemColumns` | `any[]` | `CustomGridTableComponent` column config for inner items grid |

### Computed Properties

| Getter | Returns | Logic |
|--------|---------|-------|
| `isQuoteLocked` | `boolean` | `selectedData.purchaseOrders.length > 0` — locks all edits |
| `dialogHeaderText` | `string` | "New RFQ / Quotation" (POST) or "RFQ / Quotation Details" (PUT) |
| `quoteStatusLabel` | `string` | "PO CREATED" if POs exist, else "NOT CREATED" |
| `requisitionName` | `string` | Alias for `requisitionTitle` |
| `supplierName` | `string` | Alias for `supplierTitle` |

### Key Methods

| Method | Description |
|--------|-------------|
| `newItem()` | Sets POST mode, fetches next RFQ ID via `getCustomId`, opens dialog |
| `viewItem(event)` | Sets PUT mode, maps `quoteItems` to dialog items format, opens dialog |
| `saveQuote()` | Validates required fields, serializes via `PurchaseQuote.toOdata()`, POST or PUT |
| `onRequisitionChange(event)` | Populates items from SPR, subtracts already-ordered quantities |
| `onSupplierChange(event)` | Sets `quote.supplier_id` and `supplierTitle` |
| `onUnitPriceChange(rowData)` | Recalculates `total_price = quantity * unit_price`, calls `syncItemsGrid()` |
| `onQuoteQtyChange(rowData)` | Recalculates `total_price`, calls `syncItemsGrid()` |
| `syncItemsGrid()` | Pushes `quote.items` into inner `quoteItemsGrid` |
| `tableColumn(readOnly)` | Builds `itemColumns` — sets `isReadOnly` based on lock state |
| `loadDependencies()` | Loads approved SPRs + suppliers on init |
| `afterSuccessSave()` | Toasts, closes dialog, calls `agGridRef?.refreshGridData(true)` |

### Validation (saveQuote)
Blocks save if:
- `isQuoteLocked` (PO already created)
- `purchase_requisition_id` missing
- `supplier_id` missing
- `items` array empty

### API Calls

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `PurchaseQuotes?...$expand=supplier,requisition,quoteItems(...),purchaseOrders` | Main list (ag-grid OData) |
| GET | `PurchaseRequisitions?$filter=status eq 'APPROVED' and type eq 'SPR'&$expand=sprItems($expand=item),department,purchaseOrders($expand=poItems)` | SPR dropdown |
| GET | `Suppliers` | Supplier dropdown |
| GET | `getCustomId({ model: 'purchase_quotes', prefix: 'RFQ', field: 'custom_id' })` | Next RFQ ID |
| POST | `purchase/quotes` | Create quote |
| PUT | `purchase/quotes/${id}` | Update quote |

---

## Table Setup (AgGridTableComponent — main list)

### Config

| Input | Value |
|-------|-------|
| `url` | `PurchaseQuotes` |
| `expandQuery` | `supplier,requisition,quoteItems($expand=item($expand=uom)),purchaseOrders` |
| `gridId` | `purchese-quotation-list` |
| `sortBy` | `id` desc |
| `searchFields` | `['custom_id']` |
| `showNewButton` | `true` |
| `showActiveButton` | `false` |
| `gridHeight` | `calc(100vh - 118px)` |

### Main List Columns (`buildColumns()`)

| Field / colId | Header | Notes |
|---------------|--------|-------|
| `custom_id` | Quote No | `width: 150` |
| `requisition_custom_id` | SPR No | `valueGetter`, `sortable: false` |
| `urgency` | Urgency | `valueGetter` → `requisition.urgency \|\| urgency`, `sortable: false` |
| `supplier_name` | Supplier | `valueGetter`, `flex: 1`, `sortable: false` |
| `quote_date` | Quote Date | `valueFormatter` → `toLocaleDateString()` |
| `total_amount` | Total Amount | `width: 160` |
| `po_status` | PO Status | `valueGetter` → `mapQuoteStatus(params.data)`, `sortable: false` |
| `actions` | Actions | `AgGridActionCellRendererComponent`, pinned right, info icon → `viewItem()` |

> **Note:** Urgency previously rendered with React JSX + UI5 icons. After ag-grid migration, urgency shows as plain uppercase text (HIGH / MEDIUM / LOW). React and Icon imports removed.

---

## Dialog Layout

2-column grid (`grid-cols-2`):

| Field | Component | Notes |
|-------|-----------|-------|
| RFQ No | `ui5-input` | readonly always |
| Quote Date | `ui5-date-picker` | format `yyyy-MM-dd`; readonly when locked |
| SPR List | `ui5-combobox` | required; readonly when locked; selecting auto-fills items |
| Supplier | `ui5-combobox` | required; readonly when locked |
| Valid Until | `ui5-date-picker` | format `yyyy-MM-dd`; readonly when locked |
| PO Status | `ui5-input` | readonly; "PO CREATED" or "NOT CREATED" |
| Note | `ui5-textarea` | col-span-2; readonly when locked |
| Items | `app-custom-grid-table` | col-span-2; `customData=true`; editable unless locked |

### Footer Buttons
- **Save** — disabled when `loading || isQuoteLocked`
- **Cancel** — always enabled

---

## Items Table (inner dialog — CustomGridTableComponent)

`tableColumn(readOnly)` — `readOnly` driven by `isQuoteLocked`.

| Column | Accessor | Editable | Notes |
|--------|----------|----------|-------|
| Item Code | `item_code` | No | readonly |
| Name | `product_name` | No | readonly |
| Required Qty | `required_quantity` | No | from SPR; readonly |
| Quote Qty * | `quantity` | Yes (unless locked) | `afterValueChange: onQuoteQtyChange` |
| Unit Price * | `unit_price` | Yes (unless locked) | `afterValueChange: onUnitPriceChange` |
| Total Price | `total_price` | No | computed: `quantity × unit_price`; recalculated live |
| Delivery Date | `delivery_date` | Yes (unless locked) | Date type |

### Auto-fill on SPR selection (onRequisitionChange)
1. Reads `requisition.sprItems`
2. Computes `alreadyOrdered` per product from `requisition.purchaseOrders[].poItems`
3. Sets `required_quantity = max(approved_qty - alreadyOrdered, 0)` per item
4. Pre-fills `unit_price` from `item.unit_price`, calculates `total_price`

---

## PurchaseQuote Model

```typescript
class PurchaseQuote {
  id?: number;
  custom_id?: string;                    // e.g. "RFQ-000042"
  purchase_requisition_id?: number | null;
  supplier_id?: number | null;
  quote_date?: string;
  valid_until?: string;
  status?: string;                        // always "SUBMITTED" on create
  note?: string;
  items?: QuoteItem[];

  toOdata(): object  // serializes for POST/PUT
}

interface QuoteItem {
  product_id: number;
  quantity: number;
  unit_price: number;
  delivery_date: string | null;
}
```

---

## Quote Lock Mechanism

Quote becomes **locked** (`isQuoteLocked = true`) when `selectedData.purchaseOrders.length > 0` — PO created from this quote.

When locked:
- All dialog fields `readonly`
- Save button disabled
- `tableColumn(true)` → all item columns `isReadOnly: true`

---

## Services Injected

| Service | Usage |
|---------|-------|
| `CommonService` | All API calls, `getCustomId()` for RFQ ID |
| `ToastService` | add / edit / error notifications |
| `RolePermissionService` | Injected but not used for column/button guards |

---

## Important Notes

- Main list uses `AgGridTableComponent`. Action column (info button) defined in `buildColumns()` — no `showInfoButton`/`showAction` input needed on component.
- `agGridRef?.refreshGridData(true)` called after save to force fresh OData fetch.
- RFQ ID generated server-side via `CommonService.getCustomId()` (not client-computed like PO IDs).
- `Total Price` column computed client-side in `Cell` renderer and recalculated live in `onUnitPriceChange`/`onQuoteQtyChange` — not stored on item until save.
- Quote items are flat transform of SPR items — no separate quote-item entity before save.
