# HR Management — Employee Payroll: Payroll Process

## Files
```
employee-payroll/
└── payroll-process/
    ├── payroll-process.component.ts
    ├── payroll-process.component.html
    ├── payroll-process.component.scss
    └── payroll-overview/    ← separate sibling widget, see its own context.md
```

## Route
`employee-payroll-process` (HR Management routing module) — `PayrollProcessComponent`.

Not to be confused with `EMPLOYEE_PAYROLL_COMPONENT_CONTEXT.md` in the parent
`employee-payroll/` docs folder, which documents a different sibling
(`employee-payroll.component.ts`).

---

## PayrollProcessComponent

### Selector
`app-payroll-process`

### Purpose
Master/detail screen for generating payroll over a selected date range: left an AG Grid of active
employees (filterable by department, multi-selectable), right a detail panel for whichever employee
row is currently clicked (leave balances, attendance, deductions, etc., loaded per-employee via
`initializePayrollInfo()`). Selecting one or more employees and clicking **Generate** opens a confirm
dialog showing a batch preview before the actual `generatePayroll()` call fires.

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `dataSource` | `AgGridTableODataSourceConfig` | `Employees`, `filter: 'is_active eq true'`, `expand: 'designation,supervisor,salary'` |
| `selectedEmployeeForPayroll` | `number[]` | IDs of checked rows — the actual generate payload |
| `selectedEmployeeRowsForPayroll` | `any[]` | Full row objects for the checked employees (source data for the preview grid) |
| `start` / `end` | `string` (ISO) | Selected payroll date range; `payrollRange` is the `DD-MM-YYYY - DD-MM-YYYY` display string |
| `GeneratedEmployeePayroll` | `any[]` | `Payrolls` rows already generated in the current range — drives the `Payroll Status` column badge and `isPayrollGenerated` |
| `isPyarollConfirmedDiaglog` | `boolean` | Confirm-dialog visibility (note the transposed spelling, matches the actual property name in source) |
| `payrollPreviewList` | `any[]` | Rows shown in the confirm dialog's preview grid — one entry per selected employee |
| `payrollPreviewDataSource` | `AgGridTableODataSourceConfig` | `staticData: true`, `data: []` — client-side only, NOT a real OData endpoint (`endpoint: ""`) |
| `isPayrollPreviewLoading` | `boolean` | Busy state while `loadPayrollPreview()`'s bulk request is in flight |

### Generate flow — `openPayrollConfirmDialog()` → one bulk request, not N parallel calls

Clicking **Generate** calls `openPayrollConfirmDialog()`, which opens the confirm dialog
(`isPyarollConfirmedDiaglog = true`) **and** immediately calls `loadPayrollPreview()`.

**Performance fix this session**: `loadPayrollPreview()` now fires a single
`POST employePayrollStatusBulk` with `{ employee_ids, start_date, end_date }` (both dates
`DD-MM-YYYY`) instead of the original design of one `GET employePayrollStatus/{id}/{start}/{end}`
call per selected employee — previously, selecting e.g. 50 employees fired 50 parallel HTTP
requests just to populate the confirmation preview. The bulk endpoint returns a
`{ employee_id: resultObject }` map; `loadPayrollPreview()` maps `selectedEmployeeRowsForPayroll`
against that map to build `payrollPreviewList` (employee id/no/name/designation, attendance,
holidays, night-shift attendance, gross salary, deductions, net salary).

`generatePayroll()` itself (`POST generatePayroll/{start}/{end}`, payload
`{ hr_notes, employee_ids: selectedEmployeeForPayroll }`) is **unchanged** — the bulk-preview fix
only touches the confirmation step, not the actual generate call.

### Confirm dialog

- Header text: `Localization.PayrollPrompt` = `"Are you sure you want to generate payroll?"`
  (trimmed down from a longer sentence).
- Three summary cards (`Total Employees` / `Total Gross Salary` / `Total Net Salary`) above the
  preview grid — plain themed `div`s using the same `var(--sapTile_Background)` /
  `var(--sapTile_BorderColor)` / `var(--sapContent_LabelColor)` / `var(--sapTextColor)` inline-style
  tokens used across store-management (see
  [local-material-receipt](../../../store-management/local-material-receipt/context.md)), **not**
  `ui5-card` — explicit design instruction to keep these as lightweight themed tiles instead of full
  UI5 cards.
