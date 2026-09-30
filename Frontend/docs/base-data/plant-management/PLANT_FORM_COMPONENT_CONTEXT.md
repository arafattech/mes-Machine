# PLANT_FORM_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| TypeScript file | `Frontend/src/app/modules/base-data-management/plant-management/plant-form/plant-form.component.ts` |
| Template file | `Frontend/src/app/modules/base-data-management/plant-management/plant-form/plant-form.component.html` |
| Style file | `Frontend/src/app/modules/base-data-management/plant-management/plant-form/plant-form.component.scss` |
| Selector | `app-plant-form` |
| Component type | Form / Dialog |

**Purpose:** `PlantFormComponent` renders a modal dialog that allows the user to create a new plant record (POST) or edit an existing one (PUT). The dialog contains a toggle for the active status and a required text input for the plant name. On save, it calls the OData API via `CommonService`, shows a toast notification via `ToastService`, closes itself, and notifies the parent component to refresh its data table.

---

## Inputs (@Input)

| Input name | Type | Default | Purpose |
|---|---|---|---|
| `saveMode` | `string` | `"POST"` | Determines whether the form performs a create (`"POST"`) or update (`"PUT"`) operation. Compared directly against `saveMode` enum string values at runtime. |
| `plant` | `Plant` | `new Plant().deserialize({})` | The plant data object bound to the form fields. For a new record this is an empty `Plant` instance; for editing it is pre-populated by the parent. |

---

## Outputs (@Output)

| Output name | Event type | Purpose |
|---|---|---|
| `IsOpenToastAlert` | `EventEmitter<void>` | Declared but **not emitted anywhere in the current implementation**. Reserved / legacy output — no current callers should depend on it. |
| `RefreshTable` | `EventEmitter<any>` | Emitted after a successful POST or PUT response. Signals the parent component to reload/refresh its plant list table. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `open` | `boolean` | `false` | Controls whether the `ui5-dialog` is visible. Set to `true` externally to open the dialog; set back to `false` by `CloseDialog()`. |
| `loading` | `boolean` | `false` | Tracks whether an HTTP request is in-flight. Drives the `ui5-busy-indicator` active state and disables the toolbar buttons while `true`. |
| `ToastType` | `"add" \| "edit" \| "error"` | `"add"` | Stores the toast category to display after the API call resolves. Set to `"add"` before POST and `"edit"` before PUT. |
| `validationMessage` | `string` | `Localization.requiredField` (`"This field is required."`) | Static message displayed in the `valueStateMessage` slot of the plant name input when validation fails. |
| `valueState` | `typeof ValueState` | `ValueState` (class reference) | Holds the UI5 `ValueState` enum class so it can be referenced directly in the template (e.g., `valueState.None`). Not used in the template in the current code — only `valueStateOptions.name` is bound. |
| `responseType` | `saveMode` | `saveMode.POST` | Declared but **not used** in the current implementation. Appears to be an unused leftover. |
| `localization` | `typeof Localization` | `Localization` (object reference) | Exposes the entire `Localization` constant object to the template for i18n string access. |
| `valueStateOptions` | `{ name: ValueState }` | `{ name: ValueState.None }` | Holds the reactive value-state for the plant name input. Set to `ValueState.Negative` on validation failure, reset to `ValueState.None` on success or dialog close. |

---

## ViewChild / ViewChildren

None. No `@ViewChild` or `@ViewChildren` decorators are present in this component.

---

## Lifecycle Hooks

No lifecycle hooks are implemented. The component has no `ngOnInit`, `ngOnDestroy`, `ngAfterViewInit`, or any other lifecycle hook method. All logic is triggered by user interaction and parent-driven property binding.

---

## Methods — DETAILED

### `onSaveType()`

**Signature:** `onSaveType(): void`

**Step-by-step logic:**

1. Calls `validateForm()`. If validation fails (`false` returned), exits immediately — no HTTP call is made.
2. Sets `this.loading = true` to show the busy indicator and disable the toolbar buttons.
3. Declares local variables `url` (string) and `request$` (Observable or undefined).
4. **Branch — POST:** If `this.saveMode === saveMode.POST` (`"POST"`):
   - Sets `url = "Plants"`.
   - Sets `this.ToastType = "add"`.
   - Creates `request$` by calling `this.commonService.post("Plants", this.plant.toOdata(), true)`. The third argument `true` routes to the OData prefix: `{ServerApi}/odata/Plants`.
