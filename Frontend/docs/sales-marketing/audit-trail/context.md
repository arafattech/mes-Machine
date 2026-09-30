# Sales Management — Audit Trail

## Files
- `audit-trail/audit-trail.component.ts`
- `audit-trail/audit-trail.component.html`

## Selector
`app-audit-trail`

## Route
`audit-trail` — guarded by `SALES_SALES_REQUESTS`

## Purpose
Displays the activity/audit log for the `App\Models\SalesOrder` model. Fetches up to the 30 most recent log entries ordered by `created_at desc`. Each entry is rendered as a notification-style card showing who performed what action and when. Individual logs can be marked as read; all logs can be cleared at once.

## Separate Component Docs
- [audit_trail_list_component_context.md](audit_trail_list_component_context.md) — `AuditTrailComponent` list doc with TS, HTML, SCSS, selector, route, datasource, actions

## Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `model` | `string` | `'App\\Models\\SalesOrder'` — OData filter for model type |
| `activityLogs` | `ActivityLog[]` | Fetched and deserialized log entries |
| `loading` | `boolean` | Loading/busy state |
| `isClearLog` | `boolean` | Busy flag during clear-all operation |
| `open` | `boolean` | Controls popover/panel visibility |

## Key Methods

| Method | Description |
|--------|-------------|
| `ngOnInit()` | Calls `getInitialActiveLog()` |
| `getInitialActiveLog()` | GETs `ActivityLogs` filtered by model type, expanded with user, top 30 desc |
| `RefreshLog()` | Sets `loading = true`; calls `getInitialActiveLog()` |
| `onCloseLog(logId)` | PUTs `ActivityLogs/<id>` with `{ is_read: true }` (OData); refreshes logs |
| `clearAllLogs()` | POSTs `activity-logs/read` (REST) to mark all as read; refreshes logs |
| `getNotificationTitle(log)` | Returns title string based on `action_type` (insert/delete/update) |
| `getNotificationMessage(log)` | Returns human-readable message with model name, custom_id, status, user |
| `getInitials(name)` | Extracts first+last initials for avatar display |
| `formatDate(dateString)` | Formats date with `DatePipe` to `dd/MM/yyyy` |
| `getState(actionType)` | Returns `'Critical'` for delete, `'Information'` otherwise |
| `getStatus(log)` | Parses `new_value` JSON; returns `status` field or null |
| `getImportance(log)` | Returns `'Important'` if status is `'DRAFT'`; else `'Standard'` |
| `showAllLogs()` | Opens `base-data-management/activity-log` in a new tab |

## API Calls

| Method | Endpoint | OData | Purpose |
|--------|----------|-------|---------|
| GET | `ActivityLogs?$expand=user&$filter=model_type eq '...' &$orderby=created_at desc&$top=30` | `true` | Fetch recent audit logs |
| PUT | `ActivityLogs/<id>` | `true` | Mark single log as read |
| POST | `activity-logs/read` | `false` (REST) | Mark all logs as read |

## Services Injected

| Service | Usage |
|---------|-------|
| `CommonService` | GET/PUT/POST for log operations |
| `ToastService` | `show('remove')` on mark-as-read and clear-all |
| `DatePipe` | Date formatting in `formatDate()` |
| `Router` | (injected, not visibly used) |

## Notes
- `new_value` and `old_value` fields are JSON strings that are parsed with `JSON.parse()`. Malformed values are caught with try/catch in `getStatus()`.
- `showAllLogs()` opens the base-data activity log route (cross-module navigation via `window.open`).
- The `@count` response header is read but not used in the current implementation.
