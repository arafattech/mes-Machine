# OPERATION_LIST_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| TS file | `src/app/modules/base-data-management/oparation-management/oparation-management-list/oparation-management-list.component.ts` |
| HTML file | `src/app/modules/base-data-management/oparation-management/oparation-management-list/oparation-management-list.component.html` |
| SCSS file | `src/app/modules/base-data-management/oparation-management/oparation-management-list/oparation-management-list.component.scss` |
| Selector | `app-oparation-management-list` |
| Component type | List |
| Grid | `app-ag-grid-table` (converted from `react-analytical-table` / `.tsx`) |
| Purpose | Renders a paginated, filterable, sortable ag-grid table of production Operations. Provides per-row actions (edit, delete, info) whose visibility is gated by role permissions. Owns the "New Operation" insert button and delegates form rendering to the child `OperationManagementFormComponent`. Delete confirmation is delegated to the shared `app-delete-entity` component. |

---

## Inputs (@Input)

This component declares no `@Input()` properties. All data is fetched internally by the `app-ag-grid-table` component via the `dataSource` OData config (`endpoint: 'Operations'`, `expand: 'products'`).

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `refreshTable` | `EventEmitter<void>` | Emitted after a successful form save (POST or PUT) via `processData()`, and directly emitted after a successful delete from the `app-delete-entity` child. Consumed by the parent to trigger a table reload. |
| `IsDelete` | `EventEmitter<any>` | Emitted with the OData resource path string (e.g. `"Operations/5"`) when the delete icon button of a row is clicked. Consumed by the `app-delete-entity` child component via `[IsDelete]` binding to open the delete-confirmation dialog. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `permissions` | `typeof Permissions` | `Permissions` | Permission enum ref used in HTML bindings |
| `gridId` | `string` | `'base-data-operation-list'` | ag-grid column state persistence key |
| `columns` | `AgGridTableColumn<any>[]` | from `buildColumns()` | Column definitions built once in constructor |
| `dataSource` | `AgGridTableODataSourceConfig<Operation>` | `{ type:'odata', endpoint:'Operations', expand:'products', ... }` | OData source config for ag-grid |
| `toolbarConfig` | `AgGridTableToolbarConfig` | see code | Toolbar config — title, search, row count, new button |
| `displayConfig` | `AgGridTableDisplayConfig` | `{ gridHeight: 'calc(100vh - 118px)' }` | Grid height config |

---

## ViewChild / ViewChildren

| Ref name | Type | Template variable | Purpose |
|---|---|---|---|
| `agGridRef` | `AgGridTableComponent<Operation>` | `#agGridRef` | Reference to the ag-grid table. Used in `processData()` to call `refreshGridData(true)` after CRUD. |
| `operationFormRef` | `OperationManagementFormComponent` | `#operationForm` | Direct reference to the `app-operation-management-form` child component. Used imperatively in `newOperation()` and `editOperation()` to set form state (`operations`, `open`, `saveMode`, `productTitle`) before opening the dialog. |

---

## Lifecycle Hooks

This component defines no Angular lifecycle hooks (`ngOnInit`, `ngOnDestroy`, `ngAfterViewInit`, etc.). All initialization is handled via class-level property initializers and the constructor.

**Constructor:**
- Injects `Router` (private) and `RolePermissionService` (public).
- No additional initialization logic.

---

## Methods — DETAILED

### `tableColum(): any[]`

**Signature:** `tableColum(): any[]`

**Step-by-step logic:**

1. Builds a base array of six column definition objects compatible with the `react-analytical-table` (SAP UI5 Web Components React) API.

   | # | Header | Accessor | Notes |
   |---|---|---|---|
   | 1 | `Active` | `is_active` | Custom `Cell` renderer: renders `<Icon name="accept" />` when value is truthy, `<Icon name="decline" />` when falsy. Width 80. Filters disabled. |
   | 2 | `ID` | `custom_id` | Width 100. Filters enabled, sort enabled, pre-selected (always visible). |
   | 3 | `Operations Name` | `operation_name` | Localizable. No custom renderer. |
   | 4 | `Cycle Time` | `standard_cycle_time` | `isSelected: false` — hidden from the column selector by default. |
   | 5 | `Item Name` | `products.product_name` | Nested accessor into the OData-expanded `products` relation. |
   | 6 | `Created On` | `created_at` | Header sourced from `Localization.CreatedAt`. Custom `Cell` renderer: formats ISO date string via `new Date(value).toLocaleDateString()`. Filters disabled. |

