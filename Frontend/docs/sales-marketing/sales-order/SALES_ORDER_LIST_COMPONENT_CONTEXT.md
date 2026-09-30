# Sales Management — Sales Order

## Files
- `sales-order/sales-order.component.ts`
- `sales-order/sales-order.component.html`

## Selector
`app-sales-order`

## Route
`sales-orders` — guarded by `SALES_SALES_ORDERS`

## Purpose
Shows all Sales Orders. Create, edit/view, delete, PDF download, status-change (Send/Cancel). Columns + button visibility permission-guarded. Delegates create/update + item logic to `OrderFormComponent`.

---

## Grid Implementation — `app-ag-grid-table`

### ViewChild
```typescript
@ViewChild("agGridRef") agGridRef?: AgGridTableComponent;
@ViewChild("orderFrom") formRef!: OrderFormComponent;
```

### Data Source
```typescript
dataSource: AgGridTableODataSourceConfig<SalesOrder> = {
  type: "odata",
  endpoint: this.isv8 ? "sales_orders" : "SalesOrders",
  expand: this.isv8
    ? "clients,sale_order_items($expand=products($expand=uoms)),users"
    : "client,createdBy,items($expand=product($expand=uom))",
  sortDirection: "desc",
  searchFields: this.isv8
    ? ["custom_id", "clients.name", "status", "users.name"]
    : ["custom_id", "client.name", "status", "createdBy.name"],
};
```
`restoreTable()` reassigns `dataSource` via `buildDataSource()` and rebuilds columns.

### Toolbar Config
```typescript
toolbarConfig: AgGridTableToolbarConfig = {
  headerTitle: $localize`Sales Order`,
  showSearch: true,
  showRowCount: true,
  showRefreshButton: true,
  refButtonText: $localize`Reset`,
  showNewButton: this.permission.hasPermission(Permissions.SALES_SALES_ORDER_CREATE),
  addButtonText: $localize`New`,
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
| Client | `client.name` / `clients.name` | `valueGetter` → `client?.name` (isv8: `clients?.name`); `filterControl: singleSelect` from `clientList` |
| Status | `status` | inline `cellRenderer` badge (DRAFT/PENDING/APPROVED/REJECTED); `filterControl: singleSelect` with ALL/DRAFT/APPROVED/REJECTED |
| Sub Total | `subtotal` | `dataType: Number` |
| Total VAT | `vat` | `dataType: Number` |
| Total Discount | `discount_amount` | `dataType: Number` |
| Total | `grand_total` | `dataType: Number` |
| Items | `items_count` | `valueGetter` count; `cellRenderer` blue badge; filter/sort off |
| Created By | `createdBy.name` / `users.name` | `valueGetter` → `createdBy?.name` (isv8: `users?.name`) |
| Delivary Date | `expected_delivery_date` | `dataType: UI5DateRangePicker`; `valueFormatter` via `DateFormatterService` |

**isv8 accessor differences (all in `valueGetter` lambdas):**
- Client: `clients?.name` vs `client?.name`
- Items: `sale_order_items` vs `items`
- Created By: `users?.name` vs `createdBy?.name`

### Actions Column (inside `buildColumns()`)

`AgGridTableRowAction[]` is built inside `buildColumns()`. The Actions column is added only when the user has `SALES_SALES_ORDER_CREATE`, `SALES_SALES_ORDER_EDIT`, or `SALES_SALES_ORDER_DELETE`, matching the old custom-table behavior. The column uses `AgGridActionCellRendererComponent` as the last pinned-right column. `width: 240, minWidth: 220`. Actions dispatch through `onAction()`.

| Button | id | Condition | Design |
|--------|-----|-----------|--------|
| Edit | `edit` | `visible`: `status === DRAFT && SALES_SALES_ORDER_EDIT` | Transparent, icon: `edit` |
| View | `show` | `visible`: NOT (DRAFT && EDIT perm) | Transparent, icon: `show` |
| Download | `download` | always shown when Actions column exists | Transparent, icon: `download` |
| Delete | `delete` | guard: `SALES_SALES_ORDER_DELETE`; `disabled` for APPROVED/REJECTED/PENDING | Transparent, icon: `delete` |
| Send | `send` | guard: `SALES_SALES_ORDER_SEND`; `visible`: `status === DRAFT` | Emphasized |
| Cancel | `cancel-order` | guard: `SALES_SALES_ORDER_SEND`; `visible`: `status === PENDING` | Default |
| Sent | `sent` | guard: `SALES_SALES_ORDER_SEND`; `visible`: APPROVED/REJECTED; always `disabled` | Default |

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
  (newButtonClick)="newItem()"
  (refreshButtonClick)="restoreTable()"
></app-ag-grid-table>
```

