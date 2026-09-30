# Base Data Management — Supplier Management

## Files
```
supplier-management/
├── supplier-form/
│   ├── supplier-form.component.ts
│   └── supplier-form.component.html
├── supplier-list/
│   ├── supplier-list.component.ts    ← AG Grid implementation (migrated from react-analytical-table)
│   └── supplier-list.component.html
├── bank-form/
│   ├── bank-form.component.ts
│   └── bank-form.component.html
├── cash-form/
│   ├── cash-form.component.ts
│   └── cash-form.component.html
├── card-info/
│   ├── card-info.component.ts
│   └── card-info.component.html
└── bank-details/
    ├── bank-details/
    │   ├── bank-details.component.ts
    │   └── bank-details.component.html
    └── bank-details-list/
        ├── bank-details-list.component.ts  ← AG Grid implementation (migrated from react-analytical-table)
        └── bank-details-list.component.html
```

## Routes
- `/base-data/supplier` — `SupplierListComponent` — `BASE_DATA_SUPPLIER`
- `/base-data/supplier-bank` — `BankDetailsListComponent` — `BASE_DATA_SUPPLIER_BANK_DETAILS`

## Purpose
Manages **Suppliers** (vendors) with full contact info and multiple payment methods — **Bank Transfer** and **Cash** records, each independently tracked and approvable.

---

## SupplierListComponent

### Selector
`app-Supplier-management`

### File
`supplier-list/supplier-list.component.ts` (migrated from `react-analytical-table` to `AgGridTableComponent`)

### ViewChildren / Outputs

| Name | Type | Purpose |
|------|------|---------|
| `agGridRef` | `AgGridTableComponent<any>` | Grid ref for programmatic refresh |
| `supplierFormRef` | `SupplierFormComponent` | Opens form dialog |
| `refreshTable` | `@Output EventEmitter<void>` | Propagates to parent (batch counts etc.) |
| `IsDelete` | `@Output EventEmitter<any>` | Passes `"Suppliers/{id}"` to `app-delete-entity` |
| `IsInsertXls` | `@Output EventEmitter<void>` | Triggers `excel-upload-download` import dialog |
| `IsExportXls` | `@Output EventEmitter<void>` | Triggers `excel-upload-download` export |

### Key Methods

| Method | Description |
|--------|-------------|
| `ngOnInit()` | Calls `buildColumns()` — runs after `@Input` values set |
| `buildColumns()` | Builds `AgGridTableColumn[]`; adds edit/delete actions based on permissions |
| `newSupplier()` | Resets form, opens `supplierFormRef` in POST mode |
| `editSupplier(data)` | Loads data + bank/cash info, opens `supplierFormRef` in PUT mode |
| `onFormSaved(event)` | Form save callback — `agGridRef.refreshGridData(true)` + `refreshTable.emit()` |
| `onDeleteSuccess()` | Delete success callback — `agGridRef.refreshGridData(true)` + `refreshTable.emit()` |
| `downloadButtonClick()` | Emits `IsExportXls` → triggers `excel-upload-download` export |
| `uploadButtonClick()` | Emits `IsInsertXls` → triggers `excel-upload-download` import dialog |

### Grid Config (`app-ag-grid-table`)

| Input | Value |
|-------|-------|
| `url` | `Suppliers` |
| `expandQuery` | `bankInfos,supplierBanks,supplierCash` |
| `gridId` | `base-data-supplier-list` |
| `isBase` | `true` — column state persists in localStorage |
| `sortBy` | `id` desc |
| `searchFields` | `['custom_id', 'name']` |
| `selectionMode` | `Single` |
| `gridHeight` | `calc(100vh - 118px)` |
| `showNewButton` | `BASE_DATA_SUPPLIER_CREATE` permission |
| `showActiveButton` | `true` — All / Active / Inactive |
| `showDownload` | `true` → `(downloadButtonClick)` → `IsExportXls.emit()` |
| `showUpload` | `true` → `(uploadButtonClick)` → `IsInsertXls.emit()` |

### Columns (`buildColumns()`)

| Field | Header | Notes |
|-------|--------|-------|
| `is_active` | Active | `AgGridBooleanCellRendererComponent`; `sortable: false` |
| `custom_id` | ID | `width: 130` |
| `name` | Name | `flex: 1` |
| `created_at` | Created At | `valueFormatter` → `toLocaleDateString()`; `filter: false` |
| `actions` | Actions | `AgGridActionCellRendererComponent`; pinned right; permission-gated |

