# APPROVER_LIST_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| TS file | `Frontend/src/app/modules/base-data-management/approver-management/approver-list/approver-list.component.ts` |
| HTML file | `Frontend/src/app/modules/base-data-management/approver-management/approver-list/approver-list.component.html` |
| Selector | `app-approver-list` |
| Component type | List + Detail (split-pane master/detail layout) |
| Grid library | AG Grid (`app-ag-grid-table`) — left pane OData server-side, right pane client-side static data |

### Purpose

`ApproverListComponent` is a split-pane master/detail admin screen for managing **Approval Types** (dynamic, CRUD-able master data — e.g. "HR Leave Request", "Sales Order Approver") and the employees assigned as approvers for each type. Left pane: paginated AG Grid of approval types (OData `ApprovalTypes` entity, backed by `Lodata::discover(ApprovalType::class)` on the Backend). Selecting a type loads its assigned approvers into the right pane, where `is_required` and `sequence_index` (approval order) are inline-editable, and employees can be assigned or removed.

This screen only manages assignment storage — it does **not** wire into any existing approve endpoints (leave/requisition/etc. approval remains permission-gated as before).

An `ApprovalType` can now optionally be linked from a `LeaveType` (`leave_types.approval_type_id`, nullable FK) — created/selected from the Leave Type form's "Approval Type" dropdown (see [`LEAVE_TYPE_FORM_COMPONENT_CONTEXT.md`](../../hr-management/leave-management/leave-type/LEAVE_TYPE_FORM_COMPONENT_CONTEXT.md)). This is metadata only for now: the leave-request approve flow still uses the existing supervisor→HR status columns, not this roster.

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `IsDelete` | `EventEmitter<any>` | Emits to `app-delete-entity` to trigger deletion confirmation for the selected approval type. |

---

## Data Sources

### `typeDataSource: AgGridTableODataSourceConfig`

```typescript
{
  type: 'odata',
  endpoint: 'ApprovalTypes',
  pageSize: 50,
  sortBy: 'name',
  searchFields: ['name'],
}
```

### `approverDataSource: AgGridTableODataSourceConfig`

```typescript
{
  type: 'odata',
  endpoint: '',
  staticData: true,   // client-side row model — not an OData/API fetch
  data: [],           // populated manually from GET approval-types/{id}/approvers
}
```

`approverDataSource.data` is spread-updated in `loadApprovers()` whenever a new approval type is selected, or after any inline edit / assign / remove.

---

## Toolbar / Display Configs

### `typeToolbarConfig`
`headerTitle: "Approval Types"`, search + row count on, `showNewButton` permission-guarded by `BASE_DATA_APPROVER_CREATE`.

### `approverToolbarConfig`
`headerTitle: "Approvers"`, `addButtonText: "Assign"`, `showNewButton` toggled true (permission `BASE_DATA_APPROVER_ASSIGN`) once a type is selected — opens the assign dialog via `(newButtonClick)`.

---

## Column Definitions

### `typeColumns`

| Field | Header | Notes |
|---|---|---|
| `is_active` | Active | `AgGridBooleanCellRendererComponent`; filter/sort disabled |
| `code` | Code | Uppercased on save (Backend `ApprovalType::setCodeAttribute` mutator) |
| `name` | Approval Type | `flex: 1` |

### `approverColumns`

| Field / colId | Header | Notes |
|---|---|---|
| `employee_no` | Employee ID | filter/sort disabled |
| `full_name` (colId) | Employee Name | `valueGetter` concatenates `first_name`/`last_name` |
| `is_required` | Required | `editor: { type: 'checkbox' }` — inline editable |
| `sequence_index` | Order | `editor: { type: 'integer', min: 0 }` — inline editable, approval order |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `selectedApprovalTypeId` | `number \| null` | `null` | Currently selected approval type; drives the right pane. |
| `selectedApprovalTypeName` | `string` | `''` | Display name of the selected type. |
| `approverRows` | `ApproverRow[]` | `[]` | Current assignment rows for the selected type (mirrors pivot data). |
| `assignedEmployeeIds` | `number[]` | `[]` | IDs already assigned — passed to the assign dialog to exclude from the picker. |
| `approvalType` | `ApprovalType` | `new ApprovalType()` | Form data for the type create/edit dialog. |
| `saveMode` | `string` | `saveMode.POST` | `POST` = create, `PUT` = edit (type dialog). |
| `open` | `boolean` | `false` | Type create/edit dialog visibility. |
| `isAssignOpen` | `boolean` | `false` | Assign-employees dialog visibility. |
| `seededApprovalTypeCodes` | `string[]` (private, readonly) | `['SR', 'INDENT']` | Codes for `ApprovalType` rows seeded/owned by the Backend seeder — see `isSeededApprovalType` below. |

