# CLIENT_FORM_COMPONENT — Component Context

## Overview

| Item | Value |
|---|---|
| TypeScript file | `Frontend/src/app/modules/base-data-management/client-management/client-form/client-form.component.ts` |
| HTML template | `Frontend/src/app/modules/base-data-management/client-management/client-form/client-form.component.html` |
| Stylesheet | `client-form.component.scss` |
| Selector | `app-client-form` |
| Component type | Form / Dialog |
| Purpose | Renders a modal dialog (SAP UI5 `ui5-dialog`) for creating or editing a `Client` record. The dialog is divided into two tabs — "Core Data" (name, email, contacts, TIN, BIN, note, area) and "Address" (address, bill-to, ship-to). It validates required fields on both tabs before submitting, then calls the OData/API backend to POST (create) or PUT (update) the client. After a successful save it optionally associates the client with a `ClientArea` and/or `ClientNote` via a separate API call, emits events to the parent, and closes itself. |

---

## Inputs (@Input)

| Input name | Type | Default | Purpose |
|---|---|---|---|
| `saveMode` | `string` | `'POST'` | Determines whether the form is in create mode (`'POST'`) or edit mode (`'PUT'`). Compared against `saveMode` enum values at runtime. |
| `client` | `Client` | `new Client()` | The data object bound to all form fields. In edit mode the parent pre-populates this with the existing record. |

---

## Outputs (@Output)

| Output name | Emit type | Purpose |
|---|---|---|
| `ClientAdded` | `Client` | Emitted immediately after a successful POST or PUT response, carrying the deserialized server-returned `Client` object. |
| `RefreshTable` | `any` (void) | Emitted after a successful save to tell the parent list/table component to reload its data. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `SelectedNote` | `ClientNote` | `new ClientNote()` | Holds the `ClientNote` object selected in the combobox (id + name). Cleared on dialog close. |
| `SelectedArea` | `ClientArea` | `new ClientArea()` | Holds the `ClientArea` object selected in the combobox (id + name). Cleared on dialog close. |
| `ClientNote` | `ClientNote[]` | `[]` | Declared but unused in template logic (see `SelectedNoteList` instead). Legacy / reserved. |
| `ClientArea` | `ClientArea[]` | `[]` | Declared but unused in template logic (see `SelectedAreaList` instead). Legacy / reserved. |
| `open` | `boolean` | `false` | Controls the `[open]` binding on `ui5-dialog`. Parent sets this to `true` to open the dialog. |
| `loading` | `boolean` | `false` | Drives the `ui5-busy-indicator` active state and disables the Submit/Cancel toolbar buttons during an in-flight request. |
| `ToastType` | `'add' \| 'edit' \| 'error'` | `'add'` | Determines the type of toast notification shown after the save resolves. Set to `'add'` for POST, `'edit'` for PUT, `'error'` on failure. |
| `validationMessage` | `string` | `Localization.requiredField` | The text shown inside `valueStateMessage` slots when a required field fails validation ("This field is required."). |
| `valueState` | `typeof ValueState` | `ValueState` (class ref) | Reference to the UI5 `ValueState` enum, made available in the template via property binding. |
| `responseType` | `saveMode` | `saveMode.POST` | Declared but not actively used after construction; `ToastType` and the inline `saveMode` comparison carry the logic instead. |
| `localization` | `typeof Localization` | `Localization` object | Exposes all i18n string constants to the template. |
| `SelectedAreaList` | `any \| undefined` | `undefined` | Populated by `LoadClientArea()`. The raw OData `value` array fed into the `ui5-combobox` for areas. |
| `clientAreaName` | `string` | `''` | The display name of the currently selected area, bound as the `[value]` of the area combobox. |
| `SelectedNoteList` | `any \| undefined` | `undefined` | Populated by `LoadClientNote()`. The raw OData `value` array fed into the `ui5-combobox` for notes. |
| `clientNoteName` | `string` | `''` | The display name of the currently selected note, bound as the `[value]` of the note combobox. |
| `odata` | `boolean` | `commonService.odata` (`true`) | Flag copied from `CommonService` at construction; passed as the `isLodata` argument to OData-targeted `get` and `post`/`put` calls. |
| `api` | `boolean` | `commonService.api` (`false`) | Flag copied from `CommonService` at construction; passed as `isLodata` to the non-OData `client/associate` POST call. |
| `valueStateOptions` | `{ name, email, address, bill_to, ship_to: ValueState }` | All `ValueState.None` | Per-field validation state object. Each key maps to the `[attr.value-state]` binding of its corresponding input/textarea. |
| `selectedTab` | `string` | `'coreData'` | Tracks the active tab id. Used by `[selected]` binding on each `ui5-tab` and reset to `'coreData'` on dialog close or error. |
| `showAddMore` | `boolean` | `false` | Whether the second contact person fields are currently expanded/visible. |
| `className` | `string` | `'hidden'` | CSS class applied to the second contact person field wrappers. `''` (empty) when visible, `'hidden'` when collapsed. |
| `buttonText` | `string` | `localization.addMore` | Label of the "Add More / Show Less" toggle button. |
| `buttonIcon` | `string` | `'add'` | UI5 icon name for the toggle button (`'add'` when collapsed, `'slim-arrow-down'` when expanded). |
| `sameAsBillTo` | `boolean` | `false` | Bound to the "Ship to Same as Bill To" checkbox. When `true`, `ship_to` mirrors `bill_to`. |

