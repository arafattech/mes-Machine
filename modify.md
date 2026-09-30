# MES — Modify Plan (Frontend + Backend + Node-server + python-server)

> **Status: REMOVAL DONE** (Phases 0–7). Build checks pass. Runtime smoke test (Phase 0 list) is left to you — node-server and dev servers were never started. Nothing is committed.

---

## 0. Result summary (DONE)

| Area | Result |
|---|---|
| `production-management/**`, `base-data-management/**` | **0 files changed** (verified with `git status`) |
| Frontend | **DONE** — `store`, `sales`, `purchese`, `task` modules deleted; `hr-management` reduced to 15 files; 5 routes → Coming Soon; 4 dashboard tile clicks → Coming Soon (all 7 tiles still shown); removed-module docs + path aliases deleted. `ng build` passes |
| Backend | **DONE** — routes 208 → 91 (no route added; all kept routes identical); 93 PHP files deleted; Lodata entities/relations of removed modules dropped; dead controller methods removed. All PHP lints clean, `route:list` OK |
| node-server | **DONE** — `biometrics`, `hrm`, `sales-forecast`, `odata` layer, store/hrm/sales notification handlers, baseline-dead files (`ai`, `config/db`, `config/http`, `config/services`, `media`, `shared/lib`, app controller/service) deleted; 12 unused packages removed; `tsc --noEmit -p tsconfig.build.json` passes; `npm ci --dry-run` passes |
| `python-server/`, `scripts/sync-attendance-overtime.js`, `.pytest_cache/` | **DONE** — deleted |
| DB / migrations / Prisma schema / `composer.json` | **Untouched** (B2, B3 defaults) |
| Commits | **None made** — everything is in the working tree; `git checkout`/`git restore` reverts any part |

### Deviations from the plan (what actually happened)

| Plan said | What I did instead, and why |
|---|---|
| Keep a slim `hr-management.module.ts` if orphan build error | The slim module was not reachable from `main.ts`, so the build still failed. **Made the 2 kept hr components standalone** (`imports: [CommonModule, SharedModule]`) and deleted `hr-management.module.ts` entirely |
| `approval-types/by-code/*` routes kept | Only store/hr screens used them (kept Frontend uses `approval-types/{id}/approvers` only). **Removed both routes**, simplified `ApprovalTypeController` to `approvers` + `associate` |
| Backend `employee-log/export-*` "verify" | Kept: base-data employee list calls `employePayrollStatus`, `employee-log/export-pdf`, `employee-log/export-list-pdf`. `EmployeePayrollController` trimmed to those 3 + helpers; the `payroll`/`payslip-*` PDF views deleted |
| `pdf/generate`, `employee/blacklist*` "verify" | No kept caller → routes and methods removed |
| node-server `AuthMiddleWare` edit | `forRoutes` now only `api/machine/*path`, `api/work-orders/*path` |
| `ProductionLotCount::adviceLines()` | Not in plan: removed this dead relation (pointed to the deleted store `YarnTransferAdviceLine`) |
| `@types/multer` | Kept — the kept import module uses `Express.Multer.File` |

### Still in the code on purpose (kept because kept code references it)

- **Backend hr models** `Payroll`, `PayrollHistory`, `AttendanceLog`, `LeaveRequest`, `LeaveDate`, `LeaveType`, `Roster`, `ShiftOverrides`, `Holiday*`, `Notice`, `EmployeeBonus`, `BonusType`, `BonusConfig`, `EmployeeWeekend`, `EmployeeHolidaySwap`, `TaxRule`, `EmployeeSalary`, `EmployeeShift` and `hrModule/OvertimeBonusService`, `EmployeeRosterService` — referenced by the `Employee` model's relationships and by the kept employee-log/payroll-status endpoint. They are no longer exposed through Lodata.
- **Backend `Material`, `QualityInspection`, `ProductionLine`, `MachineAssignment`, `MachineSensorData`** — production/base-data models, still in Lodata.
- **`bootstrap/providers.php` → `App\Providers\IdGeneratorServiceProvider`** — this class does not exist in the repo (already the case before my changes). Not touched.
- **node-server `config/redis`** OData-cache helpers (`RemoveRedisCache`, `CreateRedisCache`, `GetRedisCache`) — harmless leftovers, file is shared infrastructure.

### Needs your attention

1. **Revoke/rotate the API token** that was hard-coded in the deleted `scripts/sync-attendance-overtime.js` — it is still in git history (`3e655ec`).
2. `node-server/.env.example` contains what looks like a real LAN database URL with credentials (`DATABASE_URL=...@192.168.100.216...`). Consider replacing it with a placeholder.
3. Run the runtime smoke test yourself (Phase 0 list): login, dashboard tiles, `/production` board + `/mco`, `/base-data` CRUD, employee excel import, department notification, roles-permissions, user management.
4. `bitbucket-pipelines.yml` and `deploy-frontend.sh` are still untracked (not modified by me).
5. Nothing is committed. Review with `git status` / `git diff --stat`, then commit when you are happy.

