# Sales Management — Pricing Plan

## Files
- `pricing-plan/pricing-plan.component.ts` — master list component (AG Grid)
- `pricing-plan/pricing-plan.component.html`
- `pricing-plan/pricing-form/pricing-form.component.ts` — product detail + price plan form (AG Grid)
- `pricing-plan/pricing-form/pricing-form.component.html`

## Selectors
- `app-pricing-plan`
- `app-pricing-form` (referenced via `#itemForm`)

## Route
`pricing-plan` — guarded by `SALES_PRICING_PLAN`

## Purpose
Master-detail product catalog with price plan management. Left panel: all sellable products in AG Grid. Selecting a row loads the product detail form (`PricingFormComponent`) in the right panel. The form has tabs including a Pricing Plan tab with a second AG Grid showing `ItemPricePlannings` for the selected product. Supports new, edit, clone, delete, and Excel export.

## Layout Modes
- Split grid: `isListCollapsed` / `isTabCollapsed` collapse arrows toggle each panel
- Both panels visible by default on row select

---

## PricingPlanComponent (`pricing-plan.component.ts`)

### Grid: Sellable Items (Products)

#### Data Source
```typescript
dataSource: AgGridTableODataSourceConfig<Product> = {
  type: 'odata',
  endpoint: 'Products',
  expand: 'suppliers,productTypes,category,clients,plants,variants,uom',
  filter: 'is_sellable eq true',
  sortBy: 'custom_id',
  sortDirection: 'desc',
};
```

#### Toolbar Config
```typescript
toolbarConfig: AgGridTableToolbarConfig = {
  headerTitle: 'Sellable Items',
  showSearch: true,
  showScanner: true,
  showRowCount: true,
  showDownload: true,
  showNewButton: false,
  showSegmentButton: true,
  button1Text: 'All',
  button2Text: 'Inactive',
  button3Text: 'Active',
};
```
Segment buttons drive `is_active` filter via AG Grid's built-in `[isBase]="true"` behavior.

#### Display Config
```typescript
displayConfig: AgGridTableDisplayConfig = {
  gridHeight: 'calc(100vh - 110px)',
};
```

#### Template
```html
<app-ag-grid-table
  #agGridRef
  [columns]="columns"
  [dataSource]="dataSource"
  [toolbarConfig]="toolbarConfig"
  [displayConfig]="displayConfig"
  selectionMode="Single"
  [isBase]="true"
  [showAction]="false"
  [showIllustratedMessage]="true"
  IllustratedName="NoData"
  (newButtonClick)="newItem()"
  (downloadButtonClick)="downloadData($event)"
  (rowClick)="handleRowSelect($event)"
></app-ag-grid-table>
```

#### Columns (`buildColumns()`)

| Column | Field | Notes |
|--------|-------|-------|
| Active | `is_active` | `AgGridBooleanCellRendererComponent`, filter/sort off |
| Category | `category.name` | `valueGetter`, `filterControl: multiSelect` from `categoryOptions` |
| Item Code | `item_code` | — |
| Item Name | `product_name` | `flex: 1` |
| Model | `model_number` | — |
| Part Number | `part_number` | `isSelected: false` (hidden by default) |
| Has Variant | `has_variant` | Conditional on `BASE_DATA_ITEM_VARIANTS_LIST`; `AgGridBooleanCellRendererComponent` |
| Rack Number | `rack_no` | — |
| Current Stock | `current_stock` | — |
| Minimum Stock | `minimum_stock` | — |
| Unit Price | `unit_price` | — |
| Created On | `created_at` | `dataType: UI5DateRangePicker`; formatted via `DateFormatterService` |

#### Category Filter
`getCategory()` fetches `ItemCategories?$filter=is_active eq true&$select=id,name` (OData), maps to `AgGridTableFilterOptionInput[]`, stores in private `categoryOptions`, then rebuilds columns. Called in constructor.

#### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `agGridRef` | `AgGridTableComponent?` | ViewChild `#agGridRef` — used for `refreshGridData(true)` |
| `columns` | `AgGridTableColumn<any>[]` | Built by `buildColumns()` after categories load |
| `dataSource` | `AgGridTableODataSourceConfig<Product>` | OData source for Products |
| `toolbarConfig` | `AgGridTableToolbarConfig` | Toolbar incl. segment All/Inactive/Active |
| `displayConfig` | `AgGridTableDisplayConfig` | Grid height |
| `categoryOptions` | `AgGridTableFilterOptionInput[]` (private) | Populated from OData, used in category multiSelect filter |
| `SelectedProduct` | `Product` | Currently selected product row |
| `isListCollapsed` | `boolean` | Collapses list panel |
| `isTabCollapsed` | `boolean` | Collapses form panel |
| `saveMode` | `string` | `POST` or `PUT` for form |

#### Key Methods

| Method | Description |
|--------|-------------|
| `buildColumns()` | Returns `AgGridTableColumn<any>[]`; uses `categoryOptions` for multiSelect filter |
| `getCategory()` | OData GET active categories → `categoryOptions` → rebuilds columns |
| `handleRowSelect(data)` | AG Grid `rowClick` emits row data directly; populates `itemFormRef`; calls `editItem()`; after 200ms calls `itemFormRef.refreshPricePlanTable()` |
| `processData(event)` | Called by form on save/refresh; emits `refreshTable`; calls `agGridRef?.refreshGridData(true)` |
| `newItem()` | Resets form for POST |
| `editItem(data)` | Opens form in PUT mode |
| `cloneItem(data)` | Clone product; triggers item code auto-generation |
| `deleteClick(id)` | Emits `IsDelete` with `Products/<id>` |
| `downloadData(event)` | POSTs `item/export` (REST Blob) → Excel download |

#### API Calls

| Method | Endpoint | OData | Purpose |
|--------|----------|-------|---------|
| GET | `ItemCategories?$filter=is_active eq true&$select=id,name` | `true` | Category multiSelect filter options |
| POST | `item/export` | `false` (Blob) | Export products to Excel |

#### Row Select Flow
```
AG Grid rowClick → handleRowSelect(data)
  → SelectedProduct.deserialize(data)
  → itemFormRef.product = structuredClone(SelectedProduct)
  → itemFormRef.saveMode = PUT
  → itemFormRef.resetValuState()
  → itemFormRef.selectedProductType / selectedCategory / selectedSubCategory
  → editItem(SelectedProduct)
  → setTimeout 200ms → itemFormRef.refreshPricePlanTable()
```

---

## PricingFormComponent (`pricing-form/pricing-form.component.ts`)

### Grid: Pricing Plans (ItemPricePlannings)

Located in the **Pricing Plan** tab of the product form.

#### Data Source
Initial state (no product selected):
```typescript
planDataSource: AgGridTableODataSourceConfig<PricePlan> = {
  type: 'odata',
  endpoint: 'ItemPricePlannings',
  filter: 'product_id eq 0',
  sortDirection: 'desc',
};
```
Rebuilt on product selection via `ngOnChanges`:
```typescript
ngOnChanges(changes: SimpleChanges): void {
  if (changes['product']?.currentValue?.id) {
    this.planDataSource = {
      type: 'odata',
      endpoint: 'ItemPricePlannings',
      filter: `product_id eq ${changes['product'].currentValue.id}`,
      sortDirection: 'desc',
    };
  }
}
```
Product `@Input()` changes trigger `ngOnChanges` when the parent's `[product]="product"` binding updates (via `editItem()` in pricing-plan setting `this.product = data`). This causes the AG Grid to reload with the correct product's plans.

#### Toolbar Config
```typescript
planToolbarConfig = {
  headerTitle: 'Pricing Plans',
  showSearch: true,
  showRowCount: true,
  showNewButton: rolePermissionService.hasPermission(SALES_PRICING_PLAN_CREATE),
  addButtonText: 'New',
  showDownload: false,
  showTableSettingBtn: false,
};
```

#### Display Config
```typescript
planDisplayConfig: AgGridTableDisplayConfig = {
  gridHeight: 'calc(100vh - 300px)',
};
```

