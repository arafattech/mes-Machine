# LoginComponent

**Selector:** `app-login`
**File:** `src/app/shared/components/login/login.component.ts`
**Standalone:** Yes — `CUSTOM_ELEMENTS_SCHEMA`
**Imports:** `CommonModule`, `InputComponent`, `FormsModule`

## What It Does

User authentication form. Email + password fields with "Remember Me". On success, stores auth token, user info, and role permissions to `localStorage`, then navigates to `/`.

## Key Methods

| Method | Purpose |
|---|---|
| `ngOnInit()` | Checks existing `remember_token`, redirects if already logged in, loads remembered credentials |
| `validateForm()` | Validates email (required + format) and password (required + min 6 chars). Returns `boolean`. |
| `onLogin()` | Calls `AuthService.login()`, stores token + user, loads permissions via `RolePermissionService`, navigates to dashboard |
| `loadRememberedUser()` | Reads `localStorage.remember_user` and pre-fills form |
| `togglePasswordVisibility()` | Toggles `<input type>` between `password` and `text` |
| `clearError(field)` | Clears field-specific validation message on input |
| `handleEnterKey(event)` | `@HostListener('keydown.enter')` — triggers login or toggles "Remember Me" |

## Internal State

| Property | Purpose |
|---|---|
| `user: User` | Email + password model |
| `errorMessage: string` | API/general error message |
| `loading: boolean` | Disables button during API call |
| `isPasswordVisible: boolean` | Password field visibility |
| `rememberMe: boolean` | "Remember Me" checkbox state |
| `validationMessage: {email, password}` | Per-field validation strings |

## LocalStorage Keys Used

| Key | Value |
|---|---|
| `remember_token` | Auth token |
| `user_info` | Serialized user object |
| `remember_user` | Saved credentials (if "Remember Me" checked) |
| `role_permissions` | Role permission list |

## Usage

Route: `/login`. Wrapped in `app-auth-layout`. No inputs/outputs needed.
