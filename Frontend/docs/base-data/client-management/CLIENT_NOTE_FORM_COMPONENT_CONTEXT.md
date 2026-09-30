# CLIENT_NOTE_FORM_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| TypeScript file | `Frontend/src/app/modules/base-data-management/client-management/client-notes/client-note-form/client-note-form.component.ts` |
| Template file | `Frontend/src/app/modules/base-data-management/client-management/client-notes/client-note-form/client-note-form.component.html` |
| Styles file | `client-note-form.component.scss` |
| Selector | `app-client-note-form` |
| Component type | Form / Dialog |
| Purpose | Renders a UI5 modal dialog that allows a user to create a new client note (POST) or edit an existing one (PUT). The dialog captures a note name and its active status, performs inline validation on the name field, then submits the data to the OData API. On success it closes itself and signals the parent to refresh its data table. |

---

## Inputs (@Input)

| Input name | Type | Default | Purpose |
|---|---|---|---|
| `saveMode` | `string` | `'POST'` | Determines the HTTP verb used on submit. Accepts `'POST'` (create) or `'PUT'` (update). Controls both the API request type and the dialog header text (`New` vs `Edit`). |
| `clientNote` | `ClientNote` | `new ClientNote().deserialize({})` | The data model bound to the form fields. For a POST flow the parent passes an empty/default object; for a PUT flow the parent passes the record to be edited (pre-populated with existing values). |

---

## Outputs (@Output)

| Output name | Event type | Purpose |
|---|---|---|
| `IsOpenToastAlert` | `EventEmitter<void>` | Declared but not emitted anywhere in the current codebase. Reserved / legacy output. |
| `RefreshTable` | `EventEmitter<any>` | Emitted after a successful POST or PUT response. Signals the parent component to reload its data table. No payload is emitted. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `open` | `boolean` | `false` | Controls the `[open]` binding on the `ui5-dialog`. Set to `true` externally (by the parent calling `component.open = true`) to show the dialog, and reset to `false` inside `CloseDialog()`. |
| `loading` | `boolean` | `false` | Drives the `[active]` attribute of `ui5-busy-indicator` and the `[disabled]` attribute of both toolbar buttons. Set to `true` at the start of an API call, reset to `false` in `CloseDialog()`. |
| `ToastType` | `'add' \| 'edit' \| 'error'` | `'add'` | Determines which toast message variant is shown after the API call completes. Set to `'add'` before a POST, `'edit'` before a PUT, or `'error'` on any HTTP error. |
| `validationMessage` | `string` | `Localization.requiredField` | Static message (`"This field is required."`) displayed inside the `valueStateMessage` slot of the name input when validation fails. |
| `valueState` | `typeof ValueState` | `ValueState` (class ref) | Reference to the UI5 `ValueState` enum exposed for use in the template (not used directly in the template; `valueStateOptions` is used instead). |
| `responseType` | `saveMode` | `saveMode.POST` | Declared but not used in any template binding or method logic in the current code. |
| `localization` | `typeof Localization` | `Localization` | Reference to the shared `Localization` object, exposed to the template for i18n string access (e.g., `localization.New`, `localization.Edit`, `localization.Submit`). |
| `valueStateOptions` | `{ name: ValueState }` | `{ name: ValueState.None }` | Holds the current validation state of the name input. `name` maps directly to `[attr.value-state]` on `ui5-input`. Set to `ValueState.Negative` on failure, `ValueState.None` on pass. |

---

## ViewChild / ViewChildren

None. The component does not declare any `@ViewChild` or `@ViewChildren` references.

---

## Lifecycle Hooks

No lifecycle hooks are implemented (`ngOnInit`, `ngOnDestroy`, `ngAfterViewInit`, etc. are all absent). All initialization is handled by Angular's property initializers and the class constructor.

---

## Methods — DETAILED

### `AddNote(): void`

**Purpose:** Main form submission handler. Validates the form, then performs a POST or PUT API call.

**Step-by-step logic:**