5. **Branch — PUT:** If `this.saveMode === saveMode.PUT` (`"PUT"`):
   - Sets `url = "Plants({id})"` where `{id}` is `this.plant.id`.
   - Sets `this.ToastType = "edit"`.
   - Creates `request$` by calling `this.commonService.put("Plants({id})", this.plant.toOdata(), true)`. Resolves to `{ServerApi}/odata/Plants({id})`.
6. If `request$` is defined, subscribes to it:
   - **On success (`next`):** Calls `CloseDialog()`, emits `RefreshTable`, calls `toastService.show(this.ToastType)` with either `"add"` or `"edit"`.
   - **On error (`error`):** Sets `this.open = false` (redundant — `CloseDialog()` also does this), calls `CloseDialog()`, calls `toastService.show("error")`.

**Returns:** `void`

---

### `checkValidation(event: any)`

**Signature:** `checkValidation(event: any): void`

**Step-by-step logic:**

1. Reads `event.target.value` from the UI5 input's native `input` DOM event.
2. Trims the value and checks if it is empty:
   - If empty: sets `this.valueStateOptions.name = ValueState.Negative` — the input renders with a red error state and displays `validationMessage`.
   - If not empty: sets `this.valueStateOptions.name = ValueState.None` — error state is cleared.

**Side effects:** Mutates `valueStateOptions.name` reactively as the user types.

**Returns:** `void`

---

### `validateForm(): boolean`

**Signature:** `validateForm(): boolean`

**Step-by-step logic:**

1. Initialises `isValid = true`.
2. Checks `this.plant.name`. If falsy (empty string, `undefined`, `null`):
   - Sets `this.valueStateOptions.name = ValueState.Negative`.
   - Sets `isValid = false`.
3. Returns `isValid`.

**Note:** Only the `name` field is validated. `is_active` is not validated (it has a boolean default). No other fields from the `Plant` model are validated in this form.

**Returns:** `boolean` — `true` if the form is valid, `false` otherwise.

---

### `CloseDialog()`

**Signature:** `CloseDialog(): void`

**Step-by-step logic:**

1. Sets `this.open = false` — hides the `ui5-dialog`.
2. Sets `this.loading = false` — clears any pending spinner state.
3. Resets `this.valueStateOptions.name = ValueState.None` — clears any validation error state on the input.
4. Resets `this.plant = new Plant().deserialize({})` — replaces the bound plant object with a fresh empty instance, clearing all form field values.

**Triggered by:** The `(before-close)` event on `ui5-dialog`, the Cancel toolbar button `(click)` event, and internally by `onSaveType()` on both success and error paths.

**Returns:** `void`

---

## Template Bindings & Structure

The template consists of a single `ui5-dialog` wrapping a busy indicator, a form section, and a footer toolbar.

```
ui5-dialog
  [open]="open"
  [attr.header-text]  — "New" (POST) or "Edit" (PUT) via localization
  (before-close)      — calls CloseDialog()

  ui5-busy-indicator
    [active]="loading"
    [delay]="0"
    size="M"

    section
      div.flex.flex-col
        ui5-label          — "Active" (from localization)
        ui5-switch
          [(ngModel)]="plant.is_active"    — two-way bind to is_active

      ui5-label (required) — "Plant Name" (hardcoded with i18n attribute)

      ui5-input
        [(ngModel)]="plant.name"           — two-way bind to name
        placeholder="Enter plant name"     — i18n-placeholder attribute present
        (input)="checkValidation($event)"  — live validation on keystroke
        [attr.value-state]="valueStateOptions.name"  — error/none state
        div[slot="valueStateMessage"]      — displays validationMessage

  ui5-toolbar (slot="footer")
    ui5-toolbar-button (Emphasized)
      (click)="onSaveType()"
      [disabled]="loading"
      text="{{ localization.Submit }}"

    ui5-toolbar-button (Transparent)
      (click)="CloseDialog()"
      [disabled]="loading"
      text="{{ localization.Cancel }}"
```

