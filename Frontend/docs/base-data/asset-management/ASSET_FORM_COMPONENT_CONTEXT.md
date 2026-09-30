# ASSET_FORM_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| TypeScript file | `src/app/modules/base-data-management/asset-management/asset-form/asset-form.component.ts` |
| Template file | `src/app/modules/base-data-management/asset-management/asset-form/asset-form.component.html` |
| Stylesheet | `src/app/modules/base-data-management/asset-management/asset-form/asset-form.component.scss` |
| Selector | `app-asset-form` |
| Component type | Form / Dialog |
| Module | `BaseDataManagementModule` (inferred from directory) |

**Purpose:** `AssetFormComponent` is a modal dialog form used to create or edit an `Asset` record. It is rendered as a SAP UI5 `<ui5-dialog>` and can operate in two modes — POST (create new) and PUT (update existing) — controlled by the `saveMode` input. When submitted, it calls the appropriate OData endpoint and notifies the parent component to refresh its table. Validation is performed on the asset `name` field before submission.

---

## Inputs (@Input)

| Input name | Type | Default | Purpose |
|---|---|---|---|
| `saveMode` | `string` | `'POST'` | Determines whether the form submits a POST (create) or PUT (update) request. Expected values are `'POST'` or `'PUT'` (matching the `saveMode` enum string values). |

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `RefreshTable` | `EventEmitter<any>` | Emitted after a successful POST or PUT API call. Signals the parent component to reload or refresh its asset list/table. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `saveMode` | `string` | `'POST'` | (Also an `@Input`) Controls create vs. edit mode for the form and dialog title. |
| `asset` | `Asset` | `new Asset().deserialize({})` | The working data model bound to the form fields. Populated externally before the dialog is opened for edits. Reset to a blank `Asset` on close. |
| `open` | `boolean` | `false` | Controls the visibility of the `<ui5-dialog>`. Set to `true` by the parent to open the dialog. |
| `loading` | `boolean` | `false` | Set to `true` while the API request is in-flight. Used to show the `<ui5-busy-indicator>` and disable the Submit/Cancel buttons. |
| `ToastType` | `'add' \| 'edit' \| 'error'` | `'add'` | Tracks which toast notification type to show after the API call completes. Set to `'add'` for POST, `'edit'` for PUT, and `'error'` on failure. |
| `validationMessage` | `string` | `Localization.requiredField` | The i18n message shown in the value-state message slot of the name input when validation fails. Resolves to `"This field is required."`. |
| `valueState` | `typeof ValueState` | `ValueState` (UI5 enum reference) | Public reference to the `ValueState` enum from `@ui5/webcomponents-base`, used in the template for value-state comparisons. |
| `responseType` | `saveMode` | `saveMode.POST` | Stores the `saveMode` enum value. Declared but not actively used in business logic (the `saveMode` string input is compared directly). |
| `localization` | `typeof Localization` | `Localization` | Public reference to the application-wide `Localization` constant object. Exposed for use in the template for i18n strings. |
| `valueStateOptions` | `{ name: ValueState }` | `{ name: ValueState.None }` | Tracks the UI5 value state for each individual form field. Currently only tracks `name`. Set to `ValueState.Negative` on validation failure, `ValueState.None` otherwise. |

---

## ViewChild / ViewChildren

None. The component does not declare any `@ViewChild` or `@ViewChildren` references.

---

## Lifecycle Hooks

No lifecycle hooks are implemented. The component does not use `ngOnInit`, `ngOnDestroy`, `ngAfterViewInit`, or any other Angular lifecycle interfaces. All initialization is done via default property values and the component relies on the parent setting `open = true` to trigger the dialog.

---

## Methods — DETAILED

### `addAsset()`

**Signature:** `addAsset(): void`

**Step-by-step logic:**
1. Calls `validateForm()`. If it returns `false`, the method returns immediately without making any API call.
2. Sets `this.loading = true` to activate the busy indicator and disable buttons.
3. Initializes an empty `url` string and a nullable `request$` observable.
4. **POST branch** — if `this.saveMode === saveMode.POST` (`'POST'`):
   - Sets `url = 'Assets'`
   - Sets `this.ToastType = 'add'`
   - Creates `request$` by calling `this.commonService.post('Assets', this.asset.toOdata(), true)` (OData prefix, `isLodata = true`)
