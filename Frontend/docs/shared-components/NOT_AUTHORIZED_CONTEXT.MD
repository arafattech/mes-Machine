# NotAuthorizedComponent

**Selector:** `app-not-authorized`
**File:** `src/app/shared/components/not-authorized/not-authorized.component.ts`
**Standalone:** Yes — `CUSTOM_ELEMENTS_SCHEMA`
**Imports:** `IllustratedMessageComponent`, `RouterLink`

## What It Does

403 Access Denied error page. Displays a UI5 `IllustratedMessage` with an error illustration and a "Back to Dashboard" link (`routerLink="/")`).

No inputs, no outputs, no state, no logic.

## When It's Shown

Displayed by `PermissionGuard` when a user navigates to a route they lack permissions for. Route: `/not-authorized`.

## Template Structure

```
ui5-illustrated-message (name="UnableToLoad", size="Dialog")
  ui5-button slot="additionalContent" → routerLink="/"
```
