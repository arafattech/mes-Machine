# Purchase Management — Documentation Index

## Module Root
- [module-overview/context.md](module-overview/context.md) — source structure, route table, module declarations, shared imports, future add notes
- Source root: `src/app/modules/purchese-management/`
- Module file: `purchese-management.module.ts`

## Feature Areas

| Folder | Description |
|--------|-------------|
| [layout/](layout/LAYOUT_COMPONENT_CONTEXT.md) | Purchase module shell layout and permission-filtered sidebar |
| [purchase-home/](purchase-home/PURCHASE_HOME_DASHBOARD_COMPONENT_CONTEXT.md) | Purchase analytics dashboard |
| [purchase-orders/](purchase-orders/context.md) | PO list + create/view dialog (delegates to store-management PurchaseOrderComponent) |
| [spr-requests/](spr-requests/context.md) | Store Purchase Requisition list — view-only; status filter tabs; opens shared RequisitionFromComponent |
| [quotation-management/](quotation-management/context.md) | RFQ / quotation management — create quotes per SPR+supplier, locks when PO created |
| [comparative-study/](comparative-study/context.md) | Two-panel SPR→Quotes view with inline PO creation from winning quote |
| [reminder/](reminder/context.md) | Reminders list — delegates entirely to store-management's `ReminderComponent` (routed, not re-declared); purchase can only tick "I have read" + fill Purchase Message |

## Component Context Files

| File | Component |
|---|---|
| [layout/LAYOUT_COMPONENT_CONTEXT.md](layout/LAYOUT_COMPONENT_CONTEXT.md) | `LayoutComponent` |
| [purchase-home/PURCHASE_HOME_DASHBOARD_COMPONENT_CONTEXT.md](purchase-home/PURCHASE_HOME_DASHBOARD_COMPONENT_CONTEXT.md) | `PurcheseHomeComponent` dashboard |
| [purchase-orders/PURCHASE_ORDER_LIST_COMPONENT_CONTEXT.md](purchase-orders/PURCHASE_ORDER_LIST_COMPONENT_CONTEXT.md) | `PurcheseOrderListComponent` wrapper/list |
| [spr-requests/SPR_REQUEST_LIST_COMPONENT_CONTEXT.md](spr-requests/SPR_REQUEST_LIST_COMPONENT_CONTEXT.md) | `SprRequestsComponent` list |
| [quotation-management/QUOTATION_LIST_COMPONENT_CONTEXT.md](quotation-management/QUOTATION_LIST_COMPONENT_CONTEXT.md) | `QuotationManagementComponent` list |
| [quotation-management/QUOTATION_FORM_COMPONENT_CONTEXT.md](quotation-management/QUOTATION_FORM_COMPONENT_CONTEXT.md) | RFQ / Quotation embedded form dialog |
| [comparative-study/COMPARATIVE_STUDY_LIST_COMPONENT_CONTEXT.md](comparative-study/COMPARATIVE_STUDY_LIST_COMPONENT_CONTEXT.md) | `ComparativeStudyComponent` two-panel list |
| [comparative-study/COMPARATIVE_QUOTE_FORM_COMPONENT_CONTEXT.md](comparative-study/COMPARATIVE_QUOTE_FORM_COMPONENT_CONTEXT.md) | Comparative quote embedded form dialog |
| [reminder/context.md](reminder/context.md) | `ReminderComponent` (delegated from store-management, not a purchase-owned component) |

## Route Base
`/purchase` — guard: `PURCHESE_ADMIN`

| Path | Component | Permission |
|------|-----------|------------|
| `purchase-analytics` | `PurcheseHomeComponent` | `PURCHESE_ANALYTICS` |
| `purchase-orders` | `PurcheseOrderListComponent` | `PURCHESE_ADMIN` |
| `spr-requests` | `SprRequestsComponent` | `PURCHESE_SPR_REQUESTS` |
| `rf-quotations` | `QuotationManagementComponent` | `PURCHESE_SR_REQUEST` |
| `comparative-study` | `ComparativeStudyComponent` | `PURCHESE_SR_REQUEST` |
| `supplier-list` | `SupplierListComponent` (from base-data) | `PURCHESE_ADMIN` |
| `reminders` | `ReminderComponent` (from store-management, `data: { context: 'purchase' }`) | `STORE_REMINDERS` |

## Key Design Patterns

### Shared PurchaseOrderComponent
PO list logic lives in `store-management/purchase-order/` and is reused in both modules:
- `store-management` — `[readOnly]="true"` `[usePurchasePermissions]="false"`
- `purchese-management` — `[readOnly]="false"` `[usePurchasePermissions]="true"`

### Shared ReminderComponent (routed, not re-declared)
Unlike `PurchaseOrderComponent` (a standalone-ish component instantiated via template input bindings), `ReminderComponent` is reused purely at the **router level** — `purchese-management-routing.module.ts` points a route straight at the store-management class, distinguishing behavior via `route.data.context` instead of `@Input()`s. See [reminder/context.md](reminder/context.md).

### Technology Stack
- Angular `.ts` — layout, quotation management, comparative study
- TSX `.tsx` — purchase dashboard, purchase order wrapper, SPR requests
- SAP UI5 Web Components (`@ui5/webcomponents-ngx`) — UI elements
- `app-ag-grid-table` — main list tables
- `app-custom-grid-table` — inner dialog item tables (customData mode)
- OData — API pattern via `CommonService`
