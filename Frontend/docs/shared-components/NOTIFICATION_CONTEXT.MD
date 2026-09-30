# NotificationComponent

**Selector:** `app-notification`
**File:** `src/app/shared/components/notification/notification.component.ts`
**Standalone:** Yes — `CUSTOM_ELEMENTS_SCHEMA`
**Imports:** `CommonModule`, `DatePipe`, `RouterLink`

## What It Does

Real-time activity log notification panel rendered as a UI5 popover. Shows unread create/update/delete events with user avatars, timestamps, and action descriptions. Supports marking individual notifications as read, bulk clear, and opening the full activity log page.

## Inputs

| Input | Type | Purpose |
|---|---|---|
| `isOpen` | `EventEmitter<void>` | Shows/hides the popover |

## Outputs

| Output | Emits | When |
|---|---|---|
| `notificationCount` | `number` | Unread count updated |

## Key Methods

| Method | Purpose |
|---|---|
| `ngOnInit()` | Fetches initial logs, subscribes to `isOpen` |
| `getInitialActiveLog()` | OData query for unread logs, emits count |
| `RefreshLog()` | Reloads notification list |
| `onCloseLog(logId)` | Marks single notification as read via API |
| `clearAllLogs()` | Bulk mark-all-read via API |
| `getNotificationTitle(log)` | Returns title string based on action type (insert/update/delete) |
| `getNotificationMessage(log)` | Returns descriptive message with user name and action |
| `getState(actionType)` | `'Critical'` for delete, `'Information'` otherwise |
| `getModelName(modelType)` | Extracts short model name from fully qualified type string |
| `getInitials(name)` | Extracts initials for avatar |
| `formatDate(dateString)` | Formats to `dd/MM/yyyy` |
| `showAllLogs()` | Opens full activity log page in new tab |

## Internal State

| Property | Purpose |
|---|---|
| `activityLogs: ActivityLog[]` | Loaded notifications |
| `open: boolean` | Popover visibility |
| `loading: boolean` | Loading state |
| `isClearLog: boolean` | Clear confirmation dialog |

## API Queries

- Fetch unread: `OData /activity-logs?$filter=is_read eq false&$orderby=created_at desc`
- Mark read: REST PATCH per log ID
- Bulk clear: REST endpoint for all

## Usage Pattern

```html
<!-- in LayoutComponent -->
<app-notification
  [isOpen]="notifOpenEmitter"
  (notificationCount)="updateBadge($event)"
></app-notification>

<!-- trigger from bell button -->
<button (click)="notifOpenEmitter.emit()">🔔</button>
```
