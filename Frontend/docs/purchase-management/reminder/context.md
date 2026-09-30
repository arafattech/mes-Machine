# Purchase Management — Reminder (delegates to store-management)

Full component doc: [`store-management/reminder/context.md`](../../store-management/reminder/context.md). This file covers only the **purchase-side wiring** — the component itself is not duplicated or re-declared here.

## Route
`/purchase-management/reminders` — guard: `STORE_REMINDERS` (same permission string as the store route, not a separate `PURCHESE_*` permission)

Route entry (`purchese-management-routing.module.ts`):
```typescript
{
  path: 'reminders',
  component: ReminderComponent,          // @app/modules/store-management/reminder/reminder.component
  canActivate: [PermissionGuard],
  data: { permission: Permissions.STORE_REMINDERS, context: 'purchase' },
}
```

`ReminderComponent` reads `route.snapshot.data['context']` in its constructor and defaults to `'store'` when absent — the store route has no `context` key, so store's own `/store-management/reminders` behaves unchanged.

## Why no module declaration here
`PurcheseManagementModule` already `imports: [StoreManagementModule]` (used elsewhere for `PurchaseOrderComponent` reuse — see [purchase-orders/context.md](../purchase-orders/context.md)). `ReminderComponent`/`ReminderFormComponent` are declared **only** in `StoreManagementModule`; routing to them from `purchese-management-routing.module.ts` needs nothing extra.

**Do not** add `ReminderComponent`/`ReminderFormComponent` to `PurcheseManagementModule`'s own `declarations` — Angular does not allow a component in two NgModules' `declarations` at once (hard build error: "part of the declarations of 2 modules").

## Sidebar
`layout.component.ts` → `fullSidebarMenu` — "Reminders" item added to the single Purchase Management group, gated by `Permissions.STORE_REMINDERS`:
```typescript
{
  text: $localize`Reminders`,
  icon: 'alert',
  permission: Permissions.STORE_REMINDERS,
  routerLink: 'reminders',
}
```
Also added to `checkEmployeePermission()`'s `pages` array (redirect-on-no-access logic), same pattern as every other purchase sidebar entry.

## What purchase can actually do
See the field-editability matrix in the store doc. Summary: purchase can edit exactly two things on a reminder — the **"I have read" checkbox** and the **Purchase Message** textarea. MRR, Reminder Date, and Message are read-only for purchase. Once "I have read" is submitted, the row locks for editing everywhere (store included) and the row's action icon switches from edit (pencil) to info — clicking info reopens the same dialog fully read-only (`viewOnly=true`).

## Notification purchase receives
`STORE_REMINDERS_CREATE_NOTIFICATION` — fired when store creates a new reminder against a partial Local MRR. A purchase user only sees the toast/badge if their role holds this permission (checked client-side in `NotificationComponent` against the socket payload's `type`).
