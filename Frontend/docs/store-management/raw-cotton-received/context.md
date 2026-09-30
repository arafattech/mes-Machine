# Store Management — Raw Cotton Received

## Purpose

`RawCottonReceivedComponent` is a daily receipt report at
`/store-management/raw-cotton-received`. It only shows receiving events for
products where `products.is_raw_cotton = true`.

The table follows the paper report's key headers: L/C No, Supplier, Origin,
received lot bale/net-weight, USD rate per KG, opening stock, and a further
set of columns (avg wt./bale, received/issued/delivered bale & kg, weight/tare
gain-loss, closing stock) that are defined in the grid and export but not yet
computed by the backend — they render blank until that stock-ledger logic is
built. The date range is shown above the grid and defaults to the current day.

## Data source

The grid calls `GET store/raw-cotton-received/report`. The backend
(`RawCottonReceivedController::report()`) reads `material_receipt_logs` for
actual receiving events, their related `material_receipts` row for the L/C
number, the supplier/origin, and the related product for item details and
rate. `received_lot_bale`/`received_lot_net_weight_kg` are computed by
`LotTotalsService`, which sums `lots.bale_quantity`/`lots.net_weight_kg`
grouped by `lots.mrr_item_id`, joined back to the log's
`(material_receipt_id, product_id)` pair via `material_receipt_items`.

`opening_stock` is intentionally passed straight through from
`products.current_stock`. No balances, sales, wastage, or other paper-report
figures are calculated by this screen.

### Where the underlying Lot rows come from

A `Lot` only exists for a receiving line when the product has `is_lot = true`
**and** the MRR's `source = 'IMPORTED'` — see
`mrr-from.component.ts`'s `isCottonItem()`/`generateLotNumbers()`. On MRR
create, one `Lot` (bale/gross/tare/net all 0) is `POST`ed per lot-eligible
line, linked via `mrr_item_id` to the just-created `MaterialReceiptItem` shell
row (read from the REST response's `receipt_items` key — Eloquent's
`toArray()` snake_cases relation keys, unlike the OData `$expand` responses
used elsewhere in that file, which keep the camelCase nav-property name; using
the wrong key here silently nulls every `mrr_item_id` and breaks this report's
lot totals). Each subsequent partial receive (`receive-qty-form.component.ts`)
adds the receiving qty onto the lot's `gross_weight_kg`/`net_weight_kg`, and
the dialog's own "Bale Qty (this receipt)" entry onto its `bale_quantity` —
both are per-event deltas added to the lot's running total, not absolute
overwrites.

## Date filtering

`received_date` is the date part of the receipt-log timestamp. The component
sends `received_date ge YYYY-MM-DD and received_date le YYYY-MM-DD`; Reset
restores today's date range.

## Row details dialog

The grid has an Info action button (`showAction`/`showInfoButton`/
`infoClick`, same pattern as `return-mrr`). Clicking it calls
`viewDetails(row)`, which fetches the row's `MaterialReceiptLog` via OData
(`MaterialReceiptLogs(id)?$expand=receipt($expand=supplier),product($expand=category,uom),receivedBy`)
and shows a read-only dialog combining that with the grid row's own
already-computed fields (rate, opening stock, lot bale/kg totals): MRR no,
source, invoice/LC/vehicle no, item category/UOM, required vs. this-event vs.
total received qty, received-by, and remark. No backend endpoint was added —
`MaterialReceiptLog` was already OData-registered with those relations.

## Export

`GET/POST store/raw-cotton-received/export` streams `RawCottonReceivedExport`
(same query/columns as the report, plus a leading `SN` column). The sheet uses
the shared `HasCompanyReportLayout` trait (`app/Exports/Concerns/`) for the
"BANDHAB TEX LTD" letterhead: company name, address, and a title row reading
"Daily Raw Cotton Received Consumption & Stock Report" with the selected date
(or date range) appended — plus the trait's default Admin/GM/Director
signature footer.

Unlike the grid (see "Data source" above), the export's `opening_stock`/
`closing_stock_kg` are **not** `products.current_stock` — they're derived from
a per-product running ledger built from `stock_adjustments`
(`condition = INCREASED/DECREASED`), cut off at each row's date
(`buildStockLedger()`/`stockAsOf()`). This ledger has no origin or bale
dimension — it tracks one cumulative Kg balance per product only.

### Bottom summary tables (AfterSheet)

Below the main table and its Total row, two tables sit side by side spanning
the same overall width as the main table (~30% / ~70%):

- **Left (~30%, cols A:G)** — "Origin wise Raw Cotton Stock Summary": one row
  per origin, label only. Bale/Kg are left blank — the stock_adjustments
  ledger has no origin dimension, so a per-origin closing balance can't be
  derived without fabricating a number.
- **Right (~70%, cols I:X)** — three groups in one box, each bordered to its
  own last row (not stretched to match a taller sibling):
  - *Summary of Issue* (I:K) — origin labels only, Bale/Kg blank (no source
    table for issue-to-production yet).
  - *Summary of Received* (M:O) — real, from `$originSummary` (same
    bale/net-weight totals `map()` puts on each row, grouped by origin).
  - *Summary of Raw Cotton From x To y* (Q:X) — Description/Bale/Kg.
    Opening Stock, Total Received, Delivery/Sales, and Closing Stock are
    real (Delivery/Sales sums `stock_adjustments` rows where
    `reason = SALES_DISPATCH`, written by `SalesOrderObserver` on sales-order
    approval). Total Issued, Tare Gain, Weight Loss, Weight Gain, and Tare
    Loss stay blank — no backing column/table exists anywhere in the schema
    for these; every populated cell in this export is a real, computed
    number, never a fabricated placeholder.

## Access

The page is Store Management → Inbound → Raw Cotton Received and uses the
existing `STORE_LOCAL_MRR` permission.
