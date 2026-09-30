# Store Management — Idle Inventory

## Files

```
idle-inventory/
├── idle-inventory.component.ts   ← .ts extension (not .tsx)
└── idle-inventory.component.html
```

## Route
`/store/idle-inventory` — guard: `STORE_IDLE_INVENTORY`

---

## IdleInventoryComponent

### Selector
`app-idle-inventory`

### Purpose
Date-range report showing items with no recent movement. Uses REST API (not OData) and static data mode — ag-grid receives pre-fetched rows.

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `dateRangeValue` | `string` | Default: start of current month to today (`DD/MM/YYYY - DD/MM/YYYY`) |
| `dataSource` | `AgGridTableODataSourceConfig` | Static data mode: `{ type: 'odata', endpoint: '', staticData: true, data: [] }` |
| `columns` | `AgGridTableColumn[]` | Defined inline (no `ngOnInit` needed) |

### Data Fetch Pattern
```
REST GET store/idle-inventory/report?from=YYYY-MM-DD&to=YYYY-MM-DD
→ response: array or { data: [] } or { value: [] }
→ this.dataSource = { ...this.dataSource, data: rows }
```
ag-grid detects reference change and re-renders.

### Date Range Handling
- `dateRangeValue` format: `DD/MM/YYYY - DD/MM/YYYY`
- `onDateRangeChange(value: string)` — receives string directly (not Event) — from `(changeRangeDatePicker)` output
- Parsed with `moment.utc(date, 'DD/MM/YYYY')`

### Template
```html
[showDateRangePicker]="true"
[dateRangePickerValue]="dateRangeValue"
(changeRangeDatePicker)="onDateRangeChange($event)"
```
No `#agGridRef`, no segment buttons, no new button, no actions.

### Columns

| Field/ColId | Header | Notes |
|-------------|--------|-------|
| `custom_id` | Idle ID | `width: 120` |
| `item_code` | Item Code | `valueGetter: product.item_code` |
| `product_name` | Item Name | `valueGetter: product.product_name`; `flex: 1` |
| `quantity` | Quantity | `width: 110` |
| `condition` | Condition | plain field |
| `last_movement_date` | Last Movement | `valueFormatter: toLocaleDateString()` |
| `created_date` | Created Date | `valueFormatter: toLocaleDateString()` |

### API Call

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `store/idle-inventory/report?from=...&to=...` | REST (`false`); no OData |

### Important Caveats
- Static data mode: `endpoint: ''` — ag-grid won't make OData calls; data comes from `dataSource.data`.
- No `ngOnInit`/`buildColumns()` — columns defined directly in class body; permissions not needed (view-only).
- `gridId="idle-inventory-list"` — column state localStorage key.
- Response normalisation: `Array.isArray(res) ? res : (res?.data ?? res?.value ?? [])` — handles multiple API shapes.
