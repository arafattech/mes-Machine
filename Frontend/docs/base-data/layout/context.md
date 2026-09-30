# Base Data Management — Layout Component

## Files
- `layout/base-data-management-layout/base-data-management-layout.component.ts`
- `layout/base-data-management-layout/base-data-management-layout.component.html`

## Selector
`app-base-data-management-layout`

## Type
Layout / Shell component. Acts as the persistent frame for all child routes under `/base-data`.

## Purpose
Renders the responsive side navigation and the `<router-outlet>` for all child pages in the Base Data Management module. Builds the sidebar menu dynamically from user permissions.

## Inputs
None — consumes permissions from services directly.

## Outputs
None.

## Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `isCollapsed` | `boolean` | Sidebar collapse state (toggled by sidenav toggle) |
| `isMobileView` | `boolean` | True when window width ≤ 1100px |
| `permissions` | `{ [key: string]: boolean }` | Permission map from `RolePermissionService` |
| `sidebarMenu` | `SidebarGroup[]` | Dynamic menu structure built from permissions |

## Key Methods

| Method | Trigger | Description |
|--------|---------|-------------|
| `ngOnInit()` | Lifecycle | Loads permissions; subscribes to `CommonService.sidenavToggle` to toggle `isCollapsed` |
| `onResize()` | `@HostListener('window:resize')` | Updates `isMobileView` when viewport changes |
| `toggleExpand(item)` | User click | Toggles `item.expanded` for collapsible menu groups |
| `onLoad()` | Component load | Redirects to the localized route |
| `onClosePopover()` | User interaction | Closes any open popover menu |
| `ngOnDestroy()` | Lifecycle | Unsubscribes from `sidenavToggle` to prevent memory leaks |

## Services Injected

| Service | Usage |
|---------|-------|
| `RolePermissionService` | `getAllPermissionsStatus()` → builds `permissions` object |
| `CommonService` | Subscribes to `sidenavToggle: Subject<void>` |

## Template Structure
```
<app-base-data-management-layout>
  ├── Side Navigation (desktop)
  │   ├── SidebarGroup[].header
  │   └── SidebarGroup[].items[]  (RouterLink, conditional on permissions)
  ├── Mobile Navigation (overlay, shown when isMobileView)
  └── <router-outlet>  ← child components render here
```

## Sidebar Menu Logic
The `sidebarMenu` array is built in `ngOnInit` by checking `permissions[BASE_DATA_*]` keys. Only menu items whose permission resolves to `true` are shown. Menu items support one level of nesting (`SidebarGroup` → items).

## Responsive Behavior
- **≥ 1101px:** Full sidebar, can be collapsed to icon-only mode.
- **≤ 1100px:** Sidebar becomes an overlay drawer; `isMobileView = true`.

## Related
- `CommonService.sidenavToggle` — the global toggle mechanism shared with the app shell.
- `RolePermissionService` — permission source of truth.
- All child route components defined in `base-data-management-routing.module.ts`.