1. Calls `this.validateForm()`. If it returns `false` (name field is empty), the method returns immediately — no API call is made.
2. Sets `this.loading = true` to disable buttons and show the busy indicator.
3. Initializes an empty `url` string and a `request$` observable variable.
4. Checks `this.saveMode`:
   - If `saveMode.POST` (`'POST'`): sets `url = 'ClientNotes'`, sets `this.ToastType = 'add'`, and assigns `request$` to `this.commonService.post(url, this.clientNote.toOdata(), true)`. The third argument `true` routes the request through the OData prefix (`/odata/ClientNotes`).
   - If `saveMode.PUT` (`'PUT'`): sets `url = 'ClientNotes(${this.clientNote.id})'` (OData key-predicate format), sets `this.ToastType = 'edit'`, and assigns `request$` to `this.commonService.put(url, this.clientNote.toOdata(), true)`.
5. If `request$` is defined (i.e., saveMode was POST or PUT), subscribes to it:
   - **`next` handler:** Calls `this.CloseDialog()`, emits `this.RefreshTable.emit()`, then calls `this.toastService.show(this.ToastType)` to display a success toast.
   - **`error` handler:** Sets `this.open = false`, calls `this.CloseDialog()`, then calls `this.toastService.show('error')` to display an error toast.

**Emits:** `RefreshTable` (on success).

**Side effects:** Mutates `loading`, `open`, `ToastType`; triggers toast notification.

---

### `checkValidation(event: any): void`

**Purpose:** Real-time inline validation triggered on each `input` event from the name field.

**Step-by-step logic:**

1. Reads `event.target.value` (the current input string).
2. If `value.trim()` is falsy (empty or whitespace-only), sets `this.valueStateOptions.name = ValueState.Negative` — the UI5 input renders a red error border and shows the `valueStateMessage` slot.
3. Otherwise, sets `this.valueStateOptions.name = ValueState.None` — the error state is cleared.

**Returns:** `void`. No emissions.

---

### `validateForm(): boolean`

**Purpose:** Pre-submission validation. Called by `AddNote()` before any API interaction.

**Step-by-step logic:**

1. Initializes `isValid = true`.
2. Checks `this.clientNote.name`. If falsy (empty string, `null`, or `undefined`), sets `this.valueStateOptions.name = ValueState.Negative` and sets `isValid = false`.
3. Returns `isValid`.

**Note:** Only the `name` field is validated. The `is_active` field is a boolean toggle and requires no validation.

---

### `CloseDialog(): void`

**Purpose:** Resets all dialog state to its default values and closes the dialog.

**Step-by-step logic:**

1. Sets `this.open = false` — closes the UI5 dialog.
2. Sets `this.loading = false` — re-enables the toolbar buttons.
3. Sets `this.valueStateOptions.name = ValueState.None` — clears any validation error state on the name input.
4. Resets `this.clientNote = new ClientNote().deserialize({})` — discards all user edits by replacing the bound model with a fresh default instance.

**Triggered by:** The `(before-close)` event of `ui5-dialog`, the Cancel button `(click)` handler, and internally by `AddNote()` on both success and error.

---

## Template Bindings & Structure

The template is a single `ui5-dialog` element. Structure breakdown:

```
ui5-dialog [open]="open" [header-text]="New | Edit"
  └── ui5-busy-indicator [active]="loading"
        └── section
              ├── div.col-md-12          (Active toggle row)
              │     ├── ui5-label        "Active"
              │     └── ui5-switch       [(ngModel)]="clientNote.is_active"
              ├── ui5-label (required)   "Note Name"
              └── ui5-input              [(ngModel)]="clientNote.name"
                    └── div[slot=valueStateMessage]  validation message text
  └── ui5-toolbar [slot="footer"]
        ├── ui5-toolbar-button (Submit)  (click)="AddNote()"
        └── ui5-toolbar-button (Cancel) (click)="CloseDialog()"
```

**Key bindings:**

