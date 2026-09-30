# OPERATION_INFO_FORM_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| **TypeScript file** | `src/app/modules/base-data-management/oparation-management/operation-management-info/operation-management-info-form/operation-management-info-form.component.ts` |
| **Template file** | `src/app/modules/base-data-management/oparation-management/operation-management-info/operation-management-info-form/operation-management-info-form.component.html` |
| **Selector** | `app-operation-management-info-form` |
| **Component type** | Form / Dialog |
| **Purpose** | Renders a UI5 dialog containing a form that allows a user to create a new Operation Position (POST) or update an existing one (PUT). The form collects a name, an associated product (selected from a combobox), and an associated machine (selected from a combobox). On successful save it closes the dialog, resets all state, and notifies the parent component to refresh its data table. |

---

## Inputs (@Input)

| Input name | Type | Default | Purpose |
|---|---|---|---|
| `saveMode` | `string` | `'POST'` | Determines whether the form performs a create (`'POST'`) or an update (`'PUT'`) operation. Also controls the dialog header text (New vs Edit). |

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `RefreshTable` | `EventEmitter<any>` | Emitted after a successful save (POST or PUT). Signals the parent component to reload/refresh its data table. No payload is sent. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `operationPosition` | `OperationPosition` | `new OperationPosition()` | The working model object that is built up as the user fills the form. Passed directly (via `toOdata()`) to the API on save. |
| `product` | `Product` | `new Product()` | Temporary Product model instance used in `getProduct()` to deserialize the selected combobox item before extracting the ID. |
| `machine` | `Machine` | `new Machine()` | Temporary Machine model instance used in `getMachine()` to deserialize the selected combobox item before extracting the ID. |
| `products` | `Product[]` | `[]` | Full list of active products fetched from the API. Rendered as `ui5-cb-item` options in the product combobox. |
| `machines` | `Machine[]` | `[]` | Full list of active machines fetched from the API. Rendered as `ui5-cb-item` options in the machine combobox. |
| `selectedProductId` | `number \| null` | `null` | Holds the numeric ID of the currently selected product. Used in `validateForm()` to check that a product has been chosen. |
| `selectedMachineId` | `number \| null` | `null` | Holds the numeric ID of the currently selected machine. Used in `validateForm()` to check that a machine has been chosen. |
| `operationId` | `number \| null` | `null` | Declared but not actively used in the current implementation. |
| `open` | `boolean` | `false` | Controls the `[open]` binding on the `ui5-dialog`. Set to `true` externally (by the parent) to open the dialog; set to `false` by `CloseDialog()` to close it. |
| `loading` | `boolean` | `false` | Drives the `[active]` binding on `ui5-busy-indicator` and the `[disabled]` state of the footer buttons. Set to `true` while API calls are in flight; set to `false` on completion or close. |
| `ToastType` | `'add' \| 'edit' \| 'error'` | `'add'` | Tracks which toast notification to display after the save operation completes. Set to `'add'` before POST calls and `'edit'` before PUT calls. |
| `validationMessage` | `string` | `Localization.requiredField` | The error text shown inside `valueStateMessage` slots on all form fields when validation fails. Resolves to the i18n string "This field is required." |
| `valueState` | `typeof ValueState` | `ValueState` (imported enum) | Public reference to the UI5 `ValueState` enum, used in template bindings via `[attr.value-state]`. |
| `responseType` | `saveMode` | `saveMode.POST` | Declared but not used beyond initialization in the current implementation. |
| `localization` | `typeof Localization` | `Localization` (static object) | Public reference to the localization utility, used in the template for translated labels and button text. |
| `productTitle` | `string` | `''` | Stores the display text (product name) of the currently selected product. Bound to the `[value]` attribute of the product combobox to show the selected item. |
| `machineTitle` | `string` | `''` | Stores the display text (machine name) of the currently selected machine. Bound to the `[value]` attribute of the machine combobox to show the selected item. |
| `valueStateOptions` | `{ operation_name: ValueState, product_selection: ValueState, machine_selection: ValueState }` | All `ValueState.None` | Per-field validation state object. Each key maps to the `[attr.value-state]` binding of its respective form control. Set to `ValueState.Negative` on validation failure and back to `ValueState.None` on valid input. |

---

## ViewChild / ViewChildren

