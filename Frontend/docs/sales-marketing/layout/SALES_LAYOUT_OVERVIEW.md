# Sales Management — Layout Component

## Files
- `layout/sales-layout.component.ts`
- `layout/sales-layout.component.html`

## Selector
`app-hr-data-management-layout`

## Type
Layout / Shell component. Persistent frame for all child routes under `/sales-management`.

## Purpose
Renders responsive side nav and `<router-outlet>` for Sales Management child pages. Builds sidebar from user permissions. On init, checks pending market price entries for logged-in user; opens `ui5-dialog` prompting submission if any exist.

## Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `isCollapsed` | `boolean` | Sidebar collapse state (toggled by sidenav toggle) |
| `permissions` | `{ [key: string]: boolean }` | Permission map from `RolePermissionService` |
| `sidebarMenu` | `SidebarGroup[]` | Permission-filtered sidebar menu |
| `openPlan` | `boolean` | Controls Market Plan `ui5-dialog` open state |
| `items` | `any[]` | Market price entry items in plan dialog |
| `isWarning` | `boolean` | Controls validation warning dialog |
| `warningMessage` | `string` | Message in validation warning dialog |
| `authUser` | `any` | Authenticated user from `/api/auth` |

## Key Methods

| Method | Description |
|--------|-------------|
| `ngOnInit()` | Filters sidebar by permissions; subscribes to `CommonService.sidenavToggle`; calls `getAuthorization()` |
| `getAuthorization()` | Fetches auth user; calls `getSalesUserMarketPriceEntry()` if user has `SALES_MARKET_PRICE_ENTRY` permission |
| `getSalesUserMarketPriceEntry()` | Fetches pending market price items; sets `openPlan = true` if items exist |
| `savePlan()` | Validates market prices > 0; submits batch OData `$batch` POST to `MarketPrices`; closes dialog |
| `checkEmployeePermission()` | Redirects to first allowed route on load |
| `filterMenuByPermissions()` | Filters `fullSidebarMenu` groups/items by `permissions` map |
| `toggleExpand(item)` | Toggles sidebar item expand; triggers `getSalesUserMarketPriceEntry()` if permitted |

## Sidebar Menu Structure

**Group: Sales Management** (permission: `SALES_ADMIN`)

| Item | Icon | Permission | Route |
|------|------|-----------|-------|
| Pricing Plan | `my-view` | `SALES_PRICING_PLAN` | `pricing-plan` |
| Sales Order | `sales-order` | `SALES_SALES_ORDERS` | `sales-orders` |
| Sales Requests | `crm-sales` | `SALES_SALES_REQUESTS` | `sales-requests` |
| Audit Trail | `customer-history` | `SALES_SALES_REQUESTS` | `audit-trail` |
| Expired Orders | `explorer` | `SALES_EXPIRED_SALES_ORDERS` | `expired-sales-orders` |
| Market Price History | `activity-items` | `SALES_MARKET_PRICE_HISTORY` | `market-price-history` |

Fixed analytics item (top-level): `sales-analytics` — guarded by `SALES_ANALYTICS`.

## Services Injected

| Service | Usage |
|---------|-------|
| `RolePermissionService` | `getAllPermissionsStatus()` + `hasPermission()` |
| `CommonService` | `sidenavToggle` subscription; `get('auth')` and OData calls |
| `ToastService` | Success toast after saving plan |
| `Router` | `checkEmployeePermission()` redirect |

## Related
- `sales.route.ts` — child route definitions
- `sales.module.ts` — module declaration