# AREA_LIST_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| TS file | `Frontend/src/app/modules/base-data-management/client-management/client-area/area-list/area-list.component.ts` |
| HTML file | `Frontend/src/app/modules/base-data-management/client-management/client-area/area-list/area-list.component.html` |
| Selector | `app-area-list` |
| Component type | List (with embedded form dialog and delete dialog) |
| Purpose | Displays an ag-grid-table of Client Area records (converted from react-analytical-table). Provides permission-gated create, edit, and delete actions. Hosts `app-client-area-form` for create/edit and `app-delete-entity` for delete confirmation. Communicates results back to the parent via EventEmitters. |

---

## Inputs (@Input)

This component declares no `@Input()` properties. All data is fetched internally via the `react-analytical-table` component using its `apiUrl` binding.

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `IsDelete` | `EventEmitter<string>` | Emitted when the user clicks the delete button on a row. The emitted value is the OData resource path string for the entity to delete (e.g. `"ClientAreas/5"`). This is passed directly to the `app-delete-entity` child component via its `[IsDelete]` input. |
| `IsSuccessChanges` | `EventEmitter<void>` | Emitted after a successful create or edit operation (relayed from `ClientAreaFormComponent.RefreshTable`) and also directly after a successful delete (relayed from `app-delete-entity.isSuccess`). The parent component listens to this to know when to refresh any dependent UI. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `clientAreaFormRef` | `ClientAreaFormComponent` | (injected via `@ViewChild`) | Reference to the `<app-client-area-form>` element in the template. Used to imperatively set `clientAreaFormRef.open = true` to open the dialog. |
| `areaList` | `typeof ClientArea` (class reference) | `ClientArea` (the class itself) | Passed to `react-analytical-table` as the `[model]` binding so the table knows how to deserialize/type individual rows. |
| `clientArea` | `ClientArea` | `new ClientArea().deserialize({})` (empty instance) | Holds the currently selected or newly constructed `ClientArea` instance. Passed to the `ClientAreaFormComponent` via `[clientArea]` binding. Reset to an empty instance on new, or populated with row data on edit. |
| `insertTitle` | `string` | `$localize\`New\`` | Label string for the insert/create button rendered inside `react-analytical-table`. Localized. |
| `headerTitle` | `string` | `"Client Area"` (localized concatenation) | Title string rendered in the table header bar. |
| `saveMode` | `string` | `saveMode.POST` (`"POST"`) | Controls whether the form will submit a POST (create) or PUT (update) request. Toggled by `newClientArea()` and `editClientArea()`. Passed to `ClientAreaFormComponent` via `[saveMode]`. |
| `localization` | `typeof Localization` | `Localization` (the utility class itself) | Reference to the shared `Localization` utility object, used to access localized label constants (e.g. `localization.CreatedAt` resolves to the localized string `"Created On"`). |
| `permissions` | `typeof Permissions` | `Permissions` (the enum itself) | Reference to the `Permissions` enum, used in the template to pass permission keys to `rolePermissionService.hasPermission()`. |

---

## ViewChild / ViewChildren

| Ref name | Type | Template variable | Purpose |
|---|---|---|---|
| `clientAreaFormRef` | `ClientAreaFormComponent` | `#clientAreaForm` | Used in `newClientArea()` and `editClientArea()` to imperatively set `clientAreaFormRef.open = true`, which opens the form dialog. There is no `@ViewChildren`. |

---

## Lifecycle Hooks

This component does not implement `OnInit`, `OnDestroy`, `AfterViewInit`, or any other Angular lifecycle hook interfaces. There is no `ngOnInit`, `ngOnDestroy`, or `ngAfterViewInit` method declared. The class declaration (`export class AreaListComponent`) does not implement any lifecycle hook interface.

---

## Methods — DETAILED

### `constructor(public rolePermissionService: RolePermissionService)`
- **Signature:** `constructor(public rolePermissionService: RolePermissionService)`
- **Logic:** Standard Angular DI constructor. Injects `RolePermissionService` and exposes it as a public property so it can be accessed both in the class methods and directly in the template (the template calls `rolePermissionService.hasPermission(...)` directly).
- **Returns:** Nothing (constructor).

---

