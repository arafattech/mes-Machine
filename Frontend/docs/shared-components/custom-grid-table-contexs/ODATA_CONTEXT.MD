# OData Mode Context

This document covers the legacy grid path that loads rows through `CustomService.paginateCustomTableData()` using OData-style query fragments.

## When This Path Runs

- `customData === false`
- `isCustomApiCall === false`
- `customUrl` or `url` is available
- `onPagination()` is the active load path

## Main Inputs

- `url: string` — primary service endpoint.
- `customUrl: string` — alternate endpoint; takes precedence over `url`.
- `expandQuery?: string` — appended as OData `$expand`.
- `filterQuery: string` — base filter fragment.
- `additionalFilterQuery: string` — query built from search, filters, and segmented state.
- `limit: number` — page size.
- `useOdataStyles: boolean` — controls how the response is parsed.
- `showRowDataCount: boolean` — enables count display.
- `isv8: boolean` — version flag passed into the service.

## Main Methods

### `onPagination(isReset = false, isBusy = true)`

- Sets loading state and triggers `render()`.
- Combines `filterQuery` and `additionalFilterQuery` into `fullFilterQuery`.
- Calls `apiService.paginateCustomTableData(...)` with:
  - `top`
  - `skip`
  - `sortBy`
  - `sortType`
  - `fieldName`
  - `searchText`
  - endpoint
  - `expandQuery`
  - `filterOperator`
  - OData/custom URL flag
  - `useOdataStyles`
  - `fullFilterQuery`
  - row-count flag
  - `isv8`
- Appends rows when not resetting.
- Replaces rows when `isReset === true`.
- Updates `filteredDataCount` from:
  - `result['@count']` for OData responses
  - `result.total` for custom paginator payloads
  - `this.data.length` for non-OData custom payloads

### `onColumnFiltering(addQuery = '')`

- Builds filter expressions from `cachedColumn`.
- Supports field-specific filters across the legacy column data types:
  - string
  - number
  - boolean
  - date
  - timestamp
  - nested string
  - nested int
  - time
  - multiple date
  - multiple string
  - UI5 date range picker
  - custom
- Emits `onColumnFilter` with the computed field conditions.
- Stores the generated filter string in `additionalFilterQuery`.
- Resets pagination before reloading.

### `onSorting(event)`

- Resets pagination offsets.
- Updates `sortType` from the table event.
- Converts dotted column ids to the expected `sortBy` value.
- Either:
  - emits `customSorting` when `isNewCustomSorting === true`, or
  - triggers `onColumnFiltering()` to rebuild the service query.

### `searchFromServer(value)`

- Emits `searchClick` with the raw search string.
- Chooses one of three branches:
  - `isServerSearchingEnable` → delegates to `doServerSearching()`
  - `isCustomApiCalledManually` → stops, leaving search to the parent
  - `enableServerSideFiltering` → builds an OData-style search filter
- Supports direct search on `is_active` segmented state.
- Ignores columns marked with `SkipSearchFilter` / `skipSearchFilter`.

### `doServerSearching(value)`

- Builds an `$search=` query fragment.
- Keeps the active status segment when the segmented control is in use.
- Converts user-entered dates to UTC strings when possible.
- Reloads the table through `onPagination(true)`.

## Search and Filter Semantics

- Global search uses `globalSearchFieldValue`.
- Column filters use `cachedColumn[*].filterValue`.
- The component distinguishes:
  - simple string contains searches
  - equality filters
  - range filters
  - date normalization
  - nested field expansion with `/any(...)`
- The legacy query builder appends conditions with `and` or `or` depending on the mode.

## Count and Paging

- `top` always resets to `limit` when filters change.
- `skip` resets to `0` when the query changes.
- `skip` increments by `limit` after each `onPagination()` call.
- `filteredDataCount` is the display count used by the toolbar when `showRowDataCount` is enabled.

## Important Branches

- If `customData === true`, `onPagination()` does not fetch from the service.
- If `enableServerSideFiltering === false`, the global search box updates `globalFilterValue` instead of building server filters.
- If `ignoreQueryBuilder === true`, filtering still emits field metadata but skips query composition.
