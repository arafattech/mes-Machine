# Store Management — SR Request (Store View) — sidebar "SR Management → SR Request"

## Files

```
sr-request/
├── sr-request.component.ts    ← SR approval/review list for store staff
├── sr-request.component.html
└── sr-request.component.scss
```

## Route
`/store/sr-requests` — guard: `STORE_SR_REQUEST`

---

## SrRequestComponent

### Selector
`app-sr-request`

### Purpose
SR two-level approval screen. Store staff view department SRs and act via the dialog: Level-1 approvers (`STORE_SR_APPROVAL`) approve/reject SUBMITTED; everyone else (final approvers) approve APPROVED → FINAL_APPROVAL. No New button. No row-level ✓ or delete icons — approval happens inside the info dialog.
Distinct from `StoreRequisitionComponent` (which is for department users to create SRs). Sidebar label is "SR Request" under the "SR Management" menu group (route unchanged: `sr-requests`); within that group it is the first submenu, before "SR Requisition". See store-management INDEX "Two-Level Requisition Approval".

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `saveMode` | `'REQUEST'` | Fixed value — not POST/PUT |
| `dataSource` | `AgGridTableODataSourceConfig` | OData `PurchaseRequisitions`, type=SR |
| `segmentButtonItems` | `array` | Submitted (default) / Approved / Rejected |
| `columns` | `AgGridTableColumn[]` | Built in `ngOnInit` |
| `agGridRef` | `AgGridTableComponent` | `#agGridRef` |
| `formRef` | `RequisitionFromComponent` | `#requisitionFrom` |
| `canApprove` | `boolean` | True if user has `STORE_SR_APPROVAL` |
| `canFinalApprove` | `boolean` | True if user has `STORE_SR_FINAL_APPROVAL` |

### OData Config

| Key | Value |
|-----|-------|
| endpoint | `PurchaseRequisitions` |
| expand | `requestBy,department,sprItems($expand=item($expand=category,uom))` |
| searchFields | `['custom_id', 'requestBy.name', 'department.name']` |
| sortBy | `id` |
| sortDirection | `desc` (newest first) |
| default filter | `(status eq 'SUBMITTED' or status eq 'APPROVED') and type eq 'SR'` |

> **`sortBy: "id"` requires a hidden `id` column** in `buildColumns()` so AG Grid includes `id` in its sort model, which the query builder converts to `$orderby=id desc`. The column is `{ field:"id", hide:true, sortable:true, filter:false, floatingFilter:false }`.

### Segment → status (`statusFilter()`)
| Segment | Status filter |
|---------|---------------|
| Submitted (default) | `SUBMITTED or APPROVED` |
| Approved | `FINAL_APPROVAL` only |
| Rejected | `REJECTED` |

### Permissions

| Permission | Effect |
|------------|--------|
| `STORE_SR_REQUEST_VIEW` | Shows info action button |
| `STORE_SR_APPROVAL` | `canApprove` (Level-1) — Approve/Reject on SUBMITTED in the dialog |
| `STORE_SR_FINAL_APPROVAL` | `canFinalApprove` (Level-2) — Approve(final)/Reject on APPROVED |

> Delete icon removed. `STORE_SR_REQUEST_DELETE` no longer wired here.

### Columns

