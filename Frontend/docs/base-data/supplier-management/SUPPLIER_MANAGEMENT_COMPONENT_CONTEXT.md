# SUPPLIER_MANAGEMENT_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| Component group | `SupplierListComponent` + `BankDetailsListComponent` |
| Module directory | `src/app/modules/base-data-management/supplier-management/` |
| Component type | List + Dialog (CRUD) + Approval workflow |
| Table | `app-ag-grid-table` (AG Grid) |
| Purpose | `SupplierListComponent` manages vendor master data with Bank and Cash payment sub-records. `BankDetailsListComponent` is a separate approval queue for bank payment records — finance teams use it to verify/approve bank details submitted by suppliers. |

---

## SupplierListComponent

### File

| Property | Value |
|---|---|
| TS file | `src/app/modules/base-data-management/supplier-management/supplier-list/supplier-list.component.ts` |
| HTML file | `src/app/modules/base-data-management/supplier-management/supplier-list/supplier-list.component.html` |
| Selector | `app-Supplier-management` |
| Route | `/base-data/supplier` — guarded by `BASE_DATA_SUPPLIER` |

---

### Outputs (@Output)

| Output name | Event type | Purpose |
|---|---|---|
| `refreshTable` | `EventEmitter<void>` | Propagates to parent (e.g., batch count refresh) after save/delete. |
| `IsDelete` | `EventEmitter<any>` | Emitted with path `Suppliers/${id}`. Passed as `[IsDelete]` to `app-delete-entity`. |
| `IsInsertXls` | `EventEmitter<void>` | Triggers `excel-upload-download` import dialog. |
| `IsExportXls` | `EventEmitter<void>` | Triggers `excel-upload-download` export. |

---

### State Properties

| Property | Type | Purpose |
|---|---|---|
| `columns` | `AgGridTableColumn<any>[]` | Column definitions built by `buildColumns()` in `ngOnInit`. |
| `dataSource` | `AgGridTableODataSourceConfig<any>` | OData data source config for AG Grid. |
| `toolbarConfig` | `AgGridTableToolbarConfig` | Toolbar config including search, segment button, New + download + upload buttons. |
| `actionButtons` | `AgGridCustomButton[]` | Custom per-row action buttons (edit, delete). |

### `dataSource` Config

```typescript
{
  type: 'odata',
  endpoint: 'Suppliers',
  expand: 'bankInfos,supplierBanks,supplierCash',
  sortBy: 'id',
  sortDirection: 'desc',
  pageSize: 40,
  scrollPagination: true,
  searchFields: ['custom_id', 'name'],
}
```

---

### ViewChild / ViewChildren

| Ref name | Type | Purpose |
|---|---|---|
| `agGridRef` | `AgGridTableComponent<any>` | Grid ref for `refreshGridData(true)` after mutations. |
| `supplierForm` | `SupplierFormComponent` | Opens create/edit supplier dialog. |

---

### Lifecycle Hooks

#### `ngOnInit`

```typescript
this.columns = this.buildColumns();
```

Builds AG Grid column definitions. Called after `@Input` values are set.

---

### Methods — DETAILED

#### `buildColumns(): AgGridTableColumn<any>[]`

**Columns returned (in order):**

1. **Active** (`field: 'is_active'`): `AgGridBooleanCellRendererComponent`. `sortable: false`.
2. **ID** (`field: 'custom_id'`): `width: 130`.
3. **Name** (`field: 'name'`): `flex: 1`.
4. **Created At** (`field: 'created_at'`): `valueFormatter` → `toLocaleDateString()`. Filter disabled.

Edit and delete via `customActionButtons` (permission-gated).

#### `newSupplier()`
Resets `supplierFormRef`, sets `saveMode = 'POST'`, opens dialog.

#### `editSupplier(data)`
Loads row + bank/cash info into `supplierFormRef`, sets `saveMode = 'PUT'`, opens dialog.

#### `onFormSaved(event)`
`agGridRef.refreshGridData(true)` + `refreshTable.emit()`.

#### `onDeleteSuccess()`
`agGridRef.refreshGridData(true)` + `refreshTable.emit()`.

#### `downloadButtonClick()`
Emits `IsExportXls` → `excel-upload-download` export (`export/supplier`).

#### `uploadButtonClick()`
Emits `IsInsertXls` → `excel-upload-download` import (`suppliers/import`).

---

### Template Bindings & Structure

#### `<app-ag-grid-table>` (data table)

