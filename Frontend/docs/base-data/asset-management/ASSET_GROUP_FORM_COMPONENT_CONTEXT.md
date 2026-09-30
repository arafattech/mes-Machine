# ASSET_GROUP_FORM_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| TypeScript file | `Frontend/src/app/modules/base-data-management/asset-management/asset-group/asset-group-form/asset-group-form.component.ts` |
| Template file | `Frontend/src/app/modules/base-data-management/asset-management/asset-group/asset-group-form/asset-group-form.component.html` |
| Stylesheet | `asset-group-form.component.scss` |
| Selector | `app-asset-group-form` |
| Component type | Form / Dialog |
| Purpose | Renders a SAP UI5 modal dialog that allows the user to create a new Asset Group (POST) or update an existing one (PUT). It owns the form state (`assetGroup`), controls dialog open/close, validates the name field, submits data to the OData API via `CommonService`, displays a toast notification on success or error, and emits a `RefreshTable` event to the parent so the parent list can reload. |

---

## Inputs (@Input)

| Input name | Type | Default | Purpose |
|---|---|---|---|
| `saveMode` | `string` | `'POST'` | Determines whether the dialog is in "create" mode (`'POST'`) or "edit" mode (`'PUT'`). When set to `'PUT'` before the parent calls `open = true`, the component expects `assetGroup` to have been populated externally (e.g., the parent sets `assetGroup` fields directly on the component ref). Controls the dialog header text and the API method used on submit. |

> Note: `saveMode` is typed as a plain `string` at the `@Input()` level but is compared at runtime against the `saveMode` enum string values (`'POST'` and `'PUT'`). The class-level `responseType` property (type `saveMode` enum) is declared but not actively updated from the input — the input string is compared directly.

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `RefreshTable` | `EventEmitter<any>` | Emitted after a successful POST or PUT API response, carrying no payload (`emit()` called with no argument). The parent component should listen to this event and reload its data table. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `assetGroup` | `AssetGroup` | `new AssetGroup()` | The model object bound to the form fields. Holds `id`, `name`, `is_active`, `custom_id`, `created_at`, `updated_at`. Two-way bound to inputs in the template. |
| `open` | `boolean` | `false` | Controls whether the `ui5-dialog` is visible. Must be set to `true` externally (by the parent) to open the dialog. |
| `loading` | `boolean` | `false` | Drives the `ui5-busy-indicator` active state and disables both toolbar buttons while an API request is in flight. |
| `ToastType` | `'add' \| 'edit' \| 'error'` | `'add'` | Tracks which toast variant to display after the API call completes. Set to `'add'` on POST, `'edit'` on PUT, `'error'` on API error. |
| `validationMessage` | `string` | `Localization.requiredField` ("This field is required.") | The message shown inside the UI5 value-state slot when the name field fails validation. |
| `valueState` | `typeof ValueState` | `ValueState` (re-exported from `@ui5/webcomponents-base`) | Class reference exposed to the template for value-state enum lookups (e.g., `valueState.None`, `valueState.Negative`). Not directly used in this template — `valueStateOptions.name` string is bound instead. |
| `responseType` | `saveMode` | `saveMode.POST` | Declared but not functionally updated or used in this component's current implementation. Reserved for potential future use. |
| `localization` | `typeof Localization` | `Localization` | Reference to the global localization object, exposed to the template for i18n string access (e.g., `localization.New`, `localization.Edit`, `localization.Submit`, `localization.Cancel`, `localization.Active`). |
| `valueStateOptions` | `{ name: ValueState }` | `{ name: ValueState.None }` | Object holding per-field value-state strings. Currently only tracks the `name` field. Bound to `[attr.value-state]` on the name `ui5-input`. |

---

## ViewChild / ViewChildren

None. The component does not use any `@ViewChild` or `@ViewChildren` references.

---

## Lifecycle Hooks