| Element | Binding | Details |
|---|---|---|
| `ui5-dialog` | `[open]="open"` | Shows/hides the dialog. |
| `ui5-dialog` | `[attr.header-text]` | Ternary: `saveMode === 'POST' ? localization.New : localization.Edit` |
| `ui5-dialog` | `(before-close)="CloseDialog()"` | Fires when the dialog requests closing (e.g., ESC key). Resets state. |
| `ui5-busy-indicator` | `[active]="loading"` `[delay]="0"` `size="M"` | Overlays the form content with a spinner immediately when `loading` is true. |
| `ui5-switch` | `[(ngModel)]="clientNote.is_active"` | Two-way binding to the `is_active` boolean field. |
| `ui5-input` | `[(ngModel)]="clientNote.name"` | Two-way binding to the `name` string field. |
| `ui5-input` | `(input)="checkValidation($event)"` | Fires on every keystroke for real-time validation. |
| `ui5-input` | `[attr.value-state]="valueStateOptions.name"` | Reflects `ValueState.None` or `ValueState.Negative` as a DOM attribute. |
| `ui5-input > div[slot]` | Static text | Displays `validationMessage` (`"This field is required."`) inside the UI5 value-state message popup. |
| Submit button | `[disabled]="loading"` `(click)="AddNote()"` `design="Emphasized"` | Blocked during API call; triggers save logic. |
| Cancel button | `[disabled]="loading"` `(click)="CloseDialog()"` `design="Transparent"` | Blocked during API call; closes and resets the dialog. |

The CSS class `ui5-xl-without-tab` on the dialog is a project-level utility class (likely sets a large dialog width without tab strip styling). The form section uses Bootstrap's `col-md-12` for full-width layout.

---

## API Calls

| HTTP Method | Endpoint | When called | Payload / Query params | Response handling |
|---|---|---|---|---|
| `POST` | `/odata/ClientNotes` | `AddNote()` when `saveMode === 'POST'` and form is valid | `clientNote.toOdata()` — all `ClientNote` fields except `created_at` and `updated_at` (stripped by `toOdata()`) | On success: closes dialog, emits `RefreshTable`, shows `'add'` toast. On error: closes dialog, shows `'error'` toast. |
| `PUT` | `/odata/ClientNotes({id})` | `AddNote()` when `saveMode === 'PUT'` and form is valid | `clientNote.toOdata()` — same serialization as POST | On success: closes dialog, emits `RefreshTable`, shows `'edit'` toast. On error: closes dialog, shows `'error'` toast. |

The third argument (`true`) passed to `commonService.post()` and `commonService.put()` routes requests to the OData URL prefix (`environment.ServerApi + '/odata'`).

---

## Validation Logic

| Field | Rule | Trigger | State on failure | State on pass |
|---|---|---|---|---|
| `clientNote.name` | Must be non-empty/non-null | `AddNote()` submit (via `validateForm()`) | `valueStateOptions.name = ValueState.Negative`; form submission aborted | `valueStateOptions.name = ValueState.None` |
| `clientNote.name` | Must be non-empty/non-whitespace | `(input)` event (via `checkValidation()`) | `valueStateOptions.name = ValueState.Negative` | `valueStateOptions.name = ValueState.None` |

`is_active` has no validation — it is a boolean toggle with a safe default of `true`.

**Important distinction:** `validateForm()` uses a falsy check (`!this.clientNote.name`) which catches `null`, `undefined`, and empty string `''`. `checkValidation()` uses `.trim()` which additionally catches whitespace-only strings. There is no trim applied during submit validation — a name consisting solely of spaces would pass `validateForm()` but would be flagged by `checkValidation()` during typing.

---

## Services Injected

| Service | Why injected | Methods used |
|---|---|---|
| `CommonService` | HTTP abstraction layer for API communication | `post(url, body, isLodata)` — sends POST request to OData endpoint. `put(url, body, isLodata)` — sends PUT request to OData endpoint. |
| `ToastService` | Displays brief user-facing notifications after API operations | `show(type: ToastType)` — called with `'add'`, `'edit'`, or `'error'` to display the appropriate toast message. |

---

## Inter-component Communication

| Direction | Mechanism | Details |
|---|---|---|
| Parent → Child | `@Input() saveMode` | Parent sets `'POST'` or `'PUT'` before opening the dialog. |
| Parent → Child | `@Input() clientNote` | Parent injects a pre-populated `ClientNote` instance for edit flows, or omits it to use the default empty instance for create flows. |
| Parent → Child | Direct property access | Parent sets `component.open = true` on its template reference variable to open the dialog (since `open` is a public property, not an `@Input()`). |
| Child → Parent | `@Output() RefreshTable` | Emitted on successful POST or PUT. Parent listens to trigger a data table reload. |
| Child → Parent | `@Output() IsOpenToastAlert` | Declared but not currently emitted. |

