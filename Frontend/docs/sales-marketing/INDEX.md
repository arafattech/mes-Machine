# Sales Management — Documentation Index

This folder contains AI context files for every component group in the `sales-management` module.

## Module Root
- [module-overview/context.md](module-overview/context.md) — source structure, routing table, declarations, common patterns, future add notes
- [shared/context.md](shared/context.md) — shared models, enums, and reusable sales components

## Feature Areas

| Folder | Description |
|--------|-------------|
| [layout/](layout/context.md) | Shell layout with sidebar navigation and market-price dialog |
| [dashboard/](dashboard/context.md) | Sales analytics dashboard |
| [sales-order/](sales-order/context.md) | Sales orders CRUD — list + reusable order form with discount/VAT logic |
| [sales-request/](sales-request/context.md) | Pending sales requests — approve/reject workflow |
| [pricing-plan/](pricing-plan/context.md) | Product pricing plan management — product list + pricing-plan form |
| [audit-trail/](audit-trail/context.md) | Sales order audit log viewer |
| [expired-sales-order/](expired-sales-order/context.md) | Read-only view of past-delivery-date approved orders |
| [market-price-history/](market-price-history/context.md) | Market price entry history grid |
| [shared/](shared/context.md) | Shared sales models, enums, and chart component |

## Component Context Files

| File | Component |
|---|---|
| [layout/SALES_LAYOUT_COMPONENT_CONTEXT.md](layout/SALES_LAYOUT_COMPONENT_CONTEXT.md) | `SalesLayout` |
| [layout/SALES_LAYOUT_OVERVIEW.md](layout/SALES_LAYOUT_OVERVIEW.md) | Layout overview |
| [dashboard/DASHBOARD_COMPONENT_CONTEXT.md](dashboard/DASHBOARD_COMPONENT_CONTEXT.md) | `SalesDashboard` |
| [pricing-plan/PRICING_PLAN_LIST_COMPONENT_CONTEXT.md](pricing-plan/PRICING_PLAN_LIST_COMPONENT_CONTEXT.md) | `PricingPlanComponent` list/master |
| [pricing-plan/PRICING_PLAN_COMPONENT_CONTEXT.md](pricing-plan/PRICING_PLAN_COMPONENT_CONTEXT.md) | Pricing plan feature details |
| [pricing-plan/PRICING_FORM_COMPONENT_CONTEXT.md](pricing-plan/PRICING_FORM_COMPONENT_CONTEXT.md) | `PricingFormComponent` |
| [sales-order/SALES_ORDER_COMPONENT_CONTEXT.md](sales-order/SALES_ORDER_COMPONENT_CONTEXT.md) | Sales order feature context |
| [sales-order/SALES_ORDER_LIST_COMPONENT_CONTEXT.md](sales-order/SALES_ORDER_LIST_COMPONENT_CONTEXT.md) | `SalesOrderComponent` list |
| [sales-order/ORDER_FORM_COMPONENT_CONTEXT.md](sales-order/ORDER_FORM_COMPONENT_CONTEXT.md) | `OrderFormComponent` |
| [sales-request/SALES_REQUEST_LIST_COMPONENT_CONTEXT.md](sales-request/SALES_REQUEST_LIST_COMPONENT_CONTEXT.md) | `SalesRequestComponent` list |
| [sales-request/SALES_REQUEST_COMPONENT_CONTEXT.md](sales-request/SALES_REQUEST_COMPONENT_CONTEXT.md) | Sales request feature details |
| [audit-trail/AUDIT_TRAIL_LIST_COMPONENT_CONTEXT.md](audit-trail/AUDIT_TRAIL_LIST_COMPONENT_CONTEXT.md) | `AuditTrailComponent` list |
| [audit-trail/AUDIT_TRAIL_COMPONENT_CONTEXT.md](audit-trail/AUDIT_TRAIL_COMPONENT_CONTEXT.md) | Audit trail feature details |
| [expired-sales-order/EXPIRED_SALES_ORDER_LIST_COMPONENT_CONTEXT.md](expired-sales-order/EXPIRED_SALES_ORDER_LIST_COMPONENT_CONTEXT.md) | `ExpiredSalesOrderComponent` list |
| [expired-sales-order/EXPIRED_SALES_ORDER_COMPONENT_CONTEXT.md](expired-sales-order/EXPIRED_SALES_ORDER_COMPONENT_CONTEXT.md) | Expired sales order feature details |
| [market-price-history/MARKET_PRICE_HISTORY_LIST_COMPONENT_CONTEXT.md](market-price-history/MARKET_PRICE_HISTORY_LIST_COMPONENT_CONTEXT.md) | `MarketPriceHistoryComponent` list |
| [market-price-history/MARKET_PRICE_HISTORY_COMPONENT_CONTEXT.md](market-price-history/MARKET_PRICE_HISTORY_COMPONENT_CONTEXT.md) | Market price feature details |
| [shared/SHARED_COMPONENT_CONTEXT.md](shared/SHARED_COMPONENT_CONTEXT.md) | Shared models and common patterns |
| [shared/MARKET_ANALYSIS_CHART_COMPONENT_CONTEXT.md](shared/MARKET_ANALYSIS_CHART_COMPONENT_CONTEXT.md) | `MarketAnalysisChartComponent` |

## Quick Reference

### Adding a new entity to this module
1. Create component files under `src/app/modules/sales-management/<feature>/`
2. Add route to `sales.route.ts` with `PermissionGuard` + relevant `Permissions.*` constant
3. Add a `SALES_*` permission key to `Permissions` enum
4. Add sidebar entry in `sales-layout.component.ts` `fullSidebarMenu`
5. Register component in `sales.module.ts`
6. Add `Frontend/docs/sales-marketing/<feature>/context.md`
7. Add separate component context markdown files for each routed/reusable component

### Technology Stack
- Angular (`.ts`) — most list/form components
- TSX (`.tsx`) — currently present in `dashboard/sales-analytics.component.tsx` and `sales-order/order-form/order-form.component.tsx`
- SAP UI5 Web Components (`@ui5/webcomponents-ngx`) — all UI elements
- AG Grid (`app-ag-grid-table`) — default grid for list components: `SalesOrderComponent`, `SalesRequestComponent`, `ExpiredSalesOrderComponent`, `PricingPlanComponent`, `PricingFormComponent`
- `CustomGridTableComponent` (legacy) — still used in `SalesDashboard`; target for AG Grid migration
- OData — default API pattern (`CommonService` without `false` flag)
- REST API — `CommonService` with `false` flag (routes under `/api/*`)
- `OrderFormComponent` — reused by `SalesOrderComponent`, `SalesRequestComponent`, and `ExpiredSalesOrderComponent`
