# UomFormComponent

## Files
```
uom/uom-form/
├── uom-form.component.ts
├── uom-form.component.html
└── uom-form.component.scss
```

## Selector
`app-uom-form`

## Inputs
| Input | Type | Default | Purpose |
|-------|------|---------|---------|
| `saveMode` | `string` | `'POST'` | `'POST'` = create, `'PUT'` = update |
| `uom` | `Uom` | empty `Uom` | Data bound to form fields |

## Outputs
| Output | Payload | Purpose |
|--------|---------|---------|
| `UomAdded` | `Uom` | Emits new UOM — for inline creation in product/variant form dropdowns |
| `RefreshTable` | `any` | Triggers list reload after save |

## Key Properties
| Property | Purpose |
|----------|---------|
| `open` | Controls `ui5-dialog` visibility |
| `loading` | Busy state during API call |
| `valueStateOptions.name` | Validation state for name field |

## Key Methods
| Method | Description |
|--------|-------------|
| `onSaveType()` | Validates then POST/PUT to API |
| `validateForm()` | Requires `name` |
| `checkValidation(event)` | Live validation on input |
| `CloseDialog()` | Resets form + closes dialog |

## API Calls
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `Uoms` | Create UOM |
| PUT | `Uoms(${id})` | Update UOM |

## Uom Model
```typescript
interface Uom {
  id?: number;
  name: string;         // e.g. "kg", "pcs", "litre"
  abbreviation?: string;
  is_active: boolean;
}
```

## Services Injected
| Service | Usage |
|---------|-------|
| `CommonService` | POST / PUT calls |
| `ToastService` | Success / error notifications |

## Validation
| Field | Rule |
|-------|------|
| `name` | Required (non-empty string) |

## Notes
- `UomAdded` output allows inline UOM creation from within product form — same pattern as `CatAdded` on `CategoryFormComponent`.
- Dialog uses `ui5-dialog` with `ui5-busy-indicator` during save.
