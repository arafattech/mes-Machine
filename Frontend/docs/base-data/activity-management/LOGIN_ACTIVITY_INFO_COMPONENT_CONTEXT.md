# LOGIN_ACTIVITY_INFO_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| **TypeScript file** | `Frontend/src/app/modules/base-data-management/activity-management/login-activity-info/login-activity-info.component.ts` |
| **HTML template** | `Frontend/src/app/modules/base-data-management/activity-management/login-activity-info/login-activity-info.component.html` |
| **Stylesheet** | `Frontend/src/app/modules/base-data-management/activity-management/login-activity-info/login-activity-info.component.scss` |
| **Selector** | `app-login-activity-info` |
| **Component type** | Dialog (read-only detail viewer) |
| **Standalone** | Yes |

**Purpose:** Read-only dialog showing the full detail of a single `LoginActivity` record — core identity/timestamp fields in one tab, and the **raw stored API response JSON** from the actual login/logout HTTP calls in a second tab. Mirrors `LogInfoComponent`'s dialog/tab structure (see [LOG_INFO_COMPONENT_CONTEXT.md](LOG_INFO_COMPONENT_CONTEXT.md)) but adapted for login/logout data instead of generic CRUD audit diffs.

---

## Inputs (@Input)

| Input name | Type | Default | Purpose |
|---|---|---|---|
| `isOpen` | `EventEmitter<void>` | `new EventEmitter<void>()` | Same dual-use pattern as `LogInfoComponent`: parent passes its own emitter; this component subscribes in `ngOnInit` and sets `open = true` on each emission. |
| `activityData` | `LoginActivity` | `new LoginActivity().deserialize({})` | The login-activity record to display. |

---

## Outputs (@Output)

None.

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `localization` | `typeof Localization` | `Localization` | i18n label strings (`localization.Cancel`). |
| `open` | `boolean` | `false` | Controls the `[open]` binding on `ui5-dialog`. |

---

## Lifecycle Hooks

### `ngOnInit()`
Subscribes to `isOpen`; sets `open = true` on each emission. No unsubscribe (same caveat as `LogInfoComponent`).

---

## Methods

### `formatDate(dateString): string`
`DatePipe.transform(dateString, 'dd/MM/yyyy')`, falls back to `''`.

### `formatTime(dateString): string`
`DatePipe.transform(dateString, 'HH:mm')`, falls back to `''`.

### `toStr(value: number | string | undefined): string`
Converts a numeric field (`id`, `table_id`) to a plain string for `ui5-input[value]`, which requires `string` — binding a `number` directly is a compile error (`Type 'number | ""' is not assignable to type 'string'`). Returns `''` for `undefined`/`null`.

