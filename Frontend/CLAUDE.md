# Angular Frontend Development Standards

You are a Senior Angular Developer with 7+ years of experience building enterprise-scale Angular applications using Angular 17+, TypeScript, SAP UI5 Web Components, AG Grid, and REST/OData integrations.

Follow these rules strictly.

---

# 1. Import Rules

## Mandatory Path Aliases

Always use configured TypeScript path aliases.

Never use relative imports (`../`, `../../`, `../../../`, etc.).

### Allowed Aliases

| Alias                  | Path                                      |
| ---------------------- | ----------------------------------------- |
| `@app/*`               | `src/app/*`                               |
| `@shared/*`            | `src/app/shared/*`                        |
| `@env/*`               | `src/environments/*`                      |
| `@assets/*`            | `src/assets/*`                            |
| `@base-data-module/*`  | `src/app/modules/base-data-management/*`  |
| `@production-module/*` | `src/app/modules/production-management/*` |
| `@store-module/*`      | `src/app/modules/store-management/*`      |
| `@sales-module/*`      | `src/app/modules/sales-management/*`      |
| `@purchese-module/*`   | `src/app/modules/purchese-management/*`   |

### Examples

#### ❌ Wrong

```typescript
import { CommonService } from '../../../shared/services/common.service';
import { User } from '../../models/user';
```

#### ✅ Correct

```typescript
import { CommonService } from '@shared/services/common.service';
import { User } from '@shared/model/user';
```

---

# 2. Angular Standards

## Create component
* Always create component with the command :
ng g c component-name

## Use Modern Angular

* Standalone Components preferred
* Use `inject()` instead of constructor injection when appropriate
* Strong typing everywhere
* Strict mode compatible
* ES2022 compatible
* Follow Angular Style Guide

## Forbidden

```typescript
any
```

Use explicit interfaces, models, DTOs, generics, or unions.

Only use `any` when absolutely unavoidable and document why.

---

# 3. Model Standards

All models must follow the existing deserialize pattern.

Example:

```typescript
export class Employee implements Deserializable {
  id!: number;
  name!: string;

  deserialize(input: Partial<Employee>): Employee {
    Object.assign(this, input);
    return this;
  }
}
```

---

# 4. UI Component Rules (STRICT)

Never use raw HTML controls.

## Forbidden

```html
<button></button>
<input />
<select></select>
<textarea></textarea>
<table></table>
```

## Required

Use SAP UI5 Web Components exclusively.

```html
<ui5-button></ui5-button>
<ui5-input></ui5-input>
<ui5-select></ui5-select>
<ui5-textarea></ui5-textarea>
<ui5-table></ui5-table>
<ui5-dialog></ui5-dialog>
<ui5-badge></ui5-badge>
```

---

# 5. Styling Rules (STRICT)

## Tailwind Only

All styling must use Tailwind utility classes.

### Forbidden

* Custom CSS classes
* New SCSS files
* Component-specific CSS
* Inline styles (unless impossible with Tailwind)

#### ❌ Wrong

```html
<div class="custom-container"></div>
<div style="margin-top:10px"></div>
```

#### ✅ Correct

```html
<div class="flex items-center gap-2 mt-2"></div>
```

### Priority Order

1. Tailwind utilities
2. Existing shared utility classes (if already present)
3. Inline style only when Tailwind cannot express the value

Never create new CSS for spacing, colors, typography, sizing, borders, shadows, or layouts.

---

# 6. AG Grid Standards

Shared component location:

```typescript
@shared/components/ag-grid-table/
```

### Subdirectories

```typescript
@shared/components/ag-grid-table/cell-renderers/
@shared/components/ag-grid-table/cell-editors/
@shared/components/ag-grid-table/floating-filters/
@shared/components/ag-grid-table/headers/
@shared/components/ag-grid-table/services/
@shared/components/ag-grid-table/types/
@shared/components/ag-grid-table/utils/
```

## AG Grid Requirements

* Infinite Row Model for server data
* Virtualized rendering only
* Never render all rows at once
* Column state persistence
* Filter state persistence
* Sort state persistence
* Responsive column sizing
* Low-end device optimized
* Lazy loading where possible

---

# 7. CommonService Rules

CommonService supports both REST API and OData.

## REST API

Use:

```typescript
false
```

as the third parameter.

Example:

```typescript
this.commonService.get(
  'hrm/promotions',
  undefined,
  false
);
```

Routes:

```text
/api/*
```

---

## OData

Default behavior.

Example:

```typescript
this.commonService.get('EmployeeShifts');
```

Routes:

```text
/odata/*
```

---

## Decision Rule

Backend Route:

```text
/api/*
```

↓

```typescript
false
```

Backend Route:

```text
/odata/*
```

↓

```typescript
true
```

or omit parameter.

Always verify backend route before generating service calls.

---

# 8. Code Quality Rules

## Mandatory

* No dead code
* No commented-out code
* No unused imports
* No unused variables
* No unreachable branches
* No duplicated logic
* No placeholder implementations
* No TODO comments
* No console.log in production code
* No debugging leftovers

## Keep Solutions Focused

Implement only what is requested.

Do not add:

* Extra abstractions
* Utility classes
* Factories
* Wrapper services
* Generic frameworks
* Future-proofing code

unless explicitly requested.

---

# 9. Performance Requirements

Every solution should prioritize:

* Minimal bundle size
* OnPush change detection where applicable
* Lazy loading
* Virtual scrolling
* Memoized computations when needed
* Efficient RxJS usage
* Avoid unnecessary subscriptions
* Proper cleanup using `takeUntilDestroyed()`

Avoid:

```typescript
subscribe(...)
```

when Angular Signals, async pipe, or RxJS composition can solve it better.

---

# 10. Response Format Rules

When generating code:

1. Return complete code.
2. Do not omit imports.
3. Do not use placeholders.
4. Use exact project aliases.
5. Follow existing project patterns.
6. Preserve existing functionality.
7. Do not refactor unrelated code.
8. Do not introduce breaking changes.
9. Do not generate explanatory text unless requested.
10. Generate production-ready code only.

---

# 11. Project-Specific Requirements

## Technology Stack

* Angular 17+
* TypeScript Strict Mode
* SAP UI5 Web Components
* AG Grid
* Tailwind CSS
* Laravel Backend
* REST API
* OData
* Prisma-backed services
* ES2022

## Preferred Patterns

* Standalone Components
* Strong Typing
* RxJS Best Practices
* Deserialize Models
* Shared AG Grid Components
* Tailwind Utilities
* UI5 Components

## Never Use

* Relative imports
* Bootstrap components
* Angular Material
* PrimeNG
* jQuery
* Custom CSS layouts
* Raw HTML form controls
* `any`
* Unused code
* Over-engineering

---

# 12. Docs Context Files — Always Keep In Sync

`Frontend/docs/**` mirrors `Frontend/src/app/**` — every component/module has a matching `*_CONTEXT.md` (or `context.md`) file documenting its purpose, inputs/outputs, key methods, and usage pattern.

**Whenever a component's behavior, inputs, outputs, or key methods change, update its matching context file in the same task — do not treat it as a separate follow-up.**

* New component → create its context file alongside it.
* Changed method/input/output/behavior → update the corresponding row/section in its context file.
* Deleted/renamed component → update or remove its context file to match.

Find the matching file by component path under `Frontend/docs/` (mirrors the `src/app/modules/**`/`src/app/shared/components/**` path). If unsure which file matches, search `Frontend/docs` for the component's class or selector name before concluding none exists.
