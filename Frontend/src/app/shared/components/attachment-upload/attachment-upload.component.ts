import { CommonModule } from '@angular/common';
import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
  OnInit,
  SimpleChanges,
  OnChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui5MainModule } from '@ui5/webcomponents-ngx';
import { Observable, Subscription } from 'rxjs';
import { MediaService } from '@app/services/media-service';
import { CommonService } from '@app/services/common-service/common.service';
import { environment } from '@env/environment';
import {
  WebcamImage,
  WebcamInitError,
  WebcamModule,
  WebcamUtil,
} from 'ngx-webcam';
import { AttachmentPreviewComponent } from '@app/shared/components/attachment-preview/attachment-preview.component';
import { Localization } from '@shared/utilities/localization';
import { Subject } from 'rxjs';

interface AttachmentFile {
  id: string;
  name: string;
  file_name: string;
  type: 'image' | 'document' | 'pdf' | 'excel' | 'powerpoint' | 'text' | null;
  path?: string;
  file?: File;
  updated_at: string;
  size: string;
  is_standard: boolean;
  isFromInput?: boolean;
  extension?: string;
}

interface PreviewFile {
  id: string;
}

@Component({
  selector: 'app-attachment-upload',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    Ui5MainModule,
    CommonModule,
    AttachmentPreviewComponent,
    WebcamModule,
    FormsModule,
  ],
  templateUrl: './attachment-upload.component.html',
  styleUrls: ['./attachment-upload.component.scss'],
})
export class AttachmentUploadComponent implements OnInit, OnChanges, OnDestroy {
  @Output() loadImages = new EventEmitter<void>();
  @Output() IsInsert: EventEmitter<void> = new EventEmitter<void>();
  @Input() model: any = {};
  @Input() id: any = null;
  @Input() apiUrl: string = '';
  @Input() isPreview: boolean = false;
  @Input() isEdit: boolean = false;
  @Input() isDisable: boolean = false;

  @Output() public pictureTaken = new EventEmitter<WebcamImage>();
  public localization = Localization;
  showWebcam = false;
  allowCameraSwitch = true;
  multipleWebcamsAvailable = false;
  deviceId: string | undefined;
  currentCamera: 'front' | 'back' | null = null;
  availableCameras: { deviceId: string; label: string; facingMode?: string }[] =
    [];
  errors: WebcamInitError[] = [];

  private trigger: Subject<void> = new Subject<void>();
  private nextWebcam: Subject<string> = new Subject<string>();

  fileCount: number = 0;
  modalType: string = 'edit';
  isDownloadVisible: boolean = true;
  isSubmmiting: boolean = false;
  fileFormat: string = '*/*';
  isShowStandard: boolean = true;
  loading: boolean = false;
  fileArr: AttachmentFile[] = [];
  data: any = null;
  selectedFileToOpen: PreviewFile = { id: '1' };
  private idSubscription: Subscription;
  api: boolean;
  odata: boolean;

  errorMessage: string = '';
  message_strip: boolean = false;

  // New properties for file renaming
  editingFileId: string | null = null;
  private originalFileName: string = '';
  editBaseName: string = '';
  fileExtension: string = '';

  constructor(
    private mediaService: MediaService,
    private commonService: CommonService
  ) {
    this.idSubscription = this.mediaService.id$.subscribe((id) => {
      if (this.isEdit && id && this.model) {
        this.id = id;
        this.insertAttachmentFile();
      }else if (!this.isEdit && id && this.model && this.fileArr.length ) {
        this.id = id;
        this.insertAttachmentFile();
      }
    });
    this.api = this.commonService.api;
    this.odata = this.commonService.odata;
  }

