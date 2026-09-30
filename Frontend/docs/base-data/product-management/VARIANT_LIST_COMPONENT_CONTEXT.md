# VARIANT_LIST_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| TSX file | `Frontend/src/app/modules/base-data-management/product-management/variant/variant.component.tsx` |
| HTML file | `Frontend/src/app/modules/base-data-management/product-management/variant/variant.component.html` |
| Selector | `app-variant` |
| Component type | List |
| Table component | `app-ag-grid-table` (`AgGridTableComponent`) |
| Purpose | Renders a paginated OData-backed AG Grid table of Variants. Create/edit delegated to `VariantFormComponent`; delete to `app-delete-entity`. New button is always visible (no permission gate). |

---

## Inputs (@Input)

No `@Input()` properties.

---

## Outputs (@Output)

| Output name | Type | Purpose |
|---|---|---|
| `refreshTable` | `EventEmitter<void>` | Emitted after any successful mutation. |
| `IsDelete` | `EventEmitter<string>` | Emits OData path (e.g. `Variants/5`) to `app-delete-entity`. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `agGridRef` | `AgGridTableComponent<Variant>` | `@ViewChild` | `refreshGridData()` after mutations. |
| `variantFormRef` | `VariantFormComponent` | `@ViewChild` | Opens form dialog; `saveMode` and `variant` set imperatively on form ref. |
| `permissions` | `typeof Permissions` | `Permissions` | Exposes permissions to template. |
| `saveMode` | `string` | `saveMode.POST` | Component-level form mode tracking. |
| `variant` | `Variant` | `new Variant()` | Used for new form reset. |
| `gridId` | `string` | `'base-data-variant-list'` | AG Grid state persistence key. |
| `columns` | `AgGridTableColumn<any>[]` | Built in constructor | Column definitions. |
| `dataSource` | `AgGridTableODataSourceConfig<Variant>` | endpoint `Variants`, searchFields `['name', 'custom_id']`, pageSize 40 | OData source. |
| `toolbarConfig` | `AgGridTableToolbarConfig` | headerTitle from `Localization.Variant`, showSearch, showRowCount, showSegmentButton, `showNewButton: true` | Toolbar config. Note: `showNewButton` hardcoded `true` — no permission gate. |
| `displayConfig` | `AgGridTableDisplayConfig` | `{ gridHeight: 'calc(100vh - 118px)' }` | Grid height. |

---

## Key Design Note

`saveMode` is NOT passed as an `@Input` to `VariantFormComponent` — it is set directly on `variantFormRef.saveMode`. Similarly, `variant` data is passed via `variantFormRef.variant = data` (not an Angular input binding).

Edit button gated on `BASE_DATA_VARIANT` permission. Delete button gated on `BASE_DATA_ITEM_VARIANTS_DELETE` permission.

---

## Methods

### `buildColumns(): AgGridTableColumn<any>[]`
Returns: `is_active` (boolean renderer), `custom_id`, `name`, `created_at` (date formatted).

### `processData(_event?): void`
Emits `refreshTable` + calls `agGridRef.refreshGridData(true)`.

### `newVariant(): void`
Resets `variant`, opens form, sets `variantFormRef.saveMode = POST`.

### `editVariant(data): void`
Opens form, sets `variantFormRef.variant = data`, sets `variantFormRef.saveMode = PUT`.

### `deleteClick(id): void`
Emits `IsDelete` with `Variants/${id}`.

---

## Template Structure

```
<div class="h-[calc(100vh-55px)]">
  <app-ag-grid-table #agGridRef ...>
<app-variant-form #variantForm (RefreshTable)="processData($event)">
<app-delete-entity ...>
```

### `app-ag-grid-table` key bindings

| Binding | Value |
|---|---|
| `[dataSource]` | OData: `Variants` |
| `[showEditButton]` | `BASE_DATA_VARIANT` permission |
| `[showDeleteButton]` | `BASE_DATA_ITEM_VARIANTS_DELETE` permission |
| `(newButtonClick)` | `newVariant()` |
| `(editClick)` | `editVariant($event)` |
| `(deleteClick)` | `deleteClick($event.id)` |
| `(rowClick)` | `editVariant($event)` |

---

## API Calls

| Method | Endpoint | Delegated to |
|---|---|---|
| GET | `Variants` | `AgGridTableComponent` |
| POST | `Variants` | `VariantFormComponent` |
| PUT | `Variants({id})` | `VariantFormComponent` |
| DELETE | `Variants/{id}` | `app-delete-entity` |

---

## Services Injected

| Service | Visibility | Methods used |
|---|---|---|
| `RolePermissionService` | `public` | `hasPermission()` — template edit/delete bindings |

---

## Enums / Models Used

| Name | Source | Usage |
|---|---|---|
| `Variant` | `@shared/model/variant` | Grid row model |
| `saveMode` | `@shared/enums/saveMode` | Set imperatively on form ref |
| `Permissions` | `@app/shared/enums/permissions` | `BASE_DATA_VARIANT`, `BASE_DATA_ITEM_VARIANTS_DELETE` |
| `Localization` | `@shared/utilities/localization` | `Localization.Variant`, `Localization.CreatedAt` |
| `AgGridBooleanCellRendererComponent` | `@shared/components/ag-grid-table/cell-renderers/` | `is_active` column |