This component does not implement any Angular lifecycle hooks (`ngOnInit`, `ngOnDestroy`, `ngAfterViewInit`, etc.). All initialization is handled by class field initializers and the constructor.

### Constructor

Injects two services:
- `CommonService` (private) — used for HTTP calls.
- `ToastService` (private) — used to trigger toast notifications.

---

## Methods — DETAILED

### `addAssetGroup(): void`

**Signature:** `addAssetGroup(): void`

**Purpose:** Entry point for form submission. Validates the form, builds the correct API request based on `saveMode`, submits it, and handles both success and error responses.

**Step-by-step logic:**

1. Calls `this.validateForm()`. If it returns `false`, the method returns early — no API call is made.
2. Sets `this.loading = true` to activate the busy indicator and disable toolbar buttons.
3. Initializes a local `url` string (empty) and a local `request$` observable (undefined).
4. Checks `this.saveMode`:
   - If `=== saveMode.POST` (`'POST'`):
     - Sets `url = 'AssetGroups'`.
     - Sets `this.ToastType = 'add'`.
     - Assigns `request$` to `this.commonService.post(url, this.assetGroup.toOdata(), true)` — a POST to `odata/AssetGroups`.
   - Else if `=== saveMode.PUT` (`'PUT'`):
     - Sets `url = 'AssetGroups(' + this.assetGroup.id + ')'` — OData key-segment format.
     - Sets `this.ToastType = 'edit'`.
     - Assigns `request$` to `this.commonService.put(url, this.assetGroup.toOdata(), true)` — a PUT to `odata/AssetGroups({id})`.
5. If `request$` is defined (truthy), subscribes:
   - **`next` handler:** Calls `this.CloseDialog()` (resets state, closes dialog), emits `this.RefreshTable.emit()` (tells parent to reload), then calls `this.toastService.show(this.ToastType)`.
   - **`error` handler:** Logs the error to `console.error`, calls `this.CloseDialog()`, calls `this.toastService.show('error')`.

**Side effects:** Modifies `loading`, `ToastType`; closes dialog on completion; emits `RefreshTable`; triggers a global toast notification.

**Returns:** `void`.

---

### `checkValidation(event: any): void`

**Signature:** `checkValidation(event: any): void`

**Purpose:** Real-time inline validation triggered on every `input` event from the name field. Provides immediate user feedback while typing.

**Step-by-step logic:**

1. Reads `event.target.value` (the current raw input string).
2. If `value.trim()` is falsy (empty or whitespace-only):
   - Sets `this.valueStateOptions.name = ValueState.Negative` — turns the input border red and shows the value-state message slot.
3. Else:
   - Sets `this.valueStateOptions.name = ValueState.None` — clears the error state.

**Side effects:** Updates `valueStateOptions.name`, which is bound via `[attr.value-state]` on the UI5 input in the template.

**Returns:** `void`.

---

### `validateForm(): boolean`

**Signature:** `validateForm(): boolean`

**Purpose:** Pre-submission validation. Checks all required fields before an API call is allowed to proceed.

**Step-by-step logic:**

1. Initializes `isValid = true`.
2. Checks `!this.assetGroup.name` (falsy: `undefined`, `null`, empty string `''`):
   - If falsy: sets `this.valueStateOptions.name = ValueState.Negative`, sets `isValid = false`.
3. Returns `isValid`.

**Note:** Only the `name` field is validated. `is_active` is not validated (it defaults to `true` and is a boolean switch).

**Returns:** `true` if all validations pass, `false` if any fail.

---

### `CloseDialog(): void`

**Signature:** `CloseDialog(): void`

**Purpose:** Resets all dialog state and closes the dialog. Called on successful API response, on API error, and when the user clicks Cancel or the dialog fires its `before-close` event.

**Step-by-step logic:**

