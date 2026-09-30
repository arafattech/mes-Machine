# PRICING_FORM_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| TS file | `src/app/modules/sales-management/pricing-plan/pricing-form/pricing-form.component.ts` |
| HTML file | `src/app/modules/sales-management/pricing-plan/pricing-form/pricing-form.component.html` |
| SCSS file | `src/app/modules/sales-management/pricing-plan/pricing-form/pricing-form.component.scss` |
| Selector | `app-pricing-form` |
| Component type | Child product detail view + pricing-plan grid |

## Purpose
Shows selected sellable product details in read-only Core Data fields and manages pricing plans in the Pricing Plan tab. The parent `PricingPlanComponent` selects a product and passes it through `[product]`; this component then filters `ItemPricePlannings` by `product_id`.

## Inputs

| Input | Type | Default | Purpose |
|---|---|---|---|
| `saveMode` | `string` | `POST` | Used by product/plan edit flows |
| `isVariantList` | `boolean` | `false` | Variant-related UI flag |
| `isclone` | `boolean` | `false` | Clone flow flag |
| `product` | `Product` | `new Product()` | Selected product from parent |

## Outputs

| Output | Type | Purpose |
|---|---|---|
| `closeFrom` | `EventEmitter<void>` | Notify parent to close/collapse form |
| `RefreshTable` | `EventEmitter<any>` | Notify parent to refresh product grid |
| `refreshTrigger` | `EventEmitter<any>` | Internal/shared refresh signal |
| `IsDelete` | `EventEmitter<any>` | Sends delete target to `app-delete-entity` |

## ViewChild

| Ref | Type | Purpose |
|---|---|---|
| `productFormRef` | `ProductFormComponent` | Product form reference |
| `pricePlanAgGridRef` | `AgGridTableComponent` | Refreshes pricing-plan grid |
| `calendar` | `CalendarComponent` | Calendar reference for plan date UI |
| `calendarLegand` | `CalendarLegendComponent` | Calendar legend reference |

## Pricing Plan Grid

Initial datasource:
```typescript
{
  type: "odata",
  endpoint: "ItemPricePlannings",
  filter: "product_id eq 0",
  sortDirection: "desc"
}
```

When `product.id` changes, `ngOnChanges()` rebuilds the datasource with:
```typescript
filter: `product_id eq ${product.id}`
```

## Columns

| Column | Field | Notes |
|---|---|---|
| Active | `is_active` | Boolean renderer, no filter/sort |
| Plan Name | `plan_name` | Flexible width |
| Start Date | `start_date` | Date string from API |
| End Date | `end_date` | Date string from API |
| Unit Price | `price` | Plan price |

## Key API Calls

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `$batch` | Loads categories, variants, product types, and UOMs |
| GET | `ItemPricePlannings` | Pricing plan grid datasource |
| POST/PUT | Pricing plan endpoint in component methods | Create/update selected product price plan |
| DELETE | `ItemPricePlannings/<id>` via `app-delete-entity` | Delete pricing plan |

## Template Structure
```
<ui5-card>
  <ui5-tabcontainer>
    <ui5-tab id="coreData">read-only product detail fields</ui5-tab>
    <ui5-tab id="pricing plan">
      <app-ag-grid-table #pricePlanAgGridRef ...>
    </ui5-tab>
  </ui5-tabcontainer>
</ui5-card>

<app-delete-entity [IsDelete]="IsDelete">
<ui5-dialog [open]="openPlan">price-plan create/edit form</ui5-dialog>
```

## Future Add Notes
- If pricing plan validation changes, update `pricingPlanValueState` and method notes here.
- If product Core Data becomes editable, document which fields become writable; current template has most product fields read-only.