---

## ViewChild

| Ref name | Type | Purpose |
|---|---|---|
| `typeTableRef` | `AgGridTableComponent<any>` | `refreshGridData(true)` called in `refreshTypeTable()`. |

---

## Methods

### `selectedRowData(row)`
Sets `selectedApprovalTypeId`/`Name`, enables the "Assign" toolbar button (permission-gated), calls `loadApprovers()`.

### `loadApprovers()`
GET `approval-types/{id}/approvers` (REST, not OData). Maps response rows (with `pivot.is_required`/`pivot.sequence_index`) into `ApproverRow[]`, updates `assignedEmployeeIds` and `approverDataSource.data`.

### `onApproverCellEdited(event)`
Bound to the right grid's `(cellEdited)`. Merges the edited field into the matching row, calls `saveApprovers()` with the full updated row list.

### `removeApprover(data)`
Row-level delete action on the right grid. Filters the removed employee out of `approverRows`, calls `saveApprovers()`.

### `saveApprovers(rows)` (private)
POSTs the complete current assignment list to `approval-type/employee-associate` (full-sync semantics — matches Backend's `sync()` call). Reloads via `loadApprovers()` on success or failure (failure reverts optimistic display).

### `newApprovalType()` / `editApprovalType(data)`
Reset/populate `approvalType`, set `saveMode`, open the type dialog.

### `deleteApprovalType(data)`
Emits `IsDelete` with `ApprovalTypes/{id}` for `app-delete-entity`.

### `openAssignDialog()`
Opens the assign dialog (only when a type is selected).

### `onAssignSaved()`
Closes the assign dialog, reloads the right pane.

### `refreshTypeTable()`
`typeTableRef?.refreshGridData(true)`.

### `isSeededApprovalType(row)`
`(row) => seededApprovalTypeCodes.includes(row?.code)`. Bound to the left grid's `[editDisabledFn]`/`[deleteDisabledFn]` (see [`AG_GRID_TABLE_CONTEXT.MD`](../../shared-components/AG_GRID_TABLE_CONTEXT.MD)) so the Edit/Delete buttons render but are disabled for the `SR`/`INDENT` approval types — those two are created by the Backend seeder and must stay in place; only their assigned approvers are editable via the right pane.

---

## API Calls

| HTTP | Endpoint | When | Payload |
|---|---|---|---|
| GET | `ApprovalTypes` (via AG Grid, OData) | Left grid load | OData server-side |
| GET | `approval-types/{id}/approvers` (REST) | Type row select / after any assignment change | — |
| POST | `ApprovalTypes` (OData) | Type dialog POST mode | `approvalType.toOdata()` |
| PUT | `ApprovalTypes({id})` (OData) | Type dialog PUT mode | `approvalType.toOdata()` |
| POST | `approval-type/employee-associate` (REST) | Inline edit / remove approver / assign (from the assign dialog) | `{ approval_type_id, employees: [{employee_id, is_required, sequence_index}] }` |
| DELETE | `ApprovalTypes({id})` (OData, via `app-delete-entity`) | Delete type | — |

---

## Services Injected

| Service | Methods Used |
|---|---|
| `CommonService` | `get()`, `post()` |
| `ToastService` | `show('edit' \| 'error')` |
| `RolePermissionService` | `hasPermission()` — guards New/Edit/Delete/Assign visibility |

---

## Key Business Logic

- **Right pane is not OData** — it's a REST endpoint returning pivot-joined data (`is_required`/`sequence_index` extra columns aren't OData-friendly), so `staticData: true` + manual fetch is used instead of the grid's built-in datasource fetching.
- **Full-sync on every write** — every edit, assign, or remove re-POSTs the *complete* current assignment list to `approval-type/employee-associate`; the Backend controller calls `$approvalType->employees()->sync($syncArray)`, so a partial payload would silently unassign anyone left out.
- **No enforcement wiring** — this screen is storage + admin UI only; existing approve endpoints (`LeaveController`, `RequisitionController`, etc.) are untouched and remain permission-gated, not assignment-gated.
- **Seeded approval types are UI-readonly, not backend-blocked** — `isSeededApprovalType()` only disables the left grid's Edit/Delete buttons for `SR`/`INDENT`. `ApprovalTypeController` and the OData delete endpoint still accept edit/delete requests for those rows if called directly; there is no server-side guard.