### Actions Column (permission-gated)

| Action | Permission | Icon | Handler |
|--------|-----------|------|---------|
| Edit | `BASE_DATA_SUPPLIER_EDIT` | `edit` | `editSupplier(row)` |
| Delete | `BASE_DATA_SUPPLIER_DELETE` | `delete` (Negative) | `IsDelete.emit('Suppliers/{id}')` |

### Template Components

| Component | Trigger | Purpose |
|-----------|---------|---------|
| `app-supplier-form #supplierForm` | `newSupplier()` / `editSupplier()` | Create/edit supplier dialog |
| `app-delete-entity [IsDelete]` | `IsDelete.emit(...)` | Confirm + execute delete |
| `excel-upload-download` | `IsInsertXls` / `IsExportXls` | Import (`suppliers/import`) + Export (`export/supplier`) |

### Export / Import APIs

| Direction | Endpoint | Trigger |
|-----------|----------|---------|
| Export | `export/supplier` | `IsExportXls.emit()` via `(downloadButtonClick)` |
| Import | `suppliers/import` | `IsInsertXls.emit()` via `(uploadButtonClick)` |

> **Migration note:** Replaced `react-analytical-table` (inline `exportApiUrl`/`importApiUrl` props) with `app-ag-grid-table` + `excel-upload-download`. Download/upload now flow through EventEmitter pair, not handled internally by table.

---

## SupplierFormComponent

### Selector
`app-supplier-form`

### Inputs

| Input | Type | Purpose |
|-------|------|---------|
| `saveMode` | `string` | `'POST'` or `'PUT'` |

### Outputs

| Output | Type | Purpose |
|--------|------|---------|
| `RefreshTable` | `EventEmitter<any>` | Reload parent list after save |

### Key Properties

| Property | Purpose |
|----------|---------|
| `selectedTab` | Active tab: `'coreData'`, `'bank'`, or `'cash'` |
| `saveCashMode` | `saveMode` for cash sub-form |
| `saveBankMode` | `saveMode` for bank sub-form |
| `SupplierBankInfoList` | `SupplierBankInfo[]` — bank transfer records |
| `SupplierCashInfoList` | `SupplierBankInfo[]` — cash payment records |
| `editBankIndex` | `number \| null` — index of bank record being edited |
| `editCashIndex` | `number \| null` — index of cash record being edited |
| Multiple `ValueState` maps | Per-field validation for supplier core data |

### Key Methods

| Method | Description |
|--------|-------------|
| `saveSupplier()` | Validates core data, saves supplier, calls `savePaymentInfo()` for both payment types |
| `savePaymentInfo(supplierId, type)` | Batch-saves all bank/cash records via `$batch` or sequential POSTs |
| `getCashAndBankInfo(type)` | Loads existing `SupplierBankInfos` filtered by `mode_of_payment` |
| `submitCashAndBankInfo(type)` | Adds or updates single bank/cash record in local list |
| `openBankModal()` | Shows `BankFormComponent` dialog |
| `openCashModal()` | Shows `CashFormComponent` dialog |
| `editBank(data)` | Sets `saveBankMode = 'PUT'`, loads record into `BankFormComponent` |
| `editCash(data)` | Sets `saveCashMode = 'PUT'`, loads record into `CashFormComponent` |
| `checkValidation(event, field)` | Real-time ValueState update |
| `onTabSelect(event)` | Updates `selectedTab` |

### API Calls

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `Suppliers` | Create supplier |
| PUT | `Suppliers(${id})` | Update supplier |
| GET | `SupplierBankInfos?$filter=supplier_id eq ${id} and mode_of_payment eq '${mode}'` | Load payment records |
| POST | `$batch` | Bulk-save payment info records |
| POST/PUT | `SupplierBankInfos` / `SupplierBankInfos(${id})` | Individual payment record ops |

### Template Structure
```
<app-supplier-form>
  └── TabContainer
      ├── Tab: Core Data
      │   ├── supplierID (required)
      │   ├── name (required)
      │   ├── address (required)
      │   └── phone, email, etc.
      ├── Tab: Bank
      │   ├── CardInfoComponent (displays bank records list)
      │   └── BankFormComponent dialog (add/edit)
      └── Tab: Cash
          ├── CardInfoComponent (displays cash records list)
          └── CashFormComponent dialog (add/edit)
```

