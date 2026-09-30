# AuthLayoutComponent

**Selector:** `app-auth-layout`
**File:** `src/app/shared/components/auth-layout/auth-layout.component.ts`
**Standalone:** Yes

## What It Does

Minimal layout shell for unauthenticated pages (login, etc.). Uses `<ng-content>` to project child content. No logic, no inputs, no outputs.

## Usage Pattern

```html
<app-auth-layout>
  <app-login></app-login>
</app-auth-layout>
```

Used in `app.component.html` to wrap the login route. Separate from `app-layout` (authenticated shell) so auth pages get different styling without the sidebar and header bar.
