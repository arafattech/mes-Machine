# CLIENT_AREA_FORM_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| TypeScript file | `src/app/modules/base-data-management/client-management/client-area/client-area-form/client-area-form.component.ts` |
| Template file | `src/app/modules/base-data-management/client-management/client-area/client-area-form/client-area-form.component.html` |
| Stylesheet | `client-area-form.component.scss` |
| Selector | `app-client-area-form` |
| Component type | Form / Dialog |

**Purpose:** This component renders a SAP UI5 modal dialog for creating or editing a Client Area record. It supports two operation modes — POST (create) and PUT (update) — controlled by the `saveMode` input. On submission it performs client-side validation, calls the OData API, emits events to its parent to refresh the table and trigger a toast notification, then resets and closes the dialog.

---

## Inputs (@Input)

| Input name | Type | Default | Purpose |
|---|---|---|---|
| `saveMode` | `string` | `'POST'` | Determines whether the form submits a POST (create) or PUT (update) request. Expected values are the string literals `'POST'` and `'PUT'` from the `saveMode` enum. |
| `clientArea` | `ClientArea` | `new ClientArea().deserialize({})` | The data model bound to the form fields. For a create operation this will be a blank `ClientArea`; for an edit operation the parent passes a pre-populated instance. |

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `IsOpenToastAlert` | `EventEmitter<void>` | Declared but not actively emitted by any method in the current code; reserved for a parent to listen for alert-open events. |
| `RefreshTable` | `EventEmitter<any>` | Emitted after a successful POST or PUT API response to instruct the parent component to reload its data table. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `open` | `boolean` | `false` | Controls the `[open]` binding on the `ui5-dialog`. Setting it to `true` opens the dialog; `false` closes it. |
| `loading` | `boolean` | `false` | Drives the `[active]` binding on `ui5-busy-indicator` and `[disabled]` on both toolbar buttons. Set to `true` while the API call is in flight; reset to `false` on success or error. |
| `ToastType` | `'add' \| 'edit' \| 'error'` | `'add'` | Holds the toast category to pass to `ToastService.show()`. Set to `'add'` before a POST call and `'edit'` before a PUT call; set to `'error'` in the error handler. |
| `validationMessage` | `string` | `Localization.requiredField` ("This field is required.") | The message rendered inside the `<div slot="valueStateMessage">` of the name input when validation fails. |
| `valueState` | `typeof ValueState` | `ValueState` (class reference) | A reference to the `ValueState` class re-exported from `@ui5/webcomponents-base`. Exposed on the class so the template can use `valueState.None`, `valueState.Negative`, etc. |
| `responseType` | `saveMode` | `saveMode.POST` | Typed enum property; not used actively in any template binding or method logic — appears to be a typed alias for future use. |
| `localization` | `typeof Localization` | `Localization` constant object | Reference to the global `Localization` constant used in the template for i18n strings (e.g., `localization.New`, `localization.Edit`, `localization.Active`, `localization.Submit`, `localization.Cancel`). |
| `valueStateOptions` | `{ name: ValueState }` | `{ name: ValueState.None }` | Object holding the current UI5 value-state for the name input. Its `name` property is set to `ValueState.Negative` on validation failure and reset to `ValueState.None` on success or dialog close. |

---

## ViewChild / ViewChildren

None. The component does not declare any `@ViewChild` or `@ViewChildren` references.

---

## Lifecycle Hooks

The component does not implement `OnInit`, `OnDestroy`, `AfterViewInit`, or any other Angular lifecycle hook interfaces. The constructor is the only initialization point.

**Constructor:**
- Injects `CommonService` (private field `commonService`) for HTTP calls.
- Injects `ToastService` (private field `toastService`) for displaying notifications.
- No additional initialization logic is performed in the constructor body.

---

## Methods — DETAILED

### `AddArea()`

**Signature:** `AddArea(): void`

**Step-by-step logic:**
1. Calls `this.validateForm()`. If it returns `false`, the method returns immediately without making any API request.
2. Sets `this.loading = true` to activate the busy indicator and disable toolbar buttons.
3. Initializes local variables: `url: string = ''` and `request$` (untyped `Observable`).
4. **Branch — POST mode** (`this.saveMode === saveMode.POST` i.e. `'POST'`):
   - Sets `url` to `'ClientAreas'`.
   - Sets `this.ToastType = 'add'`.
   - Assigns `request$` to `this.commonService.post('ClientAreas', this.clientArea.toOdata(), true)`.
     - `true` means `isLodata = true`, so the effective URL becomes `{ServerApi}/odata/ClientAreas`.
