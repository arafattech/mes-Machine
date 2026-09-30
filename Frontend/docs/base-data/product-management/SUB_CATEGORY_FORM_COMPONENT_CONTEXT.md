# SUB_CATEGORY_FORM_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| TypeScript file | `Frontend/src/app/modules/base-data-management/product-management/item-sub-category/sub-category-form/sub-category-form.component.ts` |
| Template file | `Frontend/src/app/modules/base-data-management/product-management/item-sub-category/sub-category-form/sub-category-form.component.html` |
| Stylesheet | `sub-category-form.component.scss` |
| Selector | `app-sub-category-form` |
| Component type | Form / Dialog |
| Purpose | Renders a modal dialog (UI5 `ui5-dialog`) that allows users to create a new item sub-category (POST) or edit an existing one (PUT). The dialog collects the sub-category name, links it to an active parent item category via a combobox, and controls the active/inactive status via a toggle switch. On submission it calls the OData API endpoint `ItemSubCategories`, then emits a table-refresh event to the parent and shows a toast notification. |

---

## Inputs (@Input)

| Input name | Type | Default | Purpose |
|---|---|---|---|
| `saveMode` | `string` | `'POST'` | Controls whether the form performs a create (`'POST'`) or update (`'PUT'`) operation. Compared against the `saveMode` enum values at runtime. Also drives the dialog header text (`New` vs `Edit`). |

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `RefreshTable` | `EventEmitter<void>` | Emitted after a successful POST or PUT operation so the parent component can reload/refresh its data table. Carries no payload. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `ItemCategories` | `ItemCategory[]` | `[]` | Holds the list of active item categories fetched from the API, used to populate the combobox options. |
| `open` | `boolean` | `false` | Controls the `[open]` binding on the `ui5-dialog`. Set to `true` externally to open the dialog, and set to `false` by `CloseDialog()`. |
| `loading` | `boolean` | `false` | When `true`, activates the `ui5-busy-indicator` overlay and disables the Submit and Cancel toolbar buttons. Set to `true` at the start of a save operation and reset to `false` in `CloseDialog()`. |
| `ToastType` | `'add' \| 'edit' \| 'error'` | `'add'` | Tracks which toast variant to display after the API call. Set to `'add'` for POST, `'edit'` for PUT, and `'error'` on failure. |
| `odata` | `boolean` | `commonService.odata` (true) | Copied from `CommonService.odata` in the constructor; passed as the `isLodata` flag to API methods to select the OData URL prefix. |
| `selectedCategory` | `ItemCategory` | `new ItemCategory().deserialize({})` | Declared but not actively used in the current template (the combobox uses `categoryTitle` and `itemSubCategory.category_id` instead). Appears to be a remnant or intended for future use. |
| `validationMessage` | `string` | `Localization.requiredField` ("This field is required.") | The error message shown in `slot="valueStateMessage"` for both the category combobox and the name input when validation fails. |
| `categoryTitle` | `string` | `''` | Tracks the display text of the selected category in the combobox. Kept separately from `itemSubCategory` because the combobox requires a string `[value]` binding while the model stores only the numeric `category_id`. Reset to `''` by `CloseDialog()`. |
| `valueState` | `typeof ValueState` | `ValueState` (re-exported from `@ui5/webcomponents-base`) | Reference to the `ValueState` enum held on the class so that it is accessible directly in the template. |
| `responseType` | `saveMode` | `saveMode.POST` | Declared but not actively consumed in any method or template binding in the current version of the component. |
| `localization` | `typeof Localization` | `Localization` | Reference to the shared `Localization` constant object, exposed so that templates can access localised strings directly (e.g., `localization.New`, `localization.Edit`, `localization.Submit`, `localization.Cancel`, `localization.Active`). |
| `itemSubCategory` | `ItemSubCategory` | `new ItemSubCategory()` | The main form model. Its properties are bound two-way in the template (`name`, `is_active`) and set programmatically (`category_id`). Serialised via `toOdata()` before being sent to the API. Reset to a fresh instance by `CloseDialog()`. |
| `valueStateOptions` | `{ name: ValueState; category: ValueState }` | `{ name: ValueState.None, category: ValueState.None }` | Drives the `[attr.value-state]` attribute on the name input and category combobox. Values flip to `ValueState.Negative` on validation failure and back to `ValueState.None` on valid input or dialog close. |

