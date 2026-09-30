# BASE_DATA_LAYOUT_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| **TypeScript file** | `src/app/modules/base-data-management/layout/base-data-management-layout/base-data-management-layout.component.ts` |
| **HTML template** | `src/app/modules/base-data-management/layout/base-data-management-layout/base-data-management-layout.component.html` |
| **Stylesheet** | `base-data-management-layout.component.scss` |
| **Selector** | `app-base-data-management-layout` |
| **Component type** | Layout (Shell / Navigation Wrapper) |
| **Standalone** | Yes |

**Purpose:** This is the top-level shell/layout component for the Base Data Management module. It renders a persistent side navigation panel populated with permission-filtered menu groups, items, and sub-items. A `<router-outlet>` placed beside the sidebar hosts all child routes of the module. On screens narrower than 1100 px the fixed sidebar is hidden and replaced by a `ui5-popover` that slides open when the application-wide sidenav toggle is triggered. The component therefore acts as the structural frame that every Base Data sub-page lives inside.

---

## Inputs (@Input)

This component declares **no `@Input()` properties**. All data it needs is sourced from injected services and its own internal state.

---

## Outputs (@Output)

This component declares **no `@Output()` event emitters**.

---

## State Properties

| Property | Type | Default / Initial Value | Purpose |
|---|---|---|---|
| `dashboard` | `string` | `$localize\`Dashboard\`` (i18n) | Localised label for the Dashboard navigation item |
| `home` | `string` | `$localize\`Home\`` (i18n) | Localised label for the Home navigation item |
| `isCollapsed` | `boolean` | `false` | Controls the `[collapsed]` binding on `ui5-side-navigation`; toggled by the global sidenav toggle subscription |
| `isOpened` | `boolean` | `false` | Controls the `[open]` binding on the `ui5-popover` (mobile view); toggled by the sidenav toggle subscription and reset by `onClosePopover()` |
| `sidenavToggleSubscription` | `Subscription` (private) | `!` (definite-assignment) | Holds the RxJS subscription to `CommonService.sidenavToggle` so it can be cleanly unsubscribed in `ngOnDestroy` |
| `permissions` | `{ [key: string]: boolean }` | `{}` | Dictionary of permission keys to boolean values; populated from `RolePermissionService` on init; drives `*ngIf` guards on each menu item and sub-item |
| `isMobileView` | `boolean` | `window.innerWidth <= 1100` | Evaluated at class construction time and updated on every window resize; when `true` the sidebar is hidden and the popover is rendered instead |
| `sidebarMenu` | `SidebarGroup[]` | See full definition below | The complete menu tree — two top-level groups ("Base Data Management" and "Settings"), each containing `MenuItem` objects with optional `SubItem` arrays |

### `sidebarMenu` — full structure

**Group 1 — "Base Data Management"** (`expanded: true`), containing the following `MenuItem` entries:

| Menu item text (i18n) | Icon | Permission key | RouterLink | Sub-items |
|---|---|---|---|---|
| Item Management | `product` | `BASE_DATA_ITEM` | — | Item List (`products`), Item Type (`product-type`), UOM List (`uom-list`) |
| Department | `folder` | `BASE_DATA_DEPARTMENT` | `departments` | — |
| Category Management | `customize` | `BASE_DATA_CATEGORY` | — | Category List (`item-categories`), SubCategory List (`item-subcategories`) |
| Supplier | `supplier` | `BASE_DATA_SUPPLIER` | `supplier` | — |
| Supplier Bank Details | `wallet` | `BASE_DATA_SUPPLIER_BANK_DETAILS` | `supplier-bank` | — |
| Employee | `employee` | `BASE_DATA_EMPLOYEE` | `employees` | — |
| Machines Management | `action-settings` | `BASE_DATA_MACHINE` | — | Machine List (`machines`), Machine Configuration (`machine-config`), Machine Group (`machine-group`), Machine State (`machine-state`) |
| Client Management | `key-user-settings` | `BASE_DATA_CLIENT` | — | Client List (`client`), Client Note (`client-note`), Client Area (`client-area`) |
| Plant Management | `multi-select` | `BASE_DATA_PLANT` | — | Plant List (`plants`), Hall List (`hall`) |
| Capacities | `Chart-Tree-Map` | `BASE_DATA_CAPACITY` | `capacity` | — |
| Storage Management | `retail-store-manager` | `BASE_DATA_STORAGE` | — | Storage Location (`storage-location`) |
| Asset Management | `bbyd-dashboard` | `BASE_DATA_ASSET` | — | Asset List (`asset-list`), Asset Group (`asset-group`) |
| Operation Management | `developer-settings` | `BASE_DATA_OPERATION` | — | Operation Lists (`operations`) |
| Tools Management | `technical-object` | `BASE_DATA_TOOLS` | — | Handling Units (`handling-units`) |

