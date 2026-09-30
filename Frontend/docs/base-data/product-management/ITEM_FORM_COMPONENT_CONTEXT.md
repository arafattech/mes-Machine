# ITEM_FORM_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| TSX file | `Frontend/src/app/modules/base-data-management/product-management/item-form/item-form.component.tsx` |
| HTML file | `Frontend/src/app/modules/base-data-management/product-management/item-form/item-form.component.html` |
| SCSS file | `Frontend/src/app/modules/base-data-management/product-management/item-form/item-form.component.scss` |
| Selector | `app-item-form` |
| Component type | Form (Create / Edit / Clone) |

**Purpose:** `ItemFormComponent` is the primary data-entry form for creating, editing, and cloning Products (Items) within the Base Data Management module. It presents a tabbed UI containing: Core Data fields (code, name, category, UOM, pricing, stock, toggles), an optional Variant tab, Supplier / Client / Plant association tabs, and a Compliance & Certificates attachment tab. On submission it performs the necessary OData REST calls to persist the product, associate related entities (plants, suppliers, clients, product type, sub-categories), and optionally insert child variant records.

---

## Inputs (@Input)

| Input name | Type | Default | Purpose |
|---|---|---|---|
| `saveMode` | `string` | `saveMode.POST` | Controls whether the form is in Add (`POST`), Edit (`PUT`), or Clone mode. Drives conditional rendering and which HTTP method is used on save. |
| `isVariantList` | `boolean` | `false` | Indicates whether the component is being used inside a variant list context. |
| `isclone` | `boolean` | `false` | When `true`, the form is in clone mode — a confirmation dialog is shown before submission and the generated code is applied to the cloned record rather than the original `item_code`. |
| `product` | `Product` | `new Product()` | The product model bound to the form. In edit mode, the parent passes the selected product here; in add mode, an empty `Product` is used. |

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `closeFrom` | `EventEmitter<void>` | Emitted when the form is cancelled or after a successful save, signalling the parent to close/hide the form panel. |
| `getAttachmentsTriggered` | `EventEmitter<void>` | Reserved for triggering attachment reload in the parent. Declared but not explicitly emitted within visible code. |
| `RefreshTable` | `EventEmitter<any>` | Emitted after a successful save (or variant insert) to tell the parent list component to reload its data. |
| `refreshTrigger` | `EventEmitter<any>` | Emitted after a category is selected (`onCategorySelection`). Used by the parent to react to category changes. |
| `IsDelete` | `EventEmitter<any>` | Emitted with the URL string `Products/<variantId>` when a variant is removed in PUT mode and the variant has a server-side `id`. Consumed by the embedded `app-delete-entity` component to execute the delete. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `productType` | `ProductType` | `new ProductType().deserialize({})` | Holds the new product type being created inline via `ProductFormComponent`. |
| `itemCategory` | `ItemCategory` | `new ItemCategory().deserialize({})` | Holds the new item category being created inline via `CategoryFormComponent`. |
| `uom` | `Uom` | `new Uom()` | Holds the new UOM being created inline via `UomFormComponent`. |
| `variant` | `Variant` | `new Variant().deserialize({})` | Working model for the variant currently being composed in the variant dialog. |
| `selectedVariantType` | `string` | `""` | Display value bound to the Variant Type combobox inside the variant dialog. |
| `loading` | `boolean` | `false` | Controls the `ui5-busy-indicator` overlay on the form during async operations. |
| `odata` | `boolean` | `commonService.odata` | Flag passed to service calls that route through the OData endpoint. |
| `api` | `boolean` | `commonService.api` | Flag passed to service calls that route through the plain API endpoint. |
| `Permission` | `string \| undefined` | `""` | Reserved permission string (not actively used beyond declaration). |
| `plantList` | `typeof Plant` | `Plant` (class ref) | Reference to the `Plant` model class, passed to `app-assosiate` as `[model]`. |
| `clientList` | `typeof Client` | `Client` (class ref) | Reference to the `Client` model class for the client table. |
| `SupplierList` | `typeof Supplier` | `Supplier` (class ref) | Reference to the `Supplier` model class, passed to `app-assosiate` as `[model]`. |
| `productTypeList` | `typeof ProductType` | `ProductType` (class ref) | Reference to `ProductType` class (declared but `productTypeLists` array is the active list). |
| `itemCategoryList` | `typeof ItemCategory` | `ItemCategory` (class ref) | Reference to `ItemCategory` class. |
| `ItemVariant` | `typeof Variant` | `Variant` (class ref) | Reference to the `Variant` model class, passed to variant analytical tables. |
| `Plants` | `Plant[]` | `[]` | Live array of plants; drives `plantDataSource.data` via object spread on change. |
| `Clients` | `Client[]` | `[]` | Live array of clients associated with the product; bound to the client analytical table. |
| `Suppliers` | `Supplier[]` | `[]` | Live array of suppliers; drives `supplierDataSource.data` via object spread on change. |
| `supplierDataSource` | `AgGridTableODataSourceConfig` | `{ type:"odata", staticData:true, data:[] }` | Static AG Grid data source for the Supplier tab; spread-updated when suppliers change. |
| `supplierToolbarConfig` | `AgGridTableToolbarConfig` | — | Toolbar config for supplier AG Grid — title "Supplier List", Associate button, no search/count/download. |
| `supplierDisplayConfig` | `AgGridTableDisplayConfig` | `{ gridHeight:"calc(100vh - 347px)", fillEmptyRows:true }` | Height = wrapper `(100vh-290px)` minus AG Grid toolbar ~57px. |
| `supplierColumns` | `AgGridTableColumn<any>[]` | — | Columns: Active (bool renderer), ID, Name, Created At. |
| `plantDataSource` | `AgGridTableODataSourceConfig` | `{ type:"odata", staticData:true, data:[] }` | Static AG Grid data source for the Plant tab; spread-updated when plants change. |
| `plantToolbarConfig` | `AgGridTableToolbarConfig` | — | Toolbar config for plant AG Grid — title "Plant List", Associate button, no search/count/download. |
| `plantDisplayConfig` | `AgGridTableDisplayConfig` | `{ gridHeight:"calc(100vh - 347px)", fillEmptyRows:true }` | Height = wrapper `(100vh-290px)` minus AG Grid toolbar ~57px. |
| `plantColumns` | `AgGridTableColumn<any>[]` | — | Columns: Active (bool renderer), ID, Name, Created At. |
| `ProductTypes` | `ProductType[]` | `[]` | Declared but superseded by `productTypeLists` for actual data. |
| `ItemCategories` | `ItemCategory[]` | `[]` | All active item categories loaded via batch request; populates the Category combobox. |
| `resId` | `string` | `""` | Declared but not actively used in visible code. |
| `isAddError` | `boolean` | `false` | Declared flag for add-error state; not actively mutated in visible code. |
| `ItemSubCategories` | `ItemSubCategory[]` | `[]` | Subcategories filtered by the selected category; populates the Subcategory multi-combobox. |
| `categoryValidationMessages` | `string[]` | `[]` | Reserved for category-level validation messages. |
| `selectedCategoryId` | `number \| null` | `null` | Stores the numeric ID of the currently selected category (also used in `autoCategoryAdded`). |
| `isErrorMessage` | `string` | `""` | Inline error message string, set when `productAssociate` is called without a valid product ID. |
| `IsSupplier` | `boolean` | `false` | Declared flag; not mutated in visible code. |
| `variantLists` | `Variant[]` | `[]` | All active variants loaded for the Variant Type combobox inside the variant dialog. |
| `Variants` | `Variant[]` | `[]` | Working array of variants added to the product during the current session. |
| `variantIds` | `string[]` | `[]` | Array of string IDs extracted from `product.variants`; computed by `variantIdinArray()`. |
| `Variant` | `Variant` | `new Variant().deserialize({})` | Secondary variant instance reference (note the capital `V`; distinct from `variant`). |
| `IsAssosiate` | `boolean` | `false` | Declared flag; not mutated in visible code. |
| `open` | `boolean` | `false` | Controls an unspecified dialog open state; set to `false` on error in `submitRequest`. |
| `openCheckClone` | `boolean` | `false` | Controls the clone-confirmation dialog visibility. |
| `checkCloneValidate` | `boolean` | `false` | Declared; not mutated in visible code. |
| `selectedTab` | `string` | `"coreData"` | Tracks the currently active tab ID; used to restore the Core Data tab when validation fails. |
| `isAddDialogOpen` | `boolean` | `false` | Declared; not mutated in visible code. |
| `showUomSection` | `boolean` | `false` | Declared; not mutated in visible code (UOM section always visible). |
| `showVariantSection` | `boolean` | `false` | Set to `true` by `onVariantSelectFocus()`; declared for conditional variant section rendering. |
| `Uomlists` | `Uom[]` | `[]` | All active UOMs loaded via batch request; populates the UOM combobox. |
| `openVariant` | `boolean` | `false` | Declared; not mutated in visible code. |
| `isAddProductTypeDialogOpen` | `boolean` | `false` | Declared; not mutated in visible code. |
| `productTypeLists` | `ProductType[]` | `[]` | All active product types loaded via batch/individual API; populates the Item Type combobox. |
| `buttonText` | `string` | `"Add More"` | Declared; not used in template. |
| `buttonIcon` | `string` | `"add"` | Declared; not used in template. |
| `catagoryPrefix` | `string` | `""` | Stores the prefix of the selected category; used when generating the item code. |
| `catagoryTitle` | `string` | `""` | Display name of the selected category; bound to the Category combobox `[value]`. |
| `selectedCategory` | `ItemCategory` | `new ItemCategory()` | The full `ItemCategory` object for the currently selected category. |
| `selectedSubCategory` | `ItemSubCategory[]` | `[]` | Array of selected sub-categories; populated by the multi-combobox selection event. |
| `selectedProductType` | `ProductType \| null` | `null` | The currently selected product type object. |
| `selectedSubCategoryIds` | `string[]` | `[]` | String IDs of selected sub-categories; used to pre-select items in the multi-combobox. |
| `isVariantEdit` | `boolean` | `false` | When `true`, the variant dialog is in edit mode rather than add mode. |
| `selectedVariantId` | `string` | `""` | ID of the variant being edited in the variant dialog. |
| `isVariantTabOpen` | `boolean` | `false` | Set in constructor; tracks whether the variant tab is open (declared for possible future guard logic). |
| `showAddMore` | `boolean` | `false` | Declared; not mutated in visible code. |
| `className` | `string` | `"hidden"` | Declared CSS class string; not used in template. |
| `selectedProductTypeId` | `string \| null` | `null` | Declared; not mutated in visible code. |
| `newlyAddedUom` | `Uom \| null` | `null` | Temporarily stores a newly created UOM so it can be prepended to `Uomlists` after the next list reload. |
| `newlyAddedProductType` | `ProductType \| null` | `null` | Declared; not actively used. |
| `isNewProductTypeAdded` | `boolean` | `false` | Declared; not mutated in visible code. |
| `openVariantEdit` | `boolean` | `false` | Controls the visibility of the variant add/edit `ui5-dialog`. |
| `ToastType` | `"add" \| "edit" \| "error"` | `"add"` | Determines which toast message is shown after a save operation. |
| `selectedItemTypeName` | `string` | `""` | Display name for the selected product type; bound to the Item Type combobox `[value]`. |
| `selectedItemUomName` | `string` | `""` | Display name for the selected UOM; bound to the UOM combobox `[value]`. |
| `supplierTableTitle` | `string` | `"Supplier List"` (i18n) | Header title for the supplier analytical table. |
| `clientTableTitle` | `string` | `"Client List"` (i18n) | Header title for the client analytical table. |
| `plantTableTitle` | `string` | `"Plant List"` (i18n) | Header title for the plant analytical table. |
| `variantTableTitle` | `string` | `"Variant List"` (i18n) | Header title for the variant analytical table. |
| `validationMessage` | `string` | `Localization.requiredField` | Standard required-field message displayed inside `valueStateMessage` slots. |
| `valueState` | `typeof ValueState` | `ValueState` (ref) | Reference to the UI5 `ValueState` enum; used in template bindings. |
| `responseType` | `saveMode` | `saveMode.POST` | Declared; not mutated in visible code. |
| `localization` | `typeof Localization` | `Localization` (ref) | Reference to the `Localization` utility object; used extensively in templates for label strings. |
| `currency` | `typeof currency` | `currency` (enum ref) | Reference to the `currency` enum; used in template `[text]` bindings and conditional logic. |
| `generateCode` | `string` | `""` | Stores the auto-generated item code when in clone mode; used instead of `product.item_code` for cloned records. |
| `valueStateOptions` | `object` | All `ValueState.None` | Object holding individual field value states (`name`, `code`, `catagory`, `unit_price`, `uom`, `itemType`) for UI5 validation feedback. |

