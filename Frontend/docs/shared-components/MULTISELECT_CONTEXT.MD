# MultiselectComponent

**Selector:** `app-multiselect`
**File:** `src/app/shared/components/multiselect/multiselect.component.ts`
**Standalone:** Yes — `CUSTOM_ELEMENTS_SCHEMA`
**CVA:** Implements `ControlValueAccessor`
**Imports:** `CommonModule`, `FormsModule`

## What It Does

Multi-select dropdown integrated with Angular reactive/template-driven forms via `ControlValueAccessor`. Renders a UI5 `MultiComboBox` with a "Select All" option. Emits selected item IDs as a `string[]` to the parent form control.

## Inputs

| Input | Type | Purpose |
|---|---|---|
| `items` | `any[]` | Array of `{ id, name }` selectable items |

## Outputs

None (values flow through CVA).

## ControlValueAccessor Methods

| Method | Purpose |
|---|---|
| `writeValue(value)` | Sets `selectedItems` from form control value |
| `registerOnChange(fn)` | Registers change propagation |
| `registerOnTouched(fn)` | Registers touched callback |
| `setDisabledState(isDisabled)` | Enables/disables component |
| `updateValue(event)` | Extracts selected item IDs, calls `onChange` and `onTouched` |

## Internal State

| Property | Purpose |
|---|---|
| `selectedItems: string[]` | Currently selected item IDs |
| `disabled: boolean` | Component disabled state |

## Usage Pattern

**Reactive forms:**
```html
<app-multiselect
  [items]="departments"
  [formControl]="deptControl"
></app-multiselect>
```

**Template-driven:**
```html
<app-multiselect [items]="roles" [(ngModel)]="selectedRoles"></app-multiselect>
```

Items format: `[{ id: 1, name: 'HR' }, { id: 2, name: 'Finance' }]`
Emits: `['1', '2']` (IDs as strings).
