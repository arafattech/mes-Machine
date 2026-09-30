# Angular 17+ Standards

## Imports — path aliases mandatory
`baseUrl: src`. Relative imports (`../`, `../../`) are **forbidden**.

| Alias | Path |
|-------|------|
| `@app/*` | `app/*` |
| `@shared/*` | `app/shared/*` |
| `@env/*` | `environments/*` |
| `@assets/*` | `assets/` |
| `@base-data-module/*` | `app/modules/base-data-management/*` |
| `@production-module/*` | `app/modules/production-management/*` |

```ts
// WRONG
import { UserService } from '../../../services/user.service';
// CORRECT
import { UserService } from '@app/services/user.service';
import { AgGridTableComponent } from '@shared/components/ag-grid-table';
```

## Components
* Standalone components preferred.
* `ChangeDetectionStrategy.OnPush` by default.
* `inject()` over constructor injection where it reads cleaner.
* Signals for local reactive state when appropriate.
* No logic in templates — derive in component (cheap computed signals / getters).
* Keep components small; extract reusable logic into services.
* Strict mode + `strictTemplates` are on — strong typing everywhere, no `any`.

## AG Grid (Enterprise)
* Optimize for large datasets; rely on row virtualization, never defeat it.
* Avoid expensive cell renderers — prefer value formatters / lightweight renderers.
* Avoid triggering change detection inside renderers.
* Persist + restore grid state, centralized (not per-grid): **column state, sort, filter, column order, column width**.
* Reuse the shared grid at `@shared/components/ag-grid-table` instead of bespoke grids.

### ag-grid-table usage patterns

**Flat inputs** (prefer over `dataSource` object when simple):
```ts
<app-ag-grid-table
  url="AttendanceLogs"
  expandQuery="employee,shift"
  filterQuery="is_active eq true"
  [searchFields]="['employee.first_name', 'status']"
  [limit]="50"
/>
```

**dataSource object** (use when complex / conditional):
```ts
dataSource: AgGridTableODataSourceConfig = {
  type: 'odata',
  endpoint: 'LeaveRequests',
  expand: 'employee,leaveType',
  pageSize: 50,
  searchFields: ['employee.first_name', 'employee.last_name', 'hr_status'],
};
```

**searchFields rules**:
- Use dot notation: `'employee.first_name'` (normalizer converts `.` → `/`)
- Direct fields: `contains(tolower(field), 'value')` — case-insensitive substring
- Nav property fields: `entity/any(a:contains(tolower(a/field), 'value'))` — lodata lambda syntax; plain `contains(entity/field, value)` causes `expression_parser_error`
- Match valueGetter nav path exactly: `params.data?.employee?.first_name` → `'employee.first_name'`

**Column colId** for nav properties must match OData path so column filters work:
```ts
{ colId: 'employee.first_name', valueGetter: (p) => p.data?.employee?.first_name ?? '' }
// NOT colId: 'employee_first_name' (breaks server-side column filter)
```

**dataType** — set on all columns; drives cell renderer + filter type:
```ts
import { GridTableColumnDataType } from '@shared/components/ag-grid-table/types/ag-grid-table.types';
{ field: 'created_at', dataType: GridTableColumnDataType.Date }
```

**enableRowClick** — disable when table is read-only (no row edit):
```ts
<app-ag-grid-table [enableRowClick]="false" />
```

**toolbarConfig.extraButton** — optional toolbar action button (e.g. bulk Approve). Visibility/disable driven by parent; wire `(extraButtonClick)`. `extraButtonDesign` sets UI5 button style (default `'Transparent'`; use `'Emphasized'` for a New-button-style filled border):
```ts
toolbarConfig = { showExtraButton: true, extraButtonText: $localize`Approve`, extraButtonDesign: 'Emphasized' };
```

## RxJS
* No nested subscriptions — flatten with `switchMap` / `mergeMap` / `concatMap` per semantics.
* `switchMap` = cancel-previous (search, route params); `concatMap` = ordered writes.
* `takeUntilDestroyed()` for teardown — no manual `Subscription` bookkeeping unless required.
* No leaks: every long-lived stream has teardown.

## UI5
* SAP UI5 Web Components only for UI primitives — do **not** mix in other UI libraries.
* Keep styling consistent with the active UI5 theme; respect dark mode.
* Scoped component SCSS; share design tokens, never copy hard values.