---

## Enums / Models Used

### `ClientNote` (`@shared/model/clientNote`)

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | `number \| undefined` | `undefined` | Used in PUT URL as the OData key predicate `ClientNotes(id)`. |
| `is_active` | `boolean \| undefined` | `true` | Bound to `ui5-switch`. |
| `custom_id` | `string \| undefined` | `undefined` | Not surfaced in the form UI. Passed through in `toOdata()`. |
| `name` | `string` | `''` | Primary editable field. Required. Bound to `ui5-input`. |
| `created_at` | `string \| undefined` | `undefined` | Excluded from API payload by `toOdata()`. |
| `updated_at` | `string \| undefined` | `undefined` | Excluded from API payload by `toOdata()`. |

**`deserialize(input)`:** Shallow-copies all input fields onto the instance via `Object.assign`.

**`toOdata()`:** Returns a spread of all fields with `created_at` and `updated_at` set to `undefined` (effectively omitting them from the serialized JSON body).

### `saveMode` enum (`@shared/enums/saveMode`)

| Value | String |
|---|---|
| `saveMode.GET` | `'GET'` |
| `saveMode.POST` | `'POST'` |
| `saveMode.PUT` | `'PUT'` |
| `saveMode.PATCH` | `'PATCH'` |
| `saveMode.DELETE` | `'DELETE'` |
| `saveMode.REQUEST` | `'REQUEST'` |

Only `POST` and `PUT` are handled by this component.

### `ValueState` (`@ui5/webcomponents-base/dist/types/ValueState.js`)

Re-exported from `@shared/utilities/value-state-wrapper`. UI5 enum values used:

- `ValueState.None` — default, no visual state indicator.
- `ValueState.Negative` — red/error state on the input field.

### `Localization` (`@shared/utilities/localization`)

Static object of i18n-tagged template literals. Keys used by this component:

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

1. **Dialog open/close pattern:** The `open` property is public but not an `@Input()`. The parent template is expected to obtain a reference to the component instance (via `#ref` variable) and set `ref.open = true` directly. Closing is managed entirely inside the component via `CloseDialog()`.

2. **State reset on close:** `CloseDialog()` always replaces `this.clientNote` with a freshly deserialized empty instance. This means any partially entered data is discarded when the dialog is closed — either by the user pressing Cancel, pressing ESC (via `before-close`), or after a successful/failed submission. There is no draft-preservation behavior.

3. **Dual error-close path:** In the `error` handler of `AddNote()`, `this.open = false` is set explicitly before calling `CloseDialog()` (which also sets `this.open = false`). This is redundant but harmless.

4. **`IsOpenToastAlert` is unused:** The output is declared and wired into the component metadata but `emit()` is never called on it anywhere in the component. It may be a legacy artifact from an earlier implementation where the parent handled toast display.

5. **`responseType` property is unused:** Initialized to `saveMode.POST` but never read, mutated, or bound in the template. Likely dead code from an earlier iteration.

6. **Whitespace name edge case:** A name consisting solely of spaces (e.g., `"   "`) will pass the submit-time `validateForm()` check (falsy check on raw string) but will be caught during typing by `checkValidation()` (uses `.trim()`). If a user types spaces and then clicks Submit without triggering an `input` event after the last space, the form can submit a whitespace-only name to the API. No server-side error handling specific to this case is present in the component.

7. **OData key-predicate format:** For PUT requests, the URL is constructed as `ClientNotes(${this.clientNote.id})` — the standard OData v4 single-entity addressing format. If `clientNote.id` is `undefined` in a PUT flow (e.g., due to a parent misconfiguration), the URL becomes `ClientNotes(undefined)`, which would result in a 404 or 400 from the server.

8. **`custom_id` is not generated here:** The `ClientNote` model has a `custom_id` field, but this component makes no call to `CommonService.getCustomId()`. Custom ID generation (if any) is the responsibility of the parent or the server.
