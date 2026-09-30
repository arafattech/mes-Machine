# USER_MANAGEMENT_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| List component | `src/app/modules/base-data-management/user-management/user-list/user-list.component.ts` |
| Form component | `src/app/modules/base-data-management/user-management/user-form/user-form.component.ts` |
| List selector | `app-user-list` |
| Form selector | `app-user-form` |
| Component type | List + Dialog (CRUD) |
| Table | `app-ag-grid-table` (AG Grid) |
| Purpose | Displays a paginated, server-side REST AG Grid of all system users. Provides an `app-user-form` dialog for creating and editing users (core data + role assignment via AG Grid static table). Delegates deletion to `app-delete-entity`. All create / edit / delete actions are guarded by role-based permissions. |

---

## UserListComponent

### Inputs (@Input)

None. Self-contained top-level page component.

### Outputs (@Output)

| Output name | Event type | Purpose |
|---|---|---|
| `refreshTable` | `EventEmitter<void>` | Emitted after successful save or delete. |
| `IsDelete` | `EventEmitter<string>` | Emitted by delete action with path `Users/${id}`. Passed as `[IsDelete]` to `app-delete-entity`. |

### State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `columns` | `AgGridTableColumn<User>[]` | built in constructor | Column definitions. |
| `saveMode` | `string` | `'POST'` | `'POST'` for create, `'PUT'` for edit. |
| `Users` | `User` | `new User()` | Bound to `app-user-form` via `[user]`. |
| `dataSource` | `AgGridTableODataSourceConfig<User>` | see below | REST data source config. |
| `toolbarConfig` | `AgGridTableToolbarConfig` | see below | Toolbar with search, segment, New button. |
| `actionButtons` | `AgGridCustomButton[]` | see below | Per-row edit + delete buttons. |

### `dataSource` Config

```typescript
{
  type: 'api',
  endpoint: '',
  customEndpoint: 'users',
  expand: 'roles',
  sortBy: 'id',
  sortDirection: 'desc',
  pageSize: 40,
  scrollPagination: true,
  searchFields: ['custom_id', 'name', 'email', 'phone'],
}
```

> `type: 'api'` hits `/api/users` which eager-loads `roles`. OData `/odata/Users` does NOT return roles → roles column blank. Do NOT change to `type: 'odata'`.

### `toolbarConfig` Config

```typescript
{
  headerTitle: $localize`User List`,
  addButtonText: $localize`New`,
  showSearch: true,
  showRowCount: true,
  showSegmentButton: true,
  showNewButton: rolePermissionService.hasPermission(Permissions.BASE_DATA_USER_CREATE),
}
```

> Do NOT add `segmentButtonItems` — `showSegmentButton: true` already renders All/Active/Inactive. Adding both causes duplicate `ui5-segmented-button` elements.

### ViewChild

| Ref name | Type | Purpose |
|---|---|---|
| `agGridRef` | `AgGridTableComponent<User>` | `#agGridRef` — used in `processData()` → `refreshGridData(true)`. |
| `userForm` | `UserFormComponent` | `#userForm` — used in `newUser()` and `editUser()`. |

### Methods

#### `buildColumns(): AgGridTableColumn<User>[]`
Builds column definitions in constructor. Columns (in order): `is_active` (BooleanRenderer), `custom_id`, `name`, `email`, `phone`, `roles` (BadgeListRenderer, `valueGetter` returns `params.data?.roles ?? []`), `created_at` (valueFormatter).

#### `processData(event?: any)`
1. `this.refreshTable.emit()`
2. `this.agGridRef?.refreshGridData(true)`

#### `newUser()`
1. `this.userFormRef.user = new User().deserialize({})`
2. `this.userFormRef.open = true`
3. `this.saveMode = saveMode.POST`

#### `editUser(data: User)`
1. `this.userFormRef.user.deserialize(data)`
2. `this.userFormRef.open = true`
3. `this.userFormRef.selectedTab = 'coreData'`
4. `this.userFormRef.Roles = (data as any).roles ?? []` — setter auto-refreshes roles grid
5. `this.saveMode = saveMode.PUT`

> Do NOT call `SelectedRoles.emit()` — that output was removed. Setting `Roles` directly via the setter is sufficient.

### Template — `<app-ag-grid-table>`

| Binding | Value | Effect |
|---|---|---|
| `[columns]` | `columns` | Column definitions |
| `[dataSource]` | `dataSource` | REST data source |
| `[toolbarConfig]` | `toolbarConfig` | Toolbar |
| `selectionMode` | `"Single"` | Single row selection |
| `[isBase]` | `true` | Column-state persistence |
| `gridId` | `"base-data-user-list"` | Key for localStorage column state |
| `[showAction]` | `true` | Shows action column |
| `[editPermission]` | `true` | Required for action column to render (guard at line 1513) |
| `[showEditButton]` | `false` | Hides built-in edit; custom action buttons used |
| `[showDeleteButton]` | `false` | Hides built-in delete; custom action buttons used |
| `[customActionButtons]` | `actionButtons` | Permission-gated Edit + Delete |
| `(newButtonClick)` | `newUser()` | Opens create dialog |

### Template — `<app-user-form>`

| Binding | Value |
|---|---|
| `[saveMode]` | `saveMode` |
| `[user]` | `Users` |
| `(RefreshTable)` | `processData($event)` |

### Template — `<app-delete-entity>`
`[IsDelete]="IsDelete"` — `(isSuccess)="processData($event)"`

---

## UserFormComponent

### Inputs (@Input)

