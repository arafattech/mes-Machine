# ORDER_FORM_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| **TypeScript file** | `src/app/modules/sales-management/sales-order/order-form/order-form.component.ts` |
| **HTML template** | `src/app/modules/sales-management/sales-order/order-form/order-form.component.html` |
| **Selector** | `app-order-form` |
| **Component type** | Form Dialog (reusable across Sales Order, Sales Request, Expired Orders) |
| **Standalone** | No (declared in `SalesModule`) |

**Purpose:** Modal dialog for creating and editing Sales Orders. Manages item selection (via `AssosiateComponent`), inline client creation, discount configuration (ALL/INDIVIDUAL, FIXED_AMOUNT/PERCENTAGE), delivery date, client validation, price-plan warning display, and real-time grand total calculation. Reused in read-only mode by `SalesRequestComponent` and `ExpiredSalesOrderComponent`.

---

## Inputs (@Input)

| Input | Type | Default | Purpose |
|---|---|---|---|
| `showNewButton` | `boolean` | `true` | Controls visibility of the "Add Item" button |
| `saveMode` | `string` | `'POST'` | `'POST'` = create, `'PUT'` = update |
| `selectedData` | `any` | `undefined` | Currently selected row data |
| `requisitionType` | `string` | `'PI'` | Order type identifier |
| `isV8` | `boolean` | `false` | Schema version flag — affects accessor paths in `getDataFromAssosiate` |

---

## Outputs (@Output)

| Output | Type | Purpose |
|---|---|---|
| `saveEvent` | `EventEmitter<any>` | Emitted after successful save — parent refreshes grid |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `open` | `boolean` | `false` | Dialog open state |
| `loading` | `boolean` | `false` | Busy state during save/init |
| `client` | `Client` | `new Client().deserialize({})` | Model passed to inline client form |
| `isDisabled` | `boolean` | `false` | Full form read-only mode |
| `isReadOnly` | `boolean` | `false` | Additional read-only flag |
| `isStatusReadOnly` | `boolean` | `true` | Status field read-only |
| `isWarning` | `boolean` | `false` | Server-side validation warning dialog |
| `isWarningValidation` | `boolean` | `false` | Client-side validation warning dialog |
| `warningMessage` | `string` | `""` | Client validation message |
| `salesValidationWarning` | `any` | `{}` | Server validation warnings from error response |
| `SalesOrder` | `SalesOrder` | `new SalesOrder()` | Form data model |
| `selectedItem` | `any[]` | `[]` | Items added to the order |
| `clientList` | `Client[]` | `[]` | Available clients for combo-box |
| `pricePlannings` | `any` | `{}` | Price plan data keyed by product_id |
| `DiscountConfig` | `{ Options, Type }` | `{ ALL, PERCENTAGE }` | Active discount mode |
| `DiscountType` | `string[]` | `Object.values(DiscountType)` | Discount type options for Select |
| `DiscountOption` | `string[]` | `Object.values(DiscountOption)` | Discount option options |
| `valueStateOptions` | `{ client_id, expected_delivery_date }` | `ValueState.None` | UI5 field validation states |
| `dateRangeValue` | `string` | `""` | String value for the date picker |
| `clientName` | `string` | `""` | Display name for selected client |
| `validationDate` | `string` | `""` | Delivery date validation message |
| `validationMessage` | `string` | `Localization.requiredField` | Client value-state message |
| `stockTitle` | `string` | `Localization.currentStock` | Stock label reference |
| `ToastType` | `'add' \| 'edit' \| 'error'` | `'add'` | Toast mode placeholder |
| `column` | `AgGridTableColumn<any>[]` | `[]` | AG Grid item-grid column defs (rebuilt by `tableColum()`) |
| `dataSource` | `AgGridTableODataSourceConfig` | `staticData: true, data: []` | Static datasource; rows pushed via `syncDataWithGridTable()` |
| `toolbarConfig` | `AgGridTableToolbarConfig` | see class | Grid toolbar (header `Items to Sale`, search, Associate new button) |
| `displayConfig` | `AgGridTableDisplayConfig` | `gridHeight: calc(100vh - 580px)` | Grid sizing (viewport-relative — percentage height collapses ag-grid) |

---

## ViewChild