---

## ViewChild / ViewChildren

None declared in this component.

---

## Lifecycle Hooks

### `ngOnInit()`
- Calls `LoadClientNote()` to fetch the list of available client notes from the OData backend.
- Calls `LoadClientArea()` to fetch the list of available client areas from the OData backend.
- Both calls are fire-and-forget observables; their results populate `SelectedNoteList` and `SelectedAreaList` respectively.

No `ngOnDestroy`, `ngAfterViewInit`, or other lifecycle hooks are implemented.

---

## Methods — DETAILED

### `initializeAddMoreState(data?: any): void`
**Signature:** `initializeAddMoreState(data?: any): void`

- Intended to be called by the parent when opening the dialog in edit mode (`saveMode.PUT`), passing the existing client data object.
- **If `saveMode === 'PUT'`:**
  - Checks whether `data.second_contact_person_name` or `data.second_contact_person_phone` is truthy.
  - If either has a value: sets `showAddMore = true`, `className = ''`, `buttonText = localization.showLess`, `buttonIcon = 'slim-arrow-down'` — expanding the second-contact section immediately.
  - If both are falsy: calls `resetAddMore()` to collapse the section.
- **If `saveMode !== 'PUT'`:** calls `resetAddMore()` unconditionally.
- Does not emit or return a value.

---

### `checkValidation(event: any, field: string): void`
**Signature:** `checkValidation(event: any, field: string): void`

- Called on the `(input)` event of required fields: `name`, `email`, `address`, `bill_to`, `ship_to`.
- Extracts `event.target.value` (defaults to `''` if falsy).
- Uses a `switch` statement on `field`:
  - **`'name'`**: If value is blank after trim, sets `valueStateOptions.name = ValueState.Negative`. Otherwise writes the value into `client.name` and resets state to `ValueState.None`.
  - **`'email'`**: Same pattern for `client.email` / `valueStateOptions.email`.
  - **`'address'`**: Same pattern for `client.address` / `valueStateOptions.address`.
  - **`'bill_to'`**: Same pattern for `client.bill_to` / `valueStateOptions.bill_to`.
  - **`'ship_to'`**: Same pattern for `client.ship_to` / `valueStateOptions.ship_to`.
- Note: for `name` and `email` the value is also explicitly written back to the `client` object here; for `address`, `bill_to`, `ship_to` the value is also written back (redundant given two-way `[(ngModel)]` binding, but makes the behavior explicit).
- Does not return a value.

---

### `coreDataValid(): boolean`
**Signature:** `coreDataValid(): boolean`

- Full validation for the Core Data tab's required fields before save.
- Checks `client.name?.trim()`:
  - Truthy: `valueStateOptions.name = ValueState.None`
  - Falsy: `valueStateOptions.name = ValueState.Negative`, `isValid = false`
