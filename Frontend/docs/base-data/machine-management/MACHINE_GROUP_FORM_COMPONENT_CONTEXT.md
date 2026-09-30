# MACHINE_GROUP_FORM_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| **TypeScript file** | `src/app/modules/base-data-management/machine-management/machine-group/machine-group-form/machine-group-form.component.ts` |
| **Template file** | `src/app/modules/base-data-management/machine-management/machine-group/machine-group-form/machine-group-form.component.html` |
| **Selector** | `app-machine-group-form` |
| **Component type** | Form / Dialog |
| **Purpose** | Renders a UI5 modal dialog that allows the user to create a new machine group (POST) or edit an existing one (PUT). It validates the form, submits the data to the OData API, emits events on success, and resets its own state on close. |

---

## Inputs (@Input)

| Input name | Type | Default | Purpose |
|---|---|---|---|
| `saveMode` | `string` | `'POST'` | Controls whether the form performs a create (`POST`) or update (`PUT`) operation. Should be set to a value from the `saveMode` enum (`'POST'` or `'PUT'`). |
| `machineGroup` | `MachineGroup` | `new MachineGroup().deserialize({})` | The data model bound to the form fields. For edit mode the parent populates this with an existing record; for create mode the default empty instance is used. |

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `IsOpenToastAlert` | `EventEmitter<void>` | Declared but not emitted anywhere in the current implementation. Reserved for notifying the parent that a toast should be shown (superseded by `ToastService`). |
| `RefreshTable` | `EventEmitter<any>` | Emitted after a successful POST or PUT to tell the parent list/table component to reload its data. |
| `groupAdded` | `EventEmitter<MachineGroup>` | Emitted after a successful POST or PUT, carrying the deserialized `MachineGroup` object returned by the API. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `open` | `boolean` | `false` | Controls the `[open]` binding on `<ui5-dialog>`. Set to `true` externally (by the parent) to open the dialog. Set to `false` by `CloseDialog()`. |
| `loading` | `boolean` | `false` | Activates the `<ui5-busy-indicator>` overlay and disables footer buttons while an API call is in flight. |
| `ToastType` | `'add' \| 'edit' \| 'error'` | `'add'` | Tracks which toast notification style to display after the API response. Set to `'add'` for POST, `'edit'` for PUT, `'error'` on failure. |
| `validationMessage` | `string` | `Localization.requiredField` | Static message shown inside the UI5 value-state slot when the name field is invalid. Resolves to `"This field is required."`. |
| `valueState` | `typeof ValueState` | `ValueState` (class ref) | Exposes the UI5 `ValueState` enum to the template for binding. |
| `responseType` | `saveMode` | `saveMode.POST` | Declared but not actively used in the current logic (saveMode comparison in `AddGroup()` uses the `@Input() saveMode` string directly). |
| `localization` | `typeof Localization` | `Localization` (class ref) | Exposes the `Localization` utility object to the template for i18n string access. |
| `valueStateOptions` | `{ name: ValueState }` | `{ name: ValueState.None }` | Object holding per-field UI5 value states. `name` controls the error highlight on the Group Name input. |

---

## ViewChild / ViewChildren

None. The component does not use `@ViewChild` or `@ViewChildren`.

---

## Lifecycle Hooks

The component does not implement `OnInit`, `OnDestroy`, `AfterViewInit`, or any other lifecycle hook interface. All setup is handled through `@Input` defaults and service injection in the constructor.

---

## Methods — DETAILED

### `constructor(commonService: CommonService, toastService: ToastService)`
- Injects `CommonService` for HTTP communication and `ToastService` for user notifications.
- No custom initialization logic beyond dependency injection.

---

### `AddGroup(): void`
**Purpose:** Validates the form and submits the machine group data to the API via POST or PUT.

**Step-by-step logic:**
1. Calls `validateForm()`. If it returns `false`, execution stops immediately (early return).
2. Sets `this.loading = true` to activate the busy indicator and disable buttons.
3. Determines the HTTP verb based on `this.saveMode`:
   - If `saveMode === 'POST'`: sets `url = 'MachineGroups'`, sets `ToastType = 'add'`, creates `request$` via `this.commonService.post(url, this.machineGroup.toOdata(), true)`. The `true` flag routes the request to the OData prefix (`/odata/MachineGroups`).
   - If `saveMode === 'PUT'`: sets `url = 'MachineGroups(<id>)'` using the current record's `id`, sets `ToastType = 'edit'`, creates `request$` via `this.commonService.put(url, this.machineGroup.toOdata(), true)`.
4. If `request$` is defined, subscribes:
   - **`next` handler:** Deserializes the API response into a new `MachineGroup` instance, emits it via `groupAdded`, calls `CloseDialog()`, emits `RefreshTable`, and calls `toastService.show(this.ToastType)` to display a success toast.
   - **`error` handler:** Sets `this.open = false`, calls `CloseDialog()`, and calls `toastService.show('error')` to display an error toast. Note that `this.open = false` is redundant with `CloseDialog()` but explicitly ensures the dialog closes.

