# Store Management — Store Purchase Requisition (SPR) — sidebar label "Indent"

## Files

```
purchase-requisition/
├── purchase-requisition.component.tsx   ← SPR list
├── purchase-requisition.component.html
├── purchase-requisition.component.scss
└── requisition-from/
    ├── requisition-from.component.tsx   ← shared create/edit dialog (items grid = ag-grid)
    └── requisition-from.component.html
```

## Route
`/store/purchase-requisition` — guard: `STORE_PURCHASE_REQUISITION`

---

## PurchaseRequisitionComponent

### Selector
`app-purchase-requisition`

### Purpose
Lists SPRs (`type eq 'SPR'`) — store team creates and manages purchase requisitions sent to the purchase department. Sidebar label is "Indent" (route unchanged: `purchase-requisition`).

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `dataSource` | `AgGridTableODataSourceConfig` | OData `PurchaseRequisitions`, type=SPR, default filter: `SUBMITTED` |
| `segmentButtonItems` | `array` | Submitted (default) / Approved / Rejected |
| `columns` | `AgGridTableColumn[]` | Built in `ngOnInit` after permission check |
| `saveMode` | `'POST'\|'PUT'` | Create vs update |
| `selectedData` | `any` | Row passed to dialog for edit |
| `agGridRef` | `AgGridTableComponent` | `#agGridRef` — for `refreshGridData(true)` |
| `formRef` | `RequisitionFromComponent` | `#requisitionFrom` — SPR dialog |

### OData Config

| Key | Value |
|-----|-------|
| endpoint | `PurchaseRequisitions` |
| expand | `requestBy,department,sprItems($expand=item($expand=category,uom))` |
| searchFields | `['custom_id', 'requestBy.name', 'department.name', 'urgency']` — `urgency` is a plain visible `string` column (see Columns table below) added to keep search covering every text column shown in the grid |
| sortBy | `id` desc |
| default filter | `type eq 'SPR' and (status eq 'SUBMITTED' or status eq 'APPROVED')` |

### Segment → status (`statusFilter()`)
| Segment | Status filter |
|---------|---------------|
| Submitted (default) | `SUBMITTED or APPROVED` (APPROVED = GM-approved, awaiting final) |
| Approved | `FINAL_APPROVAL` only |
| Rejected | `REJECTED` |

> Indent Requisition is the store create/track screen. Final approval ✓ is NOT here — it lives on Indent Requests (`spr-requests`, purchase-management). This screen has view-only actions.

### Permissions

| Permission | Effect |
|------------|--------|
| `STORE_PURCHASE_REQUISITION_VIEW` | Shows info action button |
| `STORE_PURCHASE_REQUISITION_CREATE` | Shows New button in toolbar |

> Two-level approval (`PURCHESE_SPR_APPROVAL` / final) is exercised on the Indent Requests screen — see store-management INDEX "Two-Level Requisition Approval".

### Columns

| Field/ColId | Header | Notes |
|-------------|--------|-------|
| `custom_id` | Indent No | `width: 120` |
| `requestBy.name` | Requested | `colId` dot notation; `valueGetter: requestBy.name` |
| `department.name` | Department | `colId` dot notation; `valueGetter: department.name` |
| `request_date` | Request Date | `valueFormatter: dateFormatter.formatDate()` |
| `required_by` | Required Date | `valueFormatter: dateFormatter.formatDate()` |
| `approval_status` | Status | `AgGridStatusBadgeComponent` badge, `valueGetter: getApprovalStatus(id)` — one of `PENDING`/`APPROVED`/`REJECTED`, derived from the same `approvalProgress` map as the Approval Progress column: any rejection → `REJECTED`; `approved >= total` (and `total > 0`) → `APPROVED`; otherwise `PENDING`. |
| `approval_progress` | Approval Progress | Shared `AgGridApprovalProgressCellRendererComponent` (`@shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component`) — a small progress bar + "`approved`/`total`" label, green when fully approved else amber. `valueGetter` returns `approvalProgress.get(id) ?? null`. Backed by `approvalProgress: Map<requisitionId, {approved, rejected, total}>`, populated in one batched call per visible page (`onGridDataLoaded`) hitting `GET approval-types/by-code/INDENT/progress?ids=<visible ids>`. Same shared renderer used by `store-requisition` and `sr-request` — previously each component built its own inline HTML-string `cellRenderer` function; extracted to a real Angular component to remove the 3-way duplication. |
| `urgency` | Urgency | `AgGridStatusBadgeComponent` badge (was a plain text field) — value is `RequisitionUrgency` (`HIGH`/`MEDIUM`/`LOW`), styled via `HIGH`/`MEDIUM`/`LOW` entries added to `statusStyles.ts` (red/amber/green). |
| `items_count` | Items | `valueGetter: sprItems.length` |
| `is_complete` | Complete | badge; `valueGetter: is_complete ? 'COMPLETED' : 'PENDING'` — driven by the requisition's own `is_complete` flag, set true once every linked PO is fully received (see `MaterialReceiptController::markRequisitionCompleteIfNeeded`) |
| `actions` | Actions | info icon → `viewItem()`; pinned right |

