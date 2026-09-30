# OPERATION_FORM_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| **TypeScript file** | `src/app/modules/base-data-management/oparation-management/operation-management-form/operation-management-form.component.tsx` |
| **Template file** | `src/app/modules/base-data-management/oparation-management/operation-management-form/operation-management-form.component.html` |
| **Style file** | `operation-management-form.component.scss` |
| **Selector** | `app-operation-management-form` |
| **Component type** | Form / Dialog |

**Purpose:** This component renders a modal dialog (SAP UI5 `ui5-dialog`) for creating and editing manufacturing Operations. It manages its own open/close state via a public `open` boolean property that the parent (`OparationManagementListComponent`) directly manipulates through a `@ViewChild` reference. On submission it calls either a POST or PUT OData endpoint and emits a `RefreshTable` event to instruct the parent to reload its data grid. It also loads the active Products list on initialization to populate a combobox for product selection.

---

## Inputs (@Input)

| Input name | Type | Default | Purpose |
|---|---|---|---|
| `saveMode` | `string` | `"POST"` | Controls whether a save triggers a POST (create) or PUT (update) request. Set externally by the parent via `@ViewChild` before opening the dialog. Compared against the `saveMode` enum values (`saveMode.POST`, `saveMode.PUT`). |
| `operations` | `Operation` | `new Operation()` | The data model being created or edited. Populated by the parent via `@ViewChild` before opening the dialog. Bound two-way to all form fields. |

---

## Outputs (@Output)

| Output name | Emitted type | Purpose |
|---|---|---|
| `RefreshTable` | `EventEmitter<any>` | Emitted with no payload after a successful POST or PUT response. Instructs the parent list component to re-fetch and re-render the operations table. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `open` | `boolean` | `false` | Controls the open state of the `ui5-dialog`. Toggled directly by the parent via `@ViewChild`, and set to `false` by `CloseDialog()`. |
| `loading` | `boolean` | `false` | When `true`, activates the `ui5-busy-indicator` spinner and disables the toolbar buttons. Set to `true` before HTTP calls and reset to `false` in `CloseDialog()` or after `getProducts()` resolves. |
| `ToastType` | `"add" \| "edit" \| "error"` | `"add"` | Tracks which toast message to show after the save operation resolves. Set to `"add"` before POST and `"edit"` before PUT. |
| `validationMessage` | `string` | `Localization.requiredField` (`"This field is required."`) | The i18n string displayed in each field's `valueStateMessage` slot when validation fails. |
| `valueState` | `typeof ValueState` | `ValueState` (re-exported from `@ui5/webcomponents-base`) | Reference to the `ValueState` enum used directly in the template for comparison purposes. |
| `responseType` | `saveMode` | `saveMode.POST` | Declared but not used beyond declaration in this component. Appears to be a vestigial property. |
| `localization` | `typeof Localization` | `Localization` | Reference to the global Localization constant object, exposed to the template for i18n string access (e.g., `localization.New`, `localization.Edit`, `localization.Submit`, `localization.Cancel`, `localization.Active`). |
| `productTitle` | `string` | `""` | The display text shown in the product combobox. Set from the selected combobox item's `text` property, or from the existing product name when editing. Reset to `""` in `CloseDialog()`. |
| `valueStateOptions` | `{ operation_name: ValueState, standard_cycle_time: ValueState, product_selection: ValueState }` | All `ValueState.None` | Per-field validation state object. Each key is bound to the `[attr.value-state]` attribute of its corresponding UI5 input. `ValueState.Negative` causes the field to show red error styling; `ValueState.None` clears it. |
| `products` | `Product[]` | `[]` | The list of active products fetched from the API on init. Used to populate the `ui5-combobox` items. |

---

## ViewChild / ViewChildren

This component does **not** declare any `@ViewChild` or `@ViewChildren` references internally.

