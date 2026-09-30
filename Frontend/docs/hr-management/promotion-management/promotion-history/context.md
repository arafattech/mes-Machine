# HR Management — Promotion Management: Promotion History

## Files
```
promotion-management/
└── promotion-history/
    ├── promotion-history.component.ts
    ├── promotion-history.component.html
    └── promotion-history.component.scss
```

## Route
`promotion-management/promotion-history` (HR Management routing module) — `PromotionHistoryComponent`,
gated by `Permissions.HR_PROMOTION_HISTORY`. Sidebar entry under "Promotion Management" →
"Promotion History".

## Purpose
Read-only list of **approved** promotions — a permanently filtered view of the same
`/hrm/promotions` REST endpoint `PromotionManagementComponent` uses (`PromotionController::index`),
with `dataSource.filter` hardcoded to `status eq 'approved'` (not user-changeable — no segment
buttons, unlike the main promotion list). Each row has an info action icon that opens a read-only
details dialog; there is no create/edit/approve/decline here.

### Selector
`app-promotion-history`

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `dataSource` | `AgGridTableODataSourceConfig` | `type:'api'`, `customEndpoint:'/hrm/promotions'`, `sortBy:'promotion_date' desc`, `searchFields:['custom_id','promotion_title','old_designation','new_designation']`. `filter` is rebuilt by `rebuildFilter()` — always starts with `status eq 'approved'`, ANDed with the active date-range/employee filters |
| `dateRangeValue` / `dateRangeFilter` | `string` | Default to the last 1 month (`defaultRangeStart`/`defaultRangeEnd`, set at field-init time so the very first grid load already carries this range). Bound to the grid's legacy `[dateRangePickerValue]`; `dateRangeFilter` holds the built `promotion_date ge X and promotion_date le Y` OData fragment (empty = no date filter, if cleared) |
| `employeeFilter` | `string` | `employee_id eq {id}` fragment from the employee toolbar dropdown (empty = no employee filter) |
| `employeeToolbarFilters` | `AgGridToolbarFilter[]` | One `type:'select'` filter (`id:'employee'`), options loaded from `/hrm/promotions/options`'s `employees` array (same endpoint `PromotionManagementComponent` uses) |
| `selectedPromotion` | `any` | Row backing the details dialog |
| `isDetailsDialogOpen` | `boolean` | Details dialog open state |
| `actionButtons` | `AgGridCustomButton[]` | Single `info` action, wired into the grid's own `actions` column (`cellRenderer: AgGridActionCellRendererComponent`) rather than via `[customActionButtons]`/`[showAction]` — this grid keeps `[showAction]="false"` since there's no edit/delete to gate |

### Toolbar filters (date range + employee)

Two toolbar-level filters sit next to the search box, matching the pattern already used by
`EmployeeBonusesComponent`/`EmployeeAttendanceListComponent`:
- **Date range** — legacy direct inputs (`[showDateRangePicker]`, `[dateRangePickerValue]`,
  `(changeRangeDatePicker)`), filters on `promotion_date`.
- **Employee** — the newer generic `[toolbarFilters]`/`(toolbarAction)` API, `type:'select'`
  (`id:'employee'`), filters on `employee_id`.

Both rebuild `dataSource.filter` via `rebuildFilter()`, which always keeps the base
`status eq 'approved'` clause and ANDs in whichever of `dateRangeFilter`/`employeeFilter` is set.

**Reset button** (`toolbarConfig.showResetButton` + `(resetButtonClick)="onResetFilters()"`) restores
both filters to the default 1-month range and clears the employee selection. The employee dropdown is
an *uncontrolled* `ui5-combobox` inside the shared grid (no `[value]` binding at all) — clearing
`employeeFilter` alone resets the query but leaves the dropdown showing stale selected text. Fixed
without touching the shared `ag-grid-table` component: its `*ngFor="let f of toolbarFilters"` has no
`trackBy`, so Angular's default identity-based diffing destroys and recreates a filter's DOM node
whenever it sees a new object reference at that index. `onResetFilters()` reassigns
`employeeToolbarFilters = employeeToolbarFilters.map(f => ({...f}))` — brand-new object per item —
which triggers exactly that recreate, clearing the combobox as a side effect.

**Backend note**: `PromotionController::index()` previously only parsed `status eq` and
`old_department_id|new_department_id eq` from `$filter` — no `employee_id` or date-range support
existed at all, so these two toolbar filters would have silently no-op'd. Added regex parsing for
`employee_id eq (\d+)`, `promotion_date ge ([\d-]+)`, `promotion_date le ([\d-]+)`, applied
post-merge over the in-memory `$items` collection (same style as the existing department filter).
`promotion_date` serializes via `toArray()` as an ISO datetime (`2026-08-02T00:00:00.000000Z`), so
comparisons use `substr($row['promotion_date'], 0, 10)` against the plain `YYYY-MM-DD` bound —
a raw string compare against the full ISO value would wrongly exclude same-day matches on the `le`
(end-of-range) side.

