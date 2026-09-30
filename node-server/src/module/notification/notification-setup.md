# Real-Time Notification — Setup Guide

> **Quick add:** Give me this file + the component file path and say:
> *"Add real-time notification to [ComponentName]. Socket event: `module-entity:created`. Permission name: `MODULE_ENTITY_ACTION_NOTIFICATION`."*

---

## Files that always change (every new notification)

| # | File | Purpose |
|---|------|---------|
| 1 | [`notification.service.ts`](./notification.service.ts) | Add `socketService.on()` listener in `onModuleInit` + broadcast method |
| 2 | [`../../../../Frontend/src/app/shared/enums/permissions.ts`](../../../../Frontend/src/app/shared/enums/permissions.ts) | Add permission enum value |
| 3 | [`../../../../Backend/database/seeders/PermissionSeeder.php`](../../../../Backend/database/seeders/PermissionSeeder.php) | Seed to DB |
| 4 | [`../../../../Backend/database/seeders/BtlPermissionSeeder.php`](../../../../Backend/database/seeders/BtlPermissionSeeder.php) | Seed to DB (BTL) |
| 5 | [`../../../../Backend/app/Services/NotificationService.php`](../../../../Backend/app/Services/NotificationService.php) | Add PERMISSION_MAP entry |
| 6 | Angular component `.ts` | Wire socket emit on action success |

## Files that change only for a NEW Laravel model

| File | Purpose |
|------|---------|
| `Backend/app/Observers/{Model}Observer.php` | Create observer |
| [`../../../../Backend/app/Providers/AppServiceProvider.php`](../../../../Backend/app/Providers/AppServiceProvider.php) | Register observer |
| Laravel Model | Add `getTypeAttribute()` if model uses `source` column |

---

## Currently implemented

| Socket event | Permission string | Laravel map key |
|---|---|---|
| `store-localrrm:created` | `STORE_LOCAL_MRR_CREATE_NOTIFICATION` | `MaterialReceipt:LOCAL:created` |
| `store-importedmrr:created` | `STORE_IMPORTED_MRR_CREATE_NOTIFICATION` | `MaterialReceipt:IMPORTED:created` |
| `store-requisition:created` | `STORE_STORE_REQUISITION_CREATE_NOTIFICATION` | `PurchaseRequisition:SR:created` |
| `store-requisition:approved` | `STORE_STORE_REQUISITION_APPROVE_NOTIFICATION` | `PurchaseRequisition:SR:approved` |
| `store-requisition:rejected` | `STORE_STORE_REQUISITION_REJECT_NOTIFICATION` | `PurchaseRequisition:SR:rejected` |
| `store-spr:created` | `STORE_PURCHASE_REQUISITION_CREATE_NOTIFICATION` | `PurchaseRequisition:SPR:created` |
| `store-spr:approved` | `STORE_PURCHASE_REQUISITION_APPROVE_NOTIFICATION` | `PurchaseRequisition:SPR:approved` |
| `store-spr:rejected` | `STORE_PURCHASE_REQUISITION_REJECT_NOTIFICATION` | `PurchaseRequisition:SPR:rejected` |
| `base-data-department:created` | `BASE_DATA_DEPARTMENT_CREATE_NOTIFICATION` | `Department::created` |
| `base-data-department:updated` | `BASE_DATA_DEPARTMENT_UPDATE_NOTIFICATION` | `Department::updated` |
| `base-data-department:deleted` | `BASE_DATA_DEPARTMENT_DELETE_NOTIFICATION` | `Department::deleted` |
| `hrm-leave:applied` | `HRM_LEAVE_APPLIED_NOTIFICATION` | observer `created` (custom REST) |
| `hrm-leave:supervisor-approved` | `HRM_LEAVE_STATUS_NOTIFICATION` | observer `saved` (Lodata) |
| `hrm-leave:supervisor-rejected` | `HRM_LEAVE_STATUS_NOTIFICATION` | observer `saved` (Lodata) |
| `hrm-leave:hr-approved` | `HRM_LEAVE_STATUS_NOTIFICATION` | observer `saved` (Lodata) |
| `hrm-leave:hr-rejected` | `HRM_LEAVE_STATUS_NOTIFICATION` | observer `saved` (Lodata) |
| `hrm-notice:created` | `HR_NOTICE_CREATE_NOTIFICATION` | controller `store()` (custom REST) |
| `sales-order:created` | `SALES_SALES_ORDER_CREATE` | observer `saved` (Lodata) |
| `sales-order:sent` | `SALES_SALES_REQUEST_APPROVE` | observer `saved` (Lodata) |
| `sales-order:approved` | `SALES_SALES_REQUEST_APPROVE` | observer `saved` (Lodata) |
| `sales-order:rejected` | `SALES_SALES_REQUEST_REJECT` | observer `saved` (Lodata) |

---

## Step 1 — `notification.service.ts`

Add socket listener in `onModuleInit` **and** a broadcast method:

```ts
// in onModuleInit():
socketService.on('store-localrrm:created', (_, payload: NotificationPayload) => {
  this.broadcastLocalMrrCreated(payload);
});

// broadcast method:
broadcastLocalMrrCreated(payload: NotificationPayload): void {
  this.broadcast({
    type: 'STORE_LOCAL_MRR_CREATE_NOTIFICATION',  // must match permission string exactly
    model_type: 'MaterialReceipt',                 // Laravel model class name (class_basename)
    ...payload,
    title: `New Local MRR Created (#${payload.model_custom_id})`,
    message: `${payload.sender_name} created a new Local Material Receipt (#${payload.model_custom_id}).`,
  });
}
```

> **Note:** The old guide mentioned `@SubscribeMessage` in `biometrics.service.ts`. That is NOT the current pattern. All notification socket listeners live in `notification.service.ts` via `socketService.on()`.

---

## Step 2 — `permissions.ts`

```ts
STORE_LOCAL_MRR_CREATE_NOTIFICATION = 'STORE_LOCAL_MRR_CREATE_NOTIFICATION',
```

---

## Step 3 & 4 — Seeders (both `PermissionSeeder.php` and `BtlPermissionSeeder.php`, same string)

```php
'STORE_LOCAL_MRR_CREATE_NOTIFICATION',
```

After seeding run:
```bash
php artisan db:seed --class=PermissionSeeder
php artisan db:seed --class=BtlPermissionSeeder
```
Then assign to role in UI → user must re-login.

---

## Step 5 — `NotificationService.php` PERMISSION_MAP

```php
private const PERMISSION_MAP = [
    // key = "{ModelClassName}:{model->type}:{action}"
    // if model has no type/source: "{ModelClassName}::{action}"
    'MaterialReceipt:LOCAL:created'     => 'STORE_LOCAL_MRR_CREATE_NOTIFICATION',
    'MaterialReceipt:IMPORTED:created'  => 'STORE_IMPORTED_MRR_CREATE_NOTIFICATION',
    'PurchaseRequisition:SR:created'    => 'STORE_STORE_REQUISITION_CREATE_NOTIFICATION',
    'PurchaseRequisition:SR:approved'   => 'STORE_STORE_REQUISITION_APPROVE_NOTIFICATION',
    'PurchaseRequisition:SR:rejected'   => 'STORE_STORE_REQUISITION_REJECT_NOTIFICATION',
    'PurchaseRequisition:SPR:created'   => 'STORE_PURCHASE_REQUISITION_CREATE_NOTIFICATION',
    'PurchaseRequisition:SPR:approved'  => 'STORE_PURCHASE_REQUISITION_APPROVE_NOTIFICATION',
    'PurchaseRequisition:SPR:rejected'  => 'STORE_PURCHASE_REQUISITION_REJECT_NOTIFICATION',
    'Department::created'               => 'BASE_DATA_DEPARTMENT_CREATE_NOTIFICATION',
    'Department::updated'               => 'BASE_DATA_DEPARTMENT_UPDATE_NOTIFICATION',
    'Department::deleted'               => 'BASE_DATA_DEPARTMENT_DELETE_NOTIFICATION',
];
```

If model uses `source` column instead of `type`, add to the model:
```php
public function getTypeAttribute(): string
{
    return $this->attributes['source'] ?? '';
}
```

---

## Step 8 — Observer (new model only)

> **⚠️ Lodata gotcha**: For models served via OData (Lodata), the `created`, `updated`, and `deleted` Eloquent events do NOT fire reliably inside Lodata's DB transaction. Use `saved()` + `wasRecentlyCreated` and `deleting()` instead.

```php
// Backend/app/Observers/YourModelObserver.php
class YourModelObserver
{
    public function __construct(private NotificationService $notificationService) {}

    // 'saved' fires for both creates and updates via Lodata
    public function saved(YourModel $model): void
    {
        $action = $model->wasRecentlyCreated ? 'created' : 'updated';
        $this->notificationService->dispatch($model, $action, auth()->id());
    }

    // 'deleting' fires before DELETE; use instead of 'deleted' for Lodata models
    public function deleting(YourModel $model): void
    {
        $this->notificationService->dispatch($model, 'deleted', auth()->id());
    }
}
```

> **Non-Lodata models** (custom controllers): can use `created()` / `updated()` / `deleted()` directly.

Register in `AppServiceProvider.php`:
```php
use App\Observers\YourModelObserver;
// ...
YourModel::observe(YourModelObserver::class);
```

Registered observers (current):
- `PurchaseRequisition::observe(PurchaseRequisitionObserver::class)`
- `MaterialReceipt::observe(MaterialReceiptObserver::class)`
- `Department::observe(DepartmentObserver::class)`
- `SalesOrder::observe(SalesOrderObserver::class)`

---

## Step 6 — Angular component (emit on save)

Two patterns depending on the component type:

### Pattern A — Form component (CREATE / creator PUT)

Used in: `requisition-from.component.ts` for `store-spr:created`, `store-requisition:created`

```ts
// Imports
import { SocketService } from "@app/services/socket.service";
import { AuthService } from "@app/services/auth-service/auth.service";
import { User } from "@app/shared/model/user";