- Checks `client.email?.trim()`:
  - Truthy: `valueStateOptions.email = ValueState.None`
  - Falsy: `valueStateOptions.email = ValueState.Negative`, `isValid = false`
- Returns `isValid` (boolean). Returns `false` if either field fails.

---

### `addressvalidation(): boolean`
**Signature:** `addressvalidation(): boolean`

- Full validation for the Address tab's required fields before save.
- Checks `client.address?.trim()`, `client.bill_to?.trim()`, `client.ship_to?.trim()` in sequence.
- Each falsy value sets the corresponding `valueStateOptions` key to `ValueState.Negative` and sets `isValid = false`.
- Each truthy value sets the corresponding key to `ValueState.None`.
- Returns `isValid` (boolean). Returns `false` if any of the three fields fails.

---

### `LoadClientNote(): void`
**Signature:** `LoadClientNote(): void`

- Calls `commonService.get('ClientNotes?$orderby=id desc&$filter=is_active eq true', this.odata)` (OData endpoint).
- On success: assigns `response.value` to `SelectedNoteList`, which feeds the note combobox items.
- On error: logs `'Client Notes Error'` to the console. No UI feedback.

---

### `LoadClientArea(): void`
**Signature:** `LoadClientArea(): void`

- Calls `commonService.get('ClientAreas?$orderby=id desc&$filter=is_active eq true', this.odata)` (OData endpoint).
- On success: assigns `response.value` to `SelectedAreaList`, which feeds the area combobox items.
- On error: logs `'Client Areas Error'` to the console. No UI feedback.

---

### `getNote(items: any): void`
**Signature:** `getNote(items: any): void`

- Bound to `(selection-change)` of the note `ui5-combobox`.
- Deserializes a `ClientNote` from `items.detail.item.id` and `items.detail.item.text`.
- Assigns the result to `SelectedNote` and sets `clientNoteName = SelectedNote.name` (updates the combobox display value).

---

### `getArea(items: any): void`
**Signature:** `getArea(items: any): void`

- Bound to `(selection-change)` of the area `ui5-combobox`.
- Deserializes a `ClientArea` from `items.detail.item.id` and `items.detail.item.text`.
- Assigns the result to `SelectedArea` and sets `clientAreaName = SelectedArea.name`.

---

### `saveClientInfo(): void`
**Signature:** `saveClientInfo(): void`

- Entry point for the Submit button.
- **Step 1 — Core Data validation:** calls `coreDataValid()`. If invalid, forces `selectedTab = 'coreData'` so the user sees the failed fields, then returns early.
- **Step 2 — Address validation:** calls `addressvalidation()`. If invalid, forces `selectedTab = 'personalData'` and returns early.
- **Step 3 — Build request:**
  - Sets `loading = true`.
  - If `saveMode === 'POST'`: url = `'Clients'`, `ToastType = 'add'`, request = `commonService.post(url, client.toOdata(), true)`.
  - If `saveMode === 'PUT'`: url = `` `Clients(${client.id})` ``, `ToastType = 'edit'`, request = `commonService.put(url, client.toOdata(), true)`.
- **Step 4 — Subscribe:**
  - On success:
    1. Deserializes the response into a new `Client` object.
    2. Emits `ClientAdded` with the new `Client`.
    3. If `SelectedArea.id` or `SelectedNote.id` is set, calls `ClientAssociate(client.id)`.
    4. Calls `CloseDialog()`.
    5. Emits `RefreshTable`.
    6. Shows a toast via `toastService.show(ToastType)`.
  - On error:
    1. Calls `CloseDialog()`.
    2. Resets `selectedTab = 'coreData'`.
    3. Shows an error toast via `toastService.show('error')`.

---

### `onTabSelect(event: any): void`
**Signature:** `onTabSelect(event: any): void`

- Bound to `(tab-select)` on the `ui5-tabcontainer`.
- Updates `selectedTab = event.detail.tab.id` to keep the component state in sync with the visually active tab.

---

