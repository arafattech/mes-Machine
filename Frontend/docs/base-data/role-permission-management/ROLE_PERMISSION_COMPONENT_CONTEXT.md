# ROLE_PERMISSION_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| TS file | `src/app/modules/base-data-management/role-permission-management/role-permission-list/role-permission-list.component.ts` (plain `.ts`, not `.tsx`) |
| HTML file | `src/app/modules/base-data-management/role-permission-management/role-permission-list/role-permission-list.component.html` |
| Selector | `app-role-permission-list` |
| Component type | Dual-panel (Role AG Grid + Permission AG Grid tree) |
| Role table | `app-ag-grid-table` (AG Grid, OData, server-side, Single selection) |
| Permission panel | `app-ag-grid-table` with `[isTreeTable]="true"` (flat rows + external filter + custom tri-state checkbox renderer; client-side, local data from `permissionGroups`) |
| Purpose | Left panel: paginated AG Grid of all roles with edit/delete. Right panel: AG Grid tree of all permissions grouped by module; selecting a role checks its assigned permissions. Supports create/edit/delete roles and assigning/revoking permissions. |

---

## Outputs (@Output)

| Output name | Event type | Purpose |
|---|---|---|
| `IsDelete` | `EventEmitter<string>` | Emitted by `deleteRole(id)` as `Roles/${id}`. Passed to `app-delete-entity`. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `Permissions` | `typeof Permissions` | `Permissions` | Enum reference for template permission guard. |
| `permissions` | `{ [key: string]: boolean }` | `{}` | Flat permission map for current user. Set in `ngOnInit`. |
| `localization` | `typeof Localization` | `Localization` | Shared i18n string constants. |
| `saveMode` | `string` | `'POST'` | `'POST'` create / `'PUT'` edit for role form. |
| `selectedRole` | `Role` | `new Role()` | Currently selected role; drives permission panel header and submit guard. |
| `selectedRoleRowId` | `number \| undefined` | `undefined` | Index in `roleTableData` for the selected role; used by `onCancel`. |
| `roleTableData` | `any[]` | `[]` | Cached rows from last `(processData)` event on role grid. |
| `selectedPermissionName` | `string[]` | `[]` | Names of permissions checked for selected role. Source of truth for permission panel. |
| `selectedPermissionList` | `number[]` | `[]` | IDs of checked permissions (reserved; resolved on submit). |
| `permissionData` | `Permission[]` | `[]` | All permissions fetched from API; used to resolve names → IDs on submit. |
| `disableSelect` | `boolean` | `true` | `true` when selected role is super-admin; disables tree checkboxes (read-only). |
| `pendingRoleId` | `number \| undefined` | `undefined` | Set before `refreshRole()` after POST; auto-selects new role on next data load. |
| `pendingRoleName` | `string \| undefined` | `undefined` | Fallback for `pendingRoleId` match. |
| `roleColumns` | `AgGridTableColumn<any>[]` | built in constructor | AG Grid column defs for role table. |
| `roleGridId` | `string` | `'base-data-roles'` | AG Grid column-state persistence key. |
| `roleDataSource` | `AgGridTableODataSourceConfig<any>` | OData `Roles?$expand=syncPermissions` | Server-side data source. |
| `roleToolbarConfig` | `AgGridTableToolbarConfig` | see below | Toolbar config for role grid. |
| `roleActionButtons` | `AgGridCustomButton[]` | edit + delete | Per-row action buttons; both `disable`d for `super-admin`/`employee`. |
| `permissionColumns` | `AgGridTableColumn<any>[]` | `[]` | Empty — tree column (`__tree__`) is built inside `ag-grid-table`. |
| `permissionDataSource` | `AgGridTableODataSourceConfig<any>` | `staticData` w/ flat tree rows | Flat tree rows from `buildPermissionTreeData()`. |
| `permissionToolbarConfig` | `AgGridTableToolbarConfig` | search only | `{ showSearch: true, showRowCount: false, showNewButton: false, showTableSettingBtn: false }`. |
| `_programmaticSelection` | `boolean` (private) | `false` | Suppresses `onPermissionSelectionChanged` feedback during programmatic selection. |
| `disableRow` / `enableRow` | `(row) => boolean` | `() => true` / `() => false` | Passed as `disableColumnRule`; `disableRow` disables checkboxes for super-admin. |