However, the **parent** `OparationManagementListComponent` declares `@ViewChild("operationForm") operationFormRef!: OperationManagementFormComponent` and directly accesses the following public properties on this component instance:
- `operationFormRef.open` — set to `true` to open the dialog
- `operationFormRef.saveMode` — set to `saveMode.POST` or `saveMode.PUT`
- `operationFormRef.operations` — called `.deserialize(data)` to pre-populate edit data or reset for new
- `operationFormRef.productTitle` — set to the existing product name when editing, or `""` for new

---

## Lifecycle Hooks

### `ngOnInit()`
- **Called once** after the component is initialized.
- Calls `this.getProducts()` to fetch the active product list from the API.
- No other initialization logic.

No `ngOnDestroy`, `ngAfterViewInit`, or other lifecycle hooks are implemented.

---

## Methods — DETAILED

### `ngOnInit(): void`
- **Signature:** `ngOnInit()`
- **Logic:** Immediately calls `this.getProducts()`.
- **Side effects:** Triggers an HTTP GET request; sets `loading = true` then `loading = false` on response.

---

### `saveOperation(): void`
- **Signature:** `saveOperation()`
- **Step-by-step logic:**
  1. Calls `this.validateForm()`. If it returns `false`, the method returns early — no HTTP call is made.
  2. Sets `this.loading = true`.
  3. Determines the HTTP operation based on `this.saveMode`:
     - If `saveMode === saveMode.POST` (`"POST"`): sets `url = "Operations"`, sets `this.ToastType = "add"`, creates `request$` by calling `this.commonService.post(url, this.operations.toOdata(), true)`.
     - If `saveMode === saveMode.PUT` (`"PUT"`): sets `url = "Operations(${this.operations.id})"` (OData key pattern), sets `this.ToastType = "edit"`, creates `request$` by calling `this.commonService.put(url, this.operations.toOdata(), true)`.
  4. If `request$` is defined, subscribes to it:
     - **On success (`next`):** calls `this.CloseDialog()`, emits `this.RefreshTable.emit()`, calls `this.toastService.show(this.ToastType)` with `"add"` or `"edit"`.
     - **On error:** calls `this.CloseDialog()`, calls `this.toastService.show("error")`.
- **Returns:** `void`
- **Note:** `loading` is reset to `false` inside `CloseDialog()`, not directly in the success/error handler.

---

### `checkValidation(event: any, field: string): void`
- **Signature:** `checkValidation(event: any, field: string)`
- **Step-by-step logic:** Real-time per-field validation triggered on the `(input)` event of each field.
  1. Extracts `value` from `event.target.value`; defaults to `""` if falsy.
  2. Switches on `field`:
     - **`"name"`:** If `value.trim()` is empty → sets `valueStateOptions.operation_name = ValueState.Negative`. Else → sets `operations.operation_name = value` and `valueStateOptions.operation_name = ValueState.None`.
     - **`"cycle"`:** If `value.trim()` is empty → sets `valueStateOptions.standard_cycle_time = ValueState.Negative`. Else → sets `operations.standard_cycle_time = value` and `valueStateOptions.standard_cycle_time = ValueState.None`.
     - **`"product"`:** If `value.trim()` is empty → sets `valueStateOptions.product_selection = ValueState.Negative`. Else → sets `valueStateOptions.product_selection = ValueState.None`. Note: unlike `"name"` and `"cycle"`, this case does **not** update `operations.item_id` — that is handled exclusively by `SelctedProduct()`.
     - **`default`:** No action (break).
- **Returns:** `void`

---

### `validateForm(): boolean`
- **Signature:** `validateForm(): boolean`
- **Step-by-step logic:** Full-form validation run before save. Checks all three required fields and sets their individual `valueStateOptions` accordingly.
  1. Initializes `isValid = true`.
  2. **Operation Name:** If `operations.operation_name?.trim()` is truthy → `valueStateOptions.operation_name = ValueState.None`. Else → `ValueState.Negative` and `isValid = false`.
  3. **Standard Cycle Time:** If `operations.standard_cycle_time !== null && !== undefined` → `ValueState.None`. Else → `ValueState.Negative` and `isValid = false`. Note: this check permits `0` as a valid value (falsy but not null/undefined).
  4. **Product:** If `operations.item_id` is truthy → `ValueState.None`. Else → `ValueState.Negative` and `isValid = false`.
  5. Returns `isValid`.
