# Sales Management — Expired Sales Orders

## Files
- `expired-sales-order/expired-sales-order.component.ts`
- `expired-sales-order/expired-sales-order.component.html`

## Selector
`app-expired-sales-order`

## Route
`expired-sales-orders` — guarded by `SALES_EXPIRED_SALES_ORDERS`

## Purpose
Read-only list of APPROVED Sales Orders with past `expected_delivery_date`. View-only detail opens `OrderFormComponent` in disabled mode. No create, edit, delete.

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
  filter: "",        // set in ngOnInit with today's date
  sortBy: "id",
  sortDirection: "desc",
};
```
`ngOnInit` reassigns `dataSource` with computed filter:
```typescript
ngOnInit(): void {
  const today = moment().format("YYYY-MM-DD HH:mm:ss");
  this.dataSource = {
    ...this.dataSource,
    filter: `expected_delivery_date lt '${today}' and status eq 'APPROVED'`,
  };
}
```
Filter computed once at init — not reactive. Page refresh updates date.

### Toolbar Config
```typescript
toolbarConfig: AgGridTableToolbarConfig = {
  headerTitle: $localize`Expired Sales Order`,
  showSearch: true,
  showRowCount: true,
  showNewButton: false,
};
```

### Display Config
```typescript
displayConfig: AgGridTableDisplayConfig = {
  gridHeight: "calc(100vh - 145px)",
};
```

### Columns

| Column | Field / colId | Notes |
|--------|---------------|-------|
| ID | `custom_id` | width 100 |
| Client | `client_name` | `valueGetter` → `client?.name` |
| Delivery Date | `expected_delivery_date` | `valueFormatter` → `toLocaleDateString()` |
| Sub Total | `subtotal` | `dataType: Number` |
| Total VAT | `vat` | `dataType: Number` |
| Total | `grand_total` | `dataType: Number` |
| Created By | `created_by_name` | `valueGetter` → `createdBy?.name` |
| Status | `status` | inline `cellRenderer` badge |
| Items | `items_count` | `valueGetter` count; `cellRenderer` blue badge; filter/sort off |

### Actions Column (inside `buildColumns()`)

Single view-only button — no permission guard. Built as `AgGridTableRowAction[]` inside `buildColumns()`, added as last column via `AgGridActionCellRendererComponent`. Dispatched via `onAction()`.

```typescript
{ id: "view", label: "", icon: "show", design: "Transparent", tooltip: $localize`View` }
```

Actions column: `width: 80, minWidth: 80, pinned: 'right', lockPinned: true`.

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
| `dataSource` | `AgGridTableODataSourceConfig<any>` | OData source; filter set in `ngOnInit` |
| `toolbarConfig` | `AgGridTableToolbarConfig` | Toolbar — search + row count only |
| `displayConfig` | `AgGridTableDisplayConfig` | Grid height |
| `columns` | `AgGridTableColumn<any>[]` | Built in constructor via `buildColumns()`; includes Actions column |

## Key Methods

| Method | Description |
|--------|-------------|
| `buildColumns()` | Returns all columns including `AgGridActionCellRendererComponent` Actions column |
| `onAction(actionId, row)` | Dispatches `view` → `viewOrder(row, true)` |
| `ngOnInit()` | Computes today's date; reassigns `dataSource` with full OData filter |
| `viewOrder(data, isDisabled)` | Opens `OrderFormComponent` in PUT/disabled mode; pre-populates date, items, client |

## API Calls
None directly — grid fetches via `app-ag-grid-table` using `dataSource`.

## Services Injected

| Service | Usage |
|---------|-------|
| `DateFormatterService` | `formatDate()` for date pre-population in `viewOrder` |

## Notes
- Filter computed once at `ngOnInit` — not reactive. Page refresh updates cutoff date.
- `OrderFormComponent` driven programmatically — no `saveEvent` binding (view-only).
- `data.client?.name` uses optional chaining — safe if `client` null.