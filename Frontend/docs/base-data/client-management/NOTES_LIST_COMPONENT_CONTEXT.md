# NOTES_LIST_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| TS file | `Frontend/src/app/modules/base-data-management/client-management/client-notes/notes-list/notes-list.component.ts` |
| HTML file | `Frontend/src/app/modules/base-data-management/client-management/client-notes/notes-list/notes-list.component.html` |
| SCSS file | `Frontend/src/app/modules/base-data-management/client-management/client-notes/notes-list/notes-list.component.scss` |
| Selector | `app-notes-list` |
| Component type | List (with inline Create / Edit / Delete orchestration) |

**Purpose:** Displays an ag-grid-table of Client Notes (converted from react-analytical-table). Orchestrates `app-ag-grid-table`, `app-delete-entity`, and `app-client-note-form`. Permission-aware — conditionally renders create, edit, and delete actions based on role permissions.

---

## Inputs (@Input)

This component defines **no `@Input` properties**. All data is fetched directly by the `react-analytical-table` child component via the `apiUrl` binding.

---

## Outputs (@Output)

| Output name | Emitted type | Purpose |
|---|---|---|
| `IsDelete` | `string` | Emits the OData-style resource path (e.g. `ClientNotes/{id}`) to the `app-delete-entity` child component, which uses it to perform the HTTP DELETE request. |
| `refreshTable` | `void` | Emits a signal (with no payload) to the `react-analytical-table` child via `[refreshTrigger]` to reload its data. Also emitted after a successful delete via the template. |

> **Note:** Both outputs are also used as intra-template bindings — `IsDelete` is passed as an `@Input` to `app-delete-entity`, and `refreshTable` is passed as `[refreshTrigger]` to `react-analytical-table`. They function simultaneously as component outputs (for any parent that listens) and as internal communication channels.

---

## State Properties

| Property | Type | Default value | Purpose |
|---|---|---|---|
| `clientNote` | `typeof ClientNote` (class reference) | `ClientNote` (the class itself) | Passed as the `[model]` binding to `react-analytical-table` so the table knows the shape of the data it is rendering. This is the **class constructor**, not an instance. |
| `ClientNote` | `ClientNote` (instance) | `new ClientNote().deserialize({})` — empty instance | Holds the currently selected or newly initialised Client Note. Passed to `app-client-note-form` as `[clientNote]`. Reset on new, replaced on edit. |
| `insertTitle` | `string` | `$localize\`New\`` | Label shown on the insert/create button rendered by `react-analytical-table`. |
| `headerTitle` | `string` | `` `${$localize\`Client\`} ${$localize\`Note\`}` `` — resolves to `"Client Note"` | Title displayed in the table header toolbar. |
| `saveMode` | `string` | `saveMode.POST` (`"POST"`) | Tracks whether the form will perform a create (`POST`) or update (`PUT`) operation. Passed to `app-client-note-form` via `[saveMode]`. |
| `localization` | `typeof Localization` | `Localization` (static utility class reference) | Used inside `tableColum()` to resolve the `Created On` column header (`Localization.CreatedAt`). |
| `permissions` | `typeof Permissions` | `Permissions` (enum reference) | Exposed to the template so the HTML can call `rolePermissionService.hasPermission(permissions.BASE_DATA_CLIENT_NOTE_CREATE)` without a string literal. |

---

## ViewChild / ViewChildren

| Ref name | Type | Purpose |
|---|---|---|
| `clientNoteFormRef` | `ClientNoteFormComponent` | Template ref `#clientNoteForm`. Used in `newClientNote()` and `editClientNote()` to imperatively set `clientNoteFormRef.open = true`, opening the form dialog without an `@Input`-driven binding. |

---

## Lifecycle Hooks

This component implements **no lifecycle hooks** (`ngOnInit`, `ngOnDestroy`, `ngAfterViewInit`, etc.). All initialisation happens through property initialisation at declaration time and through method calls triggered by user interaction.

---

## Methods — DETAILED

### `tableColum(): any[]`

**Signature:** `tableColum(): any[]`

**Step-by-step logic:**

1. Initialises a `columns` array with four always-visible column definitions:

   | Column | `accessor` | Details |
   |---|---|---|
   | Active | `is_active` | Width 80. Custom Cell renders a UI5 `<Icon name="accept" />` when truthy, `<Icon name="decline" />` when falsy. Grouping and filtering disabled. |
   | ID | `custom_id` | Width 100. `isSelected: true` (column visible by default). Grouping and filtering disabled. |
   | Note Name | `name` | `accessor: "name"`. `isSelected: true`. Auto-resizable. |
   | Created On | `created_at` | Header uses `this.localization.CreatedAt` (resolves to `"Created On"`). Custom Cell formats the value with `new Date(value).toLocaleDateString()`. Filtering disabled. |

