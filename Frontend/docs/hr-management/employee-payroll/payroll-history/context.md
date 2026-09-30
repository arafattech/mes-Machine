# HR Management — Employee Payroll: Payroll History

## Files
```
employee-payroll/
└── payroll-history/
    ├── payroll-history.component.ts
    ├── payroll-history.component.html
    └── payroll-history.component.scss
```

## Route
`employee-payroll-history` (HR Management routing module) — `PayrollHistoryComponent`.

## Purpose
Split-pane, collapsible master/detail view: left grid lists `PayrollHistories` (one row per payroll
"batch" — a generate-payroll run over a date range), right grid lists the individual `Payrolls`
(per-employee payroll records) belonging to whichever history row is selected, filtered by
`payroll_history_id eq {id}`. Either pane can be collapsed independently via the small
`ui5-avatar` arrow toggles (`onCLickListCollapsed()` / `onCLickTabCollapsed()`).

### Selector
`app-payroll-history`

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `historyDataSource` | `AgGridTableODataSourceConfig` | `PayrollHistories`, `pageSize: 50`, `sortBy: 'id'`, `sortDirection: 'desc'`, `searchFields: ['payment_method']` |
| `payrollDataSource` | `AgGridTableODataSourceConfig` | `Payrolls`, `expand: 'employee'`, `searchFields: ['employee.employee_no', 'employee.first_name', 'employee.last_name', 'payment_method']` |
| `payrollFilterQuery` | `string` | `'payroll_history_id eq {id}'` — drives the right grid's `[filterQuery]`, set by `selectedRowData()` |
| `selectedHistory` | `any[]` | Actually holds the selected history's numeric `id` (not an array, despite the type — assigned directly from `row.id`) |
| `hasInitialHistorySelection` | `boolean` | Tracks whether the initial auto-select-first-row has happened |
| `isListCollapsed` / `isTabCollapsed` | `boolean` | Independently hide the left/right pane |

### Two real bugs fixed this session

**1. `(processData)` was declared but never bound in the template — dead code.** `processData(data)`
existed on the component (auto-selects the first history row when the grid's initial data loads,
mirroring the "auto-select first row" pattern used elsewhere in this codebase, e.g.
`employee-group-list`), but `#historyTable` in `payroll-history.component.html` never actually bound
`(processData)` to it — so the method was unreachable and the history grid loaded with **nothing**
selected in the right pane until the user manually clicked a row. Fixed by adding
`(processData)="processData($event)"` to the `#historyTable` `app-ag-grid-table` tag, restoring
auto-select-first-row-on-initial-load.

**2. `selectedRowData(data)` read the wrong event shape.** It expected an old wrapped shape
(`data.detail.row.original.id`), but `ag-grid-table`'s `rowClick` output actually emits the raw row
object directly — `@Output() rowClick = new EventEmitter<TData>()`. Because the shapes never
matched, clicking a history row silently did nothing (`row?.id` was always `undefined` under the
old signature, so the filter never updated). Fixed to `selectedRowData(row)` reading `row.id`
directly — this is what actually makes clicking a history row filter the right-hand payroll-detail
grid by `payroll_history_id eq {id}`.

### `historyDataSource.sortBy`/`sortDirection` needed a matching hidden column

`historyDataSource` sets `sortBy: 'id'`, `sortDirection: 'desc'`, but AG Grid's
`applyColumnState({ colId: sortBy, ... })` silently no-ops if no column definition in
`historyColumns()` has that `colId` — which is why `sortBy` alone wasn't actually producing an
`$orderby` param on the OData request before this fix. Fixed by adding a hidden `id` column to
`historyColumns()`:
```ts
{ field: 'id', hide: true, filter: false, sortable: false, floatingFilter: false }
```

### All history columns are now `sortable: false` / `filter: false`

Every column returned by `historyColumns()` (`is_active`, `start_date`, `end_date`,
`total_employees`, `total_salary`, `payment_method`) has both `filter: false` (no per-column filter
dropdown) and `sortable: false` (no per-column sort UI) — sort is fixed via the dataSource config
(`sortBy`/`sortDirection`) rather than user-driven per column, and the grid's own toolbar search box
is the only search affordance.

### Key Methods

| Method | Description |
|--------|-------------|
| `processData(data)` | Bound to `#historyTable`'s `(processData)`; auto-selects the first row on initial load via `selectedRowData(rows[0])`, or clears selection state if the list is empty |
| `selectedRowData(row)` | Bound to `#historyTable`'s `(rowClick)`; sets `selectedHistory = row.id`, rebuilds `payrollFilterQuery`, calls `refreshPayrollTable()` |
| `refreshPayrollTable()` | `setTimeout(() => payrollTable?.refreshGridData(true))` |
| `onCLickListCollapsed()` / `onCLickTabCollapsed()` | Toggle the collapse flags for each pane |
| `historyColumns()` / `payrollColumns()` | Column builders for the two grids |

### Important Caveats
- `selectedHistory: any[]` is typed as an array but is actually assigned a scalar `id` — don't rely
  on the declared type; read the assignment in `selectedRowData()`.
- The right-hand `payrollTable` has no `(rowClick)`/detail drill-down of its own — it's a pure
  read-only detail grid for whichever history batch is selected on the left.