#### Template
```html
<app-ag-grid-table
  #pricePlanAgGridRef
  [columns]="planColumns"
  [dataSource]="planDataSource"
  [toolbarConfig]="planToolbarConfig"
  [displayConfig]="planDisplayConfig"
  selectionMode="Single"
  [isBase]="false"
  [isTableCacheEnabled]="false"
  [showAction]="true"
  [showEditButton]="rolePermissionService.hasPermission(permissions.SALES_PRICING_PLAN_EDIT)"
  [showDeleteButton]="rolePermissionService.hasPermission(permissions.SALES_PRICING_PLAN_DELETE)"
  [showIllustratedMessage]="true"
  IllustratedName="NoEntries"
  (newButtonClick)="newPlan()"
  (editClick)="editPlan($event)"
  (deleteClick)="deletePlan($event)"
  (processData)="processData($event)"
></app-ag-grid-table>
```

#### Columns (`buildPlanColumns()`)

| Column | Field | Notes |
|--------|-------|-------|
| Active | `is_active` | `AgGridBooleanCellRendererComponent`, filter/sort off |
| Plan Name | `plan_name` | `flex: 1` |
| Start Date | `start_date` | — |
| End Date | `end_date` | — |
| Unit Price | `price` | — |

#### Key Properties (AG Grid)

| Property | Type | Purpose |
|----------|------|---------|
| `pricePlanAgGridRef` | `AgGridTableComponent?` | ViewChild `#pricePlanAgGridRef` |
| `planColumns` | `AgGridTableColumn<PricePlan>[]` | Built in constructor via `buildPlanColumns()` |
| `planDataSource` | `AgGridTableODataSourceConfig<PricePlan>` | OData source, filter updated on product change |
| `planToolbarConfig` | `AgGridTableToolbarConfig` | Initialized in constructor; `showNewButton` from permission |
| `planDisplayConfig` | `AgGridTableDisplayConfig` | Grid height |

#### Key Methods (pricing plan grid)

| Method | Description |
|--------|-------------|
| `buildPlanColumns()` | Returns `AgGridTableColumn<PricePlan>[]` for plan grid |
| `refreshPricePlanTable()` | Calls `pricePlanAgGridRef?.refreshGridData(true)` — called from parent after row select |
| `newPlan()` | Opens plan dialog in POST mode |
| `editPlan(data)` | AG Grid `editClick` emits row data; opens plan dialog in PUT mode with pre-filled data |
| `deletePlan(event)` | `event.id` from AG Grid row; emits `IsDelete` with `ItemPricePlannings/<id>` |
| `processData(event)` | No-op callback from AG Grid `(processData)` |

#### Plan CRUD Flow
```
newPlan()  → openPlan = true, saveMode = POST
editPlan(rowData) → openPlan = true, saveMode = PUT, pricePlan = clone of row
deletePlan(rowData) → IsDelete.emit('ItemPricePlannings/<id>')
  → app-delete-entity handles confirmation dialog
  → (isSuccess) → refreshPricePlanTable()
savePlan() → CommonService POST/PUT to ItemPricePlannings
  → refreshPricePlanTable()
```

#### Refresh Pattern
Parent (`pricing-plan`) triggers `itemFormRef.refreshPricePlanTable()` after selecting a product row (inside `setTimeout 200ms`). This lets Angular propagate the `@Input() product` change and fire `ngOnChanges` (which updates `planDataSource`) before the grid refreshes.

---

## Permissions Used

| Permission | Effect |
|------------|--------|
| `SALES_PRICING_PLAN` | Route guard |
| `SALES_PRICING_PLAN_CREATE` | Show New button in plan grid toolbar |
| `SALES_PRICING_PLAN_EDIT` | Show Edit action in plan grid |
| `SALES_PRICING_PLAN_DELETE` | Show Delete action in plan grid |
| `BASE_DATA_ITEM_VARIANTS_LIST` | Show Has Variant column in product grid |

## Services

| Service | Usage |
|---------|-------|
| `CommonService` | Category OData GET; item export POST; `odata`/`api` flags |
| `RolePermissionService` | Permission checks for columns and toolbar |
| `ToastService` | Export success/error toast |
| `DateFormatterService` | `created_at` column `valueFormatter` |
| `MediaService` | Used inside `PricingFormComponent` for image/media upload |

## Module
Declared in `SalesManagementModule` (`sales.module.ts`). `AgGridTableComponent` available via `SharedModule`.

## Related
- `sales.route.ts` — route config
- `shared/model/price-plan.ts` — `PricePlan` model used in plan grid typing
- `@shared/components/ag-grid-table/` — AG Grid wrapper
- `app-delete-entity` — handles delete confirmation dialog for both Products and ItemPricePlannings
