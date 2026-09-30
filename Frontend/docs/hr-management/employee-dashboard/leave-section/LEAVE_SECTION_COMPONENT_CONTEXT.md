# HR Management — Employee Dashboard: Leave Section

## Files
```
employee-dashboard/
└── leave-section/
    ├── leave-section.component.ts
    ├── leave-section.component.html
    └── view-apply/
        ├── view-apply.component.ts    ← approver view/approve/reject widget
        └── view-apply.component.html
```

## Purpose
Employee-facing leave request panel with full CRUD (apply/edit/view/delete). Not currently wired into
`employee-dashboard.component.html` — the dashboard's My Leave tab renders its own inline, read-only
`app-ag-grid-table` instead (see [`EMPLOYEE_DASHBOARD_COMPONENT_CONTEXT.md`](../EMPLOYEE_DASHBOARD_COMPONENT_CONTEXT.md#inline-grids-notice--payroll--asset--my-leave--employee-request--attendance)).
This component still exists and is unchanged in that sense; it just has no current caller in this codebase —
keep it in mind as the place to restore Apply/Edit/Delete behavior if the dashboard's read-only view is ever
upgraded back to full CRUD.

The `view-apply/` subfolder is a **separate** widget for viewing/approving/rejecting leave requests via the
same per-person approver chain used everywhere else in Leave Management — also currently uncalled from the
dashboard (its Employee Request tab is an inline read-only grid too, see the same section above). See its own
section below.

---

## LeaveSectionComponent

### Selector
`app-leave-section`

### Inputs / Outputs

| Name | Direction | Purpose |
|------|-----------|---------|
| `employee` | `@Input` | Employee object (must have `id`, `joining_date`, `leaves`) |
| `refreshTable` | `@Output` | Emits after save/delete to parent |
| `IsDelete` | `@Output` | `EventEmitter<any>` — emits row/path to `app-delete-entity` for deletion |
| `updateCalendar` | `@Output` | Emits `string[]` of dates to calendar component |

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `leaveColumns` | `AgGridTableColumn<any>[]` | Built by `buildLeaveColumns()` |
| `dataSource` | `AgGridTableODataSourceConfig` | OData `LeaveRequests`, expand `leavetype,employee,supervisor,weekeend`, sorted `created_at desc` (newest applied first) |
| `open` | `boolean` | Apply/Edit/View dialog open state |
| `selectedTab` | `'details' \| 'attachment'` | Which `ui5-tab` is active inside the dialog |
| `isReadOnly` | `boolean` | `true` when `saveMode === GET` (view only) |
| `saveMode` | `string` | `POST` / `PUT` / `GET` — controls dialog header + submit visibility |
| `attachmentUploadRef` | `AttachmentUploadComponent` | The dialog's Attachment tab uploader |
| `attachmentSubmitAttempted` | `boolean` | Set once user tries to submit without a required attachment — drives `showAttachmentError` |
| `approvalProgress` | `Map<number, {approved, rejected, total}>` | Batched per-row progress for the grid's Status/Approval Progress columns |
| `preSelectedLeaveDays` | `string[]` | On edit: this leave's own already-saved dates, seeded into the calendar as the initial selection (toggleable, not locked) |
| `selectedLeaveDays` | `string[]` | Full current calendar selection (own dates kept/toggled + any newly added) — submitted as-is to the API, since PUT replaces a leave's date set wholesale |
| `takenLeaveDates` | `string[]` | Disabled dates in calendar |
| `calendarSpecialDates` | `SpecialDate[]` | Weekend + holiday + pending/approved leave dates with colors |
| `htmlContent` | `string` | Rich text reason (bound to `app-angular-editor`) |
| `leaveTypes` | `any[]` | From `LeaveTypes` OData — each row carries `max_days`, `is_paid`, `document_required`, `approval_type_id` (see [`LEAVE_TYPE_LIST_COMPONENT_CONTEXT.md`](../../leave-management/leave-type/LEAVE_TYPE_LIST_COMPONENT_CONTEXT.md)) |

### Key Methods

| Method | Description |
|--------|-------------|
| `buildLeaveColumns()` | Leave type, employee name, employee ID, supervisor name, total days, **Status** (`approval_status`, `AgGridStatusBadgeComponent`), **Approval Progress** (`approval_progress`, `AgGridApprovalProgressCellRendererComponent`), applied on, actions (edit/view/delete) |
| `newLeave()` | Opens dialog in POST mode; resets `selectedTab='details'`, `attachmentSubmitAttempted`, `isReadOnly`; calls `fetchHolidayTypes()`, `fetchPendingApprovedLeaveDates()` |
| `editLeave(data)` | Opens dialog in PUT mode; loads existing leave dates as `preSelectedLeaveDays`; calls `fetchPendingApprovedLeaveDates()` so other leave requests' dates are disabled on the calendar too |
| `viewLeave(data)` | Opens dialog in GET mode (read-only) |
| `onTabSelect(event)` | Sets `selectedTab`; if switching to Attachment on an existing request, calls `attachmentUploadRef.loadInputImages()`. **Calls `event.stopPropagation()` first** — see "Dialog-closing bug" below |
| `requiresDocument` (getter) | `true` when the selected leave type's `document_required` is set — forces at least one attachment before submit |
| `showAttachmentError` (getter) | `attachmentSubmitAttempted && requiresDocument && !attachmentUploadRef?.fileCount` — drives a closable `ui5-message-strip` in the Attachment tab |
| `saveLeaveRequests()` | Validates → POST `hrm/leave-requests` or PUT `hrm/leave-requests/${id}` → `mediaService.setId(...)` uploads the staged attachment |
| `fetchPendingApprovedLeaveDates()` | GET `LeaveRequests` filtered to non-rejected for this employee; populates `preSelectedLeaveDays` + `calendarSpecialDates` (yellow = pending, blue = approved); emits `updateCalendar` |
| `onDateSelectionChange(event)` | `selectedLeaveDays` = event as-is (calendar's live toggled selection, own dates included) |
| `validateForm()` | Checks leave type, reason, selected dates, leave limits; if `requiresDocument` and no file staged, sets `attachmentSubmitAttempted = true` and jumps `selectedTab = 'attachment'` |
| `validateMedicalCasualLimit()` | Generic day-limit check — reads the selected leave type's `max_days` from `leaveTypes[]` (no hardcoded type IDs) |
| `PendingLeaveRequ(typeId, type)` | Blocks apply if same type already has pending request |
| `onGridDataLoaded(data)` | Bound to `(processData)`/`(moreRowsLoaded)` — batches visible row ids into one GET `leave-requests/progress?ids=...` call, fills `approvalProgress`, force-refreshes the two status columns |
| `getApprovalStatus(id)` | Derives `PENDING`/`APPROVED`/`REJECTED` from `approvalProgress` for a row |
| `fetchWeekends()` | GET `EmployeeHolidaySwaps?$filter=employee_id eq X and type eq 'WEEKEND'` first, then GET `hrm/employee-weekends?employee_id=X` — see "Holiday-swap remap" below |
| `fetchHolidays()` | GET `hrm/holidays?year=YYYY` |
| `fetchHolidayTypes()` | GET `HolidayTypes` OData |
| `fetchTakenLeaveDates()` | GET `hrm/leave-taken?employee_id=X` |
| `mergeCalendarDates()` | Dedup taken + weekend + holiday → `takenLeaveDates` |
| `CloseDialog()` | Resets all dialog state (including `attachmentUploadRef.fileArr`/`fileCount`), closes |

### Action Column
Edit icon → `editLeave(row)`, visible only when `canEditOrDelete(row.id)`. Info icon → `viewLeave(row)`, visible otherwise. Delete icon → `IsDelete.emit('LeaveRequests/${row.id}')`, visible only when `canEditOrDelete(row.id)`.

`canEditOrDelete(id)` = status is `PENDING` (via `getApprovalStatus`, same source as the Status badge — derived from `leave-requests/progress`, not the legacy `supervisor_status` column, which no longer tracks the multi-approver flow) **and** `approvalProgress.get(id).approved === 0` (no approver has signed off yet). Once even one required approver approves — progress like `1/2` — the request is locked from further edit/delete even though it's still showing PENDING overall, since part of the approval chain has already acted on the leave as originally submitted. `onGridDataLoaded()` force-refreshes the `actions` column alongside `approval_status`/`approval_progress` once progress data arrives.

### Dialog Structure — Tabs, Not Wizard Steps
Unlike the View dialogs in `leave-request.component`/`view-apply.component` (which use a `ui5-wizard` with an
Attachment **step**), this component's Apply/Edit/View dialog is a flat `ui5-tabcontainer` with exactly two
**tabs**, both always visible/unconditional:

```html
<ui5-tabcontainer (tab-select)="onTabSelect($event)">
  <ui5-tab id="details" text="Leave Details" [selected]="selectedTab === 'details'"> ... </ui5-tab>
  <ui5-tab id="attachment" text="Attachment" [selected]="selectedTab === 'attachment'">
    <div class="w-full h-full flex flex-col gap-2">
      <div *ngIf="showAttachmentError">
        <ui5-message-strip design="Critical" (ui5Close)="attachmentSubmitAttempted = false">
          This leave type requires at least one attached document.
        </ui5-message-strip>
      </div>
      <div class="flex-1 min-h-0">
        <app-attachment-upload #attachmentUploadRef model="LeaveRequest" apiUrl="LeaveRequests"
          [id]="LeaveRequest.id ?? null" [isEdit]="saveMode === PUT || saveMode === GET" [isDisable]="isReadOnly">
        </app-attachment-upload>
      </div>
    </div>
  </ui5-tab>
</ui5-tabcontainer>
```

There is no Approvers step here — this dialog is the employee's own self-service apply/edit/view, not an
approver's decision screen (that's `ViewApplyComponent`, below).

### Dialog Sizing
`ui5-dialog` is `h-[86vh]` (fixed), with the inner `ui5-busy-indicator` and `ui5-tabcontainer` also stretched to
`h-[72vh]`/`h-full`. The Attachment tab's upload box is `flex-1 min-h-0` (fills the tab), not a fixed `h-96` box
— fixing a bug where the dialog had no forced height at all (auto-sized per tab) and the fixed-height upload box
forced its own internal scrollbar. `AttachmentUploadComponent` is `h-full`-based internally, so it fills
whatever space its wrapper gives it and scrolls its own file list only if the list itself is long. The Leave
Details tab's markup is unchanged (its content already fit without scrolling).

### Fixed bug — selecting the Attachment tab silently closed the whole dialog
This tabcontainer lives inside a dialog that itself sits inside the Employee Dashboard's own **outer**
`ui5-tabcontainer` (My Profile / My Leave / ...). UI5's `tab-select` is a bubbling custom event, and the outer
tabcontainer's handler reacts to *any* `tab-select` reaching it without checking its source. Left unstopped,
clicking "Attachment" here bubbled up, got misread as the outer page switching tabs, found no outer tab named
"Attachment", and fell back to its first tab — silently hiding this entire dialog. Fixed with
`event.stopPropagation()` as the first line of `onTabSelect()`.

### Calendar Pre-selection Behaviour
- `preSelectedLeaveDays` seeds the calendar's initial selection: on `newLeave()` it's empty; on `editLeave()` it's the leave-being-edited's own saved dates (toggleable — click to deselect, e.g. to swap one day for another).
- `pendingApprovedLeaveDates` (from `fetchPendingApprovedLeaveDates()`, now called in both `newLeave()` and `editLeave()`) holds every *other* non-rejected leave's dates for this employee; `mergeCalendarDates()` folds these into `takenLeaveDates` (disabled) while excluding the current leave's own `preSelectedLeaveDays`, so another leave's already-taken/approved days render disabled and non-clickable instead of selectable.
- `selectedLeaveDays` mirrors the calendar's live selection 1:1 (`onDateSelectionChange` assigns it directly, no filtering/re-merge) — this is what's submitted to the API, and since `PUT hrm/leave-requests/{id}` replaces a leave's entire date set, it must reflect the full desired set, not just newly-added dates.
- Special date colors: yellow (`#f0a800`) = pending, blue (`#0070f2`) = supervisor-approved

### API Calls

| Method | Endpoint | OData | Purpose |
|--------|----------|-------|---------|
| GET | `LeaveRequests` | ✓ | Grid list (filtered by `employee_id`) |
| GET | `LeaveRequests?$filter=...&$expand=weekeend` | ✓ | Pending/approved dates for calendar |
| GET | `LeaveTypes` | ✓ | Leave type options |
| GET | `HolidayTypes` | ✓ | Holiday type colors |
| GET | `EmployeeHolidaySwaps?$filter=employee_id eq X and type eq 'WEEKEND'` | ✓ | Swap remap for `fetchWeekends()` — see below |
| GET | `hrm/holidays?year=YYYY` | ✗ | Holiday dates |
| GET | `hrm/employee-weekends?employee_id=X` | ✗ | Weekend dates |
| GET | `hrm/leave-taken?employee_id=X` | ✗ | Taken leave dates (by type) |
| GET | `hrm/leave-request?leave_id=X` | ✗ | Full leave detail for edit |
| GET | `leave-requests/progress?ids=...` | ✗ | Batched approval progress for grid rows |
| POST | `hrm/leave-requests` | ✗ | Create new leave |
| PUT | `hrm/leave-requests/${id}` | ✗ | Update existing leave |
| POST | `image-upload` (via `AttachmentUploadComponent`) | ✗ | Attachment upload, `model=LeaveRequest` |

### Holiday-swap remap (`fetchWeekends()`)
`fetchWeekends()` fetches `EmployeeHolidaySwaps?$filter=employee_id eq {id} and type eq 'WEEKEND'`
**before** `hrm/employee-weekends?employee_id=X` (nested, not `forkJoin` — the weekends call only
fires once the swap lookup resolves). For each weekend item whose `weekend_date` matches a swap's
`original_holiday_date`, `weekend_date` is overwritten with the swap's `swapped_holiday_date` before
building `weekendDates`/`takenLeaveDates` — so a swapped-away weekend correctly blocks the employee
from applying for leave on its **new** date, not the stale original one, in the leave-apply date
picker. See [leave-transfer](../../leave-management/leave-transfer/context.md) for where these
`EmployeeHolidaySwap` records are created, and
[calender-management](../../leave-management/calender-management/context.md#holiday-swap-remap-in-loademployeeweekends--display-only-dont-conflate-with-syncweekendoptionswithdata)
for the analogous remap (and its save-time caveat) in the admin calendar screen.

### Dialog Footer
```html
<div slot="footer" class="flex items-center justify-end gap-2 w-full px-4 py-2">
  <ui5-button *ngIf="!isReadOnly" design="Emphasized" (click)="saveLeaveRequests()" ...>Submit</ui5-button>
  <ui5-button design="Transparent" (click)="CloseDialog()">Cancel</ui5-button>
</div>
```
Submit hidden when `isReadOnly` (view mode). Always plain `div[slot=footer]` — no `ui5-toolbar`.

### Grid Filter
`[filterQuery]="'employee_id eq ' + employee?.id"` — shows only current employee's leaves.

### Delete Flow
`IsDelete.emit('LeaveRequests/${row.id}')` → handled by `<app-delete-entity>` in template.

### Real-Time Notification (Socket Emit)
On a successful **new** leave POST (create only, not edit), `saveLeaveRequests()` emits:
```typescript
socketService.emit('hrm-leave:applied', {
  model_id: 0, model_custom_id: '', sender_id: authUser.id, sender_name: authUser.name,
  recipient_user_ids: res?.recipient_user_ids ?? [],
});
```
Maps to permission `HRM_LEAVE_APPLIED_NOTIFICATION` — notifies the employee's **supervisor** (`Backend/app/Observers/LeaveRequestObserver.php::created()`).

---

## ViewApplyComponent (approver view/approve/reject widget)

### Selector
`app-view-apply`

### Purpose
Read-only wizard dialog for viewing a leave request's details/attachment/approver checklist, and — if the
current user is the pending current-step approver — approving or rejecting it. No longer scoped to "direct
reports of a supervisor"; it lists/acts on whatever `LeaveRequests` the grid's `dataSource` returns (the
`employeeRequest` input and its `employee/supervisor_id eq {id}` filter query, and the old flat
`supervisor_status` PUT flow, have been removed — see Notes).

### Outputs

| Name | Direction | Purpose |
|------|-----------|---------|
| `refreshTable` | `@Output` | Emitted after a decision |
| `updateCalendar` | `@Output` | Emits date list to calendar component |

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `currentStep` | `number` | Wizard step |
| `leaveApprovalSteps` | `LeaveApprovalStep[]` | Per-person checklist for the selected `LeaveRequest` |
| `loadingLeaveApprovalSteps` / `leaveApprovalStepsConfirmed` | `boolean` | Loading/loaded-state guards for `canActOnLeaveApprovalStep` |
| `approvingLeaveStep` | `boolean` | Disables Approve/Reject buttons mid-request |
| `approvalProgress` | `Map<number, {approved, rejected, total}>` | Batched grid Status/Approval Progress columns |
| `viewAttachmentUploadRef` | `AttachmentUploadComponent` | Wizard's Attachment step |

### Key Logic

| Member | Type | Purpose |
|--------|------|---------|
| `viewLeave(data)` | method | Opens dialog at step 1; if `hasApprovalChain`, calls `loadLeaveApprovalSteps()`; always loads the Attachment step via `viewAttachmentUploadRef.loadInputImages()` |
| `hasApprovalChain` | getter | `!!this.LeaveRequest.leavetype?.approval_type_id` |
| `viewAttachmentStepIndex` | `readonly` | `2` — Attachment always follows Leave Details |
| `viewApproversStepIndex` | getter | `3` if `hasApprovalChain`, else `null` |
| `viewMaxStep` | getter | `viewApproversStepIndex ?? viewAttachmentStepIndex` |
| `goToStep`/`nextStep`/`prevStep`/`onWizardStepChange` | methods | Wizard navigation, bounded by `viewMaxStep` |
| `loadLeaveApprovalSteps()` | method | GET `leave-requests/{id}/approvers` (cache-busted) → sorts by `pivot.sequence_index`; flags `isCurrentStep` (first non-approved row) / `isCurrentUser` (matches `localStorage.employee_id`) |
| `canActOnLeaveApprovalStep` | getter | `true` only when a chain exists, steps have loaded, and the current user is the pending current-step approver |
| `approveAsCurrentUser()` / `rejectAsCurrentUser()` | methods | → `recordLeaveDecision('approve'|'reject')` |
| `recordLeaveDecision(action)` | method | POST `leave-requests/{id}/approver-{action}`; on `hr_status` reaching `approved`/`rejected`, emits `hrm-leave:hr-approved`/`hrm-leave:hr-rejected`; reloads steps + grid; a `409` (someone else already decided) re-syncs steps instead of erroring silently |
| `onGridDataLoaded(data)` | method | Same batched `leave-requests/progress` pattern as `LeaveSectionComponent`/`LeaveRequestComponent` |
| `getApprovalStatus(id)` | method | Derives `PENDING`/`APPROVED`/`REJECTED` from `approvalProgress` |

### View Dialog — Wizard Steps
1. **Leave Details** — read-only, unconditional "Next".
2. **Attachment** (`viewAttachmentStepIndex`) — `app-attachment-upload` (`model="LeaveRequest" apiUrl="LeaveRequests" [id]="LeaveRequest.id" [isEdit]="true"`), shows the file uploaded at apply time with Download. "Next" only shown when `hasApprovalChain`.
3. **Approvers** (`viewApproversStepIndex`, `*ngIf="hasApprovalChain"`) — checklist grid from `leaveApprovalSteps`; footer Approve/Reject shown when `canActOnLeaveApprovalStep`.

### Real-Time Notification (Socket Emit)

| Decision | Socket event | Trigger |
|----------|--------------|---------|
| Approve (chain reaches `hr_status: approved`) | `hrm-leave:hr-approved` | `recordLeaveDecision()` |
| Reject | `hrm-leave:hr-rejected` | `recordLeaveDecision()` |

Payload: `{ model_id, model_custom_id, sender_id, sender_name }`.

---

## Services Injected

| Service | Usage |
|---------|-------|
| `CommonService` | All HTTP calls |
| `ToastService` | Success/error notifications |
| `AuthService` | Current user context |
| `RolePermissionService` | Permission checks |
| `MediaService` (`LeaveSectionComponent` only) | Signals the staged `AttachmentUploadComponent` to upload once a `LeaveRequest` id exists |

## Notes
- `selectedLeaveDays` payload = the full current calendar selection (own dates + any newly added, minus any the user deselected). Fixed a bug where it was computed as "event minus `preSelectedLeaveDays`": that dropped the leave's own dates from the PUT payload, and the resulting `updateCalendar` re-emit of `preSelectedLeaveDays ∪ selectedLeaveDays` always re-added the full original date set into the calendar's selection, so a deselected day silently snapped back to selected.
- `fetchPendingApprovedLeaveDates()` is called from both `newLeave()` and `editLeave()` — without it in `editLeave()`, other leave requests' dates weren't in the disabled-dates set, so they rendered as normal (clickable/selectable) days instead of disabled ones.
- Grid filter `[filterQuery]` uses `employee.id` from `@Input` — refreshes via `ngOnChanges`.
- Leave types are fully admin-manageable (see [`LEAVE_TYPE_LIST_COMPONENT_CONTEXT.md`](../../leave-management/leave-type/LEAVE_TYPE_LIST_COMPONENT_CONTEXT.md)); day-limit enforcement reads `leaveType.max_days` generically, backend-side in `LeaveService::store()` too.
- `LeaveType.document_required` forces at least one attachment before an apply/edit submit succeeds in both `LeaveSectionComponent` and `leave-request.component`'s Apply wizard — implemented by reusing the shared media library (`AttachmentUploadComponent` + `image-upload` endpoint, `model=LeaveRequest`), the same pattern as `employee-form`'s photo upload, not a bespoke uploader.
- `ViewApplyComponent`'s `employeeRequest` input and org-hierarchy-based supervisor filtering (`employee/supervisor_id eq {id}`) have been removed — approval visibility/authority is now entirely driven by the `ApprovalType` roster (`LeaveApprovalController::approvers()`/`canActOnLeaveApprovalStep`), not reporting-line membership.