---

## ViewChild / ViewChildren

| Ref variable | Type | Purpose |
|---|---|---|
| `categoryForm` (`#categoryForm`) | `CategoryFormComponent` | A reference to an embedded `CategoryFormComponent`. Declared with `@ViewChild('categoryForm') categoryFormRef!: CategoryFormComponent`, however the reference is not used in any method body or template interaction in the current implementation. This suggests it was imported and wired up for potential future use (e.g., inline category creation) but is not currently exercised. |

---

## Lifecycle Hooks

### `ngOnInit()`
Called once after the component is initialised. Immediately calls `this.getItemCategory()` to load the list of active item categories from the API so the combobox is populated before the dialog is opened.

There is no `ngOnDestroy` or `ngAfterViewInit` implemented.

---

## Methods — DETAILED

### `ngOnInit(): void`
- **Signature:** `ngOnInit(): void`
- **Logic:** Calls `getItemCategory()`.
- **Side effects:** Triggers an HTTP GET request.
- **Returns:** `void`

---

### `onSaveType(): void`
- **Signature:** `onSaveType(): void`
- **Logic:**
  1. Calls `validateForm()`. If it returns `false`, the method returns immediately without making any API call.
  2. Sets `this.loading = true` to lock the UI.
  3. Determines the HTTP operation based on `this.saveMode`:
     - **POST path:** Sets `url = 'ItemSubCategories'`, sets `ToastType = 'add'`, creates `request$` via `commonService.post(url, this.itemSubCategory.toOdata(), true)`.
     - **PUT path:** Sets `url = 'ItemSubCategories(${this.itemSubCategory.id})'` (OData key-predicate style), sets `ToastType = 'edit'`, creates `request$` via `commonService.put(url, this.itemSubCategory.toOdata(), true)`.
  4. If `request$` is defined (one of the two branches matched), subscribes to the observable:
     - **next:** Calls `CloseDialog()`, emits `RefreshTable`, calls `toastService.show(this.ToastType)` with `'add'` or `'edit'`.
     - **error:** Calls `CloseDialog()`, calls `toastService.show('error')`.
- **Side effects:** HTTP POST or PUT, closes dialog, emits output event, shows toast.
- **Returns:** `void`

---

### `onCategoryChange(event: any): void`
- **Signature:** `onCategoryChange(event: any): void`
- **Logic:**
  1. Reads the selected item from the UI5 combobox event: `event.detail.item.id` and `event.detail.item.text`. UI5 combobox `selectionChange` fires a custom event whose `detail.item` corresponds to the selected `ui5-cb-item`.
  2. Assigns the numeric category ID to `this.itemSubCategory.category_id`.
  3. Assigns the display text to `this.categoryTitle`.
  4. Immediately calls `checkValidation({ target: { value: this.categoryTitle } }, 'category')` to clear any `Negative` value state on the category field, since a valid selection was just made.
- **Side effects:** Mutates `itemSubCategory.category_id`, `categoryTitle`, and potentially `valueStateOptions.category`.
- **Returns:** `void`

---

### `getItemCategory(): void`
- **Signature:** `getItemCategory(): void`
- **Logic:**
  1. Calls `commonService.get('ItemCategories?$orderby=id desc&$filter=is_active eq true', this.odata)`.
  2. On success, maps `response.value` (the OData value array) through `new ItemCategory().deserialize(item)` and stores the result in `this.ItemCategories`.
  3. On error, logs the error to the console with the prefix `'Sub-category error'`.
- **Side effects:** Populates `ItemCategories`; console error on failure.
- **Returns:** `void`

---

