# Purchase Management — Module Overview

## Source Root
`src/app/modules/purchese-management/`

Note: source folder and class names use `purchese` spelling; docs folder uses `purchase-management`.

## Files
```
purchese-management/
├── purchese-management.module.ts
├── purchese-management-routing.module.ts
├── layout/
├── purchese-home/
├── purchese-orders/
│   └── purchese-order-list/
├── spr-requests/
├── quotation-management/
├── comparative-study/
└── shared/
    ├── enum/
    ├── model/
    └── services/
```

## Routes

| Path | Component | Permission |
|---|---|---|
| `/purchase-management` | `LayoutComponent` | `PURCHESE_ADMIN` |
| `purchase-analytics` | `PurcheseHomeComponent` | `PURCHESE_ANALYTICS` |
| `purchase-orders` | `PurcheseOrderListComponent` | `PURCHESE_ADMIN` |
| `spr-requests` | `SprRequestsComponent` | `PURCHESE_SPR_REQUESTS` |
| `rf-quotations` | `QuotationManagementComponent` | `PURCHESE_SR_REQUEST` |
| `comparative-study` | `ComparativeStudyComponent` | `PURCHESE_SR_REQUEST` |
| `supplier-list` | `SupplierListComponent` from base-data | `PURCHESE_ADMIN` |

## Module Declarations
`PurcheseManagementModule` declares layout, dashboard, purchase order wrapper, SPR requests, quotation management, and comparative study components.

## Shared Module Usage
- Imports `StoreManagementModule` because purchase order and requisition detail UI are reused from store management.
- Imports `BaseDataManagementModule` for supplier list route usage.
- Uses both `app-ag-grid-table` and legacy/custom `app-custom-grid-table`.

## Future Add Notes
- Add one folder under `Frontend/docs/purchase-management/<feature>/` per source feature.
- Add one `context.md` feature overview plus separate uppercase `*_LIST_COMPONENT_CONTEXT.md` and `*_FORM_COMPONENT_CONTEXT.md` files when a feature has both list and dialog/form behavior.
- Keep the `purchese-management` spelling in source paths so file links match the repo.
