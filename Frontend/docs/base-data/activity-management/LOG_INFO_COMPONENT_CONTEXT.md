# LOG_INFO_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| **TypeScript file** | `Frontend/src/app/modules/base-data-management/activity-management/log-info/log-info.component.ts` |
| **HTML template** | `Frontend/src/app/modules/base-data-management/activity-management/log-info/log-info.component.html` |
| **Stylesheet** | `Frontend/src/app/modules/base-data-management/activity-management/log-info/log-info.component.scss` |
| **Selector** | `app-log-info` |
| **Component type** | Dialog (read-only detail viewer) |
| **Standalone** | Yes |

**Purpose:** `LogInfoComponent` is a read-only dialog that displays the full detail of a single `ActivityLog` record. It is triggered by a parent component via an `EventEmitter` input and presents log metadata (ID, table name, action type, user info, timestamps, active/read status) in a tabbed UI5 dialog. A second tab shows the structured audit diff between the old and new JSON payloads for the affected record.

---

## Inputs (@Input)

| Input name | Type | Default | Purpose |
|---|---|---|---|
| `isOpen` | `EventEmitter<void>` | `new EventEmitter<void>()` | An event emitter passed in from the parent. The component subscribes to this emitter in `ngOnInit`; when it fires, the dialog is opened by setting `open = true`. |
| `logData` | `ActivityLog` | `new ActivityLog().deserialize({})` | The full activity log record to display. All fields in the dialog are derived from this object. |

> **Note:** `isOpen` is declared as `@Input()` but is itself an `EventEmitter`. This is an unconventional pattern — the parent passes its own emitter as an input; the child subscribes to it rather than calling it.

---

## Outputs (@Output)

None. This component does not emit any outputs to the parent.

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `localization` | `typeof Localization` (static object) | `Localization` | Reference to the shared localization utility. Used in the template for i18n label strings (`localization.logInfo`, `localization.Active`, `localization.Cancel`, `localization.newData`, `localization.OldData`). |
| `open` | `boolean` | `false` | Controls the `[open]` binding on the `ui5-dialog`. Set to `true` when `isOpen` emits; set back to `false` when the Cancel button is clicked. |

---

## ViewChild / ViewChildren

None declared.

---

## Lifecycle Hooks

### `ngOnInit()`
- Subscribes to the `isOpen` `EventEmitter` input.
- On each emission, sets `this.open = true`, which opens the `ui5-dialog` via its `[open]` binding.
- No unsubscribe / `takeUntil` pattern is applied — the subscription lives for the lifetime of the component instance.

---

## Methods — DETAILED

### `getModelName(modelType: string | undefined): string`
- **Signature:** `getModelName(modelType: string | undefined): string`
- **Logic:**
  1. Receives the raw `model_type` string from the `ActivityLog`, which is typically a PHP-style fully-qualified class name using backslash namespace separators (e.g., `App\Models\SomeEntity`).
  2. Calls `.split('\\')` to split on backslash, then `.pop()` to take the last segment (the simple class name).
  3. If `modelType` is `undefined` or the split/pop yields nothing, returns the fallback string `'Unknown Model'`.
- **Returns:** A human-readable model/table name string.
- **Used in template:** Bound to both the "Table Name" field in the Core Data tab and the "Table Name" field in the Audit Details tab.

---

### `formatJSON(data: any): string`
- **Signature:** `formatJSON(data: any): string`
- **Logic:**
  1. Wraps execution in a `try/catch`.
  2. Attempts `JSON.parse(data)` to parse the raw string value (either `logData.new_value` or `logData.old_value`).
  3. If parsing succeeds, calls `JSON.stringify(parsedData, null, 2)` to produce a prettified, indented JSON string.
  4. If `JSON.parse` throws (invalid JSON or null/undefined input), catches the error and returns the literal string `'Invalid JSON'`.
- **Returns:** A pretty-printed JSON string, or `'Invalid JSON'` on failure.
- **Used in template:** Rendered inside `<pre>` tags in the Audit Details tab for both the "New Data" card and the "Old Data" card.

---

### `formatDate(dateString: string): string`
- **Signature:** `formatDate(dateString: string): string`
- **Logic:**
  1. Delegates to Angular's `DatePipe.transform()`.
  2. Applies the format `'dd/MM/yyyy'` to the input `dateString`.
  3. If `DatePipe.transform()` returns `null` (e.g., empty string or invalid date), falls back to an empty string `''`.
