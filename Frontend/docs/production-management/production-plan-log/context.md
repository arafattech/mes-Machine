# Production Management — Plan & Production Log

## Files
```
production-plan-log/
├── Production-logs/
│   ├── production-log-list/
│   │   ├── production-log-list.component.ts
│   │   └── production-log-list.component.html
│   └── production-log-form/
│       ├── production-log-form.component.ts
│       └── production-log-form.component.html
├── wastage-logs/
│   ├── wastage-log-list/
│   │   ├── wastage-log-list.component.ts
│   │   └── wastage-log-list.component.html
│   └── log-wastage/
│       ├── log-wastage.component.ts
│       └── log-wastage.component.html
└── work-order-management/
    ├── work-order-list/
    │   ├── work-order-list.component.ts
    │   ├── work-order-list.component.html
    │   └── work-order-list.component.scss (empty)
    └── work-order-form/
        ├── work-order-form.component.ts
        ├── work-order-form.component.html
        └── work-order-form.component.scss (empty)
```

## Routes
- `production-log` (under `LayoutComponent`, sidenav visible) — `ProductionLogListComponent`, guarded by `Permissions.PRODUCTION_LOG`. See [module-overview/context.md](../module-overview/context.md).
- `wastage-log` (under `LayoutComponent`, sidenav visible) — `WastageLogListComponent`, guarded by `Permissions.WASTAGE_LOG`.
- `work-orders` (under `LayoutComponent`, sidenav visible) — `WorkOrderListComponent`, guarded by `Permissions.BASE_DATA_WORK_ORDER`.

## Sidebar
"Plan & Production Log" group → "Log Production" item, "Wastage Log" item, "Work Orders" item, built in `LayoutComponent.buildNavItems()`. "Wastage Log" is its own routed page (own permission, own grid) — logging a new entry (`LogWastageComponent`) is that page's toolbar new-button, not a separate nav entry.

## Components
| Component | Context file |
|---|---|
| `ProductionLogListComponent` | [PRODUCTION_LOG_LIST_COMPONENT_CONTEXT.md](PRODUCTION_LOG_LIST_COMPONENT_CONTEXT.md) |
| `ProductionLogFormComponent` | [PRODUCTION_LOG_FORM_COMPONENT_CONTEXT.md](PRODUCTION_LOG_FORM_COMPONENT_CONTEXT.md) |
| `WastageLogListComponent` | [WASTAGE_LOG_LIST_COMPONENT_CONTEXT.md](WASTAGE_LOG_LIST_COMPONENT_CONTEXT.md) |
| `LogWastageComponent` | [LOG_WASTAGE_COMPONENT_CONTEXT.md](LOG_WASTAGE_COMPONENT_CONTEXT.md) |
| `WorkOrderListComponent` | [WORK_ORDER_LIST_COMPONENT_CONTEXT.md](WORK_ORDER_LIST_COMPONENT_CONTEXT.md) |
| `WorkOrderFormComponent` | [WORK_ORDER_FORM_COMPONENT_CONTEXT.md](WORK_ORDER_FORM_COMPONENT_CONTEXT.md) |

## Work Order Management — moved here from `@base-data-module`
`work-order-management/` (`WorkOrderListComponent` + `WorkOrderFormComponent`) was relocated in full from `base-data-management/work-order-management/` — component code, route, module declarations, and sidebar entry all moved; nothing was rewritten. Unchanged by the move:
- The `WorkOrder` model (`@shared/model/work-order.ts`) — always had zero `base-data-management`-specific coupling, stays at its shared location.
- The backend (`WorkOrderController`, `WorkOrders` OData entity, `work_orders`/`work_order_machines` tables) — this was a frontend-only relocation.
- The permission strings (`Permissions.BASE_DATA_WORK_ORDER*`) — kept as-is rather than renamed to a `PRODUCTION_*` convention, to avoid invalidating already-granted role permissions in a live database. The naming now looks inconsistent with the module the UI lives in; flagged here deliberately rather than silently decided.
- The AG Grid `gridId` was changed from `base-data-work-order-list` to `production-work-order-list` (grid state — column widths/order/filters — is persisted per `gridId`, so users lose their old saved layout for this grid once, same as any `gridId` rename).

Why moved: work-order planning (this) and work-order execution (`production-plan-log/Production-logs/`, `/mco`'s Work Order tab) are the same business object viewed from two angles — keeping both under `production-management` means one module owns the full work-order lifecycle instead of splitting it across `base-data-management` and `production-management`.

## Why this is its own folder, not under `shared/components/`
These are routed pages and the modals they open — not reusable presentational pieces consumed by other pages in this module (unlike `shared/components/`'s contents, e.g. `status-card`, `quality-efficiency`). `Production-logs/` and `wastage-logs/` are separate sibling folders (not one nested inside the other) since they're two independent pages/permissions, not one feature with a sub-feature. Data access (`ProductionLogService`) and the shared `ProductionLogEntryRow`/`EligibleWastageType`/wastage-detail interfaces stay in `shared/` since those genuinely are shared — see [shared/context.md](../shared/context.md).

## Key Relationships
- `ProductionLogListComponent`'s grid groups rows by (work order, shift, day) — not one row per machine. See its own context file for the full reasoning and the backend query behind it.
- `ProductionLogFormComponent` is opened from `ProductionLogListComponent` via `#logFormRef.openDialog()`, and emits `(RefreshTable)` back to it after a successful submit.
- `WastageLogListComponent`'s grid is flat — one row per real `machine_wastage_entries` row, not grouped (an entry already represents one submission, unlike `machine_production_counts` which needs grouping into (work order, shift, day) to read sensibly). `LogWastageComponent` opens from its toolbar new-button (`#wastageFormRef.openDialog()`) and emits `(logged)` back to it, same idiom as `ProductionLogFormComponent`/`RefreshTable`.
- `WastageLogListComponent`'s per-row info action needs no extra request — the list endpoint (`GET /api/wastage-logs`) already eager-loads `allocations.machine`, so the drill-down dialog reads straight off the clicked row's own data. Contrast `ProductionLogListComponent`'s info action, which *does* need a second request (`getGroupDetail()`) precisely because its grid is grouped/aggregated and has lost the per-machine rows.
- Distinct from `shared/components/log-production-entry/` (`LogProductionEntryComponent`), the older **per-machine** "Log Production" dialog still used on `/mco` — see [work-order-and-log-production.md](../work-order-and-log-production.md) for that flow, and `PRODUCTION_LOG_FORM_COMPONENT_CONTEXT.md` for how this one differs (work-order-centric, multi-machine, no scrap field).
- Wastage reporting scoped to **one** work order (per type, per shift/day, per-machine drill-down) additionally lives on `WorkOrderDetailComponent`'s "Wastage by Type" section (`/mco`'s Work Order tab) — `WastageLogListComponent` is the system-wide list, that section is the single-WO detail view. See [WORK_ORDER_DETAIL_COMPONENT_CONTEXT.md](../shared/WORK_ORDER_DETAIL_COMPONENT_CONTEXT.md).