5. **PUT branch** — else if `this.saveMode === saveMode.PUT` (`'PUT'`):
   - Sets `url = 'Assets(${this.asset.id})'` (OData key segment)
   - Sets `this.ToastType = 'edit'`
   - Creates `request$` by calling `this.commonService.put('Assets(<id>)', this.asset.toOdata(), true)` (OData prefix)
6. If `request$` is not null/undefined:
   - Subscribes to the observable.
   - **On `next`:** calls `CloseDialog()`, emits `RefreshTable`, calls `toastService.show(this.ToastType)` (shows 'add' or 'edit' toast).
   - **On `error`:** logs the error to `console.error`, calls `CloseDialog()`, calls `toastService.show('error')`.

**Returns:** `void`. Side effects: opens/closes dialog, emits `RefreshTable`, shows toasts, makes HTTP requests.

---

### `checkValidation(event: any)`

**Signature:** `checkValidation(event: any): void`

**Step-by-step logic:**
1. Extracts `event.target.value` (the current raw string value of the input element).
2. If `value.trim()` is falsy (empty or whitespace-only):
   - Sets `this.valueStateOptions.name = ValueState.Negative` (UI turns the field red with error state).
3. Otherwise:
   - Sets `this.valueStateOptions.name = ValueState.None` (clears the error state).

**Called by:** the `(input)` event on the `<ui5-input>` for the `name` field (fires on every keystroke).

**Returns:** `void`. Side effect: updates `valueStateOptions.name` reactively.

---

### `validateForm(): boolean`

**Signature:** `validateForm(): boolean`

**Step-by-step logic:**
1. Initializes `isValid = true`.
2. Checks if `this.asset.name` is falsy (empty string, `undefined`, or `null`):
   - If so, sets `this.valueStateOptions.name = ValueState.Negative` and sets `isValid = false`.
3. Returns `isValid`.

**Note:** Only the `name` field is validated. `is_active` has no validation because it is a boolean switch with a valid default.

**Returns:** `boolean` — `true` if the form is valid, `false` if any required field is missing.

---

### `CloseDialog()`

**Signature:** `CloseDialog(): void`

**Step-by-step logic:**
1. Sets `this.open = false` — hides the `<ui5-dialog>`.
2. Sets `this.loading = false` — resets the busy indicator.
3. Sets `this.valueStateOptions.name = ValueState.None` — clears any lingering validation error states.
4. Sets `this.asset = new Asset().deserialize({})` — resets the form data model to a fresh blank `Asset` instance.

**Called by:**
- The `(before-close)` event of `<ui5-dialog>` (when the user presses Escape or clicks outside, if allowed).
- The Cancel button `(click)` handler.
- Inside `addAsset()` on both success and error paths.

**Returns:** `void`. Side effects: resets all dialog-related state.

---

## Template Bindings & Structure

The template is a single `<ui5-dialog>` wrapping all content.

### Dialog root (`<ui5-dialog>`)
- `[open]="open"` — property binding controls dialog visibility.
- `class="ui5-xl-without-tab"` — applies an extra-large dialog CSS class.
- `[attr.header-text]` — dynamically sets the dialog header to `localization.New` (`"New"`) when `saveMode === 'POST'`, or `localization.Edit` (`"Edit"`) when in PUT mode.
- `(before-close)="CloseDialog()"` — intercepts the dialog's native before-close event (e.g., Escape key) and runs the `CloseDialog()` reset logic.

### Busy Indicator (`<ui5-busy-indicator>`)
- `[delay]="0"` — no delay before showing the spinner.
- `[active]="loading"` — shows spinner while an API request is in-flight.
- `size="M"` — medium spinner size.
- `class="w-full"` — stretches to full width.

### Active toggle (`<ui5-switch>`)
- Bound with `[(ngModel)]="asset.is_active"` — two-way binding to the `is_active` boolean property of the asset.
- Labeled with `{{ localization.Active }}` (`"Active"`).