  public async ngOnInit(): Promise<void> {
    try {
      const mediaDevices = await WebcamUtil.getAvailableVideoInputs();
      this.availableCameras = mediaDevices.map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${device.deviceId}`,
        facingMode: this.inferFacingMode(device.label),
      }));
      this.multipleWebcamsAvailable = mediaDevices.length > 1;

      if (mediaDevices.length > 0) {
        const backCamera = this.availableCameras.find(
          (cam) => cam.facingMode === 'environment'
        );
        const defaultCamera = backCamera || this.availableCameras[0];
        this.deviceId = defaultCamera.deviceId;
        this.currentCamera =
          defaultCamera.facingMode === 'environment' ? 'back' : 'front';
      }
    } catch (error) {
      console.error('Error initializing cameras:', error);
    }
  }

  private inferFacingMode(label: string): string | undefined {
    const lowerLabel = label.toLowerCase();
    if (
      lowerLabel.includes('back') ||
      lowerLabel.includes('rear') ||
      lowerLabel.includes('environment')
    ) {
      return 'environment';
    } else if (
      lowerLabel.includes('front') ||
      lowerLabel.includes('user') ||
      lowerLabel.includes('selfie')
    ) {
      return 'user';
    }
    return undefined;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data'] && changes['data'].currentValue) {
    }
  }

  loadInputImages() {
    if (!this.isEdit || !this.apiUrl) {
      return;
    }
    this.fileArr = [];
    this.fileCount = 0;
    this.loading = true;
    this.commonService
      .get(`${this.apiUrl}/${this.id}?$expand=media`, this.odata)
      .subscribe({
        next: (res: any) => {
          this.data = res;
          this.mapMedia();
        },
        error: (error: any) => {
          console.error('Error fetching files:', error);
          this.loading = false;
          this.showError('Failed to load files');
        },
      });
  }

  mapMedia() {
    this.loading = false;
    const inputFiles: AttachmentFile[] = this.data.media.map(
      (item: any, index: number) => {
        // Extract file extension from file_name
        const fileName = item.file_name || `Image_${index + 1}`;
        const parts = fileName.split('.');
        const extension =
          parts.length > 1 ? `.${parts.pop()?.toLowerCase()}` : '';
        const baseName = parts.join('.');

        // Determine file type based on mime_type or extension
        let fileType: AttachmentFile['type'] = null;
        if (item.mime_type?.includes('image')) {
          fileType = 'image';
        } else if (
          item.mime_type === 'application/pdf' ||
          extension === '.pdf'
        ) {
          fileType = 'pdf';
        } else if (
          item.mime_type?.includes('ms-excel') ||
          item.mime_type?.includes('spreadsheetml') ||
          extension === '.xls' ||
          extension === '.xlsx'
        ) {
          fileType = 'excel';
        } else if (
          item.mime_type?.includes('msword') ||
          item.mime_type?.includes('wordprocessingml') ||
          extension === '.doc' ||
          extension === '.docx'
        ) {
          fileType = 'document';
        } else if (
          item.mime_type?.includes('powerpoint') ||
          item.mime_type?.includes('presentationml') ||
          extension === '.ppt' ||
          extension === '.pptx'
        ) {
          fileType = 'powerpoint';
        } else if (
          item.mime_type?.startsWith('text/') ||
          extension === '.txt'
        ) {
          fileType = 'text';
        }

        // Format file size in KB
        let size = 'Unknown';
        if (item.size) {
          const sizeInBytes =
            typeof item.size === 'number' ? item.size : parseFloat(item.size);
          if (!isNaN(sizeInBytes)) {
            size = this.formatFileSize(sizeInBytes);
          } else {
            console.warn(`Invalid size for file ${fileName}: ${item.size}`);
          }
        }

        const filePath = item.file_name
          ? `${environment.ServerApi}/storage/${item.id}/${item.file_name}`
          : '';

        return {
          id: item.id || `input-${Date.now()}-${index}`,
          name: baseName + extension,
          file_name: baseName + extension,
          type: fileType,
          path: filePath,
          updated_at: item.updated_at || new Date().toISOString(),
          size,
          is_standard: item.is_standard || false,
          isFromInput: true,
          extension,
        };
      }
    );

    this.fileArr = [
      ...this.fileArr.filter((file) => !file.isFromInput),
      ...inputFiles,
    ];
    this.fileCount = this.fileArr.length;

    if (!this.fileArr.some((file) => file.is_standard) && inputFiles.length) {
      this.setStandardFile(inputFiles[0]);
    }
  }

  onFileUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const newFiles: AttachmentFile[] = [];

    Array.from(input.files).forEach((file, index) => {
      const fileId = `${Date.now()}-${index}`;
      const fileSize = this.formatFileSize(file.size);
      const uploadDate = new Date().toISOString();
      const fileType = this.getFileType(file);

      // Extract extension for local files
      const parts = file.name.split('.');
      const extension =
        parts.length > 1 ? `.${parts.pop()?.toLowerCase()}` : '';
      const baseName = parts.join('.');

      const fileObj: AttachmentFile = {
        id: fileId,
        name: baseName + extension,
        file_name: baseName + extension,
        type: fileType,
        path: fileType === 'image' ? URL.createObjectURL(file) : undefined,
        file,
        updated_at: uploadDate,
        size: fileSize,
        is_standard: false,
        isFromInput: false,
        extension,
      };

      newFiles.push(fileObj);
    });

    this.fileArr = [...this.fileArr, ...newFiles];
    this.fileCount = this.fileArr.length;
    input.value = '';
  }

  insertAttachmentFile() {
    if (!this.id || !this.model ) {
      return;
    }

    this.isSubmmiting = true;
    const formData = new FormData();

    formData.append('model', this.model);
    formData.append('id', this.id);
    formData.append(
      'form_data',
      JSON.stringify(
        this.fileArr.map((file) => ({
          id: file.id,
          file_name: file.file_name,
          type: file.type,
          updated_at: file.updated_at,
          size: file.size,
          is_standard: file.is_standard,
          isFromInput: file.isFromInput,
        }))
      )
    );

    this.fileArr
      .filter((file) => !file.isFromInput && file.file)
      .forEach((file) => {
        const renamedFile = new File([file.file!], file.file_name, {
          type: file.file!.type,
          lastModified: file.file!.lastModified,
        });
        formData.append(`media[]`, renamedFile);
      });

    this.commonService.post('image-upload', formData, this.api).subscribe({
      next: (res: any) => {
        this.fileArr = this.fileArr.map((file) => ({
          ...file,
          isFromInput: true,
        }));
        this.fileCount = this.fileArr.length;
        if (this.data && this.data.media) {
          this.data.media = this.fileArr.map((file) => ({
            id: file.id,
            name: file.name,
            file_name: file.file_name,
            mime_type: file.type === 'image' ? 'image/*' : file.type,
            updated_at: file.updated_at,
            size: file.size,
            is_standard: file.is_standard,
          }));
        }
        this.notifyOwnProfileImageChange(res);
        this.isSubmmiting = false;
      },
      error: (error: any) => {
        console.error('Error uploading files:', error);
        this.showError('Failed to upload files');
        this.isSubmmiting = false;
      },
    });
  }

  // The header avatar reads a cached 'profile_image' set at login from the current
  // user's own Employee media (see AuthController) — an upload here never touched
  // that cache, so a newly uploaded photo never showed up until the next full
  // login/reload. Only refresh it when the employee being edited is the logged-in
  // user's own record; an admin uploading someone else's photo must not affect it.
  private notifyOwnProfileImageChange(res: { files?: { media_url: string; is_standard: boolean }[] }): void {
    if (this.model !== 'Employee' || String(this.id) !== localStorage.getItem('employee_id')) {
      return;
    }

    const files = res?.files ?? [];
    const profileFile = files.find((file) => file.is_standard) ?? files[0];
    if (!profileFile) return;

    localStorage.setItem('profile_image', JSON.stringify(profileFile.media_url));
    this.mediaService.notifyProfileImageUpdated(profileFile.media_url);
  }

  setStandardFile(file: AttachmentFile): void {
    this.fileArr = this.fileArr.map((f) => ({
      ...f,
      is_standard: f.id === file.id,
    }));
  }

  downloadFile(): void {
    const standardFile = this.fileArr.find((file) => file.is_standard);
    if (!standardFile) {
      return;
    }

    let downloadUrl: string;
    if (standardFile.path) {
      downloadUrl = standardFile.path;
    } else if (standardFile.file) {
      downloadUrl = URL.createObjectURL(standardFile.file);
    } else {
      return;
    }

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = standardFile.file_name;
    link.click();

    if (!standardFile.path && standardFile.file) {
      URL.revokeObjectURL(downloadUrl);
    }
  }

  removeFile(fileId: string): void {
    const file = this.fileArr.find((f) => f.id === fileId);
    if (!file) return;

    if (file.path && !file.isFromInput) {
      URL.revokeObjectURL(file.path);
    }

    this.fileArr = this.fileArr.filter((f) => f.id !== fileId);
    this.fileCount = this.fileArr.length;
  }

  private getFileType(file: File): AttachmentFile['type'] {
    const mimeType = file.type.toLowerCase();
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf' || extension === 'pdf') return 'pdf';
    if (
      mimeType.includes('ms-excel') ||
      mimeType.includes('spreadsheetml') ||
      extension === 'xls' ||
      extension === 'xlsx'
    )
      return 'excel';
    if (
      mimeType.includes('msword') ||
      mimeType.includes('wordprocessingml') ||
      extension === 'doc' ||
      extension === 'docx'
    )
      return 'document';
    if (
      mimeType.includes('powerpoint') ||
      mimeType.includes('presentationml') ||
      extension === 'ppt' ||
      extension === 'pptx'
    )
      return 'powerpoint';
    if (mimeType.startsWith('text/') || extension === 'txt') return 'text';
    return null;
  }

  private formatFileSize(bytes: number): string {
    if (isNaN(bytes) || bytes <= 0) return 'Unknown';
    const kbSize = bytes / 1024;
    if (kbSize < 1024) {
      return `${kbSize.toFixed(2)} KB`;
    }
    const mbSize = kbSize / 1024;
    if (mbSize < 1024) {
      return `${mbSize.toFixed(2)} MB`;
    }
    const gbSize = mbSize / 1024;
    return `${gbSize.toFixed(2)} GB`;
  }

  disableSubmit() {
    if (!this.model || !Array.isArray(this.fileArr)) {
      console.warn('Invalid model or fileArr:', {
        model: this.model,
        fileArr: this.fileArr,
      });
      return true;
    }
    return this.model === 'User' && this.fileArr.length === 1;
  }

  openPreview(): void {
    if (!this.isPreview) {
      return;
    }
    this.IsInsert.emit();
  }

  onClickCamera() {
    this.showWebcam = true;
  }

  CloseCam() {
    this.showWebcam = false;
  }

  public triggerSnapshot(): void {
    this.trigger.next();
  }

  public toggleWebcam(): void {
    this.showWebcam = !this.showWebcam;
  }

  public handleInitError(error: WebcamInitError): void {
    this.errors.push(error);
  }

  public showNextWebcam(): void {
    if (!this.multipleWebcamsAvailable || this.availableCameras.length < 2) {
      return;
    }
    const frontCamera = this.availableCameras.find(
      (cam) => cam.facingMode === 'user'
    );
    const backCamera = this.availableCameras.find(
      (cam) => cam.facingMode === 'environment'
    );
    if (frontCamera && backCamera) {
      const nextDeviceId =
        this.currentCamera === 'front'
          ? backCamera.deviceId
          : frontCamera.deviceId;
      this.nextWebcam.next(nextDeviceId);
      this.deviceId = nextDeviceId;
      this.currentCamera = this.currentCamera === 'front' ? 'back' : 'front';
    } else {
      const currentIndex = this.availableCameras.findIndex(
        (cam) => cam.deviceId === this.deviceId
      );
      const nextIndex = (currentIndex + 1) % this.availableCameras.length;
      this.nextWebcam.next(this.availableCameras[nextIndex].deviceId);
      this.deviceId = this.availableCameras[nextIndex].deviceId;
      this.currentCamera =
        this.availableCameras[nextIndex].facingMode === 'environment'
          ? 'back'
          : 'front';
    }
  }

  public handleImage(webcamImage: WebcamImage): void {
    const blob = this.dataURItoBlob(webcamImage.imageAsDataUrl);
    const file = new File([blob], `webcam-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    });

