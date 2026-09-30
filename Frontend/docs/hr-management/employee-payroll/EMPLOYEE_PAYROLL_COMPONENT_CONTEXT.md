# HR Management — Employee Payroll (List + Summary Cards)

## Files
```
employee-payroll/
└── employee-payroll.component.ts    ← Angular component
└── employee-payroll.component.html  ← Template
└── employee-payroll.component.scss
```
See also: [employee-bonuses](employee-bonuses/EMPLOYEE_BONUSES_COMPONENT_CONTEXT.md) (sibling screen,
same module) for the working `select`-type toolbar-filter pattern this doc references below.

## Route
`/hr-management/payroll-management/employee-payroll` — `EmployeePayrollComponent`.

## Purpose
Date-ranged list of processed `Payrolls` rows (OData) plus 4 summary stat cards (current employees,
last-month employees, total salary, total outstanding, total requests) sourced from a separate REST
summary endpoint. Supports payslip PDF download, a payroll-details view dialog, and a
shift/employee-type bulk Excel export picker.

## Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `dataSource` | `AgGridTableODataSourceConfig` | `Payrolls`, `expand: 'employee($expand=employeeType)'` — the nested `employeeType` expand exists only so an Employee Type **display** column could read `employee.employeeType.name`; see the OData nav-filter limitation below for why that column is currently commented out |
| `payrollFilterQuery` | `string` | Base OData filter (`is_active eq true and (start_date/end_date range)`), rebuilt by `getOdataFilter()` on every date-range change |
| `payrollData` | `{ totalrequest, avarageSalary, totalOutstanding, totolEmployee, newEmployees }` | Populated from `hrm/payrollcalculate/{start}/{end}` (REST), independent of the grid's own OData query |
| `displayConfig.gridHeight` | `'100%'` | Grid fills its `flex-1` wrapper — **do not** hardcode a `calc(100vh - Npx)` value here; the summary cards above it can change height (e.g. padding/icon-size tweaks) and a fixed px offset silently leaves a dead gray gap under the grid instead of the grid auto-stretching. Let flexbox own the sizing. |

## Key Methods

