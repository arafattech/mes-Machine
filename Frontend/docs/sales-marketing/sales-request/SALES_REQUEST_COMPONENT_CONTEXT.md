# Sales Management — Sales Request

## Files
- `sales-request/sales-request.component.ts`
- `sales-request/sales-request.component.html`

## Selector
`app-sales-request`

## Route
`sales-requests` — guarded by `SALES_SALES_REQUESTS`

## Purpose
Shows Sales Orders in `PENDING` status awaiting manager approval. Managers approve/reject. View-only access permission-guarded. Reuses `OrderFormComponent` read-only for order details.

---

## Grid Implementation — `app-ag-grid-table`

### ViewChild
```typescript
@ViewChild("agGridRef") agGridRef?: AgGridTableComponent;
@ViewChild("orderFrom") formRef!: OrderFormComponent;
```

### Data Source
```typescript
dataSource: AgGridTableODataSourceConfig<any> = {
  type: "odata",
  endpoint: "SalesOrders",
  expand: "items($expand=product($expand=uom)),client,createdBy",
  filter: "status eq 'PENDING'",
  sortDirection: "desc",
};
```

### Toolbar Config
```typescript
toolbarConfig: AgGridTableToolbarConfig = {
  headerTitle: $localize`Sales Request`,
  showSearch: true,
  showRowCount: true,
  showScanner: true,
  showNewButton: false,
};
```

### Display Config
```typescript
displayConfig: AgGridTableDisplayConfig = {
  gridHeight: "calc(100vh - 145px)",
};
```

### Columns (`buildColumns()`)

| Column | Field / colId | Notes |
|--------|---------------|-------|
| ID | `custom_id` | width 100 |
| Client | `client_name` | `valueGetter` → `client.name` |
| Status | `status` | inline `cellRenderer` badge (PENDING/APPROVED/REJECTED/DRAFT) |
| Delivery Date | `expected_delivery_date` | `dataType: UI5DateRangePicker`; `valueFormatter` via `DateFormatterService` |
| Total Discount | `discount` | `dataType: Number` |
| Total VAT | `vat` | `dataType: Number` |
| Total | `subtotal` | `dataType: Number` |
| Items | `items_count` | `valueGetter` count; `cellRenderer` blue badge; filter/sort off |
| Created By | `created_by_name` | `valueGetter` → `createdBy.name` |

### Actions Column (inside `buildColumns()`)

`AgGridTableRowAction[]` built inside `buildColumns()`, pushed onto `cols` as last column using `AgGridActionCellRendererComponent`. Dispatched via `onAction()`.

| Button | id | Permission | Design |
|--------|-----|------------|--------|
| View | `view` | `SALES_SALES_REQUEST_VIEW` | Transparent, icon: `show` |
| Download | `download` | always shown | Transparent, icon: `download` |
| Approve | `approve` | `SALES_SALES_REQUEST_APPROVE` | Positive, icon: `accept`, label: `Approve` |
| Reject | `reject` | `SALES_SALES_REQUEST_REJECT` | Negative, icon: `decline`, label: `Reject` |

Actions column: `width: 240, minWidth: 200, pinned: 'right', lockPinned: true`.

### Template
```html
<app-ag-grid-table
  #agGridRef
  [columns]="columns"
  [dataSource]="dataSource"
  [toolbarConfig]="toolbarConfig"
  [displayConfig]="displayConfig"
  selectionMode="Single"
  [selectionRowBehavior]="'RowOnly'"
  [isBase]="true"
  [showIllustratedMessage]="true"
  IllustratedName="NoData"
></app-ag-grid-table>
```

---

## State Properties

| Property | Type | Purpose |
|----------|------|---------|
| `isShoWaring` | `boolean` | Controls approve/reject confirmation dialog |
| `waringInfo` | `{ id, status, title, message, rejectNote }` | Pending action data |
| `isLoading` | `boolean` | PDF download busy state |
| `columns` | `AgGridTableColumn<any>[]` | Built in constructor via `buildColumns()`; includes Actions column |

## Key Methods

| Method | Description |
|--------|-------------|
| `buildColumns()` | All columns + `AgGridActionCellRendererComponent`; permission-gates rowActions |
| `onAction(actionId, row)` | Dispatches view/download/approve/reject |
| `openWarning(status, id)` | Populates `waringInfo`, shows confirmation dialog |
| `confirmWarning()` | Hides dialog; calls `onChangeAction()` |
| `onChangeAction(payload, id)` | PUTs `SalesOrders/<id>`; calls `agGridRef?.refreshGridData(true)` |
| `viewOrder(data, isDisabled)` | Opens `OrderFormComponent` PUT/read-only |
| `downloadPI(data)` | POSTs `sales/invoice/generate` (Blob) → PDF download |
| `closeWarning()` | Sets `isShoWaring = false` |

## API Calls

| Method | Endpoint | OData | Purpose |
|--------|----------|-------|---------|
| PUT | `SalesOrders/<id>` | `true` | Approve/reject order |
| POST | `sales/invoice/generate` | `false` (Blob) | Download PDF invoice |

## Services Injected

| Service | Usage |
|---------|-------|
| `CommonService` | PUT status change; POST PDF download |
| `DateFormatterService` | Delivery date `valueFormatter`; date pre-population in view mode |
| `RolePermissionService` | `hasPermission` in `buildColumns()` for rowActions gating |

## Notes
- `dataSource.filter = "status eq 'PENDING'"` — pending orders only.
- `reject_note` in payload only when status `REJECTED`.
- `OrderFormComponent` shared; `isDisabled = true` blocks editing.
- All rows PENDING — no per-row disable on approve/reject.