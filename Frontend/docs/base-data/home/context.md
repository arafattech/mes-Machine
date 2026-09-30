# Base Data Management — Home / Dashboard Component

## Files
- `home-data-management/home-data-management.component.ts`
- `home-data-management/home-data-management.component.html`

## Selector
`app-home-data-management`

## Route
`/base-data` (default/index route) — guarded by `BASE_DATA_ADMIN`.

## Purpose
Landing dashboard for the Base Data module. Fetches entity counts for all major entities in a single OData `$batch` request and displays them as icon-based navigation cards.

## Inputs / Outputs
None — self-contained dashboard.

## Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `CountData` | `object` | Raw count response from batch API |
| `IsLoading` | `boolean` | Controls loading state of the cards |
| `CountArray` | `any[]` | Transformed array of `{ label, count, route, icon }` objects for card rendering |
| `permissions` | `{ [key: string]: boolean }` | User permissions — conditionally shows cards |

## Key Methods

| Method | Description |
|--------|-------------|
| `ngOnInit()` | Loads permissions, then calls `GetCountValue()` |
| `GetCountValue()` | Sets `IsLoading = true`, calls `BatchApi()` and passes payload to `CommonService.$batch` |
| `BatchApi()` | Constructs OData `$batch` multipart payload for all entity count queries |

## API Calls

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `$batch` | Single batch request containing all count sub-requests |

### Batch Sub-requests (all `$count=true`)
- `/odata/Products`
- `/odata/Employees`
- `/odata/Clients`
- `/odata/Machines`
- `/odata/Plants`
- `/odata/Suppliers`
- `/odata/StorageLocations`
- `/odata/Operations`
- `/odata/HandlingUnits`
- `/odata/Assets`

## Template Structure
```
<app-home-data-management>
  └── Card Grid
      └── Card[] (per entity)
          ├── Icon
          ├── Entity Name
          ├── Count (from CountArray)
          └── RouterLink → detail route
```

## Services Injected

| Service | Usage |
|---------|-------|
| `CommonService` | Executes the `$batch` HTTP call |
| `RolePermissionService` | `getAllPermissionsStatus()` for conditional card display |

## Notes
- Uses a single `$batch` call to avoid N parallel HTTP requests on load — important for performance.
- Each card is only rendered if the corresponding `BASE_DATA_*` permission is true.
- `IsLoading` shows a skeleton/spinner until the batch response resolves.
