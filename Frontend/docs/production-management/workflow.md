# Bandhab Tex Limited — Store & Production MES Specification

**Scope:** digitizes the paper flow currently used between the Production floor and the Store department — raw cotton receipt/consumption, shift production, packing, finished-yarn handover, waste tracking, and the monthly MIS reconciliation.

**Out of scope for v1:** HR/duty rostering, machine-level IoT/OEE, finance/GL posting (cost fields are captured so finance integration is possible later), full sales-order management beyond basic buyer allocation.

**How to use this doc with Claude Code:** drop this file into the project root (e.g. as `docs/MES-SPEC.md`, or rename to `CLAUDE.md` if you want it auto-loaded as project context — check docs.claude.com/en/docs/claude-code for the current convention). Reference it explicitly in your first prompt, e.g. "Build the schema in section 3, starting with Phase 1 in section 10."

---

## 1. Glossary

| Term | Meaning |
|---|---|
| L/C | Letter of Credit — procurement reference tied to one imported raw-cotton lot |
| Count / Ne | Yarn fineness (e.g. 30/1, 34/1) — higher number = finer yarn |
| KH | Yarn type/process suffix used in this mill's count naming (e.g. `34/1 KH`) |
| WIP | Work in process — cotton/yarn partway through the line, not yet yarn or waste |
| Realization % | Finished yarn output as a percentage of raw material actually consumed |
| BCI / Organic | Certification tags on raw cotton origin, carried through for traceability |
| HOD | Head of Department |
| GM | General Manager |
| Bale | Standard raw-cotton packing unit; weight varies slightly per lot |

---

## 2. System overview

```
Raw cotton store  --issue-->  Production process  --waste-->  Waste store
                               (carding -> drawing ->              |
                                simplex -> ring -> auto cone ->    |
                                packing)                           |
                                    |                              |
                                    v                              v
                            Finished yarn store  ------------> Monthly MIS rollup
                                                                (mass balance,
                                                                 realization %,
                                                                 waste %)
```

Every daily ledger (raw cotton, waste, yarn) is append-only day-over-day, and the monthly MIS is a **computed rollup**, never a manually re-entered report — this is the single most important architectural decision: MIS numbers must always derive from the daily ledgers, so they can never silently drift from them.

---

## 3. Core entities & schema

Field lists below are the minimum needed to reproduce every number in the source paper reports. Types are indicative (SQL-flavored); adapt to your stack.

### 3.1 `raw_cotton_lot` (master — one row per L/C shipment)
```
id                  pk
lc_no               varchar        -- L/C reference no.
supplier_name       varchar
origin              varchar        -- e.g. Benin, Mali, USA, Indian-Organic
received_lot_bales  int
received_net_kg     decimal
rate_usd_per_kg     decimal
avg_wt_per_bale_kg  decimal        -- computed: received_net_kg / received_lot_bales
last_receiving_date date
lc_bo_ref           varchar
```

### 3.2 `raw_cotton_daily_ledger` (transaction — one row per lot per day)
```
id                  pk
lot_id              fk -> raw_cotton_lot
ledger_date         date
opening_bales       int
opening_kg          decimal
received_bales      int
received_kg         decimal
issued_to_prod_bales int
issued_to_prod_kg   decimal
delivered_bales     int
delivered_kg        decimal
weight_gain_kg      decimal        -- nullable, needs a reason code when non-zero
weight_short_kg     decimal
tare_gain_kg        decimal
tare_loss_kg        decimal
closing_bales       int            -- computed, see formula 5.1
closing_kg          decimal        -- computed, see formula 5.1
```
Constraint: `closing_*` of day N must equal `opening_*` of day N+1 for the same lot.

### 3.3 `waste_type` (master)
```
id, name   -- Dropping-1, Dropping-2, Hard Waste, Roving, Filter White,
           -- Filter Black, Sweep Waste, Microdust, Flap, Pneumafil, Damage Cotton
```

### 3.4 `waste_daily_ledger`
```
id                  pk
waste_type_id       fk -> waste_type
ledger_date         date
opening_kg          decimal
received_kg         decimal
delivery_transfer_kg    decimal
delivery_transfer_bags  int
weight_gain_loss_kg decimal
dumping_kg          decimal
closing_kg          decimal        -- computed, see formula 5.2
```
Same day-to-day carry-forward constraint as 3.2.

### 3.5 `shift_production`
```
id                  pk
production_date     date
section             enum  -- Carding, F.Drawing, Simplex, Ring, Auto Cone, Finished Yarn
shift_rc_kg         decimal
shift_ra_kg         decimal
shift_rb_kg         decimal
day_total_kg        decimal        -- computed = rc+ra+rb
```

### 3.6 `packing_production`
```
id                  pk
production_date     date
count_name          varchar   -- e.g. 34/1 KH
lot_no              varchar
production_kg       decimal
per_bag_kg          decimal   -- config, currently 50 kg for all counts — confirm if it ever varies
bag_count           int       -- computed, see formula 5.3
ring_machine_no     varchar   -- optional machine reference
```

