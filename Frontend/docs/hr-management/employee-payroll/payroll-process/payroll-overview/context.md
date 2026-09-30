# HR Management — Employee Payroll: Payroll Process → Payroll Overview

## Files
```
employee-payroll/
└── payroll-process/
    └── payroll-overview/
        ├── payroll-overview.component.ts
        ├── payroll-overview.component.html
        └── payroll-overview.component.scss
```

Sibling of [payroll-process](../context.md) — a separate widget, not part of `PayrollProcessComponent`
itself. See parent context.md's Files table for the disambiguation note.

---

## PayrollOverviewComponent

### Selector
`app-payroll-overview`

### Purpose
Read-only "Details" dialog showing a full breakdown of one employee's processed payroll (employee
id/name, basic salary, bonuses, allowances, attendance, deductions, net salary, HR notes). Opened by
a parent grid/list row action; the parent sets `payrollData` and calls `openDialog()`.

### Inputs
| Input | Type | Purpose |
|-------|------|---------|
| `payrollData` | `any` | The payroll record to display — all fields read via optional chaining (`?.`) in the template |

### Key Properties
| Property | Type | Purpose |
|----------|------|---------|
| `isViewOpen` | `boolean` | `ui5-dialog` open state |
| `netSalary` | `number` (getter) | `Math.max(0, Number(payrollData?.net_salary ?? 0))` — floors net salary at 0 for display |

### Key Methods
| Method | Description |
|--------|-------------|
| `openDialog()` | Sets `isViewOpen = true` — called by parent after setting `payrollData` |
| `CloseDialog()` | Sets `isViewOpen = false` — wired to the footer Cancel `ui5-toolbar-button` |

### Template structure
- `ui5-dialog` → `ui5-busy-indicator` → two `ui5-card`s:
  1. Detail grid (`grid-cols-2`) of labeled rows (Employee Id, Name, Basic Salary, Total Bonus,
     Allowance, Payment Status, Total Attendance, Process Date, Payable Days, Payroll Time, Total
     Night, Night Shift Bonus, Attendance Bonus, Ramadan Bonus, Holiday Bonus, Overtime Bonus, Total
     Deductions), plus a highlighted Net Salary summary row.
  2. "HR Notes" card with an `[innerHTML]="payrollData?.hr_notes"` activity-log box.
- Footer: `ui5-toolbar` with a single Transparent Cancel button (`CloseDialog()`).

### Dark-mode fix (this session)
Every detail row and the Net Salary/HR-notes boxes previously used light-only Tailwind classes
(`bg-gray-50`, `bg-green-50`, `text-green-500`, `text-red-500`, unthemed `border`) with no `dark:`
variant, so they stayed near-white against the dark UI5 theme and were unreadable. Fixed to the same
`dark:` pattern already used in
[yarn-advice-form](../../../../store-management/yarn-transfer-management/yarn-advice-form/context.md):
- Detail rows: `bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700`.
- Attendance Bonus / Total Deductions labels: `text-green-600 dark:text-green-400` /
  `text-red-600 dark:text-red-400` (was `-500` only, no dark variant).
- Net Salary box: `bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800`,
  bold label/value.
- HR Notes activity-log box: added `border-gray-200 dark:border-gray-700` +
  `text-gray-800 dark:text-gray-200` (was an unthemed plain `border` with no text color, so
  `hr_notes` HTML content inherited no readable color in dark mode).

No behavior, inputs, outputs, or methods changed — styling only.
