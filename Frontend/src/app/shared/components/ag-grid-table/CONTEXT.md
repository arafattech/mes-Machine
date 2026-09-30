# ag-grid-table Component Context

Shared AG Grid v34 table wrapper. Handles OData fetching, server-side sort/filter/search, theme sync, column persistence, toolbar, selection.

Location: `@shared/components/ag-grid-table/ag-grid-table.component.ts`

---

## Inputs

### Flat data-source inputs (mirrors custom-grid-table API)

| Input | Type | Default | Purpose |
|-------|------|---------|---------|
| `url` | `string` | `''` | OData endpoint name |
| `customUrl` | `string` | `''` | Non-OData endpoint (enables `customApi` mode) |
| `expandQuery` | `string` | `''` | OData `$expand` value |
| `filterQuery` | `string` | `''` | Base `$filter` always applied |
| `additionalFilterQuery` | `string` | `''` | Extra filter ANDed with base |
| `limit` | `number` | `0` | Page size (0 = use dataSource.pageSize or 40) |
| `searchFields` | `string[]` | `[]` | Fields for global search bar |
| `columns` | `AgGridTableColumn[]` | — | Column definitions |
| `dataSource` | `AgGridTableODataSourceConfig` | — | Full config object (flat inputs override when set) |
| `toolbarConfig` | `AgGridTableToolbarConfig` | — | Toolbar options |
| `displayConfig` | `AgGridTableDisplayConfig` | — | Grid height / row height |
| `enableRowClick` | `boolean` | `true` | Whether row click opens edit |

### Flat input priority
Flat input wins when non-empty/non-zero. `dataSource` object is the fallback.

---

## dataSource config (`AgGridTableODataSourceConfig`)

```ts
{
  type: 'odata' | 'api' | 'rest';  // 'api' = REST route (/api/) with full OData query params
  endpoint: string;           // OData entity set name
  expand?: string;            // $expand value
  filter?: string;            // static $filter (e.g. 'is_active eq true')
  baseFilter?: string;        // alias for filter
  additionalFilter?: string;  // ANDed after base filter
  pageSize?: number;          // default 40
  searchFields?: string[];    // global search fields (dot notation)
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  scrollPagination?: boolean; // default true (infinite scroll)
  customApi?: boolean;
  // ... see types file for full shape
}
```

---

## toolbarConfig (`AgGridTableToolbarConfig`)

```ts
{
  headerTitle?: string;
  showSearch?: boolean;        // global search bar (default true)
  showRowCount?: boolean;
  showNewButton?: boolean;     // Emphasized "Add" button — wire (newButtonClick)
  addButtonText?: string;
  showDownload?: boolean;
  showSegmentButton?: boolean; // Active/Inactive/All segments
  // Extra action button (e.g. bulk Approve) — wire (extraButtonClick):
  showExtraButton?: boolean;
  extraButtonText?: string;
  extraButtonDesign?: 'Default' | 'Emphasized' | 'Positive' | 'Negative' | 'Transparent' | 'Attention'; // default 'Transparent'
  extraButtonDisable?: boolean;
  // ... see types file for full shape
}
```

**Extra button** — generic toolbar action. Parent controls visibility/disable (reassign `toolbarConfig` object so OnPush picks it up). Use `extraButtonDesign: 'Emphasized'` for filled-border New-button style; default `'Transparent'`.

---

## searchFields — OData query patterns

Use **dot notation** — the query builder normalizes `.` → `/`.

```ts
searchFields: ['employee.first_name', 'status', 'leaveType.name']
```

**Direct field** → `contains(tolower(field), 'value')`

**Nav property** → `entity/any(a:contains(tolower(a/field), 'value'))`
- lodata rejects `contains(employee/first_name, 'value')` — always use lambda form
- query builder (`ag-grid-table-query-builder.service.ts`) handles this automatically
- match the exact nav path from valueGetter: `params.data?.employee?.first_name` → `'employee.first_name'`

