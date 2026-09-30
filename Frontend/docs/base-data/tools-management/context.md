# Base Data Management — Tools Management (Handling Units)

## Files
```
tools-management/
└── handling-units/
    ├── units-form/
    │   ├── units-form.component.ts
    │   └── units-form.component.html
    └── units-list/
        └── units-list.component.ts (or .tsx)
```

## Route
`/base-data/handling-units` — `UnitsListComponent` — guarded by `BASE_DATA_HANDING_UNITS`.

## Purpose
Manages **Handling Units** — packaging or tooling units used in production (e.g., pallets, trays, boxes, fixtures). These define how products are grouped or transported during manufacturing.

---

## UnitsFormComponent

### Selector
`app-units-form`

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
| `AddUnit()` | Validates form, then POSTs or PUTs the handling unit |
| `validateForm()` | Checks required fields |
| `CloseDialog()` | Resets model and closes dialog |

### API Calls

| Method | Endpoint | Trigger |
|--------|----------|---------|
| POST | `HandlingUnits` | `saveMode === 'POST'` |
| PUT | `HandlingUnits(${id})` | `saveMode === 'PUT'` |

### HandlingUnit Model (inferred)
```typescript
interface HandlingUnit {
  id?: number;
  name: string;
  code?: string;
  capacity?: number;
  description?: string;
  is_active: boolean;
}
```

---

## UnitsListComponent

| Field | Value |
|---|---|
| **TS file** | `src/app/modules/base-data-management/tools-management/handling-units/units-list/units-list.component.ts` |
| **HTML file** | `src/app/modules/base-data-management/tools-management/handling-units/units-list/units-list.component.html` |
| **Selector** | `app-units-list` |
| **Grid** | `app-ag-grid-table` (converted from `react-analytical-table` / `.tsx`) |

AG Grid list showing all handling units with:
- Add via toolbar New button → `UnitsFormComponent` dialog
- Edit via row click or inline edit button → `UnitsFormComponent` dialog
- Delete via inline delete button → `app-delete-entity`
- Permission-guarded actions

### ag-grid Config

| Property | Value |
|---|---|
| `gridId` | `base-data-handling-units-list` |
| `endpoint` | `HandlingUnits` |
| `searchFields` | `['name', 'custom_id']` |
| `pageSize` | `40` |
| `scrollPagination` | `true` |

### Columns

| Field | Header | Notes |
|---|---|---|
| `is_active` | Active | `AgGridBooleanCellRendererComponent` |
| `custom_id` | ID | |
| `name` | Unit Name | |
| `created_at` | Created On | `toLocaleDateString()` |
| `actions` | Actions | `AgGridActionCellRendererComponent` — edit + delete (permission-gated) |

### Outputs

| Output | Type | Purpose |
|---|---|---|
| `IsDelete` | `EventEmitter<string>` | `HandlingUnits/{id}` — consumed by `app-delete-entity` |
| `IsSuccessChange` | `EventEmitter<any>` | Emitted after form save or delete success |

---

## Services Injected

| Service | Usage |
|---------|-------|
| `RolePermissionService` | Action visibility + toolbar button guard |

## Validation Rules
- `name` — required

## Notes
- Handling unit count appears on the home dashboard via `$batch` under the `HandlingUnits` endpoint.
- The route permission key has a typo in the original code: `BASE_DATA_HANDING_UNITS` (missing 'L') — be aware when checking permissions.
- Used in production/warehouse workflows to define physical grouping of materials.
