# OPERATION_INFO_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| TypeScript file | `Frontend/src/app/modules/base-data-management/oparation-management/operation-management-info/operation-management-info.component.ts` |
| HTML template file | `Frontend/src/app/modules/base-data-management/oparation-management/operation-management-info/operation-management-info.component.html` |
| Selector | `app-operation-management-info` |
| Component type | Detail / Info Page (Master-Detail layout) |
| Grid | `app-ag-grid-table` (converted from `react-analytical-table` / `.tsx`) |
| Purpose | Displays the detail view for a single Operation record. Shows operation header information (Custom ID, Name, Standard Cycle Time) inside a `ui5-dynamic-page` and a filterable, paginated ag-grid table of all `OperationPosition` records belonging to that operation. Provides inline Create, Edit, and Delete actions on positions, guarded by role-based permissions. |

---

## Inputs (@Input)

This component declares **no `@Input()` properties**. All data is sourced from the Angular router (`ActivatedRoute`) and internal API calls.

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `refreshTable` | `EventEmitter<void>` | Emitted after a successful create or edit of an `OperationPosition`. The parent component listens to this to refresh its own list/table. |
| `IsDelete` | `EventEmitter<string>` | Emitted when the user clicks the Delete button on a row. The emitted value is the OData delete URL string in the form `OperationPositions/${row.original.id}`. The parent (or sibling `app-delete-entity`) consumes this to execute the actual HTTP DELETE. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `IsLoading` | `boolean` | `false` | Controls a loading indicator while the operation header data is being fetched from the API. |
| `operationId` | `number \| undefined` | `undefined` | Numeric ID from route param `id`. Set in `ngOnInit`. Used to build `dataSource.filter` and passed to child form. |
| `oparations` | `Operation` | `new Operation()` | Instance holding the fetched operation header data. Bound to `ui5-dynamic-page-header` labels. |
| `customId` | `string` | `$localize\`Custom ID\`` | Label for Custom ID field in the page header. |
| `operationName` | `string` | `$localize\`Operation Name\`` | Label for Operation Name field in the page header. |
| `operationCycle` | `string` | `$localize\`Operation Cycle\`` | Label for Standard Cycle Time field in the page header. |
| `saveMode` | `string` | `saveMode.POST` | Current save mode. Passed as `[saveMode]` to child form. |
| `permissions` | `typeof Permissions` | `Permissions` | Permission enum ref. |
| `gridId` | `string` | `'base-data-operation-info-list'` | ag-grid column state persistence key. |
| `columns` | `AgGridTableColumn<any>[]` | from `buildColumns()` | Column definitions built in `ngOnInit`. |
| `dataSource` | `AgGridTableODataSourceConfig<OperationPosition>` | built in `ngOnInit` | OData config — `endpoint: 'OperationPositions'`, `expand: 'machines,products'`, `filter: 'operation_id eq {operationId}'`. |
| `toolbarConfig` | `AgGridTableToolbarConfig` | see code | Toolbar: title "Operations Positions", search, row count, new button (gated by `BASE_DATA_OPERATION_INFO_CREATE`). |
| `displayConfig` | `AgGridTableDisplayConfig` | `{ gridHeight: 'calc(100vh - 230px)' }` | Grid height — shorter than full-page lists to accommodate the dynamic page header. |

---

## ViewChild / ViewChildren

| Ref name | Type | Purpose |
|---|---|---|
| `agGridRef` (`#agGridRef`) | `AgGridTableComponent<OperationPosition>` | Reference to the ag-grid table. Used in `processData()` to call `refreshGridData(true)` after CRUD. |
| `operationInfoFormRef` (`#operationInfoForm`) | `OperationManagementInfoFormComponent` | Reference to the child `app-operation-management-info-form` component. Accessed directly in `newInfoOperation()` and `editInfoOperation()` to imperatively set form state (reset fields, pre-fill data, open dialog, set save mode). |

---

## Lifecycle Hooks

### `ngOnInit(): void`
1. Reads the `id` route parameter from `ActivatedRoute.snapshot.paramMap` and coerces it to a `number`, assigning it to `this.operationId`.
2. Immediately calls `this.getOparationInfo()` to fetch the operation header details.

No `ngOnDestroy`, `ngAfterViewInit`, or other lifecycle hooks are implemented.

---