### Key Methods

| Method | Description |
|--------|-------------|
| `tableColumn()` | Employee No/Name (valueGetters off `employee`), Promotion Type (labelled), Old/New Designation, Old/New Salary, Increment, Promotion Date, Effective Date, Executed By (`approved_by.name`), Status badge, Actions (info) |
| `loadEmployeeOptions()` | Populates `employeeToolbarFilters` from `/hrm/promotions/options` |
| `onToolbarAction(event)` | Handles `filter:employee` — sets `employeeFilter`, calls `rebuildFilter()` |
| `onDateRangeChange(value)` | Parses `"DD/MM/YYYY - DD/MM/YYYY"`, sets `dateRangeFilter`, calls `rebuildFilter()` |
| `rebuildFilter()` | Joins `status eq 'approved'` + `dateRangeFilter` + `employeeFilter` with `and`, reassigns `dataSource` (new object reference triggers the grid's `ngOnChanges` refetch) |
| `onResetFilters()` | Bound to `(resetButtonClick)` — restores the default 1-month range, clears `employeeFilter`, rebuilds `employeeToolbarFilters` with fresh object references (see "Reset button" above), calls `rebuildFilter()` |
| `openDetails(row)` | Sets `selectedPromotion`, opens the details dialog |
| `closeDetails()` | Clears `selectedPromotion`, closes the dialog |
| `getEmployeeName()` / `getPromotionTypeLabel()` / `formatNumber()` / `formatDate()` | Local display-formatting helpers for the details dialog — deliberately not shared with `PromotionManagementComponent`'s equivalents (which weren't touched by this change) to keep this addition isolated |
| `downloadButtonClick()` | Bound to `(downloadButtonClick)` — emits `IsExportXls` |
| `getExportPayload()` / `getExportFileName()` | Build the export request body / filename from the currently-active date-range and employee filters — see "Excel export" below |

### Details dialog

Mirrors the read-only fields already shown in `PromotionManagementComponent`'s approve-confirmation
dialog (Employee, Promotion Type, Old/New Designation, Old/New Salary, Promotion/Effective Date,
Executed By, Note, Total Increment) but strips the Approve/Decline actions down to a single Close
button — since every row here is already in the terminal `approved` state.

### Permission
`Permissions.HR_PROMOTION_HISTORY` was already seeded (`PermissionSeeder`/`BtlPermissionSeeder`) but
previously unused by any route — no backend seeding needed, just wiring it into this route.

### Excel export

`toolbarConfig.showDownload: true` + `(downloadButtonClick)="downloadButtonClick()"` on the grid
emits `IsExportXls`, consumed by a bare `<excel-upload-download>` (export-only — no `apiUrl`/
`IsInsertXls`, matching `SideBillComponent`/`EmployeeAttendanceListComponent`'s export-only wiring):
```html
<excel-upload-download
  [exportApiUrl]="'hrm/promotions/export'"
  [exportPayload]="getExportPayload()"
  [exportFileName]="getExportFileName()"
  [IsExportXls]="IsExportXls"
></excel-upload-download>
```
- `getExportPayload()` — re-derives `{from, to}` (`YYYY-MM-DD`) from `dateRangeValue` and
  `employee_id` from `selectedEmployeeId` (tracked separately from `employeeFilter` — that field
  holds an OData fragment string, not a raw ID — set in `onToolbarAction()`, cleared in
  `onResetFilters()`), so the exported file always matches whatever's currently on screen.
- `getExportFileName()` — `promotion-history_{from}_to_{to}.xlsx`, or a plain `promotion-history.xlsx`
  if the range was cleared.

**Backend**: no export endpoint existed for promotions at all before this. Added
`PromotionController::exportHistory()` (`POST hrm/promotions/export`, registered before the
`promotions/{promotion}` wildcard routes to avoid the literal `export` segment being swallowed by
route-model binding) + `App\Exports\PromotionHistoryExport` (`FromCollection`/`WithHeadings`,
mirrors `App\Exports\PayrollExport`'s shape) — a plain Eloquent query
(`Promotion::where('status','approved')`, optional `whereDate('promotion_date', ...)` bounds and
`employee_id`), independent of `index()`'s in-memory regex-filter/virtual-segment machinery (export
only ever needs approved rows, which are always plain DB rows, never the pending/expired "virtual"
eligibility rows `index()` also merges in).
