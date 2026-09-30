# HR Management — Leave Management (HR View)

## Files
```
leave-management/
└── leave-request/
    ├── leave-request.component.ts
    └── leave-request.component.html
```

## Route
`/hr-management/leave-management/leave-request` — `LeaveRequestComponent`
Parent path `leave-management` — permission `HR_LEAVE`; child `leave-request` — permission `HR_LEAVE_REQUEST`. Guarded by `PermissionGuard`. Sibling children under `leave-management`: `holiday-swap` (`HR_HOLIDAY_SWAP`), calendar-management (`HR_CALENDAR`).

## Purpose
HR-side grid of all employee leave requests, filtered to supervisor-approved leaves (`filterApproved = "supervisor_status eq 'approved'"`). Two dialogs:
- **View Details** (read-only wizard: Leave Details → Attachment → Approvers) — HR/approvers inspect a request and, if they're the current step's approver, act on it.
- **Apply Leave** (HR applies on behalf of any employee — department/employee picker → Leave Details → Attachment (if required) → Approvers preview).

Approval is no longer a flat `hr_status`/`final_status` PUT — it's driven by the same per-person **approver chain** (`ApprovalType` assigned to the `LeaveType`) used by store/purchase requisitions. See `ApprovalTypeController`/`LeaveApprovalController` (Backend) and [`APPROVER_LIST_COMPONENT_CONTEXT.md`](../../../base-data/approver-management/APPROVER_LIST_COMPONENT_CONTEXT.md).

---

## LeaveRequestComponent

### Selector
`app-leave-request`

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `LeaveRequestTable` | `AgGridTableColumn<any>[]` | Column defs built by `buildColumns()` |
| `dataSource` | `AgGridTableODataSourceConfig` | OData `LeaveRequests`, expand `leavetype,weekeend,employee($expand=department),supervisor,createdBy,leaveDates($count=true)` |
| `filterApproved` | `string` | `"supervisor_status eq 'approved'"` — base filter |
| `LeaveRequest` | `LeaveRequests` | Model bound to the View dialog |
| `isViewOpen` / `isReadOnly` | `boolean` | View dialog open state (always read-only) |
| `currentStep` | `number` | View dialog wizard step |
| `leaveApprovalSteps` | `LeaveApprovalStep[]` | Per-person checklist for the current `LeaveRequest`, loaded by `loadLeaveApprovalSteps()` |
| `approvalProgress` | `Map<number, {approved, rejected, total}>` | Batched per-row progress for the grid's Status/Approval Progress columns, keyed by leave request id |
| `applyOpen` / `applyLoading` | `boolean` | Apply Leave dialog state |
| `applyCurrentStep` | `number` | Apply dialog wizard step |
| `applyApprovalPreview` | `ApproverPreviewRow[]` | Read-only approver preview for the Apply wizard (looked up by `LeaveType`, since no `LeaveRequest` exists yet) |
| `selectedEmployee` / `employeeList` / `departments` | — | Department → employee picker for HR applying on someone's behalf |
| `attachmentUploadRef` | `AttachmentUploadComponent` | Apply wizard's attachment step |
| `viewAttachmentUploadRef` | `AttachmentUploadComponent` | View wizard's attachment step |
| `leaveTypes` | `any[]` | From `LeaveTypes` OData — carries `max_days`, `is_paid`, `document_required`, `approval_type_id` |

### Key Methods

