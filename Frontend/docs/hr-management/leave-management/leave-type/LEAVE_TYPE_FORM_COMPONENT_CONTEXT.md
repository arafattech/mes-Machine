# LEAVE_TYPE_FORM_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| TS file | `Frontend/src/app/modules/hr-management/leave-management/leave-type/leave-type-form/leave-type-form.component.ts` |
| HTML file | `Frontend/src/app/modules/hr-management/leave-management/leave-type/leave-type-form/leave-type-form.component.html` |
| Selector | `app-leave-type-form` |

### Purpose
Create/edit dialog for a `LeaveType` (`Frontend/src/app/shared/model/leaveType.ts`), opened by `LeaveTypeListComponent` via `#leaveTypeForm` ViewChild.

## Inputs / Outputs

| Name | Direction | Purpose |
|---|---|---|
| `saveMode` | `@Input` | `'POST'` (create) / `'PUT'` (edit) |
| `leaveType` | `@Input` | Model bound to the form |
| `RefreshTable` | `@Output` | Emitted after a successful save |

## Fields
- **Leave Type Name** (`ui5-input`, required) — `checkValidation(event, 'name')`
- **Max Days Per Year** (`ui5-input type="Number"`, required, must be > 0) — `checkValidation(event, 'max_days')`
- **Approval Type** (`ui5-combobox`) — populated from `fetchApprovalTypes()` (GET `ApprovalTypes` OData, called in `ngOnInit`); optional, sets `leaveType.approval_type_id`. See [`APPROVER_LIST_COMPONENT_CONTEXT.md`](../../../base-data/approver-management/APPROVER_LIST_COMPONENT_CONTEXT.md) for how these types are created/managed.
- **Active** / **Paid** / **Document Required**, in that order (`ui5-switch` + `[(ngModel)]`, same convention as `product-management/item-form`'s switch row). `is_active` defaults `true`; `is_paid`/`document_required` default `false` — admin opts in per type. Paid/document-required are metadata flags only; document-required has no attachment-upload enforcement anywhere in the leave-request flow yet.

## Save
`save()` — POST `LeaveTypes` / PUT `LeaveTypes({id})` (OData) with `leaveType.toOdata()`. No custom Form Request on the backend (matches `ApprovalType`'s precedent) — validation is client-side plus DB constraints (unique `name`, not-null `max_days`).

## Services Injected
`CommonService`, `ToastService`.
