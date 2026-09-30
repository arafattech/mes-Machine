# MACHINE_STATE_FORM_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| TypeScript file | `Frontend/src/app/modules/base-data-management/machine-management/machine-state/machine-state-form/machine-state-form.component.ts` |
| Template file | `Frontend/src/app/modules/base-data-management/machine-management/machine-state/machine-state-form/machine-state-form.component.html` |
| Selector | `app-machine-state-form` |
| Component type | Dialog Form |
| Purpose | Renders a UI5 modal dialog that allows users to either create a new machine state (POST) or update an existing machine state (PUT). The dialog exposes a toggle for the active flag and a required text input for the state name. On successful submission the dialog closes, triggers a table refresh in the parent, and shows a toast notification. |

---

## Inputs (@Input)

| Input name | Type | Default | Purpose |
|---|---|---|---|
| `saveMode` | `string` | `'POST'` | Controls whether the form performs a create (`'POST'`) or an update (`'PUT'`) operation. Compared against `saveMode` enum values at runtime. |
| `machineState` | `MachineState` | `new MachineState().deserialize({})` | The data model object that is two-way bound to the form fields. For POST the object starts empty; for PUT the parent pre-populates it with the existing record. |

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `IsOpenToastAlert` | `EventEmitter<void>` | Declared but not actively emitted in the current implementation. Reserved for triggering a toast alert in the parent component. |
| `RefreshTable` | `EventEmitter<any>` | Emitted after a successful POST or PUT response. Instructs the parent to refresh its data table. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `open` | `boolean` | `false` | Controls the `[open]` binding on the `<ui5-dialog>`. Set to `true` externally (by the parent) to open the dialog, and reset to `false` by `CloseDialog()`. |
| `loading` | `boolean` | `false` | Activates the `<ui5-busy-indicator>` and disables the Submit/Cancel toolbar buttons while an HTTP request is in-flight. |
| `ToastType` | `'add' \| 'edit' \| 'error'` | `'add'` | Tracks which toast message variant to show after the HTTP call completes. Set to `'add'` before a POST, `'edit'` before a PUT, and `'error'` in the error handler. |
| `validationMessage` | `string` | `Localization.requiredField` | The error message string displayed inside the UI5 value-state message slot when the name field fails validation. Resolves to the i18n string `"This field is required."`. |
| `valueState` | `typeof ValueState` | `ValueState` (namespace) | Class-level reference to the `@ui5/webcomponents-base` `ValueState` enum, exposed to the template so it can be used in future bindings. |
| `responseType` | `saveMode` | `saveMode.POST` | Declared but not actively used in logic. Appears to be a leftover property intended for tracking the last completed operation type. |
| `localization` | `typeof Localization` | `Localization` (object) | Exposes the full `Localization` constant map to the template for i18n strings (dialog header text, labels, button text). |
| `valueStateOptions` | `{ name: ValueState }` | `{ name: ValueState.None }` | Object holding the per-field value-state. `name` is bound to the UI5 input `[attr.value-state]` attribute and toggled between `ValueState.None` and `ValueState.Negative` during validation. |

---

## ViewChild / ViewChildren

None declared in this component.

---

## Lifecycle Hooks

No lifecycle hooks (`ngOnInit`, `ngOnDestroy`, `ngAfterViewInit`, etc.) are implemented. All initialisation relies on `@Input` default values and the `CloseDialog()` reset method.

---

## Methods — DETAILED

### `AddState(): void`

**Signature:** `AddState(): void`

**Step-by-step logic:**

1. Calls `this.validateForm()`. If it returns `false`, the method returns immediately — no HTTP call is made.
2. Sets `this.loading = true` to activate the busy indicator and disable buttons.
3. Declares local `url: string` and `request$` variables.
4. **Branch — POST:** If `this.saveMode === saveMode.POST` (`'POST'`):
   - Sets `url = 'MachineStates'`.
   - Sets `this.ToastType = 'add'`.
   - Assigns `request$` to `this.commonService.post(url, this.machineState.toOdata(), true)`.
5. **Branch — PUT:** If `this.saveMode === saveMode.PUT` (`'PUT'`):
   - Sets `url = 'MachineStates(${this.machineState.id})'` (OData key segment format).
   - Sets `this.ToastType = 'edit'`.
   - Assigns `request$` to `this.commonService.put(url, this.machineState.toOdata(), true)`.
