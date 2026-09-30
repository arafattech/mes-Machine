# CAPACITY_LIST_COMPONENT — Component Context

## Overview

| Attribute      | Value                                                                                                                                      |
|----------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| TS file        | `src/app/modules/base-data-management/capacity-management/capacity-list/capacity-list.component.ts`                                        |
| HTML file      | `src/app/modules/base-data-management/capacity-management/capacity-list/capacity-list.component.html`                                      |
| Styles file    | `src/app/modules/base-data-management/capacity-management/capacity-list/capacity-list.component.scss`                                      |
| Selector       | `app-capacity-list`                                                                                                                        |
| Component type | List                                                                                                                                       |
| Purpose        | Displays an ag-grid-table of Capacity records (converted from react-analytical-table). Provides toolbar actions for creating, editing, and deleting capacities, gated by role permissions. Delegates form rendering to `app-capacity-form` and deletion to `app-delete-entity`. |

---

## Inputs (@Input)

This component declares **no `@Input()` properties**. All data is loaded internally via `app-ag-grid-table` using `url="Capacities"` (ag-grid appends OData ordering internally).

---

## Outputs (@Output)

| Output name    | Event type            | Purpose                                                                                                                                              |
|----------------|-----------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|
| `refreshTable` | `EventEmitter<void>`  | Emitted after a successful create/update operation (forwarded from `app-capacity-form`'s `RefreshTable` output). Causes the analytical table to reload its data. Also emitted directly when `app-delete-entity` reports a successful delete. |
| `IsDelete`     | `EventEmitter<string>`| Emitted when the user clicks the delete button on a row. The payload is the REST resource path string: `Capacities/{id}`. Consumed by the `app-delete-entity` child via its `[IsDelete]` input. |

---

## State Properties

| Property       | Type               | Default / Initial value                    | Purpose                                                                                                                |
|----------------|--------------------|--------------------------------------------|------------------------------------------------------------------------------------------------------------------------|
| `saveMode`     | `string`           | `saveMode.POST` (`'POST'`)                 | Tracks whether the capacity form should perform a create (`POST`) or update (`PUT`) operation. Passed as `[saveMode]` to `app-capacity-form`. |
| `Capacity`     | `Capacity`         | `new Capacity().deserialize({})` (blank)   | The data model instance passed to the capacity form. Replaced on every `newCapacity()` or `editCapacity()` call.      |
| `capacity`     | `typeof Capacity`  | `Capacity` (the class reference itself)    | Passed as `[model]` to the `react-analytical-table` so the table knows the shape of each row for OData deserialization. |
| `localization` | `typeof Localization` | `Localization` (static object reference) | Provides i18n strings to the template. Used in `tableColum()` to set the "Created On" column header via `this.localization.CreatedAt`. |
| `insertTitle`  | `string`           | `$localize\`New\``                          | Label for the table's insert/create button.                                                                            |
| `headerTitle`  | `string`           | `"Capacity List"` (i18n)                   | Title rendered in the `react-analytical-table` header toolbar.                                                         |
| `permissions`  | `typeof Permissions` | `Permissions` (enum reference)            | Exposes the `Permissions` enum to the template so bindings like `permissions.BASE_DATA_CAPACITY_CREATE` resolve correctly. |

---

## ViewChild / ViewChildren

| Ref variable      | Type                    | Usage                                                                                                                                  |
|-------------------|-------------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| `capacityFormRef` | `CapacityFormComponent` | Template reference `#capacityForm`. Used in `newCapacity()` and `editCapacity()` to imperatively set `capacityFormRef.open = true`, which opens the capacity form dialog/panel. |

---

## Lifecycle Hooks

This component defines **no lifecycle hook methods** (`ngOnInit`, `ngOnDestroy`, `ngAfterViewInit`, etc.). All initialization is declarative — column definitions are computed on-demand by `tableColum()` and state is initialized inline at property declaration.

---

## Methods — DETAILED

### `constructor(public rolePermissionService: RolePermissionService)`

- **Signature:** `constructor(public rolePermissionService: RolePermissionService)`
- **Logic:** Angular DI constructor. Injects `RolePermissionService` and makes it publicly accessible so it can also be used directly in template bindings (e.g., `[isInsertData]="rolePermissionService.hasPermission(...)"`).
- **Returns:** N/A

---

> **Migration note:** This component was converted from `.tsx` (react-analytical-table) to `.ts` (app-ag-grid-table). Column definitions are now `AgGridTableColumn[]` declared as a class property, not a JSX `tableColum()` method. The `react-analytical-table` component and all JSX imports (`React`, `Button`, `Icon`) have been removed.

### `columns: AgGridTableColumn<any>[]`

- **Signature:** `tableColum(): any[]`
- **Logic:**
  1. Builds a base `columns` array with four column definition objects:
     - **Active** (`is_active`): width 80, renders an `<Icon name="accept" />` for truthy values, `<Icon name="decline" />` for falsy. Grouping and filtering disabled.
     - **ID** (`custom_id`): width 100, plain text display. Grouping and filtering disabled. `isSelected: true`.
     - **Capacity Name** (`name`): auto-resizable, filterable (no `disableFilters`). `isSelected: true`.
     - **Created On** (`created_at`): header label sourced from `this.localization.CreatedAt` ("Created On"). Cell renders `new Date(value).toLocaleDateString()` — converts ISO string to locale date. Filtering disabled. `isSelected: true`.
  2. Conditionally pushes an **Actions** column if the current user holds either `BASE_DATA_CAPACITY_EDIT` or `BASE_DATA_CAPACITY_DELETE` permission:
     - `accessor: "."` with `id: "actions"`, width 100. Sorting, grouping, and filtering all disabled.
     - Cell renders a `<div>` containing:
       - An **Edit button** (`icon="edit"`, `design="Transparent"`) — shown only if user has `BASE_DATA_CAPACITY_EDIT`. On click calls `this.editCapacity(row.original)`.
       - A **Delete button** (`icon="delete"`, `design="Transparent"`) — shown only if user has `BASE_DATA_CAPACITY_DELETE`. On click emits `this.IsDelete.emit(\`Capacities/${row.original.id}\`)`.
  3. Returns the final columns array.
- **Note:** This method is called on every change detection cycle because it is bound directly as `[tableColumn]="tableColum()"` without memoization. The Actions column inclusion is evaluated per render.
- **Returns:** `any[]` — array of column definition objects compatible with the `react-analytical-table` component.

---

### `processData(event: any): void`

- **Signature:** `processData(event: any): void`
- **Logic:** Simple passthrough. Re-emits the incoming `event` via `this.refreshTable.emit(event)`. Called by the `(RefreshTable)` output of `app-capacity-form` after a successful save.
- **Side effects:** Triggers table data reload via the `refreshTable` emitter.
- **Returns:** `void`

---

### `newCapacity(): void`

- **Signature:** `newCapacity(): void`
- **Logic:**
  1. Resets `this.Capacity` to a blank `Capacity` instance: `new Capacity().deserialize({})`. This clears any previously loaded edit data.
  2. Sets `this.capacityFormRef.open = true` to imperatively open the capacity form dialog/panel.
  3. Sets `this.saveMode = saveMode.POST` so the form knows to issue a POST (create) request.
- **Side effects:** Opens the capacity form in "new/create" mode.
- **Returns:** `void`

---

### `editCapacity(data: any): void`

- **Signature:** `editCapacity(data: any): void`
- **Logic:**
  1. Deserializes the row's data object into a `Capacity` model instance: `new Capacity().deserialize(data)`. This populates `id`, `name`, `is_active`, `custom_id`, `created_at`, `updated_at` from the row data.
  2. Sets `this.capacityFormRef.open = true` to imperatively open the capacity form.
  3. Sets `this.saveMode = saveMode.PUT` so the form issues a PUT (update) request.
- **Called from:** The edit button cell renderer in `tableColum()`, and also from the `(onEditSelectData)` table output (row double-click or equivalent selection event).
- **Side effects:** Opens the capacity form pre-populated with existing row data in "edit" mode.
- **Returns:** `void`

---

## Template Bindings & Structure

The template (`capacity-list.component.html`) contains three top-level elements:

### 1. `<react-analytical-table>`

A wrapper component that renders a SAP UI5-based React analytical table inside Angular.

| Binding                | Type / Value                                              | Purpose                                                                                    |
|------------------------|-----------------------------------------------------------|--------------------------------------------------------------------------------------------|
| `[headerTitle]`        | `headerTitle` — `"Capacity List"`                         | Table header toolbar title                                                                 |
| `[insertTitle]`        | `insertTitle` — `"New"`                                   | Label on the create/insert button                                                          |
| `[apiUrl]`             | `'Capacities?$orderby=id desc'` (literal string)          | OData endpoint; rows ordered by ID descending                                              |
| `[alternateRowColors]` | `true`                                                    | Enables zebra-stripe row coloring                                                          |
| `[isInsertData]`       | `rolePermissionService.hasPermission(permissions.BASE_DATA_CAPACITY_CREATE)` | Shows/hides the create button based on permission          |
| `[isSearchFilter]`     | `true`                                                    | Enables search/filter input in the toolbar                                                 |
| `[isFilterable]`       | `true`                                                    | Enables column-level filter UI                                                             |
| `[isOdata]`            | `true`                                                    | Signals that `apiUrl` is an OData endpoint; enables server-side paging/filtering           |
| `[model]`              | `capacity` (the `Capacity` class reference)               | Provides shape metadata for OData deserialization                                          |
| `[isGroupable]`        | `false`                                                   | Grouping disabled                                                                          |
| `[isSortable]`         | `true`                                                    | Column sorting enabled                                                                     |
| `[isTableTree]`        | `false`                                                   | Tree/hierarchy mode disabled                                                               |
| `[isInfiniteScroll]`   | `true`                                                    | Enables infinite scroll pagination                                                         |
| `[infiniteScrollNumber]` | `10`                                                    | Number of rows loaded per scroll batch                                                     |
| `[minRowsNumber]`      | `15`                                                      | Minimum number of rows rendered (empty placeholders)                                       |
| `[headerHeight]`       | `30`                                                      | Header row height in pixels                                                                |
| `[rowHeight]`          | `30`                                                      | Data row height in pixels                                                                  |
| `[emptyDataText]`      | `'No Data Found'`                                         | Placeholder text when no records exist                                                     |
| `[tableColumn]`        | `tableColum()` (method call)                              | Column definitions array, evaluated on each change detection cycle                        |
| `[selectionMode]`      | `'Single'`                                                | Row selection mode — only one row can be selected at a time                                |
| `[refreshTrigger]`     | `refreshTable` (the `EventEmitter<void>` instance)        | When this emitter fires, the table reloads its data from the API                           |
| `(isInsertDataChange)` | `newCapacity()`                                           | Event fired when the user clicks the create/insert button                                  |
| `(onEditSelectData)`   | `editCapacity($event)`                                    | Event fired when a row is selected for editing (row click or edit action); `$event` carries row data |

### 2. `<app-capacity-form #capacityForm>`

The form dialog/panel for creating and editing capacity records.

| Binding         | Value / Source                 | Purpose                                                          |
|-----------------|--------------------------------|------------------------------------------------------------------|
| `#capacityForm` | Template reference variable    | Allows `@ViewChild('capacityForm')` to imperatively call `.open` |
| `[saveMode]`    | `saveMode` (component property) | Tells the form whether to POST or PUT                           |
| `[capacity]`    | `Capacity` (component property) | The blank or populated `Capacity` model to bind to form fields  |
| `(RefreshTable)` | `processData($event)`         | Forwarded to `refreshTable` emitter to trigger table reload      |

### 3. `<app-delete-entity>`

A shared component that handles the delete confirmation flow.

| Binding      | Value / Source            | Purpose                                                                            |
|--------------|---------------------------|------------------------------------------------------------------------------------|
| `[IsDelete]` | `IsDelete` (the `EventEmitter<string>` instance) | Receives the resource path string (`Capacities/{id}`) to delete |
| `(isSuccess)` | `refreshTable.emit()`    | When deletion succeeds, triggers a table reload by emitting on `refreshTable`      |

---

## API Calls

This component itself makes **no direct HTTP calls**. All API interaction is delegated:

| HTTP Method | Endpoint                            | Triggered by                           | Payload / Query params                  | What happens with response                          |
|-------------|-------------------------------------|----------------------------------------|-----------------------------------------|-----------------------------------------------------|
| GET         | `Capacities?$orderby=id desc`       | Table initial load and `refreshTable` emit | OData pagination/filter/sort params appended by `react-analytical-table` | Rows rendered in table; infinite scroll loads next batch |
| POST        | (handled by `app-capacity-form`)    | `newCapacity()` → form submit          | Capacity fields (name, is_active, etc.) | On success: form emits `RefreshTable`, component calls `processData()` → `refreshTable.emit()` |
| PUT         | (handled by `app-capacity-form`)    | `editCapacity()` → form submit         | Updated Capacity fields                 | Same as POST success flow                           |
| DELETE      | `Capacities/{id}`                   | Delete button click → `IsDelete.emit()` → `app-delete-entity` | Resource path string | On success: `app-delete-entity` emits `isSuccess`, `refreshTable.emit()` called |

---

## Validation Logic

This component contains **no validation logic**. All field-level validation for the capacity name, active flag, etc. is handled inside `app-capacity-form`. This component is purely a list/orchestration layer.

---

## Services Injected

| Service                  | Visibility | Why injected                                                                                       | Methods used                                          |
|--------------------------|------------|----------------------------------------------------------------------------------------------------|-------------------------------------------------------|
| `RolePermissionService`  | `public`   | Evaluates user role permissions to conditionally show/hide the create button, edit button, and delete button. Public visibility is required because the template references it directly in bindings. | `hasPermission(permission: Permissions): boolean` — called with `BASE_DATA_CAPACITY_CREATE`, `BASE_DATA_CAPACITY_EDIT`, `BASE_DATA_CAPACITY_DELETE` |

---

## Inter-component Communication

| Direction              | Mechanism                                                             | Details                                                                                                                       |
|------------------------|-----------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| Parent → this          | None                                                                  | No `@Input()` properties; component is self-contained                                                                         |
| This → `react-analytical-table` | Property bindings + `refreshTrigger` EventEmitter input    | Passes column definitions, API URL, display config, and the `refreshTable` emitter to drive data loading                     |
| `react-analytical-table` → This | `(isInsertDataChange)` and `(onEditSelectData)` outputs    | Table fires events when user clicks create or selects a row for editing                                                       |
| This → `app-capacity-form` | Property bindings (`[saveMode]`, `[capacity]`) + imperative `open = true` | Passes mode and data model; opens form imperatively via `@ViewChild`                                                     |
| `app-capacity-form` → This | `(RefreshTable)` output                                       | Notifies list to refresh after save; received by `processData()`                                                              |
| This → `app-delete-entity` | `[IsDelete]` binding passing the `EventEmitter<string>` itself | Passes the emitter reference so `app-delete-entity` subscribes internally; when delete button is clicked, `IsDelete.emit(path)` is called |
| `app-delete-entity` → This | `(isSuccess)` output                                          | Triggers `refreshTable.emit()` after successful deletion                                                                      |
| This → Parent          | `@Output() refreshTable` and `@Output() IsDelete`             | Parent can listen for table refresh events or deletion requests if this component is embedded within a parent                 |

---

## Enums / Models Used

### `Capacity` (model class)
**File:** `src/app/shared/model/capacity.ts`

| Property     | Type      | Default    | Notes                                             |
|--------------|-----------|------------|---------------------------------------------------|
| `id`         | `number`  | undefined  | Database primary key                              |
| `name`       | `string`  | `''`       | Display name of the capacity                      |
| `is_active`  | `boolean` | `true`     | Active/inactive status; displayed as icon in list |
| `custom_id`  | `string`  | undefined  | Business-facing identifier (shown in ID column)   |
| `created_at` | `string`  | undefined  | ISO date string; formatted with `toLocaleDateString()` in the table cell |
| `updated_at` | `string`  | undefined  | Not displayed in the list; excluded in `toOdata()` |

Implements `Deserializable` interface — `deserialize(input: any): this` uses `Object.assign` to hydrate from a plain object. `toOdata()` strips `created_at` and `updated_at` before sending to the server.

### `saveMode` (enum)
**File:** `src/app/shared/enums/saveMode.ts`

| Value      | String    | Used in this component          |
|------------|-----------|---------------------------------|
| `POST`     | `'POST'`  | Default; set by `newCapacity()` |
| `PUT`      | `'PUT'`   | Set by `editCapacity()`         |
| `GET`, `PATCH`, `DELETE`, `REQUEST` | — | Defined but not used here |

### `Permissions` (enum)
**File:** `src/app/shared/enums/permissions.ts`

Relevant values for this component:

| Enum value                      | String literal                    | Controls                                              |
|---------------------------------|-----------------------------------|-------------------------------------------------------|
| `BASE_DATA_CAPACITY`            | `'BASE_DATA_CAPACITY'`            | Not directly used in this component                   |
| `BASE_DATA_CAPACITY_LIST`       | `'BASE_DATA_CAPACITY_LIST'`       | Not directly used in this component                   |
| `BASE_DATA_CAPACITY_CREATE`     | `'BASE_DATA_CAPACITY_CREATE'`     | Shows/hides the create button on the table toolbar    |
| `BASE_DATA_CAPACITY_EDIT`       | `'BASE_DATA_CAPACITY_EDIT'`       | Shows/hides the edit icon button in the Actions column |
| `BASE_DATA_CAPACITY_DELETE`     | `'BASE_DATA_CAPACITY_DELETE'`     | Shows/hides the delete icon button in the Actions column; also controls whether the Actions column is added at all |

### `Localization` (utility object)
**File:** `src/app/shared/utilities/localization.ts`

A static object of i18n string keys. Used in this component:

| Key         | Default English value | Used for                                      |
|-------------|----------------------|-----------------------------------------------|
| `CreatedAt` | `"Created On"`       | Header label for the `created_at` table column |

### `Deserializable` (interface)
**File:** `src/app/shared/interfaces/deserializable.ts` (referenced via `Capacity` model)

Standard interface requiring a `deserialize(input: any): this` method.

---

## Key Business Logic

### Permission-gated Actions column
The Actions column is only added to the column definitions if the user has at least one of `BASE_DATA_CAPACITY_EDIT` or `BASE_DATA_CAPACITY_DELETE`. Within the column's cell renderer, each button is individually re-checked against its respective permission. This means a user with only edit permission sees only the edit button, and a user with only delete permission sees only the delete button.

### Dual entry points for editCapacity
`editCapacity(data)` is called from two places:
1. The edit icon button inside the Actions column cell renderer (explicit click on the edit icon).
2. The `(onEditSelectData)` output event of `react-analytical-table` (likely triggered by row selection or double-click).
Both paths pass the full `row.original` data object, which is then deserialized into a fresh `Capacity` instance.

### Imperative form opening via ViewChild
Rather than using a reactive flag bound to a form's `[open]` input, this component imperatively sets `this.capacityFormRef.open = true` directly on the child component instance. This is a direct mutation pattern — the form's `open` property controls its own visibility state.

### refreshTable as a dual-purpose emitter
The `refreshTable` EventEmitter serves two roles simultaneously:
1. As an `@Output()` — a parent component could listen to it for its own refresh logic.
2. As a direct input to `react-analytical-table` via `[refreshTrigger]="refreshTable"` — the table holds a reference to the emitter and subscribes internally, reloading data whenever the emitter fires.

### OData infinite scroll
The table uses OData server-side pagination with `isInfiniteScroll: true` and `infiniteScrollNumber: 10`, loading 10 rows per batch. The default sort order is `id desc` (newest records first). A minimum of 15 rows (`minRowsNumber`) are displayed, with empty placeholders if fewer records exist.

### Date formatting
The `created_at` column cell renderer calls `new Date(value).toLocaleDateString()`, converting the raw ISO 8601 timestamp from the API into a locale-specific date string (no time portion). This formatting is applied at render time, not stored.
