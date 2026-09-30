import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  EventEmitter,
  Input,
} from '@angular/core';
import Attachment from '@app/shared/model/attachment';
import { CommonService } from '@app/services/common-service/common.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Ui5MainModule } from '@ui5/webcomponents-ngx';
import { CommonModule } from '@angular/common';
import { environment } from '@env/environment';
import { NgxDocViewerModule } from 'ngx-doc-viewer';

@Component({
  selector: 'app-attachment-preview',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [Ui5MainModule, CommonModule, NgxDocViewerModule],
  templateUrl: './attachment-preview.component.html',
  styleUrl: './attachment-preview.component.scss',
})
export class AttachmentPreviewComponent {
  @Input() modelId: any = null;
  @Input() apiUrl: string = '';
  @Input() isOpen: EventEmitter<void> = new EventEmitter<void>();
  @Input() selectedFileId!: number;

  selectedFile: Attachment | undefined;
  viewerUrl: string = '';
  files: Attachment[] = [];
  uploadedOn = `Uploaded On:`;
  fileSize = `File Size`;
  documentTitle = $localize`Documents `;
  errorMessage: string = '';
  Open: boolean = false;
  filesCount: number = 0;
  isOpenFromUploader: boolean = false;
  isLoading: boolean = false;
  isImage: boolean = false;

  constructor(
    protected _commonSrv: CommonService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.isOpen.subscribe(() => {
      this.Open = true;
      this.loadFiles(this.modelId);
    });
  }

  ngOnChanges(change: any): void {
    this.filesCount = change.filesCount
      ? change.filesCount.currentValue
      : this.filesCount;
    this.modelId = change.modelId ? change.modelId.currentValue : this.modelId;
    this.files = [];
    this.selectedFile = undefined;
  }

  selectFile(event: any) {
    const item = event.detail.item as HTMLElement;
    const mimeType = event.detail.item.text;
    const id = item.id;
    const fileName = item.getAttribute('file-name');

    if (mimeType?.includes('image')) {
      this.isImage = true;
    } else {
      this.isImage = false;
    }

    if (item) {
      this.viewerUrl = `${environment.ServerApi}/storage/${id}/${fileName}`;
    } else {
      console.warn('Invalid file or path:', fileName, 'Event:', event);
    }
  }

  loadFiles(modelId?: any): void {
    this.isLoading = true;
    this.errorMessage = '';

    this._commonSrv
      .get(`${this.apiUrl}/${modelId}?$expand=media`, true)
      .subscribe({
        next: async (response: any) => {
          if (!response.media || !Array.isArray(response.media)) {
            this.errorMessage = 'No files found.';
            this.isLoading = false;
            return;
          }
          this.files = [];
          for (const media of response.media) {
            const file = new Attachment().deserialize(media);
            this.files.push(file);
            if (file.checkFileType() === 'message') {
              try {
                const parsed_eml = await file.parseFileFromUrl();
                file.html_content = this.sanitizer.bypassSecurityTrustHtml(
                  parsed_eml.html || ''
                );
              } catch (e) {
                console.error('Failed to parse EML:', e);
              }
            }
          }

          this.filesCount = this.files.length;
          this.selectedFile =
            this.isOpenFromUploader && this.selectedFileId
              ? this.files.find((file) => file.id === this.selectedFileId)
              : this.files[0] || undefined;
          this.isLoading = false;
        },
        error: (e) => {
          console.error('Load files error:', e);
          this.isLoading = false;
        },
      });
  }

  CloseDialog() {
    this.Open = false;
    this.viewerUrl = '';
    this.files = [];
  }
}