**Group 2 — "Settings"** (`expanded: true`):

| Menu item text (i18n) | Icon | Permission key | RouterLink | Sub-items |
|---|---|---|---|---|
| Roles Permissions | `permission` | `BASE_DATA_ROLE_PERMISSION` | `roles-permissions` | — |
| User Management | `account` | `BASE_DATA_USER` | `user-management` | — |

Note: An "Item Variants" group is present in the source but commented out (`// { text: \`Item Variants\` ... }`).

---

## ViewChild / ViewChildren

None declared. The template references `#sidenav` as a local template reference on `ui5-side-navigation` but this is **not** read back into the component class via `@ViewChild`. It is unused in the TypeScript.

---

## Lifecycle Hooks

### `ngOnInit()`

1. Calls `this.rolePermissionService.getAllPermissionsStatus()` and assigns the returned permission map to `this.permissions`. This single call populates the entire permission dictionary used by all `*ngIf` guards in the template.
2. Subscribes to `this.CommonService.sidenavToggle` (a `Subject` or `BehaviorSubject` on `CommonService`). For every emitted value:
   - Sets `this.isCollapsed` to the emitted boolean value.
   - Toggles `this.isOpened` to its logical opposite (`!this.isOpened`).

### `ngOnDestroy()`

1. Checks whether `sidenavToggleSubscription` is truthy (guards against the case where `ngOnInit` never completed).
2. Calls `.unsubscribe()` on it to prevent memory leaks.

No `ngAfterViewInit` or other lifecycle hooks are implemented.

---

## Methods — Detailed

### `onResize()` — `@HostListener('window:resize')`

**Signature:** `onResize(): void`

- Automatically invoked by Angular whenever the browser window fires a `resize` event.
- Reads `window.innerWidth` and evaluates `<= 1100`.
- Sets `this.isMobileView` to the resulting boolean.
- Side effect: the template re-evaluates `*ngIf="!isMobileView"` (desktop sidebar) and the `ui5-popover` `*ngIf="isMobileView"`, causing DOM elements to be created or destroyed in response to the viewport change.
- No return value.

### `NavigateToggle(event: any)`

**Signature:** `NavigateToggle(event: any): void`

- Empty method body — no logic is implemented.
- It appears to be a placeholder that was never completed or is no longer needed.
- Not called from the template.

### `toggleExpand(item: any)`

**Signature:** `toggleExpand(item: any): void`

- Receives any object (in practice always a `MenuItem`).
- Toggles `item.expanded` to its logical opposite: `item.expanded = !item.expanded`.
- Because `sidebarMenu` is a plain array of objects (not immutable), mutating `item.expanded` directly triggers change detection and the `ui5-side-navigation-item`'s `[expanded]` binding updates.
- Called from the template via `(click)="toggleExpand(item)"` on each `ui5-side-navigation-item`.
- No return value.

### `onLoad()`

**Signature:** `onLoad(): void`

- Reads the value of the `preferred_language` key from `localStorage`.
- Performs a hard browser navigation: `window.location.href = '/' + preferred_language`.
- The intent is to redirect the user to the language-prefixed root of the application (e.g. `/en`, `/de`), effectively sending them back to the application home page in their preferred locale.
- Called from `(click)="onLoad()"` on the "Dashboard" `ui5-side-navigation-item`.
- No return value.

### `onClosePopover()`

**Signature:** `onClosePopover(): void`

- Sets `this.isOpened = false`.
- Called from `(close)="onClosePopover()"` on the `ui5-popover` — i.e., when the popover is dismissed by the user (click-outside or explicit close).
- Ensures the component's `isOpened` state stays in sync with the actual popover visibility after a user-initiated close.
- No return value.

---

## Template Bindings & Structure

The template is split into two mutually exclusive rendering branches driven by `isMobileView`.

### Desktop branch — `*ngIf="!isMobileView"`

