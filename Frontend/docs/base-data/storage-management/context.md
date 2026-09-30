# Base Data Management — Storage Management

## Files
```
storage-management/
└── storage-location/
    ├── storage-location-form/
    │   ├── storage-location-form.component.ts
    │   └── storage-location-form.component.html
    └── location-list/
        └── location-list.component.ts (or .tsx)
```

## Route
`/base-data/storage-location` — `LocationListComponent` — guarded by `BASE_DATA_STORAGE_LOCATION`.

## Purpose
Manages **Storage Locations** — warehouse bin/rack/shelf definitions used for tracking inventory placement in the MES system.

---

## StorageLocationFormComponent

### Selector
`app-storage-location-form`

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
| `AddLocation()` | Validates form, then POSTs or PUTs the storage location |
| `validateForm()` | Checks required fields |
| `CloseDialog()` | Resets model and closes dialog |

### API Calls

| Method | Endpoint | Trigger |
|--------|----------|---------|
| POST | `StorageLocations` | `saveMode === 'POST'` |
| PUT | `StorageLocations(${id})` | `saveMode === 'PUT'` |

### StorageLocation Model (inferred)
```typescript
interface StorageLocation {
  id?: number;
  name: string;
  code?: string;
  description?: string;
  is_active: boolean;
}
```

---

## LocationListComponent

Standard list/grid showing all storage locations with:
- Add/Edit via `StorageLocationFormComponent`
- Delete with confirmation
- Permission-guarded actions

---

## Services Injected

| Service | Usage |
|---------|-------|
| `CommonService` | CRUD API calls |
| `ToastService` | Notifications |
| `RolePermissionService` | Action visibility |

## Validation Rules
- `name` — required

## Notes
- Storage location count appears on the home dashboard via `$batch`.
- Storage locations are used in inventory/warehouse modules to define where materials are stored.
- Simple entity — name-based reference data with optional code for barcode/QR integration.
