# Sales Management — Sales Order

## Files
- `sales-order/sales-order.component.ts` — list component
- `sales-order/sales-order.component.html` — template
- `sales-order/order-form/order-form.component.tsx` — create/edit dialog
- `sales-order/order-form/order-form.component.html` — form template
- `sales-order/sales-order.component.scss` — list styles
- `sales-order/order-form/order-form.component.scss` — form styles

## Selectors
- `app-sales-order`
- `app-order-form`

## Routes
- `sales-orders` — guarded by `SALES_SALES_ORDERS`

## Purpose
Full CRUD for Sales Orders. The list component uses `app-ag-grid-table` fetching from OData `SalesOrders` (or `sales_orders` when `isv8`). Inline row actions allow edit/view, delete, download invoice (PDF), and send/cancel submit workflow. The form dialog (`OrderFormComponent`) handles both creation and editing and is also reused by `SalesRequestComponent` and `ExpiredSalesOrderComponent`.

## Separate Component Docs
- [sales_order_list_component_context.md](sales_order_list_component_context.md) — `SalesOrderComponent` list doc with TS, HTML, SCSS, selector, route, datasource, toolbar, actions
- [order_form_component_context.md](order_form_component_context.md) — `OrderFormComponent` form doc with TSX, HTML, SCSS, selector, inputs, outputs, validation, save flow

## Current Behavior Snapshot
- `SalesOrderComponent` owns the server-side list, action buttons, delete confirmation event, status warning dialog, and invoice download busy dialog.
- `OrderFormComponent` owns the modal form, item association, inline client creation, date/client validation, discount calculation, price-plan warning display, and create/update API calls.
- `isv8` is currently `false` by default but both list and form contain schema-compatibility paths for v7 and v8 payloads.
- The form's item price field is stored in `received_quantity`; `unit_price` is only restored for existing rows.
- VAT/tax is hard-coded to `7.5%` in the form template and calculation.

## Key Properties — SalesOrderComponent

| Property | Type | Purpose |
|----------|------|---------|
| `isv8` | `boolean` | Feature flag — switches OData accessors between v7 and v8 schema |
| `columns` | `AgGridTableColumn<any>[]` | AG Grid column definitions built in `buildColumns()` after client list loads |
| `dataSource` | `AgGridTableODataSourceConfig<SalesOrder>` | isv8-aware OData endpoint, expand, sort, and search fields |
| `toolbarConfig` | `AgGridTableToolbarConfig` | Search, row count, refresh, and New button config |
| `displayConfig` | `AgGridTableDisplayConfig` | AG Grid height config |
| `clientList` | `{ value: string; text: string }[]` | Pre-loaded client list used for Client column single-select filter |
| `SalesOrder` | `SalesOrder` | Holds selected row for status change confirmation |
| `isOpenWarning` | `boolean` | Controls status-change confirmation dialog |
| `isLoading` | `boolean` | Controls PDF generation loading dialog |
| `setStatus` | `any` | Stores target status before the confirmation dialog submits |
| `permissions` | `typeof Permissions` | Exposes sales-order permissions to template/React cells |
| `status` | `typeof SalesStatus` | Exposes sales status enum for action button state |

## Key Properties — OrderFormComponent

| Property | Type | Purpose |
|----------|------|---------|
| `open` | `boolean` | Controls dialog visibility |
| `saveMode` | `'POST'` \| `'PUT'` | Determines create vs update API call |
| `showNewButton` | `boolean` | Controls Associate/Add Item availability |
| `isDisabled` | `boolean` | Puts form in read-only mode (view-only access) |
| `isReadOnly` | `boolean` | Additional read-only flag |
| `isStatusReadOnly` | `boolean` | Keeps status field read-only in the order form |
| `client` | `Client` | Temporary model passed to inline `ClientFormComponent` |
| `SalesOrder` | `SalesOrder` | Data model for the form |
| `selectedItem` | `any[]` | Items added to the order |
| `DiscountConfig` | `{ Options, Type }` | Discount mode (ALL/INDIVIDUAL, FIXED_AMOUNT/PERCENTAGE) |
| `pricePlannings` | `any` | Price plan data used to set `min_price` on items |
| `valueStateOptions` | `{ client_id, expected_delivery_date }` | UI5 validation state for client/date inputs |
| `isWarning` | `boolean` | Server price-plan warning dialog visibility |
| `isWarningValidation` | `boolean` | Client-side validation warning dialog visibility |

