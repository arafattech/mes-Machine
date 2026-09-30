# CATEGORY_FORM_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| TypeScript file | `src/app/modules/base-data-management/product-management/item-category/category-form/category-form.component.ts` |
| Template file | `src/app/modules/base-data-management/product-management/item-category/category-form/category-form.component.html` |
| Selector | `app-category-form` |
| Component type | Form / Dialog |
| Purpose | Renders a UI5 modal dialog that allows a user to create a new item category (POST) or edit an existing one (PUT). The dialog collects a category name, an optional prefix, and an active/inactive toggle. On submission it validates inputs, calls the API, emits events to notify the parent, shows a toast notification, and closes itself. |

---

## Inputs (@Input)

| Input name | Type | Default | Purpose |
|---|---|---|---|
| `saveMode` | `string` | `'POST'` | Determines whether the form performs a create (`'POST'`) or update (`'PUT'`) operation. Compared at runtime against the `saveMode` enum values. |
| `itemCategory` | `ItemCategory` | `new ItemCategory().deserialize({})` | The data object that is bound to the form fields. For create mode, this is a freshly initialised empty `ItemCategory`. For edit mode, the parent passes the existing category record. |

---

## Outputs (@Output)

| Output name | Emit type | Purpose |
|---|---|---|
| `RefreshTable` | `any` | Emitted after a successful save (create or update) to instruct the parent to reload the category list / table. |
| `CatAdded` | `ItemCategory` | Emitted after a successful save, carrying the deserialised API response as a new `ItemCategory` instance. Used by the parent to immediately reflect the saved record without waiting for the table refresh. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `open` | `boolean` | `false` | Controls the `[open]` binding on the `<ui5-dialog>`. Set to `true` externally (by the parent) to show the dialog; set to `false` by `CloseDialog()` to hide it. |
| `loading` | `boolean` | `false` | Drives the `<ui5-busy-indicator>` `[active]` binding and the `[disabled]` state on both toolbar buttons. Set to `true` when an API call begins, and reset to `false` in `CloseDialog()`. |
| `ToastType` | `'add' \| 'edit' \| 'error'` | `'add'` | Tracks which toast notification variant to show. Set to `'add'` for POST success, `'edit'` for PUT success, and passed as `'error'` directly to `toastService.show()` on failure. |
| `validationMessage` | `string` | `Localization.requiredField` | The message text shown inside the `valueStateMessage` slot of the name input when validation fails. Sourced from the shared `Localization` constant (`"This field is required."`). |
| `valueState` | `typeof ValueState` | `ValueState` (class ref) | A reference to the UI5 `ValueState` enum, exposed to the template so it can be used in bindings. |
| `responseType` | `saveMode` | `saveMode.POST` | Declared but not actively mutated or read after initialisation in the current implementation. Present as a class property for potential future use. |
| `localization` | `typeof Localization` | `Localization` (object ref) | The shared localisation constant object, exposed to the template for i18n label rendering. |
| `valueStateOptions` | `{ name: ValueState }` | `{ name: ValueState.None }` | Holds the live validation state for each form field. Currently only tracks the `name` field. Bound to `[attr.value-state]` on the name input. `ValueState.None` = no error; `ValueState.Negative` = error/invalid. |

---

## ViewChild / ViewChildren

None. The component does not declare any `@ViewChild` or `@ViewChildren` references.

---

## Lifecycle Hooks

| Hook | Body | Purpose |
|---|---|---|
| `ngOnInit()` | Empty | Declared but contains no logic. The component relies entirely on `@Input` bindings being set before the dialog is opened. |

---

## Methods — DETAILED

### `AddItemCategory()`

**Signature:** `AddItemCategory(): void`

**Step-by-step logic:**

1. Calls `validateForm()`. If it returns `false`, the method returns immediately — no API call is made.
2. Sets `this.loading = true` to activate the busy indicator and disable the toolbar buttons.
3. Declares a local `url` string and a `request$` observable (initially `undefined`).
4. **Branch: POST mode** (`this.saveMode === saveMode.POST`):
   - Sets `url = 'ItemCategories'`.
   - Sets `this.ToastType = 'add'`.
   - Calls `this.commonService.post(url, this.itemCategory.toOdata(), true)` to build the POST observable (prefixed with the lodata base URL, JSON content type, Bearer auth).