### `tableColum()`
- **Signature:** `tableColum(): any[]`
- **Logic (step by step):**
  1. Initializes a `columns` array with four fixed column definitions:
     - **Active** column (`accessor: "is_active"`, width 80): Renders a UI5 `<Icon name="accept" />` if the value is truthy, or `<Icon name="decline" />` if falsy. Grouping and filtering are disabled.
     - **ID** column (`accessor: "custom_id"`, width 100): Displays the custom string ID. `isSelected: true`. Grouping and filtering are disabled.
     - **Area Name** column (`accessor: "name"`): Displays the area name. `isSelected: true`. Auto-resizable.
     - **Created At** column (`accessor: "created_at"`): Header label comes from `this.localization.CreatedAt` (resolves to `"Created On"`). Cell renders `new Date(value).toLocaleDateString()` — formats the ISO date string to the locale's short date format. Filtering is disabled.
  2. Checks if the current user has either `BASE_DATA_CLIENT_AREA_EDIT` or `BASE_DATA_CLIENT_AREA_DELETE` permission via `rolePermissionService.hasPermission()`.
  3. If the check passes, pushes an **Actions** column (`accessor: "."`, `id: "actions"`, width 100). Sorting, filtering, and grouping are all disabled. The `Cell` renderer conditionally shows:
     - An edit `<Button icon="edit" design="Transparent">` if the user has `BASE_DATA_CLIENT_AREA_EDIT` permission. `onClick` calls `this.editClientArea(row.original)`.
     - A delete `<Button icon="delete" design="Transparent">` if the user has `BASE_DATA_CLIENT_AREA_DELETE` permission. `onClick` emits `this.IsDelete.emit(\`ClientAreas/${row.original.id}\`)`.
  4. Returns the assembled `columns` array.
- **Side effects:** None. Called on every render of the table (passed as `[tableColumn]="tableColum()"`).
- **Returns:** `any[]` — array of column definition objects for `react-analytical-table`.

---

### `newClientArea()`
- **Signature:** `newClientArea(): void`
- **Logic (step by step):**
  1. Resets `this.clientArea` to a fresh empty `ClientArea` instance via `new ClientArea().deserialize({})`. This clears any previously selected record from the form.
  2. Sets `this.clientAreaFormRef.open = true`, which imperatively opens the `ClientAreaFormComponent` dialog.
  3. Sets `this.saveMode` to `saveMode.POST` (`"POST"`), instructing the form to perform a create (POST) API call on submission.
- **Triggered by:** The `(isInsertDataChange)` output event of `react-analytical-table` (i.e. the user clicks the "New" insert button in the table toolbar).
- **Returns:** `void`.

---

### `editClientArea(data: any)`
- **Signature:** `editClientArea(data: any): void`
- **Logic (step by step):**
  1. Deserializes the raw row object `data` into a typed `ClientArea` instance via `new ClientArea().deserialize(data)`. This populates all fields from the row (id, name, custom_id, is_active, etc.).
  2. Sets `this.clientAreaFormRef.open = true`, opening the form dialog pre-populated with the selected record.
  3. Sets `this.saveMode` to `saveMode.PUT` (`"PUT"`), instructing the form to perform an update (PUT) API call on submission.
- **Triggered by:** Either the `(onEditSelectData)` output of `react-analytical-table` (row selection edit), or the edit `<Button>` inside the Actions column `Cell` renderer calling `this.editClientArea(row.original)` directly.
- **Returns:** `void`.

---

### `processData(event: any)`
- **Signature:** `processData(event: any): void`
- **Logic:** Re-emits the event received from `ClientAreaFormComponent`'s `(RefreshTable)` output through this component's own `IsSuccessChanges` EventEmitter. Acts as a pass-through relay so the parent component is notified of a successful form save.
- **Triggered by:** `(RefreshTable)="processData($event)"` binding on `<app-client-area-form>`.
- **Returns:** `void`.

---

## Template Bindings & Structure

The template (`area-list.component.html`) contains three top-level elements:

### 1. `<react-analytical-table>`
The primary table component. Key bindings:

| Binding | Value / Expression | Notes |
|---|---|---|
| `[headerTitle]` | `headerTitle` | Localized "Client Area" string |
| `[insertTitle]` | `insertTitle` | Localized "New" string |
| `[apiUrl]` | `'ClientAreas?$orderby=id desc'` | Static OData endpoint; data is fetched in descending ID order |
| `[alternateRowColors]` | `true` | Enables alternating row background colors |
| `[isInsertData]` | `rolePermissionService.hasPermission(permissions.BASE_DATA_CLIENT_AREA_CREATE)` | The "New" insert button is only rendered if the user has the `BASE_DATA_CLIENT_AREA_CREATE` permission |
| `[isSearchFilter]` | `true` | Enables the search/filter input field |
| `[isFilterable]` | `true` | Enables column-level filtering |
| `[isOdata]` | `true` | Tells the table to treat `apiUrl` as an OData v4 endpoint |
| `[model]` | `areaList` | The `ClientArea` class reference for row deserialization |
| `[isGroupable]` | `false` | Grouping is disabled |
| `[isSortable]` | `true` | Sorting is enabled |
| `[isTableTree]` | `false` | Not a tree table |
| `[isInfiniteScroll]` | `true` | Infinite scroll is enabled |
| `[infiniteScrollNumber]` | `10` | Loads 10 rows per scroll batch |
| `[minRowsNumber]` | `15` | Minimum rows displayed |
| `[headerHeight]` | `30` | Table header height in pixels |
| `[rowHeight]` | `30` | Row height in pixels |
| `[emptyDataText]` | `'No Data Found'` | Placeholder text when table has no data |
| `[tableColumn]` | `tableColum()` | Column definitions — method is called on each render |
| `[selectionMode]` | `'Single'` | Only one row can be selected at a time |
| `(onEditSelectData)` | `editClientArea($event)` | Fires when a row is selected for editing via the table's built-in selection mechanism |
| `(isInsertDataChange)` | `newClientArea()` | Fires when the "New" toolbar button is clicked |
| `[refreshTrigger]` | `IsSuccessChanges` | The `EventEmitter` itself is passed as a trigger; the table re-fetches data whenever this emitter fires |
| `[rowSelectionBehavior]` | `'RowOnly'` | Selection is triggered only by clicking the row, not a checkbox |