None declared in this component.

---

## Lifecycle Hooks

### `ngOnInit(): void`
Executes immediately after component initialization. Calls two data-loading methods in sequence:
1. `this.getProducts()` — fetches all active products from the API to populate the product combobox.
2. `this.getMachines()` — fetches all active machines from the API to populate the machine combobox.

No `ngOnDestroy` or `ngAfterViewInit` hooks are present.

---

## Methods — DETAILED

### `saveOperationInfo(): void`
**Purpose:** Validates the form and, if valid, submits the operation position data to the API.

**Step-by-step logic:**
1. Calls `this.validateForm()`. If it returns `false`, the method returns early with no side effect — validation error states are already applied by `validateForm()`.
2. Sets `this.loading = true` to activate the busy indicator and disable footer buttons.
3. Declares `url` (string) and `request$` (Observable) as local variables.
4. **If `saveMode === 'POST'`:** Sets `url = 'OperationPositions'`, sets `this.ToastType = 'add'`, builds `request$` by calling `this.commonService.post(url, this.operationPosition.toOdata())`.
5. **If `saveMode === 'PUT'`:** Sets `url = 'OperationPositions(${this.operationPosition.id})'` (OData key syntax), sets `this.ToastType = 'edit'`, builds `request$` by calling `this.commonService.put(url, this.operationPosition.toOdata())`.
6. If `request$` is defined, subscribes to it:
   - **On success (`next`):** Calls `this.CloseDialog()` (closes dialog, resets form, sets `loading = false`), emits `this.RefreshTable`, calls `this.toastService.show(this.ToastType)` to display the appropriate success toast, then calls `this.cdr.detectChanges()`.
   - **On error:** Calls `this.CloseDialog()`, logs the error to the console, calls `this.toastService.show('error')` to display an error toast, then calls `this.cdr.detectChanges()`.

**Emits:** `RefreshTable` (on success only).

---

### `getProducts(): void`
**Purpose:** Fetches the list of active products from the API and stores them locally for the combobox.

**Step-by-step logic:**
1. Sets `this.loading = true`.
2. Calls `this.commonService.get('Products?$orderby=id desc&$filter=is_active eq true', true)` (OData query, ordered by id descending, filtered to active only).
3. On success (`next`): assigns `res.value` (OData collection array) to `this.products`, then sets `this.loading = false`.

No error handler is defined on this subscription.

---

### `SelctedProduct(data: any): void`
**Purpose:** Handles the `selection-change` event from the product `ui5-combobox` when the user selects an item from the dropdown list.

**Step-by-step logic:**
1. Reads `data.detail.item.id` and converts it to a number, storing it in `selectedId`.
2. Assigns `selectedId` to both `this.operationPosition.product_id` and `this.selectedProductId`.
3. Assigns `data.detail.item.text` to `this.productTitle` (used to display the selected value in the combobox).
4. Calls `this.checkValidation({ target: { value: this.productTitle } }, 'product')` to clear the validation error state for the product field.

---

### `getMachines(): void`
**Purpose:** Fetches the list of active machines from the API and stores them locally for the combobox.

**Step-by-step logic:**
1. Sets `this.loading = true`.
2. Calls `this.commonService.get('Machines?$orderby=id desc&$filter=is_active eq true', true)` (OData query, ordered by id descending, filtered to active only).
3. On success (`next`): assigns `res.value` to `this.machines`, then sets `this.loading = false`.

No error handler is defined on this subscription.

---

### `SelctedMachine(data: any): void`
**Purpose:** Handles the `selection-change` event from the machine `ui5-combobox` when the user selects an item from the dropdown list.

**Step-by-step logic:**
1. Reads `data.detail.item.id` and converts it to a number, storing it in `selectedId`.
2. Assigns `selectedId` to both `this.operationPosition.machine_id` and `this.selectedMachineId`.
3. Assigns `data.detail.item.text` to `this.machineTitle`.
4. Calls `this.checkValidation({ target: { value: this.machineTitle } }, 'machine')` to clear the validation error state for the machine field.

---

### `checkValidation(event: any, field: string): void`
**Purpose:** Real-time per-field validation triggered on `input` events and on programmatic selection updates. Updates the `valueStateOptions` object for the relevant field.