### `ClientAssociate(id: number | undefined): void`
**Signature:** `ClientAssociate(id: number | undefined): void`

- Called from `saveClientInfo()` after a successful save, only when at least one of `SelectedArea.id` or `SelectedNote.id` is set.
- Guards against `!id` (undefined client id) — returns immediately if so.
- Builds the payload:
  ```
  {
    client_id: id,
    clientarea: SelectedArea.id ? [{ id: SelectedArea.id }] : [],
    clientnote: SelectedNote.id ? [{ id: SelectedNote.id }] : []
  }
  ```
- POSTs to `'client/associate'` using `this.api` flag (`isLodata = false`, targeting the `/api` prefix).
- On success: resets `SelectedArea` and `SelectedNote` to empty instances, then calls `CloseDialog()`.
- On error: logs `'Error associating client:'` to console, then calls `CloseDialog()`.
- Note: `CloseDialog()` is called here in addition to being called in `saveClientInfo()` — the call in `saveClientInfo()` runs immediately when the main save responds; `ClientAssociate` runs asynchronously and calls `CloseDialog()` again after the association resolves. Because `CloseDialog` is idempotent (it only sets flags), this is safe but results in a double invocation.

---

### `addMore(): boolean`
**Signature:** `addMore(): boolean`

- Bound to the "Add More / Show Less" transparent button click.
- Toggles `showAddMore`.
- Updates `className`, `buttonText`, and `buttonIcon` to reflect the new state.
- **When collapsing** (`showAddMore` becomes `false`): clears `client.second_contact_person_name` and `client.second_contact_person_phone` to empty strings, ensuring stale data is not submitted.
- Returns the new value of `showAddMore`.

---

### `resetAddMore(): void`
**Signature:** `resetAddMore(): void`

- Collapses the second-contact section unconditionally:
  - `className = 'hidden'`
  - `showAddMore = false`
  - `buttonText = localization.addMore`
  - `buttonIcon = 'add'`
  - `client.second_contact_person_name = ''`
  - `client.second_contact_person_phone = ''`
- Called from `initializeAddMoreState()`, `addMore()`, and `CloseDialog()`.

---

### `onBillToInput(): void`
**Signature:** `onBillToInput(): void`

- Bound to the `(input)` event on the Bill To textarea (alongside `checkValidation`; both fire on every keystroke).
- If `sameAsBillTo` is `true`, mirrors `client.bill_to` into `client.ship_to` in real time, keeping the ship-to field synchronized as the user types.
- If `client.bill_to` is now empty/whitespace, resets `sameAsBillTo = false` (un-checks the checkbox) to prevent a stale "same as" state with an empty bill-to address.

---

### `onSameAsBillToChanged(): void`
**Signature:** `onSameAsBillToChanged(): void`

- Bound to the `(change)` event on the "Ship to Same as Bill To" `ui5-checkbox`.
- If checkbox is now checked (`sameAsBillTo = true`): copies `client.bill_to` to `client.ship_to`.
- If checkbox is now unchecked: clears `client.ship_to` to `''`.

---

### `CloseDialog(): void`
**Signature:** `CloseDialog(): void`

- Called on dialog `(before-close)` event, Cancel button click, and internally after save/error.
- Resets all transient state:
  - `open = false` — closes the dialog.
  - `loading = false` — removes the busy indicator.
  - `selectedTab = 'coreData'` — returns to first tab.
  - `client.deserialize({})` — wipes all client fields back to defaults.
  - `clientNoteName = ''` and `clientAreaName = ''` — clears combobox display values.
  - `resetAddMore()` — collapses second-contact section.
  - `sameAsBillTo = false` — unchecks the ship-to shortcut.
  - Resets `valueStateOptions` to all `ValueState.None` — clears any validation error highlights.

---

## Template Bindings & Structure

The template is a single `ui5-dialog` wrapping a `ui5-busy-indicator` and a `ui5-tabcontainer`.

### Dialog (`ui5-dialog`)
- `[open]="open"` — programmatic open/close.
- `[attr.header-text]` — dynamically shows `localization.New` (POST) or `localization.Edit` (PUT).
- Fixed size class `w-[1000px] h-[750px]`.
- `(before-close)="CloseDialog()"` — any close gesture (X button, Escape) triggers reset.

