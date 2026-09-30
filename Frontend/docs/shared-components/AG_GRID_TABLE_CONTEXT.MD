# AG Grid Table Component Context

Reusable AG Grid wrapper at `Frontend/src/app/shared/components/ag-grid-table/`.

Full feature parity with `app-custom-grid-table`. Backed by AG Grid Infinite Row Model + OData query builder instead of React AnalyticalTable.

**Config-object API (since the input consolidation):** data fetch, toolbar and display are passed as three strongly-typed objects — `[dataSource]`, `[toolbarConfig]`, `[displayConfig]` — plus the required `[columns]`. Internally each config is merged with its defaults **once per change** (in `ngOnChanges`, via `resolveDataSource()` / `resolveToolbar()` / `resolveDisplay()`) into three resolved fields `rDs` / `rTb` / `rDc` that the template + component body read directly (e.g. `rTb.showSearch`, `rDs.endpoint`). This shrank the public binding surface (~63 flat inputs → 3 objects) and centralised every default in one place. The remaining groups (selection, state/persistence, illustrated empty-state, switch, date pickers, combos, multi-selects, custom button arrays, action column, advanced toolbar controls) are **still flat `@Input()`s**.

---

## Folder Structure

```
ag-grid-table/
├── ag-grid-table.component.ts / .html / .scss   shell
├── types/ag-grid-table.types.ts                 all interfaces, GridTableColumnDataType enum
├── utils/ag-grid-table.filter-utils.ts          option normalization, date-range parse
├── services/
│   ├── ag-grid-table-query-builder.service.ts   OData $filter/$orderby/$top/$skip/$count
│   └── ag-grid-table-state.service.ts           localStorage column/filter/search persist
├── headers/ag-grid-custom-header.component.ts / .html / .scss   40px single-row header: title+sort+on-demand filter popup (template in external .html)
├── cell-renderers/
│   ├── ag-grid-boolean-cell-renderer.component.ts    ✓/✗ display (public — consumers import directly)
│   └── ag-grid-cell-renderers.component.ts           3 co-located components: Action (Edit/Delete/Info + custom), IconText (icon + label), NoRowsOverlay (illustrated empty-state)
└── cell-editors/
    └── ag-grid-cell-editor.component.ts / .html  AgGridCellEditorComponent — ONE unified editor; switches on editorConfig.type → text / number / integer / textarea (native inputs) + select (ui5-combobox) + checkbox (✓/✗ toggle). Template in external .html (templateUrl)
```

> **Editor/renderer consolidation:** the 6 per-type editors collapsed into a single `AgGridCellEditorComponent` (chosen by `editorConfig.type`; `resolveEditorColDef` points every type at it and only varies the popup / checkbox-renderer colDef flags). The Action / IconText / NoRowsOverlay renderers are co-located in `ag-grid-cell-renderers.component.ts`. Only `AgGridBooleanCellRendererComponent` keeps its own file + stable import path because list components import it directly for `is_active` columns.

---

## Component Identity

