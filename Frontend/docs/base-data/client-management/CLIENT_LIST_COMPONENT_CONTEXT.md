# CLIENT_LIST_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| TS file | `src/app/modules/base-data-management/client-management/client-list/client-management.component.ts` |
| HTML file | `src/app/modules/base-data-management/client-management/client-list/client-management.component.html` |
| SCSS file | `src/app/modules/base-data-management/client-management/client-list/client-management.component.scss` |
| Selector | `app-client-management` |
| Component type | List (with inline form launch and delete delegation) |
| Purpose | Renders the Client Management list page using `app-ag-grid-table` (converted from react-analytical-table). Fetches clients with `url="Clients"` and `expandQuery="areas,notes"`. Provides permission-gated buttons to create, edit, and delete client records. Orchestrates `app-client-form` (create/edit) and `app-delete-entity` (delete confirmation). |

---

## Inputs (@Input)

This component declares **no `@Input()` properties**. It is a top-level feature component intended to be used as a routed page or embedded directly in a parent layout without receiving external data bindings.

---

## Outputs (@Output)

| Output name | Event type | Purpose |
|---|---|---|
| `refreshTable` | `EventEmitter<void>` | Emitted to the parent to signal that the data table should reload. Also wired internally to the `react-analytical-table` `[refreshTrigger]` binding, so it triggers an in-component table refresh as well. |
| `IsDelete` | `EventEmitter<any>` | Emitted with the OData-style resource path string (e.g. `"Clients/5"`) to the `app-delete-entity` child component via its `[IsDelete]` input, triggering the delete confirmation dialog. |

---

## State Properties

| Property | Type | Default value | Purpose |
|---|---|---|---|
| `clientFormRef` | `ClientFormComponent` | (injected via `@ViewChild`) | Direct reference to the `app-client-form` child component. Used to imperatively set properties on the form before opening it for create or edit. |
| `saveMode` | `string` | `saveMode.POST` (`"POST"`) | Passed as `[saveMode]` input to `app-client-form`. Indicates whether a pending save should be a create (POST) or update (PUT). |
| `Client` | class reference | `Client` (class) | Assigned from the imported `Client` model class and passed as `[model]` to `react-analytical-table`, enabling the table to instantiate model objects for its own internal operations. |
| `localization` | `typeof Localization` | `Localization` (utility) | Reference to the global localization utility object. Used to populate the `Created On` column header via `this.localization.CreatedAt`. |
| `client` | `Client` | `new Client()` | The current `Client` instance passed as `[client]` input binding to `app-client-form`. Serves as the initial (empty) model for the form. |
| `isLoading` | `boolean` | `false` | Declared but not actively consumed in the template or in any method. Reserved for future loading-state indication. |
| `ToastType` | `string` | `""` | Declared but not actively consumed in the list component itself (toast control is handled inside `ClientFormComponent`). |
| `insertTitle` | `string` | Localized `"New"` | Passed as `[insertTitle]` to `react-analytical-table`. Sets the label on the insert/create button rendered in the table toolbar. |
| `headerTitle` | `string` | Localized `"Client List"` | Passed as `[headerTitle]` to `react-analytical-table`. Sets the title displayed in the table header bar. |
| `permissions` | `typeof Permissions` | `Permissions` (enum) | Reference to the `Permissions` enum used in template bindings to check create/edit/delete rights without string literals. |

---

## ViewChild / ViewChildren

| Ref name | Type | Template variable | Purpose |
|---|---|---|---|
| `clientFormRef` | `ClientFormComponent` | `#clientForm` | Provides imperative access to the client form child component. Both `newClient()` and `editClient()` directly mutate its public properties (`client`, `open`, `saveMode`, `selectedTab`, `SelectedArea`, `SelectedNote`, etc.) to configure the form before revealing it, because the form opens and closes itself internally via its `open` property rather than via an Angular structural directive on the parent. |

---

## Lifecycle Hooks

This component declares **no lifecycle hooks** (`ngOnInit`, `ngOnDestroy`, `ngAfterViewInit`, etc.). All initialization is deferred to child components. The `constructor` performs only a single dependency injection:

```
constructor(public rolePermissionService: RolePermissionService)
```

The service is declared `public` so the HTML template can call `rolePermissionService.hasPermission(...)` directly.

---

## Methods — DETAILED

### `tableColum(): any[]`

**Signature:** `tableColum(): any[]`

**Step-by-step logic:**

