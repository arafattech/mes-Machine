# AttachmentPreviewComponent

**Selector:** `app-attachment-preview`
**File:** `src/app/shared/components/attachment-preview/attachment-preview.component.ts`
**Standalone:** Yes
**Imports:** `Ui5MainModule`, `CommonModule`, `NgxDocViewerModule`

## What It Does

Two-panel dialog for browsing and previewing file attachments. Left panel: file list with type icons. Right panel: preview using `<img>` for images or `ngx-doc-viewer` for documents (PDF, Word, etc.). Supports EML parsing.

## Inputs

| Input | Type | Purpose |
|---|---|---|
| `modelId` | `any` | ID of the parent entity to load attachments for |
| `apiUrl` | `string` | Endpoint to fetch `Attachment[]` |
| `isOpen` | `EventEmitter<void>` | Trigger to open dialog and load files |
| `selectedFileId` | `number` | Pre-select and open a specific file |

## Outputs

None.

## Key Methods

| Method | Purpose |
|---|---|
| `ngOnInit()` | Subscribes to `isOpen` EventEmitter |
| `ngOnChanges(change)` | Handles `filesCount` and `modelId` changes |
| `loadFiles(modelId)` | Fetches `Attachment[]` from `apiUrl`, parses EML, resolves async previews |
| `selectFile(event)` | Sets `viewerUrl` and `isImage` for selected file |
| `CloseDialog()` | Closes dialog, clears state |

## Internal State

| Property | Purpose |
|---|---|
| `files: Attachment[]` | All attachments loaded |
| `selectedFile: Attachment\|undefined` | Currently previewed file |
| `viewerUrl: string` | URL passed to image/doc viewer |
| `isImage: boolean` | Switches between `<img>` and doc viewer |
| `isLoading: boolean` | Loading indicator |
| `Open: boolean` | Dialog visibility |

## Usage Pattern

```html
<app-attachment-preview
  [modelId]="entityId"
  [apiUrl]="'/api/attachments'"
  [isOpen]="previewTrigger"
></app-attachment-preview>
```

Trigger open: `previewTrigger.emit()`.
