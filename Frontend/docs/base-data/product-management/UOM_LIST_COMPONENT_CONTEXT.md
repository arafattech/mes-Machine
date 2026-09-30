# UomListComponent

## Files
```
uom/uom-list/
├── uom-list.component.ts    ← converted from .tsx to ag-grid
├── uom-list.component.html
└── uom-list.component.scss
```

## Selector
`app-uom-list`

## Outputs
| Output | Payload | Purpose |
|--------|---------|---------|
| `IsDelete` | `string` (e.g. `"Uoms/5"`) | Passed to `app-delete-entity` for confirmation + DELETE |

## Key Properties
| Property | Purpose |
|----------|---------|
| `gridId` | `'base-data-uom-list'` — identifies this grid for column state persistence |
| `columns` | `AgGridTableColumn<any>[]` built from `buildColumns()` |
| `uom` | Bound to `app-uom-form` — populated on new/edit |
| `saveMode` | `'POST'` or `'PUT'` passed to form |

## ag-grid Table Config
| Input | Value |
|-------|-------|
| `url` | `Uoms` |
| `searchFields` | `['name', 'custom_id']` |
| `limit` | `50` |
| `isBase` | `true` |
| `gridHeight` | `calc(100vh - 118px)` |
| `showNewButton` | guarded by `BASE_DATA_UOM_CREATE` permission |
| `showAction` | `true` (row actions via `AgGridActionCellRendererComponent`) |

## Columns
| Field | Header | Notes |
|-------|--------|-------|
| `is_active` | Active | `AgGridBooleanCellRendererComponent` |
| `custom_id` | ID | |
| `name` | Name | |
| `created_at` | Created On | formatted via `toLocaleDateString()` |
| `actions` | Actions | pinned right; edit + delete guarded by permissions |

## Key Methods
| Method | Description |
|--------|-------------|
| `newUom()` | Resets form, sets POST mode, opens dialog |
| `editUom(data)` | Deserializes row, sets PUT mode, opens dialog |
| `processData()` | Calls `agGridRef.refreshGridData(true)` to reload grid |

## Template Components
| Component | Purpose |
|-----------|---------|
| `app-ag-grid-table` | Main data grid (replaces `react-analytical-table`) |
| `app-delete-entity` | Confirmation dialog + DELETE call |
| `app-uom-form` | Create / edit dialog |

## Permissions Used
| Permission | Guards |
|------------|--------|
| `BASE_DATA_UOM_CREATE` | New button |
| `BASE_DATA_UOM_EDIT` | Edit row action |
| `BASE_DATA_UOM_DELETE` | Delete row action |

## Services Injected
| Service | Usage |
|---------|-------|
| `RolePermissionService` | Permission checks |

## Conversion Notes
- Previously used `react-analytical-table` (`.tsx`) — converted to `app-ag-grid-table` (`.ts`).
- JSX column Cell renderers replaced by `AgGridBooleanCellRendererComponent` and `AgGridActionCellRendererComponent`.
- `refreshTable` EventEmitter removed — grid self-refreshes via `agGridRef.refreshGridData(true)`.