**Step-by-step logic:**
1. Extracts `value` from `event.target?.value ?? event.detail?.item?.id` — supports both native DOM input events and UI5 custom events.
2. Switches on `field`:
   - **`'name'`:** If `value` is empty or whitespace, sets `valueStateOptions.operation_name = ValueState.Negative`. Otherwise assigns `value` to `this.operationPosition.name` and sets `valueStateOptions.operation_name = ValueState.None`.
   - **`'product'`:** If `value` is empty or whitespace, sets `valueStateOptions.product_selection = ValueState.Negative`. Otherwise assigns `value` to `this.selectedProductId` and sets `valueStateOptions.product_selection = ValueState.None`. Note: this branch assigns the string title text to `selectedProductId` (not the numeric ID); the correct numeric ID is set separately by `SelctedProduct()`.
   - **`'machine'`:** If `value` is empty or whitespace, sets `valueStateOptions.machine_selection = ValueState.Negative`. Otherwise assigns `value` to `this.selectedMachineId` and sets `valueStateOptions.machine_selection = ValueState.None`. Same note as above applies.
3. Any other field name falls through `default` with no action.

**Important note on machine input event:** In the template, the machine combobox fires `(input)="checkValidation($event, 'Machine')"` (capital M), but the switch statement only handles lowercase `'machine'`. This means the machine field's real-time input validation via the `input` event does not match — only `SelctedMachine()` (which passes `'machine'` correctly) clears/sets the machine validation state on selection.

---

### `validateForm(): boolean`
**Purpose:** Full form validation run immediately before a save attempt. Checks all required fields and sets their visual error states.

**Step-by-step logic:**
1. Initializes `isValid = true`.
2. Checks `this.operationPosition.name?.trim()`:
   - Truthy: sets `valueStateOptions.operation_name = ValueState.None`.
   - Falsy: sets `valueStateOptions.operation_name = ValueState.Negative`, sets `isValid = false`.
3. Checks `this.selectedProductId`:
   - Truthy (non-null, non-zero): sets `valueStateOptions.product_selection = ValueState.None`.
   - Falsy: sets `valueStateOptions.product_selection = ValueState.Negative`, sets `isValid = false`.
4. Checks `this.selectedMachineId !== null && this.selectedMachineId !== 0` (explicitly excludes both null and 0):
   - True: sets `valueStateOptions.machine_selection = ValueState.None`.
   - False: sets `valueStateOptions.machine_selection = ValueState.Negative`, sets `isValid = false`.
5. Returns `isValid`.

---

### `getProduct(items: any): void`
**Purpose:** An alternative product selection handler. Deserializes the selected combobox item into a `Product` model instance and updates component state.

**Step-by-step logic:**
1. Creates a new `Product` using `new Product().deserialize({ id: items.detail.item.id, product_name: items.detail.item.text })`.
2. Assigns `this.product.id ?? null` to `this.selectedProductId`.
3. Assigns `items.detail.item.text` to `this.productTitle`.
4. Calls `this.checkValidation(items, 'product')`.

**Note:** This method is defined in the TypeScript class but is NOT referenced in the current template. The template uses `SelctedProduct()` instead. It appears to be dead code or a legacy handler.

---

### `getMachine(items: any): void`
**Purpose:** An alternative machine selection handler. Deserializes the selected combobox item into a `Machine` model instance and updates component state.

**Step-by-step logic:**
1. Creates a new `Machine` using `new Machine().deserialize({ id: items.detail.item.id, machine_name: items.detail.item.text })`.
2. Assigns `this.machine.id ?? null` to `this.selectedMachineId`.
3. Assigns `items.detail.item.text` to `this.machineTitle`.
4. Calls `this.checkValidation(items, 'machine')`.

**Note:** Like `getProduct()`, this method is NOT referenced in the current template. It is dead code or a legacy handler.

---

### `resetForm(): void`
**Purpose:** Resets all form state to initial/empty values. Called by `CloseDialog()`.

**Step-by-step logic:**
1. Replaces `this.operationPosition` with a fresh `new OperationPosition()` instance.
2. Replaces `this.product` with a fresh `new Product()` instance.
3. Replaces `this.machine` with a fresh `new Machine()` instance.
4. Sets `this.selectedProductId = null`.
5. Sets `this.selectedMachineId = null`.
6. Sets `this.productTitle = ''`.
7. Sets `this.machineTitle = ''`.
8. Resets `this.valueStateOptions` to all `ValueState.None`.

