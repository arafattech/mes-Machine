# Store Management — Imported Material Receipt

## Files

```
imported-material-receipt/
├── imported-material-receipt.component.ts   ← .ts extension (not .tsx)
├── imported-material-receipt.component.html
└── imported-material-receipt.component.scss
```

## Route
`/store/imported-material-receipt` — guard: `STORE_LOCAL_MRR` (shares permission with local MRR)

---

## ImportedMaterialReceiptComponent

### Selector
`app-imported-material-receipt`

### Purpose
Lists Material Receipt Records for imported POs (`source eq 'IMPORTED'`). Supports create, view, and PDF generation.

### Layout — same dashboard-style redesign as Local MRR
Structurally identical to `LocalMaterialReceiptComponent`'s redesign (selector bar + left item-progress panel + right log grid) — see that component's context doc for the full breakdown (same gotchas: `ui5-segmented-button` external-state binding doesn't work, use plain `ui5-button` toggles; `latestLogPerProduct` drives both the left-panel progress cards and the summary tiles; `saveEvent()` refetches directly rather than relying on any grid reselect; same `loading` boolean + small inline `ui5-busy-indicator[size="S"]` next to the status-filter buttons around `getMrrOptions()`/`onMrrChange()`/`refreshMrrLog()`, including error paths — a full-page skeleton/spinner-overlay was tried and reverted in favor of this small inline indicator; same theme-aware `var(--sapTile_*)`/`var(--sapList_*)`/`var(--sapSelectedColor)`/`var(--sapTextColor)`/`var(--sapContent_LabelColor)` inline-style convention on the left item-progress card list and bottom summary tiles, replacing the earlier hardcoded Tailwind `bg-white`/`bg-blue-50`/`text-blue-700`/`text-slate-*` classes that looked broken in dark mode). Only differences here:

- `source: 'IMPORTED'` everywhere (query filter, `MRRFromComponent`'s `[source]` input).
- Combobox search filters `custom_id` only (no separate invoice/LC search field in the selector — those fields still exist in the create/edit dialog).
- No status default beyond the shared `statusFilter = 'partial'` default (previously "no segment buttons, all statuses shown" — now uses the same 4-way All/Partial/Completed/Cancelled toggle row as Local MRR for consistency).

### Key Properties / Methods
Same shape as `LocalMaterialReceiptComponent`: `mrrOptions`, `selectedMrrLabel`, `statusFilter`, `selectedMrr`, `selectedProductId`, `getMrrOptions()`, `onMrrSearchInput()`, `onStatusFilterChange()`, `onMrrChange()`, `newItem()` (→ `MRRFromComponent`, create), `viewItem()` (→ `MRRFromComponent`, always readonly — `info` icon), `openReceiveDialog()` (→ `ReceiveQtyFormComponent`, single-product receive dialog — wired to both the **edit** icon and the log grid's own "Receive" new-button), `openPdf()`, `saveEvent()`, `refreshMrrLog()`, `selectProduct()`, `latestLogPerProduct`, `productProgressList`, `progressPercent()`. Left-panel cards are sourced from `productProgressList` (receiptItems/poItems, available immediately — NOT the log, which is empty until something's been received) and are click-to-filter the log grid by product, with the first product auto-selected synchronously on MRR selection — identical mechanism and the same dataSource-assignment-vs-`setGridOption` race gotcha, and the same `Number`/`+` coercion gotcha for the selected-card highlight, documented in `local-material-receipt/context.md`. `ReceiveQtyFormComponent` itself (and its `POST store/material-receipts/{id}/receive` backend endpoint, including the row-locking fix for the double-log race) is also fully documented there — shared, not duplicated per-component.

### Permissions

| Permission | Effect |
|------------|--------|
| `STORE_LOCAL_MRR_VIEW` | Shows the edit/PDF icon buttons in the selector bar |
| `STORE_LOCAL_MRR_CREATE` | Shows the New button |

### MRR Log panel
Same as Local MRR: `mrrLogColumns` (Product / Required Qty / Received Qty / Day Received / Date / Received By / Remark) + the 4-tile summary strip below the grid (Recently Received / Receiving Qty / Total Received / Due).

### Important Caveats
- File extension is `.ts` not `.tsx` — unlike most store-management components.
- Reuses `MRRFromComponent` from `local-material-receipt/mrr-from/`.
- Route guard is `STORE_LOCAL_MRR` (same as local MRR) — not a separate imported-MRR permission.
- Create dialog (`MRRFromComponent`, `source==='IMPORTED'`) field labels were renamed: "Invoice No" → "Commercial Invoice No", "LC No" → "L/C No". Invoice/LC No are dialog-only fields now — there is no list grid column for them anymore (the MRR list grid itself was removed in the redesign).
- **Vehicle No** (`vehicle_no`): optional/nullable text input in the IMPORTED create/edit dialog only (after L/C No). FE model `MaterialReceipt.vehicle_no` (in `toOdata`); loaded in `getReceiptPopulated`. Backend: nullable column on `material_receipts` (migration `2026_06_17_000100_add_vehicle_no_to_material_receipts_table`), validated + persisted in `MaterialReceiptController` (`validateRequest` + `buildReceiptData`). Not required.
- `gridId="imported-mrr-log-list-v2"` — the log grid's own column-state localStorage key (bumped from `imported-mrr-log-list` to bust any stale persisted column-visibility state; the old MRR-list grid's `gridId="imported-mrr-list"` no longer exists either).
- `mrrLogToolbarFilters` "Filter by Product" dropdown (built from `receiptItems` in `onMrrChange`, wired via `(toolbarAction)="onMrrLogToolbarAction($event)"`) and the reset-on-status-change/MRR-switch behavior now match Local MRR exactly — this component previously lacked both.
- The "PI/Indent List" combobox in `MRRFromComponent` (`getPOList()`) filters `PurchaseOrders` by `is_imported eq true` when `source==='IMPORTED'` (`eq false` for LOCAL) — see local-material-receipt context for the `@Input() source` timing gotcha this fix depends on.