### `roleToolbarConfig` defaults

```typescript
{ headerTitle: "Roles", showSearch: true, showRowCount: true, showNewButton: true }
```

### `roleActionButtons`

```typescript
[
  { id: "edit",   icon: "edit",   design: "Transparent",
    tooltip: "Edit",   disable: (row) => row?.name === "super-admin" || row?.name === "employee",
    onClick: (row) => this.editRole(row) },
  { id: "delete", icon: "delete", design: "Negative",
    tooltip: "Delete", disable: (row) => row?.name === "super-admin" || row?.name === "employee",
    onClick: (row) => this.deleteRole(row?.id) },
]
```

---

## ViewChild / ViewChildren

| Ref name | Type | Purpose |
|---|---|---|
| `agRoleGridRef` | `AgGridTableComponent` | `#agRoleGridRef`. `refreshGridData(true)` + `getGridApi()` for programmatic row select. |
| `agPermissionGridRef` | `AgGridTableComponent` | `#agPermissionGridRef`. `getGridApi()` used by `setSelectedTableData()` to set tree selection. |
| `roleFormRef` | `RoleFormComponent` | `#roleForm`. Opens role create/edit dialog. |

---

## RoleFormComponent (`role-form/` subfolder — create/edit role dialog)

### Files
```
role-permission-management/
└── role-form/
    ├── role-form.component.ts
    ├── role-form.component.html
    └── role-form.component.scss
```

### Selector
`app-role-form`

### Inputs / Outputs

| Name | Direction | Purpose |
|------|-----------|---------|
| `saveMode` | `@Input`, default `'POST'` | Set by parent before opening (`newRole()`/`editRole()`) |
| `onSuccess` | `@Output` | Emits `{ response, role, saveMode }` on successful save — consumed by `handleRoleSaved()` on the list component |

### Key Properties
| Property | Purpose |
|----------|---------|
| `role` | `Role` model bound to the name input; parent sets it directly via `roleFormRef.role.deserialize(data)` in `editRole()` |
| `open` / `loading` | Dialog visibility / busy state |
| `valueStateOptions.name` | `ValueState.Negative`/`None` — inline validation state for the name field |

### Key Methods
| Method | Description |
|--------|-------------|
| `addRole()` | Validates, then POST `Roles` (create) or PUT `Roles(${id})` (edit) via `role.toOdata()`; on success emits `onSuccess` and closes |
| `checkValidation(event)` | Live input-blur validation → toggles `valueStateOptions.name` |
| `validateForm()` | Blocks submit if `role.name` is empty |
| `CloseDialog()` | Resets `open`, `loading`, validation state, and `role` to a fresh instance |

---

## Tree Data Format

`buildPermissionTreeData()` flattens `permissionGroups` (hierarchical) into flat rows:

```typescript
// Parent group row
{ id: 'grp__BASE_DATA', name: 'BASE_DATA', _level: 0, _parentId: null, _isLeaf: false }
// Child leaf row (actual permission)
{ id: 'BASE_DATA_ADMIN', name: 'BASE_DATA_ADMIN', _level: 1, _parentId: 'grp__BASE_DATA', _isLeaf: true }
```

- `_level: 0` = group header; `_level: 1` = leaf permission
- `_parentId` links children to their group id
- `_isLeaf: true` marks actual permissions; only leaf rows are emitted via `selectionChanged`

---

## Tri-State Tree Selection (inside `ag-grid-table.component.ts`)

The `__selection__` column uses a **custom tri-state checkbox renderer** (`AgGridTreeCheckboxCellRendererComponent`) when `[isTreeTable]="true"`. AG Grid Community native checkboxes are binary, so group checkboxes are rendered manually.

- **Leaf** rows participate in AG Grid row selection (`node.isSelected()`).
- **Group** rows are NOT AG-selected. State computed from children via `getTreeGroupState(groupId)`:
  - `checked` (all children selected), `indeterminate` (some), `unchecked` (none)
  - Uses `api.forEachNode` → counts **all** children including collapsed/filtered-out ones, so the partial state shows even when the group is collapsed.
