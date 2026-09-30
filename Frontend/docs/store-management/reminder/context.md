# Store Management — Reminder

## Files

```
reminder/
├── reminder.component.ts          ← list (used by BOTH store and purchase modules)
├── reminder.component.html
└── reminder-form/
    ├── reminder-form.component.ts   ← create/edit/view dialog
    └── reminder-form.component.html
```

## Route
`/store-management/reminders` — guard: `STORE_REMINDERS`
`/purchase-management/reminders` — guard: `STORE_REMINDERS` (same permission, `context: 'purchase'` route data) — **cross-module reuse**, see below.

---

## Cross-module reuse (store ⇄ purchase)

`ReminderComponent` is declared only in `StoreManagementModule` but is routed directly from `PurcheseManagementRoutingModule` (which already imports `StoreManagementModule`). No extra module wiring needed — Angular routes to a component class regardless of which module declares it, as long as that module is loaded somewhere in the compiled app.

**Do NOT re-declare `ReminderComponent`/`ReminderFormComponent` in `PurcheseManagementModule`** — a component can only belong to one NgModule's `declarations`. Re-declaring causes a hard build error ("part of the declarations of 2 modules").

### How context is threaded through

```
Route data { context: 'purchase' }
  → ReminderComponent reads route.snapshot.data['context'] in constructor
  → this.context: 'store' | 'purchase'
  → passed down via [context]="context" to <app-reminder-form>
```

Store's own route (`store-management-routing.module.ts`) has no `context` in its route data — `ReminderComponent` defaults to `'store'`.

---

## ReminderComponent

### Selector
`app-reminder`

### Purpose
Lists reminders tied to **Local MRR** records (`source eq 'LOCAL'`). Store creates a reminder against a partial Local MRR; Purchase views/acknowledges it.

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `context` | `'store' \| 'purchase'` | Set once in constructor from `ActivatedRoute` data; drives `showNewButton` and edit/info action split |
| `dataSource` | `AgGridTableODataSourceConfig` | OData `Reminders`, expand `mrr` |
| `segmentButtonItems` | `array` | All (default) / Unread / Read — filters on `is_read` |
| `columns` | `AgGridTableColumn[]` | MRR No, Message, Reminder Date, Read, Actions |
| `agGridRef` | `AgGridTableComponent` | `#agGridRef` |
| `formRef` | `ReminderFormComponent` | `#reminderForm` |

### OData Config

| Key | Value |
|-----|-------|
| endpoint | `Reminders` |
| expand | `mrr` |
| default filter | none (segment "All") |
| sortBy / sortDirection | `created_at` / `desc` — newest reminder first |
| searchFields | `message`, `mrr.custom_id` |

**Hidden `created_at` column required for sort to work**: `columns` includes `{ field: 'created_at', hide: true }` — the shared `sortBy` config applies via AG Grid's column state (`applyColumnState({state:[{colId: sortBy, ...}]})`), which needs a matching column to exist in the grid or it silently no-ops. Reminders has no visible `created_at` column, so a hidden one is added purely to give the sort something to attach to. Same applies to any future `sortBy`/`searchFields` field that isn't already a visible column.

### Segment → filter
`unread` → `is_read eq false`, `read` → `is_read eq true`, `all` → no filter. Same spread-reassign pattern as other list components (`this.dataSource = { ...this.dataSource, filter }`).

### Columns

| colId / field | Header | Notes |
|---------------|--------|-------|
| `mrr.custom_id` | MRR No | `colId` dot notation → OData filter works; `valueGetter: mrr.custom_id` |
| `message` | Message | plain field |
| `reminder_date` | Reminder Date | `GridTableColumnDataType.Date` |
| `is_read` | Read | `GridTableColumnDataType.Boolean` |
| `actions` | Actions | **edit** icon (visible when `!row.is_read`) OR **info** icon (visible when `row.is_read`) — mutually exclusive via `visible: (row) => ...` on each `AgGridTableRowAction` |