---

## State Properties

| Property | Type | Purpose |
|----------|------|---------|
| `dataSource` | `AgGridTableODataSourceConfig<SalesOrder>` | OData source; updated in `restoreTable()` for isv8 |
| `toolbarConfig` | `AgGridTableToolbarConfig` | Toolbar — search + row count + refresh + new button |
| `displayConfig` | `AgGridTableDisplayConfig` | Grid height |
| `columns` | `AgGridTableColumn<any>[]` | Built in constructor + `getClientList()` callback; includes Actions column; rebuilt in `restoreTable()` |
| `isOpenWarning` | `boolean` | Status-change confirm dialog |
| `SalesOrder` | `SalesOrder` | Row data for pending status change |
| `setStatus` | `SalesStatus \| undefined` | Target status for pending status change |
| `isLoading` | `boolean` | PDF download busy flag |
| `isv8` | `boolean` | Schema version flag (hardcoded `false`); accessors maintained |
| `clientList` | `{ value: string; text: string }[]` | Private; pre-loaded clients for Client column filter |

## Key Methods

| Method | Description |
|--------|-------------|
| `constructor()` | Builds initial columns and calls `getClientList()` |
| `getClientList()` | GETs `/Clients` OData; populates `clientList`; rebuilds columns so Client filter options appear |
| `buildColumns()` | Returns `AgGridTableColumn<any>[]` with isv8-aware fields/valueGetters and permission-gated row actions |
| `buildDataSource()` | Returns isv8-aware OData endpoint, expand, sort direction, and search fields |
| `onStatusChange(data, type, status?)` | `show`: stores status + opens dialog. `action`: PUTs status; calls `refreshGridData(true)` |
| `downloadPI(data)` | POSTs `sales/invoice/generate` (Blob) → PDF download |
| `editOrder(data, isDisabled)` | Opens `OrderFormComponent` in PUT mode; `isDisabled=true` for non-DRAFT or no-EDIT-perm |
| `deletePI(data)` | Emits `IsDelete` with `SalesOrders/<id>` |
| `newItem()` | Opens form in POST/DRAFT mode |
| `saveEvent()` | `refreshGridData(true)` + closes form |
| `updateTable()` | `refreshGridData(true)` |
| `onAction(actionId, row)` | Dispatches edit/show/download/delete/send/cancel-order to respective methods |
| `restoreTable()` | Reassigns `dataSource` (isv8-aware), rebuilds columns (incl. actions), refreshes grid |

## API Calls

| Method | Endpoint | OData | Purpose |
|--------|----------|-------|---------|
| GET | `Clients` | `true` | Pre-load client list for filter |
| PUT | `SalesOrders/<id>` | `true` | Update order status |
| POST | `sales/invoice/generate` | `false` (Blob) | Download PDF invoice |

## Services Injected

| Service | Usage |
|---------|-------|
| `CommonService` | `get`, `put`, `post<Blob>` |
| `ToastService` | `show('edit')` on status change success |
| `DateFormatterService` | `formatDate()` for delivery date `valueFormatter` + `editOrder` pre-population |
| `ChangeDetectorRef` | `detectChanges()` after PDF download |
| `RolePermissionService` | `hasPermission()` in `toolbarConfig` + `buildColumns()` for rowActions gating |

## Permission Matrix

| Permission | Effect |
|---|---|
| `SALES_SALES_ORDER_CREATE` | Shows toolbar New button; contributes to `showActionColumn` |
| `SALES_SALES_ORDER_EDIT` | Enables DRAFT row edit; contributes to `showActionColumn` |
| `SALES_SALES_ORDER_DELETE` | Shows delete button; contributes to `showActionColumn` |
| `SALES_SALES_ORDER_SEND` | Shows Send/Cancel/Sent buttons (does NOT contribute to `showActionColumn`) |

## Maintenance Notes

- `isv8` hardcoded `false`; accessor differences maintained in `valueGetter` lambdas — update `restoreTable()` if isv8 scope changes.
- `SALES_SALES_ORDER_SEND` alone does not expose Actions column — intentional per original behavior.