    const fileId = `${Date.now()}`;
    const fileSize = this.formatFileSize(file.size);
    const uploadDate = new Date().toISOString();

    const fileObj: AttachmentFile = {
      id: fileId,
      name: file.name,
      file_name: file.name,
      type: 'image',
      path: URL.createObjectURL(file),
      file,
      updated_at: uploadDate,
      size: fileSize,
      is_standard: false,
      isFromInput: false,
      extension: '.jpg',
    };

    this.fileArr = [...this.fileArr, fileObj];
    this.fileCount = this.fileArr.length;

    this.pictureTaken.emit(webcamImage);
    this.showWebcam = false;
  }

  private dataURItoBlob(dataURI: string): Blob {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  }

  public cameraWasSwitched(deviceId: string): void {
    this.deviceId = deviceId;
    const camera = this.availableCameras.find(
      (cam) => cam.deviceId === deviceId
    );
    this.currentCamera =
      camera?.facingMode === 'environment' ? 'back' : 'front';
  }

  public get triggerObservable(): Observable<void> {
    return this.trigger.asObservable();
  }

  public get nextWebcamObservable(): Observable<string> {
    return this.nextWebcam.asObservable();
  }

  trackByFileId(index: number, file: AttachmentFile): string {
    return file.id;
  }

  startEditing(fileId: string, fileName: string) {
    this.editingFileId = fileId;
    this.originalFileName = fileName;
    const parts = fileName.split('.');
    this.fileExtension = parts.length > 1 ? `.${parts.pop()}` : '';
    this.editBaseName = parts.join('.');
  }

  saveFileName(fileId: string) {
    const file = this.fileArr.find((f) => f.id === fileId);
    if (!file) return;

    const invalidChars = /[\/\\:*?"<>|]/;
    if (
      this.editBaseName.trim() === '' ||
      invalidChars.test(this.editBaseName)
    ) {
      this.showError('File name cannot be empty or contain /\\:*?"<>|');
      return;
    }

    const newFileName = `${this.editBaseName.trim()}${this.fileExtension}`;
    file.name = newFileName;
    file.file_name = newFileName;
    file.extension = this.fileExtension;

    this.editingFileId = null;
    this.originalFileName = '';
    this.editBaseName = '';
    this.fileExtension = '';
    this.message_strip = false;
  }

  cancelEditing(fileId: string) {
    const file = this.fileArr.find((f) => f.id === fileId);
    if (file) {
      file.name = this.originalFileName;
      file.file_name = this.originalFileName;
      file.extension =
        this.originalFileName.split('.').length > 1
          ? `.${this.originalFileName.split('.').pop()}`
          : '';
    }
    this.editingFileId = null;
    this.originalFileName = '';
    this.editBaseName = '';
    this.fileExtension = '';
    this.message_strip = false;
  }

  onKeyPress(event: KeyboardEvent, fileId: string) {
    if (event.key === 'Enter') {
      this.saveFileName(fileId);
    } else if (event.key === 'Escape') {
      this.cancelEditing(fileId);
    }
  }

  private showError(message: string) {
    this.errorMessage = message;
    this.message_strip = true;
    setTimeout(() => (this.message_strip = false), 5000);
  }
  ngOnDestroy(): void {
    this.fileArr
      .filter((file) => !file.isFromInput && file.path)
      .forEach((file) => {
        URL.revokeObjectURL(file.path!);
      });
    this.idSubscription.unsubscribe();
  }
}
