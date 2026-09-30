# Work Order & Log Production — Full Process

Covers two connected features on the Machine Overview page (`/production/mco`) and the
Work Order master (`/production/work-orders`): **planning** a work order across machines,
and **logging** production against it manually.

---

## 1. Why this exists

This plant's PLCs report machine **state** only (`Active` / `Idle` / `Inactive` /
`Maintenance` / `Fault`) — no piece counter, no shot counter, no encoder. That state feed
already works automatically (`machine_state_events`, written by node-server) and drives:
- The live "State Durations" panel on the Overview tab
- OEE **Availability** (state-based, fully automatic)

It does **not** and cannot drive:
- OEE **Performance** / **Quality** (both need actual piece counts)
- "What work order is this machine running right now"
- Any per-work-order production rollup

That data lives in `machine_production_counts` (good/scrap counts, bucketed in time,
tied to a work order + shift). With no counter hardware, nothing writes to that table
automatically — an operator or supervisor logs it manually instead. This is the standard
MES "manual data collection" pattern used wherever automated piece-counting isn't
available, run alongside automated state collection rather than replacing it.

---

## 2. Data model

```
work_orders                    ← the plan: product, target qty, status, schedule
   ↕ (belongsToMany)
work_order_machines            ← pivot: which machines this WO is planned across
   ↕
machines

machine_production_counts      ← the execution log: good/scrap counts in a time bucket,
                                  tied to one machine_id + one work_order_id + one shift_id
```

- A work order is **planned** across N machines via `work_order_machines` — set at
  create/edit time, independent of whether anything has run yet.
- A work order is **executed** on possibly a *different* set of machines/shifts, one
  `machine_production_counts` row per logged batch. Planned and executed can diverge
  (a WO can be planned for 3 machines but only actually logged on 2, for instance) —
  the UI shows both, never conflates them.

Key models: `App\Models\WorkOrder` (`machines()` — BelongsToMany), `App\Models\Machine`
(`workOrders()` — inverse), `App\Models\MachineProductionCount` (`machine()`,
`workOrder()`, `shift()`).

---

## 3. Process A — Plan a work order (multi-machine)

**Where:** `/production/work-orders` (sidebar: **Plan & Production Log** → **Work Orders**) → **New** / pencil-edit icon.

1. Pick **Product**, enter **Quantity** (target).
2. Pick **Machines** — multi-select (`ui5-multi-combobox`); a work order can be assigned
   to as many machines as needed, not just one.
3. Pick **Status** (`pending` / `in_progress` / `completed` / `cancelled`), optionally
   **Scheduled Start** / **Actual Start**.
4. **Submit.**

What happens server-side (`WorkOrderController::store` / `::update`,
`Backend/app/Http/Controllers/WorkOrderController.php`):
- Validates payload (`product_id`, `quantity`, `status`, `machine_ids[]`, …).
- Creates/updates the `work_orders` row.
- `$workOrder->machines()->sync($machineIds)` — replaces the pivot rows in
  `work_order_machines` to match exactly what was selected.

This goes through a **custom REST endpoint** (`POST /api/work-orders`,
`PUT /api/work-orders/{id}`), not OData — a many-to-many sync isn't a simple field
assignment, so it needed real logic (mirrors the validate → transaction → sync-collection
shape already used by `MachineConfigController`).

Reads (the list grid, the edit-dialog prefill) still go through OData:
`WorkOrders?$expand=product,machines`.

---

## 4. Process B — Log production (manual entry)

**Where:** Machine Overview page (`/production/mco?...`) → **Log Production** button,
top-right of the header (next to Machine Board / Configuration).

1. Click **Log Production**.
2. **Work Order** dropdown — populated from `GET /api/machine/{id}/work-orders`, which
   returns only work orders *planned for this specific machine* (via the pivot) with
   status `pending` or `in_progress`. A WO not assigned to this machine, or already
   `completed`/`cancelled`, won't appear here — nothing to log against.
3. **Shift** dropdown — the plant-wide shift master (`EmployeeShifts` OData, already
   exposed for HR — reused here rather than duplicating a shift concept).
4. Enter **Good Count** and **Scrap Count**.
5. **Submit.**