### Asset Name input (`<ui5-input>`)
- `[(ngModel)]="asset.name"` — two-way binding to the `name` string field.
- `placeholder="Enter asset name"` (i18n-enabled via `i18n-placeholder`).
- `(input)="checkValidation($event)"` — real-time validation on every keystroke.
- `[attr.value-state]="valueStateOptions.name"` — applies UI5 value state (`None` or `Negative`) to show/hide error styling.
- Contains a `<div slot="valueStateMessage">{{ validationMessage }}</div>` — displays the localized required-field error message inside the UI5 value-state message popup.
- The label above uses `show-colon` and `required` attributes to indicate the field is mandatory.

### Footer toolbar (`<ui5-toolbar slot="footer">`)
Contains two buttons:

| Button | Design | Bound action | Disabled condition |
|---|---|---|---|
| Submit | `Emphasized` (primary style) | `(click)="addAsset()"` | `[disabled]="loading"` |
| Cancel | `Transparent` | `(click)="CloseDialog()"` | `[disabled]="loading"` |

---

## API Calls

| HTTP Method | Endpoint (resolved) | When called | Payload | What happens with response |
|---|---|---|---|---|
| POST | `{ServerApi}/odata/Assets` | `addAsset()` when `saveMode === 'POST'` | `this.asset.toOdata()` — asset object without `employeeHasAssets`, `employees`, `created_at`, `updated_at` fields | On success: dialog closes, `RefreshTable` emitted, 'add' toast shown. On error: dialog closes, 'error' toast shown. |
| PUT | `{ServerApi}/odata/Assets({id})` | `addAsset()` when `saveMode === 'PUT'` | `this.asset.toOdata()` — same stripped asset object | On success: dialog closes, `RefreshTable` emitted, 'edit' toast shown. On error: dialog closes, 'error' toast shown. |

Both calls use `isLodata = true`, meaning they go through the OData prefix (`environment.ServerApi + '/odata'`). The Bearer token is retrieved from `localStorage.getItem('remember_token')` and injected via default headers in `CommonService`.

---

## Validation Logic

| Field | Rule | Trigger | State on failure | State on success |
|---|---|---|---|---|
| `name` | Must be non-empty (non-falsy) | `validateForm()` called on Submit click | `valueStateOptions.name = ValueState.Negative` | `valueStateOptions.name = ValueState.None` |
| `name` | Must be non-empty after trim | `checkValidation()` called on each input event | `valueStateOptions.name = ValueState.Negative` | `valueStateOptions.name = ValueState.None` |

No other fields are validated. `is_active` defaults to `true` and has no validation rule.

When `ValueState.Negative` is active on the name field, the UI5 input renders in error style and displays the message `"This field is required."` in its value-state message popup.

---

## Services Injected

| Service | Why injected | Methods used |
|---|---|---|
| `CommonService` (`@app/services/common-service/common.service`) | Central HTTP abstraction for all API communication | `post(url, body, isLodata)` — creates an asset via OData POST; `put(url, body, isLodata)` — updates an asset via OData PUT |
| `ToastService` (`@app/services/toast-service/toast.service`) | Application-wide notification / toast bus | `show(type: ToastType)` — triggers a toast notification of type `'add'`, `'edit'`, or `'error'` |

---

## Inter-component Communication

| Direction | Mechanism | Detail |
|---|---|---|
| Parent → Component | `@Input() saveMode` | Parent sets `'POST'` or `'PUT'` to control the form mode before opening. |
| Parent → Component | Direct property access (`component.asset = ...`, `component.open = true`) | Parent retrieves the component reference (typically via `@ViewChild`) and sets `asset` with the record to edit, then sets `open = true` to open the dialog. |
| Component → Parent | `@Output() RefreshTable` (EventEmitter) | Emitted after a successful save. Parent listens and reloads its data table. |
| Component → Global | `ToastService.show()` | Fires a toast event on the shared observable bus. A global toast component elsewhere in the app subscribes and displays the notification. |

---

## Enums / Models Used

### `Asset` (`@shared/model/asset`)
Implements `Deserializable`. Fields:

