# Base Data Management — Activity Management

## Files
- `activity-management/log-info/log-info.component.ts`
- `activity-management/log-info/log-info.component.html`
- `activity-management/log-list/` (list host component)
- `activity-management/login-activity-info/` — see [LOGIN_ACTIVITY_INFO_COMPONENT_CONTEXT.md](LOGIN_ACTIVITY_INFO_COMPONENT_CONTEXT.md)
- `activity-management/login-activity-list/` — see [LOGIN_ACTIVITY_LIST_COMPONENT_CONTEXT.md](LOGIN_ACTIVITY_LIST_COMPONENT_CONTEXT.md)

## Two sibling features under one sidebar group

The sidebar "Activity" item is an expandable group (see `base-data-management-layout.component.ts` → `activityMenuItem`) with two children:

| Sub-item | Route | Component | Entity | Purpose |
|---|---|---|---|---|
| Activity Log | `/base-data/activity-log` (`BASE_DATA_ACTIVITY_LOG`) | `LogListComponent` + `LogInfoComponent` | `ActivityLogs` | Generic CRUD audit trail — who created/updated/deleted which record, with a before/after JSON diff. |
| Login Activity | `/base-data/user-activity` (`BASE_DATA_USER_ACTIVITY`) | `LoginActivityListComponent` + `LoginActivityInfoComponent` | `LoginActivities` | Login/logout audit trail — one row per login, tracking IP + login/logout timestamps, with the raw login/logout API response JSON in the detail dialog. |

Both pairs of components follow the identical list+dialog pattern (`app-ag-grid-table` + a `ui5-dialog`/`ui5-tabcontainer` detail view opened via an `EventEmitter`-as-`@Input` handoff) — `LoginActivityListComponent`/`LoginActivityInfoComponent` were built as a direct copy of `LogListComponent`/`LogInfoComponent`'s structure, adapted for login/logout fields instead of generic model-change fields.

## Route
`/base-data/activity-log` — guarded by `BASE_DATA_ACTIVITY_LOG`.

## Purpose
Read-only audit trail viewer. Shows a paginated list of all system activity logs and provides a dialog (`LogInfoComponent`) to inspect the full details — including a JSON diff of what changed.

---

## LogInfoComponent

### Selector
`app-log-info`

### Type
Modal dialog — opened from the log list when a user clicks a row.

### Inputs

| Input | Type | Purpose |
|-------|------|---------|
| `isOpen` | `EventEmitter<void>` | Parent emits to open this dialog |
| `logData` | `ActivityLog` | Activity log record to display |

### Outputs
None — read-only display component.

### Key Properties

| Property | Purpose |
|----------|---------|
| `open` | Controls dialog visibility |
| `localization` | Localization utilities for display formatting |

### Key Methods

| Method | Description |
|--------|-------------|
| `ngOnInit()` | Subscribes to `isOpen` emitter; sets `open = true` on emit |
| `getModelName(modelType)` | Strips namespace prefix, returns plain class name (e.g. `App.Models.Product` → `Product`) |
| `formatJSON(data)` | Pretty-prints JSON string with 2-space indentation |
| `formatDate(dateString)` | Formats ISO date string to `DD/MM/YYYY` |

### Template Structure
```
<app-log-info>
  └── Dialog (open controlled by `open` flag)
      └── TabContainerComponent
          ├── Tab: "Details"
          │   ├── Model Type (via getModelName)
          │   ├── Action (Created/Updated/Deleted)
          │   ├── User
          │   └── Timestamp (via formatDate)
          └── Tab: "Changes"
              └── Formatted JSON display (via formatJSON)
```

### ActivityLog Model (inferred)
```typescript
interface ActivityLog {
  id: number;
  model_type: string;       // e.g. "App\Models\Product"
  model_id: number;
  action: string;           // "created" | "updated" | "deleted"
  user_id: number;
  user_name: string;
  changes: string;          // JSON-encoded before/after diff
  created_at: string;
}
```

---

## LogListComponent (Host)

### Purpose
Table/grid of all activity log entries. Supports filtering and opens `LogInfoComponent` on row click.

### API Calls (inferred from routing)
- **GET:** `ActivityLogs` or similar OData endpoint — paginated, ordered by `created_at desc`.

---

## Services Injected

| Service | Usage |
|---------|-------|
| `CommonService` | Fetches log data |
| `RolePermissionService` | Guards the route and list actions |

## Notes
- `LogInfoComponent` is purely presentational — it never writes to the server.
- The JSON change diff displayed in the "Changes" tab shows the raw before/after values from the audit log, formatted for readability.
- `getModelName` is needed because Laravel Eloquent stores the full namespace (`App\Models\Product`) in the `model_type` column.