What happens server-side (`MachineController::logProductionCount`):
- Validates `work_order_id`/`shift_id` exist, counts are non-negative integers.
- **Confirms the work order is actually assigned to this machine** (rejects with 422
  otherwise — can't log against an unrelated WO just by guessing an id).
- Computes `total_count = good_count + scrap_count` server-side (never trusts a
  client-supplied total).
- Computes the bucket's time window: `bucket_started_at` = this machine's last bucket's
  `bucket_ended_at`, or **1 hour ago** if this is the machine's first-ever entry;
  `bucket_ended_at` = now. Buckets chain end-to-end with no gaps or overlaps.
- Inserts one `machine_production_counts` row.

**Immediately after submit**, the Work Order tab refreshes — no page reload needed. A
machine isn't limited to one open work order at a time (`work_order_machines` is a
genuine many-to-many pivot — a machine can be planned against several WOs simultaneously,
e.g. one product on the day shift and a different one on the night shift). The Work
Order tab reflects this directly:
- It lists **every** open (`pending`/`in_progress`) work order assigned to this machine
  (`app-machine-work-orders`), defaulting to whichever one was just logged (falling back
  to the first open WO if that one isn't open anymore).
- Selecting a work order from that list shows its full detail (`app-work-order-detail`):
  header (target/scheduled/actual/planned machines), an overall progress bar
  (`good / target`, capped at 100% server-side), and the **Machines & Shifts** grid —
  one row per distinct machine+shift that has ever logged against *that* WO, with
  good/scrap/total and first/last-logged timestamps.

See [MACHINE_WORK_ORDERS_COMPONENT_CONTEXT.md](shared/MACHINE_WORK_ORDERS_COMPONENT_CONTEXT.md)
for the list+detail component itself, and
[MACHINE_OVERVIEW_COMPONENT_CONTEXT.md](shared/MACHINE_OVERVIEW_COMPONENT_CONTEXT.md) for
why the page header no longer highlights a single "current work order" (removed —
misleading once a machine can have more than one open at a time).

---

## 5. Full walkthrough, start to finish

1. **Plan**: create WO-000X for Product P, qty 500, assign Machine A + Machine B.
2. Nothing shows up on either machine's Overview page yet — planning alone doesn't
   populate "current work order" (that's execution-only, by design; see §7).
3. **Operator at Machine A**, end of shift R/A: clicks **Log Production** on Machine A's
   `/mco` page, picks WO-000X, picks R/A, enters good=210, scrap=8, submits.
4. Machine A's Work Order tab now lists WO-000X (auto-selected, since it's the
   machine's only open WO and its latest logged one) with progress 210/500 (42%),
   one row (Machine A, R/A, 210/8/218).
5. **Operator at Machine B**, shift R/B: same WO-000X, different machine/shift,
   good=180, scrap=5.
6. Either machine's Work Order tab — with WO-000X selected in its list — now shows
   **two** rows (Machine A/R/A and Machine B/R/B), combined totals 390 good / 13 scrap /
   403 total, progress 78%. If either machine also has other open work orders assigned,
   they appear alongside WO-000X in that machine's list, switchable independently.
7. OEE Performance/Quality on each machine's Overview tab now compute for real (they
   were null/0 before any counts existed for that machine).

---

## 6. Backend split: Laravel (CRUD) vs node-server (calculations)

Every read-heavy calculation endpoint this page uses was moved from Laravel to **node-server**
(NestJS/Prisma) after this feature was first built — node-server already owns the write side of
`machine_state_events`/`machine_production_counts` (MQTT/API/MODBUS ingestion), so calculation
endpoints over those tables now live next to their writer instead of being duplicated in Laravel.
**Work-order CRUD, the assigned-work-orders pick-list, and the manual production-count POST stay
in Laravel** — none of that is a "calculation", it's a write or a simple filtered read.

| Concern | Lives in |
|---|---|
| WO create/update (`store`, `update`) | Laravel — `Backend/app/Http/Controllers/WorkOrderController.php` |
| WO execution rollup (`detail`) | **node-server** — `node-server/src/module/machine/work-order-detail.{service,controller}.ts`, route `GET /api/work-orders/{id}/detail` |
| Assigned-WOs pick-list (`assignedWorkOrders`) | Laravel — `Backend/app/Http/Controllers/MachineController.php`, route `GET /api/machine/{id}/work-orders` |
| Manual production-count log (`logProductionCount`) | Laravel — same controller, route `POST /api/machine/{id}/production-count` |
| OEE overview, current work order, shift breakdown | **node-server** — `node-server/src/module/machine/machine-calculations.{service,controller}.ts`, routes `GET /api/machine/{id}/overview`, `GET /api/machine/{id}/current-work-order`, `GET /api/machine/{id}/shift-breakdown` |

Both node-server calculation controllers are wired into `AppModule` via a dedicated
`CalculationsModule` (not nested under node-server's existing `/api/machine` `RouterModule` tree,
to avoid a double `/api/machine/api/machine/...` prefix). Response JSON shapes were kept
byte-identical (snake_case) to what Laravel used to return, so `machine-overview-data.service.ts`'s
mapping code needed no changes beyond the URL and the `isv8` flag — see
[MACHINE_OVERVIEW_DATA_SERVICE_CONTEXT.md](shared/MACHINE_OVERVIEW_DATA_SERVICE_CONTEXT.md#backend-split-laravel-vs-node-server).

---

## 7. Where things live (reference)

| Concern | File |
|---|---|
| WO plan (create/update) | `Backend/app/Http/Controllers/WorkOrderController.php` (`store`, `update`) |
| WO execution rollup | `node-server/src/module/machine/work-order-detail.service.ts` |
| Assigned-WOs + manual log endpoints | `Backend/app/Http/Controllers/MachineController.php` (`assignedWorkOrders`, `logProductionCount`) |
| OEE overview / current-work-order / shift-breakdown | `node-server/src/module/machine/machine-calculations.service.ts` |
| Pivot migration | `Backend/database/migrations/2026_07_15_130000_create_work_order_machines_table.php` |
| `WorkOrder` model | `Backend/app/Models/WorkOrder.php` (`machines()`) |
| `Machine` model | `Backend/app/Models/Machine.php` (`workOrders()`) |
| Laravel routes | `Backend/routes/api.php` — `work-orders`, `work-orders/{id}`, `machine/{id}/work-orders`, `machine/{id}/production-count` |
| node-server routes | `node-server/src/module/machine/calculations.module.ts` — `machine/{id}/overview`, `machine/{id}/current-work-order`, `machine/{id}/shift-breakdown`, `work-orders/{id}/detail` |
| Work order form (multi-machine picker) | `Frontend/.../production-management/production-plan-log/work-order-management/work-order-form/` |
| Work order list | `Frontend/.../production-management/production-plan-log/work-order-management/work-order-list/` |
| Machine Overview page (tabs, header chip, Log Production button, Shift Breakdown grid) | `Frontend/.../production-management/shared/components/machine-overview/` |
| Work Order tab content | `Frontend/.../production-management/shared/components/work-order-detail/` |
| Log Production dialog | `Frontend/.../production-management/shared/components/log-production-entry/` |
| Frontend data service | `Frontend/.../production-management/shared/services/machine-overview-data.service.ts` |

---

## 8. Known gaps / deliberate non-goals

- **"Current work order" is execution-only, not planning-only.** A WO planned for a
  machine but never logged against it will *not* show as that machine's current work
  order. This is intentional (matches "what's actually running", not "what's scheduled")
  but is a common point of confusion — planning ≠ execution.
- **No live polling.** The header chip / Work Order tab refresh on page load and right
  after a manual log — not on an interval. If two operators are logging against the same
  WO from different machines simultaneously, each only sees the update after their own
  submit or a manual refresh.
- **Global search on the Work Order list excludes machine name.** Combining a to-one
  `any()` filter (`product.product_name`) with a to-many `any()` filter
  (`machines.machine_name`) in one OR expression breaks Lodata's SQL generation (confirmed
  bug, third-party library limitation). Search by WO number / product still works; filter
  by machine via the **Machines** column's own filter instead.
- **RoadRunner requires a restart after any Laravel code change** in this dev
  environment — it's long-lived workers, not per-request PHP-FPM. If a Laravel endpoint
  (WO create/update, assigned-WOs, manual log) 404s or old logic seems to persist after
  an edit, restart it (`kill <rr pid>` then relaunch with `APP_BASE_PATH` set — see any
  recent session for the exact command).
- **node-server's serving process also needs a manual restart after any calculation-endpoint
  change.** `nest start --watch` only recompiles `dist/`; the actual serving process is a
  separately-running `node --enable-source-maps dist/src/main` that does not auto-restart
  on a successful watch-recompile. If `overview`/`shift-breakdown`/`current-work-order`/WO
  `detail` 404s or serves stale logic, confirm which PID is actually bound to node-server's
  port (`ss -ltnp`) and kill+relaunch that process, not the watch process.