| Method | Description |
|--------|--------------|
| `onDateRangeChange(value)` | Parses the range picker's `DD/MM/YYYY - DD/MM/YYYY` value → `applyDateRangeFilter()` |
| `applyDateRangeFilter()` | Rebuilds `payrollFilterQuery`, calls `refreshGridData(true)`, and re-fetches the summary cards (`getPayrollData()`) — the grid and the cards are two independent data sources kept in sync manually on every filter change |
| `resetFilter()` | Resets the date range to the last 31 days and re-applies |
| `downloadPayrollSlip(payroll)` | `POST pdf/generate` (REST, `responseType: 'blob'`), triggers a client-side download of the payslip PDF via the shared `saveBlobFile()` helper |
| `viewPayrollDetails(payroll)` | Opens `app-payroll-overview` (`@ViewChild`) with the row's data |
| `openExportPicker()` / `closeExportPicker()` | Toggle `isExportPickerOpen`, the `ui5-dialog` housing the Shift/Employee Type checkbox picker (opened via the toolbar's `grid`-icon `multipleButtons` entry, id `export-picker`, routed through `(multipleButtonEmitter)` → `onExportPickerButtonClick()` since `AgGridCustomButton.onClick` is not wired by the shared grid template) |
| `loadShiftOptions()` / `loadEmployeeTypeOptions()` | Fetch `EmployeeShifts` / `EmployeeTypes` (OData) to populate the dialog's checkbox lists |
| `toggleShiftSelection(id, event)` / `toggleEmployeeTypeSelection(id, event)` | Add/remove an id from `selectedShiftIds` / `selectedEmployeeTypeIds` off the checkbox's native `(change)` event |
| `downloadSelectedPayrolls(format)` | `format: 'excel' \| 'pdf'` — one button per format in the dialog footer (`pdf-attachment` / `excel-attachment` icons, replacing the old single "Download" button). For every selected shift **and** every selected employee type, sequentially (`concatMap`, one at a time — never a cross-product of the two groups) `POST exportPayroll` (xlsx) or `POST exportPayrollPdf` (pdf) with `start`/`end` + `shift_id=X` or `employee_type_id=Y` (REST, `blob`), saving each as its own `Payroll_<name>.xlsx`/`.pdf` via `saveBlobFile()`. Detects "no data for this shift/type" by **response content type**, not HTTP status — see below — so `next` skips (pushes `job.name` into `skippedNames`) whenever `blob.type` contains `'json'` (the `{no_data:true}` marker) or the request truly failed (`catchError` fallback, still present for genuine network/server errors). `concatMap` would otherwise propagate any per-job failure and abort every job still queued after it, so per-job isolation here is load-bearing, not defensive boilerplate. `ToastService.show('download', ...)` reports a summary at the end naming exactly which shift/type had no data (not just a count), so a partial-skip run doesn't look like nothing happened. |

## Stat cards
Sized deliberately small (`p-3`, `w-11 h-11` icon circles, `text-xl` icons) — this was tightened down
from an earlier, much taller card (`p-5`, `w-16 h-16`, `text-3xl`) that ate a large fixed vertical
slice of the page. If re-touching these cards, keep `displayConfig.gridHeight: '100%'` (see above) so
the grid below auto-adjusts instead of needing another manual offset tweak.

## Employee Type filter/column — currently disabled, kept commented for later
An "Employee Type" toolbar filter (and a matching display column) was attempted using the shared
`app-ag-grid-table` **declarative `toolbarFilters` API** (`type: 'select'`, wired via
`(toolbarAction)` → `onToolbarAction()` → rebuild `payrollFilterQuery`) — the exact same pattern that
already works on the sibling [employee-bonuses](employee-bonuses/EMPLOYEE_BONUSES_COMPONENT_CONTEXT.md)
screen for its Bonus Type filter, and on `employee-attendance-list` for its own Employee Type filter.

**It doesn't work here**, and the reason is backend/Lodata-specific, not a frontend mistake:
`Payrolls` is filtered/sorted through a **nested navigation property** (`employee/employee_type_id`,
or `employee/employeeType/name` for sorting the display column). Verified directly against the live
OData endpoint (`odata/Payrolls?$filter=employee/<prop> eq X`):

- `employee/id`, `employee/is_active` → work — but only because `Payroll` **itself** also happens to
  have columns named `id`/`is_active`
- `employee/employee_type_id`, `employee/department_id`, `employee/employee_no`, `employee/gender`,
  `employee/first_name` → all fail with `expression_parser_error` ("Encountered an invalid symbol"),
  even though `$metadata` correctly lists `employee` as a `NavigationProperty` with a
  `NavigationPropertyBinding` on the `Payrolls` entity set
- `$orderby=employee/employeeType/name` (sorting) fails the same way (`invalid_sort_property`)

This is why `AttendanceLogs`/`EmployeeBonuses` can filter by employee type directly
(`employee_type_id eq X` / `bonus_type_id eq X`) — those entities have the type FK **denormalized on
themselves**, so no nav traversal is needed. `Payroll` doesn't have that column today.

**To make this work**, the FK needs denormalizing onto `payrolls` (migration + backfill + populate at
payroll-generation time), mirroring `EmployeeBonuses.bonus_type_id` — not a frontend-only fix. Until
that migration happens, the following are intentionally commented out (not deleted) in
`employee-payroll.component.ts`, ready to re-enable once the column exists:

- `selectedEmployeeTypeId` / `employeeTypeToolbarFilters` fields
- `getEmployeeTypes()` / `onToolbarAction()` methods
- the `employee/employee_type_id eq X` clause inside `getOdataFilter()`
- the `employee.employeeType.name` display column in `buildColumns()`
- the `[toolbarFilters]`/`(toolbarAction)` bindings on `<app-ag-grid-table>` in the template

The `expand: 'employee($expand=employeeType)'` on `dataSource` was left in place (harmless, and needed
again the moment the display column is re-enabled).

**The same nav-filter limitation was also silently broken `dataSource.searchFields`** (the global
search box), undetected until now because the failure mode there is "search silently returns nothing"
rather than an obvious crash. Two separate bugs, both now fixed:

- `'first_name'` (no prefix) doesn't exist on `Payrolls` at all — it's an `Employee` field. Since all
  `searchFields` get OR'd into one `$filter` string, this single invalid clause failed the *entire*
  filter expression (`expression_parser_error`), breaking search for every field, not just this one.
  Fixed to `'employee.first_name'`.
- `'employee.employeeType.name'` — a **2-level** nested path (`employee` → `employeeType` → `name`).
  Confirmed directly against the live OData endpoint that this lodata version's lambda parser can't
  resolve more than one hop of navigation-property access at all, in *any* form tried: direct path
  (`employee/employeeType/name`), single `any()` wrapping the 2-hop path inside the lambda
  (`employee/any(a:contains(tolower(a/employeeType/name),...))`), or `any()`-inside-`any()`
  (`employee/any(a:a/employeeType/any(b:contains(tolower(b/name),...)))`) — all three fail with
  `expression_parser_error` at the second slash. Removed from `searchFields` entirely; there is no
  frontend-only workaround (same root cause as the `$orderby`/display-column limitation above — would
  need the FK denormalized onto `payrolls`, as described above, or a dedicated backend search
  endpoint).

**A third, unrelated searchFields gap**: the grid displays columns for Employee ID
(`employee.employee_no`), Payable Days (`total_payable_days`) and Total Salary (`gross_salary`), but
none of the three were ever added to `dataSource.searchFields` — global search silently ignored them
(the whitelist just never covered them; not a lodata limitation like the two bugs above). Fixed by
adding all three:
- `'employee.employee_no'` — single-hop nav, same proven pattern as `employee.first_name`/`employee.last_name`.
- `'total_payable_days'` / `'gross_salary'` — plain scalar `Payroll` columns (`type: 'numericColumn'`
  in `buildColumns()`). The query builder always wraps search fields as
  `contains(tolower(field), 'text')`; the SQL driver compiles `tolower`/`contains` straight to
  `LOWER(field) LIKE '%text%'`, and MySQL implicitly casts a numeric column to string for `LIKE`, so
  numeric fields are safe to add to `searchFields` — no `cast()` needed.

## Shift / Employee Type bulk export picker
Replaces the old single-click "export whole date range" button (previously the grid's built-in
`showDownload` icon, wired through the shared `<excel-upload-download>` component and its
`IsExportXls`/`IsInsertXls` outputs — both removed, along with the now-dead `payrollcount` /
`processData()` import-count tracking, since nothing else in the app bound to those outputs).

- Toolbar now shows one custom `grid`-icon button (`exportPickerButtons`, via the shared grid's
  `multipleButtons` input) that opens a `ui5-dialog` with two 2-column checkbox grids — **Shift**
  (`EmployeeShifts` OData, dynamic; there is no fixed Day/Mid/Night enum in this codebase) and
  **Employee Type** (`EmployeeTypes` OData, dynamic).
- Download behavior is **flat, one file per selected checkbox** across both groups — selecting Night
  + Day shifts produces 2 files; selecting a shift and an employee type together still produces 2
  files (one filtered by shift, one filtered by type), never a shift×type cross-product file.
- This bypasses `excel-upload-download`'s `Export()` entirely (that component only supports one
  `exportApiUrl`/one click, no sequencing) — `downloadSelectedPayrolls()` calls
  `commonservices.post<Blob>()` directly per selection, same low-level pattern as
  `downloadPayrollSlip()`.
