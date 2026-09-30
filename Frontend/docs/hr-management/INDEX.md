# HR Management — Documentation Index

This folder contains AI context files for every component group in the `hr-management` module.

## Feature Areas

| Folder | Description |
|--------|-------------|
| [employee-payroll/](employee-payroll/EMPLOYEE_PAYROLL_COMPONENT_CONTEXT.md) | Payroll list + summary cards; Employee Type filter/column disabled (commented) — blocked on a Lodata nav-filter limitation on `Payrolls`, see doc |
| [asset-management/assets-list/](asset-management/assets-list/ASSETS_LIST_COMPONENT_CONTEXT.md) | Master/detail asset↔employee view; reuses base-data's `AssetFormComponent` for create only |
| [employee-attendance/employee-attendance-list/](employee-attendance/employee-attendance-list/EMPLOYEE_ATTENDANCE_LIST_COMPONENT_CONTEXT.md) | Manual attendance CRUD; search-as-you-type employee picker |
| [employee-attendance/daily-attendance-list/](employee-attendance/daily-attendance-list/DAILY_ATTENDANCE_LIST_COMPONENT_CONTEXT.md) | Per-date attendance card grid; gated by roster existence (`has_roster`), backend on Laravel Octane — reload workers after service edits |
| [employee-attendance/employee-overtime/](employee-attendance/employee-overtime/EMPLOYEE_OVERTIME_COMPONENT_CONTEXT.md) | Approval queue for Overtime, configured Holiday Bonus, and Extra Shift; Double (OT)/Triple holiday payments are created only after approval |
| [holiday-type-management/](holiday-type-management/HOLIDAY_TYPE_MANAGEMENT_COMPONENT_CONTEXT.md) | Dynamic holiday type CRUD (name/color only); Ramadan/holiday-date bonus rules |
| [leave-management/](leave-management/LEAVE_MANAGEMENT_COMPONENT_CONTEXT.md) | HR-side leave request list with approve/reject dialog |
| [leave-management/calender-management/](leave-management/calender-management/context.md) | Holiday/off-day calendar admin (Individual/department/Industrial); debounced server-side employee search; per-date Double (OT)/Triple/Fixed bonus config |
| [employee-dashboard/leave-section/](employee-dashboard/leave-section/LEAVE_SECTION_COMPONENT_CONTEXT.md) | Employee-side leave application, calendar, delete pending; also houses `ViewApplyComponent` (supervisor approve/reject widget) |
| [black-list-management/](black-list-management/BLACK_LIST_COMPONENT_CONTEXT.md) | Blacklist/revoke employees; create flips employee inactive, revoke flips it back |
| [promotion-management/promotion-history/](promotion-management/promotion-history/context.md) | Read-only list of approved promotions, permanently filtered `/hrm/promotions` view; info icon opens a read-only details dialog |

## Quick Reference

### Technology Stack
- Angular 17+ standalone/module components
- SAP UI5 Web Components — all UI primitives (`ui5-button`, `ui5-dialog`, `ui5-input`, etc.)
- AG Grid Enterprise — `app-ag-grid-table` shared component
- `CommonService` — all HTTP calls (OData = `true`, REST = `false`)
- Tailwind CSS — all layout and spacing

### Dialog Footer Pattern
Never use `ui5-toolbar` + `ui5-toolbar-button` in dialog footers — they collapse to `...` overflow on small screens.

**Always use:**
```html
<div slot="footer" class="flex items-center justify-end gap-2 w-full px-4 py-2">
  <ui5-button design="Transparent" (click)="CloseDialog()" i18n>Cancel</ui5-button>
  <!-- action buttons -->
</div>
```

### AG Grid Action Column Pattern
Single info icon → opens detail dialog. Delete icon shown conditionally via `visible` fn.
```ts
{
  colId: 'actions',
  width: 80, minWidth: 80,
  pinned: 'right', lockPinned: true,
  sortable: false, filter: false, floatingFilter: false, editable: false,
  cellRenderer: AgGridActionCellRendererComponent,
  cellRendererParams: (_params: any) => ({
    actions: [
      { id: 'view', icon: 'information', design: 'Transparent' },
    ],
    onAction: (_actionId: string, row: any) => this.viewItem(row),
  }),
}
```
