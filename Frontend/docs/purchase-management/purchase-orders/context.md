# Purchase Management — Purchase Orders

## Separate Component Docs
- [PURCHASE_ORDER_LIST_COMPONENT_CONTEXT.md](PURCHASE_ORDER_LIST_COMPONENT_CONTEXT.md) — `PurcheseOrderListComponent` — direct AG Grid list with segment filtering and approve action

## Files

```
purchese-management/
└── purchese-orders/
    └── purchese-order-list/
        ├── purchese-order-list.component.ts     ← AG Grid list component (migrated from .tsx)
        ├── purchese-order-list.component.tsx    ← empty (export {}; — kept for build compatibility)
        ├── purchese-order-list.component.html   ← app-ag-grid-table with segmentButtonItems
        └── purchese-order-list.component.scss
```

## Route

| Path | Component | Permission |
|------|-----------|------------|
| `purchase/purchase-orders` | `PurcheseOrderListComponent` | `PURCHESE_ADMIN` |

---

## PurcheseOrderListComponent

### Selector
`app-purchese-order-list`

### Purpose
Standalone purchase order list using `app-ag-grid-table`. Displays POs filtered by status via segment buttons. Provides an inline Approve action that calls the purchase workflow API.

### Grid
- **Endpoint:** `PurchaseOrders`
- **Expand:** `supplier`
- **Default filter:** `status eq 'SUBMITTED'`
- **Search fields:** `custom_id`, `supplier.name`, `requisition.custom_id`

### Segment Buttons (status filter)

| Segment | Filter applied |
|---------|---------------|
| Submitted (default) | `status eq 'SUBMITTED'` |
| Approved | `status eq 'APPROVED'` |
| Rejected | `status eq 'REJECTED'` |

`onSegmentChange()` reassigns `dataSource` with updated `filter` → ag-grid `ngOnChanges` auto-reloads.

### Columns

| Field | Header | Notes |
|-------|--------|-------|
| `is_active` | Active | `Boolean` dataType |
| `custom_id` | PO No | `width: 120` |
| `supplier.name` | Supplier | `valueGetter`, `flex: 1`, `sortable: false` |
| `total_amount` | Total | `Number` dataType; **not** in `searchFields` — `total_amount` is `decimal(15,2)` on `purchase_orders` (`2025_11_03_062806_create_purchase_orders_table`), and lodata's `contains(tolower())` needs a string-typed OData property, so wrapping a decimal column risks a parser error. Deliberately left out during the store-management-wide search audit; would need a confirmed-safe cast or a dedicated numeric-search path before enabling. |
| `status` | Status | `valueFormatter` → `PurchaseOrderStatusClass.getLabel()` |
| `actions` | Actions | pinned right, approve icon → `approveOrder()` |

### Approve Action
`approveOrder(order)` → `POST purchase/orders/{id}/approve` with `{ status: APPROVED }` → on success: toast + `agGridRef.refreshGridData(true)`.

---

## Future Add Notes
- Add `canApprove` permission gate on the approve action button (currently always visible).
- Add view/edit dialog for PO details if needed (currently no row-click handler).
- `supplier.name` filter via column header — `colId: 'supplier.name'` is set for server-side OData filter compatibility.
