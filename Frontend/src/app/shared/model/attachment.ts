import { Deserializable } from '@app/shared/interfaces/deserializable';

export default class Attachment implements Deserializable {
  id?: number;
  model_type?: string;
  model_id?: number;
  path?: string;
  uuid?: string;
  collection_name?: string;
  name?: string;
  file_name?: string;
  mime_type?: string;
  disk?: string;
  conversions_disk?: string;
  size?: number;
  order_column?: number;
  created_at?: string;
  updated_at?: string;
  is_selected?: boolean;
  original_url?: string;
  preview_url?: string;
  html_content?: any;

  deserialize(input: any): this {
    Object.assign(this, input);
    this.mime_type = input.mime_type || 'application/octet-stream'; 
    return this;
  }

  private readonly fileTypes = new Map<string, string[]>([
    [
      'image',
      [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/bmp',
        'image/webp',
        'image/svg+xml',
      ],
    ],
    [
      'document',
      [
        'application/msword', // .doc
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      ],
    ],
    ['pdf', ['application/pdf']],
    [
      'excel',
      [
        'application/vnd.ms-excel', // .xls
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      ],
    ],
    [
      'powerpoint',
      [
        'application/vnd.ms-powerpoint', // .ppt
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      ],
    ],
    ['text', ['text/plain']],
    ['message', ['message/rfc822', 'application/vnd.ms-outlook']],
  ]);

  checkFileType(data?: any): string | null {
    for (const [type, mimeTypes] of this.fileTypes.entries()) {
      if (mimeTypes.includes(this.mime_type || '')) {
        return type;
      }
    }
    return null;
  }

  getFormattedDate(): string {
    if (!this.created_at) return '';

    const date = new Date(this.created_at);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  getFileSizeInKB(): string {
    if (!this.size) return '';

    return `${parseFloat(`${this.size / 1024}`).toFixed()} KB`;
  }

  getDocumentUrl(): string | undefined {
    return this.html_content;
  }

  async parseFileFromUrl(): Promise<any> {
    return { html: '' };
  }

  toOdata(): Object {
    return {
      ...this,
      path: undefined,
      html_content: undefined,
    };
  }
}