| Ref | Type | Purpose |
|---|---|---|
| `#childComponentRef` | `AgGridTableComponent` | Items grid; `stopEditing()` + `getGridApi().forEachNode` read edited rows, `refreshCells()` on recalc |
| `#clientForm` | `ClientFormComponent` | Inline client creation |
| `#itemAssosiate` | `AssosiateComponent` | Product picker dialog |
| `#deliveryDatePicker` | `any` | Direct access to clear picker value on reset |
| `#clientNameCombo` | `any` | Direct access to client combo-box for validation |

---

## Methods — Detailed

### `ngOnInit()`
Calls `initPricePlannings()`.

### `constructor()`
Calls `cilentList()` to populate the client combo-box and `tableColum()` to initialize item-grid columns before the dialog opens.

### `CloseDialog()`
Resets dialog state: closes the dialog, clears `SalesOrder`, `selectedItem`, `clientName`, `loading`, `dateRangeValue`, and `validationDate`; syncs the grid; resets validation states; clears the date picker value; resets `DiscountConfig` to the first enum values.

### `newItem()`
Opens the `AssosiateComponent` item picker by setting `itemAssosiate.open = true`.

### `getClient(event)`
Reads `event.detail.item.id` and `.text`, stores `SalesOrder.client_id` and `clientName`, and clears the client validation state.

### `getStatus(event)`
Updates `SalesOrder.status` from the selected combo-box value.

### `DiscountOptionChange(event)`
Updates order discount option. When changed to `ALL`, resets each item discount to zero, sets per-item `discount_type` from existing `item.status` fallback, and recalculates `total_price`; otherwise clears the order-level `SalesOrder.discount`. Rebuilds columns and syncs totals.

### `DiscountTypeChange(event)`
Updates order discount type and syncs totals.

### `onDiscountChange(event)`
Currently only triggers `syncDataWithGridTable()`; the input is bound to `SalesOrder.discount` through `ngModel`.

### `AddClient()`
Resets `client`, sets `saveMode = saveMode.POST`, and opens the inline `ClientFormComponent`.

### `initPricePlannings()`
GETs `sales/get-price-planning` (REST). Maps result onto `selectedItem`: for each item, finds matching `pricePlannings` entry by `product_id` and sets `min_price`. Calls `syncDataWithGridTable()`.

### `cilentList()`
GETs `Clients` (OData). Deserializes each into `Client` model. Calls `cdRef.detectChanges()`.

### `autoClientAdded(newClient)`
Prepends the new client to `clientList`, selects it into `SalesOrder.client_id` and `clientName`, writes the combobox value if the ViewChild exists, and runs change detection.

### `onRefreshClient()`
Reloads the client list by calling `cilentList()`.

### `getDataFromAssosiate(event, isNewAssociate?)`
Called when items are added from the associate picker or when editing an order. Normalizes raw items to a consistent shape (handles both v7 and v8 schema), merges with existing `selectedItem`, deduplicates by `product_id`, calls `populatedItem()`.

Important normalization details:
- `product_name` falls back through direct `product_name`, v8 `products.product_name`, or v7 `product.product_name`.
- `item_code` falls back through direct `item_code`, v8 `products.item_code`, or v7 `product.item_code`.
- `product_id` uses `item.product?.id ?? item.id`.
- New associate rows force `received_quantity = 0`.
- POST rows use `received_quantity ?? 0`; PUT rows use `unit_price ?? 0` as the editable price field.
- `uom` falls back through direct `uom`, v8 `products.uoms`, or v7 `product.uom`.

### `populatedItem(data)`
Normalizes items to the internal format:
- `item_code`, `product_name`, `product_id`, `quantity`, `received_quantity` (used as unit price), `unit_price`, `stock`, `current_stock`, `currency`, `uom`, `status`, `id`, `min_price`, `total_price`, `discount`, `sub_total`, `discount_type`, `discount_amount`
- Calls `initPricePlannings()` then `syncDataWithGridTable()`.

### `syncDataWithGridTable()`
Calls `recomputeOrderTotals()` then rebinds the static datasource: `this.dataSource = { ...this.dataSource, data: [...selectedItem] }`. Used for structural changes (add/remove items, populate). Per-keystroke edits go through `onCellEdited()` instead (no full rebind).