| Method | Description |
|--------|-------------|
| `buildColumns()` | Leave type, employee name, employee ID, department, created by, supervisor first/last name, total days (`leaveDates@count`), **Status** (`approval_status`, `AgGridStatusBadgeComponent`), **Approval Progress** (`approval_progress`, `AgGridApprovalProgressCellRendererComponent`), applied on, action (info only) |
| `viewLeave(data)` | Opens the View wizard at step 1; loads calendar data; if `hasApprovalChain`, calls `loadLeaveApprovalSteps()`; always loads the Attachment step's files via `viewAttachmentUploadRef.loadInputImages()` |
| `hasApprovalChain` (getter) | `!!this.LeaveRequest.leavetype?.approval_type_id` |
| `viewAttachmentStepIndex` | `readonly` constant `2` |
| `viewApproversStepIndex` | `readonly` constant `3` |
| `viewMaxStep` | `readonly` constant `3` |
| `goToStep`/`nextStep`/`prevStep`/`onWizardStepChange` | View wizard navigation, bounded by `viewMaxStep` |
| `loadLeaveApprovalSteps()` | GET `leave-requests/{id}/approvers` (cache-busted) → builds `leaveApprovalSteps[]` sorted by `pivot.sequence_index`; flags `isCurrentStep`/`isCurrentUser` |
| `onGridDataLoaded(data)` | Bound to `(processData)`/`(moreRowsLoaded)` — batches the visible rows' ids into one GET `leave-requests/progress?ids=...` call, fills `approvalProgress`, force-refreshes the two status columns |
| `getApprovalStatus(id)` | Derives `PENDING`/`APPROVED`/`REJECTED` from `approvalProgress` for a row |
| `newLeave()` | Opens the Apply dialog (department/employee picker + wizard), resets all apply-wizard state |
| `validateApplyForm()` | Employee, leave type, reason, dates required; if `requiresDocumentForApply` and no file staged, jumps to the Attachment step and blocks submit |
| `saveLeaveRequest()` | POST `hrm/leave-requests` → `mediaService.setId(res.id)` (uploads staged attachment) → emits `hrm-leave:applied` socket event → refresh grid → close |
| `requiresDocumentForApply` (getter) | `true` when the selected leave type's `document_required` is set — still drives `showAttachmentErrorForApply`/`validateApplyForm()`'s required-document check, no longer hides the step |
| `applyAttachmentStepIndex`/`applyApproversStepIndex`/`applyMaxStep` | `readonly` constants `2`/`3`/`3` — both wizards always render all 3 steps now (see "Wizard Steps" below); `hasApprovalChainForApply` still gates whether `loadApplyApprovalPreview()` fetches real data (empty list otherwise, shown as "No approvers configured yet") |
| `loadApplyApprovalPreview()` | GET `approval-types/{id}/approvers` — read-only preview of who will approve, keyed by the selected `LeaveType`'s `approval_type_id` (no `LeaveRequest` id exists yet) |
| `CloseDialog()` / `CloseApplyDialog()` | Reset dialog state |

### API Calls

| Method | Endpoint | OData | Purpose |
|--------|----------|-------|---------|
| GET | `LeaveRequests` | ✓ | Paginated list |
| GET | `LeaveTypes` | ✓ | Leave type options |
| GET | `Departments?$filter=is_active eq true` | ✓ | Apply dialog department picker |
| GET | `Employees?$filter=...` | ✓ | Apply dialog employee picker (debounced search) |
| GET | `hrm/employee-weekends?employee_id=X` | ✗ | Calendar weekend dates |
| GET | `hrm/holidays?year=YYYY` | ✗ | Holiday dates |
| GET | `hrm/leave-taken?employee_id=X` | ✗ | Already-taken leave dates |
| GET | `HolidayTypes` | ✓ | Holiday type colors |
| GET | `leave-requests/progress?ids=...` | ✗ | Batched approval progress for grid rows |
| GET | `leave-requests/{id}/approvers` | ✗ | Per-person approval checklist for the View wizard |
| GET | `approval-types/{id}/approvers` | ✗ | Read-only approver preview for the Apply wizard |
| POST | `hrm/leave-requests` | ✗ | Apply on behalf of selected employee |
| POST | `image-upload` (via `AttachmentUploadComponent`) | ✗ | Attachment upload, `model=LeaveRequest` |