- **Returns:** `boolean` — `true` if all validations pass, `false` if any fail.

---

### `SelctedProduct(data: any): void`
- **Signature:** `SelctedProduct(data: any)`
- **Step-by-step logic:** Handler for the `(selection-change)` custom event emitted by `ui5-combobox`.
  1. Sets `this.operations.item_id = data.detail.item.id` — captures the numeric ID of the selected product, stored in the `ui5-cb-item`'s `[id]` binding.
  2. Sets `this.productTitle = data.detail.item.text` — captures the display text of the selected product for the combobox's `[value]` binding.
  3. Calls `this.checkValidation({ target: { value: this.productTitle } }, "product")` to clear any product validation error.
- **Returns:** `void`
- **Note:** The `data.detail.item` object is the selected `ui5-cb-item` custom element. The `id` attribute on `ui5-cb-item` is bound to `product.id`; the `text` attribute is bound to `product.product_name`.

---

### `getProducts(): void`
- **Signature:** `getProducts()`
- **Step-by-step logic:**
  1. Sets `this.loading = true`.
  2. Constructs URL: `"Products?$orderby=id desc&$filter=is_active eq true"` — fetches only active products, ordered newest first.
  3. Calls `this.commonService.get(url, true)` (OData endpoint).
  4. Subscribes to the observable:
     - **On success:** sets `this.products = res.value` (OData response wraps array in a `value` property), sets `this.loading = false`.
     - **No error handler defined** — HTTP errors are silently ignored.
- **Returns:** `void`

---

### `resetForm(): void`
- **Signature:** `resetForm()`
- **Step-by-step logic:**
  1. Replaces `this.operations` with a fresh `new Operation().deserialize({})` — resets all operation model fields to their class defaults.
  2. Resets all three `valueStateOptions` to `ValueState.None` — clears any validation error indicators.
- **Returns:** `void`

---

### `CloseDialog(): void`
- **Signature:** `CloseDialog()`
- **Step-by-step logic:**
  1. Sets `this.open = false` — closes the `ui5-dialog`.
  2. Sets `this.loading = false` — clears the busy indicator.
  3. Calls `this.resetForm()` — clears the form model and validation states.
  4. Sets `this.productTitle = ""` — clears the combobox display value.
- **Returns:** `void`
- **Triggered by:** `(before-close)` event on the dialog (user presses Escape or clicks backdrop), the Cancel button `(click)` handler, and programmatically from `saveOperation()` after the HTTP response (both success and error paths).

---

## Template Bindings & Structure

The template is a single `ui5-dialog` element wrapping all content.

```
ui5-dialog [open]="open" [attr.header-text]="..."  (before-close)="CloseDialog()"
  └─ ui5-busy-indicator [active]="loading" [delay]="0" size="M"
       └─ section.w-full
            ├─ div                                      — Active toggle row
            │    ├─ ui5-label                           — "Active" label (localization.Active)
            │    └─ ui5-switch [(ngModel)]="operations.is_active"
            │
            ├─ div.d-flex.mt-2.gap-1.w-full            — Operation Name row
            │    └─ div.flex.flex-col.w-full
            │         ├─ ui5-label required             — "Operation Name" (i18n hardcoded)
            │         └─ ui5-input
            │              ├─ [(ngModel)]="operations.operation_name"
            │              ├─ (input)="checkValidation($event, 'name')"
            │              ├─ [attr.value-state]="valueStateOptions.operation_name"
            │              └─ slot[valueStateMessage]   — {{ validationMessage }}
            │
            ├─ ui5-label required                       — "Target Cycle Time" (i18n hardcoded)
            ├─ ui5-input type="Number"
            │    ├─ [(ngModel)]="operations.standard_cycle_time"
            │    ├─ (input)="checkValidation($event, 'cycle')"
            │    ├─ [attr.value-state]="valueStateOptions.standard_cycle_time"
            │    └─ slot[valueStateMessage]             — {{ validationMessage }}
            │
            ├─ ui5-label required                       — "Select Product" (i18n hardcoded)
            └─ ui5-combobox
                 ├─ (selection-change)="SelctedProduct($event)"
                 ├─ (input)="checkValidation($event, 'product')"
                 ├─ [value]="productTitle ? productTitle : ''"
                 ├─ [attr.value-state]="valueStateOptions.product_selection"
                 ├─ *ngFor ui5-cb-item — iterates products[]
                 │    ├─ [text]="product.product_name"
                 │    └─ [id]="product.id"
                 └─ slot[valueStateMessage]             — {{ validationMessage }}

  └─ ui5-toolbar slot="footer"
       ├─ ui5-toolbar-button design="Emphasized"
       │    ├─ (click)="saveOperation()"
       │    ├─ [disabled]="loading"
       │    └─ text="{{ localization.Submit }}"
       └─ ui5-toolbar-button design="Transparent"
            ├─ (click)="CloseDialog()"
            ├─ [disabled]="loading"
            └─ text="{{ localization.Cancel }}"
```

