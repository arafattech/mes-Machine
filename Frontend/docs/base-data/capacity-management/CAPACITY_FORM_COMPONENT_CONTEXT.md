# CAPACITY_FORM_COMPONENT — Component Context

## Overview

| Item | Value |
|------|-------|
| TypeScript file | `Frontend/src/app/modules/base-data-management/capacity-management/capacity-form/capacity-form.component.ts` |
| Template file | `Frontend/src/app/modules/base-data-management/capacity-management/capacity-form/capacity-form.component.html` |
| Stylesheet | `capacity-form.component.scss` |
| Selector | `app-capacity-form` |
| Component type | Form / Dialog |
| Implements | `OnInit` |

**Purpose:**
`CapacityFormComponent` renders a UI5 modal dialog that allows users to either create a new Capacity record or edit an existing one. The mode (create vs. edit) is controlled by the `saveMode` input. The form contains a single text field for the capacity name and an active/inactive toggle. On submission, it calls the OData API, emits events to refresh the parent list, and triggers a toast notification. After a successful or failed save it closes itself.

---

## Inputs (@Input)

| Input name | Type | Default | Purpose |
|------------|------|---------|---------|
| `saveMode` | `string` | `'POST'` | Determines whether the form performs a POST (create) or PUT (update) request. Expected values are `'POST'` and `'PUT'` from the `saveMode` enum, but the property type is `string`. |
| `capacity` | `Capacity` | `new Capacity().deserialize({})` | The data object bound to the form fields. When editing, the parent passes a pre-populated `Capacity` instance; when creating, the default empty instance is used. |

---

## Outputs (@Output)

| Output name | Emit type | Purpose |
|-------------|-----------|---------|
| `IsOpenToastAlert` | `void` | Declared but **never emitted** in the current code. Likely a legacy or reserved output for toast visibility. |
| `RefreshTable` | `any` | Emitted (with no payload) after a successful POST or PUT, signalling the parent component to reload its data table. |

---

## State Properties

| Property | Type | Default | Purpose |
|----------|------|---------|---------|
| `saveMode` | `string` | `'POST'` | Mirrors the @Input; controls POST vs PUT branch in `AddCapacity()` and dialog header text in the template. |
| `capacity` | `Capacity` | `new Capacity().deserialize({})` | Two-way bound model for all form fields. |
| `open` | `boolean` | `false` | Controls the `[open]` binding on the `<ui5-dialog>`. Toggled by `CloseDialog()`. The parent must set this to `true` to open the dialog (it is public). |
| `loading` | `boolean` | `false` | Set to `true` before the HTTP request and back to `false` in `CloseDialog()`. Used to activate the `<ui5-busy-indicator>` and disable both toolbar buttons. |
| `ToastType` | `'add' \| 'edit' \| 'error'` | `'add'` | Tracks which toast variant to show. Set to `'add'` for POST, `'edit'` for PUT, and `'error'` on HTTP failure. |
| `validationMessage` | `string` | `Localization.requiredField` ("This field is required.") | Static message displayed inside the `<ui5-input>` value-state slot when validation fails. |
| `valueState` | `typeof ValueState` | `ValueState` (imported class) | Reference to the UI5 `ValueState` enum exposed to the template. |
| `responseType` | `saveMode` | `saveMode.POST` | Declared but **not used** anywhere in the current code. |
| `localization` | `typeof Localization` | `Localization` object | Exposes the global i18n string map to the template for header text, labels, and button text. |
| `valueStateOptions` | `{ name: ValueState }` | `{ name: ValueState.None }` | Object holding the current value-state of the name input. Set to `ValueState.Negative` on validation failure, reset to `ValueState.None` on close or when the field is filled. |

---

## ViewChild / ViewChildren

None. The component does not declare any `@ViewChild` or `@ViewChildren` references.

---

## Lifecycle Hooks

### `ngOnInit(): void`
Body is empty. No initialization logic is executed on component creation.

---

## Methods — DETAILED

### `AddCapacity(): void`

**Signature:** `AddCapacity(): void`

