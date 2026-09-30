# LOGIN_ACTIVITY_LIST_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| TS file | `Frontend/src/app/modules/base-data-management/activity-management/login-activity-list/login-activity-list.component.ts` |
| HTML file | `Frontend/src/app/modules/base-data-management/activity-management/login-activity-list/login-activity-list.component.html` |
| Selector | `app-login-activity-list` |
| Component type | List (standalone, read-only) |
| Standalone | Yes |
| Table component | `app-ag-grid-table` (`AgGridTableComponent`) |
| Purpose | Displays an OData-backed AG Grid of `LoginActivity` records — one row per login, tracking IP address, login/logout date+time, and (via the info dialog) the raw API response captured at login/logout time. Read-only — no create/edit/delete, only a "view details" info action per row. |

Route: `/base-data/user-activity` (sidebar label "Login Activity"), guarded by `BASE_DATA_USER_ACTIVITY`. The route path segment and permission key kept their original `user-activity`/`BASE_DATA_USER_ACTIVITY` names — only the component/model/table names were renamed to "Login Activity" (see [Naming history](#naming-history) below).

---

## Inputs (@Input)

None.

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `IsOpenLoginActivityInfo` | `EventEmitter<void>` | Emitted when the info action is clicked. Also passed as `[isOpen]` to `app-login-activity-info` (dual use — same pattern as `LogListComponent`/`IsOpenLogInfo`). |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `localization` | `typeof Localization` | `Localization` | Column header i18n strings. |
| `seletedActivity` | `LoginActivity` | `new LoginActivity()` | Row currently being info-viewed; passed to the info dialog as `[activityData]`. |
| `gridId` | `string` | `'base-data-login-activity-list'` | AG Grid state persistence key. |
| `columns` | `AgGridTableColumn<any>[]` | Built in constructor via `buildColumns()` | Column definitions. |
| `dataSource` | `AgGridTableODataSourceConfig<LoginActivity>` | endpoint `LoginActivities`, searchFields `['user_name', 'ip_address']`, pageSize 40, `scrollPagination: true` | OData source. |
| `toolbarConfig` | `AgGridTableToolbarConfig` | headerTitle "Login Activity", showSearch, showRowCount — no new button | Toolbar config. |

---

## Methods

### `buildColumns(): AgGridTableColumn<any>[]`
Returns: `id`, `user_name`, `ip_address`, `login_date`, `login_time`, `logout_date` (**derived**, see below), `logout_time`, `actions` (pinned right, `AgGridActionCellRendererComponent` with a single `info` action).

### `activityInfo(activity): void`
Sets `seletedActivity = activity`, emits `IsOpenLoginActivityInfo`.

---

## Login/Logout Date vs. Time columns

The backend only stores `login_date` (separate column) plus full `login_time`/`logout_time` datetimes — there is **no** `logout_date` column. To show Login Date / Login Time / Logout Date / Logout Time as four independent columns (instead of two combined datetime strings), the grid:

- Formats `login_time`/`logout_time` with `toLocaleTimeString()` (time portion only) for the "…Time" columns.
- Derives a synthetic `logout_date` column via `colId: 'logout_date'` + `valueGetter: (params) => params.data?.logout_time ?? null` (reads the date portion out of the same `logout_time` value), formatted with `toLocaleDateString()`. This avoids a backend schema change purely for a display split.
- `logout_time`/`logout_date` both show `'--'` when the user hasn't logged out yet (`logout_time` is `null`).

---

## Actions Column (via `AgGridActionCellRendererComponent`)

| Action ID | Icon | onAction behavior |
|---|---|---|
| `info` | `information` | `activityInfo(row)` → `IsOpenLoginActivityInfo.emit()` |

No delete action — unlike `LogListComponent`, login/logout audit rows are not user-deletable from this screen.

---

## Template Structure

```
<app-ag-grid-table #agGridRef ...>                          ← main grid (no new button, no delete)
<app-login-activity-info [isOpen]="IsOpenLoginActivityInfo" [activityData]="seletedActivity">
```

No inline delete dialog, no toaster — this component is simpler than `LogListComponent` since there's nothing to mutate.

---

## API Calls

| Method | Endpoint | How |
|---|---|---|
| GET | `LoginActivities` | `AgGridTableComponent` (OData) |

---

## Standalone Component — Imports

```typescript
imports: [
  AgGridTableComponent,
  ButtonComponent, DialogComponent, BusyIndicatorComponent,  // from @ui5/webcomponents-ngx
  CommonModule,
  LoginActivityInfoComponent,
]
```

---

## Enums / Models Used

| Name | Source | Usage |
|---|---|---|
| `LoginActivity` | `@shared/model/loginActivity` | Grid row model; `seletedActivity` |
| `Localization` | `@shared/utilities/localization` | Column headers (`Users`, `IP`, `Address`, etc.) |
| `AgGridActionCellRendererComponent` | `@shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component` | `actions` column (info only) |

---

## Naming history

This feature was originally built and shipped as "User Activity" (`UserActivityListComponent`, model `UserActivity`, table `user_activities`, OData entity `UserActivities`). It was renamed end-to-end to "Login Activity" — table, Eloquent model (`App\Models\LoginActivity`), OData entity set (`LoginActivities`), frontend model (`@shared/model/loginActivity`), and this component's file/folder/class/selector — because the feature is specifically about login/logout events, not general user activity. The **route path** (`user-activity`) and **permission key** (`BASE_DATA_USER_ACTIVITY`) were deliberately left unchanged: the permission is already seeded and potentially assigned to roles in the DB, so renaming it would silently orphan existing role-permission assignments without a data migration; the route path rename wasn't requested.

If a Doctrine/Lodata `TableDoesNotExist` error resurfaces for `user_activities` or `login_activities`, check that `App\Models\LoginActivity`'s implicit table name (Eloquent's default snake_case-plural-of-class-name inference — no `protected $table` override exists) matches whatever the latest migration actually created; Octane keeps the app booted, so a backend rename needs `php artisan octane:reload` to take effect even after `php artisan migrate`.
