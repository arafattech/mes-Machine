# SALES_REQUEST_LIST_COMPONENT — Component Context

## Component Identity

| Field | Value |
|---|---|
| Component name | `SalesRequestComponent` |
| Selector | `app-sales-request` |
| TypeScript | `src/app/modules/sales-management/sales-request/sales-request.component.ts` |
| HTML | `src/app/modules/sales-management/sales-request/sales-request.component.html` |
| SCSS | `src/app/modules/sales-management/sales-request/sales-request.component.scss` |
| Component type | List / approval workflow component |
| Route | `sales-requests` |
| Permission | `SALES_SALES_REQUESTS` |

## Purpose
Lists pending sales orders as sales requests. Provides view, invoice download, approve, and reject actions based on sales request permissions.

## Child Components

| Template ref | Component | Purpose |
|---|---|---|
| `#agGridRef` | `AgGridTableComponent` | Pending request grid |
| `#orderFrom` | `OrderFormComponent` | Reused order detail dialog |

## Main Data Source

| Property | Value |
|---|---|
| Endpoint | `SalesOrders` |
| Expand | `items($expand=product($expand=uom)),client,createdBy` |
| Filter | `status eq 'PENDING'` |
| Sort | `desc` |

## Toolbar
- Header: `Sales Request`
- Search: enabled
- Row count: enabled
- Scanner: enabled
- New button: disabled

## Row Actions

| Action | Permission | Purpose |
|---|---|---|
| `view` | `SALES_SALES_REQUEST_VIEW` | Opens order form in view/review mode |
| `download` | Always added | Downloads invoice |
| `approve` | `SALES_SALES_REQUEST_APPROVE` | Approves pending request |
| `reject` | `SALES_SALES_REQUEST_REJECT` | Rejects pending request |

## Related Form Doc
- [../sales-order/order_form_component_context.md](../sales-order/order_form_component_context.md)

## Future Add Notes
- Keep request list and approval/rejection behavior here.
- Keep shared order dialog behavior in `sales-order/order_form_component_context.md`.