5. **Branch — PUT mode** (`this.saveMode === saveMode.PUT` i.e. `'PUT'`):
   - Sets `url` to `` `ClientAreas(${this.clientArea.id})` ``.
   - Sets `this.ToastType = 'edit'`.
   - Assigns `request$` to `this.commonService.put(url, this.clientArea.toOdata(), true)`.
     - `true` means `isLodata = true`, so the effective URL becomes `{ServerApi}/odata/ClientAreas({id})`.
6. **If `request$` is defined** (guarded to avoid calling `.subscribe()` on `undefined`):
   - Subscribes to the observable.
   - **`next` handler (success):**
     - Calls `this.CloseDialog()` — resets state and closes the dialog.
     - Emits `this.RefreshTable.emit()` — notifies the parent to reload the list.
     - Calls `this.toastService.show(this.ToastType)` — shows either `'add'` or `'edit'` toast.
   - **`error` handler:**
     - Sets `this.open = false` (redundant with `CloseDialog`, but explicit).
     - Calls `this.CloseDialog()`.
     - Calls `this.toastService.show('error')`.

**Returns:** `void`

**Side effects:** mutates `loading`, `ToastType`, and triggers API call; on completion mutates `open`, `loading`, `valueStateOptions.name`, `clientArea`.

---

### `checkValidation(event: any)`

**Signature:** `checkValidation(event: any): void`

**Step-by-step logic:**
1. Extracts `value` from `event.target.value` (the raw DOM input event from the `ui5-input` component).
2. If `value.trim()` is falsy (empty or whitespace-only):
   - Sets `this.valueStateOptions.name = ValueState.Negative` — marks the name field with an error state.
3. Otherwise:
   - Sets `this.valueStateOptions.name = ValueState.None` — clears the error state.

**When called:** On every `(input)` event of the Area Name `ui5-input` element (i.e., on each keystroke).

**Returns:** `void`

**Side effects:** mutates `valueStateOptions.name`.

---

### `validateForm(): boolean`

**Signature:** `validateForm(): boolean`

**Step-by-step logic:**
1. Initializes `isValid = true`.
2. Checks `this.clientArea.name` for a falsy value (empty string `''`, `null`, `undefined`):
   - If falsy: sets `this.valueStateOptions.name = ValueState.Negative` and sets `isValid = false`.
3. Returns `isValid`.

**When called:** At the start of `AddArea()` before any API call is made.

**Returns:** `true` if the form is valid; `false` if any field fails validation.

**Side effects:** may mutate `valueStateOptions.name`.

---

### `CloseDialog()`

**Signature:** `CloseDialog(): void`

**Step-by-step logic:**
1. Sets `this.open = false` — triggers the `[open]` binding to close the dialog.
2. Sets `this.loading = false` — resets the busy indicator.
3. Sets `this.valueStateOptions.name = ValueState.None` — clears any validation error state.
4. Replaces `this.clientArea` with a fresh blank instance: `new ClientArea().deserialize({})` — resets all form fields to their defaults (`is_active: true`, `name: ''`).

