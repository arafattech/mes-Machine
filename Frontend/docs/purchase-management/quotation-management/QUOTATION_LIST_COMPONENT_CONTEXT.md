# QUOTATION_LIST_COMPONENT — Component Context

## Component Identity

| Field | Value |
|---|---|
| Component name | `QuotationManagementComponent` |
| Selector | `app-quotation-management` |
| TypeScript | `src/app/modules/purchese-management/quotation-management/quotation-management.component.ts` |
| HTML | `src/app/modules/purchese-management/quotation-management/quotation-management.component.html` |
| SCSS | `src/app/modules/purchese-management/quotation-management/quotation-management.component.scss` |
| Component type | List component with embedded quotation dialog |
| Route | `rf-quotations` |
| Permission | `PURCHESE_SR_REQUEST` |

## Purpose
Lists RFQ / purchase quotation records and opens an embedded dialog for new/view/edit quotation details.

## Data Source

| Property | Value |
|---|---|
| Endpoint | `PurchaseQuotes` |
| Expand | `supplier,requisition,quoteItems($expand=item($expand=uom)),purchaseOrders` |
| Search fields | `custom_id` |
| Sort | `id desc` |

## Toolbar
- Header: `RFQ / Quotation Management`
- Search: enabled
- Row count: enabled
- New button: enabled
- Download: disabled

## Row Actions
- `view` opens the quotation dialog in detail mode.

## Related Form Doc
- [QUOTATION_FORM_COMPONENT_CONTEXT.md](QUOTATION_FORM_COMPONENT_CONTEXT.md)