## Methods — DETAILED

### `getOparationInfo(): void`
- **Purpose:** Fetches the full `Operation` record for the current `operationId` from the API and populates the header display.
- **Step-by-step:**
  1. Sets `this.IsLoading = true`.
  2. Calls `this.commonService.get('Operations/${this.operationId}', true)` — the second argument (`true`) indicates OData mode.
  3. On success (`next`): assigns the response object to `this.oparations` and sets `this.IsLoading = false`.
  4. No `error` handler is defined; errors are silently swallowed.
- **Returns:** void. Side effect: populates `this.oparations` which drives the page header labels in the template.

---

### `tableColum(): any[]`
- **Purpose:** Builds and returns the column definition array for the `react-analytical-table`.
- **Step-by-step:**
  1. Constructs a base array of 6 column definitions:
     - **Active** (`is_active`): renders a UI5 `<Icon name="accept" />` if `true`, or `<Icon name="decline" />` if `false`. Width 80, center-aligned, filters and groupBy disabled.
     - **ID** (`custom_id`): plain text, width 100, center-aligned, filters and groupBy disabled.
     - **Name** (`name`): plain text, auto-resizable, `isSelected: true`.
     - **Item Name** (`products.product_name`): nested accessor for the expanded `products` relation.
     - **Machine Name** (`machines.machine_name`): nested accessor for the expanded `machines` relation.
     - **Created At** (`created_at`): renders `new Date(value).toLocaleDateString()`. Uses `Localization.CreatedAt` for the header label.
  2. Checks `rolePermissionService.hasPermission(Permissions.BASE_DATA_OPERATION_INFO_EDIT) || rolePermissionService.hasPermission(Permissions.BASE_DATA_OPERATION_INFO_DELETE)`. If either is true, pushes an **Actions** column:
     - The cell renders a `<div>` containing:
       - An edit `<Button icon="edit" design="Transparent">` — only if the user has `BASE_DATA_OPERATION_INFO_EDIT`. On click calls `this.editInfoOperation(row.original)`.
       - A delete `<Button icon="delete" design="Transparent">` — only if the user has `BASE_DATA_OPERATION_INFO_DELETE`. On click emits `this.IsDelete.emit('OperationPositions/${row.original.id}')`.
     - The Actions column has `disableFilters`, `disableGroupBy`, `disableSortBy` set to true.
  3. Returns the complete columns array.
- **Called by:** The template as `[tableColumn]="tableColum()"` — evaluated on each change detection cycle.
- **Note:** This method uses JSX (`React` + `@ui5/webcomponents-react` `Button` and `Icon`), making the file a `.tsx` file.

---

### `newInfoOperation(): void`
- **Purpose:** Resets and opens the child form dialog in "create" mode.
- **Step-by-step:**
  1. Calls `this.operationInfoFormRef.operationPosition.deserialize({})` — resets the form's position model to a blank state.
  2. Sets `this.operationInfoFormRef.operationPosition.operation_id = this.operationId` — pre-links the new position to the current operation.
  3. Sets `this.operationInfoFormRef.open = true` — opens the dialog.
  4. Sets `this.operationInfoFormRef.saveMode = saveMode.POST` — tells the form to use HTTP POST.
  5. Sets `this.operationInfoFormRef.productTitle = ""` — clears the product selection display label.
- **Triggered by:** The `(isInsertDataChange)` event on the `react-analytical-table`, i.e., when the user clicks the "New" insert button.

---

### `editInfoOperation(data: any): void`
- **Purpose:** Pre-populates and opens the child form dialog in "edit" mode for an existing `OperationPosition`.
- **Step-by-step:**
  1. Deserializes `data` into a new `OperationPosition` instance: `const op = new OperationPosition().deserialize(data)`.
  2. Assigns the deserialized object to `this.operationInfoFormRef.operationPosition`.
  3. Overwrites `operationPosition.operation_id` with `this.operationId` to ensure the correct parent operation is maintained.
  4. Finds the matching product in the form's pre-loaded `products` array by `id === op.product_id`.
  5. Sets `this.operationInfoFormRef.selectedProductId = op.product_id ?? null`.
  6. Sets `this.operationInfoFormRef.productTitle` to the found product's `product_name`, or `""` if not found.
  7. Finds the matching machine in the form's pre-loaded `machines` array by `id === op.machine_id`.
  8. Sets `this.operationInfoFormRef.selectedMachineId = op.machine_id ?? null`.
  9. Sets `this.operationInfoFormRef.machineTitle` to the found machine's `machine_name`, or `""` if not found.
  10. Sets `this.operationInfoFormRef.open = true` — opens the dialog.
  11. Sets `this.operationInfoFormRef.saveMode = saveMode.PUT` — tells the form to use HTTP PUT.
