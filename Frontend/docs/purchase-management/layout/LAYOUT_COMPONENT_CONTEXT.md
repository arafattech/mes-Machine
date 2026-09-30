# PURCHASE_LAYOUT_COMPONENT — Component Context

## Component Identity

| Field | Value |
|---|---|
| Component name | `LayoutComponent` |
| Selector | `app-store-layout` |
| TypeScript | `src/app/modules/purchese-management/layout/layout.component.ts` |
| HTML | `src/app/modules/purchese-management/layout/layout.component.html` |
| SCSS | `src/app/modules/purchese-management/layout/layout.component.scss` |
| Component type | Module shell/layout |

## Purpose
Renders the Purchase Management shell, sidebar navigation, permission-filtered menu, and child routes through the layout template.

## Sidebar Items

| Label | Route | Icon | Permission |
|---|---|---|---|
| SPR Requests | `spr-requests` | `course-book` | `PURCHESE_SPR_REQUESTS` |
| RFQ | `rf-quotations` | `document` | `PURCHESE_SR_REQUEST` |
| Comparative Study | `comparative-study` | `filter-analytics` | `PURCHESE_SR_REQUEST` |
| Purchase Orders | `purchase-orders` | `sales-order` | `PURCHESE_ADMIN` |
| Vendor List | `supplier-list` | `supplier` | `PURCHESE_ADMIN` |

## Key Methods

| Method | Purpose |
|---|---|
| `ngOnInit()` | Builds permission-filtered menu and subscribes to shared sidenav collapsed state |
| `filterMenuByPermissions()` | Removes groups/items the current user cannot access |
| `checkEmployeePermission()` | Redirects to first allowed purchase page if current page is not permitted |
| `ngOnDestroy()` | Unsubscribes from sidenav toggle subscription |

## Future Add Notes
- When adding a new purchase route, update `fullSidebarMenu`, route docs, and `INDEX.md`.