5. **Branch: PUT mode** (`this.saveMode === saveMode.PUT`):
   - Sets `url = 'ItemCategories(${this.itemCategory.id})'` — OData key-predicate style URL.
   - Sets `this.ToastType = 'edit'`.
   - Calls `this.commonService.put(url, this.itemCategory.toOdata(), true)` to build the PUT observable.
6. If `request$` is defined, subscribes to it:
   - **`next` handler:** Deserialises the raw response into `new ItemCategory()`, emits it via `CatAdded`, calls `CloseDialog()`, emits `RefreshTable`, and calls `toastService.show(this.ToastType)` (`'add'` or `'edit'`).
   - **`error` handler:** Sets `this.open = false`, calls `CloseDialog()`, and calls `toastService.show('error')`.

**Side effects:** Mutates `loading`, `ToastType`, `open`. Emits `CatAdded` and `RefreshTable`. Shows a toast.

---

### `checkValidation(event: any)`

**Signature:** `checkValidation(event: any): void`

**Step-by-step logic:**

1. Reads `event.target.value` from the DOM input event.
2. If the trimmed value is an empty string, sets `this.valueStateOptions.name = ValueState.Negative` (shows the error state on the input).
3. Otherwise, resets `this.valueStateOptions.name = ValueState.None` (clears the error state).

This is an inline/live validation handler triggered on every keystroke in the Category Name input.

**Side effects:** Mutates `valueStateOptions.name`.

---

### `validateForm(): boolean`

**Signature:** `validateForm(): boolean`

**Step-by-step logic:**

1. Declares `isValid = true`.
2. Checks `this.itemCategory.name`. If falsy (empty string, null, undefined):
   - Sets `this.valueStateOptions.name = ValueState.Negative`.
   - Sets `isValid = false`.
3. Returns `isValid`.

This is a submit-time gate check. It only validates the `name` field. The `prefix` field has no required validation.

**Returns:** `true` if the form is valid; `false` if the name is missing.

**Side effects:** May mutate `valueStateOptions.name`.

---

### `CloseDialog()`

**Signature:** `CloseDialog(): void`

**Step-by-step logic:**

1. Sets `this.open = false` — hides the dialog.
2. Sets `this.loading = false` — deactivates the busy indicator.
3. Resets `this.valueStateOptions.name = ValueState.None` — clears any displayed validation error.

Called on: successful save (from `AddItemCategory` next handler), API error (from `AddItemCategory` error handler), the Cancel button click, and the dialog's native `(before-close)` event.

**Side effects:** Mutates `open`, `loading`, `valueStateOptions.name`.

---

## Template Bindings & Structure

The template is a single `<ui5-dialog>` with a busy indicator wrapping the form fields, and a footer toolbar with two action buttons.

### Dialog (`<ui5-dialog>`)

- Class: `ui5-xl-without-tab` (custom sizing class).
- `[open]="open"` — visibility is controlled by the `open` property.
- `[attr.header-text]` — dynamically shows `localization.New` (`"New"`) when `saveMode === 'POST'`, or `localization.Edit` (`"Edit"`) when in PUT mode.
- `(before-close)="CloseDialog()"` — native UI5 dialog close event (e.g. Escape key) triggers `CloseDialog()`.

### Busy Indicator (`<ui5-busy-indicator>`)

- `[delay]="0"` — no delay before showing the spinner.
- `[active]="loading"` — activates the overlay spinner while an API call is in flight.
- `size="M"` — medium spinner size.
- Also wires `(before-close)="CloseDialog()"` (redundant binding, present in source).

### Form Fields (`<section>`)

**Active toggle:**
- `<ui5-label>` displaying `localization.Active` with a colon suffix.
- `<ui5-switch [(ngModel)]="itemCategory.is_active">` — two-way binding to the `is_active` boolean; defaults to `true`.

**Category Name (required):**
- `<ui5-label required show-colon i18n>Category Name</ui5-label>` — marked required (asterisk from UI5).
- `<ui5-input class="w-100" [(ngModel)]="itemCategory.name" placeholder="Enter category name" i18n-placeholder type="Text">`.
- `(input)="checkValidation($event)"` — fires live validation on every keystroke.
- `[attr.value-state]="valueStateOptions.name"` — reflects `ValueState.None` or `ValueState.Negative` on the input.
- `<div slot="valueStateMessage">{{ validationMessage }}</div>` — renders the "This field is required." message inside the UI5 value-state message slot when the state is Negative.

