# MARKET_PRICE_HISTORY_LIST_COMPONENT — Component Context

## Component Identity

| Field | Value |
|---|---|
| Component name | `MarketPriceHistoryComponent` |
| Selector | `app-market-price-history` |
| TypeScript | `src/app/modules/sales-management/market-price-history/market-price-history.component.ts` |
| HTML | `src/app/modules/sales-management/market-price-history/market-price-history.component.html` |
| SCSS | `src/app/modules/sales-management/market-price-history/market-price-history.component.scss` |
| Component type | List component |
| Route | `market-price-history` |
| Permission | `SALES_MARKET_PRICE_HISTORY` |

## Purpose
Displays market price history rows with product, unit, market price, creator, and date. It is list-only; market-price entry is handled from the sales layout dialog.

## Child Components

| Template ref | Component | Purpose |
|---|---|---|
| `#agGridRef` | `AgGridTableComponent` | Market price history grid |

## Main Data Source

| Property | Value |
|---|---|
| Endpoint | `MarketPrices` |
| Expand | `createdBy,product($expand=uom)` |
| Search fields | `product.item_code`, `product.product_name` |
| Sort | `desc` |

## Initial Filter Data
Loads product and user filter options through `$batch`:
- `Products?$filter=is_active eq true and is_sellable eq true`
- `Users?$filter=is_active eq true`

## Toolbar
- Header: `Market Price`
- Search: enabled
- Row count: enabled
- New button: disabled

## Future Add Notes
- If market-price create/edit moves into this component, create a separate `market_price_form_component_context.md`.