**Side effects:** Closes the dialog, resets form state, refreshes parent table, shows toast.

---

### `checkValidation(event: any): void`
**Purpose:** Real-time inline validation triggered on every keystroke in the Group Name input.

**Step-by-step logic:**
1. Reads `event.target.value` from the DOM input event.
2. If the trimmed value is empty (blank or whitespace-only): sets `valueStateOptions.name = ValueState.Negative` to display the error state on the input.
3. If the trimmed value is non-empty: sets `valueStateOptions.name = ValueState.None` to clear the error state.

**Returns:** void. No emission.

---

### `validateForm(): boolean`
**Purpose:** Pre-submission validation to block the API call if required fields are missing.

**Step-by-step logic:**
1. Sets `isValid = true`.
2. Checks `this.machineGroup.name`. If falsy (empty string, `null`, or `undefined`): sets `valueStateOptions.name = ValueState.Negative` and sets `isValid = false`.
3. Returns `isValid`.

**Note:** Only the `name` field is validated; `is_active` has a boolean default and is never invalid.

---

### `CloseDialog(): void`
**Purpose:** Resets the component to its clean/closed state.

**Step-by-step logic:**
1. Sets `this.open = false` — closes the dialog.
2. Sets `this.loading = false` — deactivates the busy indicator.
3. Sets `valueStateOptions.name = ValueState.None` — clears any validation error state on the name field.
4. Replaces `this.machineGroup` with a fresh `new MachineGroup().deserialize({})` — discards any partially entered or loaded data.

**Triggered by:** The dialog's `(before-close)` event, the Cancel button click, and on both success and error paths in `AddGroup()`.

---

## Template Bindings & Structure

```
<ui5-dialog [open]="open" [attr.header-text]="..." (before-close)="CloseDialog()">
  <ui5-busy-indicator [active]="loading">
    <section>
      <!-- Row: Active toggle -->
      <ui5-label showColon>Active</ui5-label>
      <ui5-switch [(ngModel)]="machineGroup.is_active" />

      <!-- Row: Group Name input -->
      <ui5-label show-colon required>Group Name</ui5-label>
      <ui5-input
        [(ngModel)]="machineGroup.name"
        (input)="checkValidation($event)"
        [attr.value-state]="valueStateOptions.name"
      >
        <div slot="valueStateMessage">{{ validationMessage }}</div>
      </ui5-input>
    </section>
  </ui5-busy-indicator>

  <!-- Footer toolbar -->
  <ui5-toolbar slot="footer">
    <ui5-toolbar-button (click)="AddGroup()" [disabled]="loading" text="Submit" />
    <ui5-toolbar-button (click)="CloseDialog()" [disabled]="loading" text="Cancel" />
  </ui5-toolbar>
</ui5-dialog>
```

**Key binding details:**

| Element | Binding | Notes |
|---|---|---|
| `<ui5-dialog>` | `[open]="open"` | Dialog visibility is fully controlled by the `open` property |
| `<ui5-dialog>` | `[attr.header-text]` | Displays `localization.New` when `saveMode === 'POST'`, otherwise `localization.Edit` |
| `<ui5-dialog>` | `(before-close)="CloseDialog()"` | Fires before the dialog closes (e.g. via Escape key), ensuring state is always reset |
| `<ui5-busy-indicator>` | `[active]="loading"` `[delay]="0"` | Covers the form with a spinner immediately (no delay) during API calls |
| `<ui5-switch>` | `[(ngModel)]="machineGroup.is_active"` | Two-way binding; checked state reflects and updates the model's `is_active` field |
| `<ui5-input>` | `[(ngModel)]="machineGroup.name"` | Two-way binding to the group name |
| `<ui5-input>` | `(input)="checkValidation($event)"` | Triggers real-time validation on every input event |
| `<ui5-input>` | `[attr.value-state]="valueStateOptions.name"` | Applies UI5 `ValueState.Negative` styling (red border + message) when validation fails |
| `<div slot="valueStateMessage">` | `{{ validationMessage }}` | Populates the UI5 input's built-in error tooltip/popup with the required-field message |
| Submit button | `[disabled]="loading"` | Prevents double-submission during in-flight requests |
| Cancel button | `[disabled]="loading"` | Prevents closing during in-flight requests |

---

## API Calls

| HTTP Method | Endpoint | When called | Payload / Query params | What happens with response |
|---|---|---|---|---|
| `POST` | `/odata/MachineGroups` | `AddGroup()` when `saveMode === 'POST'` | `machineGroup.toOdata()` (full object minus `created_at` and `updated_at`) | Response deserialized into `MachineGroup`, emitted via `groupAdded`, table refreshed, success toast shown |
| `PUT` | `/odata/MachineGroups(<id>)` | `AddGroup()` when `saveMode === 'PUT'` | `machineGroup.toOdata()` (full object minus `created_at` and `updated_at`) | Response deserialized into `MachineGroup`, emitted via `groupAdded`, table refreshed, edit toast shown |

**Note:** The third argument `true` passed to `commonService.post()` / `commonService.put()` routes the call through the OData prefix (`environment.ServerApi + '/odata'`) instead of the REST API prefix.

