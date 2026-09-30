# SALES_LAYOUT_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| **TypeScript file** | `src/app/modules/sales-management/layout/sales-layout.component.ts` |
| **HTML template** | `src/app/modules/sales-management/layout/sales-layout.component.html` |
| **Stylesheet** | `sales-layout.component.scss` |
| **Selector** | `app-hr-data-management-layout` |
| **Component type** | Layout (Shell / Navigation Wrapper) |
| **Standalone** | Yes |

**Purpose:** Top-level shell for the Sales Management module. Renders a persistent `ui5-side-navigation` sidebar populated with permission-filtered groups and items. A `<router-outlet>` hosts all child routes. On initialization the component checks whether the authenticated user has pending market price entries; if so it opens a `ui5-dialog` containing an `app-ag-grid-table` (static data, editable Market Price column) where the user can enter and submit market prices before proceeding. A secondary `ui5-dialog` shows validation warnings when prices are missing or zero.

---

## Inputs (@Input)

No `@Input()` properties declared.

---

## Outputs (@Output)

No `@Output()` event emitters declared.

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `dashboard` | `string` | `$localize\`Dashboard\`` | i18n label for Dashboard nav item |
| `analytics` | `{ name, route, permissions }` | see class | Analytics nav item config |
| `isCollapsed` | `boolean` | `false` | Controls `[collapsed]` on `ui5-side-navigation` |
| `sidenavToggleSubscription` | `Subscription` (private) | `!` | Subscription to `CommonService.sidenavToggle`; unsubscribed on destroy |
| `items` | `any[]` | `[]` | Market price entry rows for the plan dialog grid |
| `columns` | `AgGridTableColumn<any>[]` | built in constructor | Column defs for the plan grid — built by `buildColumns()` |
| `planDataSource` | `AgGridTableODataSourceConfig<any>` | `staticData: true, data: []` | Static datasource for plan grid; data swapped in `getSalesUserMarketPriceEntry()` |
| `planToolbarConfig` | `AgGridTableToolbarConfig` | see class | Toolbar for plan grid — search only, no new/download/settings |
| `planDisplayConfig` | `AgGridTableDisplayConfig` | `gridHeight: calc(100vh - 550px)` | Display config for plan grid |
| `openPlan` | `boolean` | `false` | Opens/closes the Marketing Plan dialog |
| `permissions` | `{ [key: string]: boolean }` | `{}` | Permission map from `RolePermissionService` |
| `authUser` | `any` | `undefined` | Authenticated user object fetched from `/api/auth` |
| `isWarning` | `boolean` | `false` | Controls the validation warning dialog |
| `warningMessage` | `string` | `""` | Message shown in the warning dialog |
| `localization` | `typeof Localization` | `Localization` | Shared localization constants |

---

## ViewChild

No `@ViewChild` declared — plan grid data read directly from `this.items` (mutated via `onPlanCellEdited`).

---

## Lifecycle Hooks

### `constructor()`
1. Calls `rolePermissionService.getAllPermissionsStatus()` → populates `permissions`.
2. Calls `buildColumns()` → populates `columns`.
3. Calls `checkEmployeePermission()` to redirect user to first allowed route.

### `ngOnInit()`
1. Calls `filterMenuByPermissions(this.fullSidebarMenu)` → sets `sidebarMenu`.
2. Subscribes to `CommonService.sidenavToggle` → updates `isCollapsed`.
3. Calls `getAuthorization()`.

### `ngOnDestroy()`
1. Unsubscribes `sidenavToggleSubscription` to prevent memory leaks.

---

## Methods — Detailed

### `buildColumns(): AgGridTableColumn<any>[]`
Returns column defs for the plan grid: `Item Code` (field `item_code`, w140), `Name` (field `product_name`, flex 1), `Unit` (colId `uom_name`, `valueGetter` → `uom.name`, w110), `Unit Price` (`valueFormatter` → `currency + ' ' + unit_price`, w130), `Market Price` (editable `dataType: NumberField`, minValue 0, w140).

### `filterMenuByPermissions(menu: SidebarGroup[]): SidebarGroup[]`
Maps over groups; removes any group whose `permission` key is `false` in `permissions`; removes items with failing permission keys. Groups with zero remaining items dropped. Returns only groups+items the user can access.

### `checkEmployeePermission()`
Reads current URL path under `/sales-management/`. Iterates over `permissions`; on first `true` permission that matches an `allowedRoutes` entry, navigates to that route (unless already on an allowed route). Special case: if user has `SALES_ANALYTICS` permission, navigates to `sales-analytics`.

### `getAuthorization()`
GETs `/api/auth` (REST — `false` flag) → stores `authUser`. If `SALES_MARKET_PRICE_ENTRY` permission: calls `getSalesUserMarketPriceEntry()`.

