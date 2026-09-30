# Base Data Management — Plant Management

## Files
```
plant-management/
├── plant-form/
│   ├── plant-form.component.ts
│   └── plant-form.component.html
└── planning-management/
    └── planning-management.component.ts (or .tsx)
```

## Route
`/base-data/plants` — `PlanningManagementComponent` — guarded by `BASE_DATA_PLANT`.

Also related:
- `/base-data/hall` — `HallListComponent` — guarded by `BASE_DATA_HALL` (halls belong to plants).

## Purpose
Manages **Plants** — physical manufacturing sites or facilities. Halls (sub-areas within a plant) are managed separately but reference a plant. Plants are used as location reference data across the MES system.

---

## PlantFormComponent

### Selector
`app-plant-form`

### Inputs

| Input | Type | Purpose |
|-------|------|---------|
| `saveMode` | `string` | `'POST'` or `'PUT'` |

### Outputs

| Output | Type | Purpose |
|--------|------|---------|
| `RefreshTable` | `EventEmitter<any>` | Fires after successful save |

### Key Methods

| Method | Description |
|--------|-------------|
| `onSaveType()` | Validates form, then POSTs or PUTs the plant entity |
| `validateForm()` | Checks required fields |
| `CloseDialog()` | Resets model, closes dialog |

### API Calls

| Method | Endpoint | Trigger |
|--------|----------|---------|
| POST | `Plants` | `saveMode === 'POST'` |
| PUT | `Plants(${id})` | `saveMode === 'PUT'` |

### Plant Model (inferred)
```typescript
interface Plant {
  id?: number;
  name: string;
  code?: string;
  address?: string;
  is_active: boolean;
}
```

---

## HallListComponent (related)

### Purpose
Manages production halls within a plant. Each hall belongs to a plant and is used for machine location assignment in `MachineFormComponent`.

### API Calls (inferred)
| Method | Endpoint |
|--------|----------|
| GET | `Halls?$orderby=id desc&$filter=is_active eq true` |
| POST | `Halls` |
| PUT | `Halls(${id})` |
| DELETE | `Halls(${id})` |

### Hall Model (inferred)
```typescript
interface Hall {
  id?: number;
  name: string;
  plant_id?: number;
  is_active: boolean;
}
```

---

## Services Injected

| Service | Usage |
|---------|-------|
| `CommonService` | CRUD API calls |
| `ToastService` | Notifications |
| `RolePermissionService` | Action visibility |

## Validation Rules
- `name` — required for both Plant and Hall

## Key Relationships
- Plant → has many Halls
- Hall → associated to Machines (via `machine/associate`)
- Plant → used as location reference in production orders and operations

## Notes
- Plants and Halls are fundamental location data — they should be created early in system setup.
- Hall records appear in `MachineFormComponent`'s hall association dialog (`hallAssociateRef`).