### `recomputeOrderTotals()`
- `subtotal = sum(item.sub_total)`
- `vat = subtotal * 0.075`
- `grand_total = subtotal + vat - DiscountCalculation` (clamped to ≥ 0)

### `onCellEdited(event)`
Bound to the grid `(cellEdited)` output (fired by both inline editors and click-to-edit `select`). Reads all rows via `getGridRows()` (`getGridApi().forEachNode`), runs `recomputeRow()` per row, sets `selectedItem`, recomputes order totals, and calls `getGridApi().refreshCells({ force: true })` to refresh computed cells without resetting the grid.

### `recomputeRow(item)`
Recomputes one row: `sub_total = quantity * received_quantity`, `discount_amount` (FIXED_AMOUNT → flat discount, else `subTotal * discount/100`, using order-level type in ALL mode or row type in INDIVIDUAL), `total_price = max(subTotal - discountAmount, 0)`.

### `getGridRows()`
Returns current grid row data via `childComponentRef.getGridApi().forEachNode`; falls back to `selectedItem` when the grid/api is unavailable.

### `get DiscountCalculation(): number`
Computed getter:
- `ALL + FIXED_AMOUNT`: returns `SalesOrder.discount`
- `ALL + PERCENTAGE`: `totalPrice * (discount / 100)`
- `INDIVIDUAL`: `sum(item.discount_amount)`
Also syncs `SalesOrder.discount_type`, `discount_option`, `discount_amount`.

### `dateRangePickerChange(event)`
Validates the UI5 date picker value strictly as `YYYY-MM-DD`. Invalid values set `validationDate = Localization.invalidDateFormat`, mark date value state negative, and store `"Invalid date"` in `SalesOrder.expected_delivery_date`; valid values clear date validation.

### `checkValidation(event, field)`
Field-level validation handler:
- `client_id`: matches typed value against `clientList` by case-insensitive name; clears `SalesOrder.client_id`, `clientName`, and combobox value if not found.
- `expected_delivery_date`: checks blank input and moment parsing, sets required/invalid messages and value-state flags.

### `validateForm(): boolean`
Client-side validation:
1. `selectedItem` must be non-empty.
2. `SalesOrder.client_id` must be set.
3. `clientNameCombo.value` must be non-empty.
4. `expected_delivery_date` must be set and not `'Invalid date'`.
Sets `valueStateOptions` to `ValueState.Negative` on failures.

### `onSaveType()`
0. Calls `childComponentRef.stopEditing()`, reads `selectedItem = getGridRows()`, recomputes each row + order totals (commits any in-progress cell edit before validation).
1. Calls `validateForm()`.
2. Checks `expected_delivery_date != 'Invalid date'`.
3. Sets `SalesOrder.items = selectedItem`, formats date as `YYYY-MM-DD HH:mm:ss` with moment.
4. POST: `sales/create-order` (REST). PUT: `sales/update-order/<id>` (REST).
5. On success: emits `saveEvent`, calls `CloseDialog()`.
6. On error: shows error toast; if `err.error.warnings` present, sets `isWarning = true` and `salesValidationWarning`.

### `resetValidationStates()`
Clears client/date value states, validation date message, and date picker value/valueState if the picker ViewChild exists.

### `getCustomId()`
Async — calls `commonService.getCustomId({ model: 'sales_orders', prefix: 'PI', field: 'custom_id' })`. Sets `SalesOrder.custom_id`.

### `tableColum()`
Rebuilds the AG Grid `column` array (and refreshes `toolbarConfig.showNewButton`). Columns: Item Code (read-only), Name (read-only), Requested Qty (`inlineEditor: stepInput, min 1`), Price = `received_quantity` (`inlineEditor: input`), Min Price (read-only), Discount (`inlineEditor: input`), Discount Type (click-to-edit `editor: select` of `DiscountType`), Total Price (read-only), Unit (`uom.name` valueGetter), Action (delete via `AgGridActionCellRendererComponent`).

Column-specific behavior:
- All editors are omitted when `isDisabled` is true (view-only mode).
- Discount and Discount Type columns use `initiallyVisible` only when `DiscountOption === INDIVIDUAL`; their editors are also gated on INDIVIDUAL mode.
- Action column is pushed only when editable (`!isDisabled`); its delete button is disabled when `showNewButton` is false or `isDisabled` is true.
- Numeric columns use `type: "numericColumn"`. Inline editors write back to row data; `cellEdited` drives `onCellEdited()` recalculation.