1. Initializes an array `columns` with four always-visible column definitions:

   - **Active** (`accessor: "is_active"`, width 80): Renders a UI5 `<Icon name="accept" />` for `true`, `<Icon name="decline" />` for `false`. Filtering and grouping disabled.
   - **ID** (`accessor: "custom_id"`, width 100): Displays the client's custom/business ID string. Filtering and grouping disabled.
   - **Client Name** (`accessor: "name"`): Displays the client name. Auto-resizable. Filterable via the table's built-in search.
   - **Created On** (`accessor: "created_at"`): Displays the creation timestamp formatted as a locale date string via `new Date(value).toLocaleDateString()`. Filtering disabled.

2. Checks whether the current user has either `BASE_DATA_CLIENT_EDIT` or `BASE_DATA_CLIENT_DELETE` permission using `rolePermissionService.hasPermission(...)`. If at least one of these permissions is present, an **Actions** column is appended:

   - The cell renders a `<div>` containing up to two `<Button>` elements:
     - **Edit button** (`icon="edit"`, `design="Transparent"`): Rendered only when `BASE_DATA_CLIENT_EDIT` permission exists. On click, calls `this.editClient(row.original)` with the full row data object.
     - **Delete button** (`icon="delete"`, `design="Transparent"`): Rendered only when `BASE_DATA_CLIENT_DELETE` permission exists. On click, emits `this.IsDelete.emit(\`Clients/${row.original.id}\`)`, passing the OData resource path string to the parent-bound `app-delete-entity`.
   - The Actions column has `cellLabel: () => ""` (suppresses accessibility label), `disableFilters`, `disableGroupBy`, `disableSortBy` all true, `id: "actions"`, width 100.

3. Returns the completed `columns` array.

**Returns:** `any[]` — array of column definition objects consumed by `react-analytical-table`.

**Side effects:** None — the method is pure with respect to component state, though it reads `rolePermissionService` on each call. Because it is bound as `[tableColumn]="tableColum()"` in the template (a method call, not a property), it re-evaluates on every change detection cycle.

---

### `newClient(): void`

**Signature:** `newClient(): void`

**Step-by-step logic:**

1. Resets the form's client model to a blank instance: `this.clientFormRef.client = new Client().deserialize({})`.
2. Sets `this.clientFormRef.selectedTab = "coreData"` to ensure the form opens on the first tab.
3. Opens the dialog: `this.clientFormRef.open = true`.
4. Sets the form's save mode to POST: `this.clientFormRef.saveMode = saveMode.POST`.

**Called when:** The `react-analytical-table` emits `(isInsertDataChange)`, i.e., the user clicks the "New" toolbar button — permitted only when `BASE_DATA_CLIENT_CREATE` is granted.

**Returns:** `void`

**Side effects:** Mutates multiple public properties on `clientFormRef`, which causes the form dialog to open in create mode.

---

### `editClient(items: any): void`

**Signature:** `editClient(items: any): void`

**Parameter:** `items` — the raw row data object from the table (a deserialized `Client` record including expanded `areas` and `notes` arrays from the OData `$expand` clause).

**Step-by-step logic:**

1. Deserializes the row data into the form's client model: `this.clientFormRef.client.deserialize(items)`.
2. Sets `this.clientFormRef.selectedTab = "coreData"` to open on the first tab.
3. Opens the dialog: `this.clientFormRef.open = true`.
4. Sets save mode to PUT: `this.clientFormRef.saveMode = saveMode.PUT`.
5. **Area pre-population:**
   - Reads `items.areas?.[0]` (the first area from the OData `$expand=areas` result).
   - Creates `new ClientArea().deserialize(area ?? {})` and assigns it to `this.clientFormRef.SelectedArea`.
   - Sets `this.clientFormRef.clientAreaName = area?.name ?? ""` for the form's display field.
6. **Note pre-population:**
   - Reads `items.notes?.[0]` (the first note from the OData `$expand=notes` result).
   - Creates `new ClientNote().deserialize(note ?? {})` and assigns it to `this.clientFormRef.SelectedNote`.
   - Sets `this.clientFormRef.clientNoteName = note?.name ?? ""` for the form's display field.
7. **"Same as Bill-To" flag:**
   - Sets `this.clientFormRef.sameAsBillTo = items.ship_to === items.bill_to` — auto-checks the "Ship To same as Bill To" toggle if both address fields hold the same non-null value.
