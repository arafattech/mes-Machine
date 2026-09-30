# Machine Overview — Missing Inputs

What still needs to be entered/configured/built before each currently-zero/N/A value on `/production/mco` becomes real. Checked against actual DB schema, backend validation, and frontend forms as of 2026-07-07 — not assumptions.

---

## 1. Max/Min RPM, Max/Min Temp (`Machine Details` card)

**Shows today:** "Not configured" for most machines (real DB value is `null`).

**DB:** `machine_has_configs.max_rpm / min_rpm / max_temp / min_temp` — columns already exist, already validated by `MachineConfigController::validatePayload()` (`Backend/app/Http/Controllers/MachineConfigController.php`), already OData-exposed as `MachineHasConfigs`, already read correctly by the frontend (`machine-overview-data.service.ts::getSpecs`).

**Gap: pure UI gap, backend is ready.** `MachineConfigComponent` (`Frontend/src/app/modules/base-data-management/machine-management/machine-config/machine-config.component.ts` + `.html`) — the create/edit form for `machine_has_configs` — has no input fields for these 4 columns. They only exist as hidden AG Grid columns (`hide: true`, lines 227–257) in the list view, never bound to the form.

**To fix:** add 4 numeric inputs (Max RPM, Min RPM, Max Temp, Min Temp) to `machine-config.component.html`'s form, bind to the existing `MachineConfig` model fields. No backend or migration work needed — submit already goes through `POST/PUT machine/configs` which already accepts these fields. Smallest gap on this list.

---

## 2. M/C Performance tile

**Shows today:** `0%` (backend returns `null`, mapped to 0).

**Formula:** `Performance = (total_count × ideal_cycle_seconds) / active_seconds × 100`, computed in `MachineController::overview`.

**Needs two things, both currently missing:**

**a) `machine_has_configs.ideal_cycle_seconds`** — column exists (added this session, migration `2026_07_07_100000_...`), but:
- Not in `MachineConfigController::validatePayload()`'s accepted field list — backend will silently drop it if sent.
- Not in `MachineConfigComponent`'s form at all.
- **To fix:** add `ideal_cycle_seconds` to `validatePayload()`'s validation rules, add one numeric input to the config form.

**b) Real shot counts in `machine_production_counts`** — node-server writes this now (`recordProductionShot` in `machine.worker.ts`), but only accumulates going forward from when that code deployed. Needs the node-server to actually be running against a machine with `read_from` wired to real signals, and time to accumulate. No action needed beyond deployment + time, but won't show non-zero until then.

---

## 3. Quality tile

**Shows today:** `0%` (no total_count yet) — will show `100%` once shots start recording, since `scrap_count` is hardcoded to 0.

**Formula:** `Quality = good_count / total_count × 100`.

**Gap: no reject/scrap signal exists anywhere.** `machine.worker.ts::recordProductionShot` always passes `isGood: true` — there is no discrete input, register, or channel anywhere in node-server's acquisition layer that distinguishes a good part from a scrap part. This was flagged as an open decision in the earlier enhancement plan and never resolved.

**Two ways to close this gap — needs a decision, not just code:**
- **(a) Hardware:** add a dedicated reject-counter channel (same pattern as the existing shot-counter channel in `channel-mapping.service.ts` / `config_has_channels`), wired to a real reject-sensing signal on each machine's PLC. Real-time, automatic, but needs physical/PLC config work per machine.
- **(b) Manual QA entry:** `quality_inspections` table already exists (`Backend/app/Models/QualityInspection.php`, has `defect_count`, links to `work_order_id`, already OData-discovered) but **no UI exists anywhere in the app to create a row in it.** Would need a small form (e.g. in QA & QC module) for inspectors to log defect counts per work order/machine, then wire `MachineController::overview`'s Quality calc to also pull from this table instead of (or blended with) `machine_production_counts.scrap_count`.

No code changes to the overview page itself are needed once one of these paths is picked — this is a data-source decision plus (a) hardware/PLC work or (b) a new small CRUD form.

---

## 4. Production Overview (Target / Achieved / Good Units / Wastage)

**Shows today:** all `0`.

**Achieved / Good Units / Wastage** — driven by `machine_production_counts` (same table as #2b above). Same status: code path exists and is writing, just needs deployment time + real shot volume. Wastage will stay 0 until #3 (scrap signal) is resolved, same caveat.

**Target** — driven by `machine_production_targets`, which is **completely empty and has zero UI to populate it anywhere in the app** (confirmed: no component or service in `Frontend/src` references `MachineProductionTargets` at all). This is the biggest gap on this list — the table, model (`Backend/app/Models/MachineProductionTarget.php`), and OData entity all exist, but nothing writes to it.

**To fix:** needs a new form (likely in Production or Base Data module) to create a target: `machine_id`, optional `work_order_id`/`shift_id`, `target_qty`, `effective_from`/`effective_to`. Genuinely new UI + a controller endpoint (or direct OData `POST` if permissions allow) — not a small add like #1.

**Also unresolved:** whether target should be this explicit manual entry, or auto-derived from `work_orders.quantity` prorated to a shift — flagged as an open decision in the original enhancement plan, never answered.

---

## Summary — smallest to largest gap

| # | Item | Type of gap | Size |
|---|---|---|---|
| 1 | Max/Min RPM/Temp | Frontend form fields only, backend already ready | Small |
| 2a | `ideal_cycle_seconds` | Backend validation + 1 form field | Small |
| 2b | Shot counts accumulating | Deployment + time, no code | None (waiting) |
| 3 | Good/scrap distinction | Decision + hardware channel OR new manual-entry form | Medium–Large (depends on decision) |
| 4 | Production Target | New form + new endpoint, target semantics undecided | Large |

Say which of these to build first.
