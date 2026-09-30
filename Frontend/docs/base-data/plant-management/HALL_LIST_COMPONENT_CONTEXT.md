# HALL_LIST_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `src/app/modules/base-data-management/hall-management/hall-list/hall-list.component.ts` |
| **HTML file** | `src/app/modules/base-data-management/hall-management/hall-list/hall-list.component.html` |
| **Selector** | `app-hall-list` |
| **Component type** | List (container / orchestrator) |
| **Table** | `app-ag-grid-table` (AG Grid Infinite Row Model + OData query builder). See `Frontend/docs/shared-components/AG_GRID_TABLE_CONTEXT.MD`. |
| **Purpose** | Paginated, filterable, sortable OData-backed table of Hall records. Manages the create/edit dialog by controlling a child `HallFormComponent` via ViewChild direct assignment. Orchestrates delete by emitting an OData URL string to `app-delete-entity`. |

---

## Inputs (@Input)

No `@Input()` properties. Self-contained route-level component.

---

## Outputs (@Output)

| Output name | Emitted type | Purpose |
|---|---|---|
| `refreshTable` | `void` | Re-emitted from `processData()` to notify any parent listener of a data change. Local grid reload is done directly via the `agGridRef` ViewChild. |
| `IsDelete` | `string` | Emits the OData delete URL string (e.g. `"Halls(42)"`) to `app-delete-entity`. |

---

## State Properties

| Property | Type | Default / Initial value | Purpose |
|---|---|---|---|
| `localization` | `typeof Localization` | `Localization` | Resolves column header strings. |
| `permissions` | `typeof Permissions` | `Permissions` | Permissions enum reference for template RBAC checks. |
| `insertTitle` | `string` | `$localize\`New\`` | New button label, fed into `toolbarConfig.addButtonText`. |
| `headerTitle` | `string` | `"Hall List"` (localised) | Grid toolbar title, fed into `toolbarConfig.headerTitle`. |
| `columns` | `AgGridTableColumn<Hall>[]` | `[]` → built in constructor | AG Grid column config. Built once by `buildColumns()`. |
| `dataSource` | `AgGridTableODataSourceConfig<Hall>` | `{ type:'odata', endpoint:'Halls', expand:'plants', sortBy:'id', sortDirection:'desc', searchFields:['name','custom_id'], pageSize:40, scrollPagination:true }` | Fetch config for the grid. `expand:'plants'` makes plant arrays available in each row for `editHall()`. |
| `toolbarConfig` | `AgGridTableToolbarConfig` | `{ headerTitle, showSearch:true, showRowCount:true, showSegmentButton:true, showNewButton: hasPermission(BASE_DATA_HALL_CREATE), addButtonText: insertTitle }` | Toolbar config. |

---

## ViewChild / ViewChildren

| Ref variable | Type | Purpose |
|---|---|---|
| `agGridRef` (`#agGridRef`) | `AgGridTableComponent<Hall>` | `refreshGridData(true)` after mutations |
| `hallFormRef` (`#hallForm`) | `HallFormComponent` | Calls `resetForm()`, sets `hall`, `plants`, `saveMode`, `open` directly |

---

## Lifecycle Hooks

No lifecycle hooks. Initialisation via property defaults + constructor.

### Constructor

| Injected token | Access modifier | Notes |
|---|---|---|
| `RolePermissionService` | `public rolePermissionService` | Public so the HTML template can call `hasPermission(...)` for RBAC bindings. |

Constructor body: `this.columns = this.buildColumns();`

---

## Methods — DETAILED

### `buildColumns(): AgGridTableColumn<Hall>[]`

**Columns:**

| Field | Header | Notes |
|---|---|---|
| `is_active` | Active | `cellRenderer: AgGridBooleanCellRendererComponent`. `filter:false`, `sortable:false`, width 90 / minWidth 80. |
| `custom_id` | ID | `filter:false`, minWidth 100. |
| `name` | Hall Name | minWidth 180. Localised header `Hall` + `Name`. |
| `created_at` | Created On (`Localization.CreatedAt`) | `filter:false`. `valueFormatter` → `new Date(value).toLocaleDateString()`. |

No Actions column here — row actions (Edit / Delete) are rendered by the grid's built-in action column via `[showAction]`, `[editPermission]`, `[showEditButton]`, `[showDeleteButton]`.

---

### `onDeleteHall(row: Hall): void`
Emits `Halls(${row.id})` — OData parentheses format. Wired to grid's `(deleteClick)`.

---

### `processData(_event?: any): void`
1. `this.refreshTable.emit()`.
2. `this.agGridRef?.refreshGridData(true)` — hard-reloads the grid.

Called by `(RefreshTable)` from `HallFormComponent` and `(isSuccess)` from `app-delete-entity`.