8. Calls `this.clientFormRef.initializeAddMoreState(items)` to determine whether the "second contact person" expandable section should be shown or hidden based on whether `second_contact_person_name` or `second_contact_person_phone` have values.

**Called when:**
- The Actions column "edit" button is clicked (calls directly).
- The `react-analytical-table` emits `(onEditSelectData)` (the table's built-in row-selection edit event also bound in the template).

**Returns:** `void`

**Side effects:** Mutates eight properties on `clientFormRef` and calls one method on it, configuring it fully for an edit session before the dialog opens.

---

### `processData(event: any): void`

**Signature:** `processData(event: any): void`

**Step-by-step logic:**

1. Re-emits the incoming event from `app-client-form`'s `(RefreshTable)` output directly through the component's own `refreshTable` emitter: `this.refreshTable.emit(event)`.

**Called when:** `app-client-form` emits `(RefreshTable)` — which happens after a successful POST or PUT save.

**Returns:** `void`

**Side effects:** Triggers a table data reload by propagating the event through `refreshTable`, which is also bound to the table's `[refreshTrigger]` input.

---

## Template Bindings & Structure

The template (`client-management.component.html`) contains three top-level elements arranged sequentially:

### 1. `<react-analytical-table>`

The main data table component (a UI5/SAP React wrapper integrated into Angular). Key bindings:

| Binding | Value | Notes |
|---|---|---|
| `[headerTitle]` | `headerTitle` | Renders "Client List" in the table toolbar |
| `[insertTitle]` | `insertTitle` | Renders "New" as the insert button label |
| `[apiUrl]` | `'Clients?$expand=areas,notes&$orderby=id desc'` | OData endpoint; expands related areas and notes; ordered newest first |
| `[alternateRowColors]` | `true` | Zebra-striped rows |
| `[isInsertData]` | `rolePermissionService.hasPermission(permissions.BASE_DATA_CLIENT_CREATE)` | Shows insert button only with CREATE permission |
| `[isSearchFilter]` | `true` | Enables the search/filter input in the toolbar |
| `[isFilterable]` | `true` | Enables per-column filtering |
| `[isOdata]` | `true` | Tells the table to use OData query conventions |
| `[model]` | `Client` | The model class for data binding/instantiation |
| `[isGroupable]` | `false` | Grouping UI disabled |
| `[isSortable]` | `true` | Column sorting enabled |
| `[isTableTree]` | `false` | Flat table (no tree expansion) |
| `[isExport]` | `true` | Shows export button |
| `[exportApiUrl]` | `'clients/export'` | REST endpoint for CSV/Excel export |
| `[isImport]` | `true` | Shows import button |
| `[importApiUrl]` | `'clients/import'` | REST endpoint for data import |
| `[isInfiniteScroll]` | `true` | Infinite scroll pagination enabled |
| `[infiniteScrollNumber]` | `10` | Loads 10 rows per scroll increment |
| `[minRowsNumber]` | `15` | Minimum rendered rows (prevents layout collapse) |
| `[headerHeight]` | `30` | Table header row height in px |
| `[rowHeight]` | `30` | Data row height in px |
| `[emptyDataText]` | `'No Data Found'` | Placeholder text when no records exist |
| `[tableColumn]` | `tableColum()` | Column definitions (method call, re-evaluated on each CD cycle) |
| `[refreshTrigger]` | `refreshTable` | Passing the `EventEmitter` directly; the table subscribes to it and reloads data when it fires |
| `[selectionMode]` | `'Single'` | Only one row can be selected at a time |
| `[rowSelectionBehavior]` | `'RowOnly'` | Selection triggered only by clicking the row, not a checkbox |
| `(onEditSelectData)` | `editClient($event)` | Table's row-edit event — calls `editClient` with selected row data |
| `(isInsertDataChange)` | `newClient()` | Table's insert button click event — calls `newClient()` |

### 2. `<app-delete-entity>`

The shared delete confirmation dialog.

| Binding | Value | Notes |
|---|---|---|
| `(isSuccess)` | `refreshTable.emit()` | On successful delete, fires `refreshTable` to reload the table |
| `[IsDelete]` | `IsDelete` | Receives the `EventEmitter<any>` from this component; when a delete button in the Actions column fires `IsDelete.emit("Clients/5")`, the child component opens its confirmation dialog with that resource path |

### 3. `<app-client-form>`

The create/edit dialog form.

| Binding | Value | Notes |
|---|---|---|
| `#clientForm` | — | Template reference variable; consumed by `@ViewChild("clientForm")` |
| `[saveMode]` | `saveMode` | Passes the component's `saveMode` string property (always `"POST"` at rest; the form sets its own `saveMode` imperatively via `clientFormRef`) |
| `[client]` | `client` | Passes the component's blank `Client` instance as the initial model |
| `(RefreshTable)` | `processData($event)` | Listens for successful save events from the form and forwards them via `processData()` |

---

## API Calls

All HTTP calls originate from child components. This list component itself makes **no direct API calls**. The table widget and child components make the following calls:

| HTTP Method | Endpoint | Initiated by | When called | Payload / Query params | Response handling |
|---|---|---|---|---|---|
| GET (OData) | `Clients?$expand=areas,notes&$orderby=id desc` | `react-analytical-table` | On mount and whenever `refreshTable` emits | Pagination params appended by table (infinite scroll, page size 10) | Table renders rows; each row includes nested `areas[]` and `notes[]` arrays |
| GET | `clients/export` | `react-analytical-table` | When user clicks the export button | None (table may append current filter state) | Browser downloads the export file |
| POST | `clients/import` | `react-analytical-table` | When user submits an import file | Multipart file upload | Table refreshes on success |
| GET (OData) | `ClientNotes?$orderby=id desc&$filter=is_active eq true` | `ClientFormComponent.LoadClientNote()` | On `ngOnInit` of the form component | None | Populates `SelectedNoteList` for the form's note dropdown |
| GET (OData) | `ClientAreas?$orderby=id desc&$filter=is_active eq true` | `ClientFormComponent.LoadClientArea()` | On `ngOnInit` of the form component | None | Populates `SelectedAreaList` for the form's area dropdown |
| POST | `Clients` | `ClientFormComponent.saveClientInfo()` | On save in create mode | `client.toOdata()` (excludes `notes`, `areas`, `created_at`, `updated_at`) | Emits `ClientAdded`, calls `ClientAssociate`, closes dialog, refreshes table |
| PUT | `Clients({id})` | `ClientFormComponent.saveClientInfo()` | On save in edit mode | `client.toOdata()` | Emits `ClientAdded`, calls `ClientAssociate`, closes dialog, refreshes table |
| POST | `client/associate` | `ClientFormComponent.ClientAssociate()` | After POST or PUT when area or note is selected | `{ client_id, clientarea: [{id}], clientnote: [{id}] }` | Resets `SelectedArea`/`SelectedNote`, closes dialog |
| DELETE | `Clients/{id}` (resource path) | `app-delete-entity` | When user confirms delete in the dialog | Resource path string passed via `IsDelete` emitter | `app-delete-entity` emits `(isSuccess)`, which triggers `refreshTable.emit()` |

---

## Validation Logic

Validation is performed entirely within `ClientFormComponent`. The list component itself contains no validation. For completeness, the form's validation that is triggered via `editClient()` / `newClient()` is documented here:

| Field | Rule | State on failure | State on success | Triggered by |
|---|---|---|---|---|
| `name` | Must be non-empty after trim | `valueStateOptions.name = ValueState.Negative` | `ValueState.None` | `checkValidation(event, 'name')` (on input blur/change) and `coreDataValid()` (on save attempt) |
| `email` | Must be non-empty after trim | `valueStateOptions.email = ValueState.Negative` | `ValueState.None` | `checkValidation(event, 'email')` and `coreDataValid()` |
| `address` | Must be non-empty after trim | `valueStateOptions.address = ValueState.Negative` | `ValueState.None` | `checkValidation(event, 'address')` and `addressvalidation()` |
| `bill_to` | Must be non-empty after trim | `valueStateOptions.bill_to = ValueState.Negative` | `ValueState.None` | `checkValidation(event, 'bill_to')` and `addressvalidation()` |
| `ship_to` | Must be non-empty after trim | `valueStateOptions.ship_to = ValueState.Negative` | `ValueState.None` | `checkValidation(event, 'ship_to')` and `addressvalidation()` |

**Save flow validation guards:**
- `coreDataValid()` validates `name` and `email`. If it returns `false`, save is aborted and the form is forced back to the `"coreData"` tab.
- `addressvalidation()` validates `address`, `bill_to`, and `ship_to`. If it returns `false`, save is aborted and the form is forced to the `"personalData"` tab.
- Both guards run in sequence before any HTTP call is made.

---

## Services Injected

| Service | Injection access | Why injected | Methods used |
|---|---|---|---|
| `RolePermissionService` | `public rolePermissionService` | Permission gating for table columns (edit/delete actions), table insert button, and template bindings | `hasPermission(permission: string): boolean` — checks if the current user's role includes the given permission string |

The `public` visibility modifier is required because the HTML template directly calls `rolePermissionService.hasPermission(...)` in the `[isInsertData]` binding.

---

## Inter-component Communication

| Direction | Mechanism | Detail |
|---|---|---|
| List → Form (open create) | Imperative `@ViewChild` property mutation | `newClient()` sets `clientFormRef.client`, `clientFormRef.selectedTab`, `clientFormRef.open`, `clientFormRef.saveMode` |
| List → Form (open edit) | Imperative `@ViewChild` property mutation | `editClient()` sets the above plus `clientFormRef.SelectedArea`, `clientFormRef.clientAreaName`, `clientFormRef.SelectedNote`, `clientFormRef.clientNoteName`, `clientFormRef.sameAsBillTo`; calls `clientFormRef.initializeAddMoreState(items)` |
| Table → List (edit row) | `(onEditSelectData)` event from `react-analytical-table` | Fires `editClient($event)` with the row's full data object |
| Table → List (insert click) | `(isInsertDataChange)` event from `react-analytical-table` | Fires `newClient()` |
| Form → List (save success) | `(RefreshTable)` output from `app-client-form` | Calls `processData(event)`, which re-emits via `refreshTable` |
| List → Table (refresh) | `[refreshTrigger]` bound to the `refreshTable` EventEmitter | Table subscribes; firing the emitter triggers a data reload |
| List → Delete dialog (trigger) | `[IsDelete]` input + `IsDelete` EventEmitter | Delete button in Actions column emits `IsDelete.emit("Clients/{id}")`; `app-delete-entity` receives the emitter via its `[IsDelete]` input and opens its own confirmation dialog |
| Delete dialog → List (success) | `(isSuccess)` output from `app-delete-entity` | Calls `refreshTable.emit()` directly in the template to reload the table |
| List → Parent (table refresh) | `@Output() refreshTable` | Propagates table refresh signals upward if this component is embedded in a parent that listens |
| List → Parent (delete trigger) | `@Output() IsDelete` | Propagates the delete resource path upward; in the current template the local `app-delete-entity` also consumes it directly |

---

## Enums / Models Used

### Enums

| Enum | Import path | Values used |
|---|---|---|
| `saveMode` | `@shared/enums/saveMode` | `saveMode.POST` (default state), `saveMode.PUT` (edit mode) |
| `Permissions` | `@app/shared/enums/permissions` | `BASE_DATA_CLIENT_CREATE`, `BASE_DATA_CLIENT_EDIT`, `BASE_DATA_CLIENT_DELETE` |

Full `saveMode` enum: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `REQUEST`.

Relevant `Permissions` enum values for this feature:
- `BASE_DATA_CLIENT` — parent permission
- `BASE_DATA_CLIENT_LIST` — list view access
- `BASE_DATA_CLIENT_CREATE` — controls insert button visibility
- `BASE_DATA_CLIENT_EDIT` — controls edit button visibility in Actions column
- `BASE_DATA_CLIENT_DELETE` — controls delete button visibility in Actions column

### Models / Interfaces

| Model/Class | Import path | Role in this component |
|---|---|---|
| `Client` | `@shared/model/client` | The primary data model. Instantiated as blank via `new Client()` for the form default. The class reference itself is also passed to the table as `[model]`. Contains `deserialize(input)` and `toOdata()` methods. |
| `ClientArea` | `@shared/model/clientArea` | Used in `editClient()` to create a `new ClientArea().deserialize(area ?? {})` for pre-populating the form's area selection. |
| `ClientNote` | `@shared/model/clientNote` | Used in `editClient()` to create a `new ClientNote().deserialize(note ?? {})` for pre-populating the form's note selection. |

#### `Client` model fields

| Field | Type | Default |
|---|---|---|
| `id` | `number?` | undefined |
| `name` | `string` | `''` |
| `address` | `string?` | `''` |
| `first_contact_person_name` | `string?` | `''` |
| `first_contact_person_phone` | `string?` | `''` |
| `second_contact_person_name` | `string?` | `''` |
| `second_contact_person_phone` | `string?` | `''` |
| `tin` | `string?` | `''` |
| `bin` | `string?` | `''` |
| `email` | `string?` | `''` |
| `is_active` | `boolean?` | `true` |
| `custom_id` | `string?` | undefined |
| `areas` | `ClientArea[]?` | undefined |
| `notes` | `ClientNote[]?` | undefined |
| `bill_to` | `string?` | `''` |
| `ship_to` | `string?` | `''` |
| `created_at` | `string?` | undefined |
| `updated_at` | `string?` | undefined |

`toOdata()` strips `notes`, `areas`, `created_at`, `updated_at` before sending to the API.

#### `ClientArea` model fields

`id?`, `is_active?` (default `true`), `name` (default `''`), `custom_id?`, `created_at?`, `updated_at?`

#### `ClientNote` model fields

`id?`, `is_active?` (default `true`), `custom_id?`, `name` (default `''`), `created_at?`, `updated_at?`

### Utilities

| Utility | Role |
|---|---|
| `Localization` | Provides localized string constants. `Localization.CreatedAt` used as the "Created On" column header. |

---

## Key Business Logic

### OData Expand and Edit Pre-population
The table fetches clients with `$expand=areas,notes`, meaning each row object includes nested arrays. `editClient()` only pre-populates from the **first element** of each array (`items.areas?.[0]`, `items.notes?.[0]`). If a client has multiple areas or notes, only the first is pre-loaded into the form. The optional chaining (`?.`) and nullish coalescing (`?? {}`, `?? ""`) ensure no runtime errors when these arrays are absent or empty.

### Permission-gated Actions Column
The Actions column is only appended to the column definition array when the user has at least one of `EDIT` or `DELETE` permissions. Within the cell renderer, each button is individually gated — it is possible for the column to appear with only an edit button (no delete) or only a delete button (no edit), depending on the user's role. This prevents the entire column from being hidden when a user has one permission but not the other.

### `tableColum()` Called as a Template Expression
The column definitions are bound as `[tableColumn]="tableColum()"` — a method invocation in the template, not a stored property. This means column definitions are recomputed on every Angular change detection cycle. While this is not a performance concern for small datasets, it is worth noting for future optimization (a memoized getter or `OnPush` change detection strategy could eliminate redundant recomputations).

### Imperative Child Component Control Pattern
Rather than using Angular's standard `@Input`/`@Output` pattern to drive the form dialog open state, this component uses `@ViewChild` to directly mutate public properties on `ClientFormComponent`. This is a deliberate design choice: the form manages its own `open` state internally and provides no `@Input() open` binding. The list component configures the form by side-effect before setting `clientFormRef.open = true`.

### Delete via Emitter Pass-Through
The `IsDelete` output is wired in two directions simultaneously:
1. The template passes `IsDelete` (the emitter itself) as an `[IsDelete]` input to `app-delete-entity`. This means `app-delete-entity` subscribes to the emitter directly.
2. When an Actions column delete button fires, it calls `this.IsDelete.emit(...)`, which both propagates to any parent listening to `(IsDelete)` and notifies `app-delete-entity`.

### "Same as Bill To" Synchronization (form-level, initialized from list)
`editClient()` computes `sameAsBillTo = items.ship_to === items.bill_to` using strict equality. If both fields happen to hold the same non-empty string, the checkbox will be checked, and the form's `onBillToInput()` will keep them in sync during editing. If `bill_to` is cleared, `sameAsBillTo` is automatically set to `false` in the form.

### Second Contact Person "Add More" State
`editClient()` delegates to `clientFormRef.initializeAddMoreState(items)`. The form inspects whether `second_contact_person_name` or `second_contact_person_phone` have values and shows or hides the expandable second-contact section accordingly. If both are empty, the section remains hidden and the fields are cleared on collapse. This ensures users editing a client that previously had no second contact are not presented with unnecessary UI.

### `refreshTable` EventEmitter Dual Use
The `refreshTable` EventEmitter serves two purposes simultaneously:
1. It is passed as `[refreshTrigger]` to the table widget, which subscribes to it and reloads data when it emits.
2. It is also declared as `@Output()`, exposing it to any parent component that hosts `app-client-management`.

Both `processData()` (after a successful form save) and the `app-delete-entity` `(isSuccess)` binding call `refreshTable.emit()`, ensuring the table is always refreshed after any create, update, or delete operation.
