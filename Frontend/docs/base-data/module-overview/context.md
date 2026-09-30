# Base Data Management Module — Overview

## Module Path
`src/app/modules/base-data-management/`

## Module File
`base-data-management.module.ts` — declares 49 components across all feature areas.

## Routing Module
`base-data-management-routing.module.ts`
- Base route: `/base-data`
- All routes are guarded by `PermissionGuard` with `BASE_DATA_*` permission strings.

## Route Table

| Path | Component | Permission Key |
|------|-----------|----------------|
| `` (default) | HomeDataManagementComponent | BASE_DATA_ADMIN |
| `products` | ProductListComponent | BASE_DATA_ITEM |
| `product-type` | ProductTypeListComponent | BASE_DATA_ITEM_TYPE_LIST |
| `item-categories` | ItemCategoryListComponent | BASE_DATA_ITEM_CATEGORIES |
| `item-subcategories` | SubCategoryListComponent | BASE_DATA_ITEM_SUBCATEGORIES |
| `item-variants` | ItemVariantsComponent | BASE_DATA_ITEM_VARIANTS_LIST |
| `uom-list` | UomListComponent | BASE_DATA_UOM_LIST |
| `employees` | EmployeeListComponent | BASE_DATA_EMPLOYEE |
| `machines` | MachineManagementComponent | BASE_DATA_MACHINE |
| `machine-config` | MachineConfigComponent | BASE_DATA_MACHINE_CONFIG |
| `machine-group` | MachineGroupListComponent | BASE_DATA_MACHINE_GROUP |
| `machine-state` | MachineStateListComponent | BASE_DATA_MACHINE_STATE |
| `plants` | PlanningManagementComponent | BASE_DATA_PLANT |
| `hall` | HallListComponent | BASE_DATA_HALL |
| `client` | ClientManagementComponent | BASE_DATA_CLIENT |
| `client-area` | AreaListComponent | BASE_DATA_CLIENT_AREAS |
| `client-note` | NotesListComponent | BASE_DATA_CLIENT_NOTE |
| `roles-permissions` | RolePermissionListComponent | BASE_DATA_ROLE_PERMISSION |
| `user-management` | UserListComponent | BASE_DATA_USER_LIST |
| `supplier` | SupplierListComponent | BASE_DATA_SUPPLIER |
| `supplier-bank` | BankDetailsListComponent | BASE_DATA_SUPPLIER_BANK_DETAILS |
| `activity-log` | LogListComponent | BASE_DATA_ACTIVITY_LOG |
| `operations` | OparationManagementListComponent | BASE_DATA_OPERATION |
| `operation-info/:id` | OperationManagementInfoComponent | BASE_DATA_OPERATION_INFO |
| `storage-location` | LocationListComponent | BASE_DATA_STORAGE_LOCATION |
| `handling-units` | UnitsListComponent | BASE_DATA_HANDING_UNITS |
| `capacity` | CapacityListComponent | BASE_DATA_CAPACITY |
| `asset-list` | AssetListComponent | BASE_DATA_ASSET |
| `asset-group` | AssetGroupListComponent | BASE_DATA_ASSET_GROUP |
| `departments` | DepartmentManagementComponent | BASE_DATA_DEPARTMENT |

## Feature Areas

| Area | Purpose |
|------|---------|
| **home** | Dashboard with aggregate counts for all entities |
| **activity-management** | System-wide activity/audit log viewer |
| **asset-management** | Physical assets and asset groups |
| **capacity-management** | Production capacity definitions |
| **client-management** | Customers with areas, notes, contacts |
| **department-management** | Organizational departments |
| **employee-management** | Employee records, bank info, assets, shifts, salary |
| **machine-management** | Machines, configs, groups, states, halls |
| **operation-management** | Production operations and positions |
| **plant-management** | Physical plants/sites |
| **product-management** | Products, categories, sub-categories, UOM, variants |
| **role-permission-management** | Roles and permission assignments |
| **storage-management** | Warehouse storage locations |
| **supplier-management** | Vendors with bank and cash payment details |
| **tools-management** | Handling units (packaging/tooling) |
| **user-management** | System user accounts |

## Common Services Injected Across Module

| Service | Purpose |
|---------|---------|
| `CommonService` | OData/HTTP operations — all CRUD calls |
| `ToastService` | UI notifications (add, edit, delete, error, approve) |
| `RolePermissionService` | `getAllPermissionsStatus()` returns `{ [key]: boolean }` |
| `DateFormatterService` | Date formatting utilities |
| `MediaService` | File/media handling (employee form) |
| `ChangeDetectorRef` | Manual change detection for React-wrapped components |

## Shared Model
`shared/model/MachineConfig.ts` — see machine-management context for full details.

## Common Patterns

### Form Component Pattern
Every CRUD form in this module follows the same contract:
- **Input:** `saveMode: string` ('POST' | 'PUT'), optional pre-populated entity model
- **Output:** `RefreshTable: EventEmitter<any>` fired after successful save
- **State:** `open: boolean`, `loading: boolean`, `valueStateOptions`
- **Methods:** `checkValidation(event, field)`, `validateForm()`, save method, `CloseDialog()`
- **API:** POST for create, PUT for `Entity(${id})` for update via `CommonService`

### Validation Pattern
- **Real-time:** `checkValidation(event, field)` sets `ValueState.Negative` or `ValueState.None` on the input
- **Pre-submit:** `validateForm()` checks all required fields and returns `boolean`
- Failed validation shows SAP UI5 `ValueState.Negative` on relevant inputs

### OData Query Pattern
```
GET /odata/Entity?$orderby=id desc&$filter=is_active eq true   ← dropdowns
GET /odata/Entity?$count=true                                   ← counts
GET /odata/Entity(id)                                           ← single fetch
POST /odata/Entity                                              ← create
PUT  /odata/Entity(id)                                          ← update
DELETE /odata/Entity(id)                                        ← soft/hard delete
POST /$batch                                                    ← bulk operations
```

### Technology Mix
Most list components are React/TSX wrapped inside Angular shell components. Form components may be pure Angular (`.ts`) or React (`.tsx`). The module uses SAP UI5 Web Components (`@ui5/webcomponents-react`) for UI elements.

## Key Enums & Types (global to module)

```typescript
enum saveMode { POST = 'POST', PUT = 'PUT' }
enum ValueState { None = 'None', Negative = 'Negative' }
enum Permissions { 
  BASE_DATA_ADMIN, BASE_DATA_ITEM, BASE_DATA_EMPLOYEE, ...
}
enum ModeOfPayment { CASH = 'CASH', BANK_TRANSFER = 'BANK_TRANSFER' }
```
