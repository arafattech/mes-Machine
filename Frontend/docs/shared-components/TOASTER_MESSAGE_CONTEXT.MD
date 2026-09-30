# ToasterMessageComponent

**Selector:** `app-toaster-message`
**File:** `src/app/shared/components/toaster-message/toaster-message.component.ts`
**Standalone:** Yes
**Imports:** `CommonModule`, `ToastComponent` (UI5), `MessageStripComponent` (UI5)

## What It Does

Feature-level toast notification. Unlike `ToasterComponent` (service-driven, global), this one is controlled directly via inputs and an EventEmitter trigger. Used when a specific feature needs its own toast without going through `ToastService`.

## Inputs

| Input | Type | Default | Purpose |
|---|---|---|---|
| `IsOpenToastAlert` | `EventEmitter<void>` | — | Trigger to show toast |
| `IsOpenToast` | `boolean` | `false` | Direct visibility flag |
| `ToastMessage` | `string` | `''` | Custom message override |
| `ToastType` | `string` | `''` | Key to resolve predefined message |

## Outputs

None.

## Key Methods

| Method | Purpose |
|---|---|
| `ngOnInit()` | Subscribes to `IsOpenToastAlert`, maps `ToastType` to message string |
| `CloseToast(e)` | Closes toast |

## Duration

Read from `CommonService.ToastDuration` (not hardcoded to 3000ms like `ToasterComponent`).

## Predefined Messages (i18n)

Keys: `delete`, `remove`, `edit`, `add`, `read`, `error`, `approve`, `import`, `export`, `save`, `exist`

## Difference vs ToasterComponent

| | `app-toaster` | `app-toaster-message` |
|---|---|---|
| Driven by | `ToastService` (global) | EventEmitter input (local) |
| Instances | One global | One per feature |
| Duration | 3000 ms hardcoded | `CommonService.ToastDuration` |
| Use case | App-wide notifications | Per-feature dialogs/forms |

## Usage Pattern

```html
<app-toaster-message
  [IsOpenToastAlert]="toastEmitter"
  [ToastType]="'save'"
></app-toaster-message>
```

Trigger: `toastEmitter.emit()`.

With custom message:
```html
<app-toaster-message
  [IsOpenToastAlert]="toastEmitter"
  [ToastMessage]="'Custom success message'"
  [ToastType]="'save'"
></app-toaster-message>
```