2. Checks whether the current user holds **either** the `BASE_DATA_CLIENT_NOTE_EDIT` **or** `BASE_DATA_CLIENT_NOTE_DELETE` permission via `rolePermissionService.hasPermission(...)`.

3. If at least one of those permissions is present, pushes a fifth `Actions` column:
   - `accessor: "."`, `id: "actions"`, `cellLabel: () => ""`.
   - Sorting, filtering, and grouping all disabled.
   - Width 100.
   - Cell renders a `<div>` containing up to two UI5 `<Button>` elements:
     - **Edit button** (`icon="edit"`, `design="Transparent"`): rendered only when `BASE_DATA_CLIENT_NOTE_EDIT` is held. `onClick` calls `this.editClientNote(row.original)`.
     - **Delete button** (`icon="delete"`, `design="Transparent"`): rendered only when `BASE_DATA_CLIENT_NOTE_DELETE` is held. `onClick` emits `this.IsDelete.emit(\`ClientNotes/${row.original.id}\`)`.

4. Returns the final `columns` array.

**Returns:** `any[]` — column configuration objects consumed by `react-analytical-table`.

**Side effects:** None — pure computation aside from reading `rolePermissionService` state.

---

### `newClientNote(): void`

**Signature:** `newClientNote(): void`

**Step-by-step logic:**

1. Resets `this.ClientNote` to a fresh, empty `ClientNote` instance via `new ClientNote().deserialize({})`.
2. Sets `this.clientNoteFormRef.open = true` — imperatively opens the form dialog.
3. Sets `this.saveMode = saveMode.POST` — signals the form to use HTTP POST on submission.

**Triggered by:** The `(isInsertDataChange)` event from `react-analytical-table` (fires when the user clicks the insert/create toolbar button).

**Emits:** Nothing directly.

---

### `editClientNote(data: any): void`

**Signature:** `editClientNote(data: any): void`

**Step-by-step logic:**

1. Deserialises the supplied row data into `this.ClientNote` via `new ClientNote().deserialize(data)` — populates all fields from the selected row's raw API response object.
2. Sets `this.clientNoteFormRef.open = true` — imperatively opens the form dialog.
3. Sets `this.saveMode = saveMode.PUT` — signals the form to use HTTP PUT on submission.

**Triggered by two paths:**
- The `(onEditSelectData)` output from `react-analytical-table` (fires when a row is selected in single-selection mode).
- The inline edit button inside the Actions column cell `onClick` handler.

**Emits:** Nothing directly.

---

### `processData(event: any): void`

**Signature:** `processData(event: any): void`

**Step-by-step logic:**

1. Re-emits the event received from `app-client-note-form`'s `(RefreshTable)` output directly through `this.refreshTable.emit(event)`.

**Purpose:** Acts as a pass-through relay — the form dialog emits a refresh signal after a successful save, and this method forwards that signal to `react-analytical-table`'s `[refreshTrigger]` binding, causing the table to reload its data.

**Emits:** `refreshTable` with the forwarded event payload.

---

## Template Bindings & Structure

The template contains three child component elements arranged flat (no wrapper element):

### 1. `<react-analytical-table>`

The primary data table. Key bindings:

| Binding | Value | Notes |
|---|---|---|
| `[headerTitle]` | `headerTitle` | Displays `"Client Note"` in the toolbar. |
| `[insertTitle]` | `insertTitle` | Displays `"New"` on the create button. |
| `[apiUrl]` | `'ClientNotes?$orderby=id desc'` | OData endpoint; results ordered by `id` descending. Hardcoded string literal. |
| `[alternateRowColors]` | `true` | Zebra-striped rows. |
| `[isInsertData]` | `rolePermissionService.hasPermission(permissions.BASE_DATA_CLIENT_NOTE_CREATE)` | Shows/hides the insert button based on the CREATE permission. |
| `[isSearchFilter]` | `true` | Enables the search/filter input in the toolbar. |
| `[isFilterable]` | `true` | Enables per-column filtering UI. |
| `[isOdata]` | `true` | Tells the table to use OData query conventions. |
| `[model]` | `clientNote` | The `ClientNote` class reference used for data shape. |
| `[isGroupable]` | `false` | Row grouping disabled. |
| `[isSortable]` | `true` | Column sorting enabled. |
| `[isTableTree]` | `false` | Tree table disabled; flat list. |
| `[isInfiniteScroll]` | `true` | Infinite scroll enabled instead of pagination. |
| `[infiniteScrollNumber]` | `10` | Number of rows loaded per scroll increment. |
| `[minRowsNumber]` | `15` | Minimum rows rendered in the table body. |
| `[headerHeight]` | `30` | Column header row height in pixels. |
| `[rowHeight]` | `30` | Data row height in pixels. |
| `[emptyDataText]` | `'No Data Found'` | Placeholder shown when the result set is empty. |
| `[tableColumn]` | `tableColum()` | Column definitions; method called on every change detection cycle. |
| `[selectionMode]` | `'Single'` | Only one row can be selected at a time. |
| `[rowSelectionBehavior]` | `'RowOnly'` | Row selection triggered by clicking the row, not a checkbox. |
| `(onEditSelectData)` | `editClientNote($event)` | Fires with the selected row's data when a row is activated/selected. |
| `(isInsertDataChange)` | `newClientNote()` | Fires when the user clicks the insert/create button. |
| `[refreshTrigger]` | `refreshTable` | The `EventEmitter` instance itself is passed; the table subscribes to it and reloads data on each emission. |

