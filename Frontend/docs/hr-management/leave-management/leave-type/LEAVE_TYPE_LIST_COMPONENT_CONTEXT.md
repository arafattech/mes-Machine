# LEAVE_TYPE_LIST_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| TS file | `Frontend/src/app/modules/hr-management/leave-management/leave-type/leave-type-list/leave-type-list.component.ts` |
| HTML file | `Frontend/src/app/modules/hr-management/leave-management/leave-type/leave-type-list/leave-type-list.component.html` |
| Selector | `app-leave-type-list` |
| Component type | Single list + dialog form (mirrors `base-data-management/count-type-management`'s pattern) |
| Route | `/hr-management/leave-management/leave-type` — permission `HR_LEAVE_TYPE` (child of the `leave-management` route, alongside `leave-request`, `leave-transfer`, `calender`) |
| Sidebar | Under "Leave Management" submenu → "Leave Type" |

### Purpose

Admin CRUD screen for **Leave Types** — previously a static seeder (`Backend/database/seeders/LeaveTypesSeeder.php`, now removed) with exactly two hardcoded rows (Medical/14 days, Casual/13 days). Leave types are now fully dynamic: any number of types can be created, each with a name, a max-days-per-year cap, paid/unpaid and document-required flags, and an optional link to an `ApprovalType` (see [`APPROVER_LIST_COMPONENT_CONTEXT.md`](../../../base-data/approver-management/APPROVER_LIST_COMPONENT_CONTEXT.md)) — that link is metadata only for now, not wired into actual leave-request approval gating.

Lives under HR Management → Leave Management (not Base Data Management) since leave types are consumed almost entirely by the leave-request/leave-section apply flows there.

## Data Source

```typescript
dataSource: AgGridTableODataSourceConfig<LeaveType> = {
  type: 'odata',
  endpoint: 'LeaveTypes',
  expand: 'approvalType',
  searchFields: ['name'],
  pageSize: 40,
  scrollPagination: true,
};
```

## Columns
`is_active` (boolean renderer, leftmost — matches `product-management/item-list` convention), `name`, `max_days`, `is_paid` (boolean renderer), `document_required` (boolean renderer), `approval_type.name` (via `$expand=approvalType`), `created_at`.

`toolbarConfig.showSegmentButton: true` — gives the shared grid's built-in All/Active/Inactive segmented filter (`is_active eq true/false` OData filter), same mechanism used by `product-management/item-list`. No manual filter wiring needed.

## Methods
- `newLeaveType()` / `editLeaveType(data)` — reset/populate `leaveType`, set `saveMode`, open `LeaveTypeFormComponent` via `leaveTypeFormRef`.
- `deleteClick(id)` — emits `IsDelete` with `LeaveTypes/{id}` for `app-delete-entity`.
- `processData()` — refreshes the grid after a save/delete.

## Services Injected
`RolePermissionService` — gates New/Edit/Delete via `HR_LEAVE_TYPE_CREATE`/`_EDIT`/`_DELETE`.

## Backend
No dedicated controller — `LeaveTypes` is exposed via generic Lodata OData CRUD (`Backend/app/Models/LeaveType.php`), same pattern as `ApprovalType`. Server-side guards are DB-level only: unique `name`, FK `approval_type_id → approval_types.id` (`nullOnDelete`). The day-limit (`max_days`) is enforced dynamically in `Backend/app/Services/hrModule/LeaveService.php::store()` — no hardcoded per-ID map.