---

## 1. Goal

1. `Frontend/src/app/modules/production-management` and `Frontend/src/app/modules/base-data-management` — **no file inside these 2 modules changes.**
2. Keep whatever Frontend / **Backend (Laravel)** / **node-server** code these 2 modules need to keep working.
3. Remove everything else — **Frontend, Backend, node-server, python-server, scripts, docs.**

> base-data stays exactly as-is (product, employee, supplier, client, asset ... all pages). So the **API / OData entity / DB relations behind those pages stay in the Backend.** Only things that nothing kept uses (hr, store, purchase, sales ...) are removed.

## 2. Repo constraints that apply to this work (from `CLAUDE.md`, `.claude/rules/*`)

| Rule | Effect on this plan |
|---|---|
| **Never run `php artisan migrate`** (or `migrate:fresh` / `rollback`) | No migration runs. Migrations are not touched anyway (Section 7) |
| **Never start, stop or restart `node-server`** (or any long-running process) | Verification of node-server = `nest build` + `tsc --noEmit` + lint + static grep. **No live run.** You do the runtime smoke test |
| No dead code, no commented-out blocks | Supports removing unused code rather than commenting it |
| Preserve existing behavior / API contracts unless the task changes them | Only the removed features' routes/events go away; all kept contracts stay byte-for-byte |
| After change: fix TS errors, lint, verify build | Every phase ends with a build/lint check |

## 3. What does not change

| Item | Status |
|---|---|
| `production-management/**`, `base-data-management/**` (Frontend) | Zero edits |
| `Permissions` enum (Frontend), Laravel `Enums/Permission`, `PermissionRegistry`, permission seeders | Untouched — role permissions do not change |
| `PermissionGuard`, role-permission screen + API | Untouched |
| DB data, DB tables, **migration files** | Untouched (Section 7) |
| `/var/www/html/mes` (older original repo) | Untouched |
| `scripts/deploy-backend.sh`, `deploy-node.sh`, `restart-servers.sh`, `bitbucket-pipelines.yml`, `deploy-frontend.sh`, `run.sh` | Kept (Section 6.5) |

## 4. Frontend

Method: import graph from `main.ts` (regex script, with the 5 module lazy routes in `app.routes.ts` cut off) — **236 files reachable.**

| Module | Total files | Delete | Keep |
|---|---|---|---|
| `store-management` | 76 | 76 | 0 |
| `sales-management` | 48 | 48 | 0 |
| `purchese-management` | 23 | 23 | 0 |
| `task-management` | 8 | 8 | 0 |
| `hr-management` | 190 | 175 | **15** |

**15 files kept in hr-management — and why:**

| File | Reason |
|---|---|
| `shared/services/shiftResolver.service.ts`, `shared/models/employeeShift.ts`, `shared/utilities/dateTime-format.ts` | Global `shared/components/layout` |
| `shared/models/employeeHasAsset.ts`, `EmployeeSalary.ts`, `attendance.ts` | `shared/model/employee.ts` |
| `shared/models/employeeSection.ts`, `employeeType.ts`, `designation.ts` | base-data `employee-form` |
| `employee-type-management/`, `designation-management/` (3 files each) | Imported by base-data routing |

**Dashboard (home page `/`) — everything it shows stays.** All 7 tiles remain visible exactly as today (Base Data Management, Production, Purchase, Store Management, QA & QC, HR Management, Sales & Marketing): same titles, icons, layout, header (date, language, settings, notifications, user) and the same permission-based tile filtering (`permissionGroupMap` / `hasModuleAccess`). Nothing is removed from the dashboard. The only change: the click target of the 4 tiles whose module is removed (Purchase, Store, HR, Sales) becomes `/coming-soon` — the same behaviour QA & QC already has. Without this, clicking those tiles would land on a dead route.

Other Frontend edits (outside the 2 modules): `app.routes.ts` (5 lazy routes → `ComingSoonComponent`), `dashboard.component.ts` (4 tile `url` values only → `/coming-soon`).

**Orphan risk:** the 2 kept hr components are non-standalone and declared in `HrDataManagementModule`. Deleting that module leaves them orphaned. Ivy is expected not to error on orphan components; confirm with a build. If it errors, keep a slim `hr-management.module.ts` that only declares them.

**Frontend docs (`Frontend/docs/`):** remove `hr-management/`, `purchase-management/`, `sales-marketing/`, `store-management/`, `employee-payroll.component.html`. Keep `base-data/`, `production-management/`. Verify `shared-components/` and `production/implementation-plan-yarn-store-submission.md` (yarn lots / store — Upcoming feature) before deciding.

## 5. Backend (Laravel) — `Backend/`

### 5.1 Method (dependency-driven, same as Frontend)

