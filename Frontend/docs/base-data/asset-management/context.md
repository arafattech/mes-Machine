# Base Data Management — Asset Management

## Files
```
asset-management/
├── asset-form/
│   ├── asset-form.component.ts
│   └── asset-form.component.html
├── asset-list/
│   └── asset-list.component.ts (or .tsx)
└── asset-group/
    ├── asset-group-form/
    │   ├── asset-group-form.component.ts
    │   └── asset-group-form.component.html
    └── asset-group-list/
```

## Routes
- `/base-data/asset-list` — `AssetListComponent` — guarded by `BASE_DATA_ASSET`
- `/base-data/asset-group` — `AssetGroupListComponent` — guarded by `BASE_DATA_ASSET_GROUP`

## Purpose
Manages physical **Assets** (equipment, tools, machinery assigned to the plant) and **Asset Groups** (categories for grouping assets). Both follow the standard form+list pattern.

---

## AssetFormComponent

### Selector
`app-asset-form`

### Inputs

| Input | Type | Purpose |
|-------|------|---------|
| `saveMode` | `string` | `'POST'` for create, `'PUT'` for edit |

### Outputs

| Output | Type | Purpose |
|--------|------|---------|
| `RefreshTable` | `EventEmitter<any>` | Fires after a successful save to reload the parent list |

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `asset` | `Asset` | The model being created or edited |
| `open` | `boolean` | Controls dialog visibility |
| `loading` | `boolean` | True during the API save call |
| `valueStateOptions` | `object` | SAP UI5 ValueState map for field validation feedback |

### Key Methods

| Method | Description |
|--------|-------------|
| `addAsset()` | Runs `validateForm()`, then calls POST or PUT depending on `saveMode`. Emits `RefreshTable` on success. |
| `checkValidation(event, field)` | Real-time validation — sets `ValueState.Negative` if field is empty, else `ValueState.None` |
| `validateForm()` | Pre-submit check — returns `false` and marks fields if any required field is empty |
| `CloseDialog()` | Resets `asset` model to defaults, sets `open = false` |

### API Calls

| Method | Endpoint | Trigger |
|--------|----------|---------|
| POST | `Assets` | `saveMode === 'POST'` |
| PUT | `Assets(${asset.id})` | `saveMode === 'PUT'` |

### Asset Model (inferred)
```typescript
interface Asset {
  id?: number;
  name: string;
  description?: string;
  asset_group_id?: number;
  is_active: boolean;
}
```

---

## AssetGroupFormComponent

### Selector
`app-asset-group-form`

### Inputs / Outputs
Same contract as `AssetFormComponent` — `saveMode` in, `RefreshTable` out.

### Key Methods
Same validation and save pattern as `AssetFormComponent`.

### API Calls

| Method | Endpoint | Trigger |
|--------|----------|---------|
| POST | `AssetGroups` | `saveMode === 'POST'` |
| PUT | `AssetGroups(${id})` | `saveMode === 'PUT'` |

### AssetGroup Model (inferred)
```typescript
interface AssetGroup {
  id?: number;
  name: string;
  description?: string;
  is_active: boolean;
}
```

---

## List Components

Both `AssetListComponent` and `AssetGroupListComponent` are standard grid/table components that:
- Fetch data via `GET Assets` / `GET AssetGroups` with OData filters
- Embed the respective form component for inline add/edit
- Support delete with confirmation
- Show Edit/Delete actions conditionally based on permissions

---

## Services Injected

| Service | Usage |
|---------|-------|
| `CommonService` | All CRUD API calls |
| `ToastService` | Success/error notifications |
| `RolePermissionService` | Permission-based action button visibility |

## Validation Rules
- `name` — required (both Asset and AssetGroup)
- All other fields are optional

## Notes
- Assets are linked to `AssetGroups` as a parent categorization.
- Employees can be assigned assets (see `employee-management` — `EmployeeHasAsset`).
- The `is_active` flag is used for soft-delete; inactive records are excluded from dropdowns elsewhere.