- **Triggered by:** Both the `(onEditSelectData)` event on `react-analytical-table` and the edit button's `onClick` inside the Actions column cell.

---

### `processData(event: any): void`
- **Purpose:** Reacts to a successful save or delete and propagates a table refresh upward.
- **Step-by-step:**
  1. Calls `this.refreshTable.emit()` — notifies the parent and triggers the `[refreshTrigger]` on the analytical table to reload data.
  2. Calls `this.cdrf.detectChanges()` — manually triggers Angular change detection to ensure the UI reflects the new state.
- **Triggered by:**
  - `(RefreshTable)` output from `app-operation-management-info-form` (after a successful POST or PUT).
  - `(isSuccess)` output from `app-delete-entity` (after a successful DELETE).

---

### `CloseDialog(): void`
- **Purpose:** Closes any open dialog and resets loading state.
- **Step-by-step:**
  1. Sets `this.isOpen = false`.
  2. Sets `this.IsLoading = false`.
- **Note:** This method manipulates `this.isOpen`, which is not currently bound to any template element in the component's own template. The child form manages its own `open` state. This method appears unused in the current implementation flow.

---

## Template Bindings & Structure

The template is structured as a `<ui5-dynamic-page>` with three logical zones plus two auxiliary child components:

### 1. Dynamic Page Title (`<ui5-dynamic-page-title slot="titleArea">`)
- Static heading: "Operation Details" (i18n-tagged).
- An empty `<ui5-toolbar>` in the `actionsBar` slot — present but no action buttons.

### 2. Dynamic Page Header (`<ui5-dynamic-page-header slot="headerArea">`)
Three `<ui5-label>` elements display the current operation's header data from `this.oparations`:
- **Custom ID:** `{{ this.customId }}: {{ oparations.custom_id }}`
- **Operation Name:** `{{ this.operationName }}: {{ oparations.operation_name }}`
- **Operation Cycle:** `{{ this.operationCycle }}: {{ oparations.standard_cycle_time }}`

### 3. Analytical Table (`<react-analytical-table #operationTable>`)
Key bindings:
| Binding | Value | Notes |
|---|---|---|
| `[headerTitle]` | `headerTitle` ("Operations Positions") | Table heading |
| `[insertTitle]` | `insertTitle` ("New") | Add button label |
| `[apiUrl]` | `'OperationPositions?$orderby=id desc&$expand=machines,products'` | OData endpoint; expands related machines and products |
| `[filterQuery]` | `'operation_id eq ' + operationId` | OData filter scopes positions to the current operation |
| `[alternateRowColors]` | `true` | Zebra striping |
| `[isInsertData]` | `rolePermissionService.hasPermission(permissions.BASE_DATA_OPERATION_INFO_CREATE)` | Shows/hides insert button based on permission |
| `[isSearchFilter]` | `true` | Enables search box |
| `[isFilterable]` | `true` | Enables column filters |
| `[isOdata]` | `true` | Signals OData API mode |
| `[model]` | `Oparations` (Operation class) | Model class reference |
| `[isGroupable]` | `false` | Grouping disabled |
| `[isSortable]` | `true` | Sorting enabled |
| `[isTableTree]` | `false` | Flat table |
| `[isInfiniteScroll]` | `true` | Infinite scroll enabled |
| `[infiniteScrollNumber]` | `10` | Page size for infinite scroll |
| `[minRowsNumber]` | `15` | Minimum rows rendered |
| `[headerHeight]` | `30` | Header row height (px) |
| `[rowHeight]` | `30` | Data row height (px) |
| `[selectionMode]` | `'Single'` (last binding wins; `'None'` is overridden) | Row selection mode |
| `[rowSelectionBehavior]` | `'RowOnly'` | Click the row, not a checkbox |
| `[emptyDataText]` | `'No Data Found'` | Empty state message |
| `[tableColumn]` | `tableColum()` | Column definitions |
| `[refreshTrigger]` | `refreshTable` | EventEmitter wired to table reload |
| `(onEditSelectData)` | `editInfoOperation($event)` | Row selection triggers edit form |
| `(isInsertDataChange)` | `newInfoOperation()` | Insert button click triggers new form |

