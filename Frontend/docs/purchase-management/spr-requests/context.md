# Purchase Management — SPR Requests

## Separate Component Docs
- [SPR_REQUEST_LIST_COMPONENT_CONTEXT.md](SPR_REQUEST_LIST_COMPONENT_CONTEXT.md) — `SprRequestsComponent` list doc with TSX, HTML, SCSS, selector, route, datasource, segment filters

## Files

```
purchese-management/spr-requests/
├── spr-requests.component.tsx
├── spr-requests.component.html
└── spr-requests.component.scss
```

## Route

| Path | Component | Permission |
|------|-----------|------------|
| `purchase/spr-requests` | `SprRequestsComponent` | `PURCHESE_SPR_REQUESTS` |

---

## SprRequestsComponent

### Selector
`app-spr-requests`

### Purpose
Read-only view of Store Purchase Requisitions (SPRs) created in the store module. Purchase module can view details and item lists but cannot create SPRs. Supports status-based filtering (Approved / Submitted / Rejected) and opens the shared `RequisitionFromComponent` for detail inspection or item viewing.

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `columns` | `AgGridTableColumn<any>[]` | ag-grid column config, built by `buildColumns()` |
| `dataSource` | `AgGridTableODataSourceConfig<any>` | OData config; `filter` field updated on segment change |
| `toolbarConfig` | `AgGridTableToolbarConfig` | Toolbar config object |
| `displayConfig` | `AgGridTableDisplayConfig` | Display config — gridHeight |
| `segmentButtonItems` | `array` | Approved / Submitted (default) / Rejected tab buttons |
| `customActionButtons` | `AgGridCustomButton[]` | Factory icon button → `viewItemList`; hidden when `sprItems.length === 0` |
| `saveMode` | `string` | `"REQUEST"` (view-only) or `"PUT"` (item list view) |
| `selectedData` | `any` | Row currently open in form |

### Key Methods

| Method | Description |
|--------|-------------|
| `buildColumns()` | Builds ag-grid column array; called at field init |
| `segmentButtonChange(event)` | Spreads `dataSource` with new `filter` → triggers `ngOnChanges` reload |
| `viewItem(event)` | Opens form in readonly — sets `saveMode="REQUEST"`, `isReadOnly=true`, calls `handleReadonly` |
| `viewItemList(data)` | Opens form in edit mode — sets `saveMode="PUT"`, calls `getSprPopulated(data)` |
| `saveEvent()` | Called after form save; calls `agGridRef.refreshGridData(true)` |
| `deleteClick(_row)` | **Stub — not implemented** |

### Segment Filter Mapping

| Tab | OData Filter |
|-----|-------------|
| Approved | `status eq 'APPROVED' and type eq 'SPR'` |
| Submitted (default) | `status eq 'SUBMITTED' and type eq 'SPR'` |
| Rejected | `status eq 'REJECTED' and type eq 'SPR'` |

> `type eq 'SPR'` is always included to exclude non-SPR requisitions (e.g. internal requests).

---

## Table Setup (AgGridTableComponent — main list)

### Config

| Config | Value |
|--------|-------|
| `endpoint` | `PurchaseRequisitions` |
| `expand` | `requestBy,department,sprItems($expand=item($expand=category,uom))` |
| `filter` | Dynamic — driven by segment selection |
| `sortBy` | `id` desc |
| `searchFields` | `['custom_id']` |
| `pageSize` | `40` |
| `gridId` | `purchese-spr-requests-list` |
| `showNewButton` | `false` — no create in purchase module |
| `showEditButton` | `false` |
| `showInfoButton` | `PURCHESE_SPR_REQUEST_VIEW` permission |
| `showDeleteButton` | `PURCHESE_SPR_REQUEST_DELETE` permission |
| `showAction` | `true` always |
| `customActionButtons` | factory icon button — hidden when no items |

### Columns (`buildColumns()`)

| Header | Field | Notes |
|--------|-------|-------|
| SPR No | `custom_id` | `width: 130` |
| Requested | `requested_by_name` | `valueGetter: requestBy.name`; sortable/filter off |
| Department | `department_name` | `valueGetter: department.name`; sortable/filter off |
| Request Date | `request_date` | `valueFormatter → toLocaleDateString()` |
| Required Date | `required_by` | `valueFormatter → toLocaleDateString()` |
| Status | `status` | Plain text; filter/sort off |
| Urgency | `urgency` | `valueFormatter → toUpperCase() \|\| '-'`; filter/sort off |
| Items | `items_count` | `valueGetter: sprItems.length`; filter/sort off |

> Urgency and Status render as plain uppercase text. Items count shows `sprItems.length` (0 when empty). The factory action button in the action column is hidden when count is 0 — use that to open `viewItemList`.

---

## Form Integration (RequisitionFromComponent)

Shared component from `store-management/purchase-requisition/`. Opened as a dialog/panel.

### Inputs set on open

| Input | viewItem (readonly) | viewItemList (edit items) |
|-------|--------------------|-----------------------------|
| `open` | `true` | `true` |
| `showNewButton` | `false` | `false` |
| `saveMode` | `"REQUEST"` (via parent property) | `"PUT"` |
| `isReadOnly` | `true` | (not set) |
| `isDepartmentReadOnly` | `true` (binding) | `true` (binding) |
| `isRequiredByReadOnly` | `true` (binding) | `true` (binding) |

`getSprPopulated(data)` called in both modes to pre-fill form with selected row data.
`handleReadonly(saveMode)` called only in `viewItem` to enforce field-level readonly.

---

## Enums Used

From `@store-module/shared/enum/spr-status`:

```typescript
enum SprStatus   { SUBMITTED, APPROVED, REJECTED }
enum SprType     { SPR }
enum RequisitionUrgency { HIGH, MEDIUM, LOW }
```

---

## API Calls

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `PurchaseRequisitions?$filter=<dynamic>&$expand=requestBy,department,sprItems(...)` | Main list — driven by `AgGridTableComponent` |

No POST / PUT / DELETE calls from this component — all mutations are in `RequisitionFromComponent`.

---

## Services Injected

| Service | Usage |
|---------|-------|
| `RolePermissionService` | Guards `showAction`, `showInfoButton`, `showDeleteButton` |

No `CommonService` or `ToastService` injected — form component handles its own API calls.

---

## Important Notes

- **Read-only module boundary**: SPRs are created in store module. Purchase module only views and processes them. `showNewButton=false` enforces this.
- **`saveMode="REQUEST"`**: This is not a standard OData saveMode — it signals the form to treat the session as a view-only requisition flow, not a create/edit.
- **Migrated to ag-grid**: Removed React JSX, `CustomGridTableComponent`, and `StatusBadge`. Urgency and Status render as plain uppercase text. Items count is a `valueGetter` column; items action is a `customActionButtons` factory icon (hidden when `sprItems.length === 0`).
- **Segment filter via dataSource reassign**: `segmentButtonChange` spreads `this.dataSource` with new `filter` → `ngOnChanges` triggers OData reload. No `setTimeout` needed (replaced the old `onFilterAndSorting()` pattern).
- **`saveEvent` → `refreshGridData(true)`**: Hard datasource reset after form save (was `childComponentRef.onFilterAndSorting()`).