### Busy Indicator (`ui5-busy-indicator`)
- `[active]="loading"` — overlays the form with a spinner while the HTTP request is in flight.
- `[delay]="0"` — spinner appears immediately.

### Tab Container (`ui5-tabcontainer`)
- `(tab-select)="onTabSelect($event)"` keeps `selectedTab` in sync.

### Tab 1: Core Data (`id="coreData"`)
- **Active switch:** `ui5-switch [(ngModel)]="client.is_active"` — toggles the active flag.
- **Client Name (required):**
  - `ui5-input [(ngModel)]="client.name"`
  - `(input)="checkValidation($event, 'name')"`
  - `[attr.value-state]="valueStateOptions.name"` — turns red on empty.
  - `valueStateMessage` slot shows `validationMessage`.
- **Contact Person Name:**
  - `ui5-input [(ngModel)]="client.first_contact_person_name"` — optional, no validation.
- **Second Contact Person Name (collapsible):**
  - Wrapped in a `div` with `class="{{ className }}"` (`hidden` / `''`).
  - `ui5-input [(ngModel)]="client.second_contact_person_name"` with explicit `[value]` fallback.
- **TIN:** `ui5-input [(ngModel)]="client.tin"` — optional.
- **Select Note:** `ui5-combobox` with `(selection-change)="getNote($event)"`, items rendered via `*ngFor` on `SelectedNoteList`. Value bound to `clientNoteName`.
- **Email (required):**
  - `ui5-input [(ngModel)]="client.email"`
  - `(input)="checkValidation($event, 'email')"`
  - `[attr.value-state]="valueStateOptions.email"`.
- **Contact Person Number:**
  - `ui5-input [(ngModel)]="client.first_contact_person_phone"` — type="Number", optional.
- **Add More / Show Less button:**
  - `ui5-button design="Transparent" (click)="addMore()"` — dynamically sets `[icon]="buttonIcon"` and label `{{ buttonText }}`.
- **Second Contact Person Number (collapsible):**
  - Same `class="{{ className }}"` wrapper.
  - `ui5-input [(ngModel)]="client.second_contact_person_phone"` with explicit `[value]` fallback (`.toString() || ''`).
- **BIN:** `ui5-input [(ngModel)]="client.bin"` — optional.
- **Select Area:** `ui5-combobox` with `(selection-change)="getArea($event)"`, items via `*ngFor` on `SelectedAreaList`. Value bound to `clientAreaName`.

### Tab 2: Address (`id="personalData"`, text="Address")
- **Address (required):**
  - `ui5-textarea [(ngModel)]="client.address"`, h-[100px]
  - `(input)="checkValidation($event, 'address')"`
  - `[attr.value-state]="valueStateOptions.address"`.
- **Bill To (required):**
  - `ui5-textarea [(ngModel)]="client.bill_to"`
  - Has two `(input)` handlers: `onBillToInput()` and `checkValidation($event, 'bill_to')`.
  - `[attr.value-state]="valueStateOptions.bill_to"`.
- **"Ship to Same as Bill To" checkbox:**
  - `ui5-checkbox [(ngModel)]="sameAsBillTo" (change)="onSameAsBillToChanged()"`
  - `[disabled]="!client.bill_to || client.bill_to.trim() === ''"` — checkbox is disabled until Bill To has content.
- **Ship To (required):**
  - `ui5-textarea [(ngModel)]="client.ship_to"`
  - `[disabled]="sameAsBillTo"` — disabled when the checkbox is checked.
  - `(input)="checkValidation($event, 'ship_to')"`
  - `[attr.value-state]="valueStateOptions.ship_to"`.

### Footer toolbar
- **Submit button:** `ui5-toolbar-button design="Emphasized" (click)="saveClientInfo()" [disabled]="loading"`.
- **Cancel button:** `ui5-toolbar-button design="Transparent" (click)="CloseDialog()" [disabled]="loading"`.

---

## API Calls

