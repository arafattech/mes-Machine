# AttachmentUploadComponent

**Selector:** `app-attachment-upload`
**File:** `src/app/shared/components/attachment-upload/attachment-upload.component.ts`
**Standalone:** Yes
**Imports:** `Ui5MainModule`, `CommonModule`, `AttachmentPreviewComponent`, `WebcamModule`, `FormsModule`

## What It Does

Full-featured file attachment manager: upload files from disk, capture photos via webcam, rename files, set a standard (default) file for download, and remove files. In edit mode, loads existing attachments from API.

## Inputs

| Input | Type | Default | Purpose |
|---|---|---|---|
| `model` | `any` | `{}` | Model name string (e.g. `'Employee'`) used in API submission |
| `id` | `any` | `null` | Parent entity ID |
| `apiUrl` | `string` | `''` | Endpoint for loading existing files |
| `isPreview` | `boolean` | `false` | Show preview open button |
| `isEdit` | `boolean` | `false` | Load existing files from `apiUrl` on init |
| `isDisable` | `boolean` | `false` | Disable upload/download actions |

## Outputs

| Output | Emits | When |
|---|---|---|
| `loadImages` | `void` | Files should be reloaded by parent |
| `IsInsert` | `void` | Preview dialog opened |
| `pictureTaken` | `WebcamImage` | Webcam photo captured |

## Key Methods

| Method | Purpose |
|---|---|
| `loadInputImages()` | Fetches existing attachments when `isEdit=true` |
| `mapMedia()` | Maps API response to `AttachmentFile[]`, determines file types and sizes |
| `onFileUpload(event)` | Processes new file input, adds to `fileArr` |
| `insertAttachmentFile()` | Submits new files to API via `FormData` |
| `setStandardFile(file)` | Marks file as default download target |
| `downloadFile()` | Downloads the current standard file |
| `removeFile(fileId)` | Removes file, revokes object URL |
| `getFileType(file)` | Detects MIME → type label |
| `formatFileSize(bytes)` | Bytes → `KB/MB/GB` string |
| `onClickCamera()` | Shows webcam capture dialog |
| `triggerSnapshot()` | Fires camera snapshot |
| `handleImage(webcamImage)` | Converts `WebcamImage` to `File`, adds to `fileArr` |
| `startEditing(fileId, fileName)` | Enters rename mode for a file |
| `saveFileName(fileId)` | Validates and persists rename |
| `ngOnDestroy()` | Revokes all object URLs to prevent memory leaks |

## Internal State

| Property | Purpose |
|---|---|
| `fileArr: AttachmentFile[]` | All files (new + loaded) |
| `fileCount: number` | Display count |
| `loading / isSubmmiting` | Loading/submit state flags |
| `showWebcam: boolean` | Webcam dialog visibility |
| `editingFileId: string\|null` | Which file is being renamed |

## Usage Pattern

```html
<app-attachment-upload
  [model]="'Employee'"
  [id]="employeeId"
  [apiUrl]="'/api/attachments'"
  [isEdit]="true"
  [isPreview]="true"
  (IsInsert)="openPreview()"
></app-attachment-upload>
```

Call `insertAttachmentFile()` from parent (or let user click submit button) to POST files.