### View Dialog — Wizard Steps
All 3 steps are **always rendered** (no `*ngIf` gating) — the wizard nav always shows Leave Details / Attachment / Approvers regardless of whether this request has an approval chain.
1. **Leave Details** — read-only leave type/calendar/reason. Unconditional "Next".
2. **Attachment** (`viewAttachmentStepIndex`) — `app-attachment-upload` bound to `model="LeaveRequest" apiUrl="LeaveRequests" [id]="LeaveRequest.id" [isEdit]="true"`; shows the file uploaded at apply time (name, upload date, size) with Download. "Next" always shown (no longer gated by `hasApprovalChain`).
3. **Approvers** (`viewApproversStepIndex`) — per-person checklist from `leaveApprovalSteps`, colored by status, or "No approvers configured yet" when `hasApprovalChain` is false; footer Approve/Reject shown when `canActOnLeaveApprovalStep` (current user is the pending current-step approver).

### Apply Dialog — Wizard Steps
All 3 steps are **always rendered** (no `*ngIf` gating), same reasoning as the View dialog.
1. **Leave Details** — department/employee picker, leave type, calendar, reason.
2. **Attachment** — same `AttachmentUploadComponent`, staged locally (no `LeaveRequest.id` yet) until `mediaService.setId()` fires post-save. `requiresDocumentForApply` still forces the "at least one file" validation on submit, it just no longer hides the step beforehand.
3. **Approvers preview** — read-only list from `applyApprovalPreview`, or "No approvers configured yet" when the selected leave type has no `approval_type_id`.

### Dialog Sizing — Fixed, Not Per-Step
Both dialogs use a **fixed** `h-[86vh]` on `ui5-dialog`, with the inner `ui5-busy-indicator`/`ui5-wizard` also pinned to `h-[72vh]`. Each wizard step's content is wrapped `<div class="h-full flex flex-col">` → content area `flex-1 min-h-0` (scrolls internally if tall) → button row `shrink-0` pinned at the bottom. This keeps the dialog the same size and the Next/Back button position stable across every step — letting the dialog auto-size per step (`max-h` instead of a fixed `h-`) was tried and reverted: it made the dialog visibly shrink/grow when switching to a shorter/taller step (e.g. collapsing to a small box on the Attachment step), which is the bug this structure fixes. The Reason editor (`reasonEditorConfig`) height was also trimmed from `28rem` to `20rem` so the Leave Details step's content fits inside the fixed `72vh` box without needing internal scroll on typical screens. The Attachment step's upload box is `flex-1 min-h-0` (fills the step, not a fixed `h-64`/`h-96` box) — `AttachmentUploadComponent` is `h-full`-based internally and scrolls its own file list if needed, so it no longer needs an outer scrollbar either.

### Real-Time Notification (Socket Emit)

| Event | Trigger |
|-------|---------|
| `hrm-leave:applied` | `saveLeaveRequest()` on successful POST |
| `hrm-leave:hr-approved` / `hrm-leave:hr-rejected` | Emitted **backend-side** by `LeaveApprovalController::notifyOnDecision()` when the approval chain finalizes, not by this component directly |

### Backend
`Backend/app/Http/Controllers/LeaveApprovalController.php` — `approvers()`, `approve()`/`reject()` → `recordDecision()`, `finalizeLeaveRequestIfNeeded()`, `notifyOnDecision()`, `progress()` (the batch endpoint backing every leave grid's Approval Progress column — groups by each request's own resolved `ApprovalType`, since rosters vary per `LeaveType`, unlike SR/Indent's fixed code).

---

## Services Injected

| Service | Usage |
|---------|-------|
| `CommonService` | All HTTP calls |
| `RolePermissionService` | Permission checks |
| `AuthService` | Current user |
| `SocketService` | Real-time notification emit |
| `MediaService` | Signals the staged `AttachmentUploadComponent` to upload once a `LeaveRequest` id exists |
| `DateFormatterService` | `created_at` column formatting |

## Notes
- `ui5-toolbar` + `ui5-toolbar-button` removed from dialog footers — caused `...` overflow. Use plain `div[slot=footer]` with `ui5-button`.
- `isReadOnly = true` always set in `viewLeave()` — View dialog never edits leave details; only approve/reject acts on the request.
- `agGridRef.refreshGridData(true)` called after approve/reject and after applying, to reload row data.
- Status/Approval Progress columns are `sortable: false, filter: false` — they're derived client-side from the batched `leave-requests/progress` call, not real OData columns.
