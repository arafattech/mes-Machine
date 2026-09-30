# QUOTATION_FORM_COMPONENT — Component Context

## Component Identity

| Field | Value |
|---|---|
| Owning component | `QuotationManagementComponent` |
| Dialog/form name | RFQ / Quotation dialog |
| TypeScript | `src/app/modules/purchese-management/quotation-management/quotation-management.component.ts` |
| HTML | `src/app/modules/purchese-management/quotation-management/quotation-management.component.html` |
| SCSS | `src/app/modules/purchese-management/quotation-management/quotation-management.component.scss` |
| Component type | Embedded form dialog |

## Purpose
Creates and edits purchase quotes for an approved SPR and supplier. The dialog contains header fields plus an `app-custom-grid-table` for quote item quantities, unit prices, delivery dates, and totals.

## Form State

| Property | Purpose |
|---|---|
| `open` | Dialog open state |
| `loading` | Save/loading state |
| `quote` | Current quote payload and item rows |
| `saveMode` | `POST` for new quote, `PUT` for existing quote |
| `requisitions` | Approved SPR options |
| `suppliers` | Supplier options |
| `isQuoteLocked` | Locks edit when related purchase order exists |

## Form Fields
- RFQ No
- Quote Date
- SPR List
- Supplier
- Valid Until
- PO Status
- Note
- Items grid

## APIs

| Method | Endpoint | Purpose |
|---|---|---|
| GET helper | `getCustomId({ model: 'purchase_quotes', prefix: 'RFQ', field: 'custom_id' })` | Generate RFQ id |
| GET | `PurchaseRequisitions?$filter=status eq 'APPROVED' and type eq 'SPR'...` | Load approved SPR options |
| GET | `Suppliers` | Load suppliers |
| POST | `purchase/quotes` | Create quote |
| PUT | `purchase/quotes/<id>` | Update quote |

## Future Add Notes
- If this dialog becomes a child component, rename this doc to match the new component class and selector.