| Binding | Value | Effect |
|---|---|---|
| `[dataSource]` | `dataSource` | OData source (`Suppliers`) |
| `[columns]` | `columns` | AG Grid column definitions |
| `[toolbarConfig]` | `toolbarConfig` | Toolbar title, search, segment button, New/upload/download buttons |
| `gridId` | `"base-data-supplier-list"` | Column state persistence key |
| `[isBase]` | `true` | Enables column-state persistence |
| `selectionMode` | `"Single"` | Single row selection |
| `[showAction]` | `true` | Shows action column |
| `[editPermission]` | `true` | Required alongside `showAction` for action column to render |
| `[showEditButton]` | `false` | Custom action buttons used instead |
| `[showDeleteButton]` | `false` | Custom action buttons used instead |
| `[customActionButtons]` | `actionButtons` | Permission-gated Edit + Delete |

#### `<app-supplier-form #supplierForm>`

Multi-tab dialog: Core Data / Bank / Cash. Emits `RefreshTable` → `onFormSaved()`.

### Origin

Core Data includes an optional Origin select. On initialization the form loads
active `Origins`, writes the chosen numeric ID to `Supplier.origin_id`, and
allows an empty selection. The database FK is nullable and uses `nullOnDelete`,
so an origin is never required for a supplier.

#### `<app-delete-entity>`

Receives `[IsDelete]="IsDelete"`. Calls `onDeleteSuccess()` on `(isSuccess)`.

#### `<excel-upload-download>`

Bound to `IsInsertXls` / `IsExportXls`. Import: `suppliers/import`. Export: `export/supplier`.

---

### API Calls

| HTTP Method | Endpoint | When |
|---|---|---|
| `GET` | `Suppliers` + OData params (expand bankInfos,supplierBanks,supplierCash) | Grid load |
| `POST` | `Suppliers` | Create supplier |
| `PUT` | `Suppliers(${id})` | Update supplier |
| `DELETE` | `Suppliers/${id}` | Via `app-delete-entity` |
| `GET` | `export/supplier` | Export via `IsExportXls` |
| `POST` | `suppliers/import` | Import via `IsInsertXls` |

---

### Services Injected

| Service | Methods used |
|---|---|
| `RolePermissionService` | `hasPermission(permission)` |

---

---

## BankDetailsListComponent

### File

| Property | Value |
|---|---|
| TS file | `src/app/modules/base-data-management/supplier-management/bank-details/bank-details-list/bank-details-list.component.ts` |
| HTML file | `src/app/modules/base-data-management/supplier-management/bank-details/bank-details-list/bank-details-list.component.html` |
| Selector | `app-bank-details-list` |
| Route | `/base-data/supplier-bank` — guarded by `BASE_DATA_SUPPLIER_BANK_DETAILS` |

Finance team approval queue for supplier bank payment records.

---

### Outputs (@Output)

| Output name | Event type | Purpose |
|---|---|---|
| `IsApprove` | `EventEmitter<void>` | Passed as `[isOpen]` to `app-bank-details`. That component subscribes internally and opens its approval dialog when emitted. |

---

### State Properties

| Property | Type | Purpose |
|---|---|---|
| `columns` | `AgGridTableColumn<SupplierBankInfo>[]` | Column definitions built by `buildColumns()` in constructor. |
| `Supplier_Info` | `SupplierBankInfo` | Row data for currently-selected bank record. Passed to `app-bank-details`. |
| `approvedAt` | `string \| null` | Prior approval timestamp. Passed to `app-bank-details`. |
| `createdBy` | `string \| null` | Creator display name. Passed to `app-bank-details`. |
| `dataSource` | `AgGridTableODataSourceConfig<SupplierBankInfo>` | OData source config. |
| `toolbarConfig` | `AgGridTableToolbarConfig` | Toolbar config. |
| `segmentButtonItems` | `AgGridSegmentItem[]` | Custom segment buttons: All / Verified / Non-Verified. |
| `actionButtons` | `AgGridCustomButton[]` | Custom per-row action: View Details (info). |

### `dataSource` Config

```typescript
{
  type: 'odata',
  endpoint: 'SupplierBankInfos',
  expand: 'supplier,user,createdBy',
  pageSize: 40,
  scrollPagination: true,
  searchFields: ['bank_name', 'account_number'],
}
```

### `segmentButtonItems` Config

```typescript
[
  { id: 'all',          name: $localize`All`,          defaultSelect: true, filter: '' },
  { id: 'verified',     name: $localize`Verified`,     filter: 'approved_at ne null' },
  { id: 'non-verified', name: $localize`Non-Verified`, filter: 'approved_at eq null' },
]
```

---

### ViewChild / ViewChildren

| Ref name | Type | Purpose |
|---|---|---|
| `agGridRef` | `AgGridTableComponent<SupplierBankInfo>` | Grid ref for `refreshGridData(true)` after approval. |

---

### Lifecycle Hooks

#### Constructor

```typescript
this.columns = this.buildColumns();
```

Builds AG Grid column definitions at construction time.

---

### Methods — DETAILED

#### `buildColumns(): AgGridTableColumn<SupplierBankInfo>[]`

**Columns returned (in order):**

