# Sales Management — Market Price History

## Files
- `market-price-history/market-price-history.component.ts`
- `market-price-history/market-price-history.component.html`
- `market-price-history/market-price-history.component.scss`

## Selector
`app-market-price-history`

## Route
`market-price-history` — guarded by `SALES_MARKET_PRICE_HISTORY`

## Purpose
Read-only grid showing all historical market price entries (`MarketPrices` OData entity). Pre-loads product and user lists via a `$batch` call for column combo-box filters. Supports date range filtering on the `created_at` column.

## Separate Component Docs
- [market_price_history_list_component_context.md](market_price_history_list_component_context.md) — `MarketPriceHistoryComponent` list doc with TS, HTML, SCSS, selector, route, datasource, filters

## Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `itemList` | `any[]` | Sellable active products for Name column combo-box filter |
| `userList` | `any[]` | Active users for Created By column combo-box filter |
| `column` | `any` | Grid column definitions (built after `getInitialData()` resolves) |
| `isv8` | `boolean` | Schema version flag — switches `product` vs `products` and `createdBy` vs `users` accessors |

## Columns
Item Code (`product.item_code` / `products.item_code`), Name (NestedString with product combo filter), Unit (`product.uom.name` / `products.uoms.name`), Market Price (`unit_price`, Number, center-aligned), Created By (NestedString with user combo filter), Date (`created_at`, UI5DateRangePicker + formatter).

## Key Methods

| Method | Description |
|--------|-------------|
| `constructor()` | Calls `getInitialData()` |
| `getInitialData()` | Posts `$batch` with two sub-requests (Products + Users); populates `itemList` and `userList`; calls `tableColum()` |
| `tableColum()` | Builds column definitions using current `itemList` / `userList` for combo filters |

## API Calls

| Method | Endpoint | OData | Purpose |
|--------|----------|-------|---------|
| POST | `$batch` | `true` | Batch: GET active+sellable Products; GET active Users |

Batch sub-requests:
- `id: "1"` → `Products?$filter=is_active eq true and is_sellable eq true`
- `id: "2"` → `Users?$filter=is_active eq true`

## Services Injected

| Service | Usage |
|---------|-------|
| `CommonService` | `post('$batch', payload, true, undefined, undefined, isv8)` |
| `DateFormatterService` | `formatDate()` for `created_at` cell |

## Notes
- Grid URL for MarketPrices is defined in the HTML template (not in this component's TypeScript).
- `isv8 = false` by default — all accessors use the v7 OData field paths.
- The `$batch` response is matched by `id` field (`"1"`, `"2"`) to identify product vs user results.
