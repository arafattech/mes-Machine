# Inline Edit Context

This document covers the legacy per-cell editing behavior implemented in `handleCustomColumn()`.

## Scope

- Applies to columns where `GridTableColumnDataType` maps the cell renderer to an editable UI control.
- Most edit renderers mutate `row.original` directly and then call a column hook such as `afterValueChange`.
- Some editors also emit an Angular event so the parent can persist the change immediately.

## Input Hooks Used by Editable Columns

- `afterValueChange(rowData)` — callback on the column definition.
- `onInputValueChange` — emitted for typed input fields.
- `incrementorRealtimeValue` — emitted by numeric step input changes.
- `showAction` / `editPermission` — controls whether the table treats rows as editable in the surrounding UI.

## Editable Renderers

### `Boolean`

- Renders an icon-only boolean cell.
- Displays accept / decline depending on the row value.

### `Checkbox`

- Renders `UI5Checkbox`.
- Supports disabled state from:
  - `column.isDisabled` as a boolean
  - `column.isDisabled(rowData)` as a function
- Updates `rowData[column.accessor]` on change.
- Calls `afterValueChange(rowData)` when present.

### `InputField`

- Renders a text input.
- Stops key propagation so table navigation does not swallow typing.
- Writes the new value into the row object on each input event.
- Emits:
  - `onInputValueChange({ id, data, accessor, value })`
- Calls `afterValueChange(rowData)` when present.

### `NumberField`

- Renders a right-aligned numeric input.
- Accepts `minValue`, `decimalPlaces`, and `extraText`.
- Clamps to `minValue` when provided.
- Re-renders after each change.

### `IntegerField`

- Renders `StepInput`.
- Enforces `minValue`.
- Emits `incrementorRealtimeValue({ id, value })`.
- Calls `afterValueChange(rowData)` when present.

### `InputArea`

- Renders `TextArea`.
- Supports `numberOfRows`, `isRequired`, `isDisabled`, and `isReadOnly`.
- Writes directly into `rowData`.
- Calls `afterValueChange(rowData)` when present.

### `DropdownSingle`

- Renders `ComboBox` when options exist.
- Falls back to a search input when there are no dropdown values.
- Updates the row on selection.
- Supports:
  - `onInput(row, event)`
  - `onSelectChange(row)`
  - `afterValueChange(rowData)`

### `DropdownMulti`

- Same general pattern as `DropdownSingle`, but intended for multi-value selection behavior in the legacy data model.

## `handleCustomColumn()`

- Walks `cachedColumn` and attaches a `Cell` renderer to each editable data type.
- Keeps pre-existing custom `Cell` renderers intact.
- Applies additional renderers for:
  - `IconText`
  - `Color`
  - `NestedString`
  - `MultipleString`
  - `NestedInt`
  - `UI5elect`
  - `UI5DateRangePicker`

## Row Mutation Notes

- This is not a controlled form model.
- Most editors mutate the row object directly.
- The parent should treat row edit events as the source of truth if backend persistence is required.
- If the parent wants optimistic save behavior, it must listen to the emitted callbacks and commit changes itself.

## Related Output Events

- `onInputValueChange`
- `incrementorRealtimeValue`
- `processData`

## Caution

- Because the editors write into `row.original`, cloning rows before rendering is safer when a parent depends on immutability.