```
<div class="d-flex w-100">
  <div *ngIf="!isMobileView">
    <ui5-side-navigation [collapsed]="isCollapsed" #sidenav>
      <!-- Fixed dashboard item -->
      <ui5-side-navigation-item text="Dashboard" icon="business-suite/3d" (click)="onLoad()" routerLinkActive="active-link">
      <!-- Fixed home item -->
      <ui5-side-navigation-item text="Home" icon="home" routerLink="/base-data" routerLinkActive="active-link">

      <!-- Dynamic groups -->
      <ui5-side-navigation-group *ngFor="let group of sidebarMenu" [text]="group.text" [expanded]="group.expanded">
        <ng-container *ngFor="let item of group.items">
          <!-- Permission-guarded top-level item -->
          <ui5-side-navigation-item
            *ngIf="!item.permission || (permissions && permissions[item.permission])"
            [text]="item.text" [icon]="item.icon" [routerLink]="item.routerLink"
            unselectable [expanded]="item.expanded" (click)="toggleExpand(item)">
            <!-- Sub-items -->
            <ng-container *ngFor="let subItem of item.subItems">
              <ui5-side-navigation-sub-item
                *ngIf="!subItem.permission || (permissions && permissions[subItem.permission])"
                [text]="subItem.text" [routerLink]="subItem.routerLink"
                (click)="$event.stopPropagation()">
            </ng-container>
          </ui5-side-navigation-item>
        </ng-container>
      </ui5-side-navigation-group>

      <!-- Fixed "Activity" item in fixedItems slot (permission-guarded) -->
      <ui5-side-navigation-item
        *ngIf="permissions['BASE_DATA_ACTIVITY_LOG']"
        slot="fixedItems" text="Activity" icon="history" routerLink="activity-log">
    </ui5-side-navigation>
  </div>

  <!-- Router outlet fills remaining width -->
  <div class="w-100 pt-1 pe-1 overflow-auto">
    <router-outlet></router-outlet>
  </div>
</div>
```

Key binding details:
- `[collapsed]="isCollapsed"` — collapses the sidebar to icon-only mode when the global toggle fires.
- `routerLinkActive="active-link"` — Angular adds the CSS class `active-link` to any navigation item whose route is currently active.
- `unselectable` attribute on parent items with sub-items — prevents the parent item itself from acting as a navigation target in the `ui5-side-navigation`.
- `$event.stopPropagation()` on sub-items — prevents the click from bubbling up to the parent item's `(click)="toggleExpand(item)"` handler, which would incorrectly collapse the parent.
- The `slot="fixedItems"` attribute pins the "Activity" item to the bottom of the sidebar, outside the scrollable area.

### Mobile branch — `*ngIf="isMobileView"` (Popover)

```
<ui5-popover *ngIf="isMobileView" [open]="isOpened" opener="SettingsNav" placement="Bottom" (close)="onClosePopover()">
  <ui5-side-navigation>
    <!-- Identical navigation tree as desktop branch -->
  </ui5-side-navigation>
</ui5-popover>
```

Key binding details:
- `[open]="isOpened"` — the popover is shown/hidden by the `isOpened` boolean.
- `opener="SettingsNav"` — the popover anchors to the DOM element with `id="SettingsNav"` (defined elsewhere in the application shell, not in this component).
- `placement="Bottom"` — the popover opens below the opener element.
- `(close)="onClosePopover()"` — resets `isOpened` to `false` when the user dismisses the popover.
- The navigation tree inside the popover is a complete duplication of the desktop tree — same groups, same permission guards, same event handlers.

---

## API Calls

**None.** This component makes no direct HTTP calls. All data is retrieved synchronously from `RolePermissionService.getAllPermissionsStatus()` (which itself may wrap a cached HTTP result, but that is transparent to this component).

---

## Validation Logic

**None.** This is a pure layout/navigation component with no forms or user input fields.

---

## Services Injected

| Service | Injection token | Why injected | Methods / properties used |
|---|---|---|---|
| `RolePermissionService` | `RolePermissionService` | To load the current user's permission map | `getAllPermissionsStatus(): { [key: string]: boolean }` — called once in `ngOnInit` |
| `CommonService` | `CommonService` | To receive the global sidebar collapse/toggle signal | `sidenavToggle` — an RxJS `Subject`/`Observable` subscribed to in `ngOnInit`; emits `boolean` values representing the collapse state |

---

## Inter-component Communication

