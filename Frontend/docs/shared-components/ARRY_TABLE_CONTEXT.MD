# ArryTableComponent

**Selector:** `app-arry-table`
**File:** `src/app/shared/components/arry-table/arry-table.component.tsx`
**Standalone:** Yes — `CUSTOM_ELEMENTS_SCHEMA`

## What It Does

Specialized table for managing supplier associations within a product context. Displays a filtered list of associated suppliers with search, row deletion, and fixed 10-row layout. Works in tandem with `AssociateComponent` modal for adding new items.

This is domain-specific (supplier ↔ product), not a generic table.

## Inputs

| Input | Type | Purpose |
|---|---|---|
| `Associate` | `any` | Source association data |
| `model` | `any` | Deserializable model |
| `tableColumn` | `any` | Column definitions |
| `getSelectedSuppliers` | `EventEmitter<any>` | Receives selected supplier data from parent |
| `loading` | `boolean\|undefined` | Loading state |
| `selecteditem` | `any` | Currently selected item |
| `IsOpen` | `any` | Triggers data fetch when changed |

## Outputs

| Output | Emits | When |
|---|---|---|
| `IsAssosiateModal` | `any` | Associate/Add button clicked |
| `getStaticData` | filtered list | Supplier data filtered and ready |
| `SentSelectedData` | `any` | Selection sent back to parent |

## Key Methods

| Method | Purpose |
|---|---|
| `ngOnChanges(changes)` | Detects `IsOpen` changes, fetches supplier data for selected product |
| `GetSelectedData(data)` | Receives selected data, updates `FilterData`, emits via `getStaticData` |
| `onInputChange()` | Case-insensitive search filter on `FilterData` by `SearchText` |
| `GenetateEmptyRow()` | Pads display to always show 10 rows |
| `removeData(data)` | Removes item from `FilterData`, emits updated list |
| `IsAssosiateClick()` | Emits `IsAssosiateModal` to open picker modal |

## Hard-coded Columns

Returns fixed column definition: Active, ID, Name, Created At, Actions.

## Usage Pattern

```html
<app-arry-table
  [IsOpen]="selectedProduct"
  [getSelectedSuppliers]="suppliersEmitter"
  (IsAssosiateModal)="openAssociateModal()"
  (SentSelectedData)="onSuppliersSelected($event)"
></app-arry-table>
```

Typically paired with `app-assosiate` — parent opens associate modal when `IsAssosiateModal` fires, then feeds results back via `getSelectedSuppliers`.