2. Conditionally pushes a seventh `Actions` column **only if** the current user holds at least one of:
   - `Permissions.BASE_DATA_OPERATION_EDIT`
   - `Permissions.BASE_DATA_OPERATION_DELETE`
   - `Permissions.BASE_DATA_OPERATION_INFO`

   The Actions column (`accessor: "."`, `id: "actions"`) renders a `<div>` containing up to three `<Button>` elements, each individually gated:

   | Button icon | Permission required | On click |
   |---|---|---|
   | `edit` | `BASE_DATA_OPERATION_EDIT` | calls `this.editOperation(row.original)` |
   | `delete` | `BASE_DATA_OPERATION_DELETE` | emits `IsDelete` with `"Operations/${row.original.id}"` |
   | `information` | `BASE_DATA_OPERATION_INFO` | calls `this.navigateToInfo(row.original)` |

   All three buttons use `design="Transparent"`. Sorting, grouping, and filtering are disabled for this column.

3. Returns the complete columns array.

**Returns:** `any[]` — array of column definition objects for the analytical table.

**Side effects:** Calls `rolePermissionService.hasPermission()` up to four times per call (once for the outer Actions guard, once per individual button). This method is called as a template binding expression `[tableColumn]="tableColum()"` on every change detection cycle, so permission checks run frequently.

---

### `processData(event: any): void`

**Signature:** `processData(event: any): void`

**Step-by-step logic:**

1. Receives `event` from the `(RefreshTable)` output of the `app-operation-management-form` child.
2. Re-emits the event via `this.refreshTable.emit(event)` to the parent component.

**Returns:** `void`

**Side effects:** Triggers a table refresh in the parent by emitting `refreshTable`.

---

### `navigateToInfo(data: any): void`

**Signature:** `navigateToInfo(data: any): void`

**Step-by-step logic:**

1. Extracts `data.id` from the passed row object.
2. Uses the injected `Router` to navigate to `/base-data/operation-info/${data.id}`.

**Returns:** `void`

**Side effects:** Triggers an Angular router navigation — leaves the current page and loads the Operation detail/info route.

---

### `newOperation(): void`

**Signature:** `newOperation(): void`

**Step-by-step logic:**

1. Calls `this.operationFormRef.operations.deserialize({})` — resets the form model to a clean empty `Operation` instance by deserializing an empty object.
2. Sets `this.operationFormRef.open = true` — opens the form dialog.
3. Sets `this.operationFormRef.saveMode = saveMode.POST` — puts the form into create mode.
4. Sets `this.operationFormRef.productTitle = ""` — clears any previously displayed product name in the product selector field.

**Returns:** `void`

**Side effects:** Directly mutates four properties on the `OperationManagementFormComponent` child reference. The child's dialog becomes visible.

---

### `editOperation(data: any): void`

**Signature:** `editOperation(data: any): void`

**Step-by-step logic:**

1. Calls `this.operationFormRef.operations.deserialize(data)` — populates the form model with the selected row's data via `Object.assign`.
2. Sets `this.operationFormRef.productTitle` to `data.products?.product_name` if it exists, otherwise to `""`. Uses optional chaining to safely handle rows where no product is linked.
3. Sets `this.operationFormRef.open = true` — opens the form dialog.
4. Sets `this.operationFormRef.saveMode = saveMode.PUT` — puts the form into edit/update mode.

**Trigger sources:** Called from two places:
  - The edit icon button within the `Actions` cell renderer.
  - The `(onEditSelectData)` output of `react-analytical-table` (double-click or row-level edit action).

**Returns:** `void`

**Side effects:** Directly mutates four properties on the `OperationManagementFormComponent` child reference. The child's dialog becomes visible pre-populated with the selected row's data.

---

### `CloseDialog(): void`

**Signature:** `CloseDialog(): void`

**Step-by-step logic:**

1. Sets `this.IsLoading = false`.

**Returns:** `void`

**Side effects:** Resets the loading flag. This method is not currently wired to any template event — it exists for external invocation or future use.

---

## Template Bindings & Structure

The HTML template (`oparation-management-list.component.html`) contains three top-level elements:

### 1. `<react-analytical-table>`

The main data table component (SAP UI5 Web Components React wrapper). Key bindings:

| Binding | Value | Notes |
|---|---|---|
| `[headerTitle]` | `headerTitle` | "Operations List" |
| `[insertTitle]` | `insertTitle` | "New" |
| `[apiUrl]` | `'Operations?$orderby=id desc&$expand=products'` | OData URL; orders by `id` descending; expands the `products` relation for the Item Name column |
| `[alternateRowColors]` | `true` | Zebra-striping on rows |
| `[isInsertData]` | `rolePermissionService.hasPermission(permissions.BASE_DATA_OPERATION_CREATE)` | Conditionally shows the insert/add button |
| `[isSearchFilter]` | `true` | Enables search input |
| `[isFilterable]` | `true` | Enables column-level filtering |
| `[isOdata]` | `true` | Signals the table uses OData protocol |
| `[model]` | `Oparations` | The `Operation` class reference |
| `[isGroupable]` | `false` | Grouping disabled |
| `[isSortable]` | `true` | Column sorting enabled |
| `[isTableTree]` | `false` | Tree table mode disabled |
| `[isInfiniteScroll]` | `true` | Infinite scroll pagination enabled |
| `[infiniteScrollNumber]` | `10` | Loads 10 records per scroll page |
| `[minRowsNumber]` | `15` | Minimum visible rows |
| `[headerHeight]` | `30` | Header height in pixels |
| `[rowHeight]` | `30` | Row height in pixels |
| `[emptyDataText]` | `'No Data Found'` | Placeholder text when table is empty |
| `[tableColumn]` | `tableColum()` | Column definitions (method call, re-evaluated on change detection) |
| `[refreshTrigger]` | `refreshTable` | `EventEmitter<void>` passed in; the table listens for emissions to reload data |
| `[selectionMode]` | `'Single'` | Only one row can be selected at a time |
| `[rowSelectionBehavior]` | `'RowOnly'` | Selection triggers only on row click, not cell click |
| `(onEditSelectData)` | `editOperation($event)` | Fires when the table's built-in edit-select action fires (e.g., row double-click); opens the edit form |
| `(isInsertDataChange)` | `newOperation()` | Fires when the insert button is clicked; opens the create form |

### 2. `<app-delete-entity>`

| Binding | Direction | Value | Notes |
|---|---|---|---|
| `[IsDelete]` | Input | `IsDelete` (`EventEmitter<any>`) | Passes the delete emitter to the delete-entity child; it subscribes and opens its confirmation dialog on emission |
| `(isSuccess)` | Output | `refreshTable.emit()` | When deletion succeeds, directly emits `refreshTable` to reload the table |

### 3. `<app-operation-management-form>`

| Binding | Direction | Value | Notes |
|---|---|---|---|
| `#operationForm` | Template ref | — | Assigns the component instance to `operationFormRef` via `@ViewChild` |
| `(RefreshTable)` | Output | `processData($event)` | When the form emits after a successful save, `processData` relays the event up via `refreshTable.emit()` |

---

## API Calls

This component does not make HTTP calls directly. All API interaction is delegated:

| HTTP Method | Endpoint | When called | Payload / Query params | What handles the response |
|---|---|---|---|---|
| GET (OData) | `Operations?$orderby=id desc&$expand=products` | On table initialization and on every `refreshTable` emission | None (pagination handled internally by `react-analytical-table` with `infiniteScrollNumber=10`) | `react-analytical-table` internally renders results |
| POST | `Operations` | When form is submitted in create mode | Operation fields (via `Operation.toOdata()`) | Handled inside `OperationManagementFormComponent`; on success emits `RefreshTable` |
| PUT | `Operations({id})` | When form is submitted in edit mode | Updated operation fields (via `Operation.toOdata()`) | Handled inside `OperationManagementFormComponent`; on success emits `RefreshTable` |
| DELETE | `Operations/{id}` | When delete icon is clicked and confirmed | Resource path passed via `IsDelete` emitter | Handled inside `app-delete-entity`; on success emits `isSuccess` |

---

## Validation Logic

This component performs no validation. All form validation is encapsulated inside `OperationManagementFormComponent`.

---

## Services Injected

| Service | Access modifier | Why injected | Methods used |
|---|---|---|---|
| `Router` | `private` | Navigate to the operation detail/info page | `router.navigate(['/base-data/operation-info/${id}'])` |
| `RolePermissionService` | `public` | Gate visibility of action buttons and the insert button based on user role permissions | `hasPermission(permission: string): boolean` |

`RolePermissionService` is declared `public` so it can be called directly from the HTML template for the `[isInsertData]` binding.

---

## Inter-component Communication

### To parent (via @Output)
- `refreshTable` — emitted after successful form save or after a successful delete to instruct the parent to refresh data.
- `IsDelete` — emitted with a resource path string when a delete action is initiated; consumed by the `app-delete-entity` sibling declared within this component's own template.

### To `OperationManagementFormComponent` child (imperative via @ViewChild)
- `newOperation()` writes directly to: `operationFormRef.operations` (reset), `operationFormRef.open` (true), `operationFormRef.saveMode` (POST), `operationFormRef.productTitle` ("").
- `editOperation()` writes directly to: `operationFormRef.operations` (populated), `operationFormRef.productTitle` (product name), `operationFormRef.open` (true), `operationFormRef.saveMode` (PUT).

### From `OperationManagementFormComponent` child (via template event binding)
- `(RefreshTable)` — received in `processData()`, which re-emits `refreshTable` upward.

### To `app-delete-entity` child (via template binding)
- `[IsDelete]="IsDelete"` — passes the `EventEmitter` reference directly; the delete entity child subscribes to it.