| Direction | Mechanism | Detail |
|---|---|---|
| Parent → this (via service) | `CommonService.sidenavToggle` Observable | The application shell (or a header component) emits on this subject to tell the layout to collapse/expand the sidebar or open/close the mobile popover |
| This → children (via router) | `<router-outlet>` | All Base Data sub-pages are rendered as routed children inside the outlet; no direct component-to-component communication |
| This → UI5 components | Property bindings | `[collapsed]`, `[open]`, `[expanded]`, `[text]`, `[icon]`, `[routerLink]` are passed down to `ui5-side-navigation*` and `ui5-popover` web components |

---

## Local Interfaces / Models Used

All three interfaces are defined at the top of the TypeScript file (file-local scope, not exported):

### `SubItem`
```typescript
interface SubItem {
  text: string;          // Display label
  permission?: string;   // Optional permission key; if absent the item is always visible
  routerLink: string;    // Angular router link (relative to current module route)
}
```

### `MenuItem`
```typescript
interface MenuItem {
  text: string;          // Display label
  icon: string;          // UI5 icon name
  slot?: string;         // Optional slot attribute (e.g. "fixedItems") — not currently used in the data
  expanded: boolean;     // Whether the item's sub-items are visible
  permission?: string;   // Optional permission key; if absent the item is always visible
  routerLink?: string;   // Optional direct router link (leaf items)
  subItems?: SubItem[];  // Optional list of child sub-items
}
```

### `SidebarGroup`
```typescript
interface SidebarGroup {
  text: string;          // Group header label
  expanded: boolean;     // Whether the group is expanded
  items: MenuItem[];     // The group's top-level menu items
}
```

### Imported Enum

| Enum | Source | Usage |
|---|---|---|
| `Permissions` | `@app/shared/enums/permissions` | Provides string constants for every permission key used in `sidebarMenu` item and sub-item definitions (e.g. `Permissions.BASE_DATA_ITEM`, `Permissions.BASE_DATA_ITEM_LIST`, etc.) |

---

## Key Business Logic

### Permission Filtering (dual-level guard)

Every menu item and sub-item carries an optional `permission` string. The template evaluates:

```html
*ngIf="!item.permission || (permissions && permissions[item.permission])"
```

This means:
- If `permission` is `undefined` (omitted from the object), the item is **always visible** — no permission check is applied.
- If `permission` is defined, the item is visible **only if** the `permissions` dictionary contains `true` for that key.
- The check is applied independently at both the parent `MenuItem` level and the child `SubItem` level. A parent item being visible does not guarantee its sub-items are; each sub-item is guarded individually.
- The Activity Log link uses a **hardcoded string literal** (`permissions['BASE_DATA_ACTIVITY_LOG']`) rather than a `Permissions` enum constant, which is an inconsistency.

### Responsive Dual-Render Strategy

Rather than using CSS media queries to hide/show the sidebar, the component uses structural directives (`*ngIf`) to destroy or create the entire sidebar DOM tree based on `isMobileView`. This means:

- On desktop (`window.innerWidth > 1100`): a persistent `ui5-side-navigation` is rendered inside the flex layout alongside the `router-outlet`.
- On mobile (`window.innerWidth <= 1100`): the sidebar div is absent from the DOM entirely; a `ui5-popover` (anchored to `opener="SettingsNav"`) is conditionally rendered and opened by the sidenav toggle signal.

The threshold is evaluated at **class construction time** (`public isMobileView: boolean = window.innerWidth <= 1100`) and then kept up to date by the `@HostListener('window:resize')` decorator.

### Sidenav Toggle Dual Effect

When `CommonService.sidenavToggle` emits a boolean value `v`:
- `isCollapsed` is set to `v` — this collapses the desktop sidebar to icon-only mode.
- `isOpened` is toggled to `!isOpened` — this opens or closes the mobile popover.

These two effects are independent: on desktop `isOpened` changes but has no visible effect (the popover is absent from the DOM); on mobile `isCollapsed` changes but the `ui5-side-navigation` inside the popover does not use it.

### Click Propagation Control on Sub-items

Sub-items bind `(click)="$event.stopPropagation()"`. Without this, clicking a sub-item would also trigger the parent item's `(click)="toggleExpand(item)"` handler, inadvertently collapsing the parent's sub-item list immediately after the user selects a route. The `stopPropagation` call prevents this.

### Locale-based Hard Navigation (Dashboard item)

The "Dashboard" navigation item does not use `routerLink`. Instead it calls `onLoad()`, which reads `localStorage.preferred_language` and performs `window.location.href = '/' + preferred_language`. This triggers a full page reload/navigation to the application root in the user's preferred language rather than an Angular in-app navigation — intentionally bypassing the router to allow the application shell to re-initialise with the correct locale prefix.
