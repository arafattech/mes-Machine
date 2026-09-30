# COMPARATIVE_STUDY_LIST_COMPONENT — Component Context

## Component Identity

| Field | Value |
|---|---|
| Component name | `ComparativeStudyComponent` |
| Selector | `app-comparative-study` |
| TypeScript | `src/app/modules/purchese-management/comparative-study/comparative-study.component.ts` |
| HTML | `src/app/modules/purchese-management/comparative-study/comparative-study.component.html` |
| SCSS | `src/app/modules/purchese-management/comparative-study/comparative-study.component.scss` |
| Component type | Two-panel list/comparison component |
| Route | `comparative-study` |
| Permission | `PURCHESE_SR_REQUEST` |

## Purpose
Shows approved SPRs on the left and supplier quotes for the selected SPR on the right. Users can view/edit quote details, delete quotes, and create a purchase order from a selected quote.

## Grids

| Ref | Endpoint | Purpose |
|---|---|---|
| `#requisitionAgGridRef` | `PurchaseRequisitions` | Approved SPR list |
| `#quoteAgGridRef` | `PurchaseQuotes` | Quotes filtered by selected SPR |

## Requisition Data Source
- Expand: `department,purchaseQuotes($expand=supplier)`
- Filter: `status eq 'APPROVED' and type eq 'SPR'`
- Search fields: `custom_id`, `department.name`

## Quote Data Source
- Expand: `supplier,quoteItems($expand=item),purchaseOrders`
- Initial filter: `purchase_requisition_id eq 0`
- Updated filter after row select: `purchase_requisition_id eq <selected SPR id>`

## Quote Actions
- `view`
- `edit`
- `delete`
- `create-po`

## Related Form Doc
- [COMPARATIVE_QUOTE_FORM_COMPONENT_CONTEXT.md](COMPARATIVE_QUOTE_FORM_COMPONENT_CONTEXT.md)
