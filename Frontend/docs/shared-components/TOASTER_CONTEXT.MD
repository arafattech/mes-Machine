# ToasterComponent

**Selector:** `app-toaster`
**File:** `src/app/shared/components/toaster/toaster.component.ts`
**Standalone:** Yes
**Imports:** `CommonModule`, `ToastComponent` (UI5), `MessageStripComponent` (UI5)

## What It Does

Global toast notification component driven by `ToastService`. Subscribes to `ToastService.toast$` observable on init. Displays localized success/error messages for 3 seconds, then auto-closes — **unless the toast is persistent** (see below), in which case it stays open until explicitly replaced by another `show()` call.

One instance is placed at app root — all other components use it by injecting `ToastService`.

### Persistent toasts (live progress)

`ToastService.show(type, message?, persist?)` — when `persist` is `true`, the toast does **not** auto-hide after `Duration`. This is used for live-progress use cases (e.g. the async Excel import job in `ExcelImportExportComponent` — see `EXCEL_IMPORT_EXPORT_CONTEXT.MD`), where the toast text is updated repeatedly via socket events until a final `show(type)` call (no `persist`) replaces it with a normal auto-hiding toast.

**Implementation detail:** `<ui5-toast>` has its **own internal `[duration]`** that auto-closes it independent of this component's `hideTimer` — binding `[duration]="Duration"` unconditionally would auto-close persistent toasts too. Fix: `isPersisting` flag drives `[duration]="isPersisting ? 86400000 : Duration"` (effectively infinite while persisting) and `CloseToast()` ignores the native `(close)` event while `isPersisting` is true.

## Inputs / Outputs

None. Service-driven only.

## Key Methods

| Method | Purpose |
|---|---|
| `ngOnInit()` | Subscribes to `ToastService.toast$`, maps type/message to display text, sets `isPersisting`, shows toast, schedules `hideTimer` only if not persisting |
| `CloseToast(e)` | Closes on native `ui5-toast` close event — no-op while `isPersisting` |
| `ngOnDestroy()` | Clears `hideTimer`, completes `destroy$` subject to unsubscribe |

## Internal State

| Property | Purpose |
|---|---|
| `IsOpenToast: boolean` | Toast visibility |
| `ToastMessage: string` | Resolved message text (payload `message` override, else `Message[type]`) |
| `Duration: number` | 3000 ms auto-close (non-persistent toasts) |
| `type: string` | Toast type key |
| `isPersisting: boolean` | True while the current toast is a live-progress toast (blocks native auto-close) |
| `hideTimer` (private) | Handle for the scheduled auto-hide `setTimeout`; cleared on every new toast and on destroy |

## Predefined Messages (i18n)

Keys: `save`, `delete`, `remove`, `edit`, `add`, `read`, `error`, `approve`, `import`, `export`, `download`, `password`, `exist`

## Template

```
ui5-toast [open] [duration] placement="BottomEnd"
  ui5-message-strip [design]="error ? 'Negative' : 'Positive'"
```

## How To Use

Inject `ToastService` in any component or service and call `show()` — do not push to `toast$` directly (it's `private`):
```ts
constructor(private toast: ToastService) {}

this.toast.show('save');                              // success, auto-hide
this.toast.show('error');                              // error (red), auto-hide
this.toast.show('error', 'Custom error text');          // auto-hide, custom message
this.toast.show('import', 'Syncing 12/500...', true);   // persistent — stays until replaced
this.toast.show('import');                              // replaces the persistent toast, auto-hides
```

Do not create multiple `app-toaster` instances — one global instance in `app.component.html` is enough.
