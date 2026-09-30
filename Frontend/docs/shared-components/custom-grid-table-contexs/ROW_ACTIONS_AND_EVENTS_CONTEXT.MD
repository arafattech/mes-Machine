# Row Actions and Event Context

This document covers the row action column, top-level event emitters, and the event model that parents can subscribe to.

## Row Action Column

### `actionColumn`

- Pinned at the end of the table.
- Renders when `showAction === true` and `editPermission === true`.
- Uses one of two modes:
  - custom action buttons from `customActionButtons`
  - default edit/info/delete buttons

### Default actions

- `showEditButton` → edit icon button
- `showInfoButton` → info icon button
- `showDeleteButton` → delete icon button

### Custom action buttons

- Each `ICustomButton` can provide:
  - `id`
  - `text`
  - `icon`
  - `design`
  - `disable(row)`
  - `hide(row)`
  - `tooltip`
  - `onClick(row)`
- The action column width grows when custom buttons contain labels.

## Row Event Methods

- `handleEditClick(value)` → emits `editClick`.
- `handleDeleteClick(value, fullRowValue)` → emits both:
  - `deleteClick(value)`
  - `deleteClickNew(fullRowValue)`
- `handleInfoClick(value, fullRowValue)` → emits `infoClick(value)`.
- `handleRowClick(e)` → emits `rowClick` with the raw event and handles single/double click timing.
- `SingleClick(e)` → updates selection flags and emits `rowClick`.

## Toolbar Event Methods

- `handleNewButtonClick()` → `newButtonClick`
- `handleRefreshButtonClick()` → `refreshButtonClick`
- `handleExtraButtonClick()` → `extraButtonClick`
- `handleSyncButtonClick()` → `syncButtonClick`
- `handleDeleteButtonClick()` → `deleteButtonClick`
- `handleSettingsButtonClick()` → `settingsButtonClick`
- `handleDownloadButtonClick()` → `downloadButtonClick`
- `handleUploadButtonClick()` → `uploadButtonClick`
- `handleProductionPlanDefaultButton()` → `productionDefaultButton`
- `handleProductionPlantButton()` → `productionButton`
- `handleClearButtonClick()` → `clearButtonClick`
- `handleValueHelperButtonClick()` → `valueHelperButtonClick`
- `handleOnSearchForCustomAPI(value)` → `onSearchForCustomAPI`
- `handleOnSearchOnKeyUp(value)` → `onSearchOnKeyUp`
- `handleOnLoadMoreForCustomAPI()` → `onLoadMoreForCustomAPI`

## Other Output Events

- `changeDatePicker`
- `changeRangeDatePicker`
- `segmentedButtonClick`
- `segmentButtonChange`
- `columnReorder`
- `customSorting`
- `onColumnFilter`
- `processData`
- `incrementorRealtimeValue`
- `onInputValueChange`
- `onSwitchChange`

## Event Rules

- Most handlers call `render()` after emitting so the React tree stays in sync.
- The component does not wait for parent acknowledgements before updating local UI state.
- Double-click behavior:
  - first click schedules a single-click path
  - second click within the debounce window triggers `onDoubleClick` if provided
  - otherwise it falls back to edit when `editPermission && showAction`
