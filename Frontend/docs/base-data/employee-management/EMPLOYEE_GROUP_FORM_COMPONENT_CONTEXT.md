# EMPLOYEE_GROUP_FORM_COMPONENT — Component Context

## Overview

| Attribute | Value |
|---|---|
| TypeScript file | `src/app/modules/base-data-management/employees-management/employee-group-list/employee-group-form/employee-group-form.component.tsx` |
| Template file | `src/app/modules/base-data-management/employees-management/employee-group-list/employee-group-form/employee-group-form.component.html` |
| Selector | `app-employee-group-form` |
| Component type | Dialog — employee picker |
| Grid library | AG Grid (`app-ag-grid-table`) — OData server-side, Multiple selection |
| Purpose | Modal dialog showing all unassigned active employees. User selects one or more rows and submits to associate them to a group via `employee/group-associate`. |

---

## Inputs (@Input)

| Input | Type | Default | Purpose |
|---|---|---|---|
| `open` | `boolean` | `false` | Controls `ui5-dialog` visibility. |

---

## Outputs (@Output)

| Output | Payload | Purpose |
|---|---|---|
| `openChange` | `boolean` | Two-way binding partner for `open`; emitted `false` on close. |
| `onSubmit` | `any[]` | Declared; not currently emitted. Reserved. |
| `refreshTable` | `void` | Emitted after successful group-associate POST; triggers parent list reload. |

---

## Data Source

```typescript
dataSource: AgGridTableODataSourceConfig = {
  type: "odata",
  endpoint: "Employees",
  expand: "department,designation",
  filter: "group_id eq null and is_active eq true",
  pageSize: 50,
  searchFields: ["first_name", "last_name", "employee_no"],
}
```

Only employees not yet in any group (`group_id eq null`) and active are loaded.

---

## Toolbar Config

```typescript
toolbarConfig: AgGridTableToolbarConfig = {
  headerTitle: "Select Employee",
  showSearch: true,
  showRowCount: true,
  showNewButton: false,
  showDownload: false,
  showScanner: false,
}
```

---

## Column Definitions

| Field | Header | Notes |
|---|---|---|
| `is_active` | Active | `AgGridBooleanCellRendererComponent`; filter/sort/floatingFilter disabled |
| `employee_no` | Employee ID | — |
| `first_name` | First Name | — |
| `last_name` | Last Name | — |
| `designation.name` | Designation | `valueGetter: params.data?.designation?.name ?? ''`; `sortable: false` |
| `department.name` | Department | `valueGetter: params.data?.department?.name ?? ''`; `sortable: false` |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `localization` | `typeof Localization` | `Localization` | i18n constants for button labels. |
| `loading` | `boolean` | `false` | Disables toolbar buttons during POST. |
| `selectedGroupId` | `number \| null` | `null` | Set externally by parent before dialog opens; used as `group_id` in POST payload. |
| `selectedEmployeeIds` | `any[]` | `[]` | Populated by `onSelectionChanged()` from AG Grid `(selectionChanged)` event. |

---

## Lifecycle Hooks

**Constructor:** Injects `CommonService`. No other init logic.

---

## Methods

### `onSelectionChanged(rows: any[]): void`
Called from `(selectionChanged)` output of `app-ag-grid-table`. Sets `selectedEmployeeIds = rows.map(r => r.id)`.

### `addEmployeeToGroup(): void`
POSTs `{ group_id, employee_ids }` to `employee/group-associate` (REST, not OData). On success: emits `refreshTable`, calls `closeEmployeeDialog()`.

### `closeEmployeeDialog(): void`
Sets `open = false`, `loading = false`, emits `openChange(false)`.

---

## Template Structure

```
ui5-dialog [open]="open" h-[90vh]
  div h-[calc(90vh-120px)]
    app-ag-grid-table
      [columns]  [dataSource]  [toolbarConfig]
      [isBase]="false"
      [selectionMode]="'Multiple'"
      [selectionRowBehavior]="'RowOnly'"
      [showAction]="false"
      (selectionChanged)="onSelectionChanged($event)"
  ui5-toolbar slot="footer"
    ui5-toolbar-button Submit → addEmployeeToGroup()
    ui5-toolbar-button Cancel → closeEmployeeDialog()
```

---

## API Calls

| HTTP | Endpoint | When | Payload |
|---|---|---|---|
| GET | `Employees?$filter=group_id eq null and is_active eq true&$expand=department,designation` | AG Grid load | Built by AG Grid |
| POST | `employee/group-associate` (REST, `false`) | `addEmployeeToGroup()` | `{ group_id, employee_ids: number[] }` |

---

## Inter-component Communication

| Direction | Mechanism | Detail |
|---|---|---|
| From parent | `public selectedGroupId` direct property access | Parent sets `selectedGroupId` before opening dialog. |
| To parent | `@Output() refreshTable` | Emitted on successful associate; parent calls `refreshEmployeeTable()`. |
| Two-way | `[(open)]` via `@Input() open` + `@Output() openChange` | Controls dialog visibility from parent. |

---

## Key Business Logic

- **Filter pre-applied:** `group_id eq null and is_active eq true` — only unassigned active employees appear. No client-side filtering needed.
- **Multiple selection:** `[selectionMode]="'Multiple'"` + `[selectionRowBehavior]="'RowOnly'"` matches employee-list pattern.
- **selectedGroupId must be set by parent** before opening; it is a public property accessed directly via `@ViewChild` in `employee-group-list.component.ts`.