**Step-by-step logic:**
1. Calls `validateForm()`. If it returns `false`, the method returns immediately — no HTTP call is made.
2. Sets `this.loading = true`.
3. Initialises empty `url` string and `request$` observable variable.
4. **POST branch** (`this.saveMode === saveMode.POST`):
   - Sets `url = 'Capacities'`.
   - Sets `this.ToastType = 'add'`.
   - Assigns `request$` to `this.commonService.post('Capacities', this.capacity.toOdata(), true)`.
5. **PUT branch** (`this.saveMode === saveMode.PUT`):
   - Sets `url = 'Capacities(${this.capacity.id})'` (OData key-predicate syntax).
   - Sets `this.ToastType = 'edit'`.
   - Assigns `request$` to `this.commonService.put('Capacities(<id>)', this.capacity.toOdata(), true)`.
6. If `request$` is defined, subscribes:
   - **`next` handler:** calls `CloseDialog()`, emits `RefreshTable`, calls `this.toastService.show(this.ToastType)` with `'add'` or `'edit'`.
   - **`error` handler:** sets `this.open = false` (redundant with `CloseDialog()`), calls `CloseDialog()`, calls `this.toastService.show('error')`.

**Side effects:** Mutates `loading`, `ToastType`, `open`. Triggers HTTP call. Emits `RefreshTable` on success.

---

### `checkValidation(event: any): void`

**Signature:** `checkValidation(event: any): void`

**Step-by-step logic:**
1. Reads `event.target.value` (the current raw string value of the input).
2. If `value.trim()` is falsy (empty or whitespace-only):
   - Sets `this.valueStateOptions.name = ValueState.Negative` (shows red error state on the input).
3. Otherwise:
   - Sets `this.valueStateOptions.name = ValueState.None` (clears the error state).

**Called by:** The `(input)` event on `<ui5-input>` — fires on every keystroke.

**Side effects:** Mutates `valueStateOptions.name`.

---

### `validateForm(): boolean`

**Signature:** `validateForm(): boolean`

**Step-by-step logic:**
1. Sets `isValid = true`.
2. Checks `!this.capacity.name` (falsy — empty string, `null`, or `undefined`):
   - If falsy: sets `this.valueStateOptions.name = ValueState.Negative`, sets `isValid = false`.
3. Returns `isValid`.

**Note:** Only the `name` field is validated. `is_active` has no validation. Whitespace-only names pass this check (only `checkValidation` catches whitespace via `.trim()`).

**Side effects:** May mutate `valueStateOptions.name`.

**Returns:** `true` if all validations pass; `false` if name is empty/falsy.

---

### `CloseDialog(): void`

**Signature:** `CloseDialog(): void`

**Step-by-step logic:**
1. Sets `this.open = false` — closes the UI5 dialog.
2. Sets `this.loading = false` — hides the busy indicator and re-enables buttons.
3. Sets `this.valueStateOptions.name = ValueState.None` — clears any validation error state on the name field.
4. Resets `this.capacity` to a fresh `new Capacity().deserialize({})` — clears all form field values for the next use.

