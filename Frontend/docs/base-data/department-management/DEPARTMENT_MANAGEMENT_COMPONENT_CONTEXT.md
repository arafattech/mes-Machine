# DEPARTMENT_MANAGEMENT_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| TS file | `src/app/modules/base-data-management/department-management/department-management.component.ts` |
| HTML file | `src/app/modules/base-data-management/department-management/department-management.component.html` |
| Selector | `app-department-management` |
| Component type | List + Dialog (CRUD) |
| Table | `app-ag-grid-table` (AG Grid) |
| Purpose | Displays a paginated, server-side-filtered AG Grid of all departments. Provides a `ui5-dialog` form for creating and editing a department (name, active flag). Delegates deletion to `app-delete-entity`. All create / edit / delete actions are guarded by role-based permissions. Emits real-time socket notifications on all mutations. |

---

## Inputs (@Input)

This component defines no `@Input()` properties. It is a self-contained top-level page component.

---

## Outputs (@Output)

| Output name | Event type | Purpose |
|---|---|---|
| `refreshTable` | `EventEmitter<void>` | Emitted after a successful save (POST or PUT) to signal parent components that data has changed. |
| `IsDelete` | `EventEmitter<string>` | Emitted by `deleteClick(row)` with path `Departments/${row.id}`. Passed as `[IsDelete]` input to `app-delete-entity`, which executes the HTTP DELETE after confirmation. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `permissions` | `typeof Permissions` | `Permissions` | Allows permission keys to be referenced in the template. |
| `isDialogOpen` | `boolean` | `false` | Controls `ui5-dialog` visibility. |
| `localization` | `typeof Localization` | `Localization` | Shared internationalised string constants. |
| `validationMessage` | `string` | `Localization.requiredField` | Error message shown in the name input's `valueStateMessage` slot. |
| `saveMode` | `string` | `'POST'` | `'POST'` for create, `'PUT'` for edit. |
| `isLoading` | `boolean` | `false` | Disables Submit and Cancel buttons while an HTTP request is in flight. |
| `department` | `Department` | `new Department()` | Model bound to the dialog form via `ngModel`. |
| `columns` | `AgGridTableColumn<any>[]` | `[]` | Column definitions built by `buildColumns()` in constructor. |
| `gridId` | `string` | `'base-data-department'` | Identifies this grid for AG Grid column state persistence. |
| `valueStateOptions` | `{ name: ValueState }` | `{ name: ValueState.None }` | UI5 value state per validated field. `Negative` = error; `None` = clear. |
| `authUser` | `User` | `new User()` | Logged-in user, set from `authService.user()` in constructor. Used as `sender_id` / `sender_name` in notification socket payloads. |
| `pendingDeleteData` | `{ id: number; custom_id?: string } \| null` | `null` | Stores the row about to be deleted. Set in `deleteClick()`, consumed and cleared in `processData()` after `app-delete-entity` confirms success. Needed because `app-delete-entity` does not return the deleted record. |

---

## ViewChild / ViewChildren

| Ref name | Type | Purpose |
|---|---|---|
| `agGridRef` | `AgGridTableComponent<Department>` | Template ref `#agGridRef` on `<app-ag-grid-table>`. Used in `processData()` to call `refreshGridData(true)`, triggering a server-side re-fetch after mutations. |

---

## Lifecycle Hooks

No `ngOnInit`. Column definitions are built in the constructor:

```typescript
constructor(...) {
  this.authUser = this.authService.user();
  this.columns = this.buildColumns();
}
```

---

## Methods — DETAILED

### `buildColumns(): AgGridTableColumn<any>[]`

**Purpose:** Builds and returns the AG Grid column definitions.

**Columns returned (in order):**