**Note:** `[selectionMode]` is bound twice (`'None'` then `'Single'`). The last binding (`'Single'`) takes effect.

### 4. Delete Entity (`<app-delete-entity>`)
- `[IsDelete]="IsDelete"` — passes the `IsDelete` EventEmitter directly into the delete entity component, which monitors it for deletion URL strings.
- `(isSuccess)="processData($event)"` — on successful deletion, calls `processData()` to refresh the table.

### 5. Operation Info Form (`<app-operation-management-info-form #operationInfoForm>`)
- `[saveMode]="saveMode"` — current save mode state (overridden imperatively via `operationInfoFormRef`).
- `[operationId]="operationId"` — passes the current operation ID.
- `[operations]="oparations"` — passes the loaded operation header object.
- `(RefreshTable)="processData($event)"` — on successful save, calls `processData()`.

---

## API Calls

| HTTP Method | Endpoint | When Called | Payload / Query Params | Response Handling |
|---|---|---|---|---|
| GET | `Operations/{operationId}` | `ngOnInit` via `getOparationInfo()` | Path param: `operationId` from route | Response assigned to `this.oparations`; `IsLoading` set to `false` |
| GET (via table) | `OperationPositions?$orderby=id desc&$expand=machines,products&$filter=operation_id eq {operationId}` | On table load, scroll, search, filter, or refresh trigger | OData query params including `filterQuery` | Handled internally by `AnalyticalTableComponent`; rows rendered in table |

---

## Validation Logic

This component itself does **no form validation**. All validation is delegated to the child `OperationManagementInfoFormComponent`. See that component's documentation for details. The parent component only imperatively sets field values and opens/closes the child form.

---

## Services Injected

| Service | Why Injected | Methods Used |
|---|---|---|
| `ActivatedRoute` | Read the `id` route parameter on init | `snapshot.paramMap.get('id')` |
| `RolePermissionService` | Guard UI actions and table columns behind permission checks | `hasPermission(permission: Permissions): boolean` |
| `CommonService` | Make HTTP GET call for operation header data | `get(url: string, isOdata: boolean): Observable<any>` |
| `ChangeDetectorRef` | Manually trigger change detection after async operations | `detectChanges()` |

---

## Inter-component Communication

| Direction | Mechanism | Details |
|---|---|---|
| Parent -> This | Router parameter | `id` param from `ActivatedRoute` determines which operation to load |
| This -> Child (`AnalyticalTableComponent`) | Input bindings + EventEmitter | `[refreshTrigger]="refreshTable"` causes the table to reload when `refreshTable.emit()` is called |
| This -> Child (`OperationManagementInfoFormComponent`) | `@ViewChild` + direct property mutation | `operationInfoFormRef` is accessed directly to set `operationPosition`, `open`, `saveMode`, `productTitle`, `machineTitle`, `selectedProductId`, `selectedMachineId` |
| Child (`OperationManagementInfoFormComponent`) -> This | `@Output` EventEmitter | `(RefreshTable)` emits after save; this calls `processData()` |
| This -> Parent | `@Output` EventEmitter | `refreshTable.emit()` lets parent know a position was saved/deleted |
| This -> Child (`app-delete-entity`) | `@Output` EventEmitter passed as `@Input` | `[IsDelete]="IsDelete"` passes this component's own `IsDelete` emitter directly; the delete entity component subscribes to it for the URL |
| Child (`app-delete-entity`) -> This | `@Output` EventEmitter | `(isSuccess)` emits after successful DELETE; this calls `processData()` |

---

## Enums / Models Used

### `saveMode` (enum)
| Value | String |
|---|---|
| `GET` | `'GET'` |
| `POST` | `'POST'` |
| `PUT` | `'PUT'` |
| `PATCH` | `'PATCH'` |
| `DELETE` | `'DELETE'` |
| `REQUEST` | `'REQUEST'` |

Used to set `this.saveMode` before opening the form (`POST` for new, `PUT` for edit).

