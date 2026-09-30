import { CommonModule } from '@angular/common';
import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  Input,
  Output,
  EventEmitter,
  OnInit,
  SimpleChanges,
  OnChanges,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Ui5MainModule } from '@ui5/webcomponents-ngx';
import { CommonService } from '@app/services/common-service/common.service';
import { Localization } from '@shared/utilities/localization';
import { ToastService } from '@app/services/toast-service/toast.service';
import { SocketService } from '@app/services/socket.service';

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
@Component({
  selector: 'excel-upload-download',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [Ui5MainModule, CommonModule],
  templateUrl: './excel-import-export.component.html',
  styleUrl: './excel-import-export.component.scss',
})
export class ExcelImportExportComponent implements OnInit, OnChanges {
  @Input() IsInsertXls: EventEmitter<void> = new EventEmitter<void>();
  @Input() IsExportXls: EventEmitter<void> = new EventEmitter<void>();
  @Output() isSuccessChange = new EventEmitter<void>();
  @Output() IsOpenToastAlert = new EventEmitter<void>();
  @Input() apiUrl: string = '';
  @Input() exportApiUrl: string = '';
  @Input() exportPayload: any = {};
  @Input() exportFileName: string = '';
  @Input() isv8 : boolean = false

  fileCount: number = 0;
  ToastType: string = '';
  isSubmmiting: boolean = false;
  fileFormat: string =
    '.xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv';
  isShowStandard: boolean = true;
  fileArr: AttachmentFile[] = [];
  data: any = null;
  isImport: boolean = false;
  isExport: boolean = false;
  public localization = Localization;
  api: boolean;
  odata: boolean;
  ValidationMessage: string = '';
  message_strip: boolean = false;

  // Set only for imports that run as a background job (node-server queue) — the
  // response carries a jobId instead of the finished result, and progress arrives
  // over socket events scoped to that jobId, surfaced via a persistent toast.
  private importJobId: string | null = null;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
    private socketService: SocketService,
  ) {
    this.api = this.commonService.api;
    this.odata = this.commonService.odata;
  }

  ngOnInit() {
    this.IsInsertXls.subscribe(() => {
      this.isImport = true;
    });
    this.IsExportXls.subscribe(() => {
      this.isExport = true;
    });

    this.socketService
      .on('employee-import:progress')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((payload: { jobId: string; processed: number; total: number }) => {
        if (payload?.jobId !== this.importJobId) return;
        this.toastService.show(
          'import',
          $localize`Syncing employees ${payload.processed}/${payload.total}...`,
          true,
        );
      });

    this.socketService
      .on('employee-import:completed')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((payload: { jobId: string }) => {
        if (payload?.jobId !== this.importJobId) return;
        this.importJobId = null;
        this.isSuccessChange.emit();
        this.toastService.show('import');
      });

    this.socketService
      .on('employee-import:failed')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((payload: { jobId: string; error: string }) => {
        if (payload?.jobId !== this.importJobId) return;
        this.importJobId = null;
        this.toastService.show('error', payload.error);
      });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data'] && changes['data'].currentValue) {
    }
  }

  onFileUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const fileType = this.getFileType(file);
    if (fileType !== 'excel' && fileType !== 'csv') {
      console.error('Only Excel or CSV files are allowed.');
      input.value = '';
      return;
    }

    const fileId = `${Date.now()}-0`;
    const fileSize = this.formatFileSize(file.size);
    const uploadDate = new Date().toISOString();

    const fileObj: AttachmentFile = {
      id: fileId,
      name: file.name,
      file_name: file.name,
      type: fileType,
      file,
      updated_at: uploadDate,
      size: fileSize,
    };

    this.fileArr = [fileObj];
    this.fileCount = this.fileArr.length;
    input.value = '';
  }

  import() {
    if (!this.fileArr.length) {
      return;
    }
    this.isSubmmiting = true;

    const formData = new FormData();

    formData.append('file', this.fileArr[0].file!, this.fileArr[0].file_name);

    this.commonService.post(this.apiUrl, formData, this.api , undefined , undefined , true).subscribe({
      next: (res: any) => {
        this.isSubmmiting = false;
        this.CloseDialog();

        if (res?.jobId) {
          // Queued job — close now, track live sync progress via a persistent
          // toast driven by the employee-import:* socket events above.
          this.importJobId = res.jobId;
          this.toastService.show(
            'import',
            $localize`Syncing employees 0/${res.total_rows ?? 0}...`,
            true,
          );
          return;
        }

        this.isSuccessChange.emit();
        this.toastService.show('import');
      },
      error: (err: any) => {
        console.error('Error uploading file:', err);
        this.isSubmmiting = false;
        if (err.error?.status === false) {
          this.message_strip = true;
          this.ValidationMessage = err.error.message;
        }
        this.toastService.show('error');
      },
    });
  }

  Export() {
    if (!this.exportApiUrl) {
      console.error('Export API URL is not defined.');
      return;
    }

    this.isSubmmiting = true;

    this.commonService
      .post<Blob>(this.exportApiUrl, this.exportPayload ?? {}, this.api, undefined, 'blob')
      .subscribe({
        next: (res: Blob) => {
          const url = window.URL.createObjectURL(res);
          const a = document.createElement('a');
          a.href = url;
          a.download = this.exportFileName || 'Employee_' + new Date() + 'xlsx';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          this.isExport = false;
          this.isSubmmiting = false;
          this.toastService.show('export');
        },
        error: (error: any) => {
          console.error('Error downloading Excel:', error);
          this.isSubmmiting = false;
          this.toastService.show('error');
        },
      });
  }

  removeFile(fileId: string): void {
    const file = this.fileArr.find((f) => f.id === fileId);
    if (!file) return;

    this.fileArr = [];
    this.fileCount = 0;
  }

  private getFileType(file: File): AttachmentFile['type'] | null {
    const mimeType = file.type.toLowerCase();
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (
      mimeType.includes('ms-excel') ||
      mimeType.includes('spreadsheetml') ||
      extension === 'xls' ||
      extension === 'xlsx'
    ) {
      return 'excel';
    } else if (mimeType.includes('text/csv') || extension === 'csv') {
      return 'csv';
    }
    return null;
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  CloseDialog() {
    this.isImport = false;
    this.fileArr = [];
    this.fileCount = 0;
    if (this.data && this.data.media) {
      this.data.media = [];
    }
  }
}