- Selector: `app-ag-grid-table`
- Standalone: `true`
- Generic: `AgGridTableComponent<TData = any>`
- Row model: `infinite` (server-side OData) or `clientSide` (when `dataSource.staticData` / `customApi` / `type:'api'`) — see [Row Model Behavior — Strategy Selection](#row-model-behavior--strategy-selection)
- AG Grid version: **34.3.0** (Community, Angular)
- AG Grid module: `AllCommunityModule`
- Header: `AgGridCustomHeaderComponent` — **40px** single row (title + sort icons + filter icon button per column). Filters open on-demand as a `position:fixed` popup below the header cell.
- `defaultColDef`: sortable, resizable, `minWidth: 140`, `agTextColumnFilter`, `suppressHeaderMenuButton`
- Search debounce: **350ms** (`distinctUntilChanged`)
- Change detection: `OnPush` + explicit `markForCheck()` in datasource callbacks and state mutation methods
- Grid options: `rowBuffer:10`, `cacheBlockSize:limit`, `maxBlocksInCache:20`, `debounceVerticalScrollbar:true`, `suppressColumnMoveAnimation:true`, `valueCache:true`, `suppressCellFocus:true`, `ensureDomOrder:false`, `animateRows:false`, `suppressScrollOnNewData:true`
  - `rowBuffer:10` (was 20) — fewer offscreen DOM rows → ~30 vs ~50 DOM rows, +FPS on low-end
  - `debounceVerticalScrollbar:true` — collapses fling-scroll into fewer `getRows` block requests
  - `valueCache:true` — memoizes `valueGetter` results (nested `department.name` etc.)
  - `getRowHeight` / `getRowStyle` — drive placeholder filler row height + zebra parity (see [Placeholder Filler Rows](#placeholder-filler-rows-fillemptyrows))

---

## Configuration Objects (public @Inputs)

| @Input | Type | Required | Replaces (legacy flat inputs) |
|---|---|---|---|
| `columns` | `AgGridTableColumn<TData>[]` | **yes** | — |
| `dataSource` | `AgGridTableODataSourceConfig<TData>` | — | `url`, `customUrl`, `filterQuery`, `additionalFilterQuery`, `expandQuery`, `data`, `customData`, `limit`, `sortBy`, `customSortType`, `searchFields`, `isServerSearchingEnable`, `ignoreQueryBuilder`, `isCustomApiCall`, `isCustomApiCalledManually`, `tookDataFromCustomPaginator`, `customResultFieldName`, `isNewCustomSorting`, `pagination`, `paginationPageSize`, `scrollPagination` |
| `toolbarConfig` | `AgGridTableToolbarConfig` | — | `headerTitle`, `showRowDataCount`, `showSearch`, `isGlobalSearchVisible`, `showSearchScanner`, all standard buttons + texts/disables, `showActiveButton`/`button1..4Text` |
| `displayConfig` | `AgGridTableDisplayConfig` | — | `gridHeight`, `rowHeight`, `headerRowHeight`, `isCozy`, `alternateRowColors`, `fillEmptyRows`, `loadingDelay`, `withRowHighlight`, `highlightFieldColumn` |

Default `dataSource` = `{ type: 'odata', endpoint: '' }`; `toolbarConfig` = `{}`; `displayConfig` = `{}`. All fields optional — omitting one restores the legacy default. Dropped as dead (never read): `useOdataStyles`, `isv8`, `model`, `enableServerSideFiltering`, `isServerSideSorting`.

### `dataSource` — `AgGridTableODataSourceConfig<TData>`

| Field | Default | Was | Description |
|---|---|---|---|
| `type` | `'odata'` | — | **Strategy discriminant.** `'odata'` → infinite row model + OData query builder (`/odata` prefix, `$top/$skip/$count/$orderby`). `'api'` → plain client-side fetch (see [API Source](#api-source-typeapi)) — `/api` prefix, **no** OData params. |
| `endpoint` | `''` | `url` | OData entity set — no leading `/`, no query params |
| `customEndpoint` | — | `customUrl` | Alternate endpoint — takes precedence over `endpoint`. For `type:'api'` this is the URL fetched. |
| `pageSize` | `40` | `limit` | Page size (`$top`) / `cacheBlockSize` |
| `searchFields` | `[]` | `searchFields` | Fields searched with `contains()` |
| `expand` | `''` | `expandQuery` | `$expand` value — `$expand=` prefix stripped if present |
| `filter` | `''` | `filterQuery` | Base `$filter` always ANDed in |
| `baseFilter` | `''` | `additionalFilterQuery` | Extra `$filter` from parent |
| `sortBy` | `''` | `sortBy` | Forced default sort column — always wins over any persisted column state (see gotchas below) |
| `sortDirection` | `'asc'` | `customSortType` | Direction for `sortBy` |
| `customSorting` | `false` | `isNewCustomSorting` | Emit `customSorting` event instead of OData sort |
| `pagination` | `false` | `pagination` | Page-button pagination (fixed scrollbar thumb) |
| `paginationPageSize` | `pageSize` | `paginationPageSize` | Page size for `pagination` — keep equal to `pageSize` |
| `scrollPagination` | `false` | `scrollPagination` | On-scroll pagination (growing scrollbar thumb) |
| `serverSearch` | `false` | `isServerSearchingEnable` | Use `$search=value` instead of `contains()` |
| `ignoreQueryBuilder` | `false` | `ignoreQueryBuilder` | Emit `onColumnFilter` but skip OData filter build |
| `resultField` | `''` | `customResultFieldName` | Custom response field name (overrides `value`) |
| `fromCustomPaginator` | `false` | `tookDataFromCustomPaginator` | Read `data` + `total` from response instead of `value` + `@count` |
| `data` | `[]` | `data` | Static rows — used with `staticData` / `customApi` |
| `staticData` | `false` | `customData` | Skip OData, use `data` directly (client-side row model) |
| `customApi` | `false` | `isCustomApiCall` | Parent drives search/fetch — emits `onSearchForCustomAPI` / `onLoadMoreForCustomAPI` |
| `customApiManual` | `false` | `isCustomApiCalledManually` | Suppress auto-reload when parent manages fetch timing |

> `additionalFilter` on the interface is **internal** (the combined `$filter` handed to the query builder) — do not set it from the parent; use `filter` / `baseFilter`.

## @Inputs — State / Persistence

| Input | Default | Description |
|---|---|---|
| `gridId` | `''` | localStorage key — auto-derived from `url` if empty |
| `isBase` | `false` | Enable column/filter/search persistence |
| `isTableCacheEnabled` | `true` | Same effect as `isBase` |
| `keyForCacheCustomDataTableColumns` | `''` | Legacy alias for `gridId` |

### `displayConfig` — `AgGridTableDisplayConfig`

| Field | Default | Was | Description |
|---|---|---|---|
| `gridHeight` | `'calc(100vh - 145px)'` | `gridHeight` | CSS height of grid container |
| `rowHeight` | `undefined` | `rowHeight` | Row height px — defaults to 32 (normal) / 44 (cozy) |
| `headerRowHeight` | `undefined` | `headerRowHeight` | Reserved |
| `isCozy` | `false` | `isCozy` | Use 44px row height |
| `alternateRowColors` | `true` | `alternateRowColors` | Zebra striping — `false` disables odd-row background |
| `fillEmptyRows` | `true` | `fillEmptyRows` | Fill empty viewport below the last row with inert blank placeholder rows (SAP/UI5 look). See [Placeholder Filler Rows](#placeholder-filler-rows-fillemptyrows). |
| `loadingDelay` | `0` | `loadingDelay` | Reserved |
| `withRowHighlight` | `false` | `withRowHighlight` | Reserved |
| `highlightFieldColumn` | `''` | `highlightFieldColumn` | Reserved |

## @Inputs — Selection (flat)

| Input | Default | Description |
|---|---|---|
| `selectionMode` | `'None'` | `'Single'` / `'Multiple'` / `'None'` — capital first letter |
| `selectionRowBehavior` | `'RowOnly'` | `'Row'` (row click selects) / `'RowOnly'` (checkbox only, `suppressRowClickSelection=true`) / `'RowSelector'` |
| `selectedRowsId` | `{}` | Pre-selected rows by id — applied after grid ready |
| `disableColumnRule` | `null` | `(row: TData) => boolean` — disable row selection per row |

### Automatic checkbox column (`selectionMode = 'Multiple'`)

When `selectionMode === 'Multiple'`, `buildRawColumnDefs()` automatically **prepends** a dedicated selection column before all data columns:

```
colId: '__selection__'  width: 50 (fixed)  pinned: 'left'  lockPosition: 'left'
checkboxSelection: true  headerCheckboxSelection: true
sortable: false  filter: false  resizable: false  suppressMovable: true
```

No caller configuration needed — every table using `selectionMode="Multiple"` gets checkboxes automatically. Pair with `selectionRowBehavior="'RowOnly'"` (recommended) so only the checkbox—not a row click—triggers selection.

### Selection persistence across refreshes and searches

When `selectionMode === 'Multiple'`, selected row IDs are stored in `_persistedSelectionIds: Set<string>` (private).

- **On selection change** (`handleSelectionChanged`): set is rebuilt from `event.api.getSelectedRows()` using `String(row.id)`.
- **After each block loads** (inside `emitRows` / `successCallback`): for every row in the just-loaded block, `gridApi.getRowNode(String(row.id))?.setSelected(true)` re-checks the row if its ID is in the set. This fires for every block (initial load, search result, scroll block) so checkboxes survive filter/search/sort/cache-purge without any extra parent code.
- **`clearSelection()`**: clears `_persistedSelectionIds` first, then calls `gridApi.deselectAll()`. After this call, the next reload will NOT re-select anything.

This persistence relies on `getRowId` being wired (see [Row Identity — `getRowId`](#row-identity--getrowid)) so `getRowNode(id)` resolves in O(1).

### Select-all (header checkbox) — cross-scroll cascade (bug fixed here)

The header checkbox's "select every row" (`selectAllActive` flag, set by `toggleSelectAll(true)`) must keep covering rows loaded by *later* scroll blocks too — AG Grid's Infinite/clientSide model has no native cross-block select-all.

- **Where it used to break**: the cascade was driven by `setTimeout(0)` called right after appending a fetched block to `resolvedRowData`. AG Grid's actual row-model update (via the `[rowData]` Angular binding) consistently lagged that macrotask by exactly one batch — earlier batches "self-healed" because the *next* batch's timer re-swept and caught the stragglers, but the **last** batch has no next timer to catch it, so its rows were permanently left unselected. Confirmed empirically (a 622-row grid always landed on `selectedCount === 600`, 21 short — the size of the final partial page).
- **Fix**: the sweep now runs from `onModelUpdated()` instead of a blind timer. That callback only fires once AG Grid's row model has actually finished processing the change, so the sweep (`selectFreshlyLoadedRows()` — idempotent full re-sweep via `gridApi.forEachNode(...).setSelected(true, false, 'api')`) always sees every row that exists at that moment, including the final block.
- **Also fixed alongside this**: the underlying scroll-pagination deadlock and a sort-stability bug that were silently dropping/duplicating rows before selection even got involved — see [Scroll-Trigger Deadlock](#scroll-trigger-deadlock-pixel-based-fix) and the `sortBy` gotcha below.

## @Inputs — Illustrated / Empty-State (flat)

| Input | Default | Description |
|---|---|---|
| `showIllustratedMessage` | `true` | When `true` and grid has no rows: show SAP UI5 `<ui5-illustrated-message>` instead of plain text. The overlay forces **`design="Scene"`** (large illustration) — `design="Auto"` shrink-wrapped to the text width (~316px) inside AG's centered overlay wrapper and resolved to the tiny 128px `Spot` icon. |
| `IllustratedName` | `'NoData'` | UI5 illustrated message variant name. **Only `'NoData'` is bundled** — `ag-grid-cell-renderers.component.ts` side-effect-imports `@ui5/webcomponents-fiori/dist/IllustratedMessage.js` + `illustrations/NoData.js` so the table is self-contained. Other variants (`'NoSearchResults'`, `'NoEntries'`, `'EmptyList'`, …) render a generic fallback unless you add their `illustrations/<Name>.js` import. |
| `IllustratedTitle` | `'There's no data yet'` | Title slot text |
| `IllustratedSubtitle` | `'When there is, you'll see it here.'` | Subtitle slot text |
| `IllustratedMessageHeight` | `''` | CSS height — defaults to `calc(100vh - 160px)` when empty |
| `noRowsMessage` | `'No records found'` | Empty-state overlay text (i18n via `$localize`) |

## @Inputs — Misc (flat)

| Input | Default | Description |
|---|---|---|
| `isBusy` | `false` | External loading overlay — shows skeleton overlay when `true` |
| `globalFilterValue` | `''` | Client-side quick filter passthrough |
| `isAdmin` | `true` | Reserved |
| `isTreeTable` | `false` | Reserved — AG Grid Enterprise only |
| `onDoubleClick` | `undefined` | `(row: TData) => void` — double-click callback (not EventEmitter) |

### `toolbarConfig` — `AgGridTableToolbarConfig`

All text fields use `$localize` defaults — i18n-translated at runtime.

**Title + search**

| Field | Default | Was | Description |
|---|---|---|---|
| `headerTitle` | `''` | `headerTitle` | Toolbar title |
| `showRowCount` | `false` | `showRowDataCount` | Show `(N)` after title |
| `showSearch` | `true` | `showSearch` | Debounced search (350ms) → OData / custom API |
| `searchPlaceholder` | `'Search'` | *(new)* | Search box placeholder (wired to `[placeholder]`) |
| `isGlobalSearchVisible` | `true` | `isGlobalSearchVisible` | Gates search box render |
| `showScanner` | `false` | `showSearchScanner` | Barcode icon → `toolbarAction:{actionId:'scanner'}` |

**Standard buttons** (handler / emit in parens)

| Field | Default | Was | Notes |
|---|---|---|---|
| `showNewButton` | `false` | `showNewButton` | emit `newButtonClick` |
| `addButtonText` | `'Add'` | `addButtonText` | New button label |
| `addButtonDisable` | `false` | `addButtonDisable` | — |
| `showRefreshButton` | `false` | `showRefreshButton` | ✓ internal + emit `refreshButtonClick` |
| `refButtonText` | `'Refresh'` | `refButtonText` | — |
| `showExtraButton` | `false` | `showExtraButton` | emit `extraButtonClick` |
| `extraButtonText` | `'Extra'` | `extraButtonText` | — |
| `extraButtonDisable` | `false` | `extraButtonDisable` | — |
| `showSyncButton` | `false` | `showSyncButton` | emit `syncButtonClick` |
| `syncButtonText` | `'Sync'` | `syncButtonText` | — |
| `syncButtonDisable` | `false` | `syncButtonDisable` | — |
| `showDownload` | `false` | `showDownload` | emit `downloadButtonClick` |
| `disableDownloadButton` | `false` | `disableDownloadButton` | — |
| `showUpload` | `false` | `showUpload` | emit `uploadButtonClick` |
| `disableUploadButton` | `false` | `disableUploadButton` | — |
| `showDeleteButtonInHeader` | `false` | `showDeleteButtonInHeader` | emit `deleteButtonClick` |
| `deleteButtonText` | `'Delete'` | `deleteButtonText` | — |
| `showTripButtons` | `false` | `showTripButtons` | emit `clearButtonClick` |
| `clearTrip` | `'Clear Trip'` | `clearTrip` | — |
| `productionDefaultButtonText` | `''` | `productionDefaultButtonText` | Production button — shown when non-empty, emit `productionDefaultButton` |
| `showTableSettingBtn` | `true` | `showTableSettingBtn` | ✓ opens dialog + emit `settingsButtonClick` |
| `showValueHelp` | `false` | `showValueHelp` | emit `valueHelperButtonClick` |

**Active/Inactive segmented control** — ANDs `is_active eq true/false` into the OData `$filter`; `activeSegment` also accepts arbitrary strings for custom segments. No parent event needed for filtering.

| Field | Default | Was | Description |
|---|---|---|---|
| `showSegmentButton` | `false` | `showActiveButton` | Show All/Active/Inactive segmented control |
| `button1Text` | `'All'` | `button1Text` | `activeSegment='all'` |
| `button2Text` | `'Active'` | `button2Text` | `activeSegment='active'` → `is_active eq true` |
| `button3Text` | `'Inactive'` | `button3Text` | `activeSegment='inactive'` → `is_active eq false` |
| `button4Text` | `''` | `button4Text` | Optional 4th segment (e.g. "Expired") — shown when non-empty |

**Declarative (advanced):** `actions?: AgGridTableToolbarAction[]`, `segments?: AgGridToolbarSegmentGroup[]`, `filters?: AgGridToolbarFilter[]` — also live on `toolbarConfig`.

> ⚠️ `showActiveButton` was renamed to **`showSegmentButton`** in `toolbarConfig`.

**Selected-segment styling.** Every toolbar segmented group (built-in Active/Inactive, `toolbarSegments`, legacy `segmentButtonItems`) carries the `.ag-grid-table-toolbar__seg` class. The component SCSS rings the active item (`ui5-segmented-button-item[selected]`) with a `box-shadow` (paints outside the host box → not clipped by the UI5 item's shadow DOM) + a thin `outline`, both in `--sapButton_Selected_BorderColor`, `z-index:1` to sit above flush neighbours. Targets `[selected]` (the parent-managed active flag) so the ring shows on the auto/default-selected segment on load, not only after a click.

## @Inputs — Toolbar (still flat)

| Input | Default | Description |
|---|---|---|
| `valueHelpers` | `[]` | Array of additional value help inputs (emit per vh) |
| `isBeforeDefaultButon` | `false` | Render `multipleButtons` before standard buttons |

## @Inputs — Switch

| Input | Default |
|---|---|
| `showSwitch` / `ShowSwitch` | `false` — either flag enables the switch (computed getter `showToolbarSwitch`) |
| `selectedSwitchValue` | `false` |
| `switchLabel` | `''` |
| `switchValue` / `switchComponent` | Reserved |

## @Inputs — Date Pickers (direct, legacy style)

| Input | Default |
|---|---|
| `showDatePicker` | `false` |
| `showDateRangePicker` | `false` |
| `datePickerPlaceholder` | `''` |
| `dateRangePickerPlaceholder` | `''` |
| `datePickerValue` | `''` |
| `dateRangePickerValue` | `''` |
| `datePickerFormat` | `'dd/MM/yyyy'` |

## @Inputs — Combo Boxes (legacy, up to 2)

| Input | Default |
|---|---|
| `isComboBoxOneActive` / `isComboBoxTwoActive` | `false` |
| `comboBoxOneLabelText` / `comboBoxTwoLabelText` | `''` |
| `comboBoxOneDisabled` | `false` |
| `comboBoxOneData` / `comboBoxTwoData` | `AgGridComboBoxData` — `{ textAccessor, idAccessor, data[] }` |

## @Inputs — Multi-Selects (legacy, up to 4)

| Input | Default |
|---|---|
| `isMultiSelectOneActive..Four` | `false` |
| `multiSelectOne..FourLabelText` | `''` |
| `multiSelectOne..FourPlaceholder` | `''` |
| `isMultiSelectOneSelectAllFlag` | `true` |
| `multiSelectOne..FourData` | `AgGridMultiSelectData` — `{ textAccessor, idAccessor, isSelectedAccessor?, data[] }` |

## @Inputs — Button Groups

| Input | Type | Description |
|---|---|---|
| `segmentButtonItems` | `{id, name, defaultSelect?}[]` | Legacy custom segment group |
| `customTitleSegmentButtons` | `any[]` | Buttons rendered next to title |
| `customSecondaryToolbarButtons` | `AgGridCustomButton[]` | Extra toolbar buttons |
| `multipleButtons` | `AgGridCustomButton[]` | Generic buttons — before/after default based on `isBeforeDefaultButon` |
| `customActionButtons` | `AgGridCustomButton[]` | Replace default edit/delete/info in action column |

`AgGridCustomButton`:
```typescript
{
  id?: string;
  text?: string;
  icon?: string;
  design?: 'Default' | 'Emphasized' | 'Transparent' | 'Positive' | 'Negative';
  tooltip?: string;
  disable?: (row: any) => boolean;
  hide?: (row: any) => boolean;
  onClick?: (row: any) => void;
}
```

## @Inputs — Action Column

| Input | Default | Description |
|---|---|---|
| `showAction` | `false` | Render right-pinned action column |
| `editPermission` | `true` | Master gate — if false, no action column even if `showAction=true` |
| `showEditButton` | `true` | Edit → emits `editClick` |
| `showDeleteButton` | `true` | Delete → emits `deleteClick` + `deleteClickNew` |
| `showInfoButton` | `false` | Info → emits `infoClick` |
| `editDisabledFn` | `undefined` | `(row: TData) => boolean` — per-row disable for the Edit button (button renders but is greyed out/unclickable for rows where this returns `true`) |
| `deleteDisabledFn` | `undefined` | `(row: TData) => boolean` — per-row disable for the Delete button, same semantics as `editDisabledFn` |
| `customActionButtons` | `[]` | Extra buttons (appended after edit/delete/info) |

Width = `40 + actions.length * 44`.

`editDisabledFn`/`deleteDisabledFn` are wired straight into the built-in `edit`/`delete` entries' `AgGridTableRowAction.disabled` callback (the same per-row `disabled`/`visible` mechanism `customActionButtons` already used via `btn.disable`/`btn.hide`) — `AgGridActionCellRendererComponent.isDisabled()` was already reading `action.disabled(row)` for custom buttons; these two inputs just expose that same capability for the standard Edit/Delete buttons instead of requiring a full `customActionButtons` replacement. Use this for rows that must stay visible/selectable but not editable or deletable (e.g. seeded/system master-data rows) — see [`APPROVER_LIST_COMPONENT_CONTEXT.md`](../base-data/approver-management/APPROVER_LIST_COMPONENT_CONTEXT.md) for a real usage.

## Sorting / Pagination — now `dataSource` fields

Moved from flat inputs into `dataSource` (see the `dataSource` table above): `customSorting` (was `isNewCustomSorting`), `pagination`, `paginationPageSize`, `scrollPagination`.

- `dataSource.customSorting` — emit `customSorting` event instead of sending sort to OData.
- `dataSource.pagination` — numbered page-button pagination on top of Infinite Row Model. Shrinks the virtual scroll area to one page → large/usable thumb + page controls. Still lazy (1 page = 1 OData block).
- `dataSource.paginationPageSize` — page size for `pagination`; defaults to `pageSize` (block↔page 1:1 — keep equal to avoid wasted fetches).
- `dataSource.scrollPagination` — **on-scroll pagination** (true infinite scroll). Defers the total from AG Grid — reports `lastRow` only on the final (short) block → thumb stays large and **grows as the user scrolls**. Toolbar still shows the real `$count` total.

**Pick one:** `pagination` = page buttons (fixed thumb); `scrollPagination` = continuous scroll (growing thumb). Default (both off) = classic infinite scroll with a thumb proportional to total (hair-thin on big datasets — see Scrollbar Behavior below).

## Row Identity — `getRowId`

`getRowId` is **hardwired** in the template via a protected arrow function:

```typescript
protected readonly rowIdGetter = (params: GetRowIdParams): string =>
  String((params.data as any)?.id ?? '');
```

`[getRowId]="rowIdGetter"` is always bound on the `ag-grid-angular` element. This enables O(1) row lookup (`gridApi.getRowNode(id)`) for selection persistence, inline update/delete. All entities must have an `id` field for this to work correctly; rows without `id` get an empty-string key and may behave unexpectedly.

> ⚠️ **`getRowId` applies to pinned rows too.** Placeholder filler rows (`pinnedBottomRowData`) therefore each carry a unique `id` (`__agFiller___<i>`); without it they all key to `''` and AG Grid collapses every filler into one row. See [Placeholder Filler Rows](#placeholder-filler-rows-fillemptyrows).

## @Inputs — Advanced Toolbar Controls (new API)

| Input | Type | Description |
|---|---|---|
| `toolbarFilters` | `AgGridToolbarFilter[]` | `date`, `dateRange`, `select`, `multiSelect`, `switch` inline controls |
| `toolbarSegments` | `AgGridToolbarSegmentGroup[]` | Custom segmented button groups |

`AgGridToolbarFilter` discriminated union — `type` values (lowercase): `'date'`, `'dateRange'`, `'select'`, `'multiSelect'`, `'switch'`. All emit via `toolbarAction` with `actionId: 'filter:<id>'`.

---

## @Outputs — Toolbar

| Output | Payload | When |
|---|---|---|
| `newButtonClick` | `void` | New button |
| `refreshButtonClick` | `void` | Refresh button (grid also reloads internally) |
| `extraButtonClick` | `void` | Extra button |
| `syncButtonClick` | `void` | Sync button |
| `downloadButtonClick` | `void` | Download button |
| `uploadButtonClick` | `void` | Upload button |
| `deleteButtonClick` | `void` | Header delete button |
| `settingsButtonClick` | `void` | Settings button (dialog also opens internally) |
| `clearButtonClick` | `void` | Clear Trip button |
| `valueHelperButtonClick` | `any` | Value help input clicked |
| `segmentedButtonClick` | `any` | Active/Inactive/All segment clicked — value: `'all'`/`'active'`/`'inactive'` |
| `segmentButtonChange` | `any` | Legacy `segmentButtonItems` item clicked |
| `toolbarAction` | `{actionId, value?}` | Custom buttons / scanner / toolbarFilters / toolbarSegments |
| `productionDefaultButton` | `void` | Production button |
| `productionButton` | `void` | Reserved |
| `multipleButtonEmitter` | `any` | `multipleButtons` item clicked |
| `defaultButtonClick` | `void` | Reserved |
| `onSwitchChange` | `boolean` | Switch toggled |
| `changeDatePicker` | `any` | Date picker value changed |
| `changeRangeDatePicker` | `any` | Date range picker value changed |
| `comboBoxOneSelectionChanged` / `comboBoxTwoSelectionChanged` | `any` | Combo box selection |
| `multiSelectOne..FourSelectionChanged` | `any` | Multi-select selection |

## @Outputs — Grid

| Output | Payload | When |
|---|---|---|
| `rowClick` | `TData` | Row clicked |
| `rowDoubleClicked` | `TData` | Row double-clicked (or `onDoubleClick` callback used) |
| `selectionChanged` | `TData[]` | Selected rows changed |
| `editClick` | `TData` | Edit action button |
| `deleteClick` | `TData` | Delete action button — full row |
| `deleteClickNew` | `TData` | Same as `deleteClick` — alternate handler |
| `infoClick` | `TData` | Info action button |
| `rowAction` | `{actionId, row}` | Custom action button |
| `cellEdited` | `{row, field, newValue, oldValue}` | Cell editor committed |
| `onInputValueChange` | `{id, data, accessor, value}` | Cell value changed (legacy format) |
| `incrementorRealtimeValue` | `any` | Integer step real-time change |
| `processData` | `any[]` | Fires on every successful data load with `[rows]` — **do NOT call refreshGridData here** |
| `dataLoaded` | `number` | Total count after load |
| `onColumnFilter` | `any` | AG Grid filter model changed |
| `columnReorder` | `any` | Column moved |
| `customSorting` | `any` | Sort changed when `isNewCustomSorting=true` |
| `searchClick` | `any` | Search triggered (icon click / Enter) |
| `onSearchForCustomAPI` | `any` | Search in custom API mode — emits search text |
| `onSearchOnKeyUp` | `any` | Every keyup in search box |
| `onLoadMoreForCustomAPI` | `void` | More data needed in custom API mode |

---

## ⚠️ processData Infinite Loop

**`(processData)` fires on EVERY successful data load. NEVER call `refreshGridData()` in the handler.**

```typescript
// ✓ correct — no reload in grid's data-loaded notification
onGridDataLoaded(_rows: any[]): void { /* post-load hooks only */ }

// ✓ correct — CRUD refresh
processData(_event?: any): void { this.agGridRef?.refreshGridData(true); }
```

```html
<app-ag-grid-table (processData)="onGridDataLoaded($event)"></app-ag-grid-table>
<app-item-form (RefreshTable)="processData($event)"></app-item-form>
<app-delete-entity (isSuccess)="processData($event)"></app-delete-entity>
```

---

## Public Methods

| Method | Description |
|---|---|
| `refresh()` | Soft reload (no cache purge) |
| `refreshGridData(purgeCache: boolean)` | `true` = **hard datasource reset** (re-registers datasource) + reload, `false` = soft `refreshInfiniteCache()`. `true` clears `blockCache` + `knownRowCount` first. |
| `resetGridState()` | Clear search + filters + columns + localStorage + reload |
| `getSelectedRows(): TData[]` | Currently selected rows |
| `getGridApi(): GridApi<TData>` | Raw AG Grid API |
| `clearSelection()` | Clears `_persistedSelectionIds` then calls `gridApi.deselectAll()`. Call after work is done (bulk update, etc.) to prevent re-selection on next reload. |
| `exportToCsv(filename?)` | CSV export (AG Grid Community) |

---

## Column Definition — `AgGridTableColumn<TData>`

Extends `ColDef<TData>`. Extra fields:

| Field | Type | Description |
|---|---|---|
| `initiallyVisible?` | `boolean` | `false` → starts hidden |
| `filterControl?` | `AgGridTableFilterControl` | In-header filter type: `dateRange`, `singleSelect`, `multiSelect` |
| `editor?` | `AgGridTableEditorConfig` | Inline editor config — union of `text`, `number`, `integer`, `textarea`, `select`, `checkbox` |
| `afterValueChange?` | `(row, field, newVal, oldVal) => void` | Per-column save hook |
| `dataType?` | `GridTableColumnDataType` | Auto-wires renderer/editor (legacy-compatible) |
| `comboBoxValues?` | `any[]` | Options for `DropdownSingle` / `DropdownMulti` / `UI5elect` dataTypes |
| `accessorArray?` | `string[]` | Paths for `NestedString` / `MultipleString` / `NestedInt` |
| `cellIcons?` | `any[]` | Icon config for `IconText` dataType |
| `iconPosition?` | `'left' \| 'right'` | Icon position for `IconText` |
| `minValue?` | `number` | Min for `NumberField` / `IntegerField` |
| `decimalPlaces?` | `number` | Decimals for `NumberField` |
| `extraText?` | `string` | Placeholder for `InputField` / `NumberField` |
| `numberOfRows?` | `number` | Rows for `InputArea` |
| `isRequired?` | `boolean` | Required state for editors (boolean only) |
| `isReadOnly?` | `boolean` | Read-only state for editors (boolean only) |
| `isDisabled?` | `boolean \| ((row: TData) => boolean)` | Disabled state — supports per-row function |
| `onInput?` / `onSelectChange?` | function | Dropdown callbacks |

---

## GridTableColumnDataType Enum

Auto-wires renderer/editor when `column.dataType` is set. No need to set `editor` or `cellRenderer` manually.

| DataType | Effect |
|---|---|
| `String` | Plain string column — no special wiring |
| `Boolean` | `AgGridBooleanCellRendererComponent`, filter off |
| `Checkbox` | `AgGridCheckboxEditorComponent` + `AgGridBooleanCellRendererComponent` |
| `InputField` | `AgGridTextEditorComponent` |
| `NumberField` | `AgGridNumberEditorComponent`, numericColumn |
| `IntegerField` / `Integer` | `AgGridIntegerEditorComponent`, numericColumn |
| `InputArea` | `AgGridTextareaEditorComponent` (popup) |
| `DropdownSingle` / `UI5elect` | `AgGridSelectEditorComponent` from `comboBoxValues` |
| `DropdownMulti` | Multi-select dropdown from `comboBoxValues` |
| `Number` | `agNumberColumnFilter`, numericColumn |
| `Date` / `UI5DateRangePicker` | in-header dateRange filter |
| `TimeStamp` | `valueFormatter` → `toLocaleString()` |
| `Time` | `valueFormatter` → HH:MM:SS substring |
| `IconText` | `AgGridIconTextCellRendererComponent` from `cellIcons` |
| `NestedString` / `MultipleString` | `valueGetter` joining `accessorArray` paths with ` / ` |
| `MultipleDate` | Multiple date values display |
| `NestedInt` | `valueGetter` on first `accessorArray` path, numericColumn |
| `NestedArray` | Nested array value display |
| `Color` | DOM cell renderer — colored swatch + text |
| `NumberMinuteToSecond` | Number formatter — minutes to seconds |
| `Custom` | No auto-wiring — set `cellRenderer` manually |

## Row Model Behavior — Strategy Selection

A single getter `dataSourceStrategy` (derived **only** from the resolved config) picks the load path; downstream code (`onGridReady`, `refreshGridData`, search) switches on it. `type` is honoured explicitly — `type:'api'` **never** falls back to OData.

| Strategy | When | Row Model | Behavior |
|---|---|---|---|
| `static` | `dataSource.staticData = true` | `clientSide` | `rowData` = `dataSource.data` |
| `customApi` | `dataSource.customApi = true` | `clientSide` | emits `onLoadMoreForCustomAPI`, stores AG Grid params, resolves when `dataSource.data` updates |
| `api` | `dataSource.type = 'api'` | `infinite` | `createApiDatasource()` — paginates `customEndpoint` via `/api` with `$top`/`$skip` (see below) |
| `odata` | otherwise (`type:'odata'`) | `infinite` | IDatasource + OData query builder, AG Grid manages pages |

### `sortBy` gotchas (four real bugs fixed here, keep in mind for future changes)

1. **`sortBy` must reference a column that actually exists in `columns`.** The forced sort is applied via `gridApi.applyColumnState({state:[{colId: sortBy, ...}]})`, which is a no-op if no column has that `colId`/`field`. If you want to sort by a field that isn't otherwise shown, add a hidden column: `{ field: 'created_at', hide: true }`.
2. **Order matters in `onGridReady`**: the forced-`sortBy` `applyColumnState` call must run **before** `loadRows()`/`setGridOption('rowData', …)` — `loadRows()` reads `gridApi.getColumnState()` **synchronously** to build its `sortModel`, so applying the sort after kicking off the fetch means the very first request (and, since `handleSortChanged` explicitly ignores `event.source === 'api'`, every subsequent one too) never carries the configured `$orderby`. Fixed by moving the sort-apply block above the `switch (strategy)` load block in `onGridReady`.
3. **`restoreSavedState()`** only keeps a persisted column's sort when **no** `sortBy` is configured; when `sortBy` **is** configured it strips any persisted sort so the config always wins (previously inverted — a stale persisted state, e.g. from before `sortBy` was added to a page, would silently clobber the forced sort on load).
4. **Non-unique sort columns silently lose/duplicate rows across scroll pages, for real OData backends only.** `$skip`/`$top` offset pagination needs a deterministic row order; a sort column with repeated values (e.g. many bulk-seeded employees sharing the same `created_at`) gives MySQL no guaranteed tie order, so the same row can reappear on a later page while another is skipped — `AgGridTableQueryBuilderService.buildSortQuery()` was silently collapsing the AG Grid row count below the real total via `getRowId` reconciliation on the duplicates. Fixed by always appending a stable `id asc` tiebreaker to `$orderby` when a primary sort clause exists. **Gated to `type:'odata'` only** (`buildFetchParams` now passes the real `ResolveDataSource.type` through instead of hardcoding `'odata'`) — `type:'api'` grids (Promotions, LowStock, etc.) hit bespoke REST controllers whose `$orderby` parsing is a single anchored `field (asc|desc)` regex with no comma support, so the tiebreaker is skipped there to avoid silently breaking their column-sort feature.

If a list's `sortBy`/`searchFields` "isn't working," check all four of these first before assuming a page-specific bug.

`dataSourceStrategy` resolves in priority order: `static` → `customApi` → `api` → `odata`.

---

## API Source (`type:'api'`)

Server-paginated API request flow — **not** OData.

1. Uses AG Grid **infinite row model** — same as OData, but calls the `/api` prefix.
2. URL = `dataSource.customEndpoint` (falls back to `endpoint`), leading `/` stripped.
3. Each block sent via `commonService.get(endpoint, /*isLodata*/ false, false, httpParams)` with `$top` and `$skip` query params (and `$count=true` on the first block).
4. Response shape: `resultField` → `{data, total}` → `{value, @odata.count/@count}` → bare array.
5. `scrollPagination` and `pagination` flags apply exactly as in OData mode.

⚠️ `dataSource.filter` / `baseFilter` / segment filters are **not** sent server-side in `api` mode (those are OData `$filter` strings). Apply filtering via URL params or query string in `customEndpoint`.

---

## Custom API Mode (`dataSource.customApi = true`)

1. Search box triggers `onSearchForCustomAPI.emit(value)` instead of OData filtering
2. `onLoadMoreForCustomAPI` emitted when grid needs rows
3. Parent fetches data, passes it back via `dataSource.data` (reassign the `dataSource` object → `ngOnChanges` picks it up)
4. Component detects the change → sets `rowData` on AG Grid → resolves pending params

---

## OData Filter Composition

`buildCombinedFilter()` ANDs:
1. `dataSource.filter` — base filter (was `filterQuery`)
2. `dataSource.baseFilter` — extra filter (was `additionalFilterQuery`)
3. Active segment filter (`is_active eq true/false` when not 'all')

AG Grid column filters (from in-header inputs) handled separately by `AgGridTableQueryBuilderService`.

Search (OData strategy): `contains(field, 'value')` across `dataSource.searchFields`, OR `$search=value` when `dataSource.serverSearch = true`. **Client-side strategies (`static` / `api`)** route the toolbar search through AG Grid `quickFilterText` instead (`runSearch()`); `customApi` emits `onSearchForCustomAPI`.

⚠️ **`quickFilterText` skips hidden columns by default** (AG Grid default `includeHiddenColumnsInQuickFilter: false`) — a column that's hidden (stale persisted layout, `initiallyVisible: false`, manually hidden via column settings) silently drops out of every `static`/`api`-strategy search even though its data still exists on the row. `[includeHiddenColumnsInQuickFilter]="true"` is now hardwired on the `ag-grid-angular` element (`ag-grid-table.component.html`) so quick search always matches against every column's data regardless of current visibility. Do not remove this — it was added specifically to fix client-side search silently returning 0 rows for values that live in a hidden/reordered column.

---

## State Persistence

Key: `mes-ag-grid:<resolvedGridId>`
Stored: `columnState`, `filterModel`, `searchText`, `columnSchemaHash`
Saved on: sort, filter, column move/resize/visibility.
Only active when `isBase=true` or `isTableCacheEnabled=true`.
Writes are **debounced 600ms** — column resize drag does not flood localStorage.

---

## Performance Architecture

### Request Cancellation
`fetchCancel$` Subject emits on every `refreshGridData(true)` (filter/sort/search/segment change). In-flight OData HTTP calls race against `takeUntil(fetchCancel$)` — cancelled requests return `null` and skip `successCallback`. Prevents stale responses from previous queries from corrupting the current datasource.

### Hard Datasource Reset (scrollbar shrink fix)
`refreshGridData(true)` calls `setGridOption('datasource', this.createDatasource())` — **NOT** `purgeInfiniteCache()`. Re-registering the datasource builds a fresh `InfiniteCache` (`rowCount→0`, `maxRowFound→0`, `lastRowIndexKnown→false`). `purgeInfiniteCache()` reuses the existing cache, so its discovered row count (e.g. ~1991 from a pre-filter dataset) survives — the scrollbar stays sized to the OLD count even though the new block returns 65 rows. The hard reset guarantees the scroll range matches the filtered total. App-level `blockCache.clear()` + `knownRowCount=undefined` still run first.

> Note: header **text/number/dateRange/singleSelect** filters still call `this.params.api.purgeInfiniteCache()` directly in the header's `applyModel()` — same latent scrollbar-staleness risk. Only the multiSelect (direct-OData) path and component-level reloads route through the hard reset. Fix pending.

### Row Count Strategy — `emitRows()`
Every fetched block flows through `emitRows(params, request, result)`. `totalRowCount` (toolbar) always gets the real total. The `lastRow` reported to AG Grid's `successCallback` controls the virtual scroll height:
- **`scrollPagination` ON** → report `lastRow` only when `result.rows.length < limit` (final short block); otherwise `undefined` (unknown) → AG sizes scroll area to loaded + 1 block → thumb large, grows on scroll.
- **OFF** → report `result.total` → exact scroll range (thin thumb on big sets).

### Scroll-Trigger Deadlock (pixel-based fix)

> Current code note: `resolvedRowModelType` always returns `'clientSide'` — rows accumulate in a component-level `resolvedRowData` array (`loadRows()` for the initial block, `loadMoreRows()` for each scrolled-in block), not AG Grid's native `IDatasource`/`getRows()`/`successCallback` Infinite Row Model described elsewhere in this doc. Treat any `emitRows()`/`successCallback` reference above as describing an earlier architecture — the mechanism below is what actually runs today.

`onGridBodyScroll` (bound to AG Grid's `(bodyScroll)` output) decides when to fetch the next block. It used to compare `gridApi.getLastDisplayedRowIndex()` against `resolvedRowData.length - 10` — a row-index heuristic that can permanently undershoot right at the true scroll bottom (AG Grid's "last displayed row" doesn't reliably reach `total - 1` there; it's viewport-height/row-height dependent, not a fixed offset). Once that happens, `scrollTop` is already maxed out (no more content to scroll into), so no further scroll event with a different position ever fires — the grid deadlocks at whatever row count it had loaded, no matter how much the user keeps scrolling. Reproduced live: a 622-row grid consistently stalled at ~120 rows.

**Fix**: the trigger now measures actual pixel distance to the bottom of `.ag-body-viewport` (`scrollHeight - scrollTop - clientHeight <= SCROLL_TRIGGER_THRESHOLD_PX`, 400px) instead of a row-index guess. This can't undershoot the way the row-index check could — verified live loading all 622/622 rows with no stall.

### $count Skipped on Scroll Pages
`$count=true` is sent only on the **first block** (`startRow === 0`). Subsequent scroll blocks use the cached `knownRowCount` — no COUNT(*) query on the server. `knownRowCount` resets to `undefined` on every purge.

### Debounced State Persistence
`saveState()` emits to `saveStateTrigger$` (debounced 600ms) → `_persistState()` writes localStorage once per interaction, not 60× per column resize drag.

### Sort Change Detection
`handleSortChanged` hashes only `{colId, sort, sortIndex}` per column — not the full column state. Prevents spurious re-fires from unrelated column mutations.

### Block Response Cache
`blockCache: Map<string, AgGridTableResult>` stores every successfully fetched OData block keyed by `endpoint?$top=N&$skip=N&$filter=...&$orderby=...&$expand=...` (excluding `$count`). On cache hit, returns stored rows immediately — zero HTTP calls. On `refreshGridData(true)` (filter/sort/search/segment change), cache is cleared alongside `knownRowCount` and `purgeInfiniteCache()`. Max 200 entries; oldest entry evicted on overflow (Map insertion-order LRU).

### Category MultiSelect Filter — Known Fixes

Three bugs were identified and fixed:

1. **Integer OData quoting** — `case 'in'` in `buildTextFilterExpression` now checks `Number(v)` — numeric IDs emit `eq 1` (unquoted), strings emit `eq 'value'` (quoted). Previously all values were quoted → `category/id eq '1'` which fails on integer FK columns.

2. **Separate OData channel (not AG Grid filter model)** — `onMultiSelect` does NOT route through AG Grid's filter model. It reads selected items off the UI5 event (`event.detail.items ?? event.items`), stamps each item's `value`, stores them in the local `multiSelected` Set, and hands the model `{filterType:'text', type:'in', filter: values.join('|')}` straight to the grid via `params.context.setColumnOdataFilter(colId, model)` in `applyMultiSelectFilter()`. The grid component builds the OData `$filter` fragment and reloads. State lives locally — `syncFromFilterModel()` early-returns for `multiSelect` so a `filterChanged` from another column never resets it.

3. **Explicit datasource refresh (non-multiSelect path)** — `applyModel()` (text/number/dateRange/singleSelect) calls `api.purgeInfiniteCache()` after `onFilterChanged()` as a safety net for IRM. `onFilterChanged()` alone is not guaranteed to trigger `getRows` when called from UI5 event context.

> Note: the current header (`ag-grid-custom-header.component.ts`) injects only `ChangeDetectorRef` + `ElementRef` — there is no `ngZone.run()` wrapper. Change detection after UI5 events is handled via explicit `cdr.markForCheck()`.

### Popup State Persistence (multiSelect)

The filter popup uses `*ngIf="filterType !== 'none'"` (rendered once, never destroyed) + CSS class `hdr-popup--hidden` (`visibility:hidden; pointer-events:none; opacity:0`) to show/hide. This keeps `ui5-multi-combobox` in DOM — its internal selection state is preserved by UI5 across popup open/close cycles.

Outside-click detection also excludes UI5 portal elements: `closest('ui5-responsive-popover, ui5-popover, ...')` prevents closing the popup when the user is clicking items inside the UI5 dropdown portal (rendered in `document.body` outside the component's DOM subtree).

### Synchronous Cache Hit in `getRows`
`checkBlockCacheSync()` is called at the start of `getRows` (synchronously, before the async path). When it finds a cached block, `successCallback` is called within the same tick → AG Grid never transitions the row to "loading" state → **zero blank flash** even on slow networks for already-loaded blocks.

### Row Identity — `getRowId`
`rowIdGetter = (params) => String(params.data?.id ?? '')` registered at grid level via `[getRowId]="rowIdGetter"`. Enables O(1) row lookup for update/delete/selection operations. Without it AG Grid uses O(n) array-index scan. Always uses the `id` field — entities without `id` get an empty-string key. **Pinned rows are not exempt:** placeholder fillers must each set a unique `id` or AG collapses them to one row (see [Placeholder Filler Rows](#placeholder-filler-rows-fillemptyrows)).

### `noRowsOverlayParams` — ⚠️ getter (allocation hotspot)
`noRowsOverlayParams` is a **getter** returning a new object literal, bound in the template `[noRowsOverlayComponentParams]`. AG Grid's binding diff re-reads it every change-detection cycle → constant object allocation. **Should** be memoized to a field rebuilt in `ngOnChanges` (illustrated-message inputs). Not yet fixed.

> The overlay itself is shown/hidden **explicitly** in `emitRows` (`result.total === 0 → showNoRowsOverlay()`, else `hideOverlay()`) — the Infinite Row Model does not auto-show it on a 0-row block. See [Placeholder Filler Rows](#placeholder-filler-rows-fillemptyrows).

### Scrollbar Behavior (Infinite Row Model)
With the default (no pagination), the scroll-area height = `totalRowCount × rowHeight`. For 1991 rows × 32px ≈ 63,700px vs ~800px viewport → thumb ≈ **1.3%** (hair-thin). This is **correct virtual scrolling** — DOM still holds only ~30 rows, memory constant. The thin thumb reflects total dataset, NOT DOM rows.
- Want a **usable thumb** → set `pagination` (page buttons, fixed thumb) or `scrollPagination` (continuous scroll, thumb grows as loaded — see `emitRows`).
- Server-Side Row Model has the same thin-thumb behavior (and is Enterprise/paid) — no gain.

### Angular `OnPush` + `markForCheck()`
`ChangeDetectionStrategy.OnPush` skips this component tree on all external events. `cdr.markForCheck()` is called explicitly after: datasource `successCallback`/`failCallback`, `setActiveSegment`, `onSegmentClick`, `onLegacySegmentClick`, `openColumnSettings`/`closeColumnSettings`, and the search debounce subscriber. Prevents AG Grid's internal event loop from triggering full-app change detection.

### UI5 Scroll-Load Indicator
A `<ui5-busy-indicator>` overlay (`.ag-grid-scroll-loader`, `position:absolute inset:0`, `pointer-events:none`) is bound `[active]="isGridLoading"`. `isGridLoading` flips `true` before **every** block/page API fetch in `getRows` and `false` in `emitRows`/error — so the loader activates on initial load, each scroll-pagination block, each page-button change, and every filter/sort/search reload. Cached blocks (sync `checkBlockCacheSync` hit) skip the loading state → no flash. Scroll/click pass through to loaded rows.

### Placeholder Filler Rows (`fillEmptyRows`)
When the data is shorter than the viewport, blank inert rows fill the empty space below the last row so the body reads top-to-bottom like a SAP/UI5 table (no large white gap). Enabled by default; opt out with `[fillEmptyRows]="false"`.

**Mechanism** — fillers are pushed into AG Grid's `pinnedBottomRowData`, which is **outside the row model**. They therefore never touch `rowCount` / `totalRecords`, sorting, filtering, selection, pagination, export, or the datasource (API). Infinite scroll keeps operating only on real data. AG renders them through the normal column pipeline, so they inherit row height, column widths, borders, grid lines, pinned-right (Actions) column, and horizontal-scroll sync for free. **Validated live** (Playwright on `/base-data/products`) across 0 / 1 / 3 / 1994 records + scroll.

- **Unique filler id (critical).** `[getRowId]` is applied to pinned rows too (returns `String(data.id ?? '')`). Each filler **must** carry a distinct `id` (`__agFiller___<i>`) — without it every filler resolves to the same `''` key and **AG Grid collapses all N fillers into ONE row** (the floating-bottom section renders a single 32px row, leaving the rest of the viewport blank). This was the original "fillers never appear" bug.
- **Count calc** (`updatePlaceholderRows`):
  - `avail = rootWrapper.clientHeight − header.offsetHeight − hScroll.offsetHeight`. Measured from the **fixed-height `.ag-root-wrapper`**, NOT `.ag-body-viewport`. The viewport's flex height is **transient mid-reload** (segment/search/sort): it reads tiny while the grid re-lays-out, which collapsed the count to ~1 and left a large blank band. The root-wrapper height is constant (= the grid container's CSS height) → correct count on the first pass, and stable across filler insertion (wrapper/header/scrollbar heights never change → no oscillation).
  - `realCount = totalRowCount > 0 ? min(getDisplayedRowCount(), totalRowCount) : getDisplayedRowCount()`. Clamped by the **real server total** (set in `emitRows`) because `getDisplayedRowCount()` returns a virtual, block-padded count in the Infinite Row Model before the last row is known (`cacheBlockSize` / `infiniteInitialRowCount`) → without the clamp `emptyPx` goes negative → `count = 0` → no fillers.
  - `count = floor((avail − realCount·rowH) / rowH)`. The sub-row pixel remainder is distributed **evenly** (`baseExtra = floor(rem/count)`; first `rem % count` fillers get `+1px`) via `__extra__` (consumed by `[getRowHeight]`) so the floating-bottom block fills exactly `emptyPx` with no gap and rows stay within ±1px. (Old `i < remainder ? 1 : 0` under-filled when `remainder > count`.)
- **Trigger** — `schedulePlaceholderUpdate()` (rAF-coalesced) is called from `(modelUpdated)`, `(gridSizeChanged)`, `(firstDataRendered)`, `onGridReady`, **and directly from `emitRows` after every data load**. The `emitRows` call is essential: in the Infinite Row Model `(modelUpdated)` is not guaranteed to fire after `successCallback`, and when it does the displayed count may still be the interim virtual count — driving the recalc from `emitRows` (after `totalRowCount` is set) guarantees one correct pass. Setting `pinnedBottomRowData` does **not** re-fire `modelUpdated` (pinned rows aren't in the model) → no loop.
- **Skips** when `realCount === 0` (lets the no-rows overlay show) or when data already fills/overflows the viewport (`count === 0` → clears `pinnedBottomRowData`, guarded by the local `placeholderRowCount` field so a no-op clear is skipped — no `getPinnedBottomRowCount()` call).
- **No-rows overlay (Infinite model).** AG does **not** auto-show the no-rows overlay when a block returns 0 rows. `emitRows` toggles it explicitly: `result.total === 0 → showNoRowsOverlay()`, else `hideOverlay()`. So 0-record results show the illustrated empty-state instead of a blank white body (a short final block on scroll has `total > 0`, so the overlay stays hidden).
- **Inert guards** (`withPlaceholderGuards`, applied to every colDef in `buildColumnDefs`) — for `rowPinned` cells: `editable → false` and `cellRendererSelector → blankCellRenderer` (`''`), so no values, renderers, editors, or action buttons render. `handleRowClicked` early-returns on `node.rowPinned`; `isRowSelectable` returns `false` for `PLACEHOLDER_FLAG` rows. Verified live: 0 selectable, 0 action buttons, all cells empty, toolbar count excludes fillers.
- **Styling parity** — `[getRowStyle]` stripes each filler by **absolute** index (`realCount + localPinnedIndex`) via the theme bg vars so zebra parity continues the real rows (and honours `alternateRowColors`). SCSS scopes `.ag-floating-bottom`: transparent cells/sections (stripe shows across the Actions column), 1px row `border-bottom` (full-width grid lines incl. Actions), normal-weight non-bold rows, a 1px `border-top` standing in for the last real row's bottom border, and `--ag-row-hover-color` / `--ag-selected-row-background-color` set to `transparent` (fillers never highlight on hover/select).
- **Residual:** in overlay-scrollbar environments a ≤ horizontal-scrollbar-height (≈16px) slack can sit at the real-row/filler boundary; on classic-scrollbar browsers (scrollbar consumes layout) it's 0. Sub-row, not a visible blank band.

---

## Header Filter Behavior (On-Demand)

Filter inputs are **hidden by default**. Each filterable column shows a funnel icon (▼) button on the right of the header cell.

- **Click filter icon** → popup opens (`position:fixed`, `z-index:9999`) below the header cell
- Popup contains the appropriate input for that column's filter type: text, number, date-range, single-select, or multi-select
- **Filter icon color**: gray = no filter active; blue = filter applied (`hasFilter=true`)
- **Close popup**: click outside, press `Escape`, or click icon again
- **Clear button** in popup footer — disabled when no filter active
- Non-filterable columns (`filter:false`) have no icon
- `[headerHeight]="40"` (was 72) — full header space recovered since filter row is gone

## Cell Editors — Native HTML

Inline cell editors use native HTML inputs for stability (linter enforces this pattern). All editors use `ngAfterViewInit` with `setTimeout` to focus and select. Enter key propagation to AG Grid works reliably with native inputs.

### Editor Types
| Editor | HTML Element | Notes |
|---|---|---|
| Text | `<input type="text">` | `[value]` binding + `onInput` handler |
| Number | `<input type="number">` | `parseFloat` in `getValue`, `[step]` for decimals |
| Integer | `<input type="number" step="1">` | `Math.round` in `getValue` |
| Textarea | `<textarea>` | popup editor, `isCancelBeforeStart: false` |
| Select | `<ui5-combobox>` | Only editor using UI5 — filter="Contains", options from `comboBoxValues` |
| Checkbox | `<ui5-checkbox>` | auto-commits on `ui5Change` via `stopEditing()` |

## Column Settings Dialog

The dialog body is a sticky search box on top of a CDK drag-and-drop list of column rows. Each row = drag handle (`<ui5-icon name="menu2" cdkDragHandle>`) + `<ui5-checkbox [text]="headerName">` for visibility. The list iterates `displayedColumnSettings` (search-filtered view of `columnSettingsDraft`); state always lives on the full `columnSettingsDraft`.

**Header** (`slot="header"`): dialog title + **Select All** + **Reset to Default** buttons. **Footer**: Submit (`applyColumnSettings`) + Cancel (`closeColumnSettings`).

### Drag-and-drop reorder (Angular CDK)

- `DragDropModule` is in the component `imports`. The list is a `cdkDropList`; rows are `cdkDrag` with the handle as `cdkDragHandle` (so the checkbox stays clickable). CDK drag classes (`.cdk-drag-preview` / `.cdk-drag-placeholder` / `.cdk-drag-animating` / `.cdk-drop-list-dragging`) live in the component `.scss` (global preview/placeholder nodes can't be Tailwind-styled).
- **Working-copy model.** The dialog is a temporary editor: drag (and hide) edit `columnSettingsDraft` **only** — AG Grid is NOT touched while the dialog is open. `onColumnDrop(event: CdkDragDrop)` runs once on drop → `moveItemInArray` on a draft copy → `markForCheck()`. No grid API call, no persist during drag.
- Order is committed to the grid **only on Submit**. `applyColumnSettings()` calls `applyColumnOrderFromDraft()` (order), then `setColumnsVisible` (visibility), then a single `_persistState()`. `applyColumnOrderFromDraft()` sorts the live `getColumnState()` by the draft's colId order and calls `applyColumnState({ applyOrder: true })` — it does NOT persist on its own. Columns absent from the draft (`__selection__` / `__actions__`) sort to the end; their pinned position governs placement so order among them is irrelevant.
- **Cancel / close / dismiss** (`closeColumnSettings`, dialog `before-close`) discards the draft. Since the grid was never touched, the original order/visibility and persisted state remain intact.
- **Dragging is disabled while a search filter is active** (`[cdkDragDisabled]="!!columnSettingsSearch"`) — the filtered view hides true neighbours, so the drop index would be ambiguous.

### Search

- Sticky `<ui5-input>` (search icon, clear icon) at the top of the scrollable body → `onColumnSettingsSearch`.
- `displayedColumnSettings` getter filters `columnSettingsDraft` case-insensitively by **`headerName` OR `colId` (column name) OR `field`**. Empty query → full list. Search never mutates visibility or order — it only narrows what renders. `buildColumnSettings()` captures `field` off the colDef for this.

### Visibility

- **Select All** (`selectAllColumns`) sets every non-locked column `visible: true`.
- Per-row checkbox toggle (`onColumnVisibilityToggle`) updates the draft only; locked columns (`lockVisible`) stay visible. Both visibility and order are committed to the grid on **Submit** (`applyColumnSettings`) — nothing touches the grid during drag/toggle.

`resetColumnSettings()` — applies `initialColumnState`, clears grid state service, rebuilds draft. Does NOT trigger `refreshGridData`.

---

## Usage Example (config-object API)

**Component** — build the config objects (permission flags resolve in field initializers; `rolePermissionService` is a constructor param-property, available before field init runs):

```typescript
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';

dataSource: AgGridTableODataSourceConfig<Product> = {
  type: 'odata',
  endpoint: 'Products',
  expand: 'suppliers,productTypes,category',
  searchFields: ['item_code', 'product_name'],
  pageSize: 40,
  scrollPagination: true,
};
toolbarConfig: AgGridTableToolbarConfig = {
  headerTitle: 'Items',
  showSearch: true,
  showScanner: true,
  showRowCount: true,
  showDownload: true,
  showSegmentButton: true,
  addButtonText: 'New',
  showNewButton: this.rolePermissionService.hasPermission(
    Permissions.BASE_DATA_ITEM_CREATE,
  ),
};
displayConfig: AgGridTableDisplayConfig = { gridHeight: 'calc(100vh - 118px)' };
```

**Template** — config objects + the still-flat groups (selection, state, action column, illustrated) + events:

```html
<app-ag-grid-table
  #gridRef
  [columns]="columns"
  [dataSource]="dataSource"
  [toolbarConfig]="toolbarConfig"
  [displayConfig]="displayConfig"
  selectionMode="Single"
  [isBase]="true"
  [showAction]="true"
  [showEditButton]="rolePermissionService.hasPermission(permissions.BASE_DATA_ITEM_EDIT)"
  [showDeleteButton]="rolePermissionService.hasPermission(permissions.BASE_DATA_ITEM_DELETE)"
  (newButtonClick)="newItem()"
  (editClick)="editItem($event)"
  (deleteClick)="deleteItem($event.id)"
  (rowClick)="onRowSelect($event)"
  (downloadButtonClick)="downloadData()"
  (processData)="onGridDataLoaded($event)"
  (cellEdited)="onCellEdited($event)"
></app-ag-grid-table>
```

---

## Rules

- Public binding surface = `[columns]` + `[dataSource]` + `[toolbarConfig]` + `[displayConfig]` + the still-flat groups (selection, state, action column, illustrated, switch, date pickers, combos, multi-selects, custom button arrays, advanced toolbar). **Breaking** vs the old flat API — old per-field inputs (`url`, `headerTitle`, `limit`, …) no longer exist.
- Build config objects as class field initializers (or in the constructor body) — `rolePermissionService` param-property is assigned before field initializers run, so `showNewButton: this.rolePermissionService.hasPermission(...)` is safe.
- `showActiveButton` was renamed to **`toolbarConfig.showSegmentButton`**.
- `dataSource.type` — `'odata'` (default, infinite + OData) or `'api'` (client-side, `/api` GET of `customEndpoint`, no OData params/prefix). Strategy is chosen by `dataSourceStrategy`; `'api'` never falls back to OData.
- `type:'api'` does NOT send `filter`/`baseFilter`/segment filters server-side (they are OData `$filter` strings) — use client-side column filters/search, or switch to `type:'odata'` for server-side filtering.
- `dataSource.endpoint` must NOT include `$expand` or query params — use `dataSource.expand` and `dataSource.filter`.
- `dataSource.additionalFilter` is internal (combined `$filter`) — set `filter` / `baseFilter`, never `additionalFilter`.
- `selectionMode` — capital first letter: `'Single'`, `'Multiple'`, `'None'` (still flat)
- `rowActions` visible/disabled — always define via `visible: () => permissionService.hasPermission(...)` (evaluated at row render, not init)
- `(processData)` → `onGridDataLoaded()` — never call `refreshGridData` here
- `(RefreshTable)` / `(isSuccess)` → `processData()` — call `refreshGridData(true)` here
- `deleteClick` emits full `TData` row object — extract `.id` in the handler
- `toolbarConfig.button4Text` — only shows 4th segment when non-empty string
- `dataSource.customApi = true` + reassigned `dataSource.data` → grid auto-resolves pending fetch
- `isRequired` / `isReadOnly` — boolean only; `isDisabled` alone supports `(row) => boolean`
- `toolbarConfig.filters[].type` — lowercase: `'date'`, `'dateRange'`, `'select'`, `'multiSelect'`, `'switch'`
- `displayConfig.alternateRowColors = false` — disables zebra striping; both odd/even rows same background
- `showIllustratedMessage=true` (flat) + no rows → `ui5-illustrated-message` shown; `IllustratedName` sets the variant; params update live via `ngOnChanges`
- `getRowId` — hardwired to `String(data.id ?? '')`; entities without an `id` field will have broken selection tracking and row lookup
- Cell editors: always use `[value]="initialValue"` (immutable field set in `agInit`) — never bind to a mutable field with `onInput`; causes feedback loop that clears the input
- Header filter popup: `[headerHeight]="40"` is set globally — do NOT change it; the popup is `position:fixed` and does not need extra header height
- Column settings Reset button calls `resetColumnSettings()` (columns only) not `resetGridState()` (which also purges data); use the right method intentionally
- Scrollbar thumb hair-thin on big datasets is **correct** infinite virtualization, not a bug — enable `dataSource.pagination` or `dataSource.scrollPagination` for a usable thumb; do NOT both at once
- `dataSource.scrollPagination` defers the total from AG Grid (toolbar still shows real `$count`) — never also pass the real total to `successCallback` in that mode
- `dataSource.paginationPageSize` should equal `pageSize` (=`cacheBlockSize`) so 1 block = 1 page
- `refreshGridData(true)` does a hard datasource reset (fixes scrollbar not shrinking after filter) — do not swap it back to `purgeInfiniteCache()`
- product-list / hall-list grids run with `dataSource.scrollPagination = true`; other grids default to classic infinite scroll