### 2. `<app-client-area-form #clientAreaForm>`
The create/edit dialog form. Key bindings:

| Binding | Direction | Value |
|---|---|---|
| `#clientAreaForm` | Template ref | Assigned to `clientAreaFormRef` via `@ViewChild` |
| `[saveMode]` | Input | `saveMode` state property (`"POST"` or `"PUT"`) |
| `[clientArea]` | Input | `clientArea` state property (empty or populated `ClientArea` instance) |
| `(RefreshTable)` | Output | Calls `processData($event)` on success |

### 3. `<app-delete-entity>`
The delete confirmation dialog. Key bindings:

| Binding | Direction | Value |
|---|---|---|
| `[IsDelete]` | Input | `IsDelete` EventEmitter (the entire emitter object is passed, not a single value) |
| `(isSuccess)` | Output | Calls `IsSuccessChanges.emit()` directly (no intermediary method) |

---

## API Calls

This component does not make direct HTTP calls. All data fetching is delegated to `react-analytical-table`, and all create/update/delete API calls are delegated to `ClientAreaFormComponent` and `app-delete-entity`.

| HTTP Method | Endpoint | When called | Payload / Query params | Response handling |
|---|---|---|---|---|
| GET (via table) | `ClientAreas?$orderby=id desc` | On initial load and whenever `IsSuccessChanges` emits (refreshTrigger) | OData pagination params appended by the table (e.g. `$top`, `$skip`) | Rows are deserialized using the `ClientArea` model class and rendered in the table |
| PUT (via form) | Handled by `ClientAreaFormComponent` | After `editClientArea()` opens the form and user submits | Serialized `ClientArea` object | On success, `RefreshTable` emits, which triggers `processData()` → `IsSuccessChanges.emit()` |
| POST (via form) | Handled by `ClientAreaFormComponent` | After `newClientArea()` opens the form and user submits | Serialized new `ClientArea` object | Same as PUT |
| DELETE (via delete entity) | `ClientAreas/{id}` | After user clicks delete button and confirms | Path built as `` `ClientAreas/${row.original.id}` `` | On success, `isSuccess` emits, triggering `IsSuccessChanges.emit()` |

---

## Validation Logic

This component contains no validation logic. Form validation is entirely handled inside `ClientAreaFormComponent`. This component only sets `saveMode` and passes a `ClientArea` model object to the form.

---

## Services Injected

| Service | Why injected | Methods used |
|---|---|---|
| `RolePermissionService` | To conditionally render UI elements and table columns based on the current user's permissions | `hasPermission(permission: string): boolean` — called multiple times: once in `tableColum()` to decide whether to add the Actions column, and once each for the individual edit/delete buttons inside the cell renderer; also called directly in the template for the `[isInsertData]` binding |

---

## Inter-component Communication

| Direction | Mechanism | Details |
|---|---|---|
| Child → Parent | `@Output() IsDelete: EventEmitter<string>` | Emitted in the Actions column delete button click. The emitted string is the OData resource path (`"ClientAreas/{id}"`). The template also passes this same emitter object as `[IsDelete]` to `app-delete-entity`. |
| Child → Parent | `@Output() IsSuccessChanges: EventEmitter<void>` | Emitted after any successful mutation (create, edit, or delete). The parent can subscribe to know when to refresh. This emitter is also used as `[refreshTrigger]` to drive the table's self-refresh. |
| This → `ClientAreaFormComponent` | `@ViewChild` + `@Input` bindings | `clientAreaFormRef.open = true` is set imperatively to open the dialog. `saveMode` and `clientArea` are passed as `@Input` bindings. |
| `ClientAreaFormComponent` → This | `(RefreshTable)` output | When the form saves successfully, `RefreshTable` emits; the template routes this to `processData($event)`. |
| This → `app-delete-entity` | `[IsDelete]` input (EventEmitter pass-through) | The entire `IsDelete` EventEmitter is passed to `app-delete-entity`, which subscribes internally to know when a delete is requested. |
| `app-delete-entity` → This | `(isSuccess)` output | On successful delete, `isSuccess` fires, and the template directly calls `IsSuccessChanges.emit()`. |