| HTTP Method | Endpoint (relative) | OData prefix? | When called | Payload / Query params | What happens with response |
|---|---|---|---|---|---|
| GET | `ClientNotes?$orderby=id desc&$filter=is_active eq true` | Yes (`odata`) | `ngOnInit` via `LoadClientNote()` | None | `response.value` assigned to `SelectedNoteList` |
| GET | `ClientAreas?$orderby=id desc&$filter=is_active eq true` | Yes (`odata`) | `ngOnInit` via `LoadClientArea()` | None | `response.value` assigned to `SelectedAreaList` |
| POST | `Clients` | Yes (`true`) | `saveClientInfo()` when `saveMode === 'POST'` | `client.toOdata()` — all `Client` fields except `notes`, `areas`, `created_at`, `updated_at` | Response deserialized into `Client`, emitted via `ClientAdded` |
| PUT | `Clients(${client.id})` | Yes (`true`) | `saveClientInfo()` when `saveMode === 'PUT'` | `client.toOdata()` | Response deserialized into `Client`, emitted via `ClientAdded` |
| POST | `client/associate` | No (`api` = `false`, uses `/api` prefix) | `ClientAssociate()` — after successful save when area or note is selected | `{ client_id, clientarea: [{id}] or [], clientnote: [{id}] or [] }` | Resets `SelectedArea`, `SelectedNote`, calls `CloseDialog()` |

---

## Validation Logic

| Field | Required | Rule | State on failure | State on pass | Where enforced |
|---|---|---|---|---|---|
| `client.name` | Yes | `trim()` must be non-empty | `valueStateOptions.name = ValueState.Negative` | `ValueState.None` | `checkValidation` (live) + `coreDataValid()` (on submit) |
| `client.email` | Yes | `trim()` must be non-empty | `valueStateOptions.email = ValueState.Negative` | `ValueState.None` | `checkValidation` (live) + `coreDataValid()` (on submit) |
| `client.address` | Yes | `trim()` must be non-empty | `valueStateOptions.address = ValueState.Negative` | `ValueState.None` | `checkValidation` (live) + `addressvalidation()` (on submit) |
| `client.bill_to` | Yes | `trim()` must be non-empty | `valueStateOptions.bill_to = ValueState.Negative` | `ValueState.None` | `checkValidation` (live) + `addressvalidation()` (on submit) |
| `client.ship_to` | Yes | `trim()` must be non-empty | `valueStateOptions.ship_to = ValueState.Negative` | `ValueState.None` | `checkValidation` (live) + `addressvalidation()` (on submit) |

Additional rules:
- If Core Data validation fails on submit, `selectedTab` is forced to `'coreData'` so errors are visible.
- If Address validation fails on submit, `selectedTab` is forced to `'personalData'`.
- The "Ship to Same as Bill To" checkbox is disabled by template binding when `bill_to` is empty, preventing the `onSameAsBillToChanged()` copy from operating on a blank value.
- `onBillToInput()` auto-unchecks `sameAsBillTo` if the user clears `bill_to` after checking the box.
- Email is validated only for non-emptiness — no format/regex check is performed.

---

## Services Injected

| Service | Why injected | Methods used |
|---|---|---|
| `CommonService` (`@app/services/common-service/common.service`) | Central HTTP wrapper; also provides `odata` and `api` flags | `get()`, `post()`, `put()`, `.odata` property, `.api` property |
| `ToastService` (`@app/services/toast-service/toast.service`) | Displays success and error toast notifications | `show('add')`, `show('edit')`, `show('error')` |

---

## Inter-component Communication

| Direction | Mechanism | Detail |
|---|---|---|
| Parent → this | Sets `@Input() client` with existing data before opening | Parent populates the bound `Client` object for edit mode |
| Parent → this | Sets `@Input() saveMode` to `'POST'` or `'PUT'` | Determines create vs. edit flow |
| Parent → this | Sets `component.open = true` directly | Opens the dialog (the `open` property is public) |
| Parent → this | Calls `component.initializeAddMoreState(data)` | Configures second-contact expansion state for edit mode |
| This → Parent | `@Output() ClientAdded` emits `Client` | Delivers the server-confirmed client object immediately after save |
| This → Parent | `@Output() RefreshTable` emits void | Instructs parent to reload the client list |