---

## ViewChild / ViewChildren

| Ref name | Type | Purpose |
|---|---|---|
| `productFormRef` (`#productForm`) | `ProductFormComponent` | Opens the inline product-type creation sub-form via `productFormRef.open = true`. |
| `uomFormRef` (`#uomForm`) | `UomFormComponent` | Opens the inline UOM creation sub-form via `uomFormRef.open = true`. |
| `subCatFormRef` (`#subCatForm`) | `SubCategoryFormComponent` | Opens the inline sub-category creation sub-form; also calls `subCatFormRef.getItemCategory()` to pre-load categories. |
| `categoryFormRef` (`#categoryForm`) | `CategoryFormComponent` | Opens the inline item-category creation sub-form via `categoryFormRef.open = true`. |
| `variantFormRef` (`#variantForm`) | `VariantFormComponent` | Opens the inline variant-type creation sub-form via `variantFormRef.open = true`. |
| `variantTable` (`#variantTable`) | `AnalyticalTableComponent` | The static variant table shown in POST mode; receives data via `staticData.emit()` and is re-rendered via `render()`. |
| `variantEditTableRef` (`#variantEditTable`) | `AnalyticalTableComponent` | The server-driven variant table shown in PUT mode; refreshed via `refreshTrigger.emit()` after variant save/update. |
| `clientTable` (`#clientTable`) | `AnalyticalTableComponent` | The client table (legacy `react-analytical-table`); data updated via `staticData.emit()` and `render()`. Supplier and Plant tabs are now `app-ag-grid-table` — no ViewChild needed. |
| `suppliersAssosiate` (`#suppliersAssosiate`) | `AssosiateComponent` | The supplier association modal; opened by setting `open = true` and passing current `Suppliers` as `bindingData`. |
| `clientAssosiate` (`#clientAssosiate`) | `AssosiateComponent` | The client association modal; opened by setting `open = true` and passing current `Clients` as `bindingData`. |
| `plantAssosiate` (`#plantAssosiate`) | `AssosiateComponent` | The plant association modal; opened by setting `open = true` and passing current `Plants` as `bindingData`. |
| `itemAttachmentsTab` (`#itemAttachmentsTab`) | `AttachmentUploadComponent` | The attachment uploader; `loadInputImages()` is called when the "attachments" tab is selected in PUT mode. |