### 2. `<app-delete-entity>`

Handles the delete confirmation and HTTP DELETE execution.

| Binding | Value | Notes |
|---|---|---|
| `[IsDelete]` | `IsDelete` | Receives the `EventEmitter<string>`. Subscribes internally to receive the delete URL path. |
| `(isSuccess)` | `refreshTable.emit()` | On successful deletion, directly emits `refreshTable` to reload the table. |

### 3. `<app-client-note-form>`

The create/edit dialog form.

| Binding | Value | Notes |
|---|---|---|
| `#clientNoteForm` | — | Template ref used by `@ViewChild("clientNoteForm")`. |
| `[saveMode]` | `saveMode` | Passes the current `"POST"` or `"PUT"` mode to the form. |
| `[clientNote]` | `ClientNote` | Passes the current (empty or populated) `ClientNote` instance to pre-fill form fields. |
| `(RefreshTable)` | `processData($event)` | Receives the post-save refresh signal and relays it through `processData()`. |

---

## API Calls

This component makes **no direct HTTP calls**. All data fetching and mutation is delegated to child components.

| HTTP Method | Endpoint | Initiated by | Notes |
|---|---|---|---|
| GET (OData) | `ClientNotes?$orderby=id desc` | `react-analytical-table` on init and on `refreshTrigger` emission | Handled entirely within the table child component. |
| POST | `ClientNotes` (inferred) | `app-client-note-form` when `saveMode = "POST"` | Handled by the form child component. |
| PUT | `ClientNotes/{id}` (inferred) | `app-client-note-form` when `saveMode = "PUT"` | Handled by the form child component. |
| DELETE | `ClientNotes/{id}` | `app-delete-entity` after receiving the `IsDelete` emission | URL path constructed as `` `ClientNotes/${row.original.id}` `` in the delete button's `onClick`. |

---

## Validation Logic

This component contains **no validation logic**. All form field validation is handled by `app-client-note-form`.

---

## Services Injected

| Service | Injection access | Methods / properties used |
|---|---|---|
| `RolePermissionService` | `public rolePermissionService` | `hasPermission(permission: Permissions): boolean` — called in `tableColum()` to gate the Actions column and its individual edit/delete buttons; also called from the template via `rolePermissionService.hasPermission(permissions.BASE_DATA_CLIENT_NOTE_CREATE)` to gate the insert button. |

---

## Inter-component Communication

| Direction | Mechanism | Detail |
|---|---|---|
| Parent → `react-analytical-table` | `@Input` bindings | Table configuration, column definitions, API URL, selection mode, scroll settings, refresh trigger. |
| `react-analytical-table` → this | `(onEditSelectData)` output | Fires with row data on row selection; calls `editClientNote()`. |
| `react-analytical-table` → this | `(isInsertDataChange)` output | Fires on create button click; calls `newClientNote()`. |
| This → `app-client-note-form` | Imperative `clientNoteFormRef.open = true` + `@Input` bindings | Opens the form dialog and passes `saveMode` and `ClientNote` data. |
| `app-client-note-form` → this | `(RefreshTable)` output | Post-save signal relayed via `processData()` to the `refreshTable` emitter. |
| This → `app-delete-entity` | `[IsDelete]` binding (passes `EventEmitter<string>`) | The delete URL path is emitted through `IsDelete`; `app-delete-entity` subscribes to this emitter. |
| `app-delete-entity` → this | `(isSuccess)` output | On successful delete, calls `refreshTable.emit()` directly in the template. |
| This → parent (if any) | `@Output IsDelete` and `@Output refreshTable` | Both emitters are also exposed as standard Angular outputs, so any parent component that uses `app-notes-list` can listen to delete requests and table refresh signals. |

---

## Enums / Models Used

