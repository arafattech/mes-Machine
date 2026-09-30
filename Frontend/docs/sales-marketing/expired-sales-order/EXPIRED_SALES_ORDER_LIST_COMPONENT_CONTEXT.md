# EXPIRED_SALES_ORDER_LIST_COMPONENT — Component Context

## Component Identity

| Field | Value |
|---|---|
| Component name | `ExpiredSalesOrderComponent` |
| Selector | `app-expired-sales-order` |
| TypeScript | `src/app/modules/sales-management/expired-sales-order/expired-sales-order.component.ts` |
| HTML | `src/app/modules/sales-management/expired-sales-order/expired-sales-order.component.html` |
| SCSS | `src/app/modules/sales-management/expired-sales-order/expired-sales-order.component.scss` |
| Component type | Read-only list component |
| Route | `expired-sales-orders` |
| Permission | `SALES_EXPIRED_SALES_ORDERS` |

## Purpose
Lists approved sales orders whose `expected_delivery_date` is earlier than the current date. The page is read-only and opens the reusable `OrderFormComponent` for viewing order details.

## Child Components

| Template ref | Component | Purpose |
|---|---|---|
| `#agGridRef` | `AgGridTableComponent` | Expired order grid |
| `#orderFrom` | `OrderFormComponent` | Read-only order detail dialog |

## Main Data Source

| Property | Value |
|---|---|
| Endpoint | `SalesOrders` |
| Expand | `items($expand=product($expand=uom)),client,createdBy` |
| Base filter | `expected_delivery_date lt '<today>' and status eq 'APPROVED'` |
| Sort | `id desc` |

## Toolbar
- Header: `Expired Sales Order`
- Search: enabled
- Row count: enabled
- New button: disabled

## Row Actions
- `view` opens `OrderFormComponent` with `isDisabled = true`.

## Related Form Doc
- [../sales-order/order_form_component_context.md](../sales-order/order_form_component_context.md)

## Future Add Notes
- If expired criteria changes, update the base filter in this doc.
- Keep this as a list-only doc; form behavior belongs to the shared order form doc.