---

## Enums / Models Used

| Symbol | Source | Description |
|---|---|---|
| `Client` | `@shared/model/client` | Main data model. Fields: `id`, `name`, `address`, `first_contact_person_name`, `first_contact_person_phone`, `second_contact_person_name`, `second_contact_person_phone`, `tin`, `bin`, `email`, `is_active`, `custom_id`, `areas`, `notes`, `bill_to`, `ship_to`, `created_at`, `updated_at`. Implements `Deserializable`. `toOdata()` strips `notes`, `areas`, `created_at`, `updated_at` before sending to server. |
| `ClientArea` | `@shared/model/clientArea` | Area lookup model. Fields: `id`, `is_active`, `name`, `custom_id`, `created_at`, `updated_at`. |
| `ClientNote` | `@shared/model/clientNote` | Note lookup model. Fields: `id`, `is_active`, `name`, `custom_id`, `created_at`, `updated_at`. |
| `saveMode` | `@shared/enums/saveMode` | Enum with values `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `REQUEST`. Used to compare against `@Input() saveMode` string values. |
| `ValueState` | `@shared/utilities/value-state-wrapper` | Re-export of `@ui5/webcomponents-base/dist/types/ValueState.js`. Values used: `ValueState.None`, `ValueState.Negative`. Applied to UI5 input `value-state` attribute. |
| `Localization` | `@shared/utilities/localization` | Const object of i18n-aware string constants. Keys used: `requiredField`, `addMore`, `showLess`, `New`, `Edit`, `Submit`, `Cancel`, `Active`. |

---

## Key Business Logic

### Dual-tab validation with automatic tab switching
The form validates required fields on both tabs at submit time. If Core Data fields are invalid, the user is redirected to the "coreData" tab before returning. If Core Data passes but Address fields fail, the user is redirected to the "personalData" tab. This ensures the user always sees which tab contains the error.

### "Add More" second contact section
The second contact person (name + phone) fields are hidden by default behind a toggle button. When the user collapses the section after expanding it, the values are explicitly cleared on the `client` object, preventing accidental submission of stale secondary contact data. In edit mode, `initializeAddMoreState()` auto-expands the section if existing data is present.

### "Ship to Same as Bill To" shortcut
A checkbox on the Address tab lets users copy the Bill To address into Ship To. The checkbox is disabled while Bill To is empty (template-level guard). Once checked, every keystroke in the Bill To field immediately mirrors to Ship To via `onBillToInput()`. If the user clears Bill To, the checkbox is automatically un-checked. Toggling the checkbox off clears Ship To. This prevents stale synchronization states.

### Separate association call for Area/Note
Client areas and notes are not submitted as part of the main `Clients` POST/PUT payload (they are stripped by `toOdata()`). Instead, after a successful save, if the user selected an area or note, `ClientAssociate()` fires a separate POST to `client/associate` via the `/api` prefix. This is an async follow-up and failures are only logged — they do not block the dialog close or the `RefreshTable` emit which have already fired.

### OData vs API prefix routing
The component reads `commonService.odata` (`true`) and `commonService.api` (`false`) at construction. OData calls (client CRUD, note/area lookups) use `isLodata = true` (prefix `/odata`). The association call uses `this.api` (`false`) which routes to `/api`. This routing is governed entirely by which flag is passed to `CommonService` methods.

### Dialog reset is idempotent
`CloseDialog()` resets the entire form state including the `client` object (`client.deserialize({})`). It is called both from the dialog's `(before-close)` event and from within save success/error handlers, meaning it can be called twice in the success path when `ClientAssociate` is also triggered. All assignments in `CloseDialog()` are idempotent so there is no side-effect from double invocation.

### `toOdata()` strips relational fields before submission
`Client.toOdata()` spreads the model and explicitly sets `notes`, `areas`, `created_at`, and `updated_at` to `undefined`. This prevents accidentally sending read-only or relational data to the OData endpoint on create/update.
