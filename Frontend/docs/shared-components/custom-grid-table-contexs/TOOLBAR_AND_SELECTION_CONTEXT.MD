# Toolbar and Selection Context

This document covers the toolbar surface, search controls, segmented controls, combo boxes, date inputs, switches, and selection state.

## Toolbar Controls

### Search

- `showSearch` renders the global search box.
- `handleGlobalSearch(event)` stores the trimmed value in `globalSearchFieldValue`.
- When `enableServerSideFiltering === false`, the component also mirrors a normalized date value into `globalFilterValue`.
- Search icon click:
  - emits `onSearchForCustomAPI` in custom API mode
  - otherwise triggers server search
- Enter key:
  - prevents default behavior
  - triggers the same search branch

### Scanner

- `showSearchScanner` renders the camera icon next to search.
- `openCodeScannerDialog()` opens the dialog and starts scanning.
- `closeCodeScannerDialog()` stops the scanner and closes the dialog.
- `startCodeScanning()` picks a back/rear camera when available and updates the search field from the scanned value.

### Buttons

- `showNewButton` → `handleNewButtonClick()`
- `showRefreshButton` → `handleRefreshButtonClick()`
- `showExtraButton` → `handleExtraButtonClick()`
- `showSyncButton` → `handleSyncButtonClick()`
- `showDownload` → `handleDownloadButtonClick()`
- `showUpload` → `handleUploadButtonClick()`
- `showTableSettingBtn` → `toggleSettingDialog()` or `handleSettingsButtonClick()`
- `showDeleteButtonInHeader` → `handleDeleteButtonClick()`
- `showTripButtons` → `handleClearButtonClick()`

### Additional toolbar blocks

- `multipleButtons`
  - rendered before or after the default controls depending on `isBeforeDefaultButon`
- `customSecondaryToolbarButtons`
  - rendered as standalone buttons
- `customTitleSegmentButtons`
  - rendered beside the title
- `segmentButtonItems`
  - rendered as a separate segmented button group

## Selection and Status Controls

### Built-in segmented state

- `showActiveButton` enables the legacy ACTIVE / INACTIVE / ALL segmented control.
- `handleSegmentedButtonClick(selectedSeg)` updates:
  - `buttonEnabled`
  - `filterOperator`
  - `fieldName`
  - `searchText`
  - `skip`
  - `tabChanged`
- It then refreshes data through either:
  - `searchFromServer(globalSearchFieldValue)` when there is an active search, or
  - `onColumnFiltering()` when there is not

### Custom segmented buttons

- `segmentButtonItems` renders a user-defined button set.
- `segmentButtonChange` emits the raw selection event.
- `checkSegement(status)` updates the visual state.

### Switch

- `showSwitch` or `ShowSwitch` renders a switch control.
- If `switchComponent` is provided, the component is rendered instead of the default switch.
- Otherwise the default switch emits `onSwitchChange(checked)`.

### Selection state

- `selectedRowsId` is passed into `AnalyticalTable` as the selected row map.
- `handleRowClick()` updates `isNoDataSelected` based on the selected flat rows.
- `disableColumnRule` can disable row selection for matching records.
- Tree-table selection uses `useIndeterminateRowSelection()` when enabled.

## Combo Boxes and Multi-Selects

### Multi-select blocks

- `isMultiSelectOneActive` through `isMultiSelectFourActive` each render a `MultiComboBox`.
- Their selection events emit:
  - `multiSelectOneSelectionChanged`
  - `multiSelectTwoSelectionChanged`
  - `multiSelectThreeSelectionChanged`
  - `multiSelectFourSelectionChanged`
- The first multi-select supports `isMultiSelectOneSelectAllFlag`.

### Combo boxes

- `isComboBoxOneActive` and `isComboBoxTwoActive` render `ComboBox` controls.
- Their selection events emit:
  - `comboBoxOneSelectionChanged`
  - `comboBoxTwoSelectionChanged`

### Value help

- `showValueHelp` renders a single value-help input that emits `valueHelperButtonClick`.
- `valueHelpers` renders additional value-help inputs with per-item callbacks.

## Date Inputs

- `showDatePicker` renders `DatePicker` and emits `changeDatePicker`.
- `showDateRangePicker` renders `DateRangePicker` and emits `changeRangeDatePicker`.
- Both are part of the toolbar and do not directly fetch data; the parent decides how to use them.

## Selection-Related UX

- `isNoDataSelected` disables some header buttons when nothing is selected.
- `showDeleteButtonInHeader` respects the same selection gate.
- `showTripButtons` uses the same selection gate.
- `showRowDataCount` displays the current filtered count in the title.