**Key bindings:**
- The dialog header text is conditionally `localization.New` when `saveMode === 'POST'` or `localization.Edit` otherwise.
- The busy indicator wraps all form fields. When `loading` is `true`, all inputs are covered by the spinner and the footer buttons are disabled via `[disabled]="loading"`.
- `ui5-switch` uses `[(ngModel)]` two-way binding directly to `operations.is_active` — no validation applied to this field.
- `ui5-input` for Operation Name uses `type="Text"`; for Cycle Time uses `type="Number"`.
- The product combobox uses `[value]` (one-way) rather than `[(ngModel)]` because its selection is managed via the `(selection-change)` event and the `productTitle` string — not directly through `ngModel` on the `item_id`.
- Note: the dialog has a duplicate `class` attribute on the `ui5-busy-indicator` (`class="w-full"` appears twice) — the second `class="w-100"` overwrites the first in DOM rendering.

---

## API Calls

| HTTP Method | Endpoint (relative) | When called | Payload / Query params | What happens with response |
|---|---|---|---|---|
| GET | `odata/Products?$orderby=id desc&$filter=is_active eq true` | `ngOnInit()` → `getProducts()` | None | Response `res.value` (array) is assigned to `this.products`; `loading` set to `false`. No error handler. |
| POST | `odata/Operations` | `saveOperation()` when `saveMode === "POST"` | `operations.toOdata()` — full Operation object minus `products`, `created_at`, `updated_at` fields | On success: dialog closed, `RefreshTable` emitted, toast `"add"` shown. On error: dialog closed, toast `"error"` shown. |
| PUT | `odata/Operations({id})` | `saveOperation()` when `saveMode === "PUT"` | `operations.toOdata()` — same as POST payload | On success: dialog closed, `RefreshTable` emitted, toast `"edit"` shown. On error: dialog closed, toast `"error"` shown. |

**URL resolution:** All calls go through `CommonService` with `isLodata = true`, which prefixes the URL with `environment.ServerApi + '/odata'`.

---

## Validation Logic

Validation runs in two modes: real-time (on each input event) and full-form (on save attempt).

| Field | HTML element | Validation rule | State set on failure | State set on success |
|---|---|---|---|---|
| Operation Name (`operation_name`) | `ui5-input type="Text"` | Must be non-empty after `.trim()`. Checked in both `checkValidation('name')` and `validateForm()`. | `valueStateOptions.operation_name = ValueState.Negative` | `valueStateOptions.operation_name = ValueState.None` |
| Target Cycle Time (`standard_cycle_time`) | `ui5-input type="Number"` | Must not be `null` or `undefined`. `checkValidation('cycle')` additionally requires non-empty string after trim. `validateForm()` allows `0`. | `valueStateOptions.standard_cycle_time = ValueState.Negative` | `valueStateOptions.standard_cycle_time = ValueState.None` |
| Select Product (`item_id`) | `ui5-combobox` | `operations.item_id` must be truthy (non-null, non-undefined, non-zero). Set via `SelctedProduct()` on combobox selection. `checkValidation('product')` validates the display text value. | `valueStateOptions.product_selection = ValueState.Negative` | `valueStateOptions.product_selection = ValueState.None` |
| Active (`is_active`) | `ui5-switch` | No validation — optional toggle. | — | — |