### `Permissions` (enum) — relevant values
| Key | String Value |
|---|---|
| `BASE_DATA_OPERATION_INFO` | `'BASE_DATA_OPERATION_INFO'` |
| `BASE_DATA_OPERATION_INFO_CREATE` | `'BASE_DATA_OPERATION_INFO_CREATE'` |
| `BASE_DATA_OPERATION_INFO_EDIT` | `'BASE_DATA_OPERATION_INFO_EDIT'` |
| `BASE_DATA_OPERATION_INFO_DELETE` | `'BASE_DATA_OPERATION_INFO_DELETE'` |

### `Operation` (class)
| Property | Type | Default |
|---|---|---|
| `id` | `number \| undefined` | — |
| `is_active` | `boolean \| undefined` | `true` |
| `custom_id` | `string \| undefined` | — |
| `operation_name` | `string` | `''` |
| `standard_cycle_time` | `number \| undefined` | — |
| `item_id` | `number \| undefined` | — |
| `created_at` | `string \| undefined` | — |
| `updated_at` | `string \| undefined` | — |
| `products` | `Product[] \| undefined` | — |

Implements `Deserializable`; `toOdata()` strips `products`, `created_at`, `updated_at`.

### `OperationPosition` (class)
| Property | Type | Default |
|---|---|---|
| `id` | `number \| undefined` | — |
| `is_active` | `boolean \| undefined` | `true` |
| `custom_id` | `string \| undefined` | — |
| `name` | `string` | `''` |
| `operation_id` | `number \| undefined` | — |
| `product_id` | `number \| undefined` | — |
| `machine_id` | `number \| undefined` | — |
| `created_at` | `string \| undefined` | — |
| `updated_at` | `string \| undefined` | — |
| `products` | `Product[] \| undefined` | — |
| `machines` | `Machine[] \| undefined` | — |

Implements `Deserializable`; `toOdata()` strips `operation_name`, `products`, `machines`, `created_at`, `updated_at`.

### `Localization`
A static utility class/object providing localized string constants. `Localization.CreatedAt` is used as the header label for the Created At column.

---

## Key Business Logic

### Permission-gated column rendering
The Actions column is conditionally added to the column array only if the user has at least one of `BASE_DATA_OPERATION_INFO_EDIT` or `BASE_DATA_OPERATION_INFO_DELETE`. Within the cell renderer, each button is further individually guarded by its respective permission. This means a user with only edit permission sees only the edit button; a user with only delete permission sees only the delete button.

### Insert button visibility
The `[isInsertData]` binding evaluates `rolePermissionService.hasPermission(permissions.BASE_DATA_OPERATION_INFO_CREATE)` on every change detection cycle. The insert button in the table header is shown or hidden based on this runtime permission check.

### Direct child component manipulation via ViewChild
Rather than using input binding alone to control the form dialog, the component reaches directly into the child form's properties (`operationInfoFormRef.open`, `operationInfoFormRef.operationPosition`, etc.). This is a deliberate imperative pattern used because the form must be pre-populated with specific data (selected product/machine labels and IDs) that requires lookup against the form's internal `products` and `machines` lists, which are loaded by the form itself on `ngOnInit`. The parent must wait until after the form has loaded its lookup data before the `editInfoOperation` lookup (`.find(...)`) can succeed.

### OData filter scoping
The table's `[filterQuery]` is dynamically constructed as `'operation_id eq ' + operationId`. This ensures only `OperationPosition` records belonging to the current operation are shown, even though the underlying endpoint (`OperationPositions`) returns all positions globally.

### Duplicate `[selectionMode]` binding
The template contains `[selectionMode]="'None'"` and then `[selectionMode]="'Single'"` on the same element. Angular processes these sequentially; the second binding (`'Single'`) takes effect. The `'None'` binding is dead code.

### Missing error handler on `getOparationInfo`
The `getOparationInfo()` API call subscribes only to `next`. If the API returns an error (e.g., 404 for a non-existent operation ID, or a network failure), `IsLoading` will remain `true` indefinitely, potentially leaving the UI in a loading state with no feedback to the user.

### `isOpen` and `CloseDialog()` are effectively unused
The component maintains its own `isOpen` flag and `CloseDialog()` method, but neither is wired to a template binding or called by any event in the current template. The child form component (`app-operation-management-info-form`) manages its own `open` state independently.
