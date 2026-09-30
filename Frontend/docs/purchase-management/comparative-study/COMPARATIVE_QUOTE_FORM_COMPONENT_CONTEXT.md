# COMPARATIVE_QUOTE_FORM_COMPONENT — Component Context

## Component Identity

| Field | Value |
|---|---|
| Owning component | `ComparativeStudyComponent` |
| Dialog/form name | Comparative quote details dialog |
| TypeScript | `src/app/modules/purchese-management/comparative-study/comparative-study.component.ts` |
| HTML | `src/app/modules/purchese-management/comparative-study/comparative-study.component.html` |
| SCSS | `src/app/modules/purchese-management/comparative-study/comparative-study.component.scss` |
| Component type | Embedded quote detail/edit dialog |

## Purpose
Displays quote details for a selected supplier quote in the comparative study workflow. Supports editing quote note/details and creating purchase orders from quotes that do not already have an active PO.

## Dialog State

| Property | Purpose |
|---|---|
| `quoteDetailsOpen` | Quote detail dialog open state |
| `quoteDetailsEditing` | Enables edit mode |
| `quoteSaving` | Save busy state |
| `selectedQuote` | Current quote row |
| `quoteDraft` | Editable copy of selected quote |
| `quoteItemRows` | Read-only item rows displayed in custom grid |
| `createPoConfirmOpen` | Confirmation dialog before PO creation |

## APIs

| Method | Endpoint | Purpose |
|---|---|---|
| PUT | `purchase/quotes/<id>` | Save quote details |
| DELETE | `purchase/quotes/<id>` | Delete quote |
| GET helper | `getCustomId({ model: 'purchase_orders', prefix: 'PO', field: 'custom_id' })` | Generate PO id |
| POST | `purchase/requisitions/<id>/create-order-from-quote` | Create PO from selected quote |

## Future Add Notes
- If the quote dialog is extracted into its own Angular component, add selector and update this doc name.