### 3.7 `yarn_transfer_advice` (header) + `yarn_transfer_advice_line`
```
yarn_transfer_advice
  id                pk
  advice_no         varchar        -- e.g. "3337"
  advice_date       date
  prepared_by_id, prepared_at
  hod_approved_by_id, hod_approved_at
  store_incharge_id, store_received_at
  gm_approved_by_id, gm_approved_at
  status            enum(draft, hod_approved, store_received, gm_approved, locked)

yarn_transfer_advice_line
  id                pk
  advice_id         fk -> yarn_transfer_advice
  count_name        varchar
  lot_no            varchar
  first_bag_serial  int
  last_bag_serial   int
  bags_in_batch     int      -- computed, see formula 5.4
  loose_cone_kg     decimal
  total_weight_kg   decimal  -- computed, see formula 5.4
  remarks           text
```

### 3.8 `buyer` / `buyer_allocation`
```
buyer:  id, name
buyer_allocation:
  id, count_name, lot_no, buyer_id, allocated_kg, allocated_bags, allocation_date
```
Covers the "odd stock" / unassigned-yarn case: any produced stock not yet allocated to a buyer sits with `buyer_id = null`.

### 3.9 `working_calendar`
```
id, calendar_date, is_working_day (bool), note
```
Needed because every "avg per day" formula divides by *working* days elapsed, not calendar days.

### 3.10 `monthly_mis_summary` (materialized view / computed, not hand-entered)
```
month, year
opening_wip_kg, raw_material_input_kg, total_input_kg
closing_wip_kg, actual_consumption_kg
finished_yarn_production_kg
avg_production_per_day_kg
converted_production_per_day_kg   -- see 6.7, config-dependent
yarn_realization_pct
avg_count
working_days
total_waste_kg, total_waste_pct
```
Every field here should be derived by query from sections 3.2–3.7, not stored as a manual entry, so it can never go out of sync with the daily ledgers.

### 3.11 `approval_log`
```
id, document_type, document_id, role, user_id, action, timestamp, comment
```
Generic audit trail backing the workflows in section 7.

---

## 4. Referenced document types (what the system must be able to reproduce/print)

1. Daily Raw Cotton Receival, Consumption & Stock Report (from 3.1/3.2)
2. Daily Wastage Report (from 3.4)
3. Daily Shiftwise Production & Store Report (from 3.5/3.6, plus a snapshot of 3.2 and 3.4 totals)
4. Finished Yarn Transfer Advice Report (from 3.7)
5. Monthly MIS Report (from 3.10, plus the raw-material-consumption and finished-yarn-production breakdown tables)

All five should be generated views/exports, never separately re-keyed data entry screens.

---

## 5. Ledger balance formulas (verified against source documents)

**5.1 Raw cotton daily ledger**
```
closing_bales = opening_bales + received_bales - issued_to_prod_bales - delivered_bales
closing_kg    = opening_kg + received_kg - issued_to_prod_kg - delivered_kg
                + weight_gain_kg - weight_short_kg + tare_gain_kg - tare_loss_kg
avg_wt_per_bale_kg = received_net_kg / received_lot_bales
```

**5.2 Waste daily ledger**
```
closing_kg = opening_kg + received_kg - delivery_transfer_kg
             + weight_gain_loss_kg - dumping_kg
```

**5.3 Packing**
```
bag_count = production_kg / per_bag_kg          -- must be a whole number; error if not
```
Verified: 1350/50=27, 1500/50=30, 7450/50=149, 500/50=10, 8200/50=164 — all exact.

**5.4 Yarn transfer advice line**
```
bags_in_batch  = last_bag_serial - first_bag_serial + 1
total_weight_kg = bags_in_batch * per_bag_kg
```
Verified against source: 27/30/149/10/164 bags → 1350/1500/7450/500/8200 kg → totals 380 bags / 19,000 kg, which reconciles exactly with that day's packing production total.

**Constraint:** for a given count, the next batch's `first_bag_serial` must equal the previous batch's `last_bag_serial + 1`. Enforce as a hard validation, not a warning — gaps or overlaps mean either a missed batch or a duplicate.

**5.5 Section daily/average production**
```
day_total_kg          = shift_rc_kg + shift_ra_kg + shift_rb_kg
avg_kg_per_day(section) = cumulative_month_total_kg / working_days_elapsed
```
Verified: 578,705 / 30 = 19,290.17 (Carding); 545,068.51 / 30 = 18,168.95 (Finished Yarn).

**5.6 Monthly mass balance**
```
total_raw_material_input_kg = opening_wip_kg + raw_material_input_kg
actual_consumption_kg       = total_raw_material_input_kg - closing_wip_kg
yarn_realization_pct        = finished_yarn_production_kg / actual_consumption_kg * 100
total_waste_pct             = total_waste_transferred_kg / actual_consumption_kg * 100
avg_production_per_day_kg   = finished_yarn_production_kg / working_days
avg_count                   = sum(count_i * production_kg_i) / sum(production_kg_i)
```
Verified: 526,068.51 / 29 = 18,140.29; realization 85.96%; total waste 13.04%; avg count 27.44.