**Once `is_read` is true, the row is locked for editing in BOTH store and purchase context** — the edit icon disappears entirely (not just disabled) and an info icon takes its place. Clicking info opens the same dialog in full **view-only** mode (see `viewItem()` below) — this is how "view all data" is satisfied without a separate component.

### Key Methods

| Method | Description |
|--------|-------------|
| `newItem()` | POST mode, `formRef.viewOnly = false`, `reset()` |
| `editItem(row)` | PUT mode, `formRef.viewOnly = false`, `populate(row)` — only reachable while `!row.is_read` |
| `viewItem(row)` | PUT mode, `formRef.viewOnly = true`, `populate(row)` — reachable from the info icon, any context, any `is_read` state |
| `saveEvent()` | `agGridRef?.refreshGridData(true)` |

---

## ReminderFormComponent

### Selector
`app-reminder-form`

### Inputs

| Input | Type | Default | Purpose |
|-------|------|---------|---------|
| `saveMode` | `'POST' \| 'PUT'` | `'POST'` | Create vs update |
| `selectedData` | `any` | — | Row being edited/viewed |
| `context` | `'store' \| 'purchase'` | `'store'` | Drives which fields are readonly and which extra field (checkbox) shows |
| `viewOnly` | `boolean` | `false` | Set by `viewItem()` — locks **every** field and hides the Submit button, regardless of `context` |

**Reminder Date is always readonly, defaults to today.** `reset()` seeds `reminder_date: moment().format('DD-MM-YYYY')` and the date-picker is `readonly` unconditionally (not gated by `context`/`viewOnly`) — the reminder date is always "today", never user-editable, in either context.

### Field editability matrix

| Field | Store (create/edit) | Purchase | `viewOnly` (either context) |
|-------|---------------------|----------|------------------------------|
| MRR (combobox) | editable | readonly | readonly |
| Reminder Date | editable | readonly | readonly |
| Message | editable | readonly | readonly |
| Purchase Message | **readonly** — store never fills this | editable | readonly |
| "I have read" checkbox | hidden | editable | shown, `[disabled]` |

Rationale: Purchase Message is meant to be the purchase team's response — store creating the reminder shouldn't pre-fill it. Purchase can edit exactly two fields (checkbox + Purchase Message); everything else it inherits read-only from the store-authored reminder.

### Layout (single page, no tabs)
Originally had a Core/Log `ui5-tabcontainer`; **tabs were removed** per design change — everything now lives on one scrollable page: MRR + Reminder Date (50/50 row) → Message → "I have read" checkbox (purchase/viewOnly only) → Purchase Message → MRR Log grid (bordered box, always visible, same page).

**Height/scrollbar gotcha**: the log grid's wrapper `div` must NOT be given an independent fixed height that competes with the grid's own rendered size (toolbar + `gridHeight`). Let the wrapper `div` size itself to the grid's natural height (no explicit `h-[...]` on the wrapper) — otherwise you get a phantom empty gap or a double scrollbar. If a fixed height is unavoidable (e.g. nested inside a `ui5-busy-indicator` with its own fixed `vh`), derive every nested `calc()` from the SAME `vh` base as the ancestor, and remember the grid's own toolbar bar (~40–56px) sits ABOVE the `gridHeight`-styled div, not inside it — subtract for it explicitly.

### MRR options source
`mrrOptions` loaded once in `ngOnInit()`:
```
MaterialReceipts?$filter=source eq 'LOCAL' and status eq 'PARTIAL'&$orderby=custom_id desc&$select=id,custom_id
```
Same partial-Local-MRR filter as `LocalMaterialReceiptComponent`'s default segment — Local MRR itself is **never modified** by this feature, only read from.

### MRR Log grid
Reuses the same `MaterialReceiptLogs` endpoint/columns as `LocalMaterialReceiptComponent`'s MRR Log panel (Product, Required/Received Qty, Date, Received By, Remark — **no Receiving Qty column**, that field is form-only, entered live in the item-entry grid's inline stepInput, not shown in the historical log). Reloaded via `loadLog()` on `onMrrChange()` and on `populate()`:
```
MaterialReceiptLogs?$filter=material_receipt_id eq {mrr_id}&$expand=product,receivedBy&$orderby=created_at desc
```