- **UI5 quirk:** `<ui5-checkbox>` renders the dash only when `checked=true` AND `indeterminate=true`. So for indeterminate the renderer sets BOTH true.
- **Leaf change** → `node.setSelected(checked, false, 'checkboxSelected')`.
- **Group change** → `toggleTreeGroupChildren(groupId, checked)` batch-selects all children via `api.setNodesSelected(...)`. Clicking a partial group selects all children.
- After any change, `handleSelectionChanged` calls `api.refreshCells({ columns: ['__selection__'], force: true })` so every checkbox re-reads state, then emits leaf rows only.
- `isDisabled` (from `disableColumnRule`) disables all checkboxes for super-admin.

> NOTE: `permissionGroups` is 2-level (module → permission). State sync matches by single-level `_parentId`. True N-level nesting would need a recursive descendant walk.

---

## Lifecycle Hooks

### Constructor
Fires immediately (not `ngOnInit`): `getinititalPermissions()` (loads `permissionData` for ID resolution) and `roleColumns = buildRoleColumns()`.

### `ngOnInit`

```typescript
this.permissions = this.rolePermissionService.getAllPermissionsStatus();
this.rolePermissionService.fetchAllGrouped().subscribe({
  next: (groups) => {
    this.permissionDataSource = {
      ...this.permissionDataSource,
      data: this.buildPermissionTreeData(groups),
    };
    this.groupsReady = true;
  },
  error: () => { this.groupsReady = true; },
});
```

**This is the actual source of the permission tree** — `permissionDataSource.data` is no longer built synchronously at field-init time (as an older version of this doc implied); it's populated async from `RolePermissionService.fetchAllGrouped()` (returns `PermissionGroup[]`), and `groupsReady` flips to `true` on both success AND error (so the busy-indicator never gets stuck if the request fails).

### Loading-state gating (new)

| Property | Type | Set by | Purpose |
|----------|------|--------|---------|
| `groupsReady` | `boolean`, default `false` | `ngOnInit`'s `fetchAllGrouped()` callback | True once the permission-group tree data has arrived (or failed) |
| `roleTableLoading` | `boolean`, default `true` | `handleRoleTableData()` → `false` on first `(processData)` event | True until the role grid's first page loads |
| `permissionGridLoading` | `boolean` (getter) | derived: `!groupsReady \|\| roleTableLoading \|\| !selectedRole?.id` | Drives `[isBusy]` on the permission tree grid |

Template wiring: `[isBusy]="!groupsReady || roleTableLoading"` on the role grid, `[isBusy]="permissionGridLoading"` on the permission tree grid.

---

## Methods — DETAILED

### `buildRoleColumns(): AgGridTableColumn<any>[]` _(private)_

Columns:
1. **Name** — `field: 'name'`, `minWidth: 180`, `flex: 1`
2. **Created On** — `field: 'created_at'`, filter/sort disabled, `valueFormatter` → `toLocaleDateString()`

---

### `buildPermissionTreeData(groups: PermissionGroup[]): any[]` _(private)_

Flattens the `groups` argument (from `RolePermissionService.fetchAllGrouped()`, NOT a static field) into `_level`/`_parentId`/`_isLeaf` rows (see Tree Data Format). Called once, inside `ngOnInit`'s `fetchAllGrouped()` subscribe.

---

### `setSelectedTableData()`

Programmatically applies `selectedPermissionName` to the permission tree.

1. Gets `gridApi` from `agPermissionGridRef`. Returns if not ready.
2. `disableSelect = selectedRole.name === 'super-admin'`.
3. Sets `_programmaticSelection = true`, calls `deselectAll()`.
4. Collects leaf nodes to select — all leaves if super-admin (read-only "all"), else leaves whose `name` ∈ `selectedPermissionName` — and batch-selects via `setNodesSelected({ ..., source: 'api' })`.
5. Sets `_programmaticSelection = false`, `refreshCells({ columns: ['__selection__'], force: true })`.

Group tri-state is computed automatically by the renderer — no manual parent sync.

---

### `handleRoleTableData(event: any)`

Called from `(processData)` on role AG Grid. Auto-selects role on every data load. Sets `roleTableLoading = false` unconditionally on entry (feeds `permissionGridLoading`).

**Empty-data guard (early return)**: if the page has zero rows (e.g. search/filter matches nothing), resets `roleTableData`, `selectedRole`, `selectedRoleRowId`, `selectedPermissionName` to empty and calls `setSelectedTableData()` to clear the permission tree — otherwise a stale role's permissions would stay checked with no role selected.

