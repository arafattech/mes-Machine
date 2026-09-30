# HR Management — Assets List (Master/Detail Asset View)

## Files
```
asset-management/assets-list/
└── assets-list.component.ts    ← Angular component
└── assets-list.component.html  ← Template
└── assets-list.component.scss
```

## Route
`/hr-management/asset-management/assets-list` — `AssetsListComponent` (declared in `hr-management.module.ts`).

## Purpose
Master/detail view over `Assets`: left grid lists assets, right grid lists the employees currently
holding the selected asset (from `Assets?$expand=employeeHasAssets($expand=employee)`). This is a
**read-only browse view** — asset name/active-status CRUD lives in the base-data module
(`base-data-management/asset-management/asset-list`); this screen reuses that module's
`AssetFormComponent` only for the "New" button (create), not for editing/deleting existing rows.

## Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `assetDataSource` | `AgGridTableODataSourceConfig` | Left grid — `Assets`, expands `employeeHasAssets($expand=employee)` |
| `employeeDataSource` | `AgGridTableODataSourceConfig` | Right grid — **not** OData-backed; `staticData: true` with a client-built `data` array (see `onAssetRowClick`) |
| `selectedAsset` | `any` | Currently selected left-grid row, drives the right grid + the read-only detail dialog |
| `isListCollapsed` / `isTabCollapsed` | `boolean` | Toggle the left/right panel widths (`onCLickListCollapsed`/`onCLickTabCollapsed`) — the panel-toggle avatar button flips `isTabCollapsed` |
| `EmployeeAssetsList` | `EmployeeHasAsset` | Deserialized row backing the read-only "Details" dialog (`isViewOpen`), populated by `viewEmployeesList(data)` |
| `saveMode` | `string` | `saveMode.POST`/`PUT` passed to the reused `<app-asset-form>` — this screen only ever sets it to `POST` (see `newAsset()`) |
| `assetsFormRef` | `AssetFormComponent` (`@ViewChild`) | The reused base-data asset form dialog — parent sets `.open`/`.asset` directly on the child instance (no `[isOpen]`/`(close)` API on that component, see below) |

## Key Methods

| Method | Description |
|--------|--------------|
| `onAssetRowClick(row)` | Builds the right grid's static employee rows from `row.employeeHasAssets`, updates the header title with the count, expands the right panel |
| `onAssetDataLoaded(count)` | Auto-selects the first row of the left grid on initial load (via `getGridApi().getDisplayedRowAtIndex(0)`) so the right panel isn't empty on first paint |
| `viewEmployeesList(data)` / `CloseDialog()` | Open/close the read-only per-assignment detail dialog (note, issued/return date, remarks) |
| `newAsset()` | Sets `saveMode = POST`, opens `assetsFormRef` (`assetsFormRef.open = true`) — reuses base-data's create dialog |
| `processData()` | `(RefreshTable)` handler for `<app-asset-form>` — refreshes the left grid (`assetTableRef?.refreshGridData(true)`) after a successful create |

## Reusing `AssetFormComponent` across modules
`AssetFormComponent` lives under `base-data-management/asset-management/asset-form/` and is declared
in `BaseDataManagementModule`. To use it here, `BaseDataManagementModule` now **exports**
`AssetFormComponent`, and `HrDataManagementModule` imports `BaseDataManagementModule` (same pattern
already used for `StoreManagementModule`/`SalesManagementModule` in that module's `imports` array).

The form itself has no `[isOpen]`/`(close)`/`(success)` API — visibility is a public `open: boolean`
property and the edit target is a public `asset: Asset` property, both set imperatively by the parent
via `@ViewChild`:
```ts
@ViewChild('assetsForm') assetsFormRef!: AssetFormComponent;
newAsset(): void {
  this.assetsFormRef.open = true;
  this.saveMode = saveMode.POST;
}
```
```html
<app-asset-form #assetsForm [saveMode]="saveMode" (RefreshTable)="processData($event)"></app-asset-form>
```
This mirrors `base-data-management/asset-management/asset-list/asset-list.component.ts` exactly — see
that file if extending this screen to also support edit (`assetsFormRef.asset = data` before opening).

## Notes
- The right grid (`employeeDataSource`) is **not** independently paginated/filtered server-side — it's
  a plain in-memory array rebuilt on every left-grid row click, sized to however many
  `employeeHasAssets` came back on the expand. Fine at current per-asset assignment counts; would need
  a real OData-backed grid if a single asset could accumulate very large employee counts.
- `assetColumns` intentionally stays minimal (`name`, `created_at`) — richer asset metadata
  (`custom_id`, `is_active`) is base-data's concern; this screen is about "who has what", not asset
  administration.