1. **Status** (`field: 'is_active'`): `AgGridBooleanCellRendererComponent`. `sortable: false`.
2. **Supplier Name** (`field: 'supplier_id'`): `valueGetter` → `params.data?.supplier?.name`.
3. **Mode Of Payment** (`field: 'format_of_payment'`): Plain text.
4. **Bank Name** (`field: 'bank_name'`): Plain text.
5. **Account Number** (`field: 'account_number'`): Plain text.
6. **Verified By** (`field: 'approved_by'`): `valueGetter` → `params.data?.user?.name`.
7. **Created By** (`field: 'created_by'`): `valueGetter` → `params.data?.createdBy?.name`.
8. **Verified At** (`field: 'approved_at'`): `valueFormatter` via `DateFormatterService`. Filter disabled.
9. **Created At** (`field: 'created_at'`): `valueFormatter` → `toLocaleDateString()`. Filter disabled.

#### `HandleApproveInfo(supplier: SupplierBankInfo)`
Deserializes selected row into `Supplier_Info`. Sets `createdBy` and `approvedAt` from expanded relations. Emits `IsApprove` to open `app-bank-details` approval dialog.

#### `onSuccessChange()`
Called on `(isSuccessChange)` from `app-bank-details`. Calls `agGridRef.refreshGridData(true)`.

---

### Template Bindings & Structure

#### `<app-ag-grid-table>` (data table)

| Binding | Value | Effect |
|---|---|---|
| `[dataSource]` | `dataSource` | OData source (`SupplierBankInfos` expand supplier,user,createdBy) |
| `[columns]` | `columns` | AG Grid column definitions |
| `[toolbarConfig]` | `toolbarConfig` | Toolbar title, search |
| `[segmentButtonItems]` | `segmentButtonItems` | All / Verified / Non-Verified OData filter segments |
| `gridId` | `"base-data-supplier-bank-details"` | Column state persistence key |
| `[isBase]` | `true` | Enables column-state persistence |
| `selectionMode` | `"Single"` | Single row selection |
| `[showAction]` | `true` | Shows action column |
| `[editPermission]` | `true` | Required alongside `showAction` for action column to render |
| `[showEditButton]` | `false` | No edit; approval only |
| `[showDeleteButton]` | `false` | No delete |
| `[customActionButtons]` | `actionButtons` | View Details (info icon, `BASE_DATA_SUPPLIER_BANK_VERIFIED` permission) |

#### `<app-bank-details>`

| Binding | Value |
|---|---|
| `[isOpen]` | `IsApprove` (EventEmitter — not a boolean) |
| `[SupplierBankInfo]` | `Supplier_Info` |
| `[approvedAt]` | `approvedAt` |
| `[createdBy]` | `createdBy` |
| `(isSuccessChange)` | `onSuccessChange()` |

> **Critical:** `[isOpen]` expects `EventEmitter<void>` — `app-bank-details` subscribes to it internally. Pass the EventEmitter itself, NOT a boolean.

---

### API Calls

| HTTP Method | Endpoint | When |
|---|---|---|
| `GET` | `SupplierBankInfos` + OData params | Grid load / filter / sort / after approval |
| `PUT` | `SupplierBankInfos/${id}` | Approval action via `app-bank-details.markAsApprove()` |

---

### Services Injected

| Service | Methods used |
|---|---|
| `DateFormatterService` | `format(date)` for `approved_at` column |
| `RolePermissionService` | `hasPermission(permission)` for action visibility |

---

## Key Business Logic (Both Components)

1. **`isOpen` as EventEmitter pattern:** `app-bank-details` uses `@Input() isOpen: EventEmitter<void>` — it subscribes internally. Pass the component's own `IsApprove` EventEmitter as `[isOpen]`, not a boolean flag.

2. **Segment buttons:** `BankDetailsListComponent` uses custom `segmentButtonItems` (All/Verified/Non-Verified) for OData filter toggling. These are NOT the same as `showSegmentButton: true` (which renders All/Active/Inactive). Using both simultaneously causes duplicate `ui5-segmented-button` elements.

3. **Action column guard:** Both `[showAction]="true"` AND `[editPermission]="true"` must be set for the action column to render (line 1513 guard in `AgGridTableComponent`).

4. **`markAsApprove()` localStorage coupling:** `BankDetailsComponent.markAsApprove()` reads `user_id` from `localStorage` to set `approved_by`. Tightly coupled to session storage structure.

5. **OData relation fields:** `approved_by` and `created_by` columns use `valueGetter` to traverse expanded relations (`user.name`, `createdBy.name`) rather than using the numeric FK field directly.

6. **AG Grid migration notes:** Both list components replaced `react-analytical-table` / `.tsx` with `AgGridTableComponent`. `buildColumns()` returns typed `AgGridTableColumn[]`. `refreshGridData(true)` replaces `onFilterAndSorting()`.