### `formatJSON(data: string | undefined): string`
Same shape as `LogInfoComponent.formatJSON()`: `JSON.parse` then `JSON.stringify(_, null, 2)` inside a try/catch, returning `'Invalid JSON'` on failure, `''` for empty input. Applied to `activityData.login_response` / `activityData.logout_response` — both stored as **plain JSON strings** on the backend (not array-cast — see [Why login_response/logout_response are plain strings](#why-login_responselogout_response-are-plain-strings) below).

---

## Template Structure

Two tabs inside a `ui5-tabcontainer`, same visual pattern as `LogInfoComponent` (`row`/`col-md-*` Bootstrap grid, `ui5-label show-colon` + readonly `ui5-input`, `ui5-card` + `<pre>` for JSON blocks). Dialog is sized `w-[min(760px,calc(100vw-2rem))]` with `.row { margin-x: 0 }` (`mx-0`) to prevent Bootstrap's default negative row margins from causing a horizontal scrollbar inside the fixed-width dialog.

### Tab 1 — "Core Data"

| Field | Binding |
|---|---|
| ID | `toStr(activityData.id)` |
| IP Address | `activityData.ip_address \|\| ''` |
| Login Date | `activityData.login_date \|\| ''` |
| Logout Date | `activityData.logout_time ? formatDate(activityData.logout_time) : '--'` |
| Login Time | `formatTime(activityData.login_time)` |
| Logout Time | `activityData.logout_time ? formatTime(activityData.logout_time) : '--'` |

Login Date/Time and Logout Date/Time are deliberately four separate fields, not two combined datetime strings — matches the same split applied to the grid columns in `LoginActivityListComponent`.

### Tab 2 — "Audit Details"

| UI Element | Binding | Notes |
|---|---|---|
| Table Name | `activityData.table_name \|\| ''` | |
| User Name | `activityData.user_name \|\| ''` | |
| `ui5-card` "Login Data" | — | Card header. |
| `<pre>` inside | `{{ formatJSON(activityData.login_response) }}` | Raw JSON of the actual `AuthController::login()` response for this session. |
| `ui5-card` "Logout Data" | — | Card header. |
| `<pre>` inside | `activityData.logout_response ? formatJSON(activityData.logout_response) : 'Not logged out yet'` | Raw JSON of the `AuthController::logout()` response, or a placeholder if the user is still logged in. |

This intentionally mirrors `LogInfoComponent`'s "New Data"/"Old Data" JSON-card layout exactly, just relabeled "Login Data"/"Logout Data" — there's no old/new diff concept here, so the cards hold the two API responses instead.

### Dialog Footer
Single "Cancel" button, `(click)="open = false"` — same as `LogInfoComponent`.

---

## API Calls

None directly. All data arrives via the `activityData` `@Input()`.

---

## Services Injected

| Service | Why | Methods used |
|---|---|---|
| `DatePipe` | Formats `login_time`/`logout_time` for display | `transform()` |

---

## Why `login_response`/`logout_response` are plain strings

Both columns are `text` (not `json`) on the `login_activities` table, and `LoginActivity` has **no** `$casts` entry for them (PHP `json_encode()`s the array explicitly before saving in `AuthController`). This is a deliberate copy of `ActivityLog`'s `old_value`/`new_value` convention (also plain `text`, parsed client-side via `JSON.parse` in `LogInfoComponent.formatJSON()`).

**Do not** add an Eloquent `'array'` cast to these columns or change the migration column type to `json`. Doing so previously broke Lodata's OData schema discovery with:
```
ErrorException: Array to string conversion
  at vendor/flat3/lodata/src/Type/String_.php:50
```
Lodata's `SQLSchema::discoverProperties()` introspects the raw DB column type via Doctrine DBAL (not the Eloquent model's casts) and maps it to its `String_` OData type; when the *value* Eloquent hands back is a PHP array (due to the cast) instead of a string, Lodata's `String_` constructor crashes trying to `(string)`-cast an array. Keeping the column as `text` + explicit `json_encode()`/`JSON.parse()` on each side sidesteps this entirely, and matches how the pre-existing `ActivityLog` entity already handles the identical problem.

---

## Enums / Models Used

### `LoginActivity` — `@shared/model/loginActivity`

| Field | Type | Notes |
|---|---|---|
| `id` | `number \| undefined` | |
| `table_name` | `string \| undefined` | Currently always `'User'` (set as the column default in the migration). |
| `table_id` | `number \| undefined` | FK to `users.id`. |
| `user_name` | `string \| undefined` | Denormalized at login time. |
| `ip_address` | `string \| undefined` | `$request->ip()` captured in `AuthController::login()`. |
| `login_time` / `logout_time` | `string \| undefined` | Full datetimes; `logout_time` is `null` until logout. |
| `login_date` | `string \| undefined` | Separate date-only column, set at login. |
| `login_response` / `logout_response` | `string \| undefined` | Raw JSON strings — see above. |
| `created_at` / `updated_at` | `string \| undefined` | |

### `Localization` — `@shared/utilities/localization`
Only `localization.Cancel` is used (footer button label) — this dialog does not reuse `logInfo`/`newData`/`OldData` keys from `LogInfoComponent` since its header text and card titles are hardcoded (`header-text="Login Activity Information"`, `title-text="Login Data"`/`"Logout Data"`) rather than pulled from `Localization`.

---

## Key Business Logic

1. **Dialog open/close via EventEmitter Input** — identical pattern to `LogInfoComponent`; see that doc for the full rationale/caveat (no unsubscribe cleanup).
2. **Login/Logout row correlation** — `AuthController::login()` stores the plaintext Sanctum token on the row (`token` column, not exposed in this UI); `AuthController::logout()` looks up the still-open row by that same token (`whereNull('logout_time')`) to know which row to fill in on logout. This dialog only ever displays already-joined rows — the correlation logic lives entirely in the backend.
3. **Read-only, no delete** — same as the list component, this is purely a viewer.
