# TOOLS_MANAGEMENT_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| TS file | `src/app/modules/base-data-management/tools-management/handling-units/units-list/units-list.component.ts` |
| HTML file | `src/app/modules/base-data-management/tools-management/handling-units/units-list/units-list.component.html` |
| Selector | `app-units-list` |
| Component type | List + Dialog (CRUD) |
| Table | `app-ag-grid-table` (AG Grid) |
| Purpose | Displays a paginated, server-side-filtered AG Grid of all handling units (packaging/tooling units used in production — pallets, trays, boxes, fixtures). Provides a `app-units-form` dialog for creating and editing units. Delegates deletion to `app-delete-entity`. All actions are guarded by role-based permissions. |

---

## Inputs (@Input)

This component defines no `@Input()` properties. It is a self-contained top-level page component.

---

## Outputs (@Output)

| Output name | Event type | Purpose |
|---|---|---|
| `IsDelete` | `EventEmitter<string>` | Emitted with path `HandlingUnits/${id}`. Passed as `[IsDelete]` input to `app-delete-entity`, which executes the HTTP DELETE after confirmation. |
| `IsSuccessChange` | `EventEmitter<any>` | Emitted after form save or delete success. |

---

## State Properties

| Property | Type | Purpose |
|---|---|---|
| `columns` | `AgGridTableColumn<any>[]` | Column definitions built by `buildColumns()`. |
| `saveMode` | `string` | `'POST'` for create, `'PUT'` for edit. |
| `dataSource` | `AgGridTableODataSourceConfig<any>` | OData data source config for AG Grid. |
| `toolbarConfig` | `AgGridTableToolbarConfig` | Toolbar config including search, counts, New button. |
| `actionButtons` | `AgGridCustomButton[]` | Custom per-row action buttons (edit, delete). |

### `dataSource` Config

```typescript
{
  type: 'odata',
  endpoint: 'HandlingUnits',
  pageSize: 40,
  scrollPagination: true,
  searchFields: ['name', 'custom_id'],
}
```

---

## ViewChild / ViewChildren

| Ref name | Type | Purpose |
|---|---|---|
| `agGridRef` | `AgGridTableComponent<any>` | Template ref `#agGridRef` on `<app-ag-grid-table>`. Used in `processData()` to call `refreshGridData(true)`, triggering a server-side re-fetch after mutations. |

---

## Methods — DETAILED

### `buildColumns(): AgGridTableColumn<any>[]`

**Purpose:** Builds and returns the AG Grid column definitions.

**Columns returned (in order):**

1. **Active** (`field: 'is_active'`): Uses `AgGridBooleanCellRendererComponent`. Not filterable.
2. **ID** (`field: 'custom_id'`): Plain text.
3. **Unit Name** (`field: 'name'`): Plain text.
4. **Created On** (`field: 'created_at'`): `valueFormatter` → `new Date(value).toLocaleDateString()`. Filter and floating filter disabled.

Edit and delete are exposed via `customActionButtons` (permission-gated via `actionButtons` array).

**Returns:** `AgGridTableColumn<any>[]`

---

### `processData(event?: any)`

**Purpose:** Refreshes the grid after any data mutation.

1. Calls `this.agGridRef?.refreshGridData(true)` — triggers a server-side re-fetch.
2. Calls `this.IsSuccessChange.emit(event)`.

---

## Template Bindings & Structure

### `<app-ag-grid-table>` (data table)

| Binding | Value | Effect |
|---|---|---|
| `[columns]` | `columns` | AG Grid column definitions |
| `[dataSource]` | `dataSource` | OData source (`HandlingUnits`) |
| `[toolbarConfig]` | `toolbarConfig` | Toolbar title, search, New button |
| `gridId` | `"base-data-handling-units-list"` | Column state persistence key |
| `[isBase]` | `true` | Enables column-state persistence |
| `[showAction]` | `true` | Shows built-in per-row action column |
| `[editPermission]` | `true` | Required alongside `showAction` for action column to render |
| `[showEditButton]` | `false` | Built-in edit hidden; custom action buttons used |
| `[showDeleteButton]` | `false` | Built-in delete hidden; custom action buttons used |
| `[customActionButtons]` | `actionButtons` | Permission-gated Edit + Delete |

### `<app-units-form>`

Receives form data and `saveMode`. Emits `RefreshTable` → `processData()`.

### `<app-delete-entity>`

Receives `[IsDelete]="IsDelete"` and calls `processData($event)` on `(isSuccess)`.

---

## API Calls

| HTTP Method | Endpoint | When |
|---|---|---|
| `GET` | `HandlingUnits` + OData params | Grid load / filter / sort / after mutation |
| `POST` | `HandlingUnits` | `UnitsFormComponent` POST branch |
| `PUT` | `HandlingUnits(${id})` | `UnitsFormComponent` PUT branch |
| `DELETE` | `HandlingUnits/${id}` | Via `app-delete-entity` after confirmation |

---

## Services Injected

| Service | Methods used |
|---|---|
| `RolePermissionService` | `hasPermission(permission)` for action/button visibility |

---

## Key Business Logic

1. **Route permission typo:** Route guard uses `BASE_DATA_HANDING_UNITS` (missing 'L' in HANDLING) — use exact key when checking permissions.

2. **Dashboard count:** Handling unit count appears on home dashboard via `$batch` request under the `HandlingUnits` endpoint.

3. **Action column guard:** Both `[showAction]="true"` AND `[editPermission]="true"` must be set for the action column to render (line 1513 guard in `AgGridTableComponent`).

4. **AG Grid migration notes:** Replaced `react-analytical-table` / `.tsx` with `AgGridTableComponent`. `buildColumns()` returns typed `AgGridTableColumn[]`. `processData()` calls `agGridRef?.refreshGridData(true)`.