---

## Enums / Models Used

### `ClientArea` (model class)
File: `Frontend/src/app/shared/model/clientArea.ts`

| Property | Type | Default | Notes |
|---|---|---|---|
| `id` | `number` (optional) | `undefined` | Primary key, used to build delete URL |
| `is_active` | `boolean` (optional) | `true` | Rendered as accept/decline icon in the table |
| `name` | `string` | `''` | The area name, displayed in the Area Name column |
| `custom_id` | `string` (optional) | `undefined` | Custom string identifier displayed in the ID column |
| `created_at` | `string` (optional) | `undefined` | ISO date string; formatted via `toLocaleDateString()` in the cell |
| `updated_at` | `string` (optional) | `undefined` | Not displayed in the table |

Methods:
- `deserialize(input: any): this` — shallow-assigns all properties from `input` using `Object.assign`.
- `toOdata(): Object` — returns the object without `created_at` and `updated_at` (used for OData API payloads; not called directly by this component).

---

### `saveMode` (enum)
File: `Frontend/src/app/shared/enums/saveMode.ts`

| Key | Value | Usage in this component |
|---|---|---|
| `POST` | `"POST"` | Set in `newClientArea()` — create mode |
| `PUT` | `"PUT"` | Set in `editClientArea()` — update mode |
| `GET`, `PATCH`, `DELETE`, `REQUEST` | (other values) | Not used by this component |

---

### `Permissions` (enum)
File: `Frontend/src/app/shared/enums/permissions.ts` (relevant values)

| Key | Usage |
|---|---|
| `BASE_DATA_CLIENT_AREA_CREATE` | Controls visibility of the "New" insert button in the table toolbar |
| `BASE_DATA_CLIENT_AREA_EDIT` | Controls whether the Actions column is added; controls visibility of the edit button per row |
| `BASE_DATA_CLIENT_AREA_DELETE` | Controls whether the Actions column is added; controls visibility of the delete button per row |

---

### `Localization` (utility)
File: `Frontend/src/app/shared/utilities/localization.ts`

| Property used | Resolved value |
|---|---|
| `Localization.CreatedAt` | `$localize\`Created On\`` |

---

## Key Business Logic

1. **Actions column is permission-gated at the column level, not just the cell level.** The entire Actions column (including its header) is only added to the column definition array if the user holds at least one of `BASE_DATA_CLIENT_AREA_EDIT` or `BASE_DATA_CLIENT_AREA_DELETE`. This means a user with neither permission sees no Actions column at all rather than an empty column.

2. **Individual action buttons within the Actions column are independently gated.** A user with only `EDIT` permission sees only the edit button; a user with only `DELETE` sees only the delete button. Both can coexist.

3. **The `IsDelete` EventEmitter is used in two roles simultaneously.** It is both an `@Output()` for the parent component AND passed directly as `[IsDelete]` input to `app-delete-entity`. The string value emitted (`"ClientAreas/{id}"`) becomes the API endpoint path used by `app-delete-entity` to execute the HTTP DELETE call.

4. **The `IsSuccessChanges` EventEmitter drives table refresh.** By passing the emitter object itself as `[refreshTrigger]` to `react-analytical-table`, the table subscribes internally and re-fetches data whenever any mutation completes — without this component needing to manually trigger a reload.

5. **`tableColum()` is called directly in the template binding** (`[tableColumn]="tableColum()"`), meaning it is re-evaluated on every change detection cycle. It is a plain method, not memoized. Permission checks inside it are also re-evaluated each cycle.

6. **Edit can be triggered from two paths.** The `editClientArea()` method is called both from the `(onEditSelectData)` output of `react-analytical-table` (table row selection) and from the individual row-level edit `<Button>` in the Actions column cell renderer. Both paths are functionally identical.

7. **`saveMode` starts as `POST` and persists until explicitly changed.** If the component is initialized and `editClientArea()` is never called, subsequent opens of the form will always use POST mode unless `newClientArea()` resets it first (which it always does).

8. **Date formatting is locale-dependent.** The `created_at` column uses `new Date(value).toLocaleDateString()` with no explicit locale or options, so the display format follows the browser's locale setting.