### `checkValidation(event: any, type?: string): void`
- **Signature:** `checkValidation(event: any, type?: string): void`
- **Logic:**
  Uses a `switch` on the `type` parameter:
  - **`'name'`:** Reads `event.target.value`. If `.trim()` is falsy (empty or whitespace only), sets `valueStateOptions.name = ValueState.Negative`. Otherwise sets it to `ValueState.None`.
  - **`'category'`:** Reads `event.target.value`. If `.trim()` is falsy, sets `valueStateOptions.category = ValueState.Negative`. Otherwise sets it to `ValueState.None`.
  - **`default`:** No action.
- **Called from:**
  - Template: `(input)` event of `ui5-combobox` with `type = 'category'`.
  - Template: `(input)` event of `ui5-input` with `type = 'name'`.
  - `onCategoryChange()` synthesises a fake event object to trigger the `'category'` branch after a combobox selection.
- **Side effects:** Mutates `valueStateOptions`.
- **Returns:** `void`

---

### `validateForm(): boolean`
- **Signature:** `validateForm(): boolean`
- **Logic:**
  1. Initialises `isValid = true`.
  2. Checks `!this.itemSubCategory.name` (falsy: empty string or undefined). If true, sets `valueStateOptions.name = ValueState.Negative` and sets `isValid = false`.
  3. Checks `!this.itemSubCategory.category_id` (falsy: undefined or 0). If true, sets `valueStateOptions.category = ValueState.Negative` and sets `isValid = false`.
  4. Returns `isValid`.
- **Note:** Both validations run independently, so all invalid fields are highlighted simultaneously.
- **Returns:** `boolean` — `true` if both `name` and `category_id` are truthy, `false` otherwise.

---

### `CloseDialog(): void`
- **Signature:** `CloseDialog(): void`
- **Logic:**
  1. Sets `this.open = false` — closes the dialog.
  2. Sets `this.loading = false` — re-enables toolbar buttons.
  3. Resets `valueStateOptions.name = ValueState.None` — clears name validation state. (Note: `valueStateOptions.category` is not explicitly reset here.)
  4. Resets `this.itemSubCategory = new ItemSubCategory().deserialize({})` — creates a fresh blank model.
  5. Resets `this.categoryTitle = ''` — clears the combobox display value.