1. **Active** (`field: 'is_active'`): Uses `AgGridBooleanCellRendererComponent`. Width 90. Filter, sort, and floating filter disabled.
2. **Custom ID** (`field: 'custom_id'`): Plain text. `minWidth: 120`.
3. **Name** (`field: 'name'`): Plain text. `minWidth: 180`.
4. **Created On** (`field: 'created_at'`): `valueFormatter` renders `new Date(value).toLocaleDateString()`. Filter and floating filter disabled.

Edit and delete are exposed via `[showEditButton]` / `[showDeleteButton]` on `app-ag-grid-table` — no custom action cell renderer column.

**Returns:** `AgGridTableColumn<any>[]`

---

### `processData(event?: any)`

**Purpose:** Refreshes the grid after any data mutation. Also dispatches delete socket notification if a deletion just completed.

1. Calls `this.refreshTable.emit(event)`.
2. Calls `this.agGridRef?.refreshGridData(true)` — triggers a server-side re-fetch.
3. If `this.pendingDeleteData` is set: calls `triggerDepartmentNotification('base-data-department:deleted', this.pendingDeleteData)`, then sets `pendingDeleteData = null`.

---

### `checkValidation(event: any, field: string)`

**Purpose:** Real-time validation on `(input)` events.

- Case `'name'`: If trimmed value is empty → `valueStateOptions.name = ValueState.Negative`. Otherwise → assigns value to `department.name` and resets to `ValueState.None`.

---

### `checkPermission(data: string): boolean`

**Purpose:** Template helper wrapping `rolePermissionService.hasPermission()`.

Used in template for `[showEditButton]`, `[showDeleteButton]`.

---

### `validateForm(): boolean`

**Purpose:** Full validation before save. Called by `saveDepartment()`.

- Checks `this.department.name` is not blank after `.trim()`.
- On failure: sets `valueStateOptions.name = ValueState.Negative`, returns `false`.

---

### `saveDepartment()`

**Purpose:** Validates and HTTP-saves the department. Emits socket notification on success.

1. Calls `validateForm()` — exits if invalid.
2. Sets `isLoading = true`.
3. **POST:** `http.post('Departments', this.department, true)`. On success: `processData(res)`, toast `'add'`, `CloseDialog()`, `triggerDepartmentNotification('base-data-department:created', res)`.
4. **PUT:** `http.put('Departments(${id})', this.department, true)`. On success: `processData(res)`, toast `'edit'`, `CloseDialog()`, `triggerDepartmentNotification('base-data-department:updated', res)`.
5. On error: logs, shows toast `'error'`. `isLoading` is NOT reset — only `CloseDialog()` resets it.

---

### `editDepartment(row: any)`

**Purpose:** Opens dialog in edit mode.

1. `this.department = new Department().deserialize(row)`.
2. `this.saveMode = saveMode.PUT`.
3. `this.isDialogOpen = true`.

Called from `(editClick)` and `(rowClick)` on `app-ag-grid-table`.

---

### `newDepartment()`

**Purpose:** Opens dialog in create mode with blank form.

1. `this.department = new Department().deserialize({})`.
2. `this.saveMode = saveMode.POST`.
3. `this.isDialogOpen = true`.

---

### `deleteClick(row: any)`

**Purpose:** Initiates deletion. Stores row data for post-delete notification, then emits OData path to `app-delete-entity`.

```typescript
this.pendingDeleteData = { id: row.id, custom_id: row.custom_id };
this.IsDelete.emit(`Departments/${row.id}`);
```

Called from `(deleteClick)="deleteClick($event)"` on `app-ag-grid-table`. Full row object is passed (not just `$event.id`) so `custom_id` is available for the notification payload.

---

### `triggerDepartmentNotification(event: string, dept: { id: number; custom_id?: string }): void`

**Purpose:** Emits a socket event to the node-server so it can broadcast `notification:new` to all connected clients.

```typescript
this.socketService.emit(event, {
  model_id: dept.id,
  model_custom_id: dept.custom_id ?? dept.id,
  sender_id: this.authUser.id,
  sender_name: this.authUser.name,
});
```

