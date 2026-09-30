# AnalyticalTableComponent

**Selector:** `react-analytical-table`
**File:** `src/app/shared/components/analytical-table/analytical-table.component.tsx`
**Standalone:** Yes — `CUSTOM_ELEMENTS_SCHEMA`

## What It Does

Feature-rich data table wrapping SAP UI5 React `AnalyticalTable`. Handles data fetching (OData / REST), search, column filters, sorting, grouping, infinite scroll, multi-row selection, barcode scanning, import/export, column visibility persistence, and Active/Inactive segmented filtering.

Lifecycle: Angular shell creates a React root on `ngAfterViewInit`, mounts the full UI5 table tree, and unmounts on `ngOnDestroy`.

## Key Inputs

| Input | Type | Default | Purpose |
|---|---|---|---|
| `apiUrl` | `string` | `''` | Data endpoint |
| `tableColumn` | `any[]` | `[]` | Column definitions |
| `model` | `any` | — | Deserializable model class |
| `headerTitle` | `string` | `''` | Table toolbar title |
| `filterQuery` | `string` | `''` | OData `$filter` fragment |
| `expendquery` | `string` | `''` | OData `$expand` fragment |
| `isOdata` | `boolean` | `true` | OData vs plain REST |
| `isSearchFilter` | `boolean` | `false` | Show search box |
| `isFilterable` | `boolean` | `false` | Column filters |
| `isSortable` | `boolean` | `false` | Sortable columns |
| `isGroupable` | `boolean` | `false` | Row grouping |
| `isInfiniteScroll` | `boolean` | `false` | Infinite scroll pagination |
| `isStatic` | `boolean` | `false` | Skip API, use `staticData` emitter |
| `isSetting` | `boolean` | `true` | Column settings dialog |
| `isImport` | `boolean` | `false` | Excel import button |
| `isExport` | `boolean` | `false` | Excel export button |
| `isBarcodeScanner` | `boolean` | `false` | QR/barcode scanner |
| `isMultiDelete` | `boolean` | `false` | Multi-select delete |
| `isSegmentedState` | `boolean` | `true` | Active/Inactive/All toggle |
| `selectionMode` | `'None'\|'Single'\|'Multiple'` | `'None'` | Row selection |
| `selectedRowsId` | `{}` | `{}` | Pre-selected row IDs |
| `fetchLimit` | `number` | `0` | Rows per page |
| `staticData` | `EventEmitter<any>` | — | Static data feed |
| `refreshTrigger` | `EventEmitter<any>` | — | External refresh trigger |
| `refreshTriggerLoading` | `EventEmitter<void>` | — | Refresh + show loading |
| `renderTriggerLoading` | `EventEmitter<void>` | — | Show loading without reload |
| `IllustratedName/Title/Subtitle` | `string` | defaults | Empty-state UI |

## Key Outputs

| Output | Emits | When |
|---|---|---|
| `onEditSelectData` | row data | Row double-clicked |
| `onRowSelectData` | row data | Row single-selected |
| `onRowSelect` | raw event | Any row selection |
| `onResponseData` | API response | Data loaded |
| `isInsertDataChange` | `boolean` | Add button clicked |
| `isEditDataChange` | row data | Edit triggered |
| `IsInsertXls` | `void` | Import button clicked |
| `IsExportXls` | `void` | Export button clicked |
| `IsDelete` | API URL string | Delete button clicked |
| `onMultiSelectData` | `any[]` | Multi-select rows |
| `processData` | data | Processed data emitted |
| `datepickerChange` | value | Date picker changed |
| `comboBoxChange` | `{id, text}` | Combo box selection changed |
| `dateRangePickerChange` | value | Date range changed |

## Column Visibility

Column preferences saved to `localStorage` keyed by `headerTitle`. `initializeSelectedColumns()` loads from storage or defaults to all visible. `applySettings()` persists. `resetDefault()` clears storage.

## Search & Filtering

- `handleSearch(event)` — 300 ms debounce, builds OData `$filter` across all searchable columns via `parsefilterSearch()`.
- `checkSegement(status)` — sets `is_active eq true/false` filter.
- Supports date, nested string, and boolean column search branches.

## Barcode Scanner

ZXing browser scanner. `openScannerDialog()` starts scanning, writes result to search field, closes dialog on match.

## StatusBadge (React sub-component)

`status-badge.tsx` — React functional component used as a cell renderer. Props: `status`, `width`, `height`, `uppercase`. Maps status strings to colors via `statusStyles` utility.

## Usage Pattern

```html
<react-analytical-table
  [headerTitle]="'Employees'"
  [apiUrl]="'/api/employees'"
  [model]="EmployeeModel"
  [tableColumn]="columns"
  [isSearchFilter]="true"
  [isSortable]="true"
  (onEditSelectData)="openEditForm($event)"
  (isInsertDataChange)="openAddForm()"
  (IsDelete)="deleteUrl = $event"
></react-analytical-table>
```