### From `app-delete-entity` child (via template event binding)
- `(isSuccess)="refreshTable.emit()"` — directly emits `refreshTable` on successful deletion, bypassing a method call.

### To `react-analytical-table`
- `[refreshTrigger]="refreshTable"` — the table holds a reference to the same emitter and reloads when it fires.
- `(onEditSelectData)="editOperation($event)"` — row-level edit action routes through `editOperation()`.
- `(isInsertDataChange)="newOperation()"` — insert button click routes through `newOperation()`.

---

## Enums / Models Used

### `Operation` (class — `@shared/model/operation.ts`)

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | `number \| undefined` | — | Primary key |
| `is_active` | `boolean \| undefined` | `true` | Active status flag |
| `custom_id` | `string \| undefined` | — | User-facing identifier |
| `operation_name` | `string` | `''` | Display name |
| `standard_cycle_time` | `number \| undefined` | — | Cycle time in seconds/minutes (unit not specified in model) |
| `item_id` | `number \| undefined` | — | FK to products/items table |
| `created_at` | `string \| undefined` | — | ISO date string |
| `updated_at` | `string \| undefined` | — | ISO date string |
| `products` | `Product[] \| undefined` | — | OData-expanded product relation |

Key methods:
- `deserialize(input: any): this` — shallow `Object.assign` from any input object; safe for `{}` (empty object).
- `toOdata(): Object` — returns a spread of the instance with `products`, `created_at`, and `updated_at` stripped (OData write payload).

### `saveMode` (enum — `@shared/enums/saveMode.ts`)

| Member | Value |
|---|---|
| `GET` | `'GET'` |
| `POST` | `'POST'` |
| `PUT` | `'PUT'` |
| `PATCH` | `'PATCH'` |
| `DELETE` | `'DELETE'` |
| `REQUEST` | `'REQUEST'` |

This component uses `saveMode.POST` and `saveMode.PUT` when configuring the form child.

### `Permissions` (enum — `@shared/enums/permissions.ts`)

Relevant members used in this component:

| Member | Value (string) | Used for |
|---|---|---|
| `BASE_DATA_OPERATION_CREATE` | `'BASE_DATA_OPERATION_CREATE'` | Show insert button |
| `BASE_DATA_OPERATION_EDIT` | `'BASE_DATA_OPERATION_EDIT'` | Show edit action button per row |
| `BASE_DATA_OPERATION_DELETE` | `'BASE_DATA_OPERATION_DELETE'` | Show delete action button per row |
| `BASE_DATA_OPERATION_INFO` | `'BASE_DATA_OPERATION_INFO'` | Show info navigation button per row |

### `Localization` (utility — `@shared/utilities/localization.ts`)

| Key used | Localized value |
|---|---|
| `CreatedAt` | `$localize\`Created On\`` |

---

## Key Business Logic

### Permission-gated Actions column
The entire "Actions" column is only added to the column definitions if the user has **at least one** of the three row-level permissions (`EDIT`, `DELETE`, or `INFO`). Within the column, each individual button is further checked against its specific permission. This means a user can see the column but only some of the buttons, depending on their role.

### OData expansion and nested accessor
The API URL includes `$expand=products`, which causes the backend to join and embed the related product record. The column definition uses the dot-notation accessor `"products.product_name"` to reach into this nested structure. When editing, `editOperation()` also uses optional chaining `data.products?.product_name` to handle the case where no product is linked (item_id is null/undefined).

### Imperative child form control pattern
Rather than using Input/Output to bind form state, this component directly mutates properties on the `OperationManagementFormComponent` instance via `@ViewChild`. This is an intentional imperative pattern: it avoids the need for the parent to manage form state locally, and instead treats the form component as a controlled child object.

### refreshTable as dual-purpose emitter
The `refreshTable` `EventEmitter` is both an `@Output` (consumed by the parent) and is passed as `[refreshTrigger]` to `react-analytical-table`. This means one emission both notifies the parent and causes the table to reload its data. The EventEmitter is never `complete()`-d, so subscriptions persist for the lifetime of the component.

### tableColum() called in template expression
The method `tableColum()` (note the intentional misspelling of "Column") is bound as a template expression `[tableColumn]="tableColum()"`. This means it is evaluated on every Angular change detection cycle. Since it also calls `rolePermissionService.hasPermission()` multiple times, the permission service must be efficient (synchronous/cached) to avoid performance degradation on frequent change detection.

### OData ordering and default sort
The API URL hardcodes `$orderby=id desc`, meaning operations are always presented newest-first by default. The `isSortable: true` table setting allows users to re-sort by other columns client-side (or server-side, depending on the table component's OData integration).

### CloseDialog() is disconnected
The `CloseDialog()` method sets `IsLoading = false` but is not wired to any template event or child component output. It is either intended for parent invocation, or is a leftover stub from a previous implementation pattern.