---

## Lifecycle Hooks

### `ngOnInit()`
- Calls `getBatchData()` to load all reference data (item categories, variants, product types, UOMs) in a single OData `$batch` POST request.

No `ngOnDestroy`, `ngAfterViewInit`, or other lifecycle hooks are implemented.

---

## Methods — DETAILED

### `hasPermission(permission: string): boolean`
- Delegates directly to `rolePermissionService.hasPermission(permission)`.
- Returns `true` if the current user has the named permission, `false` otherwise.
- Used in the template to conditionally render the "Has Variant" switch, Subcategory field, and Item Type field.

---

### `resetValuState(): void`
- Resets all six keys of `valueStateOptions` to `ValueState.None`.
- Called by `onCancel()` to clear validation highlights when the form is dismissed.

---

### `getCategory(): void`
- Sends a GET request to `ItemCategories?$orderby=id desc&$filter=is_active eq true` via OData.
- On success: deserializes the response array into `ItemCategory` objects and assigns to `this.ItemCategories`.
- Called by `onRefreshTable('category')` after an inline category is created.

---

### `loadVariants(): void`
- Sends a GET request to `Variants?$orderby=id desc&$filter=is_active eq true` via OData.
- On success: maps response to `Variant` objects, ensures `name` and `id` are coerced to strings, filters out entries with empty names, assigns to `this.variantLists`, then calls `cdRef.detectChanges()`.
- Called by `onVariantSelectFocus()` and `onRefreshTable('variant')`.

---

### `loadProductTypes(): void`
- Sends a GET request to `ProductTypes?$orderby=id desc&$filter=is_active eq true` (non-OData endpoint).
- On success: maps response to `ProductType` objects and assigns to `this.productTypeLists`.
- Called by `onRefreshTable('item_type')`.

---

### `LoadUomList(): void`
- Sends a GET request to `Uoms?$orderby=id desc&$filter=is_active eq true` via OData.
- On success:
  1. Filters out entries missing `id` or `name`, deserializes remaining into `Uom` objects, assigns to `this.Uomlists`.
  2. If `product.uom_id` is set, finds the matching UOM and updates `selectedItemUomName`.
  3. If `newlyAddedUom` is set, prepends it to `Uomlists`, sets `product.uom_id` to the new UOM's id, updates `selectedItemUomName`, and clears `newlyAddedUom`.
- Called by `onRefreshTable('uom')`.

---

### `getBatchData(): void`
- Constructs a batch request payload with four GET sub-requests (IDs "1"–"4") targeting: `ItemCategories`, `Variants`, `ProductTypes`, and `Uoms` — all filtered to active records, ordered by `id desc`.
- POSTs the batch to the `$batch` endpoint via OData.
- On success:
  - Finds each sub-response by ID.
  - Deserializes `ItemCategories` → `this.ItemCategories`.
  - Deserializes `Variants` → `this.variantLists`.
  - Deserializes `ProductTypes` → `this.productTypeLists`.
  - Deserializes `Uoms` (filtering items without `id`/`name`) → `this.Uomlists`. If `newlyAddedUom` is pending, prepends it, sets `product.uom_id`, and clears the pending value.
  - Calls `cdRef.detectChanges()`.
- Called once in `ngOnInit()`.

---

### `onCategorySelection(event: any): void`
- Triggered by the Category combobox `selectionChange` event.
- Extracts `rawId` (numeric ID) and the prefix/name from the selected item.
- Builds a new `ItemCategory` object and assigns to `this.selectedCategory`.
- Sets `product.item_category_id` to the selected ID.
- Calls `itemCodeLoad(...)` to auto-generate an item code from the category prefix.
- Calls `checkValidation(...)` for the `"category"` field.
- Emits `refreshTrigger`.

---

### `onSubcategorySelection(event: any): void`
- Triggered by the Subcategory multi-combobox `selectionChange` event.
- Maps all selected items into `{ id, name, category_id }` objects and assigns to `this.selectedSubCategory`.

---

### `getSubcategory(categoryId: any): void`
- Sends a GET request to `ItemSubCategories?$filter=category_id eq {categoryId}` via OData.
- On success: maps response to `ItemSubCategory` objects and assigns to `this.ItemSubCategories`.
- Note: This method is defined but not called from the current template or other methods. It may be a utility for future use or was previously wired to the category selection event.

---

### `variantIdinArray(): void`
- If `product.variants` is populated, extracts all variant `id` values into `this.variantIds` as strings.
- Otherwise sets `variantIds` to `[]`.

---

### `itemCodeLoad(data?: any): void`
- Sets `product.item_code` to the current `catagoryPrefix` immediately (optimistic assignment).
- POSTs to `generate-id` (plain API) with the provided `data` payload (`{ model, prefix, field }`).
- On success:
  - If `isclone` is `true`: stores the response code in `this.generateCode` (preserving the original `product.item_code`).
  - Otherwise: sets `product.item_code = response.code`.
  - Calls `checkValidation` twice for `"code"` (duplicate call, likely a copy-paste artifact).
  - Calls `cdRef.detectChanges()`.

---

### `associateTableColum(): object[]`
- Returns a two-column definition array (`custom_id`, `name`) used by all three `AssosiateComponent` instances (supplier, client, plant) for their internal display tables.

---

### `openSupplierModal(): void`
- Sets `suppliersAssosiate.open = true` to show the associate modal.
- Passes current `this.Suppliers` as `bindingData` so already-selected items are pre-highlighted.

---

### `getSupplierFromAssosiate(selectedItems: any): void`
- Callback from the supplier `AssosiateComponent` `selectedData` output.
- Sets `this.Suppliers = selectedItems`.
- Spreads `supplierDataSource` with new `data` array to trigger Angular CD and refresh the AG Grid.

