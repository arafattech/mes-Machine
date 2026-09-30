# APPROVER_ASSIGN_FORM_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| TS file | `Frontend/src/app/modules/base-data-management/approver-management/approver-assign-form/approver-assign-form.component.ts` |
| HTML file | `Frontend/src/app/modules/base-data-management/approver-management/approver-assign-form/approver-assign-form.component.html` |
| Selector | `app-approver-assign-form` |
| Component type | Employee picker dialog (mirrors `employee-group-form`) |
| Grid library | AG Grid (`app-ag-grid-table`) — OData, multi-select checkbox |

### Purpose

Employee picker dialog opened from `ApproverListComponent`'s "Assign" toolbar button. Lists active employees (OData `Employees`, excluding those already assigned to the currently selected approval type), lets the admin multi-select employees, and merges the newly-picked employees (default `is_required: true`, appended `sequence_index`) with the already-assigned list before POSTing the full set.

---

## Inputs / Outputs

| Name | Direction | Type | Purpose |
|---|---|---|---|
| `open` | Input (two-way via `openChange`) | `boolean` | Dialog visibility. |
| `approvalTypeId` | Input | `number \| null` | The approval type employees are being assigned to. |
| `excludeEmployeeIds` | Input | `number[]` | Employee IDs already assigned — excluded from the picker's OData filter. |
| `existingRows` | Input | `{id, is_required, sequence_index}[]` | Current assignment rows, merged with new picks on save. |
| `saved` | Output | `EventEmitter<void>` | Emitted after a successful assign; parent reloads the right pane. |

---

## Data Source

```typescript
{
  type: 'odata',
  endpoint: 'Employees',
  filter: 'is_active eq true',   // extended with `and id ne <id> and ...` per excludeEmployeeIds on open
  pageSize: 50,
  searchFields: ['employee_no', 'first_name', 'last_name'],
}
```

---

## Methods

### `ngOnChanges()`
Rebuilds `dataSource.filter` from `excludeEmployeeIds` whenever the dialog opens, so already-assigned employees don't reappear in the picker.

### `onRowSelect(selectedRows)`
Bound to the grid's `(selectionChanged)` (`selectionMode="Multiple"`). Stores checked row IDs in `selectedEmployeeIds`.

### `save()`
Builds the full employee list: `existingRows` (unchanged) + newly-selected employees (`is_required: true`, `sequence_index` continuing from `max(existingRows.sequence_index) + 1`). POSTs to `approval-type/employee-associate`. On success: emits `saved`, closes dialog.

### `closeDialog()`
Resets `open`/`loading`/`selectedEmployeeIds`, emits `openChange`.

---

## API Calls

| HTTP | Endpoint | When | Payload |
|---|---|---|---|
| GET | `Employees` (via AG Grid, OData) | Dialog open | OData server-side, `filter` excludes already-assigned IDs |
| POST | `approval-type/employee-associate` (REST) | `save()` | `{ approval_type_id, employees: [...existing, ...newly selected] }` |

---

## Services Injected

| Service | Methods Used |
|---|---|
| `CommonService` | `post()` |
| `ToastService` | `show('add' \| 'error')` |

---

## Key Business Logic

- **Full-sync, not append-only** — the Backend endpoint replaces the entire assignment set per request, so this component always sends `existingRows` alongside the new picks; omitting them would unassign every current approver.
- **`id ne <id>` exclusion filter** — since assignment is a many-to-many pivot (not a denormalized `employee.group_id`-style column), "not already assigned" can't be expressed as a single OData property filter; instead the filter is built from the explicit `excludeEmployeeIds` list passed down from the parent.
