# Store Management — Store Requisition (SR) — sidebar "SR Management → SR Requisition"

## Files

```
store-requisition/
├── store-requisition.component.tsx   ← SR list
├── store-requisition.component.html
└── store-requisition.component.scss
```

## Route
`/store/store-requisition` — guard: `STORE_STORE_REQUISITION`

---

## StoreRequisitionComponent

### Selector
`app-store-requisition`

### Purpose
Lists SRs (`type eq 'SR'`) — departments create store requisitions (internal item requests). Non-admins see only their own department's SRs. Sidebar label is "SR Requisition" under the "SR Management" menu group (route unchanged: `store-requisition`); within that group it is the second submenu, after "SR Request".

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `dataSource` | `AgGridTableODataSourceConfig` | OData `PurchaseRequisitions`, type=SR, default filter: `SUBMITTED` |
| `segmentButtonItems` | `array` | Submitted (default) / Approved / Rejected |
| `columns` | `AgGridTableColumn[]` | Built in `ngOnInit` |
| `saveMode` | `'POST'\|'PUT'` | Create vs update |
| `selectedData` | `any` | Row passed to dialog |
| `agGridRef` | `AgGridTableComponent` | `#agGridRef` |
| `formRef` | `RequisitionFromComponent` | `#requisitionFrom` — shared SPR/SR dialog |

### OData Config

| Key | Value |
|-----|-------|
| endpoint | `PurchaseRequisitions` |
| expand | `requestBy,department,sprItems($expand=item($expand=category,uom))` |
| searchFields | `['custom_id']` |
| sortBy | `id` desc |
| default filter | `type eq 'SR' and (status eq 'SUBMITTED' or status eq 'APPROVED')` |

### Segment → status (`statusFilter()`)
| Segment | Status filter |
|---------|---------------|
| Submitted (default) | `SUBMITTED or APPROVED` |
| Approved | `FINAL_APPROVAL` only |
| Rejected | `REJECTED` |

> Department filter (non-admin) is appended after `statusFilter()` in both init and `segmentButtonChange`. Final approval ✓ is NOT here — it lives on SR Request (`sr-request`).

### Department Filter (non-admin)
In `ngOnInit`, if `localStorage.department_id` exists and user lacks `STORE_ADMIN`:
```typescript
filter += ` and department_id eq '${departmentId}'`
```
Applied to initial filter AND reapplied in `segmentButtonChange`.

### Permissions

| Permission | Effect |
|------------|--------|
| `STORE_STORE_REQUISITION_VIEW` | Shows info action button |
| `STORE_STORE_REQUISITION_CREATE` | Shows New button |
| `STORE_ADMIN` | Disables department filter |

### Columns

| Field/ColId | Header | Notes |
|-------------|--------|-------|
| `custom_id` | SR No | `width: 120` |
| `requestBy_name` | Requested | `valueGetter: requestBy.name` |
| `department_name` | Department | `valueGetter: department.name` |
| `request_date` | Request Date | `valueFormatter: toLocaleDateString()` |
| `required_by` | Required Date | `valueFormatter: toLocaleDateString()` |
| `approval_status` | Status | `AgGridStatusBadgeComponent` badge, `valueGetter: getApprovalStatus(id)` — one of `PENDING`/`APPROVED`/`REJECTED` (styles in `statusStyles.ts`), derived from the same `approvalProgress` map as the Approval Progress column: any rejection → `REJECTED`; `approved >= total` (and `total > 0`) → `APPROVED`; otherwise `PENDING`. Same pattern as `sr-request.component.ts`. |
| `approval_progress` | Approval Progress | Shared `AgGridApprovalProgressCellRendererComponent` (`@shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component`, `valueGetter: approvalProgress.get(id) ?? null`) — a small progress bar + "`approved`/`total`" label, green when fully approved else amber. Was previously an inline HTML-string `cellRenderer` function duplicated across this component, `sr-request`, and `purchase-requisition`; extracted to one shared Angular component. Backed by `approvalProgress: Map<requisitionId, {approved, rejected, total}>`, populated in one batched call per visible page (`onGridDataLoaded`, bound to `(processData)`) hitting `GET approval-types/by-code/SR/progress?ids=<visible ids>` — same pattern as `sr-request.component.ts`. `total` is fixed (employees assigned as SR approvers via `base-data-management/approver-management`); `approved`/`rejected` are per-requisition decision counts (`requisition_approvals` table). |
| `items_count` | Items | `valueGetter: sprItems.length` |
| `actions` | Actions | info icon → `viewItem()`; pinned right |

### Key Methods

| Method | Description |
|--------|-------------|
| `segmentButtonChange(event)` | Rebuilds filter with status + optional department; spread triggers refresh |
| `newItem()` | Opens form, POST mode, calls `formRef.getSrCustomId()` (SR uses `getSrCustomId`, not `getCustomId`); `getSrCustomId` generates prefix `SR` → `SR-000001` (was `BTL-Indent`) |
| `viewItem(event)` | Opens form PUT mode; sets `isReadOnly` based on status (APPROVED/FINAL_APPROVAL/REJECTED → read-only) **or** on per-person approval-chain activity (see below) |
| `saveEvent()` | `agGridRef?.refreshGridData(true)` |

### View Item Logic
`isReadOnly` locks once the requisition is terminally decided (`APPROVED`/`FINAL_APPROVAL`/`REJECTED`) **or** once any approver in the per-person chain has already acted, even mid-chain (e.g. 2/3 approved, status still `SUBMITTED`) — otherwise a partially-approved SR opened here still had editable fields and a live Submit button, since the old check only looked at the terminal status:
```typescript
const progress = this.approvalProgress.get(event.id);
const hasApprovalActivity = !!progress && (progress.approved > 0 || progress.rejected > 0);
const isReadOnly =
  event.status === SprStatus.APPROVED ||
  event.status === SprStatus.FINAL_APPROVAL ||
  event.status === SprStatus.REJECTED ||
  hasApprovalActivity;
```
`isReadOnly` also drives `RequisitionFromComponent.canShowPrimaryAction` (see purchase-requisition/context.md "Two-level approval & item removal → Footer buttons") — so this same flag now hides the Submit button too, not just the input fields.

### Important Caveats
- Toolbar `headerTitle` is "SR Requisition List".
- SR uses `formRef.getSrCustomId()` — SPR uses `formRef.getCustomId()`. Different methods.
- Prefix swap: SR (`getSrCustomId`) → `SR-000001` (was `BTL-Indent`); SPR (`getCustomId`) → `BTL-Indent-00001` (was `SPR`).
- `gridId="store-requisition-list"` — column state localStorage key.
- Department filter persists across segment changes (reapplied each time).
- `formRef.childComponentRef.resetConfirmationSubmit()` called with 1s delay after viewItem to reset confirmation state in child component.