---

### `removeSupplierData(data: any): void`
- Filters `this.Suppliers` excluding item where `id === data.id`.
- Spreads `supplierDataSource` with the updated array — no ViewChild or manual render needed.

---

### `clientTableColum(): object[]`
- Identical structure to `supplierTableColum()`, with the delete action calling `removeClientData(row.original)` instead.

---

### `openClientModal(): void`
- Sets `clientAssosiate.open = true`.
- Passes current `this.Clients` as `bindingData`.

---

### `getClientFromAssosiate(selectedItems: any): void`
- Callback from the client associate modal.
- Emits selected items to `clientTable.staticData`, calls `clientTable.render()`.
- Updates `this.Clients`.

---

### `removeClientData(data: any): void`
- Filters `this.Clients` to exclude the item with matching `id`.
- Emits updated array to `clientTable.staticData`, calls `clientTable.render()`.
- Updates `this.Clients`.

---

### `openPlantModal(): void`
- Sets `plantAssosiate.open = true`.
- Passes current `this.Plants` as `bindingData`.

---

### `getPlantFromAssosiate(selectedItems: any): void`
- Callback from the plant associate modal.
- Sets `this.Plants = selectedItems`.
- Spreads `plantDataSource` with new `data` array to refresh the AG Grid.

---

### `removePlantData(data: any): void`
- Filters `this.Plants` excluding item where `id === data.id`.
- Spreads `plantDataSource` with updated array — no ViewChild or manual render needed.

---

### `validateForm(): boolean`
- Checks four required fields and sets the appropriate `ValueState` on failure:
  1. `product.product_name` — must be non-empty after trim.
  2. `product.item_code` OR `generateCode` — at least one must be non-empty after trim.
  3. `product.item_category_id` — must be truthy.
  4. `product.uom_id` — must be truthy.
- The `productTypes` validation (item type required) is present but commented out.
- Returns `true` if all active validations pass; `false` otherwise.

---

### `checkValidation(event: any, field: string): void`
- Real-time per-field validation triggered by input change events.
- Reads `event.target.value`; falls back to `""` if missing.
- Switch on `field`:
  - `"name"`: if empty → `name = Negative`; else updates `product.product_name` and clears state.
  - `"code"`: checks both `product.item_code` and `generateCode`; if both empty → `code = Negative`; else updates both and clears state.
  - `"category"`: checks `selectedCategory.id`; if falsy → `catagory = Negative`; else sets `product.itemCategories = [selectedCategory]` and clears state.
  - `"unit_price"`: if empty → `unit_price = Negative`; else updates `product.unit_price` and clears state.
  - `"itemType"`: checks `product.productTypes.length`; sets state accordingly (does not require a value event).
  - `"Item_uom"`: if no value → `uom = Negative`; else sets `product.uom_id` and clears state.

---

### `stripPrefix(code: string): string`
- Splits the code on `"-"`, removes the first segment (the prefix), and rejoins the rest.
- Returns the original string if there are no `"-"` characters.
- Declared but not called in the current visible code (utility method).

---

### `onSaveType(): any`
- Main save handler, called by the Submit button.
- Step 1: Calls `validateForm()`. If invalid, resets `selectedTab` to `"coreData"`, triggers change detection, and returns.
- Step 2: Sets `product.is_variant` based on `product.has_variant` (inverted logic: if has_variant → is_variant = false, else is_variant = true).
- Step 3: Determines the HTTP operation:
  - `saveMode.POST` and not `isclone`: POSTs to `Products`.
  - `saveMode.PUT`: PUTs to `Products(id)`.
  - `isclone`: Shows the clone confirmation dialog (`openCheckClone = true`) and returns early.
- Step 4: Calls `submitRequest(request$)`.

---

### `SubmitClone(): void`
- Called when the user confirms the clone dialog.
- Builds the payload from `product.toOdata()` but overrides `item_code` with `this.generateCode` and sets `item_category_id` from `selectedCategory`.
- POSTs to `Products` via `commonService.post(..., true)`.
- Passes the resulting observable to `submitRequest()`.

---

### `submitRequest(request$: any): void`
- Sets `loading = true`, closes the clone dialog (`openCheckClone = false`).
- Subscribes to the request observable.
- **On success:**
  1. Passes `response.id` to `mediaService.setId()`.
  2. Deserializes the response into `this.product`.
  3. Calls `productAssociate(product.id, callback)`.
  4. Inside the callback: if `saveMode === POST`, calls `inserVarianttData()`; emits `RefreshTable`; calls `onCancel()`; shows the appropriate toast.
- **On error:** logs the error, sets `open = false`, shows an error toast.

---

### `productAssociate(id: number | undefined, onSuccess?: () => void): void`
- Validates that `id` is defined; if not, sets an error message, stops loading, shows error toast, and returns.
- Builds an association payload:
  ```
  {
    product_id: id,
    category_id: selectedCategory.id | null,
    plants: Plants,
    suppliers: Suppliers,
    clients: Clients,
    productTypes: selectedProductType ? [selectedProductType] : [],
    itemSubCategories: selectedSubCategory,
  }
  ```
- POSTs to `product/associate` (plain API).
- On success: sets `loading = false`, calls `onSuccess?.()`.
- On error: logs error, shows error toast, sets `loading = false`.

---

### `onTabSelect(event: any): void`
- Sets `selectedTab` to the `id` of the selected tab element (note: the assignment is duplicated — likely a copy-paste artifact).
- If the newly selected tab is `"attachments"` and the form is in `PUT` mode, calls `itemAttachmentsTab.loadInputImages()` to lazy-load existing attachments.

---

### `onUomSelectFocus($event?: any): void`
- Triggered by the UOM combobox `selectionChange` event.
- If an item is provided: sets `product.uom_id` to the selected item's `id` (as string) and updates `selectedItemUomName`.

---

### `onVariantSelectFocus(): void`
- Sets `showVariantSection = true`.
- Calls `loadVariants()` to refresh the variant type list.

---

### `onItemTypeSelectFocus(e: any): void`
- Triggered by the Item Type combobox `selection-change` event.
- If no item selected: clears `selectedProductType` and `selectedItemTypeName`.
- If an item is selected: builds a `ProductType` object from `item.id` and `item.text`, assigns to `selectedProductType`, updates `selectedItemTypeName`, and sets `product.productTypes = [selectedProductType]`.

---

### `onRefreshTable(type: string): void`
- Switch on `type` to reload the appropriate reference list:
  - `"item_type"` → `loadProductTypes()`.
  - `"uom"` → `LoadUomList()`.
  - `"category"` → `getCategory()`.
  - `"variant"` → `loadVariants()`.
- Note: each matching case also calls `console.warn` with an "Unknown type" message — this is a bug (the warn should only fire in the `default` branch).

---

### `AddItemCategory(): void`
- Resets `itemCategory` to an empty deserialized object.
- Sets `saveMode` to `POST`.
- Opens the `CategoryFormComponent` by setting `categoryFormRef.open = true`.

