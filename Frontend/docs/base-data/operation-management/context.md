# Base Data Management — Operation Management

## Files
```
oparation-management/                  ← note: typo in folder name (missing 'e')
├── operation-management-list/
│   └── oparation-management-list.component.ts (or .tsx)
└── operation-management-info/
    ├── operation-management-info.component.ts   ← parent page
    └── operation-management-info-form/
        ├── operation-management-info-form.component.ts
        └── operation-management-info-form.component.html
```

## Routes
- `/base-data/operations` — `OparationManagementListComponent` — `BASE_DATA_OPERATION`
- `/base-data/operation-info/:id` — `OperationManagementInfoComponent` — `BASE_DATA_OPERATION_INFO`

## Purpose
Manages **Operations** — manufacturing process steps — and their **Operation Positions**, which define which product is made on which machine at each operation step.

---

## OparationManagementListComponent

### Purpose
Lists all operations. Supports creating and editing operation records. Clicking an operation navigates to `operation-info/:id` for managing its positions.

### AG Grid dataSource
```typescript
type: 'odata',
endpoint: 'Operations',
expand: 'products',
searchFields: ['operation_name', 'custom_id', 'products.product_name'],
pageSize: 40,
```
Grid columns: Active, ID (custom_id), Operation Name, Cycle Time, Item Name (products.product_name via valueGetter). Search covers operation_name, custom_id, and linked product name.

### Operation Model
```typescript
interface Operation {
  id?: number;
  operation_name: string;   // note: field name is operation_name, not name
  custom_id?: string;
  standard_cycle_time?: number;
  is_active: boolean;
  products?: Product;       // expanded relation
}
```

---

## OperationManagementInfoComponent (parent page)

### Route Parameter
- `:id` — the operation ID whose positions are being managed

### Purpose
Container page for a single operation's positions. Displays all `OperationPosition` records for the given operation and embeds `OperationManagementInfoFormComponent` for add/edit.

### Inferred API Calls
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `OperationPositions?$filter=operation_id eq ${id}` | Load positions for this operation |
| DELETE | `OperationPositions(${id})` | Delete a position |

---

## OperationManagementInfoFormComponent

### Selector
`app-operation-management-info-form`

### Inputs

| Input | Type | Purpose |
|-------|------|---------|
| `saveMode` | `string` | `'POST'` or `'PUT'` |

### Outputs

| Output | Type | Purpose |
|--------|------|---------|
| `RefreshTable` | `EventEmitter<any>` | Reload position list after save |

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `operationPosition` | `OperationPosition` | Position model being created/edited |
| `products` | `Product[]` | Available products for the dropdown |
| `machines` | `Machine[]` | Available machines for the dropdown |
| `selectedProductId` | `number \| null` | Selected product ID |
| `selectedMachineId` | `number \| null` | Selected machine ID |
| `operationId` | `number \| null` | Parent operation ID (from route param) |

### Key Methods

| Method | Description |
|--------|-------------|
| `saveOperationInfo()` | Validates form, sets `operation_id` from route, saves position |
| `getProducts()` | `GET Products?$filter=is_active eq true` |
| `getMachines()` | `GET Machines?$filter=is_active eq true` |
| `SelctedProduct(data)` | Sets `selectedProductId` and `operationPosition.product_id` from dropdown event |
| `SelctedMachine(data)` | Sets `selectedMachineId` and `operationPosition.machine_id` from dropdown event |
| `validateForm()` | Requires at minimum `product_id` and `machine_id` |

### API Calls

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `Products?$orderby=id desc&$filter=is_active eq true` | Product dropdown |
| GET | `Machines?$orderby=id desc&$filter=is_active eq true` | Machine dropdown |
| POST | `OperationPositions` | Create position |
| PUT | `OperationPositions(${id})` | Update position |

### OperationPosition Model (inferred)
```typescript
interface OperationPosition {
  id?: number;
  operation_id: number;    // set from route param `:id`
  product_id: number;      // required
  machine_id: number;      // required
  position?: number;       // sequence/order within operation
  description?: string;
  is_active: boolean;
}
```

---

## Services Injected

| Service | Usage |
|---------|-------|
| `CommonService` | All API calls |
| `ToastService` | Notifications |
| `RolePermissionService` | Action visibility |

## Validation Rules

| Component | Required Fields |
|-----------|----------------|
| OperationForm | `name` |
| OperationPositionForm | `product_id`, `machine_id` |

## Key Relationships
- Operation → has many OperationPositions
- OperationPosition → belongs to Product
- OperationPosition → belongs to Machine
- Operations → count shown on home dashboard

## Navigation Flow
```
/base-data/operations
  └── [click row] → /base-data/operation-info/:id
                        └── OperationManagementInfoFormComponent (add/edit positions)
```

## Notes
- The folder is named `oparation-management` (typo — missing 'e') — this is consistent across all files in this area; do not rename unless doing a full refactor.
- `operationId` in the form comes from the parent route param — the form reads it from the activated route or receives it as an input from the parent page.
- Operation count appears on the home dashboard via `$batch`.