---

## Validation Logic

| Field | Rule | Trigger | State on failure | State on pass |
|---|---|---|---|---|
| `machineGroup.name` | Must be non-falsy (not empty string, null, or undefined) | Pre-submission in `validateForm()` | `valueStateOptions.name = ValueState.Negative` | `valueStateOptions.name = ValueState.None` |
| `machineGroup.name` | Must be non-empty after `.trim()` | Real-time on every input event via `checkValidation()` | `valueStateOptions.name = ValueState.Negative` | `valueStateOptions.name = ValueState.None` |

`validateForm()` blocks the API call by returning `false` when the name is invalid. `checkValidation()` only updates visual state; it does not block submission on its own.

---

## Services Injected

| Service | Why injected | Methods used |
|---|---|---|
| `CommonService` | Performs authenticated HTTP calls to the OData API | `post(url, body, isOdata)` — creates a new machine group; `put(url, body, isOdata)` — updates an existing machine group |
| `ToastService` | Shows user-facing notifications after API responses | `show(type: ToastType)` — called with `'add'`, `'edit'`, or `'error'` |

---

## Inter-component Communication

| Direction | Mechanism | Details |
|---|---|---|
| Parent -> Component | `@Input() saveMode` | Parent sets `'POST'` or `'PUT'` to control form mode |
| Parent -> Component | `@Input() machineGroup` | Parent passes an existing `MachineGroup` instance for edit mode, or leaves as default for create mode |
| Parent -> Component | Direct property access | Parent sets `component.open = true` to open the dialog (the `open` property is public but not an `@Input`) |
| Component -> Parent | `@Output() groupAdded` | Emits the saved `MachineGroup` after a successful API call; parent can use this to update local state without a full reload |
| Component -> Parent | `@Output() RefreshTable` | Emits after success to trigger a full data reload in the parent table |
| Component -> Parent | `@Output() IsOpenToastAlert` | Declared but currently unused (never emitted) |

---

## Enums / Models Used

| Type | Source | Usage |
|---|---|---|
| `MachineGroup` | `@shared/model/machineGroup` | The primary data model for the form. Fields: `id?: number`, `is_active?: boolean` (default `true`), `name: string` (default `''`), `custom_id?: string`, `created_at?: string`, `updated_at?: string`. Methods: `deserialize(input)`, `toOdata()` (strips `created_at` and `updated_at` from the payload). |
| `saveMode` | `@shared/enums/saveMode` | Enum with values `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `REQUEST`. Used for `responseType` property type and string comparison in `AddGroup()`. |
| `ValueState` | `@shared/utilities/value-state-wrapper` (re-exports from `@ui5/webcomponents-base`) | UI5 value state enum. `ValueState.None` = default (no error); `ValueState.Negative` = error (red border and message). |
| `Localization` | `@shared/utilities/localization` | Static i18n string map. Keys used: `Localization.Active`, `Localization.New`, `Localization.Edit`, `Localization.Submit`, `Localization.Cancel`, `Localization.requiredField`. |
| `Deserializable` | `@app/shared/interfaces/deserializable` | Interface implemented by `MachineGroup` to support the `deserialize()` pattern. |

---

## Key Business Logic

1. **Dialog open/close ownership:** The `open` property is a plain public boolean, not an `@Input`. The parent component must directly set `machineGroupFormComponent.open = true` on the component instance (via `@ViewChild` or template reference) to open the dialog. The component is solely responsible for closing itself via `CloseDialog()`.

2. **`toOdata()` payload sanitization:** `MachineGroup.toOdata()` uses the spread operator to copy all properties but explicitly sets `created_at: undefined` and `updated_at: undefined`. This ensures server-managed timestamps are never sent in the request body, preventing accidental overwrite of audit fields.

3. **Dual-trigger close on error:** In the error handler of `AddGroup()`, both `this.open = false` and `CloseDialog()` are called. `CloseDialog()` already sets `open = false`, so the explicit assignment beforehand is redundant but harmless. This was likely added defensively to ensure the dialog closes even if `CloseDialog()` were to throw.

4. **`saveMode` string vs. enum comparison:** The `@Input() saveMode` is typed as `string` with default `'POST'`, while `saveMode.POST` and `saveMode.PUT` in the `AddGroup()` comparison resolve to their string values (`'POST'` and `'PUT'` respectively). The comparison is effectively string-to-string. This works correctly but means passing any arbitrary string that is not `'POST'` or `'PUT'` will result in `request$` being `undefined` and no API call being made.

5. **`IsOpenToastAlert` output is a no-op:** This output is declared and wired up in the class but `IsOpenToastAlert.emit()` is never called. Toast notifications are handled entirely through `ToastService.show()` instead. The output may be a legacy artifact.

6. **Form reset on every close:** `CloseDialog()` always replaces `this.machineGroup` with a brand new empty instance. This means if a parent passes a `MachineGroup` object via `@Input`, that reference is discarded inside the component after any close event. The parent's copy remains unmodified. For edit mode, the parent must re-assign the input before reopening the dialog.
