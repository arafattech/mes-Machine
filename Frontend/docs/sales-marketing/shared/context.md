# Sales Management — Shared Resources

## Module Alias
`@sales-module/*` → `src/app/modules/sales-management/*`

## Routing (`sales.route.ts`)

| Path | Component | Permission |
|------|-----------|------------|
| `` (root) | `SalesLayout` | `SALES_ADMIN` |
| `sales-analytics` | `SalesDashboard` | `SALES_ANALYTICS` |
| `pricing-plan` | `PricingPlanComponent` | `SALES_PRICING_PLAN` |
| `sales-orders` | `SalesOrderComponent` | `SALES_SALES_ORDERS` |
| `sales-requests` | `SalesRequestComponent` | `SALES_SALES_REQUESTS` |
| `audit-trail` | `AuditTrailComponent` | `SALES_SALES_REQUESTS` |
| `expired-sales-orders` | `ExpiredSalesOrderComponent` | `SALES_EXPIRED_SALES_ORDERS` |
| `market-price-history` | `MarketPriceHistoryComponent` | `SALES_MARKET_PRICE_HISTORY` |

All routes use `PermissionGuard`.

---

## Models (`shared/model/`)

### `SalesOrder` (`sales-order.ts`)
Implements `Deserializable`.

| Field | Type | Default |
|-------|------|---------|
| `id` | `number?` | — |
| `client_id` | `number?` | — |
| `order_no` | `string?` | `''` |
| `custom_id` | `string` | `''` |
| `order_date` | `string?` | — |
| `expected_delivery_date` | `string?` | — |
| `status` | `string?` | `''` |
| `subtotal` | `number?` | `0` |
| `paid_amount` | `number?` | `0` |
| `due_amount` | `number?` | `0` |
| `grand_total` | `number?` | `0` |
| `vat` | `number?` | `0` |
| `discount` | `number?` | `0` |
| `discount_type` | `string?` | `''` |
| `discount_amount` | `number?` | `0` |
| `discount_option` | `string?` | `''` |
| `note` | `string?` | `''` |
| `items` | `SaleOrderItem[]?` | `[]` |

Methods: `deserialize(input)`, `toOdata()`, `calculateDue(): number`

### `PricePlan` (`price-plan.ts`)
Implements `Deserializable`.

| Field | Type | Default |
|-------|------|---------|
| `id` | `number?` | — |
| `product_id` | `number?` | — |
| `is_active` | `boolean?` | `true` |
| `is_default` | `boolean?` | `false` |
| `discount_percentage` | `number?` | `0` |
| `max_qty` | `number?` | `0` |
| `min_qty` | `number?` | `0` |
| `plan_name` | `string?` | `''` |
| `price` | `string?` | `''` |
| `start_date` | `string?` | — |
| `end_date` | `string?` | — |

Methods: `deserialize(input)`, `toOdata()`

---

## Enums (`shared/enums/sales-status.ts`)

### `SalesStatus`
```typescript
DRAFT = 'DRAFT'
REJECTED = 'REJECTED'
APPROVED = 'APPROVED'
PENDING = 'PENDING'
```

### `DiscountType`
```typescript
PERCENTAGE = 'PERCENTAGE'
FIXED_AMOUNT = 'FIXED_AMOUNT'
```

### `DiscountOption`
```typescript
ALL = 'ALL'
INDIVIDUAL = 'INDIVIDUAL'
```

---

## Shared Components (`shared/components/`)

### `MarketAnalysisChartComponent`
- Selector: `app-market-analysis-chart`
- Used by the analytics dashboard
- Standalone: No (declared in module)

---

## Common Patterns Across This Module

### isv8 Flag
Most list/form components carry `isv8: boolean = false`. When `true`, OData field paths switch from v7 (e.g. `client.name`, `items`, `createdBy.name`) to v8 schema (e.g. `clients.name`, `sale_order_items`, `users.name`). The flag is always `false` in current state — kept for future migration.

### OrderFormComponent Reuse
`OrderFormComponent` is reused by three parent components:
- `SalesOrderComponent` — full read/write
- `SalesRequestComponent` — view-only (`isDisabled = true`, `showNewButton = false`)
- `ExpiredSalesOrderComponent` — view-only (`isDisabled = true`)

The parent always drives `formRef` programmatically via `@ViewChild`.

### REST vs OData Decision
- OData (`true` or default): `SalesOrders`, `Clients`, `ActivityLogs`, `MarketPrices`, `ItemCategories`, `Users`, `Products`
- REST (`false`): `auth`, `sales/create-order`, `sales/update-order`, `sales/get-price-planning`, `sales/get-market-price-entry`, `sales/invoice/generate`, `activity-logs/read`, `item/export`