### Key Methods

| Method | Description |
|--------|-------------|
| `segmentButtonChange(event)` | Updates `dataSource.filter` with selected status; spread triggers ag-grid refresh |
| `newItem()` | Opens form, sets POST mode, calls `formRef.getCustomId()` (SPR uses `getCustomId` not `getSrCustomId`); `getCustomId` generates prefix `BTL-Indent` → `BTL-Indent-00001` (was `SPR`) |
| `viewItem(event)` | Opens form in PUT mode; calls `formRef.getSprPopulated()`. `isReadOnly` is `true` when status is `APPROVED`/`FINAL_APPROVAL`/`REJECTED` **or** when the per-person approval chain already has activity (`approvalProgress.get(id)` shows `approved > 0 \|\| rejected > 0`) — locks a mid-chain (e.g. 2/3 approved) Indent from being edited/resubmitted, not just a fully-terminal one. |
| `saveEvent()` | `agGridRef?.refreshGridData(true)` |

### Important Caveats
- Toolbar `headerTitle` is "Indent List".
- SPR uses `formRef.getCustomId()` for new items — SR uses `formRef.getSrCustomId()`.
- Prefix swap: SPR (`getCustomId`) → `BTL-Indent-00001`; SR (`getSrCustomId`) → `SR-000001`. (The `BTL-Indent` prefix moved from SR to SPR; the `SR` prefix moved from SPR to SR.)
- `gridId="purchase-requisition-list"` — column state localStorage key.

---

## RequisitionFromComponent (shared SPR/SR dialog)

### Selector
`app-requisition-from`

### Items grid — `app-ag-grid-table` (migrated from `app-custom-grid-table`)
Client-side editable grid driven by a static `dataSource`, not OData.

| Aspect | Detail |
|--------|--------|
| `#childComponentRef` | `AgGridTableComponent` (was `CustomGridTableComponent`) |
| `dataSource` | `{ type:'odata', endpoint:'', staticData:true, data:[] }` — rows live in `selectedItem` |
| `toolbarConfig` | `headerTitle:title`, `showSearch`, `showRowCount`, New button = `Associate` (visible when `showNewButton`) |
| `displayConfig` | `gridHeight: 'calc(100vh - 560px)'` |
| Columns | `item_code`, `product_name`, `stock` (read-only), `quantity` (step-input when `showNewButton`; header = `quantityHeaderText`: "SR Qty" for SR, "Indent Qty" for SPR/Indent. **SR** editor = `{type:stepInput, min:0, maxField:'stock', disabledWhenMaxZero:true}` (capped at stock, locked at 0 stock); **Indent/SPR** editor = `{type:stepInput, min:0}` (free, non-negative)), `approved_qty` (column shown via `shouldShowApprovedQtyColumn()`; editable when `canEditApproved` — see "Two-level approval & item removal"), `uom.name`, `__row_actions__` (remove icon when editable) |
| Delete/Remove | Explicit `__row_actions__` column (built in `tableColum()`, `AgGridActionCellRendererComponent`, delete icon → `onDeleteClick`). Shown when `canEditQty` (create) **or** `canEditApproved` (approving). Grid's built-in `showAction` is OFF. |
| Editing | Inline step-input writes straight to the row object; `onSaveType()` submits `selectedItem` directly (no `getGridRows()`). |

### Type-driven labels & field behavior
- **Document-number field label** (`idLabelText` getter): SR type → "SR No"; SPR/Indent type → "Indent No".
- **Quantity column header** (`quantityHeaderText` getter): SR type → "SR Qty"; SPR/Indent type → "Indent Qty" (was "SPR Qty").
- **Required By date picker**: uses `[attr.min-date]="todayFormatted"` — past dates disabled, current/future allowed (was `max-date`, which disabled future dates).
- **Department logic** (`autoSelectDepartmentFromEmployee()`): auto-selects the logged-in employee's department; if that department name (case-insensitive) is NOT "store", `isDepartmentReadOnly` is set `true` (field locked). Store users keep the department field editable.
- **Items-to-Purchase stock validation** (`validateForm()`): **SR only**, requester side (not request/approve mode) — an item with current `stock <= 0` blocks submit with a ui5 warning: `Current stock is 0 for "<item>". SR quantity cannot be requested.` (SR is fulfilled from existing stock; its qty editor is also disabled at 0 stock.) Indent/SPR has no stock gate — qty just stays ≥ 0. General rule both types: qty must be > 0.
- **Indent Type field** (Local/Foreign combobox, `getIndentType()` → `Spr.is_imported`): shown for **Indent/SPR only** — wrapped in `*ngIf="requisitionType !== 'SR'"`, sits in the same `col-span-2` flex row as Urgency and Required By. SR has no import concept, so the field is hidden entirely (not just disabled) when `requisitionType==='SR'`. `PurchaseRequisition` (FE model, `@store-module/shared/model/purchaseRequisition.ts`) carries `is_imported?: boolean = false`; populated from `data.is_imported` in `getSprPopulated()`, reset to `false`/blank title in `reset()`. Drives the "Indent Type" list badge documented above once saved.