1. **Route inventory:** `php artisan route:list --json` — **before** and **after** (PHP 8.2 and `vendor` are present; this does not start a server).
2. **Kept callers:** every endpoint the kept Frontend (236 files) and the kept node-server modules call (Section 6.1).
3. **Class closure:** kept route → controller → service / model / observer / export / import / enum (via `use`, `::class`, relationship methods). A file **outside** this closure is a removal candidate. A file **inside** it is **kept**, even if its name looks like hr/store.
4. **Lodata entities:** `Lodata::discover(...)` calls in `AppServiceProvider` — remove entities that neither the kept Frontend nor node-server uses.

### 5.2 Route group classification (`routes/api.php`)

| Group | Decision | Note |
|---|---|---|
| `login`, `auth`, `logout` | **KEEP** | |
| `permissions*`, `remove/permissions` | **KEEP** | Role permissions |
| `users*`, `add/user`, `edit/user`, `change-password` | **KEEP** | `add/user` is also called by node-server employee import |
| `notifications*`, `activity-logs/read` | **KEEP** | Global notifications (Frontend `shared`) |
| `product/associate`, `employee/associate`, `employee/group-associate`, `employee/bulk-status-update`, `client/associate`, `hall/associate`, `machine/associate` | **KEEP** | Base-data |
| `approval-types/*`, `approval-type/employee-associate` | **KEEP** (partial) | Approver management. `requisitions/{id}/approver-*` is store → **REMOVE** |
| `image-upload`, `generate-id`, `product-barcode`, `ProductHasvariants/DeleteByProduct` | **KEEP** | Base-data |
| Import/Export: `employees`, `item`, `clients`, `suppliers` | **KEEP** | Used by base-data lists |
| `machine/*`, `machines`, `machine/configs`, maintenance, `maintenance-schedules` | **KEEP** | Production |
| `machine/{id}/work-orders`, `production-count`, `production-logs`, `wastage-logs*`, `work-orders*`, `production/lot-batches*` | **KEEP** | Production (routes stay even if the UI becomes "Upcoming") |
| `employePayroll*`, `generatePayroll`, `exportPayroll*`, `payrolls/*`, `payrollcalculate`, `employee-bonuses/*` | **REMOVE** | HR payroll |
| `employee/blacklist*` | **REMOVE / verify** | HR — check whether base-data employee list calls it |
| `employee-log/export-*` | **verify** | Kept Frontend calls it, but it lives in the payroll controller — the method may need to be moved out and kept |
| `hrm/*` (holidays, weekends, notices, rosters, shift-overrides, leave, analytics, attendance, bonus-configs, promotions) | **REMOVE** | HR module |
| `side-bills*` | **REMOVE** | HR |
| `store/*` (requisition, MRR, returns, ledger, yarn-advices, reminders ...) | **REMOVE** | Store |
| `purchase/*` | **REMOVE** | Purchase |
| `sales/*` | **REMOVE** | Sales |
| `pdf/generate` | **verify** | No caller found in kept Frontend |
| `internal/attendance/*`, `internal/roster-schedule` (+ `VerifyInternalServiceToken`) | **REMOVE** | Used only by node-server biometrics (Section 6.3) |

### 5.3 Code (final list decided by the closure script — expected result)

