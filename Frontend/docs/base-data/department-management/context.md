# Base Data Management — Department Management

## Files
```
department-management/
├── department-management.component.ts    ← Angular (list + dialog form)
└── department-management.component.html  ← Template

Backend/app/Observers/DepartmentObserver.php  ← Eloquent observer (DB notifications)
node-server/src/module/notification/          ← Socket broadcast handlers
```

## Route
`/base-data/departments` — `DepartmentManagementComponent` — guarded by `BASE_DATA_DEPARTMENT`.

## Purpose
Manages **Departments** — organizational units used to classify employees (e.g., Production, Quality, Maintenance). List rendered via `app-ag-grid-table`; create/edit via `ui5-dialog`; delete delegated to `app-delete-entity`. Emits real-time socket notifications on create/update/delete.

---

## DepartmentManagementComponent

### Selector
`app-department-management`

### Type
Angular component — list (`app-ag-grid-table`) + `ui5-dialog` form.

### ViewChild References

| Ref | Type | Purpose |
|-----|------|---------|
| `agGridRef` | `AgGridTableComponent<Department>` | AG Grid table; used to call `refreshGridData(true)` after mutations |

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `department` | `Department` | Model bound to dialog form |
| `saveMode` | `string` | `'POST'` or `'PUT'` |
| `isDialogOpen` | `boolean` | Dialog visibility |
| `isLoading` | `boolean` | Disables buttons during HTTP call |
| `columns` | `AgGridTableColumn<any>[]` | Column definitions built by `buildColumns()` |
| `gridId` | `string` | `'base-data-department'` — persists column state |
| `permissions` | `typeof Permissions` | Permission enum reference for template |
| `authUser` | `User` | Logged-in user; used as `sender_id`/`sender_name` in socket payloads |
| `pendingDeleteData` | `{ id; custom_id? } \| null` | Stores deleted row data before deletion for post-delete socket emit |

### Key Methods

| Method | Description |
|--------|-------------|
| `buildColumns()` | Returns `AgGridTableColumn[]` — is_active (boolean renderer), custom_id, name, created_at |
| `validateForm()` | Validates `department.name` is not empty |
| `saveDepartment()` | Validates and saves via POST or PUT; calls `processData()` then `triggerDepartmentNotification()` on success |
| `editDepartment(row)` | Sets `saveMode = 'PUT'`, loads row data, opens dialog |
| `newDepartment()` | Resets model, sets `saveMode = 'POST'`, opens dialog |
| `deleteClick(row)` | Stores row into `pendingDeleteData`; emits `IsDelete` with `Departments/${row.id}` |
| `processData(event?)` | Emits `refreshTable`; calls `agGridRef?.refreshGridData(true)`; if `pendingDeleteData` is set, emits delete socket and clears it |
| `CloseDialog()` | Resets model + validation state, closes dialog |
| `checkPermission(data)` | Wraps `rolePermissionService.hasPermission()` for template use |
| `triggerDepartmentNotification(event, dept)` | Emits socket event with `model_id`, `model_custom_id`, `sender_id`, `sender_name` |

### API Calls

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `Departments` (OData, server-side) | Fetch paginated/filtered departments |
| POST | `Departments` | Create department |
| PUT | `Departments(${id})` | Update department |
| DELETE | `Departments/${id}` | Delete department (via `app-delete-entity`) |

### Department Model
```typescript
interface Department {
  id?: number;
  name: string;
  is_active?: boolean;
  custom_id?: string;
  created_at?: string;
  updated_at?: string;
}
```

### Table Columns
`buildColumns()` returns:
- `is_active` — `AgGridBooleanCellRendererComponent`, width 90, not filterable
- `custom_id` — text, min 120
- `name` — text, min 180
- `created_at` — `toLocaleDateString()` formatter, not filterable

Sort default: `sortBy: "id"`, `sortDirection: "desc"` (newest first).

Edit and delete actions use `showEditButton` / `showDeleteButton` on `app-ag-grid-table` (permission-gated). No custom action cell renderer column.

---

## Services Injected

| Service | Usage |
|---------|-------|
| `CommonService` (as `http`) | POST / PUT calls |
| `ToastService` | UI toast messages |
| `RolePermissionService` | `hasPermission()` for button visibility |
| `SocketService` | Emits socket events on create/update/delete |
| `AuthService` | Reads logged-in user for notification sender info |

## Permissions

| Permission | Guards |
|-----------|--------|
| `BASE_DATA_DEPARTMENT` | Route / module access |
| `BASE_DATA_DEPARTMENT_CREATE` | New button visibility |
| `BASE_DATA_DEPARTMENT_EDIT` | Edit button per row |
| `BASE_DATA_DEPARTMENT_DELETE` | Delete button per row |
| `BASE_DATA_DEPARTMENT_CREATE_NOTIFICATION` | Receive create notifications |
| `BASE_DATA_DEPARTMENT_UPDATE_NOTIFICATION` | Receive update notifications |
| `BASE_DATA_DEPARTMENT_DELETE_NOTIFICATION` | Receive delete notifications |

## Validation Rules
- `name` — required (real-time on `(input)` + on submit)

---

## Real-Time Notification System

### Socket events emitted (Angular → node-server)

| Trigger | Socket event | Permission |
|---------|-------------|------------|
| POST success | `base-data-department:created` | `BASE_DATA_DEPARTMENT_CREATE_NOTIFICATION` |
| PUT success | `base-data-department:updated` | `BASE_DATA_DEPARTMENT_UPDATE_NOTIFICATION` |
| Delete success (`processData` + `pendingDeleteData`) | `base-data-department:deleted` | `BASE_DATA_DEPARTMENT_DELETE_NOTIFICATION` |

### Backend DB persistence (Laravel Observer)

`Backend/app/Observers/DepartmentObserver.php` — registered in `AppServiceProvider`.

> **Lodata gotcha**: `created`/`updated`/`deleted` Eloquent events do not fire reliably inside Lodata's DB transaction. Uses `saved()` + `wasRecentlyCreated` and `deleting()` instead.

| Observer method | Fires when | Dispatches |
|----------------|-----------|------------|
| `saved()` | After INSERT or UPDATE | `'created'` if `wasRecentlyCreated`, else `'updated'` |
| `deleting()` | Before DELETE | `'deleted'` |

### Flow
```
Angular POST/PUT/DELETE
  → success → triggerDepartmentNotification() → socketService.emit(event, payload)
  → node-server @SubscribeMessage handler → notificationService.broadcast*()
  → server.emit('notification:new', data) → all clients
  → NotificationComponent.fetchNotifications() → bell count updates
  → (DB) DepartmentObserver.saved()/deleting() → NotificationService.dispatch() → DB insert
```

---

## Key Relationships
- Department → used in `EmployeeFormComponent` as organizational classification
- Employees belong to one Department
- Department lookup for employee dropdown: `GET Departments?$filter=is_active eq true`

## Notes
- Migrated from `CustomGridTableComponent` (React/JSX) to `app-ag-grid-table` (AG Grid).
- `deleteClick` changed from `deleteClick($event.id)` to `deleteClick($event)` (full row) to capture `custom_id` for notification payload.
- `processData()` now also dispatches delete socket if `pendingDeleteData` is set.