### Data flow
- `tableColum()` rebuilds columns + `toolbarConfig` per mode (editability keyed off `showNewButton` / `isRequestMode()`).
- `syncDataWithGridTable()` reassigns `dataSource` (`{...dataSource, data:[...selectedItem]}`) → ag-grid reloads static rows.
- `onSaveType()` calls `childComponentRef.stopEditing()` then reads rows via `getGridRows()` (grid node data → fallback `selectedItem`).
- Inline edits mutate the shared row objects in `selectedItem`; `getGridRows()` reads committed grid state.

### Two-level approval & item removal (REQUEST mode)
Shared by Indent Requests (`spr-requests`) and SR Request (`sr-request`).

**Inputs**
- `@Input() canApprove = true` — Level-1 gate (SUBMITTED → APPROVED). Parent passes `hasPermission(PURCHESE_SPR_APPROVAL)` (SPR) / `STORE_SR_APPROVAL` (SR).
- `@Input() canFinalApprove = false` — Level-2 gate (APPROVED → FINAL_APPROVAL). Parent passes `hasPermission(PURCHESE_SPR_FINAL_APPROVAL)` (SPR) / `STORE_SR_FINAL_APPROVAL` (SR) — its own permission, not `!canApprove`.

**Footer buttons** (`canShowPrimaryAction` / `canShowRejectAction` → `canActOnCurrentStatus`):
- `canShowPrimaryAction` returns `false` immediately whenever `@Input() isReadOnly` is `true` — a single source of truth shared with the field-level `[readonly]` bindings, so a locked view can never still show a live Submit button. (Previously `isReadOnly` only disabled the input fields; Submit/Approve stayed clickable regardless — this is what let a partially-approved SR/Indent still be edited and resubmitted from `store-requisition`/`purchase-requisition`'s view dialog. Each parent's `viewItem()` is responsible for setting `isReadOnly` correctly — see their own context files' "View Item" notes.)
- Otherwise, SUBMITTED + `canApprove` → Approve/Reject.
- APPROVED + `canFinalApprove` → Approve(final)/Reject.
- Otherwise read-only (no buttons). Approve text always "Approve".

**`onSaveType(targetStatus?)`** branches on the current status:
- Level-1 approve: `SUBMITTED → APPROVED`, sets `approved_by` + `approved_at`.
- Final approve: OData PUT keeps status `APPROVED` (persists item edits), then `finalApproveRequisition(id)` → REST `store/requisitions-final-approve` flips to `FINAL_APPROVAL` + `final_approved_*` + decrements stock (both SR and SPR).
- Reject → `REJECTED`.
- `requested_by` is **preserved** on every PUT (`this.Spr.requested_by ?? authUser.id`) — fixes the bug where approving overwrote the requester's name with the approver.

**Item removal** (`onDeleteClick`): keys on `item_id` for saved rows (falls back to product `id` for new rows). On update save, `updateBatchRequest` adds `DELETE /odata/PurchaseRequisitionItems(id)` for any original `sprItems` no longer present, batched with the PUTs. `validateForm` still requires ≥1 item.

**`approved_qty` editability** (`canEditApproved`): `SUBMITTED && canApprove` only — locks permanently once GM approves (was also editable at `APPROVED && canFinalApprove`; final approval no longer revises the approved amount, it just confirms).

**Requested (`quantity`) qty lock**: `canEditQty = showNewButton && !isGmApprovedOrBeyond`, where `isGmApprovedOrBeyond` = status is `APPROVED`, `FINAL_APPROVAL`, or `REJECTED`. Computed directly off `this.Spr.status` inside `tableColum()` — self-contained, doesn't rely solely on the parent-supplied `showNewButton`.

### SR per-person approval checklist (real state, separate from SprStatus)

`requisitionType === 'SR'` only — the main Details/Items `ui5-wizard` gets a **3rd step, "Approvers"** (`data-step="3"`, `*ngIf="requisitionType === 'SR'"`), reached via the Items step's "Next" button (`goToStep`'s max step is 3 for SR, 2 for SPR/Indent). Inside that step, a **custom step-indicator** (plain divs, no `ui5-wizard`) — numbered circles connected by lines, one per employee assigned as an approver for `ApprovalType` `code = 'SR'` (built in `base-data-management/approver-management`), in `pivot.sequence_index` order; a "No approvers configured for SR requests yet" message shows if the list is empty.