Otherwise, priority: 1) `pendingRoleId` (new role), 2) `pendingRoleName`, 3) `selectedRole.id`, 4) index 0.

Stores rows in `roleTableData`, calls `applyRoleSelection`, then in a `setTimeout` calls `getGridApi().forEachNode(... setSelected(true))` to highlight the role row.

---

### `handlePermissionResponseData(value: any)`

Stores raw permission response into `selectedPermission` (or clears on empty).

---

### `handleRowSelect(selectedData: any)`

Called from `(rowClick)` on role AG Grid. Finds index in `roleTableData`, calls `applyRoleSelection`.

---

### `onPermissionSelectionChanged(leafRows: any[])`

Called from `(selectionChanged)` on permission tree (leaf rows only). Skips if `_programmaticSelection` OR `disableSelect` (super-admin). Sets `selectedPermissionName` from leaf names.

---

### `applyRoleSelection(roleData: any, rowIndex: number)` _(private)_

Sets `selectedPermissionList`/`selectedPermissionName` from `roleData.syncPermissions`, sets `selectedRole`/`selectedRoleRowId`, calls `setSelectedTableData()`.

---

### `refreshRole()`

```typescript
this.agRoleGridRef?.refreshGridData(true);
```

---

### `newRole()`

Opens role form in POST mode, resets `selectedRole`.

---

### `editRole(data: any)`

Returns early for `"super-admin"`/`"employee"`. Otherwise opens role form in PUT mode. Invoked via `roleActionButtons[edit].onClick`.

---

### `deleteRole(id: any)`

```typescript
this.IsDelete.emit(`Roles/${id}`);
```

Invoked via `roleActionButtons[delete].onClick`.

---

### `handleRoleSaved(event: any)`

On POST: sets `pendingRoleId` / `pendingRoleName`. Calls `refreshRole()`.

---

### `onCancel()`

Re-applies saved permissions for the selected role from `roleTableData` (via `applyRoleSelection`). Falls back to clearing selection.

---

### `submitPermission()`

Guards on `selectedRole.id`. Calls `getSelectedPermissionIds()`. POSTs `{ id, syncPermissions: [{ id }] }` to `"permissions"`. On success: `refreshRole()` + toast `'add'`.

---

### `getinititalPermissions()`

GETs `Permissions?$top=3000` into `permissionData` for ID resolution on submit.

---

### `getSelectedPermissionIds(): number[]`

Resolves `selectedPermissionName` → IDs via `permissionData`.

---

## Template Bindings — Role AG Grid (`app-ag-grid-table`)

| Binding | Value | Effect |
|---|---|---|
| `[columns]` | `roleColumns` | Name + Created On columns |
| `[dataSource]` | `roleDataSource` | OData `Roles?$expand=syncPermissions` |
| `[toolbarConfig]` | `roleToolbarConfig` | Header, search, row count, New button |
| `[isBase]` | `true` | — |
| `[gridId]` | `'base-data-roles'` | Column state persistence |
| `[selectionMode]` | `'Single'` | Single-row selection |
| `[selectionRowBehavior]` | `'Row'` | Entire row clickable |
| `[showAction]` | `true` | Render action column |
| `[showEditButton]` | `false` | Suppress built-in edit (uses custom buttons) |
| `[showDeleteButton]` | `false` | Suppress built-in delete (uses custom buttons) |
| `[customActionButtons]` | `roleActionButtons` | Edit + delete, disabled for super-admin/employee |
| `(newButtonClick)` | `newRole()` | Opens create dialog |
| `(rowClick)` | `handleRowSelect($event)` | Selects role, loads permissions |
| `(processData)` | `handleRoleTableData($event)` | Auto-selects role |

> Edit/delete are wired through `roleActionButtons[].onClick`, not `(editClick)`/`(deleteClick)`.

---

## Template Bindings — Permission Tree AG Grid (`app-ag-grid-table`)