### Key Methods

| Method | Description |
|--------|-------------|
| `onMrrChange(event)` | Sets `reminder.mrr_id` + `mrrTitle`, calls `loadLog()` |
| `save()` | POST → `store/reminders`; PUT → `store/reminders/{id}` (`is_read` only included in the PUT payload); triggers notification (see below) |
| `CloseDialog()` | resets `open`/`loading` |

---

## Real-Time Notification (Socket Emit)

Two distinct events, both permission-filtered client-side by `NotificationComponent` (`rolePermissionService.hasPermission(payload.type)` — a user only sees the toast/badge if they hold the matching permission).

| Trigger | Socket event | Permission (recipient gate) | Backend PERMISSION_MAP key |
|---------|--------------|------------------------------|------------------------------|
| Store creates a reminder (POST success) | `store-reminder:created` | `STORE_REMINDERS_CREATE_NOTIFICATION` | `Reminder::created` |
| Purchase submits with "I have read" checked (PUT success, `context==='purchase' && is_read`) | `store-reminder:read` | `STORE_REMINDERS_UPDATE_NOTIFICATION` | `Reminder::updated` |

```typescript
private triggerReminderNotification(event: string, reminderId?: number): void {
  if (!reminderId) return;
  const authUser = this.authService.user();
  this.socketService.emit(event, {
    model_id: reminderId,
    model_custom_id: this.mrrTitle || reminderId,
    sender_id: authUser.id,
    sender_name: authUser.name,
  });
}
```

### node-server (`notification.service.ts`)
`broadcastReminderCreated` / `broadcastReminderRead` — same shape as `broadcastLocalMrrCreated` etc., `socketService.getServer().emit('notification:new', data)`.

### Backend DB persistence (Laravel Observer)
`Backend/app/Observers/ReminderObserver.php`, registered in `AppServiceProvider::boot()`.

- `created()` — always dispatches.
- `updated()` — dispatches **only** when `$reminder->wasChanged('is_read') && $reminder->is_read` is true (i.e. only the read-confirmation transition, not every edit).

`Reminder` has no `type` attribute (unlike `MaterialReceipt`), so its `PERMISSION_MAP` keys have an empty type segment — `Reminder::created` / `Reminder::updated` (same convention already used by `Department::created`).

### Services injected (notification-related)
| Service | Usage |
|---------|-------|
| `SocketService` | `emit(event, payload)` |
| `AuthService` | `user()` — sender info |

---

## Backend

| File | Role |
|------|------|
| `app/Models/Reminder.php` | `mrr_id`, `message`, `purchase_message`, `reminder_date`, `is_read`, `created_by`; `mrr()` belongsTo `MaterialReceipt` |
| `app/Http/Controllers/ReminderController.php` | `store()`/`update()`; `mrr_id` validated `exists:material_receipts,id`; `purchase_message` nullable |
| `app/Observers/ReminderObserver.php` | see notification section above |
| `database/migrations/..._create_reminders_table.php` | `mrr_id` is a proper `foreignIdFor(MaterialReceipt)` + FK constraint (NOT a loose string/product_id) |

## Permissions

| Permission | Group | Effect |
|------------|-------|--------|
| `STORE_REMINDERS` | STORE | View the Reminders list (both store and purchase sidebar entries gate on this same permission) |
| `STORE_REMINDERS_CREATE_NOTIFICATION` | STORE (NOTIFICATION section in enum) | Receives toast/notification when a reminder is created |
| `STORE_REMINDERS_UPDATE_NOTIFICATION` | STORE (NOTIFICATION section in enum) | Receives toast/notification when purchase marks a reminder as read |

**Enum convention**: all `*_NOTIFICATION` permissions live together in the dedicated `// NOTIFICATION` section at the bottom of `permissions.ts`, not inline in their module's block — only the base view/action permission (e.g. `STORE_REMINDERS`) stays inline in the module section.