**Behavioral note:** There is a subtle inconsistency in the cycle time validation. `checkValidation('cycle')` checks if the raw string input is empty after trim, while `validateForm()` checks if `operations.standard_cycle_time !== null && !== undefined`. If the user types `0`, `validateForm()` passes (0 is not null/undefined), but if the user clears the field after typing, `checkValidation` sets Negative while `validateForm` might still pass if the model still holds a previous value.

---

## Services Injected

| Service | Why injected | Methods used |
|---|---|---|
| `CommonService` | Central HTTP abstraction for OData API calls | `.get(url, isLodata)` — fetches product list; `.post(url, body, isLodata)` — creates operation; `.put(url, body, isLodata)` — updates operation |
| `ToastService` | Displays global success/error notification toasts | `.show(type: ToastType)` — called with `"add"`, `"edit"`, or `"error"` |

Both services are `providedIn: 'root'` singletons injected via the constructor.

---

## Inter-component Communication

### With parent: `OparationManagementListComponent`

The parent holds a `@ViewChild("operationForm") operationFormRef` reference to this component and directly mutates its public properties to drive the dialog:

**Opening for New:**
```typescript
// Parent calls:
this.operationFormRef.operations.deserialize({});
this.operationFormRef.open = true;
this.operationFormRef.saveMode = saveMode.POST;
this.operationFormRef.productTitle = "";
```

**Opening for Edit:**
```typescript
// Parent calls:
this.operationFormRef.operations.deserialize(data);  // data from table row
this.operationFormRef.productTitle = data.products?.product_name ?? "";
this.operationFormRef.open = true;
this.operationFormRef.saveMode = saveMode.PUT;
```

**After save:** This component emits `RefreshTable` (no payload) which the parent listens to via `(RefreshTable)="..."` to trigger a data reload of the operations table.

**Dialog close by user:** The `(before-close)` event on `ui5-dialog` calls `CloseDialog()` — this fires when the user presses Escape or clicks a close button on the dialog chrome.

---

## Enums / Models Used

### `Operation` model (`src/app/shared/model/operation.ts`)

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | `number \| undefined` | `undefined` | Used in PUT URL: `Operations(${id})` |
| `is_active` | `boolean \| undefined` | `true` | Bound to `ui5-switch` |
| `custom_id` | `string \| undefined` | `undefined` | Read-only; not in form |
| `operation_name` | `string` | `""` | Required; bound to name input |
| `standard_cycle_time` | `number \| undefined` | `undefined` | Required; bound to cycle time input |
| `item_id` | `number \| undefined` | `undefined` | Required; set by combobox selection |
| `created_at` | `string \| undefined` | `undefined` | Excluded from `toOdata()` output |
| `updated_at` | `string \| undefined` | `undefined` | Excluded from `toOdata()` output |
| `products` | `Product[] \| undefined` | `undefined` | Expanded relation; excluded from `toOdata()` output |

`Operation.toOdata()` strips `products`, `created_at`, and `updated_at` before sending to the API.
`Operation.deserialize(input)` uses `Object.assign(this, input)` to shallow-copy all properties from the input object.

### `Product` model (`src/app/shared/model/product.ts`)

Used only for the `products: Product[]` array that populates the combobox. Relevant fields used in the template:
- `product.id` — bound to `[id]` on `ui5-cb-item`
- `product.product_name` — bound to `[text]` on `ui5-cb-item`

### `saveMode` enum (`src/app/shared/enums/saveMode.ts`)

```typescript
enum saveMode {
  GET    = 'GET',
  POST   = 'POST',
  PUT    = 'PUT',
  PATCH  = 'PATCH',
  DELETE = 'DELETE',
  REQUEST = 'REQUEST'
}
```