**Category Prefix (optional):**
- `<ui5-label show-colon i18n>Category Prefix</ui5-label>` — no `required` attribute.
- `<ui5-input class="w-100" [(ngModel)]="itemCategory.prefix" placeholder="Enter category Prefix" i18n-placeholder type="Text">` — no validation binding; purely optional.

### Footer Toolbar (`<ui5-toolbar slot="footer">`)

- **Submit button:** `design="Emphasized"`, `(click)="AddItemCategory()"`, `[disabled]="loading"`, text from `localization.Submit` (`"Submit"`).
- **Cancel button:** `design="Transparent"`, `(click)="CloseDialog()"`, `[disabled]="loading"`, text from `localization.Cancel` (`"Cancel"`).

Both buttons are disabled while `loading` is `true` to prevent duplicate submissions.

---

## API Calls

| HTTP Method | Endpoint (relative) | When called | Payload | What happens with response |
|---|---|---|---|---|
| POST | `{lodataPrefix}/ItemCategories` | `AddItemCategory()` when `saveMode === 'POST'` and form is valid | `itemCategory.toOdata()` — full `ItemCategory` object minus `created_at` and `updated_at` fields | Response is deserialised into a new `ItemCategory`; `CatAdded` is emitted with it; `RefreshTable` is emitted; toast type `'add'` shown; dialog closed. |
| PUT | `{lodataPrefix}/ItemCategories({id})` | `AddItemCategory()` when `saveMode === 'PUT'` and form is valid | `itemCategory.toOdata()` — same serialisation as above | Response is deserialised into a new `ItemCategory`; `CatAdded` is emitted with it; `RefreshTable` is emitted; toast type `'edit'` shown; dialog closed. |

The `toOdata()` method on `ItemCategory` spreads all instance properties but explicitly strips `created_at` and `updated_at` (sets them to `undefined`) before sending.

Both calls pass `isLodata = true`, causing `CommonService` to use the `lodataPrefix` base URL.

---

## Validation Logic

| Field | Rule | Trigger | State on failure | State on pass |
|---|---|---|---|---|
| `itemCategory.name` | Must be non-empty (truthy) | Submit (`validateForm()`) and live keystroke (`checkValidation()`) | `valueStateOptions.name = ValueState.Negative` — red error border + "This field is required." message | `valueStateOptions.name = ValueState.None` — no border |
| `itemCategory.prefix` | None — field is optional | N/A | N/A | N/A |
| `itemCategory.is_active` | None — boolean toggle, always has a value | N/A | N/A | N/A |

`validateForm()` is the submit-gate check. `checkValidation()` provides real-time feedback as the user types in the name field. Neither clears the state when the dialog is opened; `CloseDialog()` resets all states to `None`.

---

## Services Injected

| Service | Why injected | Methods used |
|---|---|---|
| `CommonService` | Generic HTTP client wrapper providing lodata-prefixed API calls with Bearer token auth | `post(url, body, isLodata)` for creating a new category; `put(url, body, isLodata)` for updating an existing one. Both return `Observable<T>`. |
| `ToastService` | Displays application-level toast notifications | `show(type: ToastType)` — called with `'add'`, `'edit'`, or `'error'` to trigger the appropriate notification. |

---

## Inter-component Communication

| Direction | Mechanism | Detail |
|---|---|---|
| Parent → Component | `@Input() saveMode` | Parent sets `'POST'` or `'PUT'` before opening the dialog. |
| Parent → Component | `@Input() itemCategory` | Parent passes either a blank `ItemCategory` (create) or an existing one (edit). |
| Parent → Component | Direct property mutation | Parent sets `component.open = true` on its template reference to open the dialog. |
| Component → Parent | `@Output() CatAdded` | Emits the newly saved/updated `ItemCategory` so the parent can update its local state immediately. |
| Component → Parent | `@Output() RefreshTable` | Emits a signal (no payload) telling the parent to reload the full category list from the server. |
| Component → Global | `ToastService` | Shows global toast messages; not directed at any specific parent. |

