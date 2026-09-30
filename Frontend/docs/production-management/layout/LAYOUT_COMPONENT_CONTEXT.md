# LAYOUT_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `src/app/modules/production-management/layout/layout.component.ts` |
| **HTML file** | `src/app/modules/production-management/layout/layout.component.html` |
| **Selector** | `app-layout` |
| **Component type** | Standalone shell/layout |
| **Purpose** | Persistent frame for `/production/*`: renders SAP UI5 side navigation built from hall data + permissions, and `<router-outlet>` for child pages. |

---

## Imports (standalone)
`CommonModule`, `SideNavigationComponent`, `SideNavigationGroupComponent`, `SideNavigationItemComponent`, `SideNavigationSubItemComponent` (`@ui5/webcomponents-ngx`), `RouterLink`, `RouterLinkActive`, `RouterOutlet`.

`schemas: [CUSTOM_ELEMENTS_SCHEMA]` — for raw `ui5-*` elements not covered by the Angular wrapper library.

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `isCollapsed` | `boolean` | `false` | Sidenav collapsed state — driven by viewport width and `CommonService.sidenavToggle` |
| `isHide` | `boolean` | `false` | Hides sidenav entirely — driven by `CommonService.sidenavHidden` (Full-Screen mode from the board) |
| `hallList` | `Hall[]` | `[]` | From `productionService.hallList$` |
| `machines` | `Machine[]` | `[]` | Declared but unused in template — dead field (list is not rendered here, only used to build nav) |
| `sidebarMenu` | `SidebarGroup[]` | `[]` | Rendered nav structure |
| `permissions` | `{ [key: string]: boolean }` | `{}` | From `RolePermissionService.getAllPermissionsStatus()` |

---

## Lifecycle

- **Constructor**: calls `productionService.loadMachines('all-machines')` immediately (side effect in DI constructor, not `ngOnInit`).
- **`ngOnInit()`**:
  1. Loads `permissions`.
  2. Runs `checkScreenWidth(window.innerWidth)`.
  3. Subscribes to `CommonService.sidenavToggle` → `isCollapsed`.
  4. Subscribes to `CommonService.sidenavHidden` → `isHide`.
  5. Subscribes to `productionService.hallList$` → sets `hallList`, calls `buildNavItems()`.
- **`ngOnDestroy()`**: unsubscribes `sidenavToggleSubscription` only — `sidenavHiddenSubscription` and the `hallList$` subscription are **not** torn down (leak risk, though both are root-singleton observables that complete only on app teardown, so practical impact is low as long as `LayoutComponent` itself isn't repeatedly created/destroyed).

---

## Methods

| Method | Description |
|--------|-------------|
| `buildNavItems()` | Rebuilds `sidebarMenu`: fixed "All Machines" group (`type: 'all-machines'`) + a "Halls" group with one item per `hallList` entry (`type: hall.id`) |
| `onResize(event)` (`@HostListener('window:resize')`) | Re-runs `checkScreenWidth` |
| `checkScreenWidth(width)` | `< 1020px` → collapse sidenav, else expand |
| `toggleExpand(item)` | Toggles `item.expanded`; calls `productionService.loadMachines(item.type)` — this is the actual trigger for hall-filtered machine loading |
| `onLoad()` | Dashboard nav item click — full page redirect to `/${preferred_language}` (leaves Angular router) |

---

## Template Structure

```
<ui5-busy-indicator [active]="productionService.isLoading">
  <ui5-side-navigation [collapsed]="isCollapsed">
    <ui5-side-navigation-item text="Dashboard" (click)="onLoad()">
    <ui5-side-navigation-group *ngFor="sidebarMenu">
      <ui5-side-navigation-item *ngFor="group.items" [permission-gated]
                                 (click)="toggleExpand(item)">
        <ui5-side-navigation-sub-item *ngFor="item.subItems" [permission-gated]>
  <router-outlet>  <!-- sibling of the busy-indicator wrapper, not inside it -->
```

Permission gating pattern: `*ngIf="!item.permission || (permissions && permissions[item.permission])"` — items with no `permission` field are always shown.

---

## Services Injected

| Service | Usage |
|---------|-------|
| `RolePermissionService` | `getAllPermissionsStatus()` |
| `CommonService` | `sidenavToggle` / `sidenavHidden` emitters |
| `ProductionService` (public) | `hallList$`, `loadMachines()`, `isLoading` — bound directly in template |

---

## Key Business Logic

- Hall entries in the sidebar always route to `production` (the index route) — the hall *type* passed to `loadMachines()` is what actually filters data; the URL never changes.
- `isLoading` (from `ProductionService`) drives the busy-indicator around the **entire sidenav**, not just the hall list — a slow `Halls` OData call blocks sidenav rendering.