**Key binding notes:**
- `[open]="open"` is a one-way property binding on the `ui5-dialog` — the dialog is opened externally by the parent setting `open = true` on the component reference.
- The header text is rendered via `[attr.header-text]` with an inline ternary: `saveMode === 'POST' ? localization.New : localization.Edit`.
- Both toolbar buttons are `[disabled]="loading"` — they are non-interactive while an HTTP request is in-flight.
- `[attr.value-state]` is used (attribute binding) rather than property binding because `ui5-input` is a web component.
- There are no `*ngFor` or `*ngIf` structural directives in this template.

---

## API Calls

| HTTP Method | Endpoint | When called | Payload | Response handling |
|---|---|---|---|---|
| POST | `{ServerApi}/odata/Plants` | `onSaveType()` when `saveMode === "POST"` and form is valid | `plant.toOdata()` — all `Plant` fields except `created_at` and `updated_at` (stripped by `toOdata()`) | On success: close dialog, emit `RefreshTable`, show `"add"` toast. On error: close dialog, show `"error"` toast. |
| PUT | `{ServerApi}/odata/Plants({id})` | `onSaveType()` when `saveMode === "PUT"` and form is valid | `plant.toOdata()` — all `Plant` fields except `created_at` and `updated_at` | On success: close dialog, emit `RefreshTable`, show `"edit"` toast. On error: close dialog, show `"error"` toast. |

All requests use `isLodata: true`, which routes through `CommonService`'s `lodataPrefix` (`{ServerApi}/odata`). Authorization is handled by `CommonService` via a `Bearer` token read from `localStorage.getItem('remember_token')` on every request construction.

---

## Validation Logic

| Field | Rule | Failure state set |
|---|---|---|
| `plant.name` | Must be truthy (non-empty, non-null, non-undefined) | `valueStateOptions.name = ValueState.Negative`; `isValid = false` |

- Validation is triggered in two ways:
  1. **On submit:** `validateForm()` is called by `onSaveType()` before any HTTP request is made.
  2. **On input (live):** `checkValidation(event)` is called on every `input` event on the plant name field. It uses `event.target.value.trim()` to check for blank/whitespace-only input, whereas `validateForm()` checks the ngModel-bound `plant.name` for falsiness.
- The `is_active` field (boolean switch) has no validation — it defaults to `true` in the `Plant` model and is always a valid boolean.
- On dialog close (`CloseDialog()`), the validation error state is always reset to `ValueState.None`.

---

## Services Injected

| Service | Why injected | Methods used |
|---|---|---|
| `CommonService` | Provides generic HTTP wrapper methods with OData/API prefix routing and Bearer token injection | `post(url, body, isLodata)`, `put(url, body, isLodata)` |
| `ToastService` | Provides application-wide toast notification broadcasting via an RxJS `Subject` | `show(type: ToastType)` — called with `"add"`, `"edit"`, or `"error"` |

---

## Inter-component Communication

**Parent to this component:**
- The parent sets `[saveMode]="'POST' | 'PUT'"` to control create vs. edit mode.
- The parent sets `[plant]="selectedPlant"` to populate the form for editing.
- The parent sets `plantFormRef.open = true` (direct property access on the component instance) to open the dialog, as `open` is not an `@Input` — it is a plain public property.

**This component to parent:**
- Emits `RefreshTable` (no payload) after a successful save, signalling the parent to reload its plant list.
- `IsOpenToastAlert` is declared as an output but is never emitted in the current code.

**Child components:** None — no child component directives are used. All UI elements are UI5 web components.

---

## Enums / Models Used

### `Plant` (class — `@shared/model/plant`)

Implements `Deserializable`.

| Property | Type | Default | Notes |
|---|---|---|---|
| `id` | `number \| undefined` | `undefined` | Used to build the PUT URL: `Plants(${plant.id})` |
| `is_active` | `boolean \| undefined` | `true` | Bound to the `ui5-switch` toggle |
| `name` | `string \| undefined` | `''` | Bound to the `ui5-input`; the only validated field |
| `custom_id` | `string \| undefined` | `undefined` | Not rendered in this form; included in API payload |
| `created_at` | `string \| undefined` | `undefined` | Excluded from API payload by `toOdata()` |
| `updated_at` | `string \| undefined` | `undefined` | Excluded from API payload by `toOdata()` |

- `deserialize(input)`: Uses `Object.assign(this, input)` to hydrate from a plain object. Calling `new Plant().deserialize({})` produces an instance with `is_active: true` and `name: ''`.
- `toOdata()`: Returns a spread of `this` with `created_at` and `updated_at` explicitly set to `undefined`, effectively stripping them from the serialized payload.