- **Called from:**
  - The `(before-close)` event binding on `ui5-dialog` (fires when the user presses Escape or the dialog's native close button).
  - The Cancel button `(click)` handler.
  - The `next` and `error` callbacks in `onSaveType()`.
- **Side effects:** Resets all form state and closes dialog.
- **Returns:** `void`

---

## Template Bindings & Structure

The template consists of a single `ui5-dialog` with internal sections:

```
ui5-dialog [open]="open" [attr.header-text]="..."  (before-close)="CloseDialog()"
  ui5-busy-indicator [active]="loading"
    section
      div.flex.flex-col
        ui5-label "Active"
        ui5-switch [(ngModel)]="itemSubCategory.is_active"
      ui5-label (required) "Select Category"
      ui5-combobox [value]="categoryTitle" (selectionChange)="onCategoryChange($event)"
                   [attr.value-state]="valueStateOptions.category" (input)="checkValidation($event,'category')"
        ui5-cb-item *ngFor="let category of ItemCategories" [text]="category.name" [id]="category.id"
        div[slot="valueStateMessage"] {{ validationMessage }}
      ui5-label (required) "Sub Category Name"
      ui5-input [(ngModel)]="itemSubCategory.name" (input)="checkValidation($event,'name')"
                [attr.value-state]="valueStateOptions.name"
        div[slot="valueStateMessage"] {{ validationMessage }}
  ui5-toolbar [slot="footer"]
    ui5-toolbar-button "Submit" [disabled]="loading" (click)="onSaveType()"
    ui5-toolbar-button "Cancel" [disabled]="loading" (click)="CloseDialog()"
```

### Key bindings:
- **Dialog header text:** Ternary — `this.saveMode === 'POST' ? localization.New : localization.Edit`. Rendered via `[attr.header-text]`.
- **`ui5-switch`:** Two-way bound via `[(ngModel)]` to `itemSubCategory.is_active`. Defaults to `checked` (the HTML attribute sets the initial checked state; `ngModel` overrides via binding).
- **`ui5-combobox`:** One-way `[value]` bound to `categoryTitle`. Items are rendered via `*ngFor` over `ItemCategories`. Selection fires `(selectionChange)` → `onCategoryChange()`. Manual typing fires `(input)` → `checkValidation()`.
- **`ui5-cb-item`:** `[text]` bound to `category.name`, `[id]` bound to `category.id`. The `id` is what gets read back as `event.detail.item.id` in `onCategoryChange`.
- **`ui5-input`:** Two-way `[(ngModel)]` to `itemSubCategory.name`. Live validation on `(input)`.
- **`[attr.value-state]`:** Used (not `[value-state]`) because UI5 web components require attribute binding for non-standard HTML attributes in Angular.
- **`valueStateMessage` slots:** Both use the same `validationMessage` string ("This field is required.").
- **Busy indicator:** Wraps the entire `section`, so the loading spinner covers all form fields simultaneously.
- **Footer buttons:** Both are disabled while `loading` is `true`. Submit triggers `onSaveType()`, Cancel triggers `CloseDialog()`.

---

## API Calls

| HTTP Method | Endpoint | When called | Payload / Query params | What happens with response |
|---|---|---|---|---|
| GET | `ItemCategories?$orderby=id desc&$filter=is_active eq true` | On `ngOnInit` via `getItemCategory()` | No payload; OData query filters for active categories, ordered by `id` descending | Response `value` array is deserialized into `ItemCategory` instances and stored in `ItemCategories` |
| POST | `ItemSubCategories` | When `saveMode === 'POST'` and form is valid, on Submit click | `itemSubCategory.toOdata()` — the full `ItemSubCategory` object excluding `custom_id`, `category`, `created_at`, `updated_at` | On success: dialog closed, `RefreshTable` emitted, toast `'add'` shown. On error: dialog closed, toast `'error'` shown |
| PUT | `ItemSubCategories(${itemSubCategory.id})` | When `saveMode === 'PUT'` and form is valid, on Submit click | `itemSubCategory.toOdata()` — same exclusions as POST | On success: dialog closed, `RefreshTable` emitted, toast `'edit'` shown. On error: dialog closed, toast `'error'` shown |

All calls pass `true` (or `this.odata`) as the `isLodata` flag to `CommonService`, routing them through the OData URL prefix (`environment.ServerApi + '/odata'`).

---

## Validation Logic

| Field | Rule | State set on failure | State cleared when |
|---|---|---|---|
| `itemSubCategory.name` | Must be truthy (non-empty string) — checked in `validateForm()` via `!this.itemSubCategory.name` | `valueStateOptions.name = ValueState.Negative` | When `(input)` fires with a non-whitespace value → `checkValidation()` sets `ValueState.None`; also cleared on `CloseDialog()` |
| `itemSubCategory.name` (live) | Must be non-empty after `.trim()` — checked in `checkValidation()` on every `(input)` event | `valueStateOptions.name = ValueState.Negative` | Next `(input)` event with non-empty trimmed value |
| `itemSubCategory.category_id` | Must be truthy (numeric ID assigned) — checked in `validateForm()` via `!this.itemSubCategory.category_id` | `valueStateOptions.category = ValueState.Negative` | When a combobox item is selected via `onCategoryChange()`, which calls `checkValidation()` with the display text; also when user types a non-empty string in the combobox (live `(input)` event) |
| `itemSubCategory.category_id` (live) | The combobox `(input)` event checks `categoryTitle` via `.trim()` — note: typing in the combobox does NOT update `category_id`, so live clearing of the `Negative` state does not guarantee a valid category_id is set | `valueStateOptions.category = ValueState.Negative` | When trimmed input text is non-empty |

**Edge condition:** A user can type an arbitrary string in the combobox, which clears the `Negative` state on the category field via `checkValidation`, but does not set `category_id` (only selecting a `ui5-cb-item` does that via `selectionChange`). The final `validateForm()` call before the API request will still catch a missing `category_id` and re-apply `ValueState.Negative`.

**Note on `CloseDialog()`:** It resets `valueStateOptions.name` but does not reset `valueStateOptions.category`. This is a minor omission; however, because `itemSubCategory` is fully replaced with a new instance on close, the category combobox effectively resets visually via `[value]="categoryTitle || ''"`.

---

## Services Injected

| Service | Why injected | Methods used |
|---|---|---|
| `CommonService` | Central HTTP wrapper for all API calls; also provides the `odata` flag | `get(url, isLodata)` — fetches categories; `post(url, body, isLodata)` — creates sub-category; `put(url, body, isLodata)` — updates sub-category |
| `ToastService` | Displays user-facing feedback notifications | `show(type: ToastType)` — called with `'add'`, `'edit'`, or `'error'` after API response |

---

## Inter-component Communication

| Direction | Mechanism | Detail |
|---|---|---|
| Parent → this | `@Input() saveMode` | Parent sets `'POST'` or `'PUT'` to control whether the form creates or updates. Parent must also set `component.open = true` and populate `component.itemSubCategory` (for PUT) by accessing the component instance directly. |
| Parent → this | Direct property access | Because there is no `@Input()` for `itemSubCategory` or `open`, the parent is expected to get a reference to this component (likely via `@ViewChild` in the parent) and set `component.open = true` and `component.itemSubCategory = existingRecord` before opening for an edit flow. |
| This → parent | `@Output() RefreshTable` | Emitted (no payload) after a successful save so the parent's table/list component refreshes its data. |
| This → `CategoryFormComponent` | `@ViewChild('categoryForm') categoryFormRef` | A `CategoryFormComponent` is referenced via `ViewChild` but the reference (`categoryFormRef`) is not called or interacted with in any current method. The `CategoryFormComponent` import is present but no `<app-category-form #categoryForm>` tag appears in the current template, meaning the `ViewChild` will always be `undefined` at runtime. |

---

## Enums / Models Used

### `saveMode` (enum)
Located at `Frontend/src/app/shared/enums/saveMode.ts`

| Value | String |
|---|---|
| `saveMode.GET` | `'GET'` |
| `saveMode.POST` | `'POST'` |
| `saveMode.PUT` | `'PUT'` |
| `saveMode.PATCH` | `'PATCH'` |
| `saveMode.DELETE` | `'DELETE'` |
| `saveMode.REQUEST` | `'REQUEST'` |

Only `POST` and `PUT` are used in this component.

---

### `ValueState` (re-export)
Located at `Frontend/src/app/shared/utilities/value-state-wrapper.ts`

Re-exports `ValueState` from `@ui5/webcomponents-base/dist/types/ValueState.js`. Values used in this component: `ValueState.None` (no error styling) and `ValueState.Negative` (red error styling on UI5 inputs and comboboxes).

---

### `Localization` (constant object)
Located at `Frontend/src/app/shared/utilities/localization.ts`

Keys used by this component:

| Key | Default English value |
|---|---|
| `Localization.Active` | `"Active"` |
| `Localization.New` | `"New"` |
| `Localization.Edit` | `"Edit"` |
| `Localization.Submit` | `"Submit"` |
| `Localization.Cancel` | `"Cancel"` |
| `Localization.requiredField` | `"This field is required."` |

---

### `ItemSubCategory` (model class)
Located at `Frontend/src/app/shared/model/itemSubCategory.ts`

Implements `Deserializable`.

| Property | Type | Default | Notes |
|---|---|---|---|
| `id` | `number \| undefined` | `undefined` | OData entity key; used in the PUT URL |
| `category_id` | `number \| undefined` | `undefined` | FK to parent `ItemCategory` |
| `is_active` | `boolean` | `true` | Bound to the switch in the form |
| `name` | `string` | `''` | Bound two-way to the text input |
| `custom_id` | `string \| undefined` | `undefined` | Excluded from `toOdata()` |
| `category` | `ItemCategory \| undefined` | `undefined` | Nested object; excluded from `toOdata()` |
| `created_at` | `string \| undefined` | `undefined` | Excluded from `toOdata()` |
| `updated_at` | `string \| undefined` | `undefined` | Excluded from `toOdata()` |

`toOdata()` strips `custom_id`, `category`, `created_at`, and `updated_at` before sending to the API.

---

### `ItemCategory` (model class)
Located at `Frontend/src/app/shared/model/itemCategory.ts`

Implements `Deserializable`.

| Property | Type | Default | Notes |
|---|---|---|---|
| `id` | `number \| undefined` | `undefined` | Used as `[id]` on `ui5-cb-item` and read back as `event.detail.item.id` |
| `is_active` | `boolean` | `true` | Filtered server-side (only active categories fetched) |
| `name` | `string` | `''` | Used as `[text]` on `ui5-cb-item` |
| `prefix` | `string` | `''` | Not used in this component |
| `subcategories` | `ItemSubCategory[] \| undefined` | `undefined` | Not used in this component |
| `custom_id` | `string \| undefined` | `undefined` | Not used in this component |
| `created_at` | `string \| undefined` | `undefined` | Not used in this component |
| `updated_at` | `string \| undefined` | `undefined` | Not used in this component |

---

## Key Business Logic

1. **OData key-predicate URL for PUT:** The PUT endpoint uses OData-style key-predicate syntax: `ItemSubCategories(${id})` rather than a REST-style `ItemSubCategories/${id}`. This is consistent with OData v4 conventions used throughout the application.

2. **Category fetch on init, not on open:** `getItemCategory()` is called once in `ngOnInit`, not when the dialog opens. This means the category list is loaded once when the component is first created and is not refreshed on subsequent dialog opens. If categories are created/deactivated elsewhere in the session, the list may become stale.

3. **Category ID vs. display title split:** The combobox UI5 component requires a string `[value]` to display, but the data model requires a numeric `category_id`. The component bridges this by maintaining `categoryTitle` (string) separately from `itemSubCategory.category_id` (number). Only a `selectionChange` event (not freetext input) sets the actual `category_id`.

4. **`open` property must be set externally:** The component has no public method to open the dialog. The parent must obtain a reference to the component instance and set `component.open = true` directly. For an edit operation, the parent must also assign the record to `component.itemSubCategory` before setting `open = true`.

5. **`selectedCategory` is unused:** The property `selectedCategory: ItemCategory` is declared and initialised but never read from or written to in any active logic path. It appears to be dead code.

6. **`responseType` is unused:** The property `responseType: saveMode = saveMode.POST` is declared but never referenced in any method or template binding.

7. **`CategoryFormComponent` ViewChild is non-functional:** The `@ViewChild('categoryForm')` reference is declared and the class is imported, but no `<app-category-form #categoryForm>` element exists in the template. The `categoryFormRef` will always be `undefined` at runtime. This suggests a planned inline-category-creation feature that was not completed.

8. **`CloseDialog()` partial state reset:** On close, `valueStateOptions.name` is reset to `ValueState.None` but `valueStateOptions.category` is not. Since `categoryTitle` is reset to `''` and `itemSubCategory` is replaced, the visual state of the combobox resets naturally, but if the dialog is reopened before Angular re-renders (unlikely), the old `valueStateOptions.category` state would persist briefly.

9. **`is_active` switch default:** The `ui5-switch` has a static HTML attribute `checked` in the template, but this is overridden by the `[(ngModel)]` binding to `itemSubCategory.is_active`. Since `ItemSubCategory` initialises `is_active = true`, the switch is always checked by default on a new form.

10. **Active-only categories filter:** The GET query `$filter=is_active eq true` ensures that deactivated categories are never shown as options, preventing creation of sub-categories under inactive parents.