Each step circle: green + checkmark if `status === 'approved'`, red + cross if `'rejected'`, a blue outlined circle with its index number if `'pending' && isCurrentStep`, a plain gray circle with its index number if `'pending'` but not yet reached. Below the circle: avatar photo, name, designation, Required/Optional badge. The connecting line to the next step is green once the current one is approved, gray otherwise. A **single** Approve/Reject button pair renders in the dialog's footer toolbar (not inline in the step) — only when `canActOnSrApprovalStep` is true.

- **`@Input() showApprovalActions = true`** — gates whether the chain's Approve/Reject can ever render, independent of everything else. `store-requisition.component.html` (the create/edit-a-request screen) passes `[showApprovalActions]="false"` — that dialog is for authoring an SR, not approving one, so it only ever shows Submit/Cancel. `sr-request.component.html` (the review screen) leaves it at the default `true`.
- **"Current step"** = the first step (in sequence order) whose `status !== 'approved'` — computed once in `loadSrApprovalSteps()` (`sorted.findIndex(...)`) and stamped onto every row as `isCurrentStep`. A rejected step becomes and stays the current step (chain halted there for display; nothing further to act on since a decision was already recorded).
- **This is real per-request state**, not a `SprStatus`-approximated display — `requisition_approvals` (`requisition_id`, `employee_id`, `status` ['approved'|'rejected'], `approved_at`, unique per pair) tracks exactly which employee approved/rejected exactly which requisition. It is a separate, parallel checklist: it does **not** gate, replace, or get gated by the existing Approve/Final-Approve buttons, `canActOnCurrentStatus`, or `SprStatus` transitions — those remain completely untouched.
- **`loadSrApprovalSteps()`** — called from `reset()` (new SR) and at the end of `getSprPopulated()` (existing SR), both gated `requisitionType === 'SR'`. `GET approval-types/by-code/SR/approvers` (REST — see Lodata note below), with `?requisition_id=<id>` appended when `this.Spr.id` is available (existing SR — omitted for a brand-new unsaved SR, which just shows the roster all-pending with no current step reachable). `Spr.id` is the single source of truth for this — `getSprPopulated()` sets it explicitly now, and `reset()` clears the bound `selectedData` @Input too, so a previously-viewed SR's id can never leak into a fresh create. Maps into `srApprovalSteps: {id, name, designation, photoUrl, isRequired, status, isCurrentUser, isCurrentStep}[]` — `isCurrentUser` compares each row's employee `id` against `Number(localStorage.getItem('employee_id'))` (already set on login, `login.component.ts:100`, from the existing `GET /api/auth` response which eager-loads `employee`). Any failure silently empties the array — never blocks viewing/approving the SR itself.
- **`srApprovalStepsConfirmed`** — only `true` once a fetch has genuinely resolved for the currently-open dialog (reset to `false` on every new load and on close). `canActOnSrApprovalStep` requires this — guards against the buttons flashing based on stale/default/empty state before the server has actually confirmed status.
- **`approveAsCurrentUser()` / `rejectAsCurrentUser()`** — both delegate to `recordSrDecision('approve' | 'reject')`, which `POST`s `requisitions/{id}/approver-approve` or `.../approver-reject` (no body — the Backend resolves the approving employee from `auth()->user()->employee`, never trusts a client-supplied id, and 403s if that employee isn't actually an assigned SR approver), then reloads the checklist on success.
- **Why REST, not OData**: `ApprovalTypeController::approversByCode($code)` (Backend) does a plain Eloquent `ApprovalType::where('code', ...)->first()` lookup instead of `ApprovalTypes?$filter=code eq '...'`. This app's Lodata schema discovery went stale after the `code` column was added to an already-discovered entity — survived even `config:clear`/`cache:clear` — because the Backend runs under **Laravel Octane** (RoadRunner), which keeps the whole app booted in long-lived worker processes; only an Octane worker reload/restart picks up schema, route, or config changes. The REST lookup-by-code sidesteps depending on Lodata's cached metadata being fresh for this specific call.

### Migration notes
- SR quantity is capped at `stock` and disabled at 0 stock via the step-input config (`maxField:'stock'`, `disabledWhenMaxZero`); Indent/SPR quantity is free (`min:0` only). Submit-time SR stock gate lives in `validateForm()` (see Type-driven labels above).
- Editors are only attached when the field is editable for the current mode (the shared component forces `editable:true` whenever an `editor` is set).
- Parents (`PurchaseRequisitionComponent`, `StoreRequisitionComponent`) no longer call `childComponentRef.resetConfirmationSubmit()` / `onDialogClose()` — those were `CustomGridTableComponent`-only APIs.