---

### `CloseDialog(): void`
**Purpose:** Closes the dialog and fully resets the component state.

**Step-by-step logic:**
1. Sets `this.open = false` — collapses the `ui5-dialog`.
2. Sets `this.loading = false` — deactivates the busy indicator.
3. Calls `this.resetForm()` — clears all form fields and validation states.

**Called by:** The `(before-close)` event on the dialog, the Cancel button's `(click)` event, and both success and error paths of `saveOperationInfo()`.

---

## Template Bindings & Structure

The template consists of a single `ui5-dialog` wrapping all content.

### `ui5-dialog`
- `class="ui5-xl-without-tab"` — applies extra-large dialog styling without a tab bar.
- `[open]="open"` — property binding; dialog is visible when `open === true`.
- `[attr.header-text]="saveMode === 'POST' ? localization.New : localization.Edit"` — dynamic title: "New" for create mode, "Edit" for update mode.
- `(before-close)="CloseDialog()"` — fires `CloseDialog()` before the dialog closes (e.g., on Escape key press).

### `ui5-busy-indicator` (wraps the form section)
- `[delay]="0"` — spinner appears immediately with no delay.
- `[active]="loading"` — spinner is shown whenever `loading === true` (during API calls).

### Active status toggle (`col-md-12` div)
- `ui5-label` displaying `localization.Active` with `show-colon`.
- `ui5-switch` with `[(ngModel)]="operationPosition.is_active"` — two-way binding; new records default to `true` (inherited from `OperationPosition` model defaults).

### Operation Position Name field (`mt-2` div)
- `ui5-label` with `required` attribute showing "Operation Position Name".
- `ui5-input` with:
  - `[(ngModel)]="operationPosition.name"` — two-way binding to the name field.
  - `(input)="checkValidation($event, 'name')"` — real-time validation on every keystroke.
  - `[attr.value-state]="valueStateOptions.operation_name"` — drives the visual error state.
  - `type="Text"`.
  - A `div[slot="valueStateMessage"]` showing `validationMessage` when value state is Negative.

### Select Product field (`mt-2` div)
- `ui5-label` with `required` attribute showing "Select Product".
- `ui5-combobox` with:
  - `(selection-change)="SelctedProduct($event)"` — fires when user picks an item from the dropdown.
  - `(input)="checkValidation($event, 'product')"` — fires on free-text typing in the combobox.
  - `[value]="productTitle ? productTitle : ''"` — reflects the currently selected product name.
  - `[attr.value-state]="valueStateOptions.product_selection"` — drives the visual error state.
  - `*ngFor="let product of products"` loop rendering `ui5-cb-item` elements with `[text]="product.product_name"` and `[id]="product.id"`.
  - A `div[slot="valueStateMessage"]` showing `validationMessage`.

### Select Machine field (`mt-2` div)
- `ui5-label` with `required` attribute showing "Select Machine".
- `ui5-combobox` with:
  - `(selection-change)="SelctedMachine($event)"` — fires when user picks an item from the dropdown.
  - `(input)="checkValidation($event, 'Machine')"` — fires on free-text typing; note the uppercase `'Machine'` argument does NOT match any case in the switch statement (see bug note in `checkValidation` method above).
  - `[value]="machineTitle ? machineTitle : ''"` — reflects the currently selected machine name.
  - `[attr.value-state]="valueStateOptions.machine_selection"` — drives the visual error state.
  - `*ngFor="let machine of machines"` loop rendering `ui5-cb-item` elements with `[text]="machine.machine_name"` and `[id]="machine.id"`.
  - A `div[slot="valueStateMessage"]` showing `validationMessage`.

### Footer (`ui5-toolbar[slot="footer"]`)
- **Submit button** (`ui5-toolbar-button`, design `Emphasized`):
  - `(click)="saveOperationInfo()"` — triggers save.
  - `[disabled]="loading"` — disabled during API calls.
  - `text="{{ localization.Submit }}"`.