### Global search box — `searchText` / debounce

`onSearchInput()` sets `this.searchText` synchronously on **every** keystroke (not only on clear), so the toolbar `[value]="searchText"` binding always mirrors the live `<ui5-input>` DOM value. Every keystroke value (including `''`) is also pushed into `searchInput$` (`debounceTime(600)` + `distinctUntilChanged()`), so a pending debounce from an earlier keystroke is always superseded by the latest one and can never fire late with stale text after the field has been cleared. Clearing (empty value) still triggers `runSearch('')` / `onSearchForCustomAPI('')` immediately for responsive UX, in addition to being pushed through the debounced subject.

---

## Column definitions (`AgGridTableColumn`)

```ts
// Direct field
{ field: 'status', headerName: 'Status', dataType: GridTableColumnDataType.String }

// Nav property — colId must be OData path for column filter to work
{
  colId: 'employee.first_name',
  headerName: 'First Name',
  minWidth: 130,
  valueGetter: (params: any) => params.data?.employee?.first_name ?? '',
}

// Computed / no filter
{
  colId: 'working_hours',
  headerName: 'Working Hours',
  filter: false,
  floatingFilter: false,
  valueGetter: (params: any) => calculateHours(params.data),
}
```

### dataType values (`GridTableColumnDataType`)
Auto-wires cell renderer and filter type.

| Value | Renderer | Filter |
|-------|----------|--------|
| `String` | text | text |
| `Date` | formatted date | date range |
| `Time` | formatted time | text |
| `Number` | numeric | number |
| `Boolean` | tick/cross badge | boolean |
| `Status` | colored badge | — |

---

## Date formatting — DD/MM/YYYY everywhere by default

AG Grid auto-infers a column's `cellDataType` from raw row values when nothing overrides it. Any
raw ISO date/datetime **string** (`"2026-08-02"`, `"2026-08-02T10:00:00.000Z"`) auto-infers as
`dateString`/`dateTimeString` — matched **before** the generic `text` type (AG Grid's fixed matcher
order: `dateTimeString → dateString → text → number → boolean → date`), so this catches virtually
every date column pulled straight from OData/REST without any column config at all. Without an
override, AG Grid's own default formatter for those types is **locale-dependent** and reads as
`MM/DD/YYYY` for many users — this was the wrong-format bug reported on several tables (e.g.
`employee-list`'s "Created On", which had its own broken `new Intl.DateTimeFormat()` with no locale
specified, defaulting to the system locale).

Fixed at the grid level, not per-column:
- `dataTypeDefinitions` (`ag-grid-table.component.ts`, bound via `[dataTypeDefinitions]` on
  `<ag-grid-angular>`) extends the built-in `dateString`/`dateTimeString` types with a
  `moment(value).format('DD/MM/YYYY')` `valueFormatter`. This alone fixes any column with a raw
  date-shaped value and **no** explicit `valueFormatter` — no column config needed.
- `applyDataTypeToColumn()`'s `GridTableColumnDataType.Date` case (this app's own `dataType` enum,
  unrelated to AG Grid's `cellDataType`) also defaults to the same `DD/MM/YYYY` formatter, but only
  via `column.valueFormatter ?? default` — a column that already supplies its own formatter (e.g.
  one going through `DateFormatterService` for a different display need) is left untouched.

**Do not** add a per-column `moment(...).format('DD/MM/YYYY')` `valueFormatter` for a plain date
field anymore — the grid default already produces that output. Only write a custom `valueFormatter`
when the display genuinely needs to differ from plain `DD/MM/YYYY` (a different format, a combined
range string, explicit UTC anchoring for a time-sensitive field like a process/created timestamp
where local-time display would be wrong near a midnight boundary — see `employee-payroll`'s
`created_at`/"Process Date", intentionally left on `moment.utc(...)`).

---

## Responsive column sizing (auto-fit vs. saved layout)