---

### `OnAddClickProductType(): void`
- Resets `productType` to an empty deserialized object.
- Sets `saveMode` to `POST`.
- Opens the `ProductFormComponent` by setting `productFormRef.open = true`.

---

### `OnAddClickUom(): void`
- Resets `uom` to an empty deserialized object.
- Sets `saveMode` to `POST`.
- Opens the `UomFormComponent` by setting `uomFormRef.open = true`.

---

### `OnAddClickSubCat(): void`
- Calls `subCatFormRef.getItemCategory()` to pre-load categories in the sub-category form.
- Resets `subCatFormRef.itemSubCategory` to an empty deserialized object.
- Sets `saveMode` to `POST`.
- Opens the sub-category form by setting `subCatFormRef.open = true`.

---

### `OnAddClickVariant(): void`
- Resets `variant` to an empty deserialized object.
- Sets `saveMode` to `POST`.
- Opens the `VariantFormComponent` by setting `variantFormRef.open = true`.

---

### `onCurrencyChange($event: any): void`
- Reads the selected currency text from `$event.detail.item.text`.
- Assigns to `product.currency`.
- Calls `calculateAmount()` to recompute `unit_price`.
- Calls `cdRef.detectChanges()`.

---

### `calculateAmount(): void`
- Reads `product.price_in_bdt` (USD exchange rate) and `product.price_in_usd` (USD value) as floats.
- If both are valid numbers: sets `product.unit_price = (rate * value).toString()`.
- If either is NaN: does nothing (the else branch is empty).

---

### `variantTableColum(): object[]`
- Returns a four-column definition for the variant analytical table:
  1. **Active** (`is_active`) — renders accept/decline icon.
  2. **Variant Name** (`product_name`) — custom Cell renders `product_name || variant_value || "-"`.
  3. **Unit Price** (`unit_price`) — custom Cell renders `unit_price || variant_unit_price || "-"`.
  4. **Actions** — transparent delete button calling `removeVariant(row.original)`.

---

### `onVariantChange(event: any): void`
- Triggered by the Variant Type combobox `selection-change` inside the variant dialog.
- Reads `item.text` into `variant.variant_name`.
- Reads the `data-id` attribute from the item element into `variant.variant_id`.

---

### `addVariant(): void`
- Appends a copy of the current `variant` object (via `Object.assign`) to both `product.variants` and `this.Variants`.
- Resets `variant` to a fresh object with `variant_currency: "BDT"`.

---

### `onVariantCurrencyChange(event: any): void`
- Reads the selected currency text.
- Assigns to `variant.variant_currency`.
- If the currency is not BDT (note: the condition compares the string against `currency.BDT` using `!==` but contains a bug — it uses `currency` the local variable, not the enum): clears `variant_price_in_bdt`, `variant_price_in_usd`, and `variant_unit_price`.

---

### `calculateVariantUsdAmount(): void`
- Reads `variant.variant_price_in_bdt` (rate) and `variant.variant_price_in_usd` (USD value) as floats.
- If both are non-zero: sets `variant.variant_unit_price = (rate * usdValue).toString()`.
- Otherwise: clears `variant.variant_unit_price`.

---

### `removeVariant(data: any): void`
- **POST mode:**
  - Filters `product.variants` to exclude the matching object reference.
  - Syncs `Variants` with the updated array.
  - Calls `assignVariant(Variants)` to update the table.
  - Shows a "delete" toast and returns.
- **PUT mode:**
  - If `data.id` exists (server record): emits `IsDelete` with `"Products/<data.id>"` and returns (actual delete is handled by `app-delete-entity`).
  - If `data.id` does not exist (locally added, unsaved): filters `product.variants`, syncs `Variants`, calls `assignVariant`, shows "delete" toast.
- If neither mode matches: logs a warning and shows an error toast.

---

### `openVariantModal(data: any): void`
- Called when the "New" insert button is clicked on the variant analytical table.
- Calls `resetForm()` to clear the variant working model.
- Sets `isVariantEdit = false` and `selectedVariantId = ""`.
- Sets `openVariantEdit = true` to show the variant dialog.

---

### `closeVariantModal(): void`
- Calls `resetForm()`.
- Sets `openVariantEdit = false` to hide the variant dialog.

---

### `Assign(): void`
- Called by the Submit button inside the variant dialog.
- **POST mode:**
  - If `isVariantEdit`: finds the variant by `selectedVariantId` in `product.variants` and replaces it in-place.
  - If not edit: calls `addVariant()` to append.
  - Calls `assignVariant(product.variants)` to refresh the table.
- **PUT mode (new variant):**
  - Builds a full product payload where `product_name = "<baseName>-<variant_value>"`, `is_variant = true`, `has_variant = false`, `parent_id = product.id`.
  - If `isVariantEdit`: PUTs to `Products(<selectedVariantId>)`; on success shows "edit" toast and refreshes `variantEditTableRef`.
  - If not edit: first GETs a generated code from `generate-id`, then POSTs to `Products` with the new code; on success calls `productAssociate(insertResponse.id)`, shows "add" toast, and refreshes `variantEditTableRef`.
- Always calls `closeVariantModal()` at the end.

---

### `assignVariant(data: any): void`
- Emits `data` (or `[]` if falsy) via `variantTable.staticData`.
- Calls `variantTable.render()` to force a re-render.

---

### `resetForm(): void`
- Resets `variant` to a fresh object with `variant_currency: "BDT"` and empty `variant_value`.
- Clears `selectedVariantType`, `selectedItemUomName`, and `selectedItemTypeName`.

---