**Reconciliation identity:**
```
yarn_realization_pct + total_waste_pct ≈ 100%   (observed: 85.96 + 13.04 = 99.00)
```
Build this as a live check on month-end close. A gap larger than ~1–2% (beyond normal moisture/measurement variance) should block finalization until reviewed — it usually means a ledger entry is missing or miscoded.

**5.7 Per-waste-type percentage**
```
waste_type_pct = waste_type_kg / actual_consumption_kg * 100
```
Sums to a sub-total, then `+ damage_cotton_pct + invisible_wastage_pct = grand_total_waste_pct`. "Invisible wastage" is the balancing figure (moisture/dust/unaccounted loss) — compute it as `actual_consumption_kg - (finished_yarn_production_kg + sum(visible_waste_kg))`, don't let it be manually entered.

**5.8 Count-converted production ("78/1 converted production")**
This mill normalizes mixed-count output to a reference count for benchmarking. Do **not** guess the conversion-factor table — pull the exact factors your production team already uses on paper and store them as config (`count_conversion_factor` table keyed by count), since this is mill policy, not a universal formula.

---

## 6. Cross-document reconciliation rules (validation layer)

| Rule | Severity |
|---|---|
| Packing production total (kg & bags) for a day == that day's Yarn Transfer Advice total | Blocking |
| Sum of monthly `issued_to_prod_kg` (3.2) == monthly MIS raw material consumption table | Blocking |
| Sum of monthly `delivery_transfer_kg` (3.4) == monthly MIS waste-transferred table | Blocking |
| Day N closing stock == Day N+1 opening stock, per lot and per waste type | Blocking |
| `yarn_realization_pct + total_waste_pct` within tolerance of 100% | Blocking at month-close, warning otherwise |
| Bag count non-integer on packing entry | Blocking |
| Bag serial gap/overlap on transfer advice | Blocking |

---

## 7. Approval workflows

| Document | Chain | Notes |
|---|---|---|
| Finished Yarn Transfer Advice | Prepared By → HOD → Store Incharge (receipt) → GM | Locks on GM approval; corrections after lock need a new dated adjustment entry |
| Daily Wastage Report | Store Officer → M(Store) → GM → Director | |
| Daily Shiftwise Production & Store Report | Manager(Store) → GM → Director | |
| Monthly MIS | GM → Director | Should only be generatable once all daily ledgers for the month are fully approved |

Model as a configurable approval-chain per document type (role + order), not hardcoded per document — this mill's chain differs across the four document types.

---

## 8. Alerts

- Bag count doesn't divide evenly by standard bag weight
- Bag serial gap or overlap for a count/lot
- Ledger opening stock ≠ prior day's closing stock
- Realization % or waste % deviates from trailing 30-day average beyond a configurable threshold
- Raw cotton origin stock below reorder point
- Pending approvals older than a configurable age (dashboard, not just email)
- Weight gain/loss or tare adjustment entered without a reason code

---

## 9. Open questions to confirm with the client before/at build time

1. Does per-bag weight (currently 50 kg) ever vary by count? Confirm or make it per-count config regardless.
2. What is the exact conversion-factor table behind "78/1 converted production per day"?
3. Costing method for raw cotton issued to production: FIFO by receiving date, or weighted-average cost across open lots?
4. Working-day calendar: which days/holidays are excluded from "working days" in the avg-per-day formulas?
5. Acceptable tolerance band for the realization% + waste% ≈ 100% reconciliation check.
6. Does the buyer allocation ("Buyer-1/2/3", "Odd Stock") need to support partial-bag or partial-kg splits, or only whole-bag allocation?

---

## 10. Suggested build phases

1. **Schema + core ledgers** — entities 3.1–3.4, formulas 5.1–5.2, carry-forward constraint.
2. **Production & packing** — 3.5–3.6, formulas 5.3, 5.5.
3. **Yarn transfer & approvals** — 3.7, formula 5.4, workflow engine (section 7), serial-continuity constraint.
4. **Reconciliation layer** — section 6 validations wired into daily entry and month-close.
5. **Monthly MIS rollup & reporting** — 3.10, formulas 5.6–5.8, the five printable reports (section 4).
6. **Alerts & dashboards** — section 8.

---

## 11. Non-functional notes

- Every daily ledger row is append-only; corrections are new dated entries, never edits to a locked row.
- Full lot traceability: given a bag serial, must be able to trace back to the raw cotton lot(s)/origin(s) blended into it — needed for organic/BCI buyer certification requests.
- Role-based access control matching the approval chains in section 7.
- Shift-floor data entry currently happens on paper first (see the handwritten tally in your source photos) — consider a simple offline-tolerant entry mode for shift supervisors before it's typed into the daily report.