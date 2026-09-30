# HR Management — Black List

## Files
```
black-list-management/
└── black-list/
    ├── black-list.component.ts
    ├── black-list.component.html
    └── black-list.component.scss
```

## Route
`/hr-management/black-list-management/black-list` — `BlackListComponent`, permission `HR_BLACK_LIST` (parent + child route both gate on this same permission — no separate parent-group permission). New/Create additionally gated by `HR_BLACK_LIST_CREATE`.

## Purpose
HR maintains a blacklist of employees (reason + rich-text remark). Creating a blacklist entry also flips the employee's `is_active` to `false` on the backend. A blacklisted employee can later be **revoked** (reactivated) with a revoke reason, which flips `is_active` back to `true`.

---

## BlackListComponent

### Selector
`app-black-list`

### Outputs (@Output)

| Output | Type | Purpose |
|--------|------|---------|
| `RefreshTable` | `EventEmitter<void>` | Emitted after a successful create/edit save |
| `IsDelete` | `EventEmitter<any>` | Wired to `<app-delete-entity>` in the template, but **nothing in this component ever calls `.emit()` on it** — dead wiring, no delete action exists on the grid (see Notes) |

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `dataSource` | `AgGridTableODataSourceConfig` | OData `EmployeeBlacklists`, expand `user,employee` |
| `toolbarConfig` | `AgGridTableToolbarConfig` | `showNewButton` set dynamically in `ngOnInit` from `HR_BLACK_LIST_CREATE`; has 3 segment buttons (`All`/`Reverted`/`Blacklisted` — relabeled from generic `Inactive`/`Active` to match this entity's actual `status` semantics) defined but **no `(segmentButtonChange)` handler wired in the template** — clicking them still does not filter the grid (see Notes) |
| `BlacklistTable` | `AgGridTableColumn<any>[]` | Built by `buildColumns()` in `ngOnInit` |
| `blackList` | `BlackList` | Model bound to the create/edit dialog |
| `dialogMode` | `'VIEW' \| 'REVOKE'` | Controls the view/revoke dialog's Revoke-Reason field readonly state + footer Submit visibility |
| `isOpenDialog` | `boolean` | Create/Edit dialog visibility |
| `isViewOpen` | `boolean` | View/Revoke dialog visibility |
| `saveMode` | `'POST' \| 'PUT'` | Create vs edit (create/edit dialog only) |
| `employeeList` | `Employee[]` | Active employees, loaded in `initializeEmployees()`, feeds the Select-Employee combobox |
| `employeeName` | `string` | Display string `"{employee_no} - {first_name} {last_name}"` shown in both dialogs |
| `htmlContent` | `string` | Rich-text remark, bound to `app-angular-editor` |
| `viewBlackListData` | `BlackList` | Declared but never populated/read anywhere — dead property (see Notes) |

### Row Actions (Actions column)

Added via a custom `field: 'actions'` column with `AgGridActionCellRendererComponent` — **not** the framework's built-in `[showAction]` mechanism (`[showAction]="false"` in the template; adding a second `actions` source via `[showAction]="true"` produces a duplicate action column — see the Reminder doc's known pitfall).

| Action id | Icon | Visible when | Calls |
|-----------|------|--------------|-------|
| `revoke` | `media-reverse` | `!row.status` (still blacklisted) AND `HR_BLACK_LIST_CREATE` | `viewBlackList(row, 'REVOKE')` |
| `view` | `information` | always | `viewBlackList(row, 'VIEW')` |
| `edit` | — | **commented out** in source | `EditBlackList(row)` handler still exists and is still wired in `onAction`, but there is no live action entry to trigger it — edit is currently unreachable from the UI |

Before this action column existed, `viewBlackList`/`EditBlackList`/`revokeBlackList` were fully implemented but had **zero UI trigger** — no `(rowClick)` on the grid, no action column. The grid was a dead end for anything except creating new records.

### Key Methods

| Method | Description |
|--------|-------------|
| `buildColumns()` | Employee ID/First/Last Name (via `employee.*` valueGetters), Reason, Added by (`user.name`), Revoke Reason, Status badge, Created On, Actions |
| `newBlackList()` | Opens create dialog, `saveMode = POST` |
| `EditBlackList(data)` | Opens create/edit dialog in PUT mode, populates `employeeName`, sets `htmlContent = data.remarks` — currently unreachable from the grid (see above) |
| `viewBlackList(data, mode)` | Opens the view/revoke dialog; `mode` defaults to `'VIEW'` |
| `saveBlackList()` | Validates → POST/PUT `EmployeeBlacklists` → **on success**, chains a second call: POST `employee/blacklist/${employee_id}` to flip the employee to inactive |
| `revokeBlackList()` | PUT `EmployeeBlacklists/${id}` `{ status: true, revoke_reason }` → on success chains `revokedata()` |
| `revokedata(data)` | POST `employee/blacklist-revoked/${employee_id}` to reactivate the employee; **note**: called with `this.viewBlackListData` from `revokeBlackList()`, which is never populated (always `new BlackList()` — see Notes on the `${data.employee_id}` bug this causes) |
| `initializeEmployees()` | GET `Employees?$top=10000&$filter=is_active eq true` → `employeeList` |
| `validateForm()` / `checkValidation()` | Reason + remark (rich text) required |
| `CloseDialog()` | Resets both dialogs' state |

