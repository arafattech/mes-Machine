# Sales Management — Module Overview

## Source Root
`src/app/modules/sales-management/`

## Files
```
sales-management/
├── sales.module.ts
├── sales.route.ts
├── layout/
├── dashboard/
├── pricing-plan/
│   └── pricing-form/
├── sales-order/
│   └── order-form/
├── sales-request/
├── audit-trail/
├── expired-sales-order/
├── market-price-history/
└── shared/
    ├── components/market-analysis-chart/
    ├── enums/
    └── model/
```

## Routes

| Path | Component | Permission |
|---|---|---|
| `/sales-management` | `SalesLayout` | `SALES_ADMIN` |
| `sales-analytics` | `SalesDashboard` | `SALES_ANALYTICS` |
| `pricing-plan` | `PricingPlanComponent` | `SALES_PRICING_PLAN` |
| `sales-orders` | `SalesOrderComponent` | `SALES_SALES_ORDERS` |
| `sales-requests` | `SalesRequestComponent` | `SALES_SALES_REQUESTS` |
| `audit-trail` | `AuditTrailComponent` | `SALES_SALES_REQUESTS` |
| `expired-sales-orders` | `ExpiredSalesOrderComponent` | `SALES_EXPIRED_SALES_ORDERS` |
| `market-price-history` | `MarketPriceHistoryComponent` | `SALES_MARKET_PRICE_HISTORY` |

## Declarations
`SalesManagementModule` declares the dashboard, pricing plan/form, sales order/form, sales request, audit trail, expired orders, market price history, and market analysis chart components.

Current source note: `sales.module.ts` still declares `SalesDashboard` and `PricingPlanComponent` twice. The docs only record the current structure; they do not change module behavior.

## Common Patterns
- Route access is guarded by `PermissionGuard` with `Permissions.SALES_*` constants.
- Sidebar visibility is filtered in `SalesLayout` through `RolePermissionService.getAllPermissionsStatus()`.
- List pages primarily use `app-ag-grid-table` with OData data sources.
- REST endpoints are used for custom workflows such as sales order create/update, approval/rejection, export, and market price save.
- `OrderFormComponent` is reused by sales orders, sales requests, and expired sales orders.
- `PricingFormComponent` is a read-only product detail view plus editable pricing-plan grid.

## Future Add Notes
- Keep one feature folder in `Frontend/docs/sales-marketing/<feature>/` per source folder.
- Add a `context.md` for every feature folder and one component context file per routed or reusable component.
- When source files remain TSX, document them as TSX. Do not mark the module as fully migrated until source files are actually converted.
- Update this overview whenever `sales.route.ts`, `sales.module.ts`, or sidebar permissions change.