| Caller | Event string |
|--------|-------------|
| POST success | `'base-data-department:created'` |
| PUT success | `'base-data-department:updated'` |
| Delete success (`processData`) | `'base-data-department:deleted'` |

---

### `CloseDialog()`

**Purpose:** Resets all dialog state and closes it.

1. Sets `isLoading = false`.
2. Sets `isDialogOpen = false`.
3. Resets `department` to `new Department()`.
4. Resets `valueStateOptions` to `{ name: ValueState.None }`.

---

## Template Bindings & Structure

### `<app-ag-grid-table>` (data table)

| Binding | Value | Effect |
|---|---|---|
| `[columns]` | `columns` | AG Grid column definitions |
| `[dataSource]` | `dataSource` | OData config (endpoint, searchFields, sortBy, sortDirection, pageSize) |
| `[toolbarConfig]` | `toolbarConfig` | Header title, search, row count, new button |
| `selectionMode` | `"Single"` | Single row selection |
| `[isBase]` | `true` | Enables column-state persistence |
| `[gridId]` | `gridId` | `'base-data-department'` |
| `[showAction]` | `true` | Shows built-in per-row action column |
| `[showEditButton]` | `checkPermission(BASE_DATA_DEPARTMENT_EDIT)` | Per-row edit button |
| `[showDeleteButton]` | `checkPermission(BASE_DATA_DEPARTMENT_DELETE)` | Per-row delete button |
| `(newButtonClick)` | `newDepartment()` | Opens create dialog |
| `(editClick)` | `editDepartment($event)` | Opens edit dialog with row data |
| `(deleteClick)` | `deleteClick($event)` | Stores row + emits delete path |
| `(rowClick)` | `editDepartment($event)` | Row click also opens edit dialog |
| `[showIllustratedMessage]` | `true` | Shows illustrated empty state |

### `<ui5-dialog>` (create / edit dialog)

`[open]="isDialogOpen"`, `(before-close)="CloseDialog()"`.

- **Active toggle:** `ui5-switch` bound to `department.is_active`.
- **Name field:** `ui5-input` bound to `department.name`; real-time validation on `(input)`.
- **Footer:** Submit (`saveDepartment()`) + Cancel (`CloseDialog()`), both disabled while `isLoading`.

### `<app-delete-entity>`

Receives `[IsDelete]="IsDelete"`. On `(isSuccess)` → calls `processData($event)`, which handles grid refresh and delete socket emit.

---

## API Calls

| HTTP Method | Endpoint | When | Payload |
|---|---|---|---|
| `GET` | `Departments` + OData params | Grid load / filter / sort / after mutation | Built by `AgGridTableComponent` |
| `POST` | `Departments` | `saveDepartment()` POST branch | `Department` object |
| `PUT` | `Departments(${id})` | `saveDepartment()` PUT branch | `Department` object |
| `DELETE` | `Departments/${id}` | Via `app-delete-entity` after confirmation | Path built in `deleteClick()` |

---

## Data Source Config

```typescript
dataSource: AgGridTableODataSourceConfig<Department> = {
  type: 'odata',
  endpoint: 'Departments',
  searchFields: ['name', 'custom_id'],
  pageSize: 40,
  sortBy: 'id',
  sortDirection: 'desc',
  scrollPagination: true,
};
```

Default sort: newest department first (`id desc`).

---

## Validation Logic

| Field | Rule | On failure | On pass |
|---|---|---|---|
| `department.name` | Not blank after `.trim()` | `valueStateOptions.name = ValueState.Negative` | `ValueState.None` |

Triggered: real-time (`checkValidation`) + on submit (`validateForm`).

---

## Services Injected