### `onDeleteClick(row)`
Removes the row from `selectedItem` (matched by `product_id`, falling back to object identity); calls `syncDataWithGridTable()`.

### `associateTableColum()`
Returns the lightweight associate picker columns: `item_code` and `product_name`.

---

## Template Structure

```
<ui5-dialog [open]="open" header New/Information (before-close)="CloseDialog()">
  <ui5-busy-indicator [active]="loading">
    Client combobox + inline Add Client button in POST mode
    VAT/Tax Rate readonly input = 7.5%
    Status combobox
    Delivery date picker with yyyy-MM-dd format
    Discount option/type/value controls
    Justification / Reject Note textareas
    <app-ag-grid-table [columns]="column" [dataSource]="dataSource" (newButtonClick)="newItem()" (cellEdited)="onCellEdited($event)">
    Totals: items, subtotal, VAT, discount, grand total
  <ui5-toolbar slot="footer">Submit/Reject + Cancel

<app-assosiate ... (selectedData)="getDataFromAssosiate($event, true)">
<app-client-form ... (ClientAdded)="autoClientAdded($event)" (RefreshTable)="onRefreshClient()">
<ui5-dialog [open]="isWarning">server price-plan warnings table</ui5-dialog>
<ui5-dialog [open]="isWarningValidation">client-side warning message</ui5-dialog>
```

Current template notes:
- Inline Add Client button is visible only when `saveMode === 'POST'`.
- Delivery date picker uses `format-pattern="yyyy-MM-dd"` and `[value]="dateRangeValue"`.
- Discount controls use `SalesOrder.discount_option` and `SalesOrder.discount_type` as displayed values, while `DiscountConfig` drives calculation.
- The item grid is `app-ag-grid-table` with a static datasource (`isBase=false`, `isTableCacheEnabled=false`); live recalculation is driven by the `(cellEdited)` output (inline `stepInput`/`input` editors + click-to-edit `select`).
- The associate picker reads sellable products from `Products?$expand=suppliers,productTypes,category,clients,plants,variants,uom&$orderby=created_at desc` with filter `is_sellable eq true`.

---

## API Calls

| Method | Endpoint | OData | Purpose |
|---|---|---|---|
| GET | `Clients` | `true` | Client dropdown |
| GET | `sales/get-price-planning` | `false` | Minimum pricing rules per product |
| helper | `getCustomId({ model: 'sales_orders', prefix: 'PI', field: 'custom_id' })` | n/a | Generate custom PI id when called |
| POST | `sales/create-order` | `false` | Create new order |
| PUT | `sales/update-order/<id>` | `false` | Update existing order |

---

## Services Injected

| Service | Methods Used |
|---|---|
| `CommonService` | `get('Clients', true)`, `get('sales/get-price-planning', false)`, `post(...)`, `put(...)`, `getCustomId(...)` |
| `ToastService` | `show('add')`, `show('error')` |
| `MediaService` | (injected, not visibly used in reviewed code) |
| `ChangeDetectorRef` | `detectChanges()` after client list load |
| `RolePermissionService` | (injected for template permission checks) |

---

## Payload and Calculation Notes

- `SalesOrder.items` is assigned from `selectedItem` immediately before save and during item population.
- `received_quantity` is the editable price value in the grid.
- `sub_total = quantity * received_quantity`.
- `vat = subtotal * 0.075`.
- `grand_total = max(subtotal + vat - DiscountCalculation, 0)`.
- Server warning payload is expected as `err.error.warnings` and rendered with `item_code`, `product_name`, `price_plan`, `received_quantity`, and `message`.

---

## Maintenance Notes

- Keep `DiscountConfig`, `SalesOrder.discount_option`, and `SalesOrder.discount_type` behavior aligned; the template displays `SalesOrder.*` while calculations read `DiscountConfig`.
- If item schema changes, update both `getDataFromAssosiate()` and `populatedItem()`; they intentionally normalize mixed v7/v8/edit/new item shapes.
- If client creation flow changes, update `AddClient()`, `autoClientAdded()`, and the `<app-client-form>` template contract together.
- If VAT or minimum-price validation becomes dynamic, update `syncDataWithGridTable()`, the VAT readonly template value, and the API notes.