**When called:**
- On successful API response (inside `AddArea()` `next` handler).
- On API error (inside `AddArea()` `error` handler).
- On the `(before-close)` event of the `ui5-dialog` (user pressing Escape or the dialog's native close).
- On click of the Cancel toolbar button.

**Returns:** `void`

**Side effects:** mutates `open`, `loading`, `valueStateOptions.name`, `clientArea`.

---

## Template Bindings & Structure

The template is a single `ui5-dialog` element wrapping all form content.

```
ui5-dialog
  [open]="open"
  class="ui5-xl-without-tab"
  [attr.header-text]="saveMode === 'POST' ? localization.New : localization.Edit"
  (before-close)="CloseDialog()"
```

- `[open]` is driven by the `open` state property. The dialog is only visible when `open === true`. The parent component is responsible for setting `open = true` to show the dialog (typically by accessing the component instance and setting the property directly or through a binding).
- The header text dynamically switches between `"New"` and `"Edit"` based on the current `saveMode`.
- `(before-close)` fires `CloseDialog()` so the component state is always reset if the dialog is dismissed by any mechanism (including the native Escape key).

**Inside the dialog — `ui5-busy-indicator`:**
- `[delay]="0"` — spinner appears immediately with no delay.
- `[active]="loading"` — shows the spinner when `loading === true`.
- `size="M"` — medium-sized indicator.
- `class="w-full"` — stretches to full width.

**Form fields (inside `<section class="w-full">`):**

1. **Active switch** (`div.col-md-12`):
   - `ui5-label` with text `{{ localization.Active }}` ("Active") and `showColon` attribute.
   - `ui5-switch` bound two-way with `[(ngModel)]="clientArea.is_active"` — toggling switches the active flag.

2. **Area Name input:**
   - `ui5-label` with hardcoded text `"Area Name"`, `show-colon`, `required` (shows asterisk), and `i18n` attribute for internationalization.
   - `ui5-input` with:
     - `class="w-100"` — full width.
     - `[(ngModel)]="clientArea.name"` — two-way binding to the name field.
     - `placeholder="Enter area name"` (i18n-marked).
     - `(input)="checkValidation($event)"` — fires live validation on each keystroke.
     - `[attr.value-state]="valueStateOptions.name"` — applies `ValueState.Negative` or `ValueState.None` for visual error feedback.
     - `type="Text"`.
     - `<div slot="valueStateMessage">{{ validationMessage }}</div>` — renders the "This field is required." message in the UI5 value-state message popup.

**Footer toolbar (`slot="footer"`):**
- `ui5-toolbar` containing two buttons:
  1. **Submit button:** `design="Emphasized"`, `(click)="AddArea()"`, `[disabled]="loading"`, text from `localization.Submit`.
  2. **Cancel button:** `design="Transparent"`, `[disabled]="loading"`, `(click)="CloseDialog()"`, text from `localization.Cancel`.
- Both buttons are disabled while `loading === true` to prevent double-submission.

---

## API Calls

| HTTP Method | Endpoint | When called | Payload / Query params | What happens with response |
|---|---|---|---|---|
| POST | `{ServerApi}/odata/ClientAreas` | `AddArea()` when `saveMode === 'POST'` and form is valid | `clientArea.toOdata()` — all `ClientArea` fields except `created_at` and `updated_at` (stripped by `toOdata()`) | On success: dialog closes, table refreshes, `'add'` toast shown. On error: dialog closes, `'error'` toast shown. |
| PUT | `{ServerApi}/odata/ClientAreas({id})` | `AddArea()` when `saveMode === 'PUT'` and form is valid | `clientArea.toOdata()` — same as above, with `id` embedded in the URL path | On success: dialog closes, table refreshes, `'edit'` toast shown. On error: dialog closes, `'error'` toast shown. |

The `isLodata: true` argument to both `commonService.post()` and `commonService.put()` instructs `CommonService` to prepend the OData URL prefix (`{ServerApi}/odata`).

---

## Validation Logic

| Field | Rule | State set on failure | State set on pass |
|---|---|---|---|
| `clientArea.name` | Must be truthy (non-empty, non-null, non-undefined) — checked by `validateForm()` on submit | `valueStateOptions.name = ValueState.Negative` | `valueStateOptions.name = ValueState.None` |
| `clientArea.name` | Must not be blank/whitespace-only — checked by `checkValidation()` on every keystroke | `valueStateOptions.name = ValueState.Negative` | `valueStateOptions.name = ValueState.None` |

There is only one validated field. The `is_active` switch has no validation rule (it has a boolean default of `true` and is always in a valid state).

When `validateForm()` returns `false`, `AddArea()` returns early without setting `loading = true` or making any API call.

---

## Services Injected

| Service | Why injected | Methods used |
|---|---|---|
| `CommonService` (`@app/services/common-service/common.service`) | Provides generic HTTP methods wrapping Angular's `HttpClient` with authentication headers and URL prefix management | `post(url, body, isLodata)` — for creating a new client area; `put(url, body, isLodata)` — for updating an existing client area |
| `ToastService` (`@app/services/toast-service/toast.service`) | Broadcasts toast notification events via an RxJS `Subject` that a global toast component listens to | `show(type: ToastType)` — called with `'add'`, `'edit'`, or `'error'` |

---

## Inter-component Communication

**To parent:**
- `@Output() RefreshTable: EventEmitter<any>` — emitted with no payload after a successful save; the parent subscribes and reloads its data table.
- `@Output() IsOpenToastAlert: EventEmitter<void>` — declared but never emitted in the current implementation; present for potential future use.

**From parent:**
- `@Input() saveMode` — parent sets this to `'POST'` when opening the dialog for a new record, or `'PUT'` when opening for an edit.
- `@Input() clientArea` — parent passes an existing `ClientArea` object for edit mode. For create mode the parent may rely on the default blank instance.
- The parent must also set the component's `open` property to `true` to open the dialog (this is a direct property assignment, not an `@Input`; the parent holds a template reference such as `@ViewChild(ClientAreaFormComponent)`).

**With services (global):**
- `ToastService` communicates via a shared `Subject` to a globally rendered toast component elsewhere in the app.

---

## Enums / Models Used

### `ClientArea` (`@shared/model/clientArea`)

Implements `Deserializable`.

| Property | Type | Default | Notes |
|---|---|---|---|
| `id` | `number \| undefined` | — | Used in PUT URL path as `ClientAreas({id})` |
| `is_active` | `boolean \| undefined` | `true` | Bound to the active switch |
| `name` | `string` | `''` | The only validated field; bound to the name input |
| `custom_id` | `string \| undefined` | — | Not used in this form's template |
| `created_at` | `string \| undefined` | — | Stripped from the API payload by `toOdata()` |
| `updated_at` | `string \| undefined` | — | Stripped from the API payload by `toOdata()` |

**`deserialize(input: any): this`** — uses `Object.assign(this, input)` to hydrate from a plain object. Passing `{}` resets to class defaults.

**`toOdata(): Object`** — spreads all properties but explicitly sets `created_at` and `updated_at` to `undefined`, so they are excluded from the API payload.

---

### `saveMode` enum (`@shared/enums/saveMode`)

```
GET | POST | PUT | PATCH | DELETE | REQUEST
```

Only `saveMode.POST` (`'POST'`) and `saveMode.PUT` (`'PUT'`) are used in this component.

---

### `Localization` constant (`@shared/utilities/localization`)

A plain object of Angular i18n `$localize` tagged strings. Keys used in this component:

| Key | Value |
|---|---|
| `Localization.New` | `"New"` |
| `Localization.Edit` | `"Edit"` |
| `Localization.Active` | `"Active"` |
| `Localization.Submit` | `"Submit"` |
| `Localization.Cancel` | `"Cancel"` |
| `Localization.requiredField` | `"This field is required."` |

---

### `ValueState` (`@shared/utilities/value-state-wrapper`)

Re-exported from `@ui5/webcomponents-base/dist/types/ValueState.js`. Values relevant to this component:

| Value | Effect on UI |
|---|---|
| `ValueState.None` | No visual indicator (default/clear state) |
| `ValueState.Negative` | Red error border and message on the `ui5-input` |

---

### `ToastType` (from `ToastService`)

Union type: `'save' | 'add' | 'edit' | 'delete' | 'remove' | 'read' | 'approve' | 'import' | 'export' | 'password' | 'download' | 'error' | 'exist'`

Values used in this component: `'add'`, `'edit'`, `'error'`.

---

## Key Business Logic

1. **Dual-mode form (POST / PUT):** The same dialog component handles both create and update. The parent controls which mode is active via the `saveMode` input. The dialog title, API method, URL, and toast type all switch accordingly. There is no separate edit or create dialog.

2. **`request$` guard:** After the POST/PUT branch assignments, the code checks `if (request$)` before subscribing. This is a safety guard — if `saveMode` is neither `'POST'` nor `'PUT'`, `request$` remains `undefined` and no subscription is attempted, silently doing nothing.

3. **State reset on every close path:** `CloseDialog()` is called from three places — success handler, error handler, and the `(before-close)` event. This ensures `loading`, `open`, `valueStateOptions.name`, and `clientArea` are always reset regardless of how the dialog is dismissed. However, in the error handler `this.open = false` is redundantly set before `CloseDialog()` is called (which also sets `open = false`).

4. **Two-layer name validation:** The name field is validated both on submit (`validateForm()`) and live on each keystroke (`checkValidation()`). The live check trims whitespace so a string of spaces is treated as invalid. The submit check does not trim — it checks the raw model value. This means a user who types spaces and then submits would pass `validateForm()` (spaces are truthy) but the live UI already shows an error. This is a minor inconsistency: the API would receive a whitespace-only name if the user bypassed the UI validation.

5. **`toOdata()` strips audit timestamps:** The API payload always excludes `created_at` and `updated_at`. These are managed server-side and must not be sent by the client.

6. **Dialog open mechanism:** The component does not expose an `@Input()` for `open`. The parent must obtain a reference to the component instance (typically via `@ViewChild`) and directly set `componentRef.open = true`. This is an implicit contract not enforced by Angular's input system.

7. **No `ngOnInit` / cleanup:** There are no subscriptions that outlive the method call (each `subscribe()` is a one-shot HTTP observable from `HttpClient`, which completes automatically), so no `ngOnDestroy` teardown is needed.