- **"No data for this shift/type" is 200, not 404** — deliberately, on both endpoints. In the bulk
  picker, one request per selected shift/type is routine and some legitimately match zero payrolls;
  a 404 there would surface as a failed/red request in devtools for something the frontend already
  treats as a normal, expected outcome — confusing during debugging even though the UI itself never
  showed an error for it. Both `exportPayroll` and `exportPayrollPdf` return
  `response()->json(['no_data' => true, 'message' => '...'], 200)` for this specific case; genuine
  errors (missing `start`/`end`, invalid `payroll_history_id`, `end < start`) are untouched and still
  4xx. The frontend distinguishes a real file from this marker by **response content type**
  (`blob.type.includes('json')`), not by catching an HTTP error — see `downloadSelectedPayrolls()`
  above. Verified via `php artisan tinker`: a no-match filter returns status 200 with
  `{"no_data":true,"message":"..."}`.
- Backend has **two** parallel export endpoints, both accepting the same optional `shift_id` /
  `employee_type_id` query params (validated against `employee_shifts`/`employee_types`) plus
  `start`/`end` (or `payroll_history_id`):
  - `POST exportPayroll` (`EmployeePayrollController::exportPayroll`) — unchanged Excel/`.xlsx` path
    via `Maatwebsite\Excel` + `App\Exports\PayrollExport`.
  - `POST exportPayrollPdf` (`EmployeePayrollController::exportPayrollPdf`) — new PDF path, follows the
    same convention as the existing `exportEmployeeLogPdf`/`exportEmployeeListPdf` methods:
    `Barryvdh\DomPDF\Facade\Pdf::loadView('pdf-templates.payroll', [...])->setPaper('A4', 'landscape')`,
    returned as `response($pdf->output(), 200)->header('Content-Type', 'application/pdf')` (inline,
    not `->download()`). View: `resources/views/pdf-templates/payroll.blade.php`, a flat HTML table
    mirroring `pdf-templates/employee-list.blade.php`'s structure/styling. Laravel Excel's own PDF
    writer (`Excel::MPDF`/`Excel::DOMPDF`) was deliberately **not** used — `mpdf/mpdf` isn't installed,
    and funneling `PayrollExport`'s custom `PhpSpreadsheet`/`HasCompanyReportLayout` styling through
    Excel's HTML-based PDF conversion is untested and likely to mangle formatting.
  - Both endpoints share one private helper, `applyPayrollShiftAndTypeFilter()`, for the
    shift/employee-type query filtering (extracted once a second real caller existed) — plain
    Eloquent joins, **not** an OData nav-property filter, so the `Payrolls` OData lodata limitation
    documented above (can't filter/sort through `employee/...` nav paths) does not apply here.
    - `employee_type_id` → `whereHas('employee', fn($q) => $q->where('employee_type_id', ...))`, since
      that FK **is** a fixed, denormalized column on `employees`.
    - `shift_id` → **not** `employees.shift_id` (that column is a rarely-populated static field —
      payroll generation never sets or reads it, only 1/621 employees in this env have it at all).
      Shift is recorded per attendance day instead, so the filter joins
      `employee.attendancelogs` (`AttendanceLog.shift_id`) constrained to the payroll's own date range:
      `whereHas('employee.attendancelogs', fn($q) => $q->where('shift_id', ...)->whereBetween('attendance_date', [start, end]))`.
      Same pattern already used by `computePayrollStatus()`'s night-shift count — reused here rather
      than reinvented.
  - `PayrollExport` (the xlsx path only) additionally needs a date range for the `payroll_history_id`
    branch, where there's no `start`/`end` query param — it comes from `PayrollHistory.start_date/end_date`
    and is threaded in via two extra constructor params, `$shiftRangeStart`/`$shiftRangeEnd`, kept
    **separate** from `$start`/`$end` (which drive the main query + `reportTitle()`) specifically so
    passing a date range for the shift join doesn't change that branch's export title (previously
    null/null → generic "(Month Year)" title, unchanged by this fix). `exportPayrollPdf` doesn't need
    this split since it builds its own `$query`/row data directly rather than going through a
    stateful export class.

### Report layout (both xlsx and pdf) — payroll-specific header/footer, columns
Both `PayrollExport` and `pdf-templates/payroll.blade.php` share the same 25-column "Salary Sheet"
layout and the same field-mapping decisions (all made explicitly with the user, since several
requested columns have no real data source anywhere in the system):

- **Title**: `Salary Sheet of Employees for {start} to {end}` (dd/mm/yyyy), no sheet-number suffix.
  When the export is shift- or employee-type-filtered, a subtitle line is appended —
  `Shift: {name}` or `Employee Type: {name}` — resolved from `EmployeeShift`/`EmployeeType` by id in
  the controller and passed into `PayrollExport`'s constructor (`$shiftName`/`$employeeTypeName`) /
  the Blade view (`subtitle`). No subtitle when downloading unfiltered (all payrolls).
- **Columns**: SL, Employee Name, Designation, Section, Joining Date, Card No., Basic Salary, House
  Rent, Medical Allowance, Conveyance Allowance, Total Salary, Off Days, Leave Days, Absent Days,
  Actual Attendance, In Total Attendance, Salary Ded. for Absent, Adv. Ded. for Various Reason, Night
  Bill, Attendance Bonus, Increment, Stamp, Net Salary, Signature, Remarks. Data sources (decided with
  the user, since `Payroll`/`Employee` don't carry all of these natively):
  - Designation → `Employee.designation` (the legacy string column — a separate `designation()` FK
    relation also exists but isn't the one used here).
  - Section → `Employee.employeeSection.name` (relation is named `employeeSection`, not `section`).
  - Card No. → `Employee.employee_no` (no literal "card number" column exists).
  - Basic Salary / Total Salary → `Payroll.basic_salary` / `Payroll.gross_salary` (period-accurate
    snapshot). House Rent / Medical / Conveyance → `Employee.salary` (`EmployeeSalary` master record —
    `house_rent`/`medical_allowance`/`transport_allowance`; no per-period breakdown exists on `Payroll`
    itself, so these reflect the employee's *current* salary record, not necessarily what was true
    during that historical payroll period).
  - Off Days / Leave Days / Absent Days → **not stored anywhere**, computed per payroll row via
    `PayrollExport::attendanceBreakdown(Payroll $payroll)` (`public static`, so the PDF path in
    `EmployeePayrollController::exportPayrollPdf` reuses the exact same calculation instead of
    duplicating it): Off Days from `Employee.employeeWeekend()` (approved, non-LEAVE) within the
    payroll's own `start_date`/`end_date`; Leave Days from `LeaveDate` with an approved `LeaveRequest`
    in that range; Absent Days = calendar days in the period − `total_attendance` − leave − off,
    floored at 0. Mirrors the same relations `computePayrollStatus()` already uses for the live payroll
    preview, so the numbers stay consistent with what HR sees before generating payroll.
  - Actual Attendance → `Payroll.total_attendance`; In Total Attendance → `Payroll.total_payable_days`
    (two distinct existing columns, not a derived pair).
  - Salary Ded. for Absent → `Payroll.other_deductions` (this is exactly the short-attendance deduction
    `computePayrollStatus()` already computes and stores at generation time — reused, not recomputed).
  - Night Bill → `Payroll.nightshift_bonus`. Remarks → `Payroll.hr_notes`.
  - **Adv. Ded. for Various Reason, Increment, Stamp, Signature → always blank.** No advance-loan
    table and no per-period increment amount exist anywhere in the system (checked before deciding
    this); Stamp/Signature are physical-signing columns by nature. These are intentionally manual-fill
    cells on the printed/exported sheet, not a placeholder for missing implementation.
- **Left header block** ("Total Days of The Month : N" / "Working Day of The Month : N" / "W/H Days of
  The Month : N", payroll-only): matched against a reference layout the user provided, then refined —
  the initial "BTL Factory" label was removed outright (not wanted), and the block's first line now
  starts at the **same row** as "Bandhab Tex Limited" rather than stacked above it (pdf: both are cells
  in the same `<tr>` with `vertical-align: top`, logo moved to its own centered line above that row;
  xlsx: this fell out naturally once "BTL Factory" — the line that used to occupy row 1 by itself — was
  dropped, since row 1 already carries "BANDHAB TEX LTD" in its center columns). Both pdf and xlsx hit
  the **same underlying bug**, independently: the company-name/address block was centered within
  "everything right of the left stats block" (pdf: a 75%-wide cell; xlsx: merged across *every*
  remaining column, `E1:{lastCol}1` with no right counterpart) — technically centered within that
  sub-range, but visibly right-of-true-center once compared against the title row directly below it,
  which spans the *full* width. Fixed the same way in both: mirror the left block's width as an empty
  spacer on the right (pdf: 25/50/25 columns instead of 25/75; xlsx: `$rightStartColIndex = lastColIndex
  - leftEndColIndex + 1`, giving `E1:U1` + an empty `V1:Y1` spacer for Payroll's 25-column sheet) so the
  center block's own midpoint lands on the sheet/page's true midpoint. Confirmed for pdf via `pdftoppm`
  render; confirmed for xlsx structurally (merge ranges + midpoint arithmetic checked directly against
  the generated file — `soffice --headless --convert-to pdf` was tried as a second check but is a
  print-pagination path that clips wide sheets into narrow print pages unrelated to how Calc's
  interactive view renders a merged cell, so it wasn't a reliable cross-check here and was not relied
  on for confirmation).
  - **A second, separate xlsx-only bug surfaced after that fix**: the header text still rendered
    left-anchored (overflowing only rightward — the tell-tale sign of left-, not center-, alignment)
    in LibreOffice Calc's own editing view, despite the underlying file being verified byte-correct
    (every cell in the merge shares one style index with `alignment.horizontal = center`, checked
    directly against the saved xlsx — not a data bug). This is a known class of LibreOffice Calc
    rendering quirk: merged cells on columns with no explicit width can render centered text as if it
    were left-aligned. Fixed by adding `WithColumnWidths::columnWidths()` (25 explicit widths, one per
    column, sized to each header's own text) — which also happens to fix the separate, definitely-real
    truncated-header legibility problem visible in the same screenshot ("Employee Name" showing as
    "ployee Na", etc.), since no column ever had a defined width before. **Not independently
    pixel-verified against LibreOffice Calc's live GUI** — this environment can only run headless
    `soffice --convert-to pdf`, which reflows through print pagination and isn't equivalent to the
    interactive view (confirmed by testing it: it clips a 25-column sheet into multiple narrow print
    pages, an unrelated rendering path). If it's still off after this, the next thing to try is
    explicit per-cell alignment writes on every individual cell in the merge range (not just relying on
    a single `applyFromArray` on the range string), in case LibreOffice specifically needs that
    redundancy — but that wasn't done pre-emptively since the width fix is the standard, documented
    fix for this exact quirk.
  - **Third round, real root cause**: the column widths fixed LibreOffice's actual alignment
    rendering (confirmed against the user's own Calc GUI screenshot — text now genuinely centers
    within its merge, no more left-anchored overflow), but the header still looked "shifted right"
    compared to the reference pdf. Cause: centering within the sheet's own column range (A:D stats /
    E:U company block / V:Y spacer) only *looks* centered once that whole range is visible at once —
    a 25-column sheet needs horizontal scrolling in Calc's normal editing view, so a header centered
    across all columns looks off relative to whatever partial window is on screen without scrolling.
    The pdf has no such problem (fixed single page width, nothing to scroll). Fixed by adding print
    setup scoped to `$leftHeaderLines` (Payroll only): `PageSetup::setFitToWidth(1)->setFitToHeight(0)`
    + A4 landscape — scales the entire 25-column sheet onto one printed/exported page, so the already-
    correct column-based centering now equals true page-centering when printed or exported to PDF
    (`soffice --headless --convert-to pdf`, same tool, gave a properly single-page, centered result
    once this was added — previously it split across multiple narrow pages, which is what made the
    company name appear to sit far right on "page 1"). This does not affect the other 4
    `HasCompanyReportLayout` exports — the print-setup block only runs when `$leftHeaderLines` is
    given, which only Payroll passes.
  - **Fourth round**: page-centering fixed the printed-page-vs-column-range mismatch, but the title
    line ("Salary Sheet of Employees...") still visibly started at a different left edge than the
    "HeadOffice:..." line directly above it. Cause: the title merge spanned the *full* `A..lastCol`
    width while the company name/address merges spanned only the narrower symmetric `E..U` block —
    both genuinely centered, but within different-width ranges, so two different-length strings landed
    at different starting columns even on the same page. Fixed by making the title reuse the exact same
    `$centerStartCol`/`$centerEndCol` range as the company block when `$leftHeaderLines` is given (all
    three merges are now `E{row}:U{row}` for Payroll's 25-column sheet — confirmed via
    `getMergeCells()`), instead of always spanning the full width. Caught and fixed a related bug while
    doing this: the title's style application had stayed hardcoded to `getStyle("A{$titleRow}")`
    (column A only) even after the merge start column became variable — for Payroll that meant styling
    the wrong cell entirely (column A, part of the *left stats block*'s own merge) instead of the
    title's actual anchor. Now uses `getStyle("{$titleStartCol}{$titleRow}:{$titleEndCol}{$titleRow}")`.
    The other 4 exports are unaffected either way — `$titleStartCol`/`$titleEndCol` default to
    `'A'`/`$lastCol` exactly as before when `$leftHeaderLines` is omitted, and applying a style to a
    full merge range vs. just its anchor cell renders identically in Excel/LibreOffice. "Salary Sheet NN (PB)"
  sheet-number and "Page X of Y" were deliberately **not** reinstated (dropped earlier on request;
  style/spacing matched without the literal text). Title + shift/employee-type subtitle render as
  **one line** (`Title | Shift: X`), not two — matches how xlsx already combined them and reads
  tighter.
  - **Working Day / W/H Days — approximated, not exact.** No company-wide weekly weekend config exists
    anywhere in the system (only per-employee `EmployeeWeekend` rows, which can differ per person), so
    `PayrollExport::weekendHolidayBreakdown($start, $end)` (public static — shared by both xlsx and
    pdf, same call site pattern as `attendanceBreakdown()`) **assumes Friday as the weekly off-day**
    (standard for a Bangladesh factory) and adds real company-wide `Holiday` table days (deduped
    against Fridays) on top. `Total Days`, by contrast, is exact — a plain calendar-day count needing
    no assumption. If the assumption is wrong for this factory, only `weekendHolidayBreakdown()` needs
    changing — both formats read from it.
  - **xlsx**: `HasCompanyReportLayout::applyCompanyReportLayout()` gained a 6th optional param,
    `?array $leftHeaderLines` — when given, rows split into a left block (columns A-D, left-aligned,
    one row per line) plus the usual centered company name/address, instead of one full-width centered
    cell. The row-count math generalized from a hardcoded "3 rows, title on row 3" to
    `insertedRowCount = max(3, count($leftHeaderLines) + 1)` / `titleRow = insertedRowCount` — with
    Payroll's 4 lines that reserves 5 rows (left lines on 1-4, title on 5, column headings on 6,
    confirmed via `php artisan tinker`). The other 4 exports omit the param entirely, so
    `insertedRowCount`/`titleRow` both evaluate to the exact literal `3` they always did — their output
    is provably byte-for-byte unchanged, not just "probably fine". `totalDaysInPeriod()` computes the
    day count off `startOfDay()` on both ends before diffing — diffing the raw `$start`/`$end` (which
    carry `startOfDay()`/`endOfDay()` *time* components for the non-history branch) produces a
    fractional day count, tripping a PHP 8.1+ implicit-float-to-int deprecation notice; stripping
    time-of-day first avoids that.
  - **pdf**: `pdf-templates/payroll.blade.php`'s header-table is 3 columns (left stat block / centered
    logo / empty spacer) instead of 2 (logo / right-aligned company info) — company name+address are
    their own centered block below the logo, matching the reference layout. `.pdf-header`/`@page`
    top-margin sized to 32.5mm with a small `padding-top: 4mm` (so the block isn't flush against the
    physical page edge) — tuned via repeated `pdftoppm` render checks against real data: 40mm → visible
    dead-space gap before the table; 29mm/30.5mm → table header row overlapping the title text; 31.5mm
    → no overlap but a near-zero gap on some subtitle text (e.g. "Employee Type: Staff" — subtitle
    length affects title-line height slightly); 32.5mm is the current value, verified with that exact
    "Employee Type: Staff" case. **This offset is inherently fragile** — dompdf's `position:fixed`
    header doesn't push flow content by its actual rendered height, only by the fixed `@page` margin,
    so it doesn't self-adjust to content and can drift back to zero-gap/overlap for a subtitle or
    address-line length not yet tested. Any future content change to `.pdf-header` needs re-verifying
    this value the same way (render real data through `exportPayrollPdf`, `pdftoppm` to PNG, inspect).
    Controller passes `totalDays`/`workingDays`/`whDays`
    (same `weekendHolidayBreakdown()` used by xlsx; `$rangeStart`/`$rangeEnd` are already plain `Y-m-d`
    strings here, so no time-of-day complication like the xlsx path has).
- **Footer** (payroll-only, does not affect any other report): a single "Prepared By / AGM / DGM / GM /
  Director / Managing Director" signature-line row — and **only** that row. The generic "Admin / GM /
  Director" row every other `HasCompanyReportLayout`-based export gets is deliberately suppressed for
  Payroll (having both was redundant/wrong for this report; it's still shown as before for every other
  export).
  - **xlsx**: `HasCompanyReportLayout::applyCompanyReportLayout()` gained two optional params —
    `?array $extraSignatureLabels = null` and `bool $skipDefaultSignatureFooter = false` — both default
    to the exact prior behavior, so `RostersExport`, `AttendanceExport`, `SideBillsExport`,
    `PromotionHistoryExport` (still calling with their original 4 args) are completely unaffected.
    `PayrollExport::registerEvents()` is the only caller passing both:
    `['Prepared By', 'AGM', 'DGM', 'GM', 'Director', 'Managing Director']` and `true` (skip default).
    The labels render via a new private helper, `applyExtraSignatureRow()` (plain `chr()`/`ord()`
    column-letter math, not `PhpSpreadsheet\Cell\Coordinate`, to avoid a new dependency).
  - **pdf**: `pdf-templates/payroll.blade.php` only ever had one signature table now (the second
    Admin/GM/Director table was removed outright) — it's fully self-contained (confirmed no shared
    partial exists across `resources/views/pdf-templates/*`), so this couldn't affect any other export
    either way.
- **Repeating page header (pdf only)**: the letterhead/title/subtitle block is wrapped in
  `<div class="pdf-header">` with `position: fixed; top: -34mm;` and `@page { margin: 34mm 8mm 8mm 8mm; }`
  — dompdf's standard technique for repeating fixed-position content on every page, anchored into the
  reserved top margin. The data table's column-header row was also moved into a real `<thead>` (was a
  plain first `<tr>` before), which dompdf repeats on every page natively. Both were previously
  single-occurrence-only (visible on page 1, missing on page 2+ — confirmed via `pdftoppm` render
  before/after). xlsx has no equivalent change — repeating print rows is a separate, unrequested,
  print-setup concern, not a pagination bug like the PDF had.

## Notes
- `dataSource`/`toolbarConfig`/columns otherwise follow the standard `app-ag-grid-table` server-side
  OData pattern — see [holiday-type-management](../holiday-type-management/HOLIDAY_TYPE_MANAGEMENT_COMPONENT_CONTEXT.md)
  for the general dialog/CRUD conventions this codebase follows.
- Backend runs on **Laravel Octane (RoadRunner)** — a backend edit (e.g. to a Payroll-related service)
  doesn't take effect until workers reload (`php artisan octane:reload`); plain opcache
  timestamp-revalidation does not apply the same way it would under classic PHP-FPM.