### Supplier Model (inferred)
```typescript
interface Supplier {
  id?: number;
  supplier_id: string;    // business/vendor ID — required
  name: string;           // required
  address: string;        // required
  phone?: string;
  email?: string;
  is_active: boolean;
}
```

---

## BankFormComponent

### Selector
`app-bank-form`

### Inputs

| Input | Type | Purpose |
|-------|------|---------|
| `open` | `boolean` | Controls dialog visibility |
| `saveBankMode` | `saveMode` | POST or PUT |
| `loading` | `boolean` | Save in progress |
| `SupplierBankInfo` | `SupplierBankInfo` | Model being edited |

### Outputs

| Output | Type | Purpose |
|--------|------|---------|
| `submitBank` | `EventEmitter<void>` | User clicks Save — parent validates and saves |
| `cancelBank` | `EventEmitter<void>` | User clicks Cancel |

### Key Methods

| Method | Description |
|--------|-------------|
| `validateBankForm()` | Validates all required bank fields — returns `false` if any empty |
| `onSubmit()` | Runs `validateBankForm()`, emits `submitBank` |
| `onCancel()` | Resets form, emits `cancelBank` |

### Validated Fields (all required)
`bank_name`, `account_holder_name`, `account_number`, `account_type`, `branch_name`, `branch_address`, `routing_number`, `country`

---

## CashFormComponent

### Selector
`app-cash-form`

### Same structure as `BankFormComponent` for cash payment info.

### Outputs
- `submitCash: EventEmitter<void>`
- `cancelCash: EventEmitter<void>`

### Validated Fields
`amount` (required), `payment_date` (required)

---

## CardInfoComponent

### Selector
`app-card-info`

### Purpose
Reusable display card for listing payment method records (bank and cash tabs).

### Inputs

| Input | Type | Purpose |
|-------|------|---------|
| `tabId` | `string` | Identifies which tab this card belongs to |
| `tabText` | `string` | Tab label text |
| `items` | `any[]` | Payment records to display |
| `selectedTab` | `string` | Current active tab (conditional rendering) |
| `icon` | `string` | Icon name for card header |
| `fields` | `{ label, key, format? }[]` | Field definitions for card body |
| `newButtonText` | `string` | Label for "Add New" button |
| `defaultTitle` | `string` | Shown when `items` is empty |

### Outputs

| Output | Type | Purpose |
|--------|------|---------|
| `openModal` | `EventEmitter<void>` | "Add New" button clicked |
| `editItem` | `EventEmitter<any>` | Edit icon clicked on record |
| `deleteItemFromServer` | `EventEmitter<number>` | Delete saved record (has `id`) |
| `deleteItemLocal` | `EventEmitter<number>` | Delete unsaved local record (by index) |

---

## BankDetailsComponent (Approval)

### Selector
`app-bank-details`

### Purpose
Approval workflow for bank records. Read-only view with "Approve" action.

### Inputs

| Input | Type | Purpose |
|-------|------|---------|
| `isOpen` | `EventEmitter<void>` | Opens dialog |
| `SupplierBankInfo` | `SupplierBankInfo` | Record to view/approve |
| `approvedAt` | `string \| null` | Prior approval timestamp |
| `createdBy` | `string \| null` | Creator display name |
| `saveMode` | `string` | Context flag |

### Outputs

| Output | Type | Purpose |
|--------|------|---------|
| `IsOpenToastAlert` | `EventEmitter<void>` | Triggers notification |
| `isSuccessChange` | `EventEmitter<void>` | Fires after approval succeeds |

### Key Methods

| Method | Description |
|--------|-------------|
| `markAsApprove()` | Reads `user_id` from `localStorage`, sets `is_active = true`, `approved_at = now`, `approved_by = userId`, PUTs to server |

### API Calls
| Method | Endpoint | Purpose |
|--------|----------|---------|
| PUT | `SupplierBankInfos/${id}` | Approve bank record |

---

## SupplierBankInfo Model (inferred)
```typescript
interface SupplierBankInfo {
  id?: number;
  supplier_id: number;
  mode_of_payment: 'BANK_TRANSFER' | 'CASH';
  // Bank fields:
  bank_name?: string;
  account_holder_name?: string;
  account_number?: string;
  account_type?: string;
  branch_name?: string;
  branch_address?: string;
  routing_number?: string;
  country?: string;
  // Cash fields:
  amount?: number;
  payment_date?: string;
  // Approval:
  is_active: boolean;
  approved_at?: string;
  approved_by?: number;
}
```