- **Returns:** A formatted date string in `dd/MM/yyyy` format, or `''`.
- **Used in template:** Bound to the "Created date" field in the Core Data tab, called as `formatDate(logData.created_at || '')`.

---

## Template Bindings & Structure

The template renders a single `ui5-dialog` with a two-tab layout and a footer cancel button.

### Dialog root
```
<ui5-dialog [open]="open" id="dialog" [attr.header-text]="localization.logInfo">
```
- `[open]` is bound to the component's `open` boolean. The dialog appears/disappears reactively.
- `header-text` is set via `[attr.header-text]` to the localized string `'Log Information'`.

---

### Tab 1 — "Core Data" (default selected)

Displays the primary metadata fields of the log entry in a grid layout using Bootstrap column classes (`col-md-4`, `col-md-6`).

| UI Element | Binding | Notes |
|---|---|---|
| `ui5-switch` (Active) | `[(ngModel)]="logData.is_active"` + `disabled` | Shows active status; non-interactive. |
| `ui5-switch` (Read) | `[(ngModel)]="logData.is_read"` + `disabled` | Shows read status; non-interactive. |
| `ui5-input` (Log Id) | `[value]="logData.custom_id \|\| ''"` + `readonly` | Displays the log's custom ID. |
| `ui5-input` (Table Name) | `[value]="getModelName(logData.model_type) \|\| ''"` + `readonly` | Displays the parsed model/table name. |
| `ui5-input` (Table ID) | `[value]="logData.model_custom_id \|\| ''"` + `readonly` | Displays the custom ID of the affected record. |
| `ui5-input` (Action Type) | `[value]="logData.action_type \|\| ''"` + `readonly` | Displays the action (e.g., CREATE, UPDATE, DELETE). |
| `ui5-input` (User Name) | `[value]="logData.user_name \|\| ''"` + `readonly` | Displays the name of the user who triggered the action. |
| `ui5-input` (User Email) | `[value]="logData.user_email \|\| ''"` + `readonly` | Displays the email of the user. |
| `ui5-input` (User IP) | `[value]="logData.ip_address \|\| ''"` + `readonly` | Displays the IP address from which the action originated. |
| `ui5-input` (Created date) | `[value]="formatDate(logData.created_at \|\| '')"` + `readonly` | Displays creation date formatted as `dd/MM/yyyy`. |

All inputs are strictly `readonly` — no editing is possible in this tab.

---

### Tab 2 — "Audit Details"

Displays the table name and action type again at the top, then a two-column card layout showing the diff payloads.

| UI Element | Binding | Notes |
|---|---|---|
| `ui5-input` (Table Name) | `[value]="getModelName(logData.model_type) \|\| ''"` + `readonly` | Duplicate of Core Data tab. |
| `ui5-input` (Action Type) | `[value]="logData.action_type \|\| ''"` + `readonly` | Duplicate of Core Data tab. |
| `ui5-card` (New Data) | header title: `localization.newData` | Card containing a `<pre>` element. |
| `<pre>` inside New Data card | `{{ formatJSON(logData.new_value) }}` | Pretty-prints the new JSON payload. |
| `ui5-card` (Old Data) | header title: `localization.OldData` | Card containing a `<pre>` element. |
| `<pre>` inside Old Data card | `{{ formatJSON(logData.old_value) }}` | Pretty-prints the old JSON payload. |

The two cards are laid out side-by-side using `col-md-5` / `col-md-1` (spacer) / `col-md-5`.

---

### Dialog Footer
```
<div slot="footer" ...>
  <ui5-button (click)="open = false" design="Emphasized">{{ localization.Cancel }}</ui5-button>
</div>
```
- A single "Cancel" button is placed in the `footer` slot.
- Clicking it sets `open = false` inline, which closes the dialog.
- No confirmation or data submission occurs — the dialog is purely informational.

---

## API Calls

None. This component makes no HTTP requests. All data is received via the `logData` `@Input()` property from the parent component.

---

## Validation Logic

None. This is a read-only display component. All inputs and switches are marked `readonly` or `disabled`. No form validation is performed.

---

## Services Injected

| Service | Why injected | Methods used |
|---|---|---|
| `DatePipe` | Formats the `created_at` timestamp for display | `transform(dateString, 'dd/MM/yyyy')` |

`DatePipe` is provided via Angular's `CommonModule` (which is imported) and injected through the constructor. It must also be provided at module or application level (or via `providers: [DatePipe]` in the standalone component or its host).

---