| Service | Visibility | Methods used |
|---|---|---|
| `RolePermissionService` | `public` | `hasPermission(permission)` |
| `CommonService` (as `http`) | `private` | `post(url, body, token)`, `put(url, body, token)` |
| `ToastService` | `private` | `show('add' | 'edit' | 'error')` |
| `SocketService` | `private` | `emit(event, payload)` |
| `AuthService` | `private` | `user()` — reads logged-in user for notification sender |

---

## Permissions

| Permission string | Guards |
|---|---|
| `BASE_DATA_DEPARTMENT` | Route / module access |
| `BASE_DATA_DEPARTMENT_CREATE` | New button in toolbar |
| `BASE_DATA_DEPARTMENT_EDIT` | Edit button per row |
| `BASE_DATA_DEPARTMENT_DELETE` | Delete button per row |
| `BASE_DATA_DEPARTMENT_CREATE_NOTIFICATION` | Receive create notifications (bell count, toast, sound) |
| `BASE_DATA_DEPARTMENT_UPDATE_NOTIFICATION` | Receive update notifications |
| `BASE_DATA_DEPARTMENT_DELETE_NOTIFICATION` | Receive delete notifications |

---

## Real-Time Notification System

### Socket emit flow (Angular → node-server → all clients)

```
Angular success callback
  → triggerDepartmentNotification(event, dept)
  → socketService.emit('base-data-department:created|updated|deleted', payload)
  → node-server @SubscribeMessage handler (biometrics.service.ts)
  → notificationService.broadcastDepartmentCreated|Updated|Deleted(payload)
  → server.emit('notification:new', { type, title, message, ... })
  → All clients: NotificationComponent receives
    → fetchNotifications() [always] → bell count updates from DB
    → if hasPermission(type): playSound(), showAlertToast()
```

### DB persistence (Laravel observer)

`Backend/app/Observers/DepartmentObserver.php`, registered in `AppServiceProvider`.

> **Lodata gotcha**: `created`, `updated`, and `deleted` Eloquent events do not fire inside Lodata's DB transaction. `saving`/`creating`/`saved`/`deleting` fire reliably. Observer uses `saved()` + `wasRecentlyCreated` and `deleting()` instead.

| Observer method | Fires | Action |
|---|---|---|
| `saved(dept)` | After INSERT or UPDATE via Lodata | `dispatch($dept, 'created', auth()->id())` if `wasRecentlyCreated`, else `'updated'` |
| `deleting(dept)` | Before DELETE via Lodata | `dispatch($dept, 'deleted', auth()->id())` |

`NotificationService::dispatch()` inserts one `Notification` record per user who has the relevant permission. `fetchNotifications()` on the client reads these records.

### PERMISSION_MAP key format (NotificationService.php)
```php
'Department::created'  => 'BASE_DATA_DEPARTMENT_CREATE_NOTIFICATION',
'Department::updated'  => 'BASE_DATA_DEPARTMENT_UPDATE_NOTIFICATION',
'Department::deleted'  => 'BASE_DATA_DEPARTMENT_DELETE_NOTIFICATION',
// key = "{ModelClassName}:{model->type ?? ''}:{action}"
// Department has no 'type' column → empty string → double-colon
```

---

## Key Business Logic

1. **Permission-gated actions:** `showEditButton` and `showDeleteButton` evaluated via `checkPermission()`. Built-in row buttons on `app-ag-grid-table`.

2. **`IsDelete` dual-use pattern:** `IsDelete` is both `@Output()` on this component and `[IsDelete]` input to `app-delete-entity`. The delete component subscribes internally and executes DELETE after user confirmation.

3. **`pendingDeleteData` pattern:** Because `app-delete-entity` only emits a success signal (no data), the deleted row's `id`/`custom_id` must be captured before the delete in `deleteClick(row)` and read in `processData()` after `(isSuccess)` fires.

4. **`isLoading` not reset on error:** After a failed HTTP save, buttons remain disabled until `CloseDialog()` is called.

5. **OData URL patterns:** PUT uses parentheses `Departments(${id})`; DELETE uses slash `Departments/${id}`.
