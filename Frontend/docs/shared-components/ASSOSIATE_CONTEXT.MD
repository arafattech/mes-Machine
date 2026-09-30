# AssosiateComponent

**Selector:** `app-assosiate`
**File:** `src/app/shared/components/assosiate/assosiate.component.ts`
**Standalone:** Yes — `CUSTOM_ELEMENTS_SCHEMA`

## What It Does

Generic modal picker dialog for selecting one or more entities from an OData-backed list. Supports search with debounce, infinite scroll pagination, multi/single select, and optional inline item creation for `ProductTypes` and `ItemCategories`.

## Inputs

| Input | Type | Default | Purpose |
|---|---|---|---|
| `isOpen` | `EventEmitter<void>` | — | Trigger to open dialog |
| `apiUrl` | `string` | `''` | OData endpoint |
| `orderByColumn` | `string` | `'created_at'` | Default sort column |
| `openModal` | `boolean` | `false` | Alternate open flag |
| `getAssociateData` | `EventEmitter<any>` | — | Pre-load data feed |
| `isMultiselect` | `boolean` | `true` | Multi vs single select |
| `isAddMore` | `boolean` | `false` | Show "Add" button |
| `model` | `any` | — | Deserializable model class |
| `tableColumn` | `any` | — | Column definitions |
| `filterQuery` | `any` | — | OData filter fragment appended to search |

## Outputs

| Output | Emits | When |
|---|---|---|
| `close` | `void` | Dialog closed |
| `selectedData` | `any` (bindingData array) | Assign button clicked |
| `IsInsert` | `any` | Add clicked for ProductTypes |
| `IsInsertCategory` | `any` | Add clicked for ItemCategories |

## Key Methods

| Method | Purpose |
|---|---|
| `getInitialData()` | Fetches paginated OData list |
| `handleSearch(event)` | 400 ms debounce → `filterData()` |
| `filterData(filter)` | Builds OData `$filter` across `tableColumn` searchable fields, applies `filterQuery`, reloads |
| `onScroll(event)` | Infinite scroll: load next page on near-bottom |
| `isSelected(item)` | Checks if item in `bindingData` |
| `SelectionChange($event)` | Merges visible-list checkbox state into `bindingData`, keeping items selected outside the current search/page untouched |
| `SelectAll()` / `DselectAll()` | Bulk select/deselect — same merge-by-id pattern, only affects currently visible rows |
| `Assign()` | Emits `selectedData` with current selection, closes dialog (also resets search state) |
| `onRefreshTable()` | Resets pagination and reloads |

## State

- `bindingData: any[]` — currently selected items (persists across search/page changes; only merged, never overwritten).
- `GetAssociateData: any[]` — items loaded for the *currently visible* page/search (not the full history).

## Fixed regressions

- **Selection loss on search**: `SelectionChange`/`SelectAll`/`DselectAll` used to blind-assign `bindingData` from `GetAssociateData` (the visible list only), so checking a new item after searching silently dropped every item picked before the search. Fixed by merging: keep `bindingData` entries whose `id` isn't in the current visible set, replace only the visible-set entries. See `@shared/components/assosiate/CONTEXT.md`.
- **Stale search on reopen**: the search `<ui5-input>` isn't `[(ngModel)]`-bound, so its DOM value survived across dialog opens even after `searchFilter` reset in code. Fixed via `#searchInput` `ViewChild` — `resetSearch()` now blanks the actual input value, run on both dialog open and close (`Assign()`/Cancel).

## Usage Pattern

```html
<app-assosiate
  [isOpen]="openAssociateTrigger"
  [apiUrl]="'/api/suppliers'"
  [model]="SupplierModel"
  [tableColumn]="supplierColumns"
  [isMultiselect]="true"
  (selectedData)="onSuppliersSelected($event)"
  (close)="onModalClose()"
></app-assosiate>
```

Open the modal: `openAssociateTrigger.emit()`.
