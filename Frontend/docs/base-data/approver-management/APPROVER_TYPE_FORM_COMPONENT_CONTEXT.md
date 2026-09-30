# APPROVER_TYPE_FORM_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| TS file | `Frontend/src/app/modules/base-data-management/approver-management/approver-type-form/approver-type-form.component.ts` |
| HTML file | `Frontend/src/app/modules/base-data-management/approver-management/approver-type-form/approver-type-form.component.html` |
| Selector | `app-approver-type-form` |
| Component type | Create/Edit dialog (mirrors `count-type-form`) |

### Purpose

Simple CRUD dialog for the `ApprovalType` master-data entity itself (code + name + active toggle). Used by `ApproverListComponent` for both "New" and "Edit" actions on the left-pane grid.

`code` is a short machine-readable identifier (e.g. `HR_LEAVE_REQUEST`), distinct from the human-readable `name`. It's uppercased client-side as-you-type (`onCodeInput`) for immediate visual feedback, and enforced server-side too via `ApprovalType::setCodeAttribute` (a Laravel attribute mutator) — so the stored value is always uppercase regardless of write path (this form, OData directly, etc.).

---

## Inputs / Outputs

| Name | Direction | Type | Purpose |
|---|---|---|---|
| `open` | Input (two-way via `openChange`) | `boolean` | Dialog visibility. |
| `saveMode` | Input | `string` | `saveMode.POST` (create) or `saveMode.PUT` (edit). |
| `approvalType` | Input | `ApprovalType` | Form data (same object reference as parent's — mutated directly via `ngModel`). |
| `refreshTable` | Output | `EventEmitter<void>` | Emitted after successful save. |

---

## Methods

### `onCodeInput(event)`
Uppercases the `code` input's value as-typed (preserving cursor position via `selectionStart`/`setSelectionRange`).

### `save()`
Validates `approvalType.name` non-empty. POSTs `ApprovalTypes` (OData) in create mode, or PUTs `ApprovalTypes({id})` in edit mode, with `approvalType.toOdata()`. On success: emits `refreshTable`, shows toast, closes dialog.

### `checkValidation(event)` / `validateForm()`
Real-time + submit-time validation on `name`.

### `closeDialog()`
Resets `open`/`loading`/value-state, emits `openChange`.

---

## API Calls

| HTTP | Endpoint | When | Payload |
|---|---|---|---|
| POST | `ApprovalTypes` (OData) | `save()` POST mode | `approvalType.toOdata()` |
| PUT | `ApprovalTypes({id})` (OData) | `save()` PUT mode | `approvalType.toOdata()` |

---

## Services Injected

| Service | Methods Used |
|---|---|
| `CommonService` | `post()`, `put()` |
| `ToastService` | `show('add' \| 'edit' \| 'error')` |
