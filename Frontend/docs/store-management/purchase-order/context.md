# Store Management — Purchase Order

## Files

```
purchase-order/
├── purchase-order.component.ts    ← shared PO component (source of truth)
├── purchase-order.component.html
└── purchase-order.component.scss
```

## Route
`/store/purchase-order` — guard: `STORE_PURCHASE_ORDER`

---

## PurchaseOrderComponent (store context)

Full documentation: [purchase-management/purchase-orders/context.md](../../purchase-management/purchase-orders/context.md)

In the store context, used directly (not wrapped in a shell component):

```typescript
// store-management-routing.module.ts
{ path: 'purchase-order', component: PurchaseOrderComponent }
```

Default inputs (store-management context):
- `[readOnly]="true"` — disables New/Save
- `[usePurchasePermissions]="false"` — uses `STORE_PURCHASE_ORDER_*` permissions

Exported from `StoreManagementModule` so purchase-management can import it.

### Key Difference vs Purchase-Management Context

| | Store | Purchase |
|-|-------|----------|
| `readOnly` | `true` | `false` |
| `usePurchasePermissions` | `false` | `true` |
| Permission used | `STORE_PURCHASE_ORDER_*` | `PURCHESE_ADMIN` |
| Can create/edit | No | Yes |

### Order Type column (`is_imported`)
Badge column `order_type` — `AgGridStatusBadgeComponent`, `valueGetter: is_imported ? 'FOREIGN' : 'LOCAL'` (styles in `@shared/utilities/statusStyles.ts`). `is_imported` is inherited from the source SPR when a PO is created from a quote (`PurchaseOrderWorkflowController::createPurchaseOrderFromQuote` sets `'is_imported' => $purchaseRequisition->is_imported`) — not set independently on the PO.

### `status` vs `is_complete` — don't conflate
`status` (`PENDING|APPROVED|CANCELED|RECEIVED`, `App\Enums\Purchase\PoStatus`) and the separate `is_complete` boolean are set together by `MaterialReceiptController::markRequisitionCompleteIfNeeded()` when every `PurchaseOrderItem.received_quantity >= quantity` — but the frontend's "Complete" display must read `is_complete` directly, not derive a label from `status`. The `PurchaseOrderStatus` FE enum (`store-management/shared/enum/purchase-order-status.ts`) doesn't even have a `RECEIVED` case (mismatched from day one — has `COMPLETED`/`REJECTED`/`PARTIAL` instead, none of which the backend uses), so `normalizeStatus()`/`formatStatus()` silently mislabel `RECEIVED` as `Pending`. Don't try to fix this by teaching `normalizeStatus` about `RECEIVED` — use the existing `is_complete`-driven "Complete" badge column instead.

### `purchase_orders.is_imported` / `is_mrr_created` — nullable gotcha
Both are Lodata-managed columns. Lodata requires every **non-nullable** column present in the insert payload (it does not fall back to the MySQL column default) — a non-nullable `is_imported`/similar boolean added via migration silently breaks every PO/PR create until relaxed to `nullable()->default(false)`. If adding a new boolean column to `purchase_orders` or `purchase_requisitions`, always make it nullable.