### API Calls

| Method | Endpoint | OData | Purpose |
|--------|----------|-------|---------|
| GET | `EmployeeBlacklists` | ✓ | Grid list |
| GET | `Employees?$top=10000&$filter=is_active eq true` | ✓ | Employee picker |
| POST | `EmployeeBlacklists` | ✓ (3rd arg `true`) | Create |
| PUT | `EmployeeBlacklists(${id})` | ✓ | Edit (create/edit dialog) |
| PUT | `EmployeeBlacklists/${id}` | ✓ (3rd arg `true`) | Revoke — **note the slash, not parens** (inconsistent with the edit call two lines above, both go through the same `commonService.put(url, payload, true)`) |
| POST | `employee/blacklist/${employee_id}` | ✗ (REST) | Deactivate employee after blacklisting |
| POST | `employee/blacklist-revoked/${employee_id}` | ✗ (REST) | Reactivate employee after revoke |

### OData Expand
`user,employee`

### Status Column
`status` is a **boolean** on the backend (`false` = blacklisted, `true` = reverted) but the column derives a string for the badge: `data?.status ? 'reverted' : 'blacklisted'`, rendered via `AgGridStatusBadgeComponent`.

---

## BlackList Model
`@app/modules/hr-management/shared/models/blackList`

```typescript
{ id, employee_id, is_active = true, custom_id, remarks, added_by, reason = '', created_at, updated_at, status = false, revoke_reason }
```
`toOdata()` is a no-op spread (`{...this}`) — no field renaming/stripping before submit, unlike some other models in this app.

---

## Services Injected

| Service | Usage |
|---------|-------|
| `CommonService` | All HTTP calls |
| `RolePermissionService` | `hasPermission()` — gates New button + revoke/edit row actions |
| `AuthService` | `user()` — sets `added_by` on create |
| `ToastService` | Success/error notifications |
| `DateFormatterService` | Formats `created_at` column |

## Notes — things a future change here needs to know

1. **Segment buttons don't filter anything.** `toolbarConfig` defines `button1Text`/`button2Text`/`button3Text` (`All`/`Reverted`/`Blacklisted`, relabeled from the generic `All`/`Inactive`/`Active` to match this entity's `status` field) and `showSegmentButton: true`, but the template still has no `(segmentButtonChange)` binding — clicking them is a no-op regardless of label. The relabel makes the broken buttons more misleading, not less (a user now expects "Reverted" to filter to `status eq true`). Compare to `reminder.component.ts`'s `segmentButtonChange()` pattern if wiring this up for real.
2. **`revokedata()`'s employee-id bug**: `revokeBlackList()` calls `this.revokedata(this.viewBlackListData)`, but `viewBlackListData` is a `BlackList` instance that is **never assigned** anywhere in the component (always its default `new BlackList()`). So `revokedata()`'s `${data.employee_id}` is always `undefined`, meaning the REST call `POST employee/blacklist-revoked/undefined` likely 404s or silently no-ops server-side — the employee is probably never actually reactivated even though the toast says success. Should likely be `this.revokedata(this.blackList)` instead (the model actually populated by `viewBlackList()`).
3. **`IsDelete` is fully wired to `<app-delete-entity>` in the template but nothing emits on it** — there is no delete action on the grid. If one is added later, emit a path string (e.g. `` `EmployeeBlacklists/${id}` ``) — `DeleteEntityComponent` uses the emitted value directly as the delete URL.
4. **`edit` action is commented out**, not removed — `EditBlackList()` and its `onAction` branch are both still live code, just unreachable. Uncomment the action entry to re-enable, or delete the dead handler branch/method if edit is intentionally retired.
5. **Mixed OData URL styles** for the same entity in the same file: `EmployeeBlacklists(${id})` (edit) vs `EmployeeBlacklists/${id}` (revoke). Both currently work (lodata.io accepts both forms) but keep an eye out if the backend routing ever gets stricter.
