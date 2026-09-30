# AngularEditorComponent

**Selector:** `app-angular-editor`
**File:** `src/app/shared/components/angular-editor/angular-editor.component.ts`
**Standalone:** No (declared in parent module)
**CVA:** Implements `ControlValueAccessor`

## What It Does

Thin wrapper around `@kolkov/angular-editor` WYSIWYG editor. Integrates with Angular reactive and template-driven forms via `ControlValueAccessor`. Supports read-only mode.

## Inputs

| Input | Type | Default | Purpose |
|---|---|---|---|
| `isReadonly` | `boolean` | `false` | Disables editing when `true` |
| `editorConfig` | `AngularEditorConfig` | 200px height, Arial, spellcheck on | Editor toolbar configuration |

## ControlValueAccessor API

| Method | Purpose |
|---|---|
| `writeValue(value)` | Sets editor HTML content from form control |
| `registerOnChange(fn)` | Registers change propagation callback |
| `registerOnTouched(fn)` | Registers touched callback |
| `onContentChange(event)` | Fires on editor change, calls `onChange` |

## Computed Property

`get resolvedEditorConfig()` — merges `editorConfig` with `{ editable: !isReadonly }`. Always use this for binding, not `editorConfig` directly.

## Usage Pattern

**Reactive forms:**
```html
<app-angular-editor [formControl]="descriptionCtrl" [isReadonly]="viewMode"></app-angular-editor>
```

**Template-driven:**
```html
<app-angular-editor [(ngModel)]="description" [isReadonly]="false"></app-angular-editor>
```

## Notes

- `isReadonly` prevents editing without changing visual appearance.
- Default height 200px. Override via `editorConfig` input.
- Requires `@kolkov/angular-editor` CSS imported globally.