| Field/ColId | Header | Notes |
|-------------|--------|-------|
| `custom_id` | SR No | `width: 120` |
| `requestBy.name` | Requested | `colId` dot notation; `valueGetter: requestBy.name` |
| `department.name` | Department | `colId` dot notation; `valueGetter: department.name` |
| `request_date` | Request Date | `valueFormatter: toLocaleDateString()` |
| `required_by` | Required Date | `valueFormatter: toLocaleDateString()` |
| `approval_status` | Status | `AgGridStatusBadgeComponent` badge, `valueGetter: getApprovalStatus(id)` — one of `PENDING`/`APPROVED`/`REJECTED` (styles already defined in `statusStyles.ts`), derived from the same `approvalProgress` map as the Approval Progress column: any rejection → `REJECTED`; `approved >= total` (and `total > 0`) → `APPROVED`; otherwise `PENDING`. Replaces the old 4-state GM Status/Store Status badge pair. |
| `approval_progress` | Approval Progress | Shared `AgGridApprovalProgressCellRendererComponent` (`@shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component`, `valueGetter: approvalProgress.get(id) ?? null`) — a small progress bar + "`approved`/`total`" label, green when fully approved else amber. Was previously an inline HTML-string `cellRenderer` function built separately in this component, `store-requisition`, and `purchase-requisition`; extracted to one shared Angular component to remove the duplication. Backed by `approvalProgress: Map<requisitionId, {approved, rejected, total}>`, populated in one batched call per visible page (`onGridDataLoaded`, bound to `(processData)`) hitting `GET approval-types/by-code/SR/progress?ids=<visible ids>` — avoids an N+1 of per-row lookups. `total` is fixed (how many employees are assigned as SR approvers via `base-data-management/approver-management`); `approved`/`rejected` are per-requisition decision counts (`requisition_approvals` table). After the batch response lands, `refreshCells({force:true, columns:['approval_status','approval_progress']})` re-renders both derived columns. Cells render blank/PENDING until the batch call resolves, and blank if no SR approval type/approvers are configured (`total === 0`). |
| `items_count` | Items | `valueGetter: sprItems.length` |
| `id` | *(hidden)* | `hide:true`, `sortable:true` — required for `sortBy:"id"` to generate `$orderby=id desc` |
| `actions` | Actions | info only (view → dialog); pinned right |

### Key Methods

| Method | Description |
|--------|-------------|
| `segmentButtonChange(event)` | Updates filter; spread triggers refresh |
| `viewItem(event)` | Opens form in REQUEST mode; calls `formRef.handleReadonly('REQUEST')` + sets `isReadOnly = true` |
| `saveEvent()` | `agGridRef?.refreshGridData(true)` |

### Template Specifics
```html
[saveMode]="'REQUEST'"
[requisitionType]="'SR'"
[canApprove]="canApprove"
[canFinalApprove]="canFinalApprove"
[isDepartmentReadOnly]="true"
[isRequiredByReadOnly]="true"
```
No `(newButtonClick)` binding — no new button. `canApprove = hasPermission(STORE_SR_APPROVAL)`, `canFinalApprove = hasPermission(STORE_SR_FINAL_APPROVAL)` (set in `ngOnInit`).

### Important Caveats
- Toolbar `headerTitle` is "SR Request".
- `saveMode = 'REQUEST'` — not 'POST'/'PUT'. Passed directly to `RequisitionFromComponent`; approval/final-approval + item-removal logic lives there (see purchase-requisition/context.md "Two-level approval & item removal").
- No department filter — store staff see all department SRs.
- `gridId="sr-request-list"` — column state localStorage key.

---

## Real-Time Grid Refresh (Notification Socket Listener)

`SrRequestComponent` listens to `notification:new` socket events and **auto-refreshes the grid** when an SR-related notification arrives. This keeps the list current without manual refresh when SRs are created or status-changed by other users.

### Implementation

```typescript
private readonly destroyRef = inject(DestroyRef);
private readonly socketService = inject(SocketService);

private readonly SR_NOTIFICATION_TYPES = new Set([
  Permissions.STORE_STORE_REQUISITION_CREATE_NOTIFICATION,
  Permissions.STORE_STORE_REQUISITION_APPROVE_NOTIFICATION,
  Permissions.STORE_STORE_REQUISITION_REJECT_NOTIFICATION,
]);

// in ngOnInit():
this.socketService
  .on('notification:new')
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe((payload: unknown) => {
    const p = payload as { type?: string };
    if (p.type && this.SR_NOTIFICATION_TYPES.has(p.type as Permissions)) {
      this.agGridRef?.refreshGridData(true);
    }
  });
```

### Watched notification types

| `notification:new` type | Triggers grid refresh when |
|------------------------|---------------------------|
| `STORE_STORE_REQUISITION_CREATE_NOTIFICATION` | New SR created by department |
| `STORE_STORE_REQUISITION_APPROVE_NOTIFICATION` | SR approved (Level-1) |
| `STORE_STORE_REQUISITION_REJECT_NOTIFICATION` | SR rejected |

### Notes
- Uses `takeUntilDestroyed(this.destroyRef)` — no manual subscription bookkeeping.
- The component does NOT emit socket events (read-only approval view). Socket emits happen in `RequisitionFromComponent` after approval actions.
- Grid refresh is unconditional on type match — does not check user permission for the notification type (the socket type check is sufficient).
