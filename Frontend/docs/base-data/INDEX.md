# Base Data Management — Documentation Index

This folder contains AI context files for every component group in the `base-data-management` module.

## Module Root
- [module-overview/context.md](module-overview/context.md) — full routing table, common patterns, services, enums, technology stack

## Feature Areas

| Folder | Description |
|--------|-------------|
| [layout/](layout/context.md) | Shell layout with responsive sidebar navigation |
| [home/](home/context.md) | Dashboard — batch count display for all entities |
| [activity-management/](activity-management/context.md) | Audit log viewer (LogInfoComponent + LogListComponent) **and** Login Activity viewer (LoginActivityInfoComponent + LoginActivityListComponent) — two sibling features under one "Activity" sidebar group |
| [asset-management/](asset-management/context.md) | Assets and Asset Groups CRUD |
| [capacity-management/](capacity-management/context.md) | Production capacity definitions |
| [client-management/](client-management/context.md) | Clients with areas, notes, billing/shipping addresses |
| [department-management/](department-management/context.md) | Organizational departments (combined list+form TSX) |
| [employee-management/](employee-management/context.md) | Employee master — complex multi-tab form (bank, assets, salary, shift) |
| [machine-management/](machine-management/context.md) | Machines, PLC config, groups, states, halls |
| [operation-management/](operation-management/context.md) | Operations and Operation Positions (product+machine mapping) |
| [plant-management/](plant-management/context.md) | Plants and Halls (physical locations) |
| [product-management/](product-management/context.md) | Products, categories, sub-categories, UOM, variants |
| [origin/](origin/context.md) | Origin master data CRUD and the Item Form raw-cotton flag |
| [role-permission-management/](role-permission-management/context.md) | Roles, permission assignment, RolePermissionService |
| [storage-management/](storage-management/context.md) | Warehouse storage locations |
| [supplier-management/](supplier-management/context.md) | Suppliers with bank/cash payment records and approval workflow |
| [tools-management/](tools-management/context.md) | Handling units (packaging/tooling) |
| [user-management/](user-management/context.md) | System user accounts, plus Recycle Bin (`UserBinListComponent`) for restoring soft-deleted users |

## Quick Reference

### Adding a new entity to this module
1. Create `*-form.component.ts` following the standard form pattern (see `module-overview/context.md`)
2. Create `*-list.component.tsx` using `CustomGridTableComponent`
3. Add route to `base-data-management-routing.module.ts` with `PermissionGuard`
4. Add a new `BASE_DATA_*` permission key and register it in `RolePermissionService`
5. Add a sidebar menu entry in `base-data-management-layout.component.ts`
6. Add count to home dashboard `BatchApi()` if applicable

### Technology Stack
- Angular (`.ts`) — most form components
- React/TSX (`.tsx`) — list components and complex forms (employee, machine, user, department)
- SAP UI5 Web Components React (`@ui5/webcomponents-react`) — UI elements
- OData — API communication pattern
- `CommonService` — all HTTP calls (never call `HttpClient` directly in components)
