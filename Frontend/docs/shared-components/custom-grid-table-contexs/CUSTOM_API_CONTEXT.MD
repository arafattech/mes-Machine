# Custom API Context

This document covers the path where the parent component owns search, load-more, and filter behavior instead of the grid building the OData query itself.

## When This Path Runs

- `isCustomApiCall === true`
- `isCustomApiCalledManually === true` in search flows that should stop after emitting events
- `customData === true` when the table uses passed-in row data
- `tookDataFromCustomPaginator === true` when the API response is paginator-shaped

## Main Inputs

- `customData: boolean` — disables the service fetch path in `onPagination()`.
- `isCustomApiCall: boolean` — routes toolbar search to the custom event surface.
- `isCustomApiCalledManually: boolean` — suppresses automatic search reloads.
- `tookDataFromCustomPaginator: boolean` — changes how `result.data` and `result.total` are read.
- `customResultFieldName?: string` — used by parent integrations that reshape the payload.

## Main Outputs

- `onSearchForCustomAPI: EventEmitter<any>` — emitted from toolbar search actions.
- `onLoadMoreForCustomAPI: EventEmitter<any>` — emitted when the table requests more rows.
- `searchClick: EventEmitter<any>` — emitted from search entry points even when the parent handles the data fetch.
- `processData: EventEmitter<any>` — emitted after `onPagination()` maps the response into `data`.

## Search Flow

### Toolbar search input

- Search icon click:
  - emits `onSearchForCustomAPI` when `isCustomApiCall === true`
  - otherwise calls `searchFromServer()`
- Enter key:
  - trims `globalSearchFieldValue`
  - emits `onSearchForCustomAPI` in custom API mode
  - otherwise triggers the server search path
- Input clear:
  - immediately emits the custom search event in custom API mode

### `handleOnSearchForCustomAPI(value)`

- Thin wrapper around `onSearchForCustomAPI.emit(value)`.
- Used by the render tree so the parent can own the final fetch logic.

### `handleOnLoadMoreForCustomAPI()`

- Emits `onLoadMoreForCustomAPI`.
- Used by the infinite-scroll hook in the table.

## Load-More Behavior

- In the rendered `AnalyticalTable`, `onLoadMore` chooses:
  - `onPagination()` for legacy OData/data loading
  - `handleOnLoadMoreForCustomAPI()` for parent-driven custom fetching
- This means the parent can own cursor, page token, or offset logic without the component guessing the next request.

## Data Mapping

### `onPagination()`

- If `customData === true`, the component skips the service call and just clears busy state.
- If a response arrives:
  - `tookDataFromCustomPaginator === true` → reads `result.data`
  - `useOdataStyles === false` → reads the raw response
  - otherwise → reads `result.value`
- It then maps rows into `data` and emits `processData([this.data, tableData])`.

## Practical Integration Pattern

- Parent listens to:
  - `onSearchForCustomAPI`
  - `onLoadMoreForCustomAPI`
  - `processData`
- Parent decides:
  - how to fetch data
  - how to append or replace rows
  - whether search is remote, local, or hybrid
- The grid remains a transport and rendering shell only.