- **Cancel button** (`ui5-toolbar-button`, design `Transparent`):
  - `(click)="CloseDialog()"` — closes and resets without saving.
  - `[disabled]="loading"` — disabled during API calls.
  - `text="{{ localization.Cancel }}"`.

---

## API Calls

| HTTP Method | Endpoint | When called | Payload / Query params | What happens with response |
|---|---|---|---|---|
| GET | `{lodataPrefix}/Products?$orderby=id desc&$filter=is_active eq true` | `ngOnInit` (via `getProducts()`) | None | `res.value` array assigned to `this.products`; `loading` set to `false` |
| GET | `{lodataPrefix}/Machines?$orderby=id desc&$filter=is_active eq true` | `ngOnInit` (via `getMachines()`) | None | `res.value` array assigned to `this.machines`; `loading` set to `false` |
| POST | `{lodataPrefix}/OperationPositions` | `saveOperationInfo()` when `saveMode === 'POST'` | `this.operationPosition.toOdata()` (excludes `operation_name`, `products`, `machines`, `created_at`, `updated_at`) | Dialog closed, table refreshed, 'add' toast shown |
| PUT | `{lodataPrefix}/OperationPositions({id})` | `saveOperationInfo()` when `saveMode === 'PUT'` | `this.operationPosition.toOdata()` | Dialog closed, table refreshed, 'edit' toast shown |

All calls go through `CommonService` using the `isLodata = true` (default) prefix, meaning they target the OData endpoint.

---

## Validation Logic

| Field | Rule | State on failure | State on pass |
|---|---|---|---|
| Operation Position Name | Must be non-empty and non-whitespace (`name?.trim()` is truthy) | `valueStateOptions.operation_name = ValueState.Negative` | `valueStateOptions.operation_name = ValueState.None` |
| Product selection | `selectedProductId` must be truthy (non-null, non-zero, non-undefined) | `valueStateOptions.product_selection = ValueState.Negative` | `valueStateOptions.product_selection = ValueState.None` |
| Machine selection | `selectedMachineId !== null && selectedMachineId !== 0` | `valueStateOptions.machine_selection = ValueState.Negative` | `valueStateOptions.machine_selection = ValueState.None` |

Validation is applied in two ways:
- **Real-time** (on `input` events): via `checkValidation()` — updates only the field currently being interacted with.
- **On save** (full-form check): via `validateForm()` — checks all three fields at once before the API call proceeds.

When any field has `ValueState.Negative`, its `ui5-input` or `ui5-combobox` renders in red/error style and displays `validationMessage` ("This field is required.") in its value state message slot.

---

## Services Injected

| Service | Why injected | Methods used |
|---|---|---|
| `CommonService` | Generic HTTP service used for all API communication | `get(url, isLodata)` — fetches product and machine lists; `post(url, body)` — creates a new operation position; `put(url, body)` — updates an existing operation position |
| `ToastService` | Displays feedback notifications to the user | `show(type: ToastType)` — called with `'add'`, `'edit'`, or `'error'` after save completes or fails |
| `ChangeDetectorRef` | Forces Angular change detection after async operations return | `detectChanges()` — called in both the success and error callbacks of `saveOperationInfo()` to ensure the UI reflects the updated state |

---

## Inter-component Communication

### With Parent Component
- **Input `saveMode`:** The parent sets this to `'POST'` for create mode or `'PUT'` for edit mode before opening the dialog.
- **`open` property:** The parent sets `component.open = true` (via a ViewChild reference) to open the dialog. The component manages closing internally via `CloseDialog()`.
- **`operationPosition`:** When in edit mode, the parent is expected to populate `component.operationPosition` with the existing record data (including `id`) before opening the dialog, so the PUT request targets the correct record.
- **Output `RefreshTable`:** Emitted (with no payload) after a successful save. The parent listens to this event and reloads its data table.

### With Child Components
None — all UI controls are UI5 Web Components, not custom Angular child components.

---

## Enums / Models Used

### `saveMode` (enum)
File: `src/app/shared/enums/saveMode.ts`

| Value | String |
|---|---|
| `saveMode.GET` | `'GET'` |
| `saveMode.POST` | `'POST'` |
| `saveMode.PUT` | `'PUT'` |
| `saveMode.PATCH` | `'PATCH'` |
| `saveMode.DELETE` | `'DELETE'` |
| `saveMode.REQUEST` | `'REQUEST'` |