| Area | Expected REMOVE | Expected KEEP |
|---|---|---|
| Controllers | `Store/*` (9), `Purchase/*` (3), `Sales/*` (2), `EmployeeRoster/`, Attendance*, Bonus*, HrmDashboard*, Leave*, Notice, Reminder, Promotion*, SideBill*, EmployeeHoliday, EmployeePayroll (partial), bonus export | Auth, User, RolePermission, Employee (partial), Client, Hall, Machine*, WorkOrder, ProductionLot*, Product, Media, id generator, Notification*, ApprovalType (partial) |
| `Services/` | `hrModule/*` (7), `Store/*`, `Purchase/*`, `Sales/*`, `BagSerialService` (verify) | `Machine*`, `ProductionLot*`, `NotificationService`, `PermissionRegistry` |
| `Observers/` | `LeaveRequest`, `Roster`, `PurchaseRequisition`, `MaterialReceipt`, `SalesOrder`, `Reminder` | `Department` |
| `Exports/`, `Imports/` | Attendance, Payroll, PromotionHistory, RawCotton, Rosters, SideBills, StockLedger, EmployeeBonuses | Employees, Clients, Suppliers, Item (export + import) |
| `Models/` | Store/* (15), Purchase/* (4); hr: AttendanceLog, BonusConfig/Type, EmployeeBonus/Blacklist/HolidaySwap/Weekend, Holiday*, Leave*, Notice*, Payroll*, Policy, Promotion*, Roster, ShiftOverrides, SideBill, TaxRule, Reminder; SalesOrder/SaleOrderItem, MarketPrice, ItemPricePlanning, BiometricsDeviceConfig, RequisitionApproval | All base-data + production models |
| `Enums/` | `Store/*`, `Purchase/*` | `Permission`, `Machine`, `Production` |
| `AppServiceProvider` | `Lodata::discover` + observer registration of removed models | Kept entities |
| `database/seeders/` | `SalesForecast*`, `SalesAnalyticsDemo`, `HolidayTypes`, `BonusType` (verify) | `PermissionSeeder`, `Role`, `User`, `MachineStates`, `IdGenerator`, `Approval`, `Btl*` |

**Gray zone (KEEP if a kept model has a relationship to it):** `Employee` model → `EmployeeSalary`, `EmployeeShift`, and possibly `Payroll`, `AttendanceLog`, `Leave*` — the closure script will show. `Material`, `QualityInspection`, `ProductionLine`, `MachineAssignment`, `SalaryType` — not used by the kept Frontend but registered in Lodata; remove if no relationship points to them.

## 6. node-server (`node-server/` — NestJS 11 + Prisma 5 + BullMQ + Socket.IO + MQTT/Modbus)

Method: import graph from `src/main.ts` (88 `.ts` files), plus a check of what the kept Frontend actually calls, plus Prisma model usage per module.

### 6.1 Contract: what the kept Frontend uses from node-server (verified from the 236 kept files)

| Channel | Used by | Node-server piece |
|---|---|---|
| HTTP `GET api/machine/:id/overview`, `shift-breakdown`, `daily-production`, `current-work-order` | `machine-overview-data.service` (production) | `module/machine` (calculations) |
| HTTP `GET api/work-orders/:id/detail`, `wastage-detail` | same | `module/machine` (work-order detail/wastage) |
| HTTP `POST api/import/employees` + socket `employee-import:progress\|completed\|failed` | base-data `employee-list` (excel import, `isv8=true`) | `module/import` (BullMQ queue) |
| Socket in: `to_frontend`, `machine_status_runtime`, `machine_maintenance_recount` | machine board, `machine-duration.service` | `module/machine` runtime |
| Socket in: `notification:new` | global notification component | `module/notification` |
| Socket out: `base-data-department:created\|updated\|deleted` | base-data `department-management` | `module/notification` |
| **`odata/v8/*` (generic Prisma OData)** | **No caller in the kept Frontend** (`custom.service.ts`, the only other v8 client, is itself unreachable) | `module/odata`, `middleware/odata/**` |
| Laravel → node: Redis maintenance override | Laravel `MachineMaintenance*` | `module/machine` runtime |

### 6.2 Module classification

| Path | Decision | Reason |
|---|---|---|
| `module/machine/**` (machine, calculations, work-order-detail/wastage, `runtime/**`, `sync-engine/`, `docs/`) | **KEEP** | Live board, `/mco` OEE, work-order rollup, MQTT/API/MODBUS |
| `module/machine/runtime/machine.worker.ts` | **KEEP** | Loaded dynamically (`new Worker(join(__dirname,'machine.worker.js'))`) — the import-graph script misses it; legacy per-machine worker path |
| `module/import/**` | **KEEP** | Employee excel import (kept base-data). Uses Redis/BullMQ, Prisma employee tables, and calls Laravel `add/user` via `LARAVEL_URL` |
| `module/notification/notification.service.ts` | **KEEP, trim** | Keep only `base-data-department:*` listeners + broadcasts. **Remove** `store-requisition:*` (3), `store-localrrm`, `store-importedmrr`, `store-mrr`, `store-spr:*` (3), `store-reminder:*` (2), `hrm-leave:*` (5), `hrm-notice`, `sales-order:*` (4) |
| `module/notification/notification.controller.ts` (`POST notification/store-requisition`), `route.ts` | **REMOVE the controller route** | Store-only. Module + service stay |
| `config/redis`, `config/socket`, `config/lib/BigIntPerser.ts`, `prisma/prisma.service.ts`, `middleware/auth`, `main.ts`, `app.module.ts`, `routers/api.route.ts` | **KEEP** (edit `app.module`, `api.route`) | Infrastructure |
| `module/biometrics/**` (7 files + `queue/`, `device/`, ZKTeco) | **REMOVE** | HR attendance device. Paired with Laravel `internal/*` routes + `RosterObserver` |
| `module/hrm/employee-weekends/**` | **REMOVE** | HR |
| `module/sales-forecast/**` | **REMOVE** | Sales; calls python-server |
| `module/odata/**`, `middleware/odata/**` (incl. `QueryBuilder`, `BatchQueryBuilder`, `lib/*`, `protected/*`) | **REMOVE (D6)** | No kept-Frontend caller; `QueryBuilder` only feeds the OData module. Verify no external caller first. `AuthMiddleWare` stays (still guards `api/machine/*`, `api/work-orders/*`); edit its `forRoutes` to drop `odata/v8/*path` and `api/hrm/*path` |
| Already dead at baseline: `ai/google`, `ai/ollama` (2), `app.controller/service/spec`, `config/db/mongo` + `mysql` (2), `config/http`, `config/lib/QueryString.ts`, `config/services/prisma` (2), `module/media` (3; `MediaModule` is not imported), `shared/lib/**` (6) | **REMOVE candidates (D7)** | Unreachable even before any removal. Each needs a grep for dynamic / string references first (`machine.worker.ts` was a false positive of the same check) |
| `package.json` | Cleanup last | Drop only packages confirmed unused after removal (candidates: `mongoose`, `@google/generative-ai`, `nodemailer`, `jsonwebtoken`, `@nestjs/jwt`, `passport*`, `bcrypt`, `multer`, `sharp` — verify each; ZKTeco client if any) |
| `.env.example` | Edit | Remove `INTERNAL_SERVICE_TOKEN`, `PYTHON_SERVER_*`, `ZKTECO_*`, `LARAVEL_TOKEN` (unused). **Keep** `LARAVEL_URL` (employee import), `AUTHENTICATION_FROM_NODE`, `SERVER_PORT`, `MYSQL_*`, `DATABASE_URL`, `CHANNEL_*`, `MACHINE_*`, `ODATA_CACHE_*` only if odata is kept (D6) |

### 6.3 Backend ↔ node-server coupling (change together)

| Feature | Backend side | Node side | Decision |
|---|---|---|---|
| Machine maintenance override (Redis `SREM`) | `MachineMaintenanceService`, `MachineMaintenanceOverrideSignal` | machine runtime | **KEEP both** |
| Biometrics attendance | `internal/*` routes, `VerifyInternalServiceToken`, `RosterObserver`, `EmployeeRosterService`, `DailyAttendanceService` | `module/biometrics`, `attendance-checkout.queue`, Redis roster cache | **REMOVE both together** |
| Employee import | `add/user` (kept) | `module/import` (kept) | **KEEP both** |

### 6.4 Prisma schema (`prisma/schema.prisma`, 178 models)

Relation-closure from the models kept code touches (machine\*, work_orders, employees family, departments, designations, employee_shifts, ...) = **152 of 178 models**. The 26 outside it are mostly framework tables (roles, permissions, sessions, jobs, cache, migrations, langchain\_\*) plus `asset_groups`, `capacities`, `handling_units`, `items`, `materials`, `storage_locations`, `biometrics_device_configs`, `activity_logs`. Pruning them means editing kept models' relation fields and breaking the `db pull` workflow for ≈15% gain. **Recommendation: leave the schema untouched** (B3).

### 6.5 python-server, scripts, root files

| Item | Decision | Reason |
|---|---|---|
| `python-server/` (forecast + face recognition) | **REMOVE whole directory** (D8) | Callers are only `module/sales-forecast` (removed) and the hr face-recognition UI (removed). Nothing kept calls it. Also drop `.pytest_cache/` if tracked/present |
| `scripts/sync-attendance-overtime.js` | **REMOVE** | HR attendance. **Contains a hard-coded Bearer token committed in git — revoke/rotate that token regardless** (Section 10) |
| `scripts/deploy-backend.sh`, `deploy-node.sh`, `restart-servers.sh` | **KEEP** | Deployment of kept services |
| `bitbucket-pipelines.yml`, `deploy-frontend.sh`, `run.sh` | **KEEP** | No python-server step exists. Both are currently untracked in git — decide whether to commit them |
| `CLAUDE.md`, `.agent/AGENTS.md` repo map | **EDIT** | Mentions `node-backend/` (does not exist) and `python-server/` (removed) |
| `.claude/`, `.agent/`, `.github/` | **KEEP** | Tooling config |

## 7. DB (**destructive — separate step, only with explicit approval**)

| Item | Plan |
|---|---|
| Migration files (293) | **Not deleted.** A fresh install would hit broken FKs; `migrate:status` would break. (Also: repo rule — never run migrations) |
| DB table drops | **Not done** (data loss, FKs). DB stays as it is |
| Kept table ↔ removed table FKs | Tables stay, so no problem |
| Prisma schema | Untouched (Section 6.4) |
| `composer.json` packages | **Not touched now** (`maatwebsite/excel`, `dompdf` are used by kept features) |

> If you also want DB tables dropped, that is a separate dangerous phase — needs a DB backup and your explicit OK.

## 8. Phases

One commit per phase. **Callers first, callees after** (Frontend → Backend → node-server → leftovers). Never delete everything at once.

### Phase 0 — Prerequisites + baseline — **DONE**

1. Branch `feature/keep-production-basedata`.
2. **Frontend:** `cd Frontend && npm ci`, baseline `ng build` (run `npm ci` only if `ng serve` still fails — `node_modules` was restored and now has ~650 packages).
3. **Backend:** `php artisan route:list --json > routes.before.json`; `php artisan test` if tests exist. (No `migrate`.)
4. **node-server:** `npm ci`, baseline `npx nest build` (may need `prisma generate`). **No `start`.**
5. Runtime smoke list — **run by you** (I do not start servers):
   - Login, Dashboard, global notifications
   - `/production` board (live), hall filter, `/mco` (overview/OEE, work-order tab), maintenance activate/end
   - `/base-data` Machines, Hall, Plant, Product, Employee, Client, Supplier CRUD
   - Employee **excel import** (progress/completed socket toasts), department create → notification
   - Roles-permissions save, User management

### Phase 1 — Frontend: routes + dashboard → Upcoming (no deletes) — **DONE**

`app.routes.ts` 5 routes; dashboard: only the `url` of 4 tiles (no tile is removed or hidden). Build.

### Phase 2 — Frontend: delete (Section 4) — **DONE**

`task` → `purchese` → `sales` → `store` → `hr` (except the 15 kept files), then `Frontend/docs` of removed modules. Build after each step.

### Phase 3 — Backend: remove routes (controllers stay) — **DONE**

1. Remove the REMOVE groups from `routes/api.php` (Section 5.2) plus unused `use` lines.
2. `route:list` diff — **kept routes identical**, only the REMOVE groups disappear.
3. Resolve the `verify` items (blacklist, employee-log export, pdf/generate) by checking kept callers.

### Phase 4 — Backend: delete code (per closure result) — **DONE**

1. Run the closure script → confirm the REMOVE list.
2. Order: Controllers → Services → Observers (+ `AppServiceProvider` registration) → Exports/Imports → Models (+ `Lodata::discover`) → Enums → Seeders.
3. After each step: `php -l`, `route:list`, `php artisan about`; Lodata `$metadata` entity list for kept entities unchanged (static check against `AppServiceProvider`).
4. Do not touch migrations or `PermissionSeeder`.

### Phase 5 — node-server: prune — **DONE**

1. Remove `module/biometrics`, `module/hrm`, `module/sales-forecast`; unregister from `app.module.ts` and `routers/api.route.ts`.
2. Trim `notification.service.ts` to the `base-data-department:*` handlers; remove the store-requisition controller route.
3. `AuthMiddleWare.forRoutes` → keep `api/machine/*path`, `api/work-orders/*path`; drop `api/hrm/*path` (and `odata/v8/*path` if D6).
4. (D6) Remove `module/odata` + `middleware/odata/**` + the `QueryBuilder` registration.
5. Clean `.env.example`; remove the matching Laravel `internal.token` side in Phase 4 (same change group).
6. Verify: `nest build`, `tsc --noEmit`, lint, re-run the import-graph script (no kept file pulls a removed one). **No server start.**

### Phase 5b — Dead-code sweep (D7) + packages — **DONE**

Remove the baseline-dead files listed in 6.2 after a grep for dynamic references; then drop confirmed-unused packages from `package.json` / lockfile. `nest build` after each step.

### Phase 6 — python-server + scripts — **DONE**

Delete `python-server/`, `scripts/sync-attendance-overtime.js`. Update `CLAUDE.md` / `.agent/AGENTS.md` repo map.

### Phase 7 — Docs — **DONE**

`Frontend/PROJECT_CONTEXT.md`, `Backend/README`, `node-server/README` + `module/machine/docs` (only mentions of removed pieces), `production-management/MODULE_OVERVIEW.md` — module lists.

## 9. Decisions

| # | Question | Default |
|---|---|---|
| ~~B1~~ | ~~Where to prune node-server~~ — **resolved**: it is now in this repo; prune `mes-Machine/node-server` in place. `/var/www/html/mes` stays untouched | — |
| **B2** | Drop DB tables + delete migrations? | **No** — code only |
| **B3** | Prune Prisma schema? (152/178 models are relation-linked to kept ones) | **No** |
| D1 | Removed modules: keep their dashboard tiles visible and point the click to the Upcoming page? (You said nothing the dashboard shows is removed.) | **Yes — tiles stay, click → Upcoming** |
| D2 | Clean up unused `shared/` Frontend files later (throttle.directive, custom.service, shared-* charts ...)? | **No** |
| D3 | Remove removed-module path aliases from `tsconfig.json` / `CLAUDE.md`? | **Phase 7** |
| D4 | If orphan-component build error, keep a slim `hr-management.module.ts`? | **Yes** |
| D5 | Backend `verify` items (blacklist, employee-log export, `pdf/generate`, `BagSerialService`) — remove if outside the closure? | **Yes, closure decides** |
| **D6** | Remove node-server generic `odata/v8` layer (no kept-Frontend caller)? | **Yes**, after confirming no external caller (devices, other systems) |
| **D7** | Remove node-server files that were already dead before this work (ai/*, config/db/*, media, shared/lib ...)? | **Yes**, each after a dynamic-reference grep |
| **D8** | Remove `python-server/` entirely? | **Yes** |

## 10. Risks

| Risk | Mitigation |
|---|---|
| **Hard-coded Bearer token in `scripts/sync-attendance-overtime.js`, now committed in this repo's history** | Revoke/rotate that API token. Deleting the file does not remove it from git history. (I am not reproducing the token here) |
| A kept Backend model has a relationship to a removed model → runtime error | Closure script keeps anything referenced by a relationship. `route:list` diff |
| Removing a Lodata entity gives the Frontend a 404 on `odata/...` | Remove only entities outside the kept-Frontend entity list (Section 5.1 step 2) |
| `route:list` looks unchanged but runtime hits `Class not found` | `composer dump-autoload`, `php -l`, your runtime smoke test |
| Import-graph script misses dynamic references (already found one: `machine.worker.ts`) | Grep for `join(__dirname`, `require(`, `import(`, string class names before any delete; keep `machine.worker.ts` |
| Biometrics removed on one side only (Laravel or node) | Both sides in the same change group (Phase 4 + 5) |
| Removing `odata/v8` breaks an external consumer I cannot see | D6 verify step; default is to ask before deleting |
| I cannot run node-server (repo rule) → runtime regressions in machine runtime / import queue | Build + type-check + import-graph; you run the Phase 0 smoke list after Phase 5 |
| Role-permission screen still lists permissions of removed features | Expected — permission seeders untouched (your instruction) |
| Untracked `bitbucket-pipelines.yml`, `deploy-frontend.sh` | Not modified; decide separately whether to commit them |

## 11. Migration cleanup — **DONE**

You asked to remove the migrations that are no longer needed. I analysed all 293 files in `Backend/database/migrations` and prepared the exact list, but the deletion of the 70 files was **denied by the permission classifier** (irreversible local deletion), and I did not work around it. After you told me to go ahead, **the 70 files were deleted (293 → 223 migrations).** Every file is committed in `2f6addc` / `3e655ec`, so it stays recoverable from git.

**Why it is now blocking a fresh `migrate`:** 20 of these 70 migrations reference classes I deleted (e.g. `2025_11_03_062309_create_purchase_requisitions_table` uses `App\Enums\Store\SprStatus`), so a fresh `migrate` / `migrate:fresh` crashes at that file. I checked all 293 files: **only these removal-list migrations reference deleted classes; none of the 223 kept migrations do.** Deleting the 70 files fixes it.

**Method:** a table is removable only if (1) its model was deleted in this cleanup, (2) no kept PHP / node-server code references it, and (3) no migration of a kept table has a foreign key to it. A migration file is removed only if **every** table it creates, alters or drops is in that removed set. Result: **70 files → 34 tables; 0 migrations touch both a removed and a kept table; 0 renames; no other migration mentions these tables.**

**Kept on purpose:** `salary_types` (FK from `employee_salary_details`), `notices_employees` (pivot used by the kept `Notice`/`Employee` relations), and every table whose model was kept (hr tables such as `payrolls`, `attendance_logs`, `leave_requests`, `rosters`, `notices`, `holidays`, `bonus_*` — the `Employee` model still relates to them).

**Tables that will no longer be created on a fresh install (34):**
`biometrics_device_configs`, `item_price_plannings`, `leave_approvals`, `market_prices`, `purchase_orders`, `purchase_order_items`, `purchase_quotes`, `purchase_quote_items`, `reminders`, `requisition_approvals`, `sale_order_items`, `idle_inventory_items`, `item_returns`, `item_return_items`, `lots`, `material_inspections`, `material_receipts`, `material_receipt_items`, `material_receipt_logs`, `mrr_returns`, `mrr_return_items`, `purchase_requisition_items`, `stock_adjustments`, `yarn_transfer_advice_lines`, `employee_blacklists`, `policies`, `promotions`, `promotion_configurations`, `sales_orders`, `side_bills`, `purchase_requisitions`, `yarn_transfer_advices`, `face_ids`, `sales_forecasts`

**What this does and does not do:**
- Existing databases are **not changed** — the tables stay in the DB; only the migration files go. `migrate` ignores a migration row whose file is missing. I never run `migrate`, `migrate:rollback` or drop tables (repo rule).
- A fresh database will not get those 34 tables. Kept code does not use them.
- `IdGeneratorSettingsSeeder`: 8 entries for removed entities (Policy, EmployeeBlacklist, SideBill, YarnTransferAdvice, PurchaseRequisition, SalesOrder, Promotion, PromotionConfiguration) are already removed (**DONE**).

**Migration files to delete (70):**

```
2025_08_25_094807_create_policies_table.php
2025_08_27_124537_create_employee_blacklists_table.php
2025_11_03_062309_create_purchase_requisitions_table.php
2025_11_03_062637_create_purchase_requisition_items_table.php
2025_11_03_062806_create_purchase_orders_table.php
2025_11_03_062833_create_purchase_order_items_table.php
2025_11_03_062933_create_material_receipts_table.php
2025_11_03_062952_create_material_receipt_items_table.php
2025_11_03_063057_create_material_inspections_table.php
2025_11_03_063144_create_idle_inventory_items_table.php
2025_11_03_084831_create_stock_adjustments_table.php
2025_11_05_093517_add_type_requisition_to_purchase_requisitions_table.php
2025_11_10_121343_add_unit_price_to_purchase_requisition_items_table.php
2025_11_12_065507_add_previous_stock_to_purchase_requisition_items_table.php
2025_11_12_123335_add_approval_and_acknowledge_fields_to_purchase_requisitions_table.php
2025_12_07_093059_create_item_price_plannings_table.php
2025_12_07_101445_create_sales_orders_table.php
2025_12_09_061203_create_sale_order_items_table.php
2025_12_09_062101_update_expected_delivery_column_in_sales_orders_table.php
2025_12_11_082619_add_reject_note_to_sales_orders_table.php
2025_12_11_084747_add_custom_id_to_sales_orders_table.php
2025_12_17_110204_add_created_by_to_sales_orders_table.php
2025_12_18_054403_add_discount_to_sale_order_items_table.php
2025_12_18_095858_add_discount_columns_to_sales_orders_table.php
2025_12_19_000000_add_sales_order_id_to_stock_adjustments_table.php
2025_12_21_092545_create_market_prices_table.php
2026_02_01_052752_face_ids.php
2026_03_15_120000_add_urgency_to_purchase_requisitions_and_approved_qty_to_items.php
2026_04_02_120000_upgrade_material_receipts_for_store_flow.php
2026_04_02_120100_make_po_item_id_nullable_on_material_receipt_items_table.php
2026_04_21_000001_create_purchase_quotes_table.php
2026_04_21_000002_create_purchase_quote_items_table.php
2026_04_21_000003_add_purchase_quote_id_to_purchase_orders_table.php
2026_04_23_090000_add_invoice_no_and_lc_no_to_material_receipts_table.php
2026_04_28_105531_create_promotions_table.php
2026_04_28_120000_create_side_bills_table.php
2026_04_30_000000_add_workflow_fields_to_promotions_table.php
2026_04_30_010000_create_promotion_configurations_table.php
2026_04_30_010100_add_promotion_configuration_id_to_promotions_table.php
2026_05_03_101309_create_biometrics_device_configs_table.php
2026_05_17_095618_add_column_to_blacklist_table.php
2026_06_03_000001_add_calculation_fields_to_promotions_table.php
2026_06_04_000001_add_status_to_side_bills_table.php
2026_06_14_130000_add_fields_to_side_bills_table.php
2026_06_15_121543_create_material_receipt_logs_table.php
2026_06_16_000002_add_is_complete_to_purchase_requisitions_table.php
2026_06_17_000000_add_two_level_approval_fields_to_purchase_requisitions_table.php
2026_06_17_000100_add_vehicle_no_to_material_receipts_table.php
2026_06_17_125220_add_is_complete_to_purchase_orders_table.php
2026_06_30_000001_add_approval_fields_to_purchase_orders_table.php
2026_07_01_000001_add_is_mrr_created_to_purchase_orders_table.php
2026_07_05_090000_create_reminders_table.php
2026_07_05_162250_create_item_returns_table.php
2026_07_05_162251_create_item_return_items_table.php
2026_07_05_183046_add_return_quantity_to_purchase_requisition_items_table.php
2026_07_22_000001_add_is_imported_to_purchase_requisitions_table.php
2026_07_22_000002_add_is_imported_to_purchase_orders_table.php
2026_08_03_150002_create_store_transfers_table.php
2026_08_03_150003_create_store_transfer_items_table.php
2026_08_24_121300_add_rejected_quantity_to_material_receipt_items_table.php
2026_08_24_132253_add_return_fields_to_material_receipts_table.php
2026_08_24_133334_create_mrr_returns_table.php
2026_08_24_133340_create_mrr_return_items_table.php
2026_08_24_150000_add_return_type_and_reason_to_mrr_returns_table.php
2026_08_24_160000_add_remark_to_mrr_return_items_table.php
2026_08_25_090000_create_lots_table.php
2026_08_31_120000_create_sales_forecasts_table.php
2026_09_06_112542_create_requisition_approvals_table.php
2026_09_07_060355_add_snapshot_fields_to_requisition_approvals_table.php
2026_09_14_000001_create_leave_approvals_table.php
```

**Verified after deletion:** 0 remaining migrations have a foreign key, alter or drop targeting a removed table; 0 remaining migrations reference a deleted `App\` class; all remaining PHP under `database/` lints clean. Not run by me: `migrate` / `migrate:fresh` (repo rule) — please run your fresh migrate again to confirm.
