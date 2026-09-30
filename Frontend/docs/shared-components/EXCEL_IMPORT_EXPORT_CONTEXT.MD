# ExcelImportExportComponent

**Selector:** `excel-upload-download`
**File:** `src/app/shared/components/excel-import-export/excel-import-export.component.ts`
**Standalone:** Yes — `CUSTOM_ELEMENTS_SCHEMA`
**Imports:** `Ui5MainModule`, `CommonModule`

## What It Does

Two-dialog component for Excel/CSV import and export operations.

**Import:** File picker (Excel/CSV only) → `FormData` POST → success toast + `isSuccessChange` emit.
**Export:** Confirmation dialog → POST to export endpoint → blob download triggered in browser.

### Async job import (node-server queue) — employee import

`import()` supports two response shapes from `apiUrl`:
- **Synchronous** (legacy, e.g. Laravel REST imports): response is the finished result → dialog closes immediately, `isSuccessChange` emits, `toastService.show('import')` fires (auto-hide toast).
- **Queued job** (`node-server` BullMQ-backed imports, e.g. `import/employees`): response is `{ jobId, total_rows, status: 'queued' }`. The dialog still closes **immediately** (no waiting UI), but a **persistent toast** (`toastService.show('import', message, persist: true)`) opens showing `Syncing employees X/Y...`, updated live via `SocketService` events scoped to `jobId`:
  - `employee-import:progress` → `{ jobId, processed, total }` — updates the persistent toast text.
  - `employee-import:completed` → `{ jobId }` — clears `importJobId`, emits `isSuccessChange` (grid refresh), replaces toast with normal auto-hide `'import'` toast.
  - `employee-import:failed` → `{ jobId, error }` — clears `importJobId`, shows auto-hide `'error'` toast with the server error message.

  Socket subscriptions are set up once in `ngOnInit()` via `inject(DestroyRef)` + `takeUntilDestroyed()` (no manual unsubscribe). Every handler guards on `payload.jobId === this.importJobId` so events from a stale/previous job are ignored. `importJobId` (private) is the only new state field — no progress bar UI in the dialog itself, since the dialog is already closed by the time progress starts.

  Backend: `node-server/src/module/import/services/employee-import.service.ts` (`EmployeeImportProcessorService.runImportJob`) + `node-server/src/module/import/queue/employee-import.queue.ts` (BullMQ `Worker`, concurrency 1). Chunks DB writes (`IMPORT_CHUNK_SIZE` per `$transaction`) instead of one giant transaction, to avoid the CPU/RAM spikes a single huge transaction caused in production.

## Inputs

| Input | Type | Purpose |
|---|---|---|
| `IsInsertXls` | `EventEmitter<void>` | Trigger to open import dialog |
| `IsExportXls` | `EventEmitter<void>` | Trigger to open export dialog |
| `apiUrl` | `string` | Import/upload endpoint |
| `exportApiUrl` | `string` | Export/download endpoint |
| `isv8` | `boolean` | Unused |

## Outputs

| Output | Emits | When |
|---|---|---|
| `isSuccessChange` | `void` | Import succeeded |
| `IsOpenToastAlert` | `void` | Unused |

## Key Methods

| Method | Purpose |
|---|---|
| `onFileUpload(event)` | Validates Excel/CSV, adds to `fileArr` |
| `import()` | POSTs `FormData` to `apiUrl`; branches on `res.jobId` (queued job vs synchronous result) — see "Async job import" above |
| `Export()` | POSTs to `exportApiUrl`, gets blob, triggers download |
| `removeFile(fileId)` | Removes selected file |
| `getFileType(file)` | Detects MIME (`excel` or `csv`) |
| `formatFileSize(bytes)` | Converts to `B/KB/MB/GB` |
| `CloseDialog()` | Resets state, closes both dialogs |

## File Model

```ts
interface AttachmentFile {
  id: string;
  name: string;
  file_name: string;
  type: 'excel' | 'csv';
  path?: string;
  file?: File;
  updated_at: string;
  size: string;
}
```

## Export Filename

Downloaded as `Employee$[timestamp].xlsx` — filename is hardcoded.

## Validation

Import validates MIME type; sets `ValidationMessage` on server error; shows `ui5-message-strip` banner.

## Usage Pattern

```html
<excel-upload-download
  [IsInsertXls]="importEmitter"
  [IsExportXls]="exportEmitter"
  [apiUrl]="'/api/employees/import'"
  [exportApiUrl]="'/api/employees/export'"
  (isSuccessChange)="refreshTable()"
></excel-upload-download>
```

Trigger import: `importEmitter.emit()`.
Trigger export: `exportEmitter.emit()`.

Usually included inside `app-custom-grid-table` or `app-custom-table` — parent table components wire up these emitters to toolbar buttons.