| Binding | Value | Effect |
|---|---|---|
| `[columns]` | `permissionColumns` (`[]`) | No regular columns — tree column built internally |
| `[dataSource]` | `permissionDataSource` (`staticData`) | Flat tree rows from `buildPermissionTreeData()` |
| `[toolbarConfig]` | inline (`'Role : ' + selectedRole.name`, search) | Dynamic header title + search |
| `[isTreeTable]` | `true` | Custom tree column + external filter + tri-state checkbox |
| `[selectionMode]` | `'Multiple'` | Checkbox column rendered |
| `[selectionRowBehavior]` | `'RowOnly'` | Only checkbox toggles selection (not row click) |
| `[showAction]` | `false` | No edit/delete actions |
| `[isBase]` | `false` | — |
| `[disableColumnRule]` | `disableSelect ? disableRow : enableRow` | Disables checkboxes for super-admin |
| `[displayConfig]` | `{ gridHeight: 'calc(100vh - 170px)', fillEmptyRows: false }` | Fill disabled (incompatible with tree) |
| `(selectionChanged)` | `onPermissionSelectionChanged($event)` | Receives leaf-only rows |

Submit/Cancel buttons live in a `<ui5-bar>`; Submit is `[disabled]` when `selectedRole.name == 'super-admin'`.

---

## API Calls

| HTTP | Endpoint | When | Payload |
|---|---|---|---|
| GET | `Roles?$expand=syncPermissions` + OData | Grid load / after mutation | Built by AG Grid |
| POST | `Roles` | Role create | `{ name }` |
| PUT | `Roles(${id})` | Role edit | `{ name }` |
| DELETE | `Roles/${id}` | Via `app-delete-entity` | Path from `deleteRole()` |
| GET | `Permissions?$top=3000` | On construct | Fetches all permissions |
| POST | `permissions` | `submitPermission()` | `{ id, syncPermissions: [{ id }] }` |

---

## Services Injected

| Service | Visibility | Methods used |
|---|---|---|
| `CommonService` | `private` | `get()`, `post()` |
| `RolePermissionService` | `private` | `getAllPermissionsStatus()`, `fetchAllGrouped()` (returns `Observable<PermissionGroup[]>` — source of the permission tree) |
| `ToastService` | `private` | `show('add' \| 'error')` |

### Dead code (present in TS, not wired to the template)
`handlePermissionResponseData()`, `selectedPermission`, `Roles` (= `Role` class ref), `canRolePermisson`, `ToastType`, `isInsert`, `isRemovePermission`, `isDeleteLoading`, `selectedRemovePermission`, `odata` — none of these are referenced in `role-permission-list.component.html`. Flagging so a future cleanup pass doesn't have to re-derive this from scratch; not touched here since this task is docs-only.

---

## Key Business Logic

1. **Both tables use `app-ag-grid-table`:** Role table = OData server-side, Single selection. Permission table = flat tree (`[isTreeTable]="true"`) via custom tree column + Community external filter + tri-state checkbox renderer.

2. **Tri-state tree:** Group checkboxes computed from children (checked/indeterminate/unchecked), accurate even when collapsed (`forEachNode` counts hidden children). Group toggle batch-selects children; child change re-renders group via `refreshCells`. Only `_isLeaf` rows emitted. See "Tri-State Tree Selection".

3. **Programmatic selection guard:** `setSelectedTableData()` sets `_programmaticSelection = true` so the `selectionChanged` events it triggers don't overwrite `selectedPermissionName` in `onPermissionSelectionChanged`.

4. **Auto-selection on load:** `handleRoleTableData` restores last selected role (or newly created via `pendingRoleId`) on every grid reload, and highlights the row via `getGridApi().setSelected`.

5. **super-admin / employee guards:**
   - Role table: `roleActionButtons` edit + delete both `disable`d (greyed) for `super-admin`/`employee`; `editRole` also returns early.
   - Permission tree: `disableSelect=true` for super-admin → `disableColumnRule = disableRow` disables all checkboxes; `setSelectedTableData` shows ALL leaves selected (read-only); `onPermissionSelectionChanged` ignores changes; Submit button disabled.

6. **`IsDelete` dual-use:** `@Output()` on this component AND passed as `[IsDelete]` to `app-delete-entity`. Delete entity emits `(isSuccess)` → `refreshRole()`.

7. **Permission resolution:** `permissionData` (from API) maps `selectedPermissionName` strings → IDs in `getSelectedPermissionIds()` before POST to `permissions` endpoint.
