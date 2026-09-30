# Base Data Management — Capacity Management

## Files
```
capacity-management/
├── capacity-form/
│   ├── capacity-form.component.ts
│   └── capacity-form.component.html
└── capacity-list/
    ├── capacity-list.component.ts   ← ag-grid (converted from .tsx)
    └── capacity-list.component.html
```

## Route
`/base-data/capacity` — `CapacityListComponent` — guarded by `BASE_DATA_CAPACITY`.

## Purpose
Manages **Capacity** definitions — production capacity units used in manufacturing planning (e.g., "Shift A Capacity", "Line 1 Max Output"). These are simple name/value reference entities.

---

## CapacityFormComponent

### Selector
`app-capacity-form`

### Inputs

| Input | Type | Purpose |
|-------|------|---------|
| `saveMode` | `string` | `'POST'` for create, `'PUT'` for edit |
| `capacity` | `Capacity` | Pre-populated capacity model for edit mode |

### Outputs

| Output | Type | Purpose |
|--------|------|---------|
| `IsOpenToastAlert` | `EventEmitter<void>` | Fires to trigger a toast notification in the parent |
| `RefreshTable` | `EventEmitter<any>` | Fires after a successful save to reload the list |

### Key Methods

| Method | Description |
|--------|-------------|
| `AddCapacity()` | Validates form, then POSTs or PUTs the capacity. Emits both outputs on success. |
| `validateForm()` | Checks that `capacity.name` is not empty. Returns `false` if invalid. |

### API Calls

| Method | Endpoint | Trigger |
|--------|----------|---------|
| POST | `Capacities` | `saveMode === 'POST'` |
| PUT | `Capacities(${capacity.id})` | `saveMode === 'PUT'` |

### Capacity Model (inferred)
```typescript
interface Capacity {
  id?: number;
  name: string;
  description?: string;
  is_active: boolean;
}
```

---

## CapacityListComponent

ag-grid-table list component (converted from react-analytical-table):
- Fetches `GET Capacities` via `app-ag-grid-table` (`url="Capacities"`)
- Columns: `is_active` (bool icon), `custom_id` (ID), `name` (Capacity Name), `created_at`
- `gridId`: `base-data-capacity-list`
- Embeds `app-capacity-form` (opened via `@ViewChild`) for add/edit
- Supports delete via `app-delete-entity`
- Edit/Delete buttons shown conditionally via `BASE_DATA_CAPACITY_EDIT` / `BASE_DATA_CAPACITY_DELETE`
- Refresh via `agGridRef.refreshGridData(true)` after save or delete

---

## Services Injected

| Service | Usage |
|---------|-------|
| `CommonService` | CRUD HTTP calls |
| `ToastService` | User notifications |
| `RolePermissionService` | Action visibility |

## Validation Rules
- `name` — required (only validated field)

## Notes
- One of the simplest entities in the module — name-only reference data.
- `IsOpenToastAlert` output is an unusual pattern here (most forms just use `ToastService` directly). The parent list handles the toast trigger.
- Used as a reference/lookup in manufacturing planning contexts.
