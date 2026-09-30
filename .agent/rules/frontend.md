# Frontend Rules — Angular 17+

## Imports — path aliases mandatory (`baseUrl: src`)
Relative imports (`../`) forbidden.

| Alias | Path |
|-------|------|
| `@app/*` | `app/*` |
| `@shared/*` | `app/shared/*` |
| `@env/*` | `environments/*` |
| `@assets/*` | `assets/` |
| `@base-data-module/*` | `app/modules/base-data-management/*` |
| `@production-module/*` | `app/modules/production-management/*` |
| `@store-module/*` | `app/modules/store-management/*` |
| `@sales-module/*` | `app/modules/sales-management/*` |
| `@purchese-module/*` | `app/modules/purchese-management/*` |

## Components
Standalone · `OnPush` · `inject()` · Signals where appropriate · no template logic · no `any` (strict + strictTemplates on) · small components · reusable logic in services.

## AG Grid (Enterprise)
Large-dataset optimized; preserve virtualization; no expensive cell renderers; no CD inside renderers; persist + restore column state / sort / filter / column order / column width (centralized); reuse `@shared/components/ag-grid-table`.

## RxJS
No nested subscriptions — flatten with `switchMap`/`mergeMap`/`concatMap` by semantics; `takeUntilDestroyed()` for teardown; no leaks.

## UI5
UI5 Web Components only; no mixing UI libraries; consistent with active theme (incl. dark mode); scoped SCSS, shared tokens.