---

## Enums / Models Used

### `ItemCategory` (model)
File: `src/app/shared/model/itemCategory.ts`

| Property | Type | Default | Note |
|---|---|---|---|
| `id` | `number \| undefined` | `undefined` | OData primary key; present for edit, absent on new records. |
| `is_active` | `boolean` | `true` | Active/inactive toggle. |
| `name` | `string` | `''` | Category display name. Required by this form. |
| `prefix` | `string` | `''` | Optional short prefix string. |
| `subcategories` | `ItemSubCategory[] \| undefined` | `undefined` | Related sub-categories; not used in this form. |
| `custom_id` | `string \| undefined` | `undefined` | System-assigned identifier; not used in this form. |
| `created_at` | `string \| undefined` | `undefined` | Timestamp; excluded from API payload by `toOdata()`. |
| `updated_at` | `string \| undefined` | `undefined` | Timestamp; excluded from API payload by `toOdata()`. |

Key methods: `deserialize(input)` — populates from a raw API object; `toOdata()` — serialises for sending to the API (strips audit timestamps).

### `saveMode` (enum)
File: `src/app/shared/enums/saveMode.ts`

| Member | Value |
|---|---|
| `GET` | `'GET'` |
| `POST` | `'POST'` |
| `PUT` | `'PUT'` |
| `PATCH` | `'PATCH'` |
| `DELETE` | `'DELETE'` |
| `REQUEST` | `'REQUEST'` |

The component only uses `saveMode.POST` and `saveMode.PUT` for branching logic. The `@Input() saveMode` property is typed as `string`, but compared against `saveMode.POST` and `saveMode.PUT` string values at runtime.

### `ValueState` (UI5 enum)
File: `src/app/shared/utilities/value-state-wrapper.ts` (re-exports from `@ui5/webcomponents-base`)

Used values in this component:
- `ValueState.None` — clears error styling.
- `ValueState.Negative` — applies red/error styling to the input.

### `Localization` (constant object)
File: `src/app/shared/utilities/localization.ts`

Keys used in this component and template:

| Key | Value |
|---|---|
| `Localization.New` | `"New"` |
| `Localization.Edit` | `"Edit"` |
| `Localization.Active` | `"Active"` |
| `Localization.Submit` | `"Submit"` |
| `Localization.Cancel` | `"Cancel"` |
| `Localization.requiredField` | `"This field is required."` |

---

## Key Business Logic

1. **Dual-mode form (create / edit):** The same component handles both POST and PUT operations. The parent controls the mode via `saveMode` and the data via `itemCategory`. The dialog header text and API endpoint both react to this single input.

2. **OData key-predicate URL pattern for PUT:** The update request uses the OData entity-key syntax `ItemCategories(${id})` — not a REST `/ItemCategories/:id` pattern. This must be consistent with the backend's OData endpoint expectations.

3. **`toOdata()` strips audit fields:** The model's `toOdata()` method deliberately omits `created_at` and `updated_at` from the payload by setting them to `undefined` before spreading, preventing accidental overwrite of server-managed audit timestamps.

4. **Dialog open state managed externally:** The `open` property is set to `true` by the parent component (directly or via template binding). The component itself only ever sets it to `false` (via `CloseDialog()`). This means the parent fully controls when the dialog appears.

5. **Error handling closes the dialog:** On API error, the error handler both sets `this.open = false` and calls `CloseDialog()` (which also sets `open = false`). This is a redundant but harmless double-close. The user loses their unsaved input on any error.

6. **No form reset on open:** When the parent re-opens the dialog (e.g. to add another category), the form fields retain whatever state was last bound via `@Input() itemCategory`. It is the parent's responsibility to provide a fresh `ItemCategory` instance for create mode.

7. **`responseType` property is unused:** The class property `public responseType: saveMode = saveMode.POST` is declared but never read or mutated after initialisation. It appears to be a leftover stub.

8. **Two-way binding with `ngModel`:** The form uses Angular `ngModel` two-way binding, meaning changes in the UI immediately update the `itemCategory` object passed in via `@Input`. If the parent holds a reference to the same object, the parent's copy is mutated live as the user types — before any save action.