Used in this component: `POST` (create) and `PUT` (update).

### `ValueState` (UI5 enum)
File: `src/app/shared/utilities/value-state-wrapper.ts` (re-exports from `@ui5/webcomponents-base/dist/types/ValueState.js`)

Relevant values used: `ValueState.None` (default/no error) and `ValueState.Negative` (error/invalid state).

### `OperationPosition` (model class)
File: `src/app/shared/model/oparationPosition.ts`

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | `number?` | — | Set by the server; used in PUT URL |
| `is_active` | `boolean?` | `true` | Bound to the active toggle switch |
| `custom_id` | `string?` | — | Server-generated |
| `name` | `string` | `''` | Required; bound to the name input |
| `operation_id` | `number?` | — | Not set in this form |
| `product_id` | `number?` | — | Set by product selection |
| `machine_id` | `number?` | — | Set by machine selection |
| `created_at` | `string?` | — | Excluded from `toOdata()` payload |
| `updated_at` | `string?` | — | Excluded from `toOdata()` payload |
| `products` | `Product[]?` | — | Excluded from `toOdata()` payload |
| `machines` | `Machine[]?` | — | Excluded from `toOdata()` payload |

`toOdata()` spreads all properties then explicitly sets `operation_name`, `products`, `machines`, `created_at`, and `updated_at` to `undefined` so they are omitted from the serialized JSON sent to the API.

### `Product` (model class)
File: `src/app/shared/model/product.ts`

Key fields used in this component: `id` (numeric identifier), `product_name` (display text rendered in `ui5-cb-item`), `is_active` (filtered by API query).

### `Machine` (model class)
File: `src/app/shared/model/machine.ts`

Key fields used in this component: `id` (numeric identifier), `machine_name` (display text rendered in `ui5-cb-item`), `is_active` (filtered by API query).

### `Localization` (static utility object)
File: `src/app/shared/utilities/localization.ts`

Keys used in this component:

| Key | i18n value |
|---|---|
| `Localization.Active` | "Active" |
| `Localization.New` | "New" |
| `Localization.Edit` | "Edit" |
| `Localization.Submit` | "Submit" |
| `Localization.Cancel` | "Cancel" |
| `Localization.requiredField` | "This field is required." |

---

## Key Business Logic

### Dialog open/close lifecycle
The `open` property is the single gate for dialog visibility. The parent opens the dialog by setting `open = true` on the component instance. The dialog's `(before-close)` event and the Cancel button both call `CloseDialog()`, which sets `open = false` and runs `resetForm()`. This ensures state does not bleed between successive form opens.

### Edit mode pre-population
When `saveMode === 'PUT'`, the parent is responsible for pre-populating `operationPosition` (with the full record including `id`), `selectedProductId`, `selectedMachineId`, `productTitle`, and `machineTitle` before setting `open = true`. The component itself does not contain any logic to fetch or populate the form from an existing record ID — this is entirely the parent's responsibility.

### OData payload cleanup via `toOdata()`
`OperationPosition.toOdata()` uses object spread (`...this`) and then sets non-API fields to `undefined`. Because `JSON.stringify` omits `undefined` values, this cleanly removes relational/computed fields from the request body without requiring manual field-by-field construction.

### Dual validation triggers
The name field has true real-time validation because its `(input)` event passes `'name'` which matches the switch case correctly. The product and machine comboboxes rely on `selection-change` (item picked from list) for correct state update; the `(input)` event on the machine combobox passes `'Machine'` (capital M) which does not match any switch case, making real-time "clear error on type" non-functional for the machine field during free-text input.

### `loading` flag dual purpose
`this.loading` is set to `true` both in `getProducts()` and `getMachines()` (data loading), and again at the start of `saveOperationInfo()` (save operation). Since both `getProducts()` and `getMachines()` set it back to `false` on completion and there is no coordination between them, the last one to complete wins. If both resolve before the user interacts, `loading` will be `false` as expected. The form save independently re-sets `loading = true` and resets it to `false` via `CloseDialog()`.

### Machine validation edge case
`validateForm()` checks `selectedMachineId !== null && selectedMachineId !== 0`, explicitly treating `0` as invalid. This protects against API responses that might return an id of `0` for an unresolved or default machine record.