Only `POST` and `PUT` are relevant to this component. The component's `@Input() saveMode` property is typed as `string` but compared against the enum string values.

### `ValueState` (`@ui5/webcomponents-base/dist/types/ValueState.js`)

Re-exported via `src/app/shared/utilities/value-state-wrapper.ts`. Used values:
- `ValueState.None` — default, no validation styling
- `ValueState.Negative` — red error state on UI5 inputs

### `Localization` constant (`src/app/shared/utilities/localization.ts`)

i18n string map. Keys used in this component:
- `Localization.requiredField` → `"This field is required."`
- `Localization.New` → `"New"` — dialog header for POST mode
- `Localization.Edit` → `"Edit"` — dialog header for PUT mode
- `Localization.Submit` → `"Submit"` — save button label
- `Localization.Cancel` → `"Cancel"` — cancel button label
- `Localization.Active` → `"Active"` — label for the is_active switch

### `ToastType` (from `ToastService`)

```typescript
type ToastType = 'save' | 'add' | 'edit' | 'delete' | 'remove' | 'read' | 'approve' | 'import' | 'export' | 'password' | 'download' | 'error' | 'exist';
```

This component uses `"add"`, `"edit"`, and `"error"`.

---

## Key Business Logic

### Dialog open/close pattern
This component does **not** open itself. The `open` property is a plain `boolean` field (not `@Input`) that the parent sets directly via `@ViewChild`. This is an imperative pattern rather than Angular's declarative `@Input`-driven approach. The `(before-close)` event on `ui5-dialog` catches native close actions (Escape key, dialog X button) and routes them through `CloseDialog()`.

### `toOdata()` serialization
Before any POST or PUT, `operations.toOdata()` is called. This method returns a spread of all Operation properties with `products`, `created_at`, and `updated_at` explicitly set to `undefined` — which causes JSON serialization to omit these fields. This prevents sending read-only or relational fields to the write API.

### Product combobox vs. ngModel
The product field does not use `[(ngModel)]` two-way binding. Instead, the combobox `[value]` is bound one-way to `productTitle` (a display string), and the actual foreign key `operations.item_id` is set imperatively inside `SelctedProduct()`. The typed input value in the combobox (partial text) triggers `checkValidation('product')` which only validates the display text is non-empty, but does NOT update `item_id` — only a full `selection-change` event does that. This means a user could type a product name manually without selecting from the dropdown, and the form would show a green validation state for the combobox field while `operations.item_id` remains `undefined`, causing `validateForm()` to ultimately block the save.

### `loading` flag dual purpose
The `loading` flag serves two simultaneous purposes: (1) it activates the `ui5-busy-indicator` overlay on the form content, and (2) it disables both footer buttons. During `getProducts()`, the entire dialog content area is overlaid by the spinner even before the user has opened the dialog (since `ngOnInit` triggers immediately).

### Error handling gap in `getProducts()`
The `getProducts()` subscription has no `error` handler. If the Products API call fails, `loading` remains `true` indefinitely, locking the form in a perpetual loading state.

### `resetForm()` replaces the entire object
`resetForm()` calls `new Operation().deserialize({})`, which creates a brand-new `Operation` instance and calls `deserialize` with an empty object. Since `deserialize` uses `Object.assign(this, input)` and the input is `{}`, no properties are overwritten — the new `Operation` instance retains all constructor defaults (`operation_name: ""`, `is_active: true`, etc.). This is a clean reset strategy.

### `saveMode` type mismatch
The `@Input() saveMode` is typed as `string` with a default of `"POST"`, while the comparison in `saveOperation()` uses `saveMode.POST` and `saveMode.PUT` from the `saveMode` enum (which resolves to the strings `"POST"` and `"PUT"` at runtime). The class also declares `public responseType: saveMode = saveMode.POST` which is never used. The parent sets `operationFormRef.saveMode = saveMode.POST` (the enum value), so runtime behavior is correct despite the loose typing.