1. Sets `this.open = false` — hides the dialog.
2. Sets `this.loading = false` — deactivates busy indicator.
3. Sets `this.valueStateOptions.name = ValueState.None` — clears any validation error state.
4. Sets `this.assetGroup = new AssetGroup().deserialize({})` — resets the model to a fresh default instance (name: `''`, is_active: `true`, id: `undefined`, etc.).

**Side effects:** Resets `open`, `loading`, `valueStateOptions`, and `assetGroup` back to their initial states.

**Returns:** `void`.

---

## Template Bindings & Structure

The template is a single `ui5-dialog` component that wraps the form content and a footer toolbar.

### Root element: `<ui5-dialog>`

- `[open]="open"` — property binding; dialog visibility is controlled by the `open` boolean state property.
- `class="ui5-xl-without-tab"` — CSS class for dialog sizing/styling.
- `[attr.header-text]` — attribute binding that sets the dialog title dynamically:
  - If `saveMode === 'POST'` → `localization.New` ("New")
  - Otherwise → `localization.Edit` ("Edit")
- `(before-close)="CloseDialog()"` — listens to the UI5 dialog's native before-close event (e.g., pressing Escape) and calls `CloseDialog()` to reset state.

### Busy Indicator: `<ui5-busy-indicator>`

- `[delay]="0"` — no delay before the spinner appears.
- `[active]="loading"` — activates the overlay spinner while `loading` is `true`.
- `size="M"` — medium spinner size.
- `class="w-full"` — full width.

Wraps the form `<section>` so the entire form content is covered during API calls.

### Form Section: `<section class="w-full">`

Contains two form controls:

#### 1. Active Toggle (`<div class="col-md-12">`)

- `<ui5-label showColon class="w-100">{{ localization.Active }}</ui5-label>` — displays the localized label "Active" with a colon.
- `<ui5-switch checked [(ngModel)]="assetGroup.is_active"></ui5-switch>` — two-way data binding to `assetGroup.is_active`. The `checked` attribute sets the initial checked state; `ngModel` keeps it in sync.

#### 2. Asset Group Name Input

- `<ui5-label show-colon required i18n>Asset Group Name</ui5-label>` — displays the label with a required marker (asterisk) and colon. Marked with `i18n` for Angular internationalization extraction.
- `<ui5-input>`:
  - `class="w-100"` — full width.
  - `[(ngModel)]="assetGroup.name"` — two-way binding to `assetGroup.name`.
  - `placeholder="Enter asset group name"` — placeholder text (also `i18n-placeholder` for i18n).
  - `(input)="checkValidation($event)"` — fires real-time validation on every keystroke.
  - `[attr.value-state]="valueStateOptions.name"` — attribute binding that sets the UI5 value state (`'None'` or `'Negative'`).
  - `type="Text"` — input type.
  - Inner `<div slot="valueStateMessage">{{ validationMessage }}</div>` — shown inside the UI5 input's value-state message popup when the state is `'Negative'`. Displays the `validationMessage` string ("This field is required.").

### Footer: `<ui5-toolbar slot="footer">`

Placed in the dialog's footer slot. Contains two buttons:

- **Submit button** (`<ui5-toolbar-button design="Emphasized">`):
  - `(click)="addAssetGroup()"` — calls the submit method.
  - `[disabled]="loading"` — disabled while API call is in progress.
  - `text="{{ localization.Submit }}"` — displays "Submit".

- **Cancel button** (`<ui5-toolbar-button design="Transparent">`):
  - `[disabled]="loading"` — disabled while API call is in progress.
  - `(click)="CloseDialog()"` — closes and resets the dialog.
  - `text="{{ localization.Cancel }}"` — displays "Cancel".

---

## API Calls

