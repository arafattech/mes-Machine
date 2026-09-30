# SidebarComponent

**Selector:** `app-sidebar`
**File:** `src/app/shared/components/sidebar/sidebar.component.ts`
**Standalone:** Yes — `CUSTOM_ELEMENTS_SCHEMA`
**Imports:** `RouterLink`, `CommonModule`, `SideNavigationComponent`, `SideNavigationGroupComponent`, `SideNavigationItemComponent`, `Ui5WebcomponentsIconsModule`

## What It Does

SAP UI5 side navigation menu. Currently contains two hardcoded items: Home (→ `/dashboard`) and Product List (→ `/products`). Supports collapsing via `[collapsed]` binding.

## Inputs

| Input | Type | Default | Purpose |
|---|---|---|---|
| `collapsed` | `boolean` | `false` | Collapses sidebar to icon-only mode |

## Outputs

None.

## Template Structure

```
ui5-side-navigation [collapsed]="collapsed"
  ui5-side-navigation-item  Home → /dashboard
  ui5-side-navigation-group
    ui5-side-navigation-item  Product List → /products
```

## Usage Pattern

```html
<app-sidebar [collapsed]="isSidebarCollapsed"></app-sidebar>
```

`LayoutComponent` manages `collapsed` state via `toggleSidenav()`.

## Notes

Navigation items are hardcoded. Full application navigation is driven by `LayoutComponent` and `BaseDataManagementLayoutComponent` sub-menus, not this component. This sidebar is currently minimal — the main navigation structure lives in module-level layout components.
