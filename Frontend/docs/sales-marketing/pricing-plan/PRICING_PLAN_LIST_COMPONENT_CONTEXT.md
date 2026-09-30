# PRICING_PLAN_LIST_COMPONENT — Component Context

## Component Identity

| Field | Value |
|---|---|
| Component name | `PricingPlanComponent` |
| Selector | `app-pricing-plan` |
| TypeScript | `src/app/modules/sales-management/pricing-plan/pricing-plan.component.ts` |
| HTML | `src/app/modules/sales-management/pricing-plan/pricing-plan.component.html` |
| SCSS | `src/app/modules/sales-management/pricing-plan/pricing-plan.component.scss` |
| Component type | List / master component |
| Route | `pricing-plan` |
| Permission | `SALES_PRICING_PLAN` |

## Purpose
Lists sellable products in `app-ag-grid-table`. Selecting a product opens/updates the pricing form panel (`PricingFormComponent`) so price plans can be managed for that product.

## Child Components

| Template ref | Component | Purpose |
|---|---|---|
| `#agGridRef` | `AgGridTableComponent` | Sellable item list grid |
| `#itemForm` | `PricingFormComponent` | Product detail + price-plan form |

## Main Data Source

| Property | Value |
|---|---|
| Endpoint | `Products` |
| Expand | `suppliers,productTypes,category,clients,plants,variants,uom` |
| Filter | `is_sellable eq true` |
| Sort | `custom_id desc` |

## Toolbar
- Header: `Sellable Items`
- Search: enabled
- Scanner: enabled
- Row count: enabled
- Download: enabled
- New button: disabled
- Segment buttons: `All`, `Inactive`, `Active`

## Key Columns
- `is_active`
- `category.name`
- `item_code`
- `product_name`
- `model_number`
- `part_number`
- `has_variant`
- `rack_no`
- `current_stock`
- `minimum_stock`
- `unit_price`
- `created_at`

## Related Form Doc
- [pricing_form_component_context.md](pricing_form_component_context.md)

## Future Add Notes
- Keep only product-list/master behavior here.
- Keep price-plan dialog, price validation, and `ItemPricePlannings` behavior in the form doc.