---

### `newHall(): void`
Opens `HallFormComponent` in **create** mode.

1. `hallFormRef.resetForm()` — clears all form state.
2. `hallFormRef.hall = new Hall().deserialize({})`.
3. `hallFormRef.plants = []`.
4. `hallFormRef.saveMode = saveMode.POST`.
5. `hallFormRef.open = true`.

---

### `editHall(data: any): void`
Opens `HallFormComponent` in **edit** mode.

1. `hallFormRef.resetForm()`.
2. `hallFormRef.hall = new Hall().deserialize(data)`.
3. `hallFormRef.setPlants(data.plants ?? [])` — loads plants into sub-grid via the form's public setter.
4. `hallFormRef.saveMode = saveMode.PUT`.
5. `hallFormRef.open = true`.

> `data.plants` is available without a secondary fetch because `dataSource.expand = 'plants'` includes it in each row.

---

## Template Bindings & Structure

Three sibling elements: grid, form dialog, delete dialog.

### 1. `<app-ag-grid-table #agGridRef>`

| Binding | Value / Source |
|---|---|
| `[columns]` | `columns` (from `buildColumns()`) |
| `[dataSource]` | `dataSource` → `endpoint:'Halls'`, `expand:'plants'`, `sortBy:'id'`, `sortDirection:'desc'`, `searchFields`, `pageSize:40`, `scrollPagination:true` |
| `[toolbarConfig]` | `toolbarConfig` |
| `selectionMode` / `selectionRowBehavior` | `"Single"` / `"RowOnly"` |
| `[isBase]` | `true` |
| `gridId` | `"base-data-hall-list"` |
| `[showAction]` + `[editPermission]` | `true` + `true` |
| `[showEditButton]` | `hasPermission(BASE_DATA_HALL_EDIT)` |
| `[showDeleteButton]` | `hasPermission(BASE_DATA_HALL_DELETE)` |
| `[showIllustratedMessage]` | `NoData` empty-state overlay |
| `(newButtonClick)` | `newHall()` |
| `(editClick)` | `editHall($event)` |
| `(deleteClick)` | `onDeleteHall($event)` |
| `(rowClick)` | `editHall($event)` |

### 2. `<app-hall-form #hallForm>`

| Binding | Value |
|---|---|
| `(RefreshTable)` | `processData($event)` |

> No `[saveMode]` or `[hall]` template bindings. Both properties are set imperatively via `hallFormRef` ViewChild in `newHall()` / `editHall()`.

### 3. `<app-delete-entity>`

| Binding | Value |
|---|---|
| `[IsDelete]` | `IsDelete` EventEmitter |
| `(isSuccess)` | `processData($event)` |

---

## Permissions

| Permission | Used for |
|---|---|
| `BASE_DATA_HALL_CREATE` | New button visibility (`[showNewButton]`) |
| `BASE_DATA_HALL_EDIT` | Edit action button (`[showEditButton]`) |
| `BASE_DATA_HALL_DELETE` | Delete action button (`[showDeleteButton]`) |

---

## Key Business Logic

### Conditional Action Buttons
Built-in action column renders when `[showAction]` and `[editPermission]` are both `true`. Individual buttons gated independently by permission. A user with only edit permission sees only the edit button.

### Row-Click = Edit
Both `(rowClick)` and `(editClick)` call `editHall()` — selecting a row opens the edit dialog.

### OData Expansion for Plants
Grid expands `plants` so each Hall row already contains its associated plant array. `editHall()` passes `data.plants` via `hallFormRef.setPlants()` — no secondary fetch needed.

### Imperative Child Component Control
All `HallFormComponent` state (open, hall, plants, saveMode) is set imperatively via `@ViewChild`. The form element in the template has only the `(RefreshTable)` output binding — no data input bindings.

### Refresh Propagation Chain
- **Save:** `HallFormComponent` → `associate()` success → `RefreshTable.emit()` → parent `processData()` → `agGridRef.refreshGridData(true)`.
- **Delete:** `app-delete-entity` success → `(isSuccess)` → `processData()` → same reload path.

### Enums / Models Used

| Name | Source | Usage |
|---|---|---|
| `Hall` | `@shared/model/hall` | Grid row model; deserialized in `newHall()`/`editHall()` |
| `saveMode` | `@shared/enums/saveMode` | `POST` / `PUT` |
| `Permissions` | `@app/shared/enums/permissions` | `BASE_DATA_HALL_CREATE`, `EDIT`, `DELETE` |
| `Localization` | `@app/shared/utilities/localization` | `Localization.CreatedAt` |
| `AgGridBooleanCellRendererComponent` | `@shared/components/ag-grid-table/cell-renderers/` | `is_active` column |
