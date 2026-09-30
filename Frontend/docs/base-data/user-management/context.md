# Base Data Management — User Management

## Files
```
user-management/
├── user-form/
│   ├── user-form.component.ts     ← Angular standalone form (migrated from TSX)
│   ├── user-form.component.html
│   └── user-form.component.scss
├── user-list/
│   ├── user-list.component.ts     ← AG Grid list
│   ├── user-list.component.html
│   └── user-list.component.scss
└── user-bin-list/
    ├── user-bin-list.component.ts     ← AG Grid list of soft-deleted (trashed) users + Restore
    ├── user-bin-list.component.html
    └── user-bin-list.component.scss
```

## Route
`/base-data/user-management` — `UserListComponent` — guarded by `BASE_DATA_USER_LIST`.
`/base-data/user-bin` — `UserBinListComponent` — guarded by `BASE_DATA_USER_BIN`.

## Purpose
Manages **system user accounts** — the people who log into the MES application. Covers creating accounts, assigning roles, setting passwords, and activating/deactivating users.

`UserBinListComponent` covers the **Recycle Bin**: `User` uses Laravel `SoftDeletes`, so deleting a user (via `Users/{id}` OData delete) never actually removes the row — it just sets `deleted_at`. Previously there was no way to see or recover these rows, and their `email`/`phone` stayed reserved, blocking creation of a new user/employee with the same email. This page lists trashed users and lets an admin restore one back to active use.

---

## UserListComponent

### Selector
`app-user-list`

### ViewChildren / Outputs

| Name | Type | Purpose |
|------|------|---------|
| `agGridRef` | `AgGridTableComponent<User>` | Grid ref for programmatic refresh |
| `userFormRef` | `UserFormComponent` | Opens create/edit dialog |
| `refreshTable` | `@Output EventEmitter<void>` | Propagates to parent after save/delete |
| `IsDelete` | `@Output EventEmitter<string>` | Passes `"Users/${id}"` to `app-delete-entity` |

### Key Methods

| Method | Description |
|--------|-------------|
| `buildColumns()` | Builds `AgGridTableColumn[]` — called in constructor |
| `newUser()` | Resets `userFormRef`, opens in POST mode |
| `editUser(data)` | Loads row into `userFormRef`, sets `Roles` getter/setter, opens in PUT mode |
| `processData()` | Save/delete callback — `agGridRef.refreshGridData(true)` + `refreshTable.emit()` |

### Grid Config (`app-ag-grid-table`)

| Input | Value |
|-------|-------|
| `gridId` | `base-data-user-list` |
| `type` | `api` — REST `/api/users` (eager-loads `roles`) |
| `customEndpoint` | `users` |
| `expand` | `roles` |
| `isBase` | `true` — column state persists in localStorage |
| `sortBy` | `id` desc |
| `searchFields` | `['custom_id', 'name', 'email', 'phone']` |
| `selectionMode` | `Single` |
| `showSegmentButton` | `true` — All / Active / Inactive |
| `showAction` | `true` |
| `editPermission` | `true` |
| `showNewButton` | `BASE_DATA_USER_CREATE` permission |

> `type: 'api'` required — OData `/odata/Users` does not eager-load roles → roles column blank.

### Action Buttons

| Button | Permission | Icon | Handler |
|--------|-----------|------|---------|
| Edit | `BASE_DATA_USER_EDIT` | `edit` | `editUser(row)` |
| Delete | `BASE_DATA_USER_DELETE` | `delete` (Negative) | `IsDelete.emit('Users/${id}')` |

### Columns (`buildColumns()`)

| Field | Header | Notes |
|-------|--------|-------|
| `is_active` | Active | `AgGridBooleanCellRendererComponent`; `sortable: false` |
| `custom_id` | ID | `width: 130` |
| `name` | Name | |
| `email` | Email | |
| `phone` | Phone Number | |
| `roles` (colId) | Roles | `valueGetter` → `params.data?.roles ?? []`; `AgGridBadgeListCellRendererComponent`; `filter: false`, `sortable: false` |
| `created_at` | Created At | `valueFormatter` → `toLocaleDateString()`; `filter: false` |

---

## UserBinListComponent

### Selector
`app-user-bin-list`

### Purpose
Lists soft-deleted (`onlyTrashed()`) `User` rows and lets an admin restore one. No create/edit — restore only.

### Key Methods

| Method | Description |
|--------|-------------|
| `buildColumns()` | Same base columns as `UserListComponent` plus `deleted_at` |
| `restoreUser(row)` | `POST users/${row.id}/restore` → toast → `agGridRef.refreshGridData(true)` |

### Grid Config (`app-ag-grid-table`)

| Input | Value |
|-------|-------|
| `gridId` | `base-data-user-bin-list` |
| `type` | `api` — REST `/api/users/trashed` |
| `customEndpoint` | `users/trashed` |
| `expand` | `roles` |
| `sortBy` | `deleted_at` desc |
| `searchFields` | `['custom_id', 'name', 'email', 'phone']` |
| `showNewButton` | `false` — no create in bin |

### Action Buttons

| Button | Permission | Icon | Handler |
|--------|-----------|------|---------|
| Restore | `BASE_DATA_USER_RESTORE` | `undo` (Emphasized) | `restoreUser(row)` |

### Columns (`buildColumns()`)
Same as `UserListComponent` (`is_active`, `custom_id`, `name`, `email`, `phone`, `roles`) plus `deleted_at` (date, `valueFormatter` → `toLocaleDateString()`).

