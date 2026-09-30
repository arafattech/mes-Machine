# Frontend Context

Manufacturing Execution System (MES) — Angular 17 single-page app with a hybrid React-in-Angular table architecture.

---

## Tech Stack

| Layer | Library / Version |
|---|---|
| Framework | Angular 17.3 |
| UI Components | SAP UI5 Web Components (`@ui5/webcomponents-ngx` 0.3, `@ui5/webcomponents-react` 2.0-rc) |
| Embedded React | React 18.3 (mounted inside Angular for legacy table) |
| Table (legacy) | UI5 `AnalyticalTable` via React inside `CustomGridTableComponent` |
| Table (new) | AG Grid 32.3 (`ag-grid-angular`, `ag-grid-community`) |
| Styling | TailwindCSS 3.4 + SCSS |
| Charts | amCharts4, Chart.js 4 / ng2-charts |
| Calendar | FullCalendar 6 |
| Real-time | Socket.IO client 4.8 |
| Barcode | ZXing (`@zxing/ngx-scanner`) |
| i18n | Angular `@angular/localize` + `@ngx-translate/core` (EN + BN locales) |
| HTTP / Data | OData v4 via `CustomService.paginateCustomTableData()` |
| State | No global store — component-level + services |
| Auth | `CustomAuthService` + route guards (`PermissionGuard`) |

---

## Source Layout

```
Frontend/src/app/
├── app.component.ts        Root component
├── app.routes.ts           Top-level lazy routes
├── app.config.ts           App config (standalone bootstrap)
├── dashboard/              Home dashboard + coming-soon
├── directives/             ThrottleDirective
├── modules/                Feature modules (lazy-loaded)
│   ├── base-data-management/
│   ├── hr-management/
│   ├── production-management/
│   ├── purchese-management/
│   ├── sales-management/
│   ├── store-management/
│   └── task-management/
└── shared/
    ├── components/         Reusable UI components (see below)
    ├── enums/              App-wide enums
    ├── interfaces/         TypeScript interfaces
    ├── model/              Deserializable domain models
    ├── services/           CustomService, CustomAuthService, ThemeService, etc.
    └── utilities/          Date, localization, permissions helpers
```

702 source files total (as of 2026-06-03).

---

## Lazy-Loaded Feature Modules

| Route | Module | Domain |
|---|---|---|
| `/base-data` | `BaseDataManagementModule` | Master data: employees, machines, plants, halls, clients, assets, capacity, operations |
| `/hr-management` | `HrDataManagementModule` | HR: attendance, payroll, leave, biometrics, face recognition, roster, shift |
| `/production` | `ProductionModule` | Machine monitoring, production dashboard, machine board |
| `/purchase-management` | `PurcheseManagementModule` | SPR, quotation, comparative study, purchase orders |
| `/sales-management` | `SalesManagementModule` | Sales orders, pricing plans, promotions |
| `/store-management` | `StoreManagementModule` | Inventory, MRR (local + imported), store requisition |
| `/task-management` | `TaskManagementModule` | Task data management |

---

## Shared Components

### Table Components (3 coexisting — see migration section)

| Selector | File | Status |
|---|---|---|
| `app-custom-grid-table` | `shared/components/custom-grid-table/custom-grid-table.component.tsx` | **Active legacy** — hybrid Angular shell + React `AnalyticalTable` mount. Full CONTEXT in [`custom-grid-table/CONTEXT.md`](src/app/shared/components/custom-grid-table/CONTEXT.md) |
| `app-ag-grid-table` | `shared/components/custom-grid-table/ag-grid-table.component.ts` | **New** — pure Angular AG Grid 32. Migration target. |
| `app-analytical-table` | `shared/components/analytical-table/analytical-table.component.tsx` | Thin React wrapper; used in some older list views |
| `app-custom-table` | `shared/components/custom-table/custom-table.component.tsx` | Simpler client-side table; older usage |

### Other Shared Components

