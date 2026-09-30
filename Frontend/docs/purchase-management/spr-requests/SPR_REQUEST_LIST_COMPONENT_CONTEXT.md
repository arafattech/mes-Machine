# SPR_REQUEST_LIST_COMPONENT — Component Context

## Component Identity

| Field | Value |
|---|---|
| Component name | `SprRequestsComponent` |
| Selector | `app-spr-requests` |
| TypeScript | `src/app/modules/purchese-management/spr-requests/spr-requests.component.tsx` |
| HTML | `src/app/modules/purchese-management/spr-requests/spr-requests.component.html` |
| SCSS | `src/app/modules/purchese-management/spr-requests/spr-requests.component.scss` |
| Component type | List / read-only requisition review |
| Route | `spr-requests` |
| Permission | `PURCHESE_SPR_REQUESTS` |

## Purpose
Lists Store Purchase Requisitions (`SPR`) for purchase review. Users can switch between Submitted, Approved, and Rejected requests and open requisition item details using the store-management requisition form.

## Child Components

| Template ref | Component | Purpose |
|---|---|---|
| `#agGridRef` | `AgGridTableComponent` | SPR list grid |
| `#requisitionFrom` | `RequisitionFromComponent` | Reused requisition detail form |

## Data Source

| Property | Value |
|---|---|
| Endpoint | `PurchaseRequisitions` |
| Expand | `requestBy,department,sprItems($expand=item($expand=category,uom))` |
| Search fields | `custom_id` |
| Initial filter | `status eq 'SUBMITTED' and type eq 'SPR'` |
| Sort | `id desc` |

## Segment Filters
- `submitted` → `SUBMITTED`
- `approved` → `APPROVED`
- `rejected` → `REJECTED`

## Related Form Doc
The detail form comes from store management: `RequisitionFromComponent`.

## Future Add Notes
- Keep this file list-only; requisition form behavior belongs in store-management docs.