6. If `request$` is defined (i.e., a recognised saveMode was matched), subscribes to the observable:
   - **`next` handler:** Calls `this.CloseDialog()`, emits `this.RefreshTable.emit()`, then calls `this.toastService.show(this.ToastType)` to display the success toast.
   - **`error` handler:** Sets `this.open = false`, calls `this.CloseDialog()`, then calls `this.toastService.show('error')` to display the error toast.

**Emits / returns:** Does not return a value. On success emits `RefreshTable`. On both success and error triggers toast via `ToastService`.

---

### `checkValidation(event: any): void`

**Signature:** `checkValidation(event: any): void`

**Step-by-step logic:**

1. Reads `event.target.value` (the raw input value from the DOM event).
2. Trims the value with `.trim()`.
3. If the trimmed value is falsy (empty string or whitespace only), sets `this.valueStateOptions.name = ValueState.Negative` — this causes the UI5 input to display the error state and the value-state message slot.
4. Otherwise, resets `this.valueStateOptions.name = ValueState.None` — removing the error state.

**Called by:** The `(input)` event on the `<ui5-input>` for the name field (fires on every keystroke).

**Emits / returns:** Nothing. Pure side-effect on `valueStateOptions.name`.

---

### `validateForm(): boolean`

**Signature:** `validateForm(): boolean`

**Step-by-step logic:**

1. Initialises `isValid = true`.
2. Checks `!this.machineState.name` (falsy check — catches `undefined`, `null`, empty string `''`).
3. If the name is falsy: sets `this.valueStateOptions.name = ValueState.Negative` and sets `isValid = false`.
4. Returns `isValid`.

**Note:** This is a submit-time validation that catches the case where the user submits without ever touching the name field (in which case `checkValidation` would not have fired yet).

**Emits / returns:** `boolean` — `true` if all fields pass, `false` if any field fails.

---

### `CloseDialog(): void`

**Signature:** `CloseDialog(): void`

**Step-by-step logic:**

1. Sets `this.open = false` — closes the UI5 dialog.
2. Sets `this.loading = false` — deactivates the busy indicator.
3. Resets `this.valueStateOptions.name = ValueState.None` — clears any validation error styling.
4. Resets `this.machineState = new MachineState().deserialize({})` — discards all form data and creates a fresh blank model.

**Called by:**
- The `(before-close)` event on `<ui5-dialog>` (triggered when the dialog is closed by any means including the ESC key or the browser back button via the UI5 shell).
- The Cancel button's `(click)` event.
- The `next` and `error` handlers inside `AddState()` (after HTTP call completes).

**Emits / returns:** Nothing.

---

## Template Bindings & Structure

```
<ui5-dialog>
  <ui5-busy-indicator>
    <section>
      <!-- Row 1: Active toggle -->
      <ui5-label>Active</ui5-label>
      <ui5-switch [(ngModel)]="machineState.is_active">

      <!-- Row 2: Name field -->
      <ui5-label required>Name</ui5-label>
      <ui5-input
        [(ngModel)]="machineState.name"
        (input)="checkValidation($event)"
        [attr.value-state]="valueStateOptions.name">
        <div slot="valueStateMessage">{{ validationMessage }}</div>
      </ui5-input>
    </section>
  </ui5-busy-indicator>

  <!-- Footer toolbar -->
  <ui5-toolbar slot="footer">
    <ui5-toolbar-button design="Emphasized" (click)="AddState()" [disabled]="loading">Submit</ui5-toolbar-button>
    <ui5-toolbar-button design="Transparent" (click)="CloseDialog()" [disabled]="loading">Cancel</ui5-toolbar-button>
  </ui5-toolbar>
</ui5-dialog>
```

**Key bindings and behaviors:**

