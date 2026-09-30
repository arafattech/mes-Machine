# LayoutComponent

**Selector:** `app-layout`
**File:** `src/app/shared/components/layout/layout.component.ts`
**Standalone:** Yes — `CUSTOM_ELEMENTS_SCHEMA`
**Imports:** `CommonModule`, `PopoverComponent`, `ButtonComponent`, `LabelComponent`, `BarComponent`, `AvatarComponent`, `NotificationComponent`, `ToasterComponent`, `TranslationComponent`, `DatePipe`

## What It Does

Primary shell for all authenticated pages. Provides:
- Top header bar with app logo, user avatar, notification bell, settings popover
- Live date/time clock and current running shift indicator (name + shift color dot) in the header
- Sidebar collapse toggle
- Theme switcher (sap_fiori_3 / sap_horizon and dark variants)
- Density switcher (Cozy / Compact)
- Text direction toggle (LTR / RTL)
- User logout
- Notification badge count
- `<ng-content>` for page content projection

## Inputs

| Input | Type | Purpose |
|---|---|---|
| `notificationCount` | `EventEmitter<number>` | Receives unread notification count updates |

## Outputs

| Output | Emits | When |
|---|---|---|
| `IsOpenNotification` | `void` | Notification bell button clicked |

## Key Methods

| Method | Purpose |
|---|---|
| `ngOnInit()` | Loads user info, subscribes to router events, loads user image, starts clock + shift-resolution timers |
| `ngOnDestroy()` | Clears clock and shift-resolution timers |
| `resolveCurrentShift()` | Resolves `currentShift` via `ShiftResolverService.resolveCurrentShift()`; re-run every 60s |
| `toggleSidenav()` | Collapses/expands sidebar |
| `changeTheme(event)` | Applies and persists new UI5 theme |
| `onDensityMenuItemSelect(event)` | Applies density (Cozy/Compact) |
| `onDirectionMenuItemSelect(event)` | Applies LTR/RTL |
| `onLogout()` | Calls logout API, clears localStorage, navigates to login |
| `getInitials(name)` | Extracts initials for avatar fallback |
| `loadImg()` | Loads user profile image from localStorage |
| `isDarkTheme()` | Returns `true` for dark/HCB themes |
| `checkIfDashboardRoute()` | Sets `isDashboardRoute` flag on route change |
| `checkAppLogo()` | Picks logo based on environment config |
| `onLoad(event)` | Logo `<a href="/">` click → `preventDefault()` + SPA navigate home; Ctrl/Cmd/middle-click → native anchor opens new tab at app root (not the raw logo image) |

## Available Themes

`sap_fiori_3`, `sap_fiori_3_dark`, `sap_horizon`, `sap_horizon_dark`, `sap_horizon_hcb`, `sap_horizon_hcw`

Persisted to `localStorage.preferred_theme`.

## Usage Pattern

```html
<app-layout [notificationCount]="notifEmitter">
  <router-outlet></router-outlet>
</app-layout>
```

Wrap the authenticated router outlet. Used in `app.component.html` alongside `app-auth-layout` for the unauthenticated route.