| Field | Type | Default |
|---|---|---|
| `id` | `number \| undefined` | `undefined` |
| `is_active` | `boolean \| undefined` | `true` |
| `name` | `string \| undefined` | `''` |
| `custom_id` | `string \| undefined` | `undefined` |
| `employees` | `Employee[]` | `[]` |
| `created_at` | `string \| undefined` | `undefined` |
| `updated_at` | `string \| undefined` | `undefined` |
| `employeeHasAssets` | `EmployeeHasAsset[] \| undefined` | `[]` |

`deserialize(input)`: performs `Object.assign(this, input)`, then maps nested `employees` and `employeeHasAssets` arrays into their respective model instances.

`toOdata()`: returns a spread of `this` with `employeeHasAssets`, `employees`, `created_at`, and `updated_at` explicitly set to `undefined` (stripped from the API payload).

### `saveMode` enum (`@shared/enums/saveMode`)

| Key | Value |
|---|---|
| `GET` | `'GET'` |
| `POST` | `'POST'` |
| `PUT` | `'PUT'` |
| `PATCH` | `'PATCH'` |
| `DELETE` | `'DELETE'` |
| `REQUEST` | `'REQUEST'` |

Only `POST` and `PUT` are relevant to this component.

### `ValueState` (`@shared/utilities/value-state-wrapper`)
Re-exported from `@ui5/webcomponents-base/dist/types/ValueState.js`. The values used in this component are `ValueState.None` (default / no error) and `ValueState.Negative` (error / red state).

### `Localization` (`@shared/utilities/localization`)
A constant object of Angular i18n-tagged template literals. Keys used in this component:

| Key | Resolved string |
|---|---|
| `Localization.New` | `"New"` |
| `Localization.Edit` | `"Edit"` |
| `Localization.Active` | `"Active"` |
| `Localization.Submit` | `"Submit"` |
| `Localization.Cancel` | `"Cancel"` |
| `Localization.requiredField` | `"This field is required."` |

### `ToastType` (from `ToastService`)
Union type: `'save' | 'add' | 'edit' | 'delete' | 'remove' | 'read' | 'approve' | 'import' | 'export' | 'password' | 'download' | 'error' | 'exist'`. This component uses `'add'`, `'edit'`, and `'error'`.

---

## Key Business Logic

1. **Dual-mode create/edit in a single component:** The component does not have separate create and edit forms. The `saveMode` input switches the HTTP verb (POST vs PUT) and the dialog title (New vs Edit). The parent component is responsible for populating `asset` with existing data before setting `open = true` for edit mode.

2. **Asset payload stripping via `toOdata()`:** When submitting, the `Asset.toOdata()` method intentionally removes relational fields (`employees`, `employeeHasAssets`) and audit timestamps (`created_at`, `updated_at`) from the payload. This prevents accidentally overwriting server-managed fields or sending redundant nested data to the OData endpoint.

3. **Dialog reset on every close path:** `CloseDialog()` is called on three distinct paths — success, error, and user-initiated cancel/escape. In all cases it resets `open`, `loading`, `valueStateOptions`, and the `asset` model to a clean state. This ensures stale data never leaks between open/close cycles.

4. **No guard on missing `id` for PUT:** In PUT mode, the URL is built as `Assets(${this.asset.id})`. If `asset.id` is `undefined` (e.g., the parent forgot to populate it), the URL becomes `Assets(undefined)`, which would result in a 404 or OData error. There is no explicit guard against this in the component.

5. **`responseType` property is unused:** The property `public responseType: saveMode = saveMode.POST` is declared at the class level but never read. The actual mode check in `addAsset()` compares the string input `this.saveMode` directly against `saveMode.POST` and `saveMode.PUT`, not `this.responseType`.

6. **Real-time vs. submit-time validation separation:** `checkValidation()` provides immediate reactive feedback on each keystroke (clearing errors as the user types). `validateForm()` is the gate that blocks submission. Both update the same `valueStateOptions.name` property, so they are consistent.

7. **Both buttons disabled during loading:** The `[disabled]="loading"` binding on both the Submit and Cancel buttons prevents double-submission and accidental dialog closure mid-request. However, the `(before-close)` event on the dialog itself (e.g., Escape key) still calls `CloseDialog()` regardless of the loading state, which would close the dialog even during an in-flight request.
