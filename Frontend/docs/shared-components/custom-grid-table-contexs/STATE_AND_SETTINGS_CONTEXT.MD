# State and Settings Context

This document covers column persistence, settings modal behavior, reset flow, and row/column order management.

## Persisted State

### Storage key

- `getColumnsFromLS(keyName)` and `setColumnsToLS(keyName)` both use:
  - `table_key = `${keyName}_${this.router.url}``
- The current route is part of the cache key, so the same table can keep different column layouts per page.

### Stored payload

- `fields` is serialized JSON for the column set.
- Each column snapshot stores:
  - `name`
  - `id`
  - `Header`
  - `accessor`
  - `accessorArray`
  - `autoResizable`
  - `dataType`
  - `disableFilters`
  - `disableGroupBy`
  - `disableSortBy`
  - `hAlign`
  - `isSelected`
  - `maxWidth`
  - `minWidth`
  - `width`

## Main Methods

### `bootstrap(changes?)`

- Runs on `ngOnChanges()`.
- Initializes the React root if needed.
- Loads cached columns when `isBase === true` or `keyForCacheCustomDataTableColumns` is set.
- Compares the cached column hash with the current column hash.
- Rebuilds and saves cache when the definition changed.
- Calls `mergeColumns()` and `handleCustomColumn()` before rendering.

### `mergeColumns()`

- Reconciles cached columns with the current `columns` input.
- Keeps cached width and selection state.
- Adds new columns that are present in the input but not yet in cache.
- Calls `renderColumnFilters()` when finished.

### `setColumnsToLS(keyName)`

- Serializes the current cached columns and stores them in `localStorage`.
- Skips persistence when `isTableCacheEnabled === false`.

### `getColumnsFromLS(keyName)`

- Loads persisted state from `localStorage`.
- Parses the stored `fields` value back into column definitions.
- Returns `null` when there is no cache or parsing fails.

### `applyReorderChanges(newOrder)`

- Reorders `cachedColumn` to match the latest UI order.
- Writes the updated order back into storage.
- Emitted through `columnReorder` after the table signals reorder.

## Settings Dialog

### `toggleSettingDialog(fromCancelClicked = false)`

- Opens or closes the settings dialog.
- Clears `selectedItems` on entry.
- Resets `selectAlLClicked` when the user cancels after selecting all.
- Closes the reset confirmation dialog as part of the flow.

### `selectionChange(event)`

- Updates `selectedItems` from the dialog selection event.
- Marks `settingChanged = true`.

### `selectAllBtn()`

- Marks all cached columns as selected.
- Sets `selectAlLClicked = true` so cancel behavior can restore state when needed.
- Refreshes `selectedItems` from the dialog state.

### `applyChanges()`

- Writes dialog selections back into `cachedColumn[*].isSelected`.
- Saves the new selection state to localStorage.
- Closes the settings dialog.
- Re-runs `onFilterAndSorting()` to apply the new visible column set.

### `resetConfirmationSubmit()`

- Restores `cachedColumn` from the original `columns` input.
- Saves the reset state.
- Rebuilds the merged columns and custom cell renderers.
- Triggers a fresh filter/sort pass.

### `reset()`

- Opens the reset confirmation dialog.

### `closeResetDialog()`

- Closes the reset confirmation dialog.

## Column Visibility and Order Rules

- Selected columns are those with `isSelected === true`.
- Non-base tables can bypass the cache when `keyForCacheCustomDataTableColumns` is empty.
- Width changes are captured during render via `handleColumnResize()`.
- The component does not use immutable state for column changes; it mutates `cachedColumn` and then persists it.

## Related State Fields

- `cachedColumn`
- `selectedItems`
- `isViewSettingsOpen`
- `settingChanged`
- `selectAlLClicked`
- `filteredColumns`
- `tabChanged`

## Integration Notes

- Use `headerTitle` consistently, because it is part of the cache key.
- If the route changes, the stored column layout changes as well.
- If the column schema changes materially, the hash mismatch path rebuilds the cache.