### API Calls

| Method | Endpoint | `isOdata` | Purpose |
|--------|----------|-----------|---------|
| GET | `users/trashed` | `false` (REST) | List soft-deleted users (via grid data source) |
| POST | `users/${id}/restore` | `false` (REST) | Restore a soft-deleted user |

Both routes are permission-gated server-side (`BASE_DATA_USER_BIN` / `BASE_DATA_USER_RESTORE`) in `UserController::trashed_list` / `restore_user`.

---

## UserFormComponent

### Selector
`app-user-form`

### File
`user-form/user-form.component.ts` — fully migrated from React/TSX to Angular. No React imports.

### Inputs

| Input | Type | Purpose |
|-------|------|---------|
| `saveMode` | `string` | `'POST'` or `'PUT'` |
| `user` | `User` | Model being edited (bound from user-list via `[user]="Users"`) |

### Outputs

| Output | Type | Purpose |
|--------|------|---------|
| `RefreshTable` | `EventEmitter<void>` | Reload list after save |

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `open` | `boolean` | Controls dialog visibility |
| `selectedTab` | `string` | Active tab: `'coreData'` or `'roles'` |
| `Roles` | `Role[]` getter/setter | Assigned roles. Setter auto-updates `roleDataSource` — setting `userFormRef.Roles = [...]` from parent immediately refreshes the roles grid |
| `roleDataSource` | `AgGridTableODataSourceConfig<Role>` | Static data source for roles tab grid |
| `roleColumns` | `AgGridTableColumn<Role>[]` | Roles tab grid columns |
| `roleToolbarConfig` | `AgGridTableToolbarConfig` | Toolbar with Associate button |
| `roleDisplayConfig` | `AgGridTableDisplayConfig` | `gridHeight: 'calc(100vh - 460px)'` |

### Tabs

#### Core Data (`id="coreData"`)
Fields: `is_active` (switch), `name` (required), `email`, `phone`, `password` (required on POST; min 6 chars; optional on PUT).

Validation: `userValidation()` — either email or phone required; name required; password required on POST.

Error banner: `ui5-message-strip` shown on duplicate-user API error.

#### Roles (`id="roles"`)
Displays assigned roles in `app-ag-grid-table` with static data.

| Input | Value |
|-------|-------|
| `[columns]` | `roleColumns` (is_active, name, created_at) |
| `[dataSource]` | `roleDataSource` (staticData, driven by `Roles` setter) |
| `[toolbarConfig]` | Associate button in toolbar |
| `[showDeleteButton]` | `true` — triggers `removeRoleData($event)` |
| `(newButtonClick)` | `isRoleAssociate()` — opens `app-assosiate` overlay |
| `(deleteClick)` | `removeRoleData($event)` — removes role from `Roles` array |

Associate overlay: `<app-assosiate #roleAssociate [apiUrl]="'Roles?'" ...>` — multi-select (default). On confirm fires `getRoleFromAssosiate(selectedItems)` which sets `this.Roles = [...selectedItems]`.

### API Calls

| Method | Endpoint | `isOdata` | Purpose |
|--------|----------|-----------|---------|
| POST | `add/user` | `false` (REST) | Create user + roles |
| PUT | `edit/user/${id}` | `false` (REST) | Update user + roles |
| GET | `Roles?` | `true` (OData) | Populate role associate overlay |

POST/PUT body: `{ userInfo: User, roles: Role[] }`

---

## User Model
```typescript
interface User {
  id?: number;
  custom_id?: string;
  name: string;
  email?: string;
  phone?: string;
  password?: string;    // required on POST; optional on PUT; min 6 chars
  is_active: boolean;
  roles?: Role[];
}
```

---

## Services Injected

| Component | Service | Usage |
|-----------|---------|-------|
| `UserListComponent` | `RolePermissionService` | Action/button visibility |
| `UserFormComponent` | `CommonService` | HTTP POST/PUT |
| `UserFormComponent` | `ToastService` | Success/error toast |
| `UserBinListComponent` | `RolePermissionService` | Restore-button visibility |
| `UserBinListComponent` | `CommonService` | `POST users/${id}/restore` |
| `UserBinListComponent` | `ToastService` | Success/error toast |

## Key Relationships
- User → belongs to Role (roles defined in `role-permission-management`)
- User → identity used in `ActivityLog.user_id` audit trail
- User ID stored in `localStorage` and read by `BankDetailsComponent.markAsApprove()`

## Notes
- `user-form.component.tsx` fully migrated to `.ts` — React/JSX removed, `react-analytical-table` replaced with `app-ag-grid-table`.
- `SelectedRoles` output removed — role grid now driven by `Roles` getter/setter + `roleDataSource`.
- `editUser()` in user-list sets `this.userFormRef.Roles = roles` directly (no `.emit()` needed).
- Roles must be created in `role-permission-management` before users can be assigned.
- Do NOT add `segmentButtonItems` to toolbarConfig — `showSegmentButton: true` already renders All/Active/Inactive.
- Action column requires BOTH `[showAction]="true"` AND `[editPermission]="true"` (guard at ag-grid-table line 1513).
- Recycle Bin is scoped to `User` only — `Employee` deletion is unaffected (still a hard delete, no cascade to its linked `User`). No change was made to email/phone uniqueness validation on create; a trashed user's email still blocks a new signup until restored (or a different email is used).