### `getSalesUserMarketPriceEntry()`
GETs `/api/sales/get-market-price-entry?user_id=<id>` (REST). Stores result in `this.items`. Updates `planDataSource` with `staticData: true, data: this.items`. If `items.length > 0`, sets `openPlan = true`.

### `onPlanCellEdited(event: { row: any; field: string; newValue: any })`
Finds matching item in `this.items` by `id` and mutates `item[field] = newValue`. Keeps `this.items` in sync with inline edits without reading the grid ref.

### `savePlan()`
1. Sets `openPlan = true` (dialog stays open during save).
2. Reads `this.items` directly (no grid ref needed).
3. Validates every item has `market_price > 0`; if not, sets `warningMessage` + `isWarning = true`, returns early.
4. Builds OData `$batch` payload: one POST per item to `/odata/MarketPrices` with `{ product_id, unit_price: item.market_price, created_by: authUser.id }`.
5. POSTs `$batch` (OData — `true` flag). On success: calls `getSalesUserMarketPriceEntry()`, calls `ClosePlan()`, calls `toastService.show('add')`.

### `ClosePlan()`
Sets `openPlan = false`.

### `onLoad()`
Performs `window.location.href = '/dashboard'` — hard navigation to app dashboard.

### `toggleExpand(item)`
Toggles `item.expanded`. If `SALES_MARKET_PRICE_ENTRY` permission: calls `getSalesUserMarketPriceEntry()`.

### `NavigateToggle(event)`
Empty — no implementation.

---

## Template Structure

```
<div class="d-flex w-100">
  ├── <ui5-side-navigation [collapsed]="isCollapsed">
  │   ├── Dashboard item → onLoad()
  │   ├── Analytics item → [routerLink]="analytics.route" *ngIf SALES_ANALYTICS
  │   └── <ui5-side-navigation-group *ngFor="sidebarMenu">
  │       └── <ui5-side-navigation-item *ngFor="group.items">
  │           └── <ui5-side-navigation-sub-item *ngFor="item.subItems">
  └── <router-outlet>

<ui5-dialog [open]="openPlan" header-text="Marketing Plan">
  └── <app-ag-grid-table
        [columns]="columns"
        [dataSource]="planDataSource"
        [toolbarConfig]="planToolbarConfig"
        [displayConfig]="planDisplayConfig"
        selectionMode="None"
        [isBase]="false"
        [isTableCacheEnabled]="false"
        (cellEdited)="onPlanCellEdited($event)">
  └── footer: <ui5-toolbar-button (click)="savePlan()">Save

<ui5-dialog [open]="isWarning" state="Critical">
  └── {{warningMessage}}
  └── footer: <ui5-button (click)="isWarning = false">Cancel
```

---

## API Calls

| Method | Endpoint | OData | Purpose |
|---|---|---|---|
| GET | `auth` | `false` (REST) | Fetch authenticated user |
| GET | `sales/get-market-price-entry?user_id=<id>` | `false` (REST) | Pending market price items for user |
| POST | `$batch` | `true` (OData) | Batch-create `MarketPrices` records |

---

## Local Interfaces

```typescript
interface SubItem {
  text: string;
  permission?: string;
  routerLink: string;
}

interface MenuItem {
  text: string;
  icon: string;
  slot?: string;
  expanded: boolean;
  permission?: string;
  routerLink?: string;
  subItems?: SubItem[];
}

interface SidebarGroup {
  text: string;
  expanded: boolean;
  permission?: string;
  items: MenuItem[];
}
```

---

## Services Injected

| Service | Methods Used |
|---|---|
| `RolePermissionService` | `getAllPermissionsStatus()`, `hasPermission(Permissions.SALES_MARKET_PRICE_ENTRY)`, `hasPermission(Permissions.SALES_ANALYTICS)` |
| `CommonService` | `sidenavToggle` subscription; `get(url, false)` for auth; `get(url, false)` for market price entry; `post('$batch', payload, true)` |
| `ToastService` | `show('add')` after successful batch save |
| `Router` | `navigate([...])` in `checkEmployeePermission()` |

---

## Key Business Logic

### Market Price Entry Flow
When a sales user logs in and has `SALES_MARKET_PRICE_ENTRY` permission, the layout intercepts navigation to force market price entry before the user can use the module. The dialog cannot be dismissed — only the Save button closes it, and only after all items have valid prices > 0. Cell edits are tracked via `onPlanCellEdited` which mutates `this.items` directly; `savePlan()` reads `this.items` without any grid ref.

### Permission Double-Guard
Both `filterMenuByPermissions()` (TypeScript) and `*ngIf` guards in the template independently check permissions. Dual guard ensures that even if menu data is manipulated client-side, the DOM element is not rendered.

### Sidebar Click / Expand Side Effect
`toggleExpand()` intentionally triggers `getSalesUserMarketPriceEntry()` on each sidebar click (for users with entry permission). Re-checks for new pending entries as the user navigates.