---

## Services Injected

| Service | Usage |
|---------|-------|
| `CommonService` | All API calls |
| `ToastService` | Notifications |
| `RolePermissionService` | Action visibility |

## Validation Rules

| Form | Required Fields |
|------|----------------|
| Supplier core | `supplier_id`, `name`, `address` |
| Bank form | `bank_name`, `account_holder_name`, `account_number`, `account_type`, `branch_name`, `branch_address`, `routing_number`, `country` |
| Cash form | `amount`, `payment_date` |

## Notes
- Supplier Core Data has an optional **Origin** selector. It loads active
  `Origins` and stores the nullable `suppliers.origin_id`; leaving it blank is
  valid. The supplier's `origin` relationship is OData-expandable and is used
  by the Raw Cotton Received report.
- Payment records (`SupplierBankInfo`) saved after supplier created — `savePaymentInfo` called with new `supplier_id`.
- `BankDetailsListComponent` (`/supplier-bank`) = separate approval queue for finance teams — migrated from `react-analytical-table` to `AgGridTableComponent`.
- `markAsApprove()` reads approver `user_id` from `localStorage` — tightly coupled to session storage structure.
- `CardInfoComponent` only fully reusable display component in supplier feature; not used outside supplier management.

---

## BankDetailsListComponent

### Selector
`app-bank-details-list`

### File
`bank-details-list/bank-details-list.component.ts` (migrated from `react-analytical-table` + `.tsx` to `AgGridTableComponent`)

### ViewChildren / Outputs

| Name | Type | Purpose |
|------|------|---------|
| `agGridRef` | `AgGridTableComponent<SupplierBankInfo>` | Grid ref for programmatic refresh |
| `IsApprove` | `@Output EventEmitter<void>` | Passed as `[isOpen]` to `app-bank-details` to open approval dialog |

### Key Methods

| Method | Description |
|--------|-------------|
| `buildColumns()` | Builds `AgGridTableColumn[]` — called in constructor |
| `HandleApproveInfo(supplier)` | Deserializes selected row, emits `IsApprove`, populates `Supplier_Info` / `createdBy` / `approvedAt` |
| `onSuccessChange()` | Called on `(isSuccessChange)` from `app-bank-details` — calls `agGridRef.refreshGridData(true)` |

### Grid Config (`app-ag-grid-table`)

| Input | Value |
|-------|-------|
| `gridId` | `base-data-supplier-bank-details` |
| `endpoint` | `SupplierBankInfos` |
| `expand` | `supplier,user,createdBy` |
| `isBase` | `true` — column state persists in localStorage |
| `selectionMode` | `Single` |
| `showSegmentButton` | `true` — All / Verified / Non-Verified |
| `showAction` | `true` |
| `editPermission` | `true` |
| `showEditButton` | `false` |
| `showDeleteButton` | `false` |

### Segment Button Filters

| ID | Label | OData Filter |
|----|-------|--------------|
| `all` | All | _(none)_ |
| `verified` | Verified | `approved_at ne null` |
| `non-verified` | Non-Verified | `approved_at eq null` |

### Action Buttons

| Button | Permission | Icon | Handler |
|--------|-----------|------|---------|
| View Details | `BASE_DATA_SUPPLIER_BANK_VERIFIED` | `information` | `HandleApproveInfo(row)` |

### Columns (`buildColumns()`)

| Field | Header | Notes |
|-------|--------|-------|
| `is_active` | Status | `AgGridBooleanCellRendererComponent`; `sortable: false` |
| `supplier_id` | Supplier Name | `valueGetter` → `supplier.name` |
| `format_of_payment` | Mode Of Payment | |
| `bank_name` | Bank Name | |
| `account_number` | Account Number | |
| `approved_by` | Verified By | `valueGetter` → `user.name` |
| `created_by` | Created By | `valueGetter` → `createdBy.name` |
| `approved_at` | Verified At | `valueFormatter` via `DateFormatterService`; `filter: false` |
| `created_at` | Created At | `valueFormatter` → `toLocaleDateString()`; `filter: false` |