| Input | Type | Purpose |
|---|---|---|
| `saveMode` | `string` | `'POST'` or `'PUT'` |
| `user` | `User` | Model being edited |

### Outputs (@Output)

| Output | Type | Purpose |
|---|---|---|
| `RefreshTable` | `EventEmitter<void>` | Reload list after successful save |

### State Properties

| Property | Type | Purpose |
|---|---|---|
| `open` | `boolean` | Dialog visibility |
| `selectedTab` | `string` | Active tab: `'coreData'` or `'roles'` |
| `Roles` | `Role[]` (getter/setter) | Assigned roles. **Setter auto-updates `roleDataSource`** — setting `userFormRef.Roles = [...]` from parent immediately refreshes the AG Grid. |
| `roleDataSource` | `AgGridTableODataSourceConfig<Role>` | Static data source for roles grid |
| `roleColumns` | `AgGridTableColumn<Role>[]` | Roles grid columns |
| `roleToolbarConfig` | `AgGridTableToolbarConfig` | Shows Associate button in toolbar |
| `roleDisplayConfig` | `AgGridTableDisplayConfig` | `gridHeight: 'calc(100vh - 460px)'` |
| `message_strip` | `boolean` | Shows duplicate-user error banner |
| `duplicate_error` | `string` | Error message from API |

### ViewChild

| Ref name | Type | Purpose |
|---|---|---|
| `roleListGrid` | `AgGridTableComponent<Role>` | `#roleListGrid` — roles tab AG Grid |
| `roleAssociate` | `AssosiateComponent` | `#roleAssociate` — role selection overlay |

### Tabs

#### Core Data (`id="coreData"`)
Fields: `is_active` switch, `name` (required), `email`, `phone`, `password`.

Validation rules (`userValidation()`):
- `name` — required
- `email` OR `phone` — at least one required
- `email` — must contain `@` if provided
- `password` — required on POST, min 6 chars; optional on PUT but min 6 if provided

#### Roles (`id="roles"`)

`app-ag-grid-table #roleListGrid` — static data driven by `Roles` setter.

| Binding | Value |
|---|---|
| `[columns]` | `roleColumns` — `is_active`, `name`, `created_at` |
| `[dataSource]` | `roleDataSource` (staticData) |
| `[toolbarConfig]` | Associate button |
| `[showDeleteButton]` | `true` |
| `(newButtonClick)` | `isRoleAssociate()` — opens associate overlay |
| `(deleteClick)` | `removeRoleData($event)` |

`app-assosiate #roleAssociate`:
- `[apiUrl]="'Roles?'"` — loads all roles via OData
- `isMultiselect` defaults `true` — multi-select
- `(selectedData)` → `getRoleFromAssosiate(items)` → sets `this.Roles = [...items]`

### Methods

| Method | Purpose |
|---|---|
| `checkValidation(event, field)` | Real-time per-field validation on `(input)` events |
| `userValidation()` | Full form validation before save; returns `boolean` |
| `isRoleAssociate()` | Opens `roleAssociateRef` with current `Roles` as pre-selection |
| `removeRoleData(item)` | Filters `item.id` out of `Roles`; setter updates grid |
| `getRoleFromAssosiate(items)` | Sets `Roles` from associate selection |
| `onUserSave()` | Validates → POST or PUT → close + refresh on success |
| `onTabSelect(event)` | Updates `selectedTab` from `ui5-tabcontainer` event |
| `CloseDialog()` | Resets all state, hides dialog |

### API Calls

| Method | Endpoint | `isOdata` | Body |
|---|---|---|---|
| POST | `add/user` | `false` (REST `/api/`) | `{ userInfo: User, roles: Role[] }` |
| PUT | `edit/user/${user.id}` | `false` (REST `/api/`) | `{ userInfo: User, roles: Role[] }` |
| GET | `Roles?` (via assosiate) | `true` (OData) | — |

---

## Services Injected

| Component | Service | Visibility | Methods used |
|---|---|---|---|
| `UserListComponent` | `RolePermissionService` | `public` | `hasPermission()` |
| `UserFormComponent` | `CommonService` | `private` | `post()`, `put()` |
| `UserFormComponent` | `ToastService` | `private` | `show()` |

---

## Key Business Logic

1. **REST vs OData for list:** `type: 'api'` hits `/api/users` which eager-loads `roles`. Do not switch to `type: 'odata'` — roles column will be blank.

2. **Roles getter/setter:** `Roles` uses a private `_roles` backing field. The setter spreads a new array into `roleDataSource.data`, triggering AG Grid to re-render. This replaces the old `SelectedRoles.emit()` pattern. Setting `userFormRef.Roles = [...]` from parent is sufficient.

3. **Segment button:** `showSegmentButton: true` renders All/Active/Inactive. Do NOT add `segmentButtonItems`.

4. **Action column guard:** Both `[showAction]="true"` AND `[editPermission]="true"` required — ag-grid-table checks both at line 1513.

5. **Roles cell renderer:** `AgGridBadgeListCellRendererComponent` renders `ui5-tag` badges. Shows ≤2 named tags; count tag for >2.

6. **`IsDelete` dual-use:** `@Output()` on `UserListComponent` AND passed as `[IsDelete]` to `app-delete-entity` which subscribes internally.

7. **Migration notes:** `user-form.component.tsx` → `.ts`. Removed: React, `@ui5/webcomponents-react`, `AnalyticalTableComponent`, `react-analytical-table`, `SelectedRoles`/`isRoleAsossiate`/`isOpenRoleAssosiate` outputs, `validateForm()` (merged into `userValidation()`). Added: AG Grid roles tab, `Roles` getter/setter.