**Called by:**
- The `(before-close)` event on `<ui5-dialog>` (user pressing Escape or the dialog's built-in close).
- The Cancel button's `(click)` handler.
- The `next` handler in `AddCapacity()` after a successful save.
- The `error` handler in `AddCapacity()` after a failed save.

**Side effects:** Mutates `open`, `loading`, `valueStateOptions`, `capacity`.

---

## Template Bindings & Structure

```
<ui5-dialog>
  ├── [open]="open"
  ├── [attr.header-text] = "New" | "Edit" (based on saveMode)
  ├── (before-close)="CloseDialog()"
  │
  └── <ui5-busy-indicator [active]="loading">
        └── <section>
              ├── <div>  (Active toggle row)
              │     ├── <ui5-label>  "Active"
              │     └── <ui5-switch [(ngModel)]="capacity.is_active">
              │
              ├── <ui5-label required>  "Capacity Name"
              └── <ui5-input>
                    ├── [(ngModel)]="capacity.name"
                    ├── placeholder="Enter capacity name"
                    ├── (input)="checkValidation($event)"
                    ├── [attr.value-state]="valueStateOptions.name"
                    └── <div slot="valueStateMessage">  {{ validationMessage }}

      <ui5-toolbar slot="footer">
        ├── <ui5-toolbar-button design="Emphasized"
        │     (click)="AddCapacity()"
        │     [disabled]="loading"
        │     text="{{ localization.Submit }}">
        └── <ui5-toolbar-button design="Transparent"
              (click)="CloseDialog()"
              [disabled]="loading"
              text="{{ localization.Cancel }}">
```

**Key bindings:**
- The dialog `header-text` is set via `[attr.header-text]` (attribute binding rather than property binding) because `ui5-dialog` is a web component. It resolves to `localization.New` ("New") when `saveMode === 'POST'` and `localization.Edit` ("Edit") otherwise.
- `<ui5-busy-indicator [active]="loading">` overlays a spinner on the entire form section while the HTTP call is in-flight.
- Both toolbar buttons are `[disabled]="loading"` — preventing double-submission or premature cancellation during an active request.
- `<ui5-switch>` uses two-way binding `[(ngModel)]` to bind directly to `capacity.is_active`.
- `<ui5-input>` uses two-way binding `[(ngModel)]` to bind to `capacity.name` and additionally fires `checkValidation` on each input event for real-time feedback.
- The `valueStateMessage` slot inside `<ui5-input>` shows `validationMessage` ("This field is required.") when the value-state is `Negative`.

---

## API Calls

| HTTP Method | Endpoint (relative) | When called | Payload | Response handling |
|-------------|---------------------|-------------|---------|-------------------|
| `POST` | `<lodataPrefix>/Capacities` | `AddCapacity()` when `saveMode === 'POST'` and form is valid | `capacity.toOdata()` — all `Capacity` fields except `created_at` and `updated_at` | On success: close dialog, refresh table, show 'add' toast. On error: close dialog, show 'error' toast. |
| `PUT` | `<lodataPrefix>/Capacities(<id>)` | `AddCapacity()` when `saveMode === 'PUT'` and form is valid | `capacity.toOdata()` — all `Capacity` fields except `created_at` and `updated_at` | On success: close dialog, refresh table, show 'edit' toast. On error: close dialog, show 'error' toast. |

`<lodataPrefix>` is resolved by `CommonService` using its internal `lodataPrefix` base URL (OData service). The third argument `true` passed to both `post()` and `put()` sets `isLodata = true`.

The `toOdata()` method on `Capacity` returns a spread of all fields with `created_at` and `updated_at` explicitly set to `undefined`, so they are omitted from the JSON serialization.

---

## Validation Logic

| Field | Rule | Trigger | Failure state set |
|-------|------|---------|-------------------|
| `capacity.name` | Must be truthy (non-empty, non-null, non-undefined) | `validateForm()` called at start of `AddCapacity()` | `valueStateOptions.name = ValueState.Negative`; method returns `false`, blocking submission |
| `capacity.name` | Must not be whitespace-only | `checkValidation()` on each `(input)` event | `valueStateOptions.name = ValueState.Negative` (real-time, does not block submission alone) |

**Gap:** `validateForm()` does not trim the value, so a name consisting solely of spaces passes the submit-time check (only `checkValidation` trims). No server-side validation errors are surfaced to individual fields — all errors show the generic 'error' toast.

---

## Services Injected

| Service | Why injected | Methods used |
|---------|--------------|--------------|
| `CommonService` (`@app/services/common-service/common.service`) | Generic HTTP client wrapper for OData API calls | `post(url, body, isLodata)` — create; `put(url, body, isLodata)` — update |
| `ToastService` (`@app/services/toast-service/toast.service`) | Displays user-facing notification messages | `show(type: ToastType)` — called with `'add'`, `'edit'`, or `'error'` |

---

## Inter-component Communication

| Direction | Mechanism | Detail |
|-----------|-----------|--------|
| Parent → Component | `@Input() saveMode` | Parent sets `'POST'` or `'PUT'` before opening. |
| Parent → Component | `@Input() capacity` | Parent passes an empty or pre-filled `Capacity` instance. |
| Parent → Component | Direct property access | Parent sets `component.open = true` to open the dialog (no input binding for `open`). |
| Component → Parent | `@Output() RefreshTable` | Emitted on successful save; parent listens to reload its list/table. |
| Component → Parent | `@Output() IsOpenToastAlert` | Declared but currently unused — never emitted. |
| Component → Global | `ToastService` | Triggers an application-wide toast notification via a shared service. |

---

## Enums / Models Used

### `Capacity` (`@shared/model/capacity`)
```
class Capacity implements Deserializable {
  id?:         number
  name:        string   = ''
  is_active?:  boolean  = true
  custom_id?:  string
  created_at?: string
  updated_at?: string

  deserialize(input: any): this   // Object.assign from input
  toOdata(): Object               // spread of all fields; created_at/updated_at set to undefined
}
```

### `saveMode` enum (`@shared/enums/saveMode`)
```
enum saveMode {
  GET     = 'GET'
  POST    = 'POST'
  PUT     = 'PUT'
  PATCH   = 'PATCH'
  DELETE  = 'DELETE'
  REQUEST = 'REQUEST'
}
```
Only `POST` and `PUT` values are used in this component.

### `ValueState` (`@shared/utilities/value-state-wrapper`)
Re-exported from `@ui5/webcomponents-base/dist/types/ValueState.js`. Relevant values used:
- `ValueState.None` — default, no decoration on the input.
- `ValueState.Negative` — red error state on the input, reveals the `valueStateMessage` slot.

### `Localization` (`@shared/utilities/localization`)
A plain object of Angular i18n tagged template strings (`$localize`). Keys used in this component:

| Key | Value (default English) |
|-----|------------------------|
| `Active` | "Active" |
| `New` | "New" |
| `Edit` | "Edit" |
| `Submit` | "Submit" |
| `Cancel` | "Cancel" |
| `requiredField` | "This field is required." |

### `ToastType` (`@app/services/toast-service/toast.service`)
```
type ToastType = 'add' | 'edit' | 'error' | ...
```
Used values: `'add'`, `'edit'`, `'error'`.

---

## Key Business Logic

1. **Dialog open/close pattern:** The component owns the `open: boolean` flag but it is a plain public property, not an `@Input`. The parent component is responsible for setting `open = true` to display the dialog. The component exclusively controls closing via `CloseDialog()`.

2. **Dual-mode form:** The same form component handles both create and edit operations. The `saveMode` input switches the HTTP verb, the dialog title, and the toast type. The parent must set both `saveMode` and `capacity` correctly before opening.

3. **Form reset on close:** `CloseDialog()` always resets `capacity` to a new empty instance. This means if the dialog is closed via the Cancel button or the Escape key (triggering `before-close`), any unsaved edits are discarded and the `@Input() capacity` reference is replaced — the parent's reference to the original object is not modified since `this.capacity` is reassigned locally.

4. **Error handling does not preserve form state:** Both success and error paths call `CloseDialog()`, which resets the form. If the API call fails, the user loses their input and must reopen the dialog and re-enter data.

5. **`toOdata()` strips audit timestamps:** The `Capacity.toOdata()` method deliberately omits `created_at` and `updated_at` from the request body, which prevents the client from accidentally overwriting server-managed timestamp fields.

6. **`responseType` is unused:** The class property `public responseType: saveMode = saveMode.POST` is declared and initialized but never read or written after initialization. It appears to be dead code.

7. **`IsOpenToastAlert` output is unused:** The `@Output() IsOpenToastAlert` is declared and never emitted. Toast notifications are instead dispatched through `ToastService` directly.

8. **Whitespace-only names can be submitted:** `validateForm()` checks `!this.capacity.name` which is truthy only for empty string, `null`, or `undefined`. A name of `"   "` (spaces) passes this check. The `checkValidation()` function does trim but only updates the UI state — it does not prevent form submission.

9. **OData key-predicate in PUT URL:** The PUT endpoint uses `Capacities(${this.capacity.id})`, which follows OData v4 resource addressing. If `capacity.id` is undefined (e.g., an incomplete edit setup), the URL becomes `Capacities(undefined)` and the server will return an error.
