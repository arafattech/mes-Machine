# PURCHASE_ORDER_LIST_COMPONENT — Component Context

## Component Identity

| Field | Value |
|---|---|
| Component name | `PurcheseOrderListComponent` |
| Selector | `app-purchese-order-list` |
| TypeScript | `src/app/modules/purchese-management/purchese-orders/purchese-order-list/purchese-order-list.component.ts` |
| HTML | `src/app/modules/purchese-management/purchese-orders/purchese-order-list/purchese-order-list.component.html` |
| SCSS | `src/app/modules/purchese-management/purchese-orders/purchese-order-list/purchese-order-list.component.scss` |
| Component type | Purchase order list route |
| Route | `purchase-orders` |
| Permission | `PURCHESE_ADMIN` |

## Purpose
Direct AG Grid purchase order list for the purchase management module. Displays POs filtered by status, supports inline approve via action column. Migrated from legacy `CustomGridTableComponent` + template delegation to a self-contained `app-ag-grid-table` implementation.

## Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `agGridRef` | `AgGridTableComponent` | ViewChild — used for `refreshGridData(true)` after approve |
| `columns` | `AgGridTableColumn<any>[]` | Built by `buildColumns()` in `ngOnInit` |
| `dataSource` | `AgGridTableODataSourceConfig<any>` | OData config — `filter` updated on segment change |
| `toolbarConfig` | `AgGridTableToolbarConfig` | Title, search, no new/download buttons |
| `displayConfig` | `AgGridTableDisplayConfig` | `gridHeight: calc(100vh - 118px)` |
| `segmentButtonItems` | array | Submitted (default) / Approved / Rejected |

## Grid Config

```typescript
dataSource = {
  type: 'odata',
  endpoint: 'PurchaseOrders',
  expand: 'supplier',
  searchFields: ['custom_id', 'supplier.name'],
  pageSize: 40,
  sortBy: 'id',
  sortDirection: 'desc',
  filter: "status eq 'SUBMITTED'",  // default; updated by onSegmentChange()
};
```

## Columns

| field / colId | Header | Notes |
|---------------|--------|-------|
| `is_active` | Active | `GridTableColumnDataType.Boolean` |
| `custom_id` | PO No | `width: 120` |
| `supplier.name` | Supplier | `valueGetter`, `flex: 1`, `sortable: false`, `colId` matches OData path |
| `total_amount` | Total | `GridTableColumnDataType.Number` |
| `status` | Status | `valueFormatter` → `PurchaseOrderStatusClass.getLabel(value)` |
| `actions` | Actions | Pinned right, approve icon, `AgGridActionCellRendererComponent` |

## Methods

| Method | Description |
|--------|-------------|
| `ngOnInit()` | Calls `buildColumns()` |
| `buildColumns()` | Builds column defs; approve row action |
| `onSegmentChange(event)` | Updates `dataSource.filter` → ag-grid auto-reloads |
| `approveOrder(order)` | `POST purchase/orders/{id}/approve` → toast + `refreshGridData(true)` |

## Segment Filter Logic

```typescript
onSegmentChange(event): void {
  const selectedId = event?.id ?? event?.value ?? '';
  if (selectedId) {
    this.dataSource = { ...this.dataSource, filter: `status eq '${selectedId}'` };
  }
}
```

`segmentButtonItems` IDs match `PurchaseOrderStatus` enum values from `purchese-management/shared/enum/purchase.enum.ts`.

## API Calls

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `PurchaseOrders?$expand=supplier&$filter=status eq '...'&...` | Main list (ag-grid OData) |
| POST | `purchase/orders/{id}/approve` | Approve order — body `{ status: 'APPROVED' }` |

## Services Injected

| Service | Usage |
|---------|-------|
| `CommonService` | Approve API call |
| `ToastService` | edit / error toast |
| `RolePermissionService` | Injected; available for future permission gates |

## Important Notes

- `gridId="purchese-order-list"` — localStorage column state key.
- `colId: 'supplier.name'` on the supplier column matches the OData nav path — required for server-side column filter to work.
- Approve action is currently visible for all rows regardless of status — add `visible: (row) => row.status === 'SUBMITTED'` to the row action when permission gates are added.
- `.tsx` file kept as `export {};` — TypeScript resolves `.ts` first; both files must coexist until the `.tsx` can be deleted.

## Future Add Notes
- Gate the approve action with `PURCHESE_ADMIN` permission check.
- Add `visible` predicate on approve action to hide it for already-approved/rejected POs.
- Add view/edit dialog or route navigation for row click.
- Expand `supplier` in OData is minimal — extend to include more supplier fields if needed.