- **Dialog open state:** `[open]="open"` — the dialog is shown/hidden by setting the `open` property from outside (parent component) or from `CloseDialog()`.
- **Dialog header text:** `[attr.header-text]` is conditionally set: if `saveMode === 'POST'` it shows `localization.New` ("New"), otherwise `localization.Edit` ("Edit").
- **before-close event:** `(before-close)="CloseDialog()"` — hooks into the UI5 dialog's native close lifecycle to always reset the form state even when the dialog is closed by non-button means (ESC key, backdrop click).
- **Busy indicator:** `[active]="loading"` and `[delay]="0"` — immediately activates the spinner overlay on the form section whenever `loading` is `true`.
- **Active switch:** `[(ngModel)]="machineState.is_active"` — two-way binding on the boolean `is_active` field. Defaults to `true` on a new record (per the `MachineState` model default).
- **Name input:** `[(ngModel)]="machineState.name"` two-way binding. `(input)` fires `checkValidation` on every keystroke. `[attr.value-state]="valueStateOptions.name"` applies UI5 `ValueState.Negative` styling when validation fails. The `slot="valueStateMessage"` div shows `validationMessage` ("This field is required.") in the UI5 error popover beneath the input.
- **Submit button:** `design="Emphasized"` (primary style). Bound to `(click)="AddState()"`. Disabled while `loading` is `true`.
- **Cancel button:** `design="Transparent"`. Bound to `(click)="CloseDialog()"`. Also disabled while `loading` is `true` to prevent closing mid-request (though `CloseDialog()` is also called in both `next` and `error` handlers).

---

## API Calls

| HTTP Method | Endpoint | When called | Payload / Query params | What happens with response |
|---|---|---|---|---|
| `POST` | `MachineStates` | `AddState()` when `saveMode === 'POST'` and form is valid | Body: `machineState.toOdata()` — full `MachineState` object minus `created_at` and `updated_at`; third arg `true` signals to `CommonService` to use OData base URL | On success: dialog closes, `RefreshTable` emits, success toast shown. On error: dialog closes, error toast shown. |
| `PUT` | `MachineStates(${id})` | `AddState()` when `saveMode === 'PUT'` and form is valid | Body: `machineState.toOdata()` — same shape as POST; URL contains OData key predicate with the record's `id` | On success: dialog closes, `RefreshTable` emits, edit toast shown. On error: dialog closes, error toast shown. |

**Authentication:** Both calls go through `CommonService`, which reads `localStorage.getItem('remember_token')` and injects it as the `Authorization: Bearer <token>` header automatically.

---

## Validation Logic

| Field | Rule | Trigger | State on failure | State cleared when |
|---|---|---|---|---|
| `name` | Must be non-empty (not falsy) | `validateForm()` on submit | `valueStateOptions.name = ValueState.Negative` — UI5 input renders in error/negative visual state; value-state message slot displays "This field is required." | When `checkValidation()` detects a non-empty value on the next keystroke, or when `CloseDialog()` resets `valueStateOptions.name` to `ValueState.None` |
| `name` | Must not be blank/whitespace | `checkValidation(event)` on every `(input)` event | Same as above — `ValueState.Negative` | When user types a non-whitespace character |

**Note:** The `is_active` switch has no validation — it defaults to `true` and any boolean value is acceptable.

---

## Services Injected

| Service | Why injected | Methods used |
|---|---|---|
| `CommonService` (`@app/services/common-service/common.service`) | Provides authenticated HTTP wrappers over Angular's `HttpClient` | `post(url, body, isOdata)` — sends a POST request; `put(url, body, isOdata)` — sends a PUT request. Both methods inject the Bearer token header from `localStorage`. |
| `ToastService` (`@app/services/toast-service/toast.service`) | Displays application-level toast notifications | `show(type: ToastType)` — accepts `'add'`, `'edit'`, or `'error'` and broadcasts the notification via an RxJS `Subject`. |

---

## Inter-component Communication

| Direction | Mechanism | Details |
|---|---|---|
| Parent → this | `@Input() saveMode` | Parent sets `'POST'` for create or `'PUT'` for update. |
| Parent → this | `@Input() machineState` | Parent passes a pre-populated `MachineState` object for edit mode; for create mode the default blank object is used. |
| Parent → this | Direct property access | Parent is expected to set `component.open = true` (via a `@ViewChild` or template reference variable) to open the dialog. |
| This → Parent | `@Output() RefreshTable` | Emitted with no payload after a successful save (POST or PUT). Parent should re-fetch and re-render its machine state list. |
| This → Parent | `@Output() IsOpenToastAlert` | Declared but not emitted in current code. Intended inter-component communication channel for toast alerts. |
| This → Global | `ToastService` | Toast notifications are dispatched through the shared `ToastService` subject, which any subscribed component in the app can observe. |

---

## Enums / Models Used

### `MachineState` (`@shared/model/machineState`)

