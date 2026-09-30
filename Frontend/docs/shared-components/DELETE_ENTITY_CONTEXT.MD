# DeleteEntityComponent

**Selector:** `app-delete-entity`
**File:** `src/app/shared/components/delete-entity/delete-entity.component.ts`
**Standalone:** Yes
**Imports:** `Ui5MainModule`, `CommonModule`, `ToasterComponent`

## What It Does

Reusable confirmation dialog for deleting a single entity. Receives a DELETE API URL via `IsDelete` EventEmitter, shows a "Critical" warning dialog, executes the HTTP DELETE, shows a toast, then emits success.

## Inputs

| Input | Type | Default | Purpose |
|---|---|---|---|
| `IsDelete` | `EventEmitter<any>` | — | Receives API URL string to trigger dialog open |
| `IsOdata` | `boolean` | `false` | OData vs REST delete mode |

## Outputs

| Output | Emits | When |
|---|---|---|
| `isSuccess` | `void` | Delete API call succeeded |
| `IsOpenToastAlert` | `void` | (declared, unused in template) |

## Flow

1. Parent emits DELETE URL to `IsDelete` input → dialog opens.
2. User clicks **Delete** → `Delete()` calls `CommonService.delete(ApiUrl)`.
3. On success: shows toast, emits `isSuccess`, closes dialog.
4. On error or **Cancel**: closes dialog, shows error toast.

## Key Methods

| Method | Purpose |
|---|---|
| `Delete()` | Executes HTTP DELETE, handles success/error |
| `closeDialog()` | Closes dialog, resets `IsLoading` |

## Internal State

| Property | Purpose |
|---|---|
| `open: boolean` | Dialog visibility |
| `IsLoading: boolean` | Spinner during DELETE call |
| `ApiUrl: string` | Stored URL from `IsDelete` trigger |

## Usage Pattern

```html
<app-delete-entity
  [IsDelete]="deleteEmitter"
  (isSuccess)="onDeleted()"
></app-delete-entity>
```

Trigger: `deleteEmitter.emit('/api/employees/42')`.

Subscribe to `isSuccess` to refresh the parent table.