- `app-ag-grid-table` preview grid (`payrollPreviewDataSource`) — client-side/static
  (`staticData: true` + `data: []`), not real OData. Every column has `filter: false,
  floatingFilter: false` (only the grid's own search box works — no per-column filter dropdowns),
  and each row has a delete action (`showDeleteButton`, `(deleteClick)="removePreviewEmployee($event)"`).
- `removePreviewEmployee(row)` removes that employee from `payrollPreviewList` **and** from
  `selectedEmployeeForPayroll`/`selectedEmployeeRowsForPayroll` (so a removed employee is excluded
  from the actual `generatePayroll()` call), and unchecks their row in the main employee grid via
  `employeepayrolltable?.getGridApi()?.forEachNode(...)`.
- Confirm ("Submit") button `[disabled]` when `isPayrollLoading || isPayrollPreviewLoading ||
  !selectedEmployeeForPayroll.length` — so the preview list emptying out (every employee removed)
  disables generation.
- Footer uses the `ui5-toolbar`/`ui5-toolbar-button` convention (Emphasized Submit + Transparent
  Cancel), matching `designation-management.component.html`'s dialog pattern — not a plain
  `div[slot=footer]`. `(before-close)` wired to `closePayrollConfirmDialog()`, which clears
  `payrollPreviewList` and resets `payrollPreviewDataSource.data`.

### Key Methods

| Method | Description |
|--------|-------------|
| `openPayrollConfirmDialog()` | Opens confirm dialog, triggers `loadPayrollPreview()` |
| `loadPayrollPreview()` | `POST employePayrollStatusBulk` — builds `payrollPreviewList` from the response map |
| `removePreviewEmployee(row)` | Removes one employee from the preview + selection + main grid's checked state |
| `closePayrollConfirmDialog()` | Closes dialog, clears preview state |
| `generatePayroll()` | `POST generatePayroll/{start}/{end}` — unchanged by this session |
| `onRowSelect(row)` | Main-grid row click → `initializePayrollInfo()` for the detail panel |
| `onSelectionChanged(rows)` | Main-grid checkbox selection → `selectedEmployeeForPayroll`/`selectedEmployeeRowsForPayroll` |
| `initGeneratedPayroll(start, end)` | Fetches already-generated `Payrolls` in range for the status badge |
| `selectDepartment(event)` | Multi-select department filter → rebuilds `filterQuery` |
| `onResetPayroll()` | Clears filters/selection, resets date range, reloads |

### Important Caveats
- `payrollPreviewDataSource` uses `endpoint: ""` + `staticData: true` — don't confuse it with a real
  OData source; `data` is manually reassigned (`{ ...payrollPreviewDataSource, data: payrollPreviewList }`)
  and the grid is force-refreshed via `setTimeout(() => payrollPreviewTable?.refreshGridData(true))`
  every time the list changes (load, remove-row).
- `employePayrollStatusBulk` is a distinct endpoint from the existing per-employee
  `employePayrollStatus/{id}/{start}/{end}` (still used by `initializePayrollInfo()` for the
  right-hand detail panel on single-row click) — the bulk endpoint exists solely to avoid N parallel
  requests when populating the multi-employee preview.
- `isPyarollConfirmedDiaglog` (property name, with the transposed "ia"/"ai") is the actual spelling
  in source — don't "fix" it to `isPayrollConfirmDialog` without also renaming every template
  binding; it's just an existing typo, not a bug.

## Backend companion — `Backend/app/Http/Controllers/EmployeePayrollController.php`
- The large per-employee computation block that used to live inline in `employePayrollStatus()` was
  extracted into `private function computePayrollStatus(Employee $employee, Carbon $startDate,
  Carbon $endDate): array` (returns a plain array, not a `JsonResponse`), so it can be reused.
- New `public function employePayrollStatusBulk(Request $request)` — validates `employee_ids[]`,
  `start_date`, `end_date`; loops employees once, calling `computePayrollStatus()` per employee;
  returns `response()->json($results)` keyed by employee id.
- New route: `POST employePayrollStatusBulk` (`Backend/routes/api.php`, immediately after the
  existing `employePayrollStatus/{id}/{start_date}/{end_date}` GET route).
- Separately (not directly used by this component, but touches the same controller):
  `PayrollHistory::create(...)` was moved out of `exportPayroll()` (now just an existence-check +
  `Excel::download`) and into `generatePayroll()` — a history row is now created from the payrolls
  actually processed during that specific generate call (tracked via a `$createdPayrollIds` array
  built during the chunked employee loop), rather than from whatever unhistoried payrolls happened
  to fall inside the exported date range.