## Inter-component Communication

| Direction | Mechanism | Description |
|---|---|---|
| Parent → Child | `@Input() isOpen: EventEmitter<void>` | Parent passes its own `EventEmitter` instance. The child subscribes and opens the dialog on each emission. |
| Parent → Child | `@Input() logData: ActivityLog` | Parent supplies the full log record to display. |
| Child → Parent | None | The component does not communicate back to the parent. Closing the dialog only changes the local `open` flag; no output event is emitted. |

---

## Enums / Models Used

### `ActivityLog` — `@app/shared/model/activitylog`

Implements `Deserializable`. All fields are optional except `action_type`.

| Field | Type | Notes |
|---|---|---|
| `id` | `number \| undefined` | Primary key (not displayed in UI). |
| `action_type` | `string` | Required. The CRUD action performed (CREATE, UPDATE, DELETE, etc.). |
| `custom_id` | `string \| undefined` | Human-readable log identifier displayed as "Log Id". |
| `ip_address` | `string \| undefined` | IP address of the actor. |
| `is_active` | `boolean \| undefined` | Default `true`. Displayed as a disabled switch. |
| `is_read` | `boolean \| undefined` | Read/unread status. Displayed as a disabled switch. |
| `model_custom_id` | `string \| undefined` | Human-readable ID of the affected record. |
| `model_id` | `number \| undefined` | Numeric primary key of the affected record (not displayed). |
| `model_type` | `string \| undefined` | Fully-qualified PHP class name of the affected model. Parsed by `getModelName()`. |
| `new_value` | `string \| undefined` | JSON string of the record state after the action. |
| `old_value` | `string \| undefined` | JSON string of the record state before the action. |
| `session_id` | `string \| undefined` | Session identifier (not displayed). |
| `user_id` | `number \| undefined` | Numeric user ID (not displayed). |
| `user_name` | `string \| undefined` | Display name of the acting user. |
| `user_email` | `string \| undefined` | Email of the acting user. |
| `user` | `User \| undefined` | Nested User object (not used in this component's template). |
| `deleted_at` | `string \| undefined` | Soft-delete timestamp (not displayed). |
| `created_at` | `string \| undefined` | Creation timestamp; formatted via `formatDate()`. |
| `updated_at` | `string \| undefined` | Last update timestamp (not displayed). |

### `Localization` — `@shared/utilities/localization`

Static object providing i18n strings. Keys used in this component:

| Key | Resolved value |
|---|---|
| `localization.logInfo` | `'Log Information'` (dialog header) |
| `localization.Active` | `'Active'` (switch label) |
| `localization.Cancel` | `'Cancel'` (footer button) |
| `localization.newData` | `'New Data'` (audit card header) |
| `localization.OldData` | `'Old Data'` (audit card header) |

---

## Key Business Logic

1. **Dialog open/close pattern via EventEmitter Input:** Instead of using a standard two-way binding or a boolean input to control dialog visibility, the parent passes an `EventEmitter` as an `@Input`. The child subscribes to it in `ngOnInit`. This means the parent opens the dialog imperatively by calling `emit()` on its own emitter. The child closes it locally via `open = false` on button click. There is no subscription cleanup (`takeUntil` or `unsubscribe`), which can cause memory leaks if the component is destroyed and re-created frequently.

2. **PHP namespace parsing in `getModelName()`:** The `model_type` field on an `ActivityLog` contains a PHP fully-qualified class name using backslash delimiters (e.g., `App\Models\Employee`). The `getModelName()` method strips the namespace and returns only the terminal class name (e.g., `Employee`), making the table name human-readable without storing a separate display string.

3. **Safe JSON pretty-printing in `formatJSON()`:** The `new_value` and `old_value` fields are raw JSON strings from the server. `formatJSON()` parses and re-serializes them with 2-space indentation for display in a `<pre>` block. If the field is empty, `null`, `undefined`, or malformed, the `JSON.parse()` call throws and the method returns `'Invalid JSON'` rather than crashing the template.

4. **All fields are read-only:** This component is strictly a viewer — no data mutation occurs. All `ui5-input` elements carry `readonly` and all `ui5-switch` elements carry `disabled`. There is no form submission, no service call, and no event emitted back to the parent.

5. **Duplicate fields across tabs:** "Table Name" and "Action Type" appear in both the Core Data tab and the Audit Details tab. This is intentional for context — the Audit Details tab is self-contained so the user does not need to switch back to Core Data to identify which model was affected.