### `saveMode` (enum — `@shared/enums/saveMode`)

```
GET     = 'GET'
POST    = 'POST'
PUT     = 'PUT'
PATCH   = 'PATCH'
DELETE  = 'DELETE'
REQUEST = 'REQUEST'
```

Only `saveMode.POST` and `saveMode.PUT` are relevant to this component. Note: the `@Input() saveMode` is typed as `string`, not `saveMode`, so string literals `"POST"` and `"PUT"` are also accepted.

### `Localization` (const object — `@shared/utilities/localization`)

An Angular i18n tagged-template object. Keys used by this component:

| Key | Value |
|---|---|
| `Localization.Active` | `"Active"` |
| `Localization.New` | `"New"` |
| `Localization.Edit` | `"Edit"` |
| `Localization.Submit` | `"Submit"` |
| `Localization.Cancel` | `"Cancel"` |
| `Localization.requiredField` | `"This field is required."` |

### `ValueState` (UI5 type — `@ui5/webcomponents-base/dist/types/ValueState.js`)

UI5 web components value-state enum. Values used: `ValueState.None` (no error indicator) and `ValueState.Negative` (red error state). Stored as the class reference in `this.valueState` and in `valueStateOptions.name`.

### `ToastType` (union type — `@app/services/toast-service/toast.service`)

```
'save' | 'add' | 'edit' | 'delete' | 'remove' | 'read' | 'approve'
| 'import' | 'export' | 'password' | 'download' | 'error' | 'exist'
```

This component uses: `"add"`, `"edit"`, `"error"`.

---

## Key Business Logic

1. **Dialog open mechanism — not an @Input:** The `open` property is a plain public class property, not decorated with `@Input()`. The parent component must obtain a template reference (`#plantForm`) or `@ViewChild` reference to the component instance and set `plantForm.open = true` directly to open the dialog. This is an unconventional pattern compared to standard Angular input binding.

2. **Form reset on every close:** `CloseDialog()` always replaces `this.plant` with `new Plant().deserialize({})`. This means if the parent passed in an existing plant for editing, that reference is discarded when the dialog closes (successfully or via Cancel). The parent must re-bind the plant input before opening the dialog again for a subsequent edit.

3. **POST vs PUT URL construction:** For PUT, the OData key predicate format is used: `Plants(${this.plant.id})`, resolving to e.g. `Plants(42)`. For POST, the collection URL `Plants` is used without a key. Both resolve through the OData prefix.

4. **`toOdata()` strips audit timestamps:** The payload sent to the API omits `created_at` and `updated_at` (set to `undefined` in the spread), preventing the client from accidentally overwriting server-managed audit fields.

5. **Error handling closes the dialog:** Unlike many form components that leave the dialog open on API error (to allow the user to retry), this component calls `CloseDialog()` on error in addition to showing an error toast. The user must re-open the dialog to attempt the operation again.

6. **Dual open=false on error path:** In the error callback, `this.open = false` is set explicitly before `CloseDialog()` is called. Since `CloseDialog()` also sets `this.open = false`, the first assignment is redundant — this appears to be a defensive/historical artifact.

7. **`IsOpenToastAlert` output is unused:** The `@Output() IsOpenToastAlert = new EventEmitter<void>()` is declared but never emitted. It may be a legacy output from an earlier toast implementation before `ToastService` was introduced.

8. **`responseType` property is unused:** `public responseType: saveMode = saveMode.POST` is declared but never read or written after initialisation. It is dead code in the current implementation.

9. **`valueState` vs `valueStateOptions`:** Two related properties exist: `valueState` holds the entire `ValueState` class reference (for potential template use like `valueState.None`) and `valueStateOptions` holds the mutable state object `{ name: ValueState }`. The template exclusively uses `valueStateOptions.name` for the input's `[attr.value-state]` binding. The `valueState` class reference is not referenced in the template.

10. **Live vs submit validation discrepancy:** `checkValidation()` trims the value (`value.trim()`) before checking emptiness, catching whitespace-only entries during typing. However, `validateForm()` checks `!this.plant.name` without trimming. A plant name consisting solely of spaces would pass `validateForm()` but would show an error state during live typing via `checkValidation()` — a minor inconsistency.
