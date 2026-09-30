# USER_BIN_LIST_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| Component | `src/app/modules/base-data-management/user-management/user-bin-list/user-bin-list.component.ts` |
| Selector | `app-user-bin-list` |
| Component type | List only (no dialog) — Restore action |
| Table | `app-ag-grid-table` (AG Grid) |
| Purpose | Displays a paginated, server-side REST AG Grid of soft-deleted (`onlyTrashed()`) `User` rows — the "Recycle Bin". Provides a single per-row **Restore** action, permission-gated. No create/edit/permanent-delete UI. |

---

## Background / Why this exists

`User` (`Backend/app/Models/User.php`) uses Laravel `SoftDeletes`. Deleting a user (via the existing generic OData `DELETE /odata/Users(id)` route) only sets `deleted_at` — the row, and its unique `email`/`phone`, still exist. Before this component there was no UI to see or recover those rows, so re-creating a user/employee with the same email failed with an "already exists" error and admins had no way to undo an accidental delete.

Scope is intentionally narrow:
- Only `User` — `Employee` delete behavior and its (lack of) cascade to the linked `User` were explicitly left unchanged.
- No change to `add_user`/`Employee` email-uniqueness validation logic — restoring is the only way to free up a trashed email for reuse.
- No permanent-delete ("empty bin") action — restore only, per the feature request.

---

## UserBinListComponent

### Inputs (@Input)
None. Self-contained top-level page component, same shape as `UserListComponent`.

### Outputs (@Output)
None — no parent needs to react to restore; the grid refreshes itself.

### State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `columns` | `AgGridTableColumn<User>[]` | built in constructor | Column definitions |
| `dataSource` | `AgGridTableODataSourceConfig<User>` | see below | REST data source config |
| `toolbarConfig` | `AgGridTableToolbarConfig` | see below | Toolbar — search + row count, no New button |
| `actionButtons` | `AgGridCustomButton[]` | see below | Single Restore button |

### `dataSource` Config

```typescript
{
  type: 'api',
  endpoint: '',
  customEndpoint: 'users/trashed',
  expand: 'roles',
  sortBy: 'deleted_at',
  sortDirection: 'desc',
  pageSize: 40,
  scrollPagination: true,
  searchFields: ['custom_id', 'name', 'email', 'phone'],
}
```

> `type: 'api'` hits `/api/users/trashed` (new backend route). Sorted by `deleted_at desc` so the most recently deleted user shows first.

### `toolbarConfig` Config

```typescript
{
  headerTitle: $localize`Recycle Bin`,
  showSearch: true,
  showRowCount: true,
  showNewButton: false,
}
```

### ViewChild

| Ref name | Type | Purpose |
|---|---|---|
| `agGridRef` | `AgGridTableComponent<User>` | `#agGridRef` — used in `restoreUser()` → `refreshGridData(true)` |

### Methods

#### `buildColumns(): AgGridTableColumn<User>[]`
Same columns as `UserListComponent.buildColumns()` (`is_active`, `custom_id`, `name`, `email`, `phone`, `roles`) plus a trailing `deleted_at` column (`valueFormatter` → `toLocaleDateString()`) showing when the user was trashed.

#### `restoreUser(row: User)`
1. `this.commonService.post(\`users/${row.id}/restore\`, {}, false)` — REST (`isLodata=false`), empty body.
2. On success: `this.toastService.show('edit', 'User restored successfully')`, then `this.agGridRef?.refreshGridData(true)` to drop the now-restored row from the bin view.
3. On error: `console.error(...)`, `this.toastService.show('error')`.

### Template — `<app-ag-grid-table>`

| Binding | Value | Effect |
|---|---|---|
| `[columns]` | `columns` | Column definitions |
| `[dataSource]` | `dataSource` | REST data source (`users/trashed`) |
| `[toolbarConfig]` | `toolbarConfig` | Toolbar (no New button) |
| `selectionMode` | `"Single"` | Single row selection |
| `[isBase]` | `true` | Column-state persistence |
| `gridId` | `"base-data-user-bin-list"` | Key for localStorage column state (distinct from `base-data-user-list`) |
| `[showAction]` | `true` | Shows action column |
| `[editPermission]` | `true` | Required for action column to render |
| `[showEditButton]` | `false` | No edit in bin |
| `[showDeleteButton]` | `false` | No delete in bin |
| `[customActionButtons]` | `actionButtons` | Permission-gated Restore only |

No `<app-user-form>` / `<app-delete-entity>` in the template — bin has no create/edit/permanent-delete flow.

### API Calls

| Method | Endpoint | `isOdata` | Purpose |
|---|---|---|---|
| GET | `users/trashed` | `false` (REST `/api/`) | List soft-deleted users, paginated/searchable (via grid data source) |
| POST | `users/${id}/restore` | `false` (REST `/api/`) | Restore a soft-deleted user (clears `deleted_at`) |

Backend: `Backend/app/Http/Controllers/UserController.php` — `trashed_list()` mirrors `user_list()`'s pagination/search/sort parsing but queries `User::onlyTrashed()` and orders by `deleted_at desc`; `restore_user()` does `User::onlyTrashed()->findOrFail($id)->restore()`. Both check `$request->user()->can(...)` against `BASE_DATA_USER_BIN` / `BASE_DATA_USER_RESTORE` and return 403 JSON if missing. Routes registered in `routes/api.php` next to the existing `users` route.

### Permissions

| Permission | Enforced where |
|---|---|
| `BASE_DATA_USER_BIN` | Route guard (`PermissionGuard` on `/base-data/user-bin`), sidebar item visibility, backend `trashed_list()` |
| `BASE_DATA_USER_RESTORE` | Restore action-button visibility (`hide` callback), backend `restore_user()` |

Both seeded in `Backend/database/seeders/PermissionSeeder.php` next to the other `BASE_DATA_USER_*` permissions. `super-admin` gets them automatically via `Permission::all()` sync in `RoleSeeder.php`; other roles need them assigned explicitly via the Roles Permissions screen.

---

## Services Injected

| Component | Service | Visibility | Methods used |
|---|---|---|---|
| `UserBinListComponent` | `RolePermissionService` | `public` | `hasPermission()` |
| `UserBinListComponent` | `CommonService` | `private` | `post()` |
| `UserBinListComponent` | `ToastService` | `private` | `show()` |

## Inter-component Communication
None — standalone page, no parent/sibling wiring beyond the sidebar `routerLink` and route guard.

## Key Business Logic / Known Issues
1. **Scope is Users only.** `Employee` records are never soft-deleted and have no bin entry — deleting an Employee is still an immediate, permanent hard delete with no cascade to its linked `User`. This was an explicit product decision, not an oversight.
2. **No permanent delete.** There is intentionally no "empty bin" / force-delete action in this component — only restore. If a truly permanent delete is ever needed, it would be a new, separately-permissioned action.
3. **Email reuse still requires restore.** Creating a new user/employee with an email belonging to a trashed `User` still fails validation (`unique:users,email` does not exclude soft-deleted rows) — the admin must restore (or permanently remove, once/if that exists) the trashed row first, or use a different email. This behavior was left unchanged by design.
4. **Column state key.** Uses its own `gridId` (`base-data-user-bin-list`) distinct from `UserListComponent`'s (`base-data-user-list`) so saved column layouts don't collide.