Columns have no `flex` by default (`defaultColDef` only sets `minWidth: 140`) — filling the
remaining grid width is entirely `sizeColumnsToFit()`'s job, scheduled (rAF-coalesced) by
`scheduleFitColumns()` from `onGridReady` / `onFirstDataRendered` / `onGridSizeChanged`.

A restored/manually-customized layout (`userColumnStateActive = true`, set in
`restoreSavedState()` and various column-event handlers) used to suppress `sizeColumnsToFit()`
**permanently** — any saved layout that fell short of the current container width (route revisit
on a wider screen, sidebar collapse, a column added/renamed since the layout was saved) left a
dead empty gap in the center viewport, right before the pinned `__actions__` column. Only manually
clicking "Reset to Default" (`resetColumnSettings()` / `resetGridState()`) cleared the flag and
re-ran the fit.

Fix: `scheduleFitColumns()` now checks `hasColumnWidthGap()` — sums `getDisplayedCenterColumns()`
actual widths vs. `.ag-center-cols-viewport` clientWidth. A saved layout is only respected when it
still fully covers the viewport; if it falls short, `sizeColumnsToFit()` runs anyway, closing the
gap without needing a manual reset. A user who intentionally widened columns *past* the viewport
(horizontal scroll) is left alone — no gap means no override. The pinned Action column is always
`suppressSizeToFit: true` (fixed width) and never participates in either the gap check or the fit.

---

## Theme sync

Component syncs with `ThemeService`. Dark themes: `sap_fiori_3_dark`, `sap_fiori_3_hcb`, `sap_horizon_dark`, `sap_horizon_hcb`.

AG Grid theme set via JS Theme API (`themeQuartz` / `colorSchemeDark`). SAP UI5 CSS variables used for dark mode colors:
- Background: `--sapList_Background`
- Header: `--sapList_HeaderBackground`
- Alternate rows: `--sapList_AlternatingBackground`
- Hover: `--sapList_Hover_Background`
- Selection: `--sapList_SelectionBackgroundColor`
- Border: `--sapList_BorderColor`
- Text: `--sapTextColor`

---

## Services

| File | Purpose |
|------|---------|
| `ag-grid-table-query-builder.service.ts` | Builds OData `$filter`, `$orderby`, `$top`, `$skip`, `$count` params |
| `ag-grid-table-data.service.ts` | Fetches OData/REST, handles pagination |

### Query builder — filter expressions

- Search text → `(cond1 or cond2 or ...)` added to `$filter`
- Column filter model → per-column expression ANDed
- `baseFilter` / `additionalFilter` always ANDed
- Nav path column filter uses same lambda: `entity/any(a:a/field eq 'value')`

---

## Subdirectories

```
cell-renderers/   — AgGridStatusBadgeComponent, AgGridBooleanCellRendererComponent, ...
cell-editors/     — inline editors
floating-filters/ — custom floating filter UI
headers/          — custom header components
services/         — query builder, data service
types/            — AgGridTableColumn, AgGridTableODataSourceConfig, GridTableColumnDataType, ...
utils/            — helpers
```

---

## Known lodata (Laravel OData) constraints

| Pattern | Works | Notes |
|---------|-------|-------|
| `contains(direct_field, 'val')` | ✓ | |
| `tolower(direct_field)` | ✓ | |
| `contains(tolower(field), 'val')` | ✓ | |
| `contains(nav/field, 'val')` | ✗ | `expression_parser_error` |
| `startswith(nav/field, 'val')` | ✗ | same error |
| `nav/any(a:contains(tolower(a/field), 'val'))` | ✓ | correct pattern |
| `nav/field eq 'val'` | ✓ | equality on nav path |

---

## CONTEXT.md maintenance

Update this file whenever:
- New inputs added to `ag-grid-table.component.ts`
- Query builder patterns change
- New cell renderers / data types added
- Theme behavior changes
