# Sales Dispatch

## Purpose

Sales Dispatch is the store-side history of inventory sent for approved sales orders.

## Stock adjustment flow

When a `sales_orders` record changes to `APPROVED`, the backend `SalesOrderObserver` creates one stock adjustment per sales-order item:

| Field | Value |
| --- | --- |
| `condition` | `DECREASED` |
| `reason` | `SALES_DISPATCH` |
| `sales_order_id` | Approved sales order ID |
| `product_id` | Item product ID |
| `adjustment_quantity` | Sales-order item quantity |

The same observer decrements `products.current_stock`. It checks for an existing `SALES_DISPATCH` adjustment for the same sales order and product, so approving an order again does not dispatch it twice.

## Database

Migration: `Backend/database/migrations/2025_12_19_000000_add_sales_order_id_to_stock_adjustments_table.php`

`stock_adjustments.sales_order_id` is nullable and references `sales_orders.id`. Existing stock adjustments remain valid.

## API

`GET /api/store/sales-dispatch/report`

The endpoint returns the normal grid response shape:

```json
{
  "value": [],
  "@count": 0
}
```

It supports grid pagination, sorting, and search for sales order, client, item code, and item name.

## Frontend

- Component: `Frontend/src/app/modules/store-management/sales-dispatch/sales-dispatch.component.ts`
- Route: `/store-management/sales-dispatch`
- Menu: Store Management → Sales Dispatch
- Permission: `STORE_ITEM_INVENTORY`, matching the inventory area because this page is read-only stock movement history.
