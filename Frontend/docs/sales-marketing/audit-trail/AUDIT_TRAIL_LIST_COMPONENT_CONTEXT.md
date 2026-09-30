# AUDIT_TRAIL_LIST_COMPONENT — Component Context

## Component Identity

| Field | Value |
|---|---|
| Component name | `AuditTrailComponent` |
| Selector | `app-audit-trail` |
| TypeScript | `src/app/modules/sales-management/audit-trail/audit-trail.component.ts` |
| HTML | `src/app/modules/sales-management/audit-trail/audit-trail.component.html` |
| SCSS | `src/app/modules/sales-management/audit-trail/audit-trail.component.scss` |
| Component type | Activity log list component |
| Route | `audit-trail` |
| Permission | `SALES_SALES_REQUESTS` |

## Purpose
Shows recent activity logs for `App\Models\SalesOrder`, including insert/update/delete messages and read/clear actions.

## Main Data Source

| Property | Value |
|---|---|
| Endpoint | `ActivityLogs` |
| Expand | `user` |
| Filter | `model_type eq 'App\\Models\\SalesOrder'` |
| Order | `created_at desc` |
| Limit | `$top=30` |

## Key Actions

| Method | Purpose |
|---|---|
| `RefreshLog()` | Reloads audit log data |
| `onCloseLog(logId)` | Marks a log as read |
| `clearAllLogs()` | Marks all logs as read through `activity-logs/read` |
| `showAllLogs()` | Opens the full base-data activity log page |

## Future Add Notes
- If audit trail becomes a grid page, document the table config here.
- If a dedicated sales audit permission is added, update this doc, route, and sidebar docs.