// Properties
private newEntityData: { id: number; custom_id?: string } | null = null;
private authUser: User = new User();

// Constructor
constructor(private socketService: SocketService, private authService: AuthService) {
  this.authUser = this.authService.user();
}

// Trigger method
private triggerNotification(data: { id: number; custom_id?: string }): void {
  this.socketService.emit('store-localrrm:created', {
    model_id: data.id,
    model_custom_id: data.custom_id ?? data.id,
    sender_id: this.authUser.id,
    sender_name: this.authUser.name,
  });
}

// In POST success handler — store the new record, emit after batch/save:
if (this.saveMode === saveMode.POST) {
  this.newEntityData = { id: response.id, custom_id: response.custom_id };
}

// In afterSuccessSave():
if (this.newEntityData) {
  this.triggerNotification(this.newEntityData);
  this.newEntityData = null;
}
```

### Pattern B — List/request component (APPROVE / REJECT)

Used in: `spr-requests.component.ts` for `store-spr:approved`, `store-spr:rejected`

The parent component owns the notification emit for approve/reject. It reads `formRef.Spr.status`
(set synchronously before `saveEvent.emit()` fires) to determine the action:

```ts
// Imports
import { AuthService } from "@app/services/auth-service/auth.service";
import { SocketService } from "@app/services/socket.service";
import { User } from "@app/shared/model/user";

// Properties
private readonly socketService = inject(SocketService);
private readonly authService = inject(AuthService);
private authUser: User = new User();

// Constructor
constructor(...) {
  this.authUser = this.authService.user();
}

// saveEvent handler
saveEvent(): void {
  this.emitActionNotification();
  this.agGridRef?.refreshGridData(true);
}

private emitActionNotification(): void {
  const status = this.formRef?.Spr?.status;
  const id = this.selectedData?.id;
  const customId = this.selectedData?.custom_id ?? id;
  if (!id) return;

  const payload = {
    model_id: id,
    model_custom_id: customId,
    sender_id: this.authUser.id,
    sender_name: this.authUser.name,
  };

  if (status === SprStatus.APPROVED || status === SprStatus.FINAL_APPROVAL) {
    this.socketService.emit('store-spr:approved', payload);
  } else if (status === SprStatus.REJECTED) {
    this.socketService.emit('store-spr:rejected', payload);
  }
}
```

> **Key rule:** The form component handles CREATE notifications. The parent list/request component handles APPROVE/REJECT notifications. Never emit both from the same place for the same event.

---

## Optional — Real-time list refresh on incoming notification

```ts
import { DestroyRef, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { SocketService } from "@app/services/socket.service";
import { Permissions } from "@app/shared/enums/permissions";

private readonly destroyRef = inject(DestroyRef);
private readonly socketService = inject(SocketService);

private readonly WATCHED_TYPES = new Set([
  Permissions.STORE_STORE_REQUISITION_CREATE_NOTIFICATION,
  Permissions.STORE_STORE_REQUISITION_APPROVE_NOTIFICATION,
]);

// in ngOnInit():
this.socketService
  .on('notification:new')
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe((payload: unknown) => {
    const p = payload as { type?: string };
    if (p.type && this.WATCHED_TYPES.has(p.type as Permissions)) {
      this.agGridRef?.refreshGridData(true);
    }
  });
```

---

## Naming convention

| Thing | Pattern | Example |
|-------|---------|---------|
| Socket event | `{module}-{entity}:{action}` | `store-localrrm:created` |
| Permission string | `{MODULE}_{ENTITY}_{ACTION}_NOTIFICATION` | `STORE_LOCAL_MRR_CREATE_NOTIFICATION` |
| Broadcast method | `broadcast{Entity}{Action}` | `broadcastLocalMrrCreated` |
| Handler method | `handle{Entity}{Action}` | `handleLocalMrrCreated` |
| Observer class | `{Model}Observer` | `MaterialReceiptObserver` |

---

## Checklist

- [ ] `notification.service.ts` — `socketService.on()` listener + broadcast method added
- [ ] `permissions.ts` — enum value added
- [ ] `PermissionSeeder.php` — permission string added
- [ ] `BtlPermissionSeeder.php` — permission string added
- [ ] `NotificationService.php` — PERMISSION_MAP entry added
- [ ] Observer created + registered (new model only)
- [ ] Component (Pattern A — create): trigger method + afterSuccessSave wired
- [ ] Component (Pattern B — approve/reject): parent `saveEvent` emits via `formRef.Spr.status`
- [ ] List component: `notification:new` listener wired for grid refresh
- [ ] `php artisan db:seed --class=PermissionSeeder && php artisan db:seed --class=BtlPermissionSeeder` run
- [ ] Permission assigned to role in UI
- [ ] User re-logged in (browser permissions refresh on login)