| HTTP Method | Endpoint | When called | Payload / Query params | What happens with response |
|---|---|---|---|---|
| `POST` | `{ServerApi}/odata/AssetGroups` | User clicks Submit and `saveMode === 'POST'` and validation passes | JSON body: `assetGroup.toOdata()` — all `AssetGroup` fields except `created_at` and `updated_at` (stripped by `toOdata()`) | On success: dialog closed, `RefreshTable` emitted, `'add'` toast shown. On error: dialog closed, `'error'` toast shown. |
| `PUT` | `{ServerApi}/odata/AssetGroups({id})` | User clicks Submit and `saveMode === 'PUT'` and validation passes | JSON body: `assetGroup.toOdata()` — all `AssetGroup` fields except `created_at` and `updated_at` | On success: dialog closed, `RefreshTable` emitted, `'edit'` toast shown. On error: dialog closed, `'error'` toast shown. |

**Authentication:** Both requests include a `Bearer {remember_token}` Authorization header, read from `localStorage` at call time inside `CommonService`.

**Base URL:** Constructed inside `CommonService` as `environment.ServerApi + '/odata'` when `isLodata = true` (which is always passed as `true` by this component).

---

## Validation Logic

| Field | Rule | How triggered | State on failure | Error message |
|---|---|---|---|---|
| `assetGroup.name` | Must be truthy (non-empty, non-null, non-undefined) | On form submission (`validateForm()`) | `valueStateOptions.name = ValueState.Negative` | "This field is required." (from `Localization.requiredField`) |
| `assetGroup.name` | Must not be blank/whitespace-only | On each keystroke (`checkValidation()`) | `valueStateOptions.name = ValueState.Negative` | Same value-state message shown in UI5 popup |

`is_active` has no validation — defaults to `true` and is optional.

The `ValueState.Negative` value causes the `ui5-input` to render with a red error border and display the `<div slot="valueStateMessage">` content as a popover.

---

## Services Injected

| Service | Injection token | Why injected | Methods used |
|---|---|---|---|
| `CommonService` | `private commonService: CommonService` | Provides generic HTTP methods that prefix the OData or API base URL and inject the auth header. | `post(url, body, isLodata)` — creates a new record. `put(url, body, isLodata)` — updates an existing record. |
| `ToastService` | `private toastService: ToastService` | Provides a centralized mechanism to emit toast notifications via a global RxJS Subject that a toast display component listens to. | `show(type: ToastType)` — emits a `{ type }` event that triggers the global toast. Types used: `'add'`, `'edit'`, `'error'`. |

---

## Inter-component Communication

### With Parent Component

- **Input `saveMode`:** Parent sets this to `'POST'` or `'PUT'` before opening the dialog.
- **Property `open`:** Parent must set `componentRef.open = true` (by accessing the child component instance via `@ViewChild`) to open the dialog.
- **Property `assetGroup`:** For edit mode (`PUT`), the parent must populate `componentRef.assetGroup` with the record to be edited before setting `open = true`.
- **Output `RefreshTable`:** Parent binds `(RefreshTable)="someMethod()"` to receive the signal that data has changed and the list should be reloaded.

### With Global Toast Infrastructure

The `ToastService.show()` call publishes to a global `Subject<{ type: ToastType }>`. A separate toast/notification component elsewhere in the app subscribes to `toastService.toast$` and renders the appropriate message. This component does not directly render a toast.

### No child components

This component does not embed or communicate with any child Angular components. All UI elements are SAP UI5 web components (`ui5-dialog`, `ui5-input`, `ui5-switch`, etc.) rendered via the browser's custom elements API.

---

## Enums / Models Used

### `AssetGroup` (class)
**Path:** `Frontend/src/app/shared/model/assetGroup.ts`

Implements `Deserializable`. Fields:

| Field | Type | Default |
|---|---|---|
| `id` | `number \| undefined` | `undefined` |
| `is_active` | `boolean \| undefined` | `true` |
| `name` | `string \| undefined` | `''` |
| `custom_id` | `string \| undefined` | `undefined` |
| `created_at` | `string \| undefined` | `undefined` |
| `updated_at` | `string \| undefined` | `undefined` |