### `ClientNote` (class — `@shared/model/clientNote`)

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | `number \| undefined` | — | Primary key. Used in the delete URL: `` `ClientNotes/${row.original.id}` ``. |
| `is_active` | `boolean \| undefined` | `true` | Rendered in the Active column as accept/decline icon. |
| `custom_id` | `string \| undefined` | — | Shown in the ID column. |
| `name` | `string` | `''` | Shown in the Note Name column. |
| `created_at` | `string \| undefined` | — | Displayed as a localised date string via `new Date(value).toLocaleDateString()`. |
| `updated_at` | `string \| undefined` | — | Not displayed in the list; excluded from OData writes via `toOdata()`. |

Key methods on `ClientNote`:
- `deserialize(input: any): this` — shallow-assigns all properties from the input object; used to hydrate instances from raw API response data.
- `toOdata(): Object` — returns a copy of the instance with `created_at` and `updated_at` set to `undefined`, used by the form for write operations.

### `saveMode` (enum — `@shared/enums/saveMode`)

| Member | Value |
|---|---|
| `GET` | `"GET"` |
| `POST` | `"POST"` |
| `PUT` | `"PUT"` |
| `PATCH` | `"PATCH"` |
| `DELETE` | `"DELETE"` |
| `REQUEST` | `"REQUEST"` |

This component uses only `saveMode.POST` and `saveMode.PUT`.

### `Permissions` (enum — `@shared/enums/permissions`)

Relevant members used by this component:

| Member | Value |
|---|---|
| `BASE_DATA_CLIENT_NOTE` | `'BASE_DATA_CLIENT_NOTE'` |
| `BASE_DATA_CLIENT_NOTE_CREATE` | `'BASE_DATA_CLIENT_NOTE_CREATE'` |
| `BASE_DATA_CLIENT_NOTE_EDIT` | `'BASE_DATA_CLIENT_NOTE_EDIT'` |
| `BASE_DATA_CLIENT_NOTE_DELETE` | `'BASE_DATA_CLIENT_NOTE_DELETE'` |

### `Localization` (static utility — `@app/shared/utilities/localization`)

Used only for `Localization.CreatedAt`, which resolves to the i18n string `"Created On"` (defined via `$localize\`Created On\``).

### `RolePermissionService` (`@app/services/role-permission-service/role-permission.service`)

Service providing role-based access control. The method `hasPermission(permission: string): boolean` is the only method used.

---

## Key Business Logic

### Permission-driven column rendering
The Actions column is only added to the column array if the user holds at least one of `BASE_DATA_CLIENT_NOTE_EDIT` or `BASE_DATA_CLIENT_NOTE_DELETE`. Within the column's Cell renderer, each button is independently gated by its respective permission. This means:
- A user with only EDIT permission sees the edit button but not delete.
- A user with only DELETE permission sees the delete button but not edit.
- A user with neither permission sees no Actions column at all.

### Dual trigger path for `editClientNote`
The edit flow can be initiated two ways:
1. Clicking a row in single-selection mode — the table fires `(onEditSelectData)` with the row data.
2. Clicking the explicit edit icon button in the Actions column cell.

Both paths converge on `editClientNote(data)`, which resets `ClientNote` and opens the form. Care should be taken that single-row selection does not inadvertently open the form when the user's intent is only to select a row.

### `refreshTable` as both an internal relay and an external output
`refreshTable` is an `EventEmitter<void>` that is passed by reference into the `react-analytical-table` component's `[refreshTrigger]` binding. When `refreshTable.emit()` is called (either after a save or after a delete), the table component re-fetches data from the API. Because `refreshTable` is also declared as `@Output`, any parent component hosting `app-notes-list` receives these emissions and can react to them.

### `IsDelete` path construction
The delete resource path is constructed inline in the JSX cell renderer as the string `` `ClientNotes/${row.original.id}` ``. This path is passed to `app-delete-entity` which is expected to call the delete API using this as the endpoint suffix. The `id` field used here is the server-assigned numeric primary key, not `custom_id`.

### `tableColum()` called on every change detection cycle
The template binding `[tableColumn]="tableColum()"` calls the method on every Angular change detection pass. Because the method rebuilds the entire columns array each time (including calling `rolePermissionService.hasPermission(...)` multiple times), this is a performance consideration in high-frequency change detection scenarios. There is no memoisation or `OnPush` change detection strategy applied.

### `ClientNote` class reference vs. instance
Two separate properties hold the class and an instance:
- `clientNote = ClientNote` — the class constructor reference, passed as `[model]` to the table for type introspection.
- `ClientNote = new ClientNote().deserialize({})` — a live instance that is mutated/replaced when the user opens the create or edit form.
