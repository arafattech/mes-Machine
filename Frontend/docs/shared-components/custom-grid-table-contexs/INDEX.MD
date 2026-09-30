# Custom Grid Table Feature Index

This folder breaks the legacy `custom-grid-table` context into feature-specific documents.

## Component Shape

- Component: `CustomGridTableComponent`
- Selector: `app-custom-grid-table`
- Implementation style: Angular shell + React `AnalyticalTable`
- Main data model: `AnalyticalTableColumnDefinition[]` plus row data arrays
- Core runtime state:
  - pagination offsets: `top`, `skip`
  - search state: `globalSearchFieldValue`, `searchText`, `fieldName`, `filterOperator`
  - settings state: `cachedColumn`, `isViewSettingsOpen`, `selectedItems`
  - selection state: `isNoDataSelected`, `selectedRowsId`
  - loading state: `isBusy`, `filteredDataCount`

## Feature Map

- `ODATA_CONTEXT.MD` — service-driven pagination, filtering, sorting, and row-count handling.
- `CUSTOM_API_CONTEXT.MD` — parent-owned search/load-more flows and custom paginator responses.
- `INLINE_EDIT_CONTEXT.MD` — inline editors, cell mutation, and `afterValueChange` hooks.
- `STATE_AND_SETTINGS_CONTEXT.MD` — localStorage cache, settings dialog, reset, reorder, and visibility.
- `TOOLBAR_AND_SELECTION_CONTEXT.MD` — toolbar controls, search box, date inputs, switches, combo boxes, and segmented buttons.
- `ROW_ACTIONS_AND_EVENTS_CONTEXT.MD` — edit/delete/info buttons and the emitted event surface.

## Key Files In Source

- `custom-grid-table.component.tsx` — full legacy implementation and render tree.
- `custom-grid-table.component.html` — dialog and auxiliary UI shell.
- `custom-grid-table.component.scss` — component styles.
- `CONTEXT.md` — source-side context notes.
- `AG-GRID-MIGRATION.md` — migration summary for the newer native Angular grid.

## Navigation Rule

- When you need API behavior, read the matching feature file first.
- When a behavior crosses features, read `STATE_AND_SETTINGS_CONTEXT.MD` last because it stitches together cache and rendering state.