## API Calls

| Component | Method | Endpoint | OData | Purpose |
|-----------|--------|----------|-------|---------|
| SalesOrderComponent | GET | `Clients` | `true` | Pre-load client list for column filter |
| SalesOrderComponent | PUT | `SalesOrders/<id>` | `true` | Update status (send/cancel) |
| SalesOrderComponent | POST | `sales/invoice/generate` | `false` | Download PDF invoice (Blob) |
| OrderFormComponent | GET | `Clients` | `true` | Client dropdown |
| OrderFormComponent | GET | `sales/get-price-planning` | `false` | Load minimum pricing rules |
| OrderFormComponent | GET/custom | `getCustomId({ model: 'sales_orders', prefix: 'PI', field: 'custom_id' })` | service helper | Generate PI custom id when called |
| OrderFormComponent | POST | `sales/create-order` | `false` | Create new sales order |
| OrderFormComponent | PUT | `sales/update-order/<id>` | `false` | Update existing sales order |

## Status Flow
`DRAFT` → (Send) → `PENDING` → (Approve in Sales Requests) → `APPROVED` / `REJECTED`

Cancel send: `PENDING` → `DRAFT`

## Discount Logic
- `DiscountOption.ALL` + `DiscountType.FIXED_AMOUNT`: single fixed discount on order total
- `DiscountOption.ALL` + `DiscountType.PERCENTAGE`: % of order total subtracted
- `DiscountOption.INDIVIDUAL`: per-item discount with individual type per row
- VAT fixed at 7.5% of subtotal
- `grand_total = subtotal + vat - discount_amount`
- Grand total is clamped to `0` when discounts exceed subtotal + VAT.
- In ALL discount mode the order-level discount input is editable; in INDIVIDUAL mode the per-item Discount and Discount Type columns are shown and the order-level discount input is read-only.

## Validation and Warnings
- Save requires at least one selected item.
- Save requires a valid client id and non-empty client combo-box value.
- Delivery date must be present and must match the `yyyy-MM-dd` date-picker flow; invalid dates set `ValueState.Negative`.
- Server-side price/minimum validation warnings from `err.error.warnings` open the warning dialog with item code, product name, plan price, given price, and message.
- Inline client creation is available only in POST mode. `ClientAdded` inserts the new client at the top of `clientList`, selects it, and refreshes change detection.

## v7/v8 Shape Differences
- List client field/accessor: v8 `clients.name`; v7 `client.name`.
- List item accessor/count: v8 `sale_order_items`; v7 `items`.
- List creator accessor: v8 `users.name`; v7 `createdBy.name`.
- Form item restore path: v8 rows use `products`/`products.uoms`; v7 rows use `product`/`product.uom`.
- Template data source endpoint: v8 `sales_orders`; v7 `SalesOrders`.

## Services Injected — SalesOrderComponent

| Service | Usage |
|---------|-------|
| `CommonService` | Client list GET; status PUT; PDF POST |
| `ToastService` | Success/error toasts |
| `DateFormatterService` | Delivery date cell formatting |
| `ChangeDetectorRef` | After PDF download |
| `RolePermissionService` | Column-level permission guards |

## Related Components
- `OrderFormComponent` — form dialog reused across Sales Order, Sales Request, Expired Orders
- `DeleteEntityComponent` — handles delete confirmation
- `AssosiateComponent` — item picker for adding products to order
- `ClientFormComponent` — inline client creation within order form

## Future Update Checklist
- If a sales-order field is added to the list grid, update `SalesOrderComponent.buildColumns()` and this context file together.
- If order form payload shape changes, update `getDataFromAssosiate()`, `populatedItem()`, save payload notes, and the v7/v8 section.
- If VAT, discount, or price-plan rules move to backend configuration, update the Discount Logic and API Calls sections.
- If permissions change, update both `SALES_ORDER_COMPONENT_CONTEXT.md` and this overview.
