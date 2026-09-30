# LOG_LIST_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| TSX file | `Frontend/src/app/modules/base-data-management/activity-management/log-list/log-list.component.tsx` |
| HTML file | `Frontend/src/app/modules/base-data-management/activity-management/log-list/log-list.component.html` |
| Selector | `app-log-list` |
| Component type | List (standalone, read-only with inline delete) |
| Standalone | Yes |
| Table component | `app-ag-grid-table` (`AgGridTableComponent`) |
| Purpose | Displays OData-backed AG Grid table of Activity Logs. Read-only — no create/edit. View-detail and delete actions per row. Delete uses an inline confirmation dialog with `CommonService.delete()` directly (not `app-delete-entity`). |

---

## Inputs (@Input)

No `@Input()` properties.

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `refreshTable` | `EventEmitter<void>` | Emitted after successful delete. |
| `IsOpenToastAlert` | `EventEmitter<void>` | Emitted (with 100ms delay) after delete success/error to trigger parent toast. |
| `IsOpenLogInfo` | `EventEmitter<void>` | Emitted when info action clicked. Also passed as `[isOpen]` to `app-log-info` (dual use). |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `agGridRef` | `AgGridTableComponent<ActivityLog>` | `@ViewChild` | `refreshGridData(true)` after delete. |
| `localize` | `typeof Localization` | `Localization` | Template string refs. |
| `isEdit` | `boolean` | `false` | Unused remnant; reset in `CloseDialog()`. |
| `IsDelete` | `boolean` | `false` | Controls inline delete dialog open state. |
| `Loading` | `boolean` | `false` | Delete in-progress; disables dialog buttons. |
| `ToastType` | `string` | `''` | `'delete'` or `'error'` after operation. |
| `seletedlog` | `ActivityLog` | `new ActivityLog()` | Row being info-viewed or deleted. (Typo preserved from original.) |
| `gridId` | `string` | `'base-data-activity-log-list'` | AG Grid state persistence key. |
| `columns` | `AgGridTableColumn<any>[]` | Built in constructor | Column definitions. |
| `dataSource` | `AgGridTableODataSourceConfig<ActivityLog>` | endpoint `ActivityLogs`, searchFields `['user_name', 'model_custom_id', 'action_type']`, pageSize 40 | OData source. |
| `toolbarConfig` | `AgGridTableToolbarConfig` | headerTitle "Activity Logs", showSearch, showRowCount, showSegmentButton — no new button | Toolbar config. |
| `displayConfig` | `AgGridTableDisplayConfig` | `{ gridHeight: 'calc(100vh - 118px)' }` | Grid height. |

---

## Methods

### `buildColumns(): AgGridTableColumn<any>[]`
Returns: `is_active` (boolean renderer), `custom_id`, `model_type` (via `getModelName()` valueFormatter), `model_custom_id`, `action_type`, `user_name`, `ip_address`, `created_at` (date), `actions` (pinned right, `AgGridActionCellRendererComponent` with `info` + `delete` actions).

### `getModelName(modelType): string`
Strips PHP namespace prefix: `modelType?.split('\\').pop() || 'Unknown Model'`.

### `logInfo(log): void`
Sets `seletedlog = log`, emits `IsOpenLogInfo`.

### `DeleteLog(): void`
Sets `Loading = true`, calls `CommonService.delete(\`ActivityLogs/${seletedlog.id}\`)`.
- Success: `refreshTable.emit()`, `agGridRef.refreshGridData(true)`, `CloseDialog()`, `IsOpenToastAlert.emit()` (100ms delay).
- Error: `CloseDialog()`, `IsOpenToastAlert.emit()` (100ms delay).

### `CloseDialog(): void`
Resets `IsDelete`, `isEdit`, `Loading` to `false`.

---

## Actions Column (via `AgGridActionCellRendererComponent`)

| Action ID | Icon | onAction behavior |
|---|---|---|
| `info` | `information` | `logInfo(row)` → `IsOpenLogInfo.emit()` |
| `delete` | `delete` | `seletedlog.deserialize(row); IsDelete = true` → opens inline dialog |

---

## Template Structure

```
<app-ag-grid-table #agGridRef ...>          ← main grid (no new button)
<ui5-dialog [open]="IsDelete" ...>           ← inline delete confirmation
  <ui5-button (click)="DeleteLog()">Delete
  <ui5-button (click)="IsDelete=false">Cancel
<app-toaster-message [IsOpenToastAlert]="IsOpenToastAlert" [ToastType]="ToastType">
<app-log-info [isOpen]="IsOpenLogInfo" [logData]="seletedlog">
```

---

## API Calls

| Method | Endpoint | How |
|---|---|---|
| GET | `ActivityLogs` | `AgGridTableComponent` (OData) |
| DELETE | `ActivityLogs/{id}` | `CommonService.delete()` in `DeleteLog()` |

---

## Standalone Component — Imports

```typescript
imports: [
  AgGridTableComponent,
  ButtonComponent, DialogComponent, BusyIndicatorComponent,  // from @ui5/webcomponents-ngx
  CommonModule,
  ToasterMessageComponent,
  LogInfoComponent,
]
```

---

## Services Injected

| Service | Visibility | Methods used |
|---|---|---|
| `CommonService` | `private` | `delete()` |

---

## Key Business Logic

**EventEmitter dual-use:** `IsOpenLogInfo` and `IsOpenToastAlert` are `@Output()` EventEmitters also passed as `@Input()` to child components. Child subscribes in `ngOnInit` to open dialogs/toasts.

**100ms toast delay:** Ensures delete dialog close animation completes before toast appears.

**No `app-delete-entity`:** Delete is handled entirely in-component via inline `ui5-dialog` + `CommonService.delete()`.

---

## Enums / Models Used

| Name | Source | Usage |
|---|---|---|
| `ActivityLog` | `@shared/model/activitylog` | Grid row model; `seletedlog`; DELETE URL |
| `Localization` | `@shared/utilities/localization` | Column headers, dialog labels |
| `AgGridBooleanCellRendererComponent` | `@shared/components/ag-grid-table/cell-renderers/` | `is_active` column |
| `AgGridActionCellRendererComponent` | `@shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component` | `actions` column (info + delete) |