Implements `Deserializable`.

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | `number \| undefined` | `undefined` | Database primary key. Required in PUT URL path. |
| `is_active` | `boolean \| undefined` | `true` | Active/inactive status flag. |
| `name` | `string \| undefined` | `''` | Human-readable state name. Required field. |
| `custom_id` | `string \| undefined` | `undefined` | Optional custom identifier. |
| `created_at` | `string \| undefined` | `undefined` | Server-managed timestamp; excluded from API payloads by `toOdata()`. |
| `updated_at` | `string \| undefined` | `undefined` | Server-managed timestamp; excluded from API payloads by `toOdata()`. |

**`deserialize(input)`:** Uses `Object.assign(this, input)` to hydrate the model from a plain object.

**`toOdata()`:** Returns a spread of all fields with `created_at` and `updated_at` set to `undefined` (so they are omitted from serialised JSON payload).

---

### `saveMode` enum (`@shared/enums/saveMode`)

| Key | Value |
|---|---|
| `GET` | `'GET'` |
| `POST` | `'POST'` |
| `PUT` | `'PUT'` |
| `PATCH` | `'PATCH'` |
| `DELETE` | `'DELETE'` |
| `REQUEST` | `'REQUEST'` |

Only `saveMode.POST` and `saveMode.PUT` are used in this component.

---

### `ValueState` (`@ui5/webcomponents-base/dist/types/ValueState.js`)

Re-exported via `@shared/utilities/value-state-wrapper`. Key values used in this component:

| Value | Effect on UI5 input |
|---|---|
| `ValueState.None` | Default — no highlight, no message |
| `ValueState.Negative` | Red/error state — shows error icon and value-state message popover |

---

### `Localization` (`@shared/utilities/localization`)

A constant object of i18n string tokens using Angular's `$localize` tagged template. Keys used in this component:

| Key | English value |
|---|---|
| `Localization.New` | `"New"` |
| `Localization.Edit` | `"Edit"` |
| `Localization.Active` | `"Active"` |
| `Localization.Submit` | `"Submit"` |
| `Localization.Cancel` | `"Cancel"` |
| `Localization.requiredField` | `"This field is required."` |

---

## Key Business Logic

1. **Dual-mode form (create vs. edit):** The `saveMode` input string is compared directly against `saveMode.POST` and `saveMode.PUT` string enum values. The parent must pass the correct string value and pre-populate `machineState.id` for edit mode, since the PUT URL is constructed as `MachineStates(${this.machineState.id})` using OData key-predicate syntax.

2. **Dialog open mechanism:** The `open` property is `false` by default and is not toggled by any `@Input()`. The parent component must obtain a reference to this component (via `@ViewChild` or a template reference variable) and set `componentRef.open = true` directly. This is a deliberate pattern for programmatic dialog control without an Input binding.

3. **Form reset on every close:** `CloseDialog()` always creates a brand-new `MachineState` instance (`new MachineState().deserialize({})`), ensuring that no stale data leaks between dialog sessions. This means that if a user opens the dialog for editing, then closes without saving, and the parent opens it again for a different record, the old record data will be gone — the parent is responsible for re-setting the `machineState` input before reopening.

4. **Submit button disabled during request:** Both the Submit and Cancel buttons have `[disabled]="loading"`. This prevents double-submission and prevents premature cancellation. However, `CloseDialog()` is called in both `next` and `error` handlers, so the dialog will close and `loading` will reset regardless of outcome.

5. **Third `true` argument to `commonService.post/put`:** This argument signals that the request should use the OData API base URL (as opposed to a plain REST base URL). The URL segments (`'MachineStates'` and `'MachineStates(id)'`) are OData-style resource paths appended to the OData API prefix configured in `CommonService`.

6. **`CUSTOM_ELEMENTS_SCHEMA`:** Imported in the component decorator imports array (listed in the `@Component` metadata). This is required because the template uses SAP UI5 Web Components (`<ui5-dialog>`, `<ui5-input>`, etc.), which are custom HTML elements not known to Angular's default schema validator.

7. **`IsOpenToastAlert` output is unused:** The `IsOpenToastAlert` `EventEmitter` is declared and exported but never emitted anywhere in the component. The toast is handled directly through `ToastService.show()` instead. This output may be a legacy remnant from an earlier implementation or reserved for future use.