| Selector | Purpose |
|---|---|
| `app-delete-entity` | Reusable delete confirmation dialog |
| `app-assosiate` | Associate/link entity dialog |
| `app-attachment-upload` | File + webcam capture upload |
| `app-attachment-preview` | File/document preview |
| `app-excel-import-export` | Excel upload/download |
| `app-calendar` / `app-calendar-legend` | FullCalendar wrapper + legend |
| `app-toaster` / `app-toaster-message` | UI5 Toast notification system |
| `app-notification` | Notification panel + activity logs |
| `app-sidebar` | Navigation sidebar with route links |
| `app-layout` | Authenticated shell layout |
| `app-auth-layout` | Unauthenticated (login) shell |
| `app-multiselect` | Reusable multi-select widget |
| `app-shared-bar-chart` / `app-shared-donut-chart` | Shared chart wrappers |
| `app-language-switch` | EN/BN locale switcher |

---

## SharedModule

`shared/shared.module.ts` — re-exports all shared components + `CommonModule`, `FormsModule`, `Ui5MainModule`, `Ui5FioriModule`, `NgChartsModule`. Feature modules import `SharedModule` to get everything.

---

## Key Cross-Cutting Abstractions

### God Nodes (most connected — touch these carefully)

| Node | Edges | What it is |
|---|---|---|
| `Localization` | 135 | `$localize` tagged strings + `@ngx-translate` — every user-facing string goes through this |
| `saveMode` | 90 | Enum: `CREATE \| EDIT \| VIEW` — controls form behavior across all CRUD dialogs |
| `Permissions` | 88 | Enum of all permission constants (e.g. `BASE_DATA_USER_CREATE`) — used in `PermissionGuard` and template `*ngIf` checks |
| `Deserializable` | 67 | Interface `{ deserialize(input): this }` — all domain models implement this; used by `CustomService` to map API responses |

### CRUD Pattern (used in ~90% of list views)

```
ListComponent (*.tsx)          — app-custom-grid-table + delete dialog
FormComponent (*.html + *.ts)  — UI5 Dialog with saveMode input/output
DeleteEntityComponent          — shared confirm dialog
```

Split-panel master-detail layout: left list, right form (UI5 `SplitPanel`).

---

## OData API Layer

All data fetching goes through `CustomService.paginateCustomTableData(limit, skip, sortBy, sortType, fieldName, searchText, url, expandQuery, operator, isv8, useOdataStyles, filterQuery, ...)`.

- Returns `{ value: T[], '@odata.count': number }` for OData endpoints.
- `Deserializable.deserialize()` maps raw JSON to typed models.
- No GraphQL, no REST outside OData pattern.

---

## Permissions / RBAC

- `PermissionGuard` on routes.
- `Permissions` enum (`shared/enums/permissions.ts`) lists all constants.
- Template-level: `*ngIf="hasPermission(Permissions.X)"` pattern.
- `CustomAuthService` holds logged-in user + role.

---

## i18n

- Primary locale: English (`en`).
- Second locale: Bengali (`bn`) — build flag `--configuration=bn`.
- `$localize` template literal for compile-time strings.
- `@ngx-translate` service for runtime strings.
- `extract-i18n` script extracts to `src/locale/`.

---

## AG Grid Migration (active — branch `feature/ag-grid-table`)

Current work: migrating list views from `app-custom-grid-table` (React/UI5 `AnalyticalTable`) to `app-ag-grid-table` (AG Grid 32 Quartz theme).

- First migrated: `product-list` component.
- Migration guide: [`src/app/shared/components/custom-grid-table/AG-GRID-MIGRATION.md`](src/app/shared/components/custom-grid-table/AG-GRID-MIGRATION.md)
- `AgGridTableComponent` selector: `app-ag-grid-table`.
- Columns use `ColDef[]` from `ag-grid-community` instead of `CustomGridTableComponent`'s custom column shape.
- `AgGridTableComponent` inputs mirror `CustomGridTableComponent` where possible for drop-in swap.

---

## Build & Scripts

```bash
npm start                     # ng serve (EN)
npm run start:de              # ng serve --configuration=bn (Bengali)
npm run build                 # ng build --localize (all locales, 1535 MB heap)
npm run extract-i18n          # extract + merge translation files
```

`tools/prebuild.js` runs before every build (prebuild hook).

---

## File Extension Conventions

- `.ts` — standard Angular component/service/class
- `.tsx` — Angular component that embeds React JSX (hybrid components)
- `.html` — Angular template
- `.scss` — component styles

`.tsx` components use `ReactDOM.createRoot()` to mount React trees into `ViewChild` container refs, then unmount in `ngOnDestroy`.