### `async inserVarianttData(): Promise<void>`
- Called after a successful POST save (inside `submitRequest`'s success callback).
- Calls `validateForm()`; returns early if invalid.
- Sets `loading = true`.
- Filters `product.variants` to only those with both `variant_id` and `variant_value`.
- For each valid variant (sequentially via `await`/`firstValueFrom`):
  1. POSTs to `generate-id` to get a unique item code.
  2. Builds a full variant product payload with `product_name = "<baseName>-<variant_value>"`, `is_variant = true`, `parent_id = product.id`, plus pricing/UOM fields from the parent product.
  3. POSTs to `Products` to insert the variant record.
  4. Calls `productAssociate(variantId)` for each inserted variant.
- After loop: sets `loading = false` and emits `RefreshTable`.
- On error: logs, sets `loading = false`, shows error toast.

---

### `autoUomAdded(newUom: Uom): void`
- Callback from `UomFormComponent`'s `(UomAdded)` output.
- Prepends the newly created UOM to `Uomlists`.
- Sets `product.uom_id` to the new UOM's `id`.
- Updates `selectedItemUomName`.

---

### `autoTypeAdded(newType: ProductType): void`
- Callback from `ProductFormComponent`'s `(TypeAdded)` output.
- Prepends the new type to `productTypeLists`.
- Deserializes a `ProductType` from `{ id, name }` and assigns to `selectedProductType`.
- Sets `product.productTypes = [selectedProductType]`.
- Updates `selectedItemTypeName`.
- Calls `checkValidation` for `"itemType"`.

---

### `autoCategoryAdded(newCat: ItemCategory): void`
- Callback from `CategoryFormComponent`'s `(CatAdded)` output.
- Prepends the new category to `ItemCategories`.
- Builds a `selectedCategory` from `{ id, prefix, name }`.
- Updates `selectedCategoryId` and `catagoryTitle`.
- Calls `checkValidation` for `"category"`.
- Calls `itemCodeLoad` using the new category's prefix to auto-generate a code.

---

### `onCancel(): void`
- Emits `closeFrom` to signal the parent to close the form.
- Calls `resetValuState()` to clear all validation highlights.
- Calls `resetForm()` to clear the working variant model.

---

### `reset(): void`
- Replaces `product` with a freshly deserialized empty `Product`.
- Used externally by a parent component to fully reset the form model.

---

## Template Bindings & Structure

The template is organized into one `ui5-card` containing a tabbed layout, plus several modal overlays rendered outside the card.

### Card Header
- `ui5-card-header` title dynamically shows **"New"** (`POST`) or **"Edit"** (`PUT`) via `localization`.

### Busy Indicator
- `ui5-busy-indicator [active]="loading"` overlays the entire tab container during async operations.

### Tab Container (`ui5-tabcontainer`)
Contains six tabs, switching tracked via `onTabSelect($event)`:

#### Tab 1: Core Data (`id="coreData"`, always visible, selected by default)
Row 1 — Toggles:
- **Active**: `ui5-switch [(ngModel)]="product.is_active"`.
- **Has Variant**: `ui5-switch [(ngModel)]="product.has_variant"` — shown only when `hasPermission('item-variants')`.
- **Is Sellable Item**: `ui5-switch [(ngModel)]="product.is_sellable"`.

Row 2 — Grid fields (`grid-cols-2`):
- **Item Code** (required): `ui5-input [(ngModel)]="product.item_code"`, readonly in PUT mode; `(change)` → `checkValidation($event, 'code')`.
- **Category** (required): `ui5-combobox [value]="catagoryTitle"`, readonly in PUT mode; iterates `ItemCategories`; `(selectionChange)` → `onCategorySelection`; inline add button → `AddItemCategory()`.
- **Item Name** (required): `ui5-input [(ngModel)]="product.product_name"`; `(input)` → `checkValidation($event, 'name')`.
- **UOM** (required): `ui5-combobox [value]="selectedItemUomName"`; iterates `Uomlists`; `(selectionChange)` → `onUomSelectFocus`; `(selection-change)` → `checkValidation($event, 'Item_uom')`; inline add button → `OnAddClickUom()`.
- **Model**: `ui5-input [(ngModel)]="product.model_number"`.
- **Part Number**: `ui5-input [(ngModel)]="product.part_number"` (type Number).
- **Subcategory** (optional, permission-gated `'item-subcategories'`): `ui5-multi-combobox`; iterates `ItemSubCategories`; `(selectionChange)` → `onSubcategorySelection`; inline add button → `OnAddClickSubCat()`.
- **Item Type** (optional, permission-gated `'item-type'`, required label): `ui5-combobox [value]="selectedItemTypeName"`; iterates `productTypeLists`; `(selection-change)` → `onItemTypeSelectFocus`; `(change)` → `checkValidation($event, 'itemType')`; inline add button → `OnAddClickProductType()`.
- **Rack No**: `ui5-input [(ngModel)]="product.rack_no"`.
- **Current Stock**: `ui5-input [(ngModel)]="product.current_stock"` (type Number).
- **Minimum Stock**: `ui5-input [(ngModel)]="product.minimum_stock"` (type Number).

Row 3 — Pricing (all hidden when `product.has_variant` is true via `*ngIf="!product.has_variant"`):
- **Currency**: `ui5-combobox [(ngModel)]="product.currency"`; options BDT / USD; `(selection-change)` → `onCurrencyChange`.
- **Unit Price**: `ui5-input [(ngModel)]="product.unit_price"`; readonly when `product.currency === currency.USD`; `(input)` → `checkValidation($event, 'unit_price')`.
- **USD Rate**: `ui5-input [(ngModel)]="product.price_in_bdt"`; `[hidden]` when currency is not USD; `(input)` → `calculateAmount()`.
- **USD Value**: `ui5-input [(ngModel)]="product.price_in_usd"`; `[hidden]` when currency is not USD; `(input)` → `calculateAmount()`.
- **Description**: `ui5-textarea [(ngModel)]="product.description"`.

#### Tab 2: Variant (`id="variant"`, shown only when `product.has_variant`)
- In POST mode: renders `react-analytical-table #variantTable` in static mode; "New" button fires `openVariantModal($event)`.
- In PUT mode: renders `react-analytical-table #variantEditTable` in API mode, filtering by `parent_id eq <product.id>`; "New" button fires `openVariantModal($event)`.
- Both use `variantTableColum()` for column definitions.

#### Tab 3: Supplier (`id="supplier"`, always visible)
- `app-ag-grid-table` with `[dataSource]="supplierDataSource"` (static), `[columns]="supplierColumns"`, `[toolbarConfig]="supplierToolbarConfig"`, `[displayConfig]="supplierDisplayConfig"`. "Associate" button (`newButtonClick`) → `openSupplierModal()`. Delete action → `removeSupplierData($event)`. Wrapped in `<div class="w-full h-[calc(100vh-290px)] overflow-hidden">` to clip at footer.

#### Tab 4: Client (`id="client"`, shown only when `product.is_sellable`)
- `react-analytical-table #clientTable` in static mode; "Associate" button fires `openClientModal()`.

#### Tab 5: Plant (`id="plant"`, always visible)
- `app-ag-grid-table` with `[dataSource]="plantDataSource"` (static), `[columns]="plantColumns"`, `[toolbarConfig]="plantToolbarConfig"`, `[displayConfig]="plantDisplayConfig"`. "Associate" button (`newButtonClick`) → `openPlantModal()`. Delete action → `removePlantData($event)`. Wrapped in `<div class="w-full h-[calc(100vh-290px)] overflow-hidden">` to clip at footer.

#### Tab 6: Compliance & Certificates (`id="attachments"`, always visible)
- `app-attachment-upload #itemAttachmentsTab` with `[model]="'Product'"`, `[id]="product.id"`, `[apiUrl]="'Products'"`.

### Action Bar (`ui5-bar`)
- **Submit** button: `design="Emphasized"`, disabled while `loading`, calls `onSaveType()`.
- **Cancel** button: `design="Transparent"`, disabled while `loading`, calls `onCancel()`.

### External Modals (rendered outside the card)
1. `app-assosiate #suppliersAssosiate` — `[apiUrl]="'Suppliers?$filter=is_active eq true'"`; `(selectedData)` → `getSupplierFromAssosiate`.
2. `app-assosiate #clientAssosiate` — `[apiUrl]="'Clients?$filter=is_active eq true'"`; `(selectedData)` → `getClientFromAssosiate`.
3. `app-assosiate #plantAssosiate` — `[apiUrl]="'Plants??$filter=is_active eq true'"` (note: double `??` is a template bug); `(selectedData)` → `getPlantFromAssosiate`.
4. `app-product-form #productForm` — `(TypeAdded)` → `autoTypeAdded`; `(RefreshTable)` → `onRefreshTable('item_type')`.
5. `app-category-form #categoryForm` — `(CatAdded)` → `autoCategoryAdded`; `(RefreshTable)` → `onRefreshTable('category')`.
6. `app-uom-form #uomForm` — `(UomAdded)` → `autoUomAdded`; `(RefreshTable)` → `onRefreshTable('uom')`.
7. `app-sub-category-form #subCatForm` — `(RefreshTable)` → `onRefreshTable('subCategory')`.
8. `app-variant-form #variantForm` — `(RefreshTable)` → `onRefreshTable('variant')`.
9. `app-delete-entity` — `(isSuccess)` → `RefreshTable.emit()`; `[IsDelete]="IsDelete"`.

### Variant Dialog (`ui5-dialog [open]="openVariantEdit"`)
- Header: shows "Variant of: `<product.product_name>`".
- Fields: Variant Type combobox (iterates `variantLists`, `(selection-change)` → `onVariantChange`; inline add → `OnAddClickVariant()`), Variant Value input (`variant.variant_value`).
- Pricing sub-row: Currency combobox, Unit Price input (readonly when USD), USD Rate (conditional), USD Value (conditional); both USD fields trigger `calculateVariantUsdAmount()`.
- Footer: Submit → `Assign()`; Cancel → `closeVariantModal()`.

### Clone Confirmation Dialog (`ui5-dialog [open]="openCheckClone"`)
- Confirmation message.
- Submit → `SubmitClone()`; Cancel → closes dialog.

---

## API Calls

| HTTP Method | Endpoint | When Called | Payload / Query Params | Response Handling |
|---|---|---|---|---|
| POST (batch) | `$batch` (OData) | `ngOnInit` via `getBatchData()` | Body: four sub-GET requests for ItemCategories, Variants, ProductTypes, Uoms | Populates `ItemCategories`, `variantLists`, `productTypeLists`, `Uomlists` |
| GET | `ItemCategories?$orderby=id desc&$filter=is_active eq true` (OData) | `onRefreshTable('category')` | None | Populates `ItemCategories` |
| GET | `Variants?$orderby=id desc&$filter=is_active eq true` (OData) | `onRefreshTable('variant')`, `onVariantSelectFocus` | None | Populates `variantLists` |
| GET | `ProductTypes?$orderby=id desc&$filter=is_active eq true` (non-OData) | `onRefreshTable('item_type')` | None | Populates `productTypeLists` |
| GET | `Uoms?$orderby=id desc&$filter=is_active eq true` (OData) | `onRefreshTable('uom')` | None | Populates `Uomlists`; handles `newlyAddedUom` prepend |
| GET | `ItemSubCategories?$filter=category_id eq {id}` (OData) | `getSubcategory(categoryId)` (currently not wired) | Query param: `category_id` | Populates `ItemSubCategories` |
| POST | `generate-id` (plain API) | `itemCodeLoad()`, `Assign()` (PUT/new variant), `inserVarianttData()` (per variant) | `{ model: "products", prefix, field: "item_code" }` | Sets `product.item_code` or `generateCode` or `payload.item_code` |
| POST | `Products` (OData/API) | `onSaveType()` (POST mode), `SubmitClone()` | `product.toOdata()` (or clone override) | Deserializes response into `product`; triggers `productAssociate` |
| PUT | `Products({id})` (OData/API) | `onSaveType()` (PUT mode) | `product.toOdata()` | Same as POST success flow |
| POST | `product/associate` (plain API) | `productAssociate()` | `{ product_id, category_id, plants, suppliers, clients, productTypes, itemSubCategories }` | On success: calls `onSuccess()` callback |
| POST | `Products` (OData) | `inserVarianttData()` (per variant, POST mode) | Full variant payload with generated `item_code` | Calls `productAssociate(variantId)` |
| POST | `Products` (OData) | `Assign()` (PUT mode, new variant) | Full variant payload with generated code | Calls `productAssociate(insertResponse.id)`; refreshes variant table |
| PUT | `Products({variantId})` (OData) | `Assign()` (PUT mode, edit variant) | Full variant payload without item_code | Shows "edit" toast; refreshes `variantEditTableRef` |

---

## Validation Logic

| Field | Validation Rule | State on Failure | When Checked |
|---|---|---|---|
| Item Name (`product.product_name`) | Must not be empty after `trim()` | `valueStateOptions.name = ValueState.Negative` | On input event (`checkValidation`), on form submit (`validateForm`) |
| Item Code (`product.item_code` or `generateCode`) | At least one must not be empty after `trim()` | `valueStateOptions.code = ValueState.Negative` | On change event, after code generation, on form submit |
| Category (`product.item_category_id`) | Must be truthy (a selected category ID) | `valueStateOptions.catagory = ValueState.Negative` | On combobox change, on form submit |
| UOM (`product.uom_id`) | Must be truthy | `valueStateOptions.uom = ValueState.Negative` | On combobox selection change, on form submit |
| Unit Price (`product.unit_price`) | Must not be empty after trim (validated in `checkValidation` but NOT in `validateForm`) | `valueStateOptions.unit_price = ValueState.Negative` | On input event only |
| Item Type (`product.productTypes`) | Must have at least one entry (validation present in `checkValidation` but commented out of `validateForm`) | `valueStateOptions.itemType = ValueState.Negative` | On combobox change only |

**Failure behaviour on submit:** If `validateForm()` returns `false`, the component forcibly switches back to the `"coreData"` tab and calls `cdRef.detectChanges()` so the user can see which fields are highlighted.

---

## Services Injected

| Service | Why Injected | Methods Used |
|---|---|---|
| `CommonService` | Central HTTP abstraction for OData and plain API calls | `get()`, `post()`, `put()`; provides `odata` and `api` boolean flags |
| `ToastService` | Display feedback toasts to the user | `show(type)` where type is `"add"`, `"edit"`, `"delete"`, or `"error"` |
| `MediaService` | Associates media/attachments with a saved entity | `setId(id)` — called immediately after a product is saved |
| `ChangeDetectorRef` | Trigger manual change detection | `detectChanges()` — called after async updates that Angular may not pick up |
| `RolePermissionService` | Permission-based feature gating | `hasPermission(permission: string): boolean` |

---

## Inter-component Communication

### With Parent Component
- **Input**: receives `product`, `saveMode`, `isVariantList`, `isclone`.
- **Output — `closeFrom`**: parent closes the form panel.
- **Output — `RefreshTable`**: parent reloads its product list.
- **Output — `refreshTrigger`**: parent reacts to category change events.
- **Output — `IsDelete`**: wired to `app-delete-entity` which handles entity deletion via a DELETE API call.

### With Child Components (all embedded in the template)
| Child | Communication |
|---|---|
| `app-product-form` | Input: `saveMode`, `productType`. Output: `(TypeAdded)` → `autoTypeAdded()`, `(RefreshTable)` → `onRefreshTable('item_type')` |
| `app-uom-form` | Input: `saveMode`, `uom`. Output: `(UomAdded)` → `autoUomAdded()`, `(RefreshTable)` → `onRefreshTable('uom')` |
| `app-category-form` | Input: `saveMode`, `itemCategory`. Output: `(CatAdded)` → `autoCategoryAdded()`, `(RefreshTable)` → `onRefreshTable('category')` |
| `app-sub-category-form` | Input: `saveMode`. Output: `(RefreshTable)` → `onRefreshTable('subCategory')`. ViewChild used to call `getItemCategory()` and set `open`. |
| `app-variant-form` | Input: `saveMode`, `variant`. Output: `(RefreshTable)` → `onRefreshTable('variant')` |
| `app-assosiate` (×3) | Input: `apiUrl`, `model`, `tableColumn`. Output: `(selectedData)` → respective `get*FromAssosiate()` handler. ViewChild used to set `open` and `bindingData`. |
| `react-analytical-table` (×3) | Variant (×2) and Client (×1) tables receive data via ViewChild `staticData.emit()` and `render()`. Dynamic variant table uses `refreshTrigger.emit()` for reload. |
| `app-ag-grid-table` (×2) | Supplier and Plant tabs — static data via `supplierDataSource`/`plantDataSource` object spread. No ViewChild; delete rows via `(deleteClick)` output. |
| `app-attachment-upload` | ViewChild used to call `loadInputImages()` when the attachments tab is selected in PUT mode. |
| `app-delete-entity` | Input: `[IsDelete]="IsDelete"` (the EventEmitter itself is passed as an input). Output: `(isSuccess)` → `RefreshTable.emit()` |

---

## Enums / Models Used

| Name | Kind | Source Path | Usage |
|---|---|---|---|
| `Product` | Model class | `@shared/model/product` | Main form data model |
| `ProductType` | Model class | `@shared/model/productType` | Item type selection and inline creation |
| `ItemCategory` | Model class | `@shared/model/itemCategory` | Category selection and inline creation |
| `ItemSubCategory` | Model class | `@shared/model/itemSubCategory` | Sub-category multi-selection |
| `Uom` | Model class | `@shared/model/uom` | UOM selection and inline creation |
| `Variant` | Model class | `@shared/model/variant.js` | Variant working model and list |
| `Plant` | Model class | `@shared/model/plant` | Plant association |
| `Client` | Model class | `@shared/model/client` | Client association |
| `Supplier` | Model class | `@shared/model/supplier` | Supplier association |
| `saveMode` | Enum | `@shared/enums/saveMode` | Controls form mode: `POST`, `PUT` |
| `currency` | Enum | `@shared/enums/currency.js` | `BDT` / `USD` currency options |
| `Permissions` | Enum | `@app/shared/enums/permissions` | Imported but not directly referenced in visible code (likely used via `RolePermissionService`) |
| `ValueState` | UI5 type | `@ui5/webcomponents-base/dist/types/ValueState.js` | Field-level validation visual state (`None`, `Negative`) |
| `Localization` | Utility object | `@shared/utilities/localization` | Static label strings used in table headers and button text |
| `TextAlign` | UI5 type | `@ui5/webcomponents-react` | Used in column definitions to set `hAlign` |

---

## Key Business Logic

### 1. Dual-mode Code Generation (POST vs Clone)
When `isclone = true` and the user hits Submit, the form does not immediately POST. Instead it shows a confirmation dialog (`openCheckClone`). While in the background, `itemCodeLoad()` generates a fresh code and stores it in `generateCode` (not in `product.item_code`, which retains the original). When the user confirms, `SubmitClone()` uses `generateCode` as the `item_code` for the new record, preserving the original product's code intact.

### 2. Category-driven Code Generation
Selecting a category triggers `itemCodeLoad()` which calls the `generate-id` API with the category's `prefix`. The API returns a code like `PREFIX-0001`. On clone, this generated code goes to `generateCode`; in normal POST mode it overwrites `product.item_code`. The code field is readonly in PUT mode to prevent accidental changes.

### 3. Product Association as a Separate Step
After creating or updating a product, all relational data (category, plants, suppliers, clients, product type, sub-categories) is sent as a separate POST to `product/associate`. This is always the second API call after the product save. The main save's success callback waits for this association before emitting `RefreshTable` and closing the form.

### 4. Variant Creation Flow (POST mode)
When a parent product has variants and is saved in POST mode, `inserVarianttData()` runs sequentially (using `await/firstValueFrom`) for each variant in `product.variants`. For each: it generates a unique item code, then inserts a new `Products` record with `is_variant = true`, `has_variant = false`, and `parent_id = <parent product id>`. The variant product name is auto-constructed as `"<parentName>-<variantValue>"`. Each variant then gets its own association call.

### 5. Variant Creation Flow (PUT mode)
In edit mode, variants are added/edited individually via the variant dialog. On `Assign()`, a single POST or PUT is made immediately to the server without re-saving the parent product. This is intentionally different from the POST batch flow.

### 6. Pricing Calculation (USD mode)
Both the parent product and each variant support multi-currency pricing. When USD is selected, the Unit Price field becomes readonly. Instead the user enters a "USD Rate" (`price_in_bdt` — the exchange rate) and a "USD Value" (`price_in_usd` — the amount in USD). The computed `unit_price = rate × value` is calculated client-side and stored on the model.

### 7. Permission-gated Fields
Three sections require explicit permissions:
- `'item-variants'` — the "Has Variant" toggle.
- `'item-subcategories'` — the Subcategory multi-combobox.
- `'item-type'` — the Item Type combobox.
These are evaluated via `rolePermissionService.hasPermission()` using `*ngIf` in the template.

### 8. Client Tab Visibility
The Client tab is conditionally rendered only when `product.is_sellable` is `true`, reflecting the business rule that client associations only apply to sellable items.

### 9. Attachment Lazy-loading
The `app-attachment-upload` component inside the Compliance & Certificates tab only calls `loadInputImages()` when the tab is actually selected AND the form is in PUT mode. This avoids unnecessary API calls on form open.

### 10. Known Issues / Bugs
- `onRefreshTable()` calls `console.warn('Unknown type: ...')` for every known case except the `default` branch — the warn call is misplaced.
- The plant associate `apiUrl` contains a double question mark: `'Plants??$filter=...'`.
- `onVariantCurrencyChange` compares `currency` (the local variable string) against `currency.BDT` (the enum property), making the comparison always `false` when currency is USD — the clear logic never fires correctly.
- `onTabSelect` assigns `selectedTab` twice in succession (duplicate line).
- `checkValidation` for `"code"` calls `checkValidation` twice from within `itemCodeLoad` (duplicate call in `itemCodeLoad`).