Key methods:
- `deserialize(input: any): this` — shallow-assigns input properties onto the instance via `Object.assign`. Returns `this`.
- `toOdata(): Object` — spreads all instance fields but explicitly sets `created_at` and `updated_at` to `undefined`, excluding them from the API payload.

### `saveMode` (enum)
**Path:** `Frontend/src/app/shared/enums/saveMode.ts`

```
enum saveMode {
  GET = 'GET', POST = 'POST', PUT = 'PUT',
  PATCH = 'PATCH', DELETE = 'DELETE', REQUEST = 'REQUEST'
}
```

Only `POST` and `PUT` are used in this component.

### `ValueState` (re-export)
**Path:** `Frontend/src/app/shared/utilities/value-state-wrapper.ts`

Re-exports `ValueState` from `@ui5/webcomponents-base/dist/types/ValueState.js`. The relevant values used in this component are:
- `ValueState.None` — no visual highlight (normal state).
- `ValueState.Negative` — red error highlight.

### `Localization` (const object)
**Path:** `Frontend/src/app/shared/utilities/localization.ts`

A global `const` object containing Angular `$localize`-tagged strings for i18n. Keys used in this component:

| Key | Value (default locale) |
|---|---|
| `Localization.Active` | "Active" |
| `Localization.New` | "New" |
| `Localization.Edit` | "Edit" |
| `Localization.Submit` | "Submit" |
| `Localization.Cancel` | "Cancel" |
| `Localization.requiredField` | "This field is required." |

### `ToastType` (union type)
**Path:** `Frontend/src/app/services/toast-service/toast.service.ts`

```
type ToastType = 'save' | 'add' | 'edit' | 'delete' | 'remove' | 'read'
               | 'approve' | 'import' | 'export' | 'password' | 'download'
               | 'error' | 'exist'
```

This component uses `'add'`, `'edit'`, and `'error'`.

---

## Key Business Logic

### Dialog Open/Close Contract
The component does not expose a public `open()` method. Instead, the parent must directly set the `open` property to `true` on the child component instance (via `@ViewChild`). The component closes itself internally after any terminal action (success, error, or Cancel click). This is a push-from-parent / close-from-self pattern.

### OData Key-Segment Pattern for PUT
When editing, the URL is constructed as `AssetGroups(${this.assetGroup.id})` — this follows the OData v4 entity-by-key URL convention. The parent is responsible for ensuring `assetGroup.id` is set before PUT mode is activated.

### Payload Sanitization via `toOdata()`
The `AssetGroup.toOdata()` method strips `created_at` and `updated_at` from the outgoing payload by setting them to `undefined` before the spread. This prevents sending read-only server-managed timestamps in write requests.

### `saveMode` Input vs. `responseType` Property Mismatch
The `@Input() saveMode` is declared as `string` (not `saveMode` enum). A separate class-level property `responseType: saveMode = saveMode.POST` exists but is never updated from the input and is never read in the template or methods. This appears to be dead code from a refactoring that is not yet cleaned up.

### Dual Validation Strategy
Validation is performed twice:
1. **On submit** (`validateForm()`) — gate-checks the model value (`assetGroup.name`).
2. **On each keystroke** (`checkValidation()`) — checks the raw DOM event value (`event.target.value`), including whitespace trimming. The submit-time check does not trim whitespace (a name of `'   '` — spaces only — would pass `validateForm()` since a non-empty string is truthy, but would fail `checkValidation()`). This is a minor inconsistency.

### Both Buttons Disabled During Loading
Both the Submit and Cancel buttons have `[disabled]="loading"`, meaning the user cannot cancel or re-submit while an API request is in flight. The dialog can still be dismissed via the `before-close` event (e.g., the Escape key), which calls `CloseDialog()` directly without checking `loading`.

### Error Handling
On API error, the dialog is closed and state is reset via `CloseDialog()`, but the error is not displayed to the user in the form — only a generic `'error'` toast is shown. The error object is logged to `console.error`.
