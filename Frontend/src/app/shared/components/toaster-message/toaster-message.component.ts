import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastComponent, MessageStripComponent } from '@ui5/webcomponents-ngx';
import { ToastService, ToastType } from '@app/services/toast-service/toast.service';

@Component({
  selector: 'app-toaster-message',
  standalone: true,
  imports: [ToastComponent, MessageStripComponent, CommonModule],
  templateUrl: './toaster-message.component.html',
  styleUrl: './toaster-message.component.scss',
})
export class ToasterMessageComponent implements OnInit {
  Duration: number;
  @Input() IsOpenToastAlert: EventEmitter<void> = new EventEmitter<void>();
  @Input() IsOpenToast: boolean = false;
  @Input() ToastMessage: string = '';
  @Input() ToastType: string = '';

  Message = {
    delete: $localize`Deleted successfully`,
    remove: $localize`Removed successfully`,
    edit: $localize`Edited successfully`,
    add: $localize`Added successfully`,
    read: $localize`Marked as read`,
    error: $localize`Something went wrong`,
    approve: $localize`Approved successfully`,
    import: $localize`Imported successfully`,
    export: $localize`Exported successfully`,
    save: $localize`Saved successfully`,
    exist: $localize`Already exist`,
  };

  constructor(commonservices: CommonService) {
    this.Duration = commonservices.ToastDuration;
  }
  ngOnInit(): void {
    if (this.IsOpenToast) {
      setTimeout(() => {
        this.IsOpenToast = false;
      }, this.Duration);
    }
    this.IsOpenToastAlert.subscribe(() => {
      this.IsOpenToast = true;
      if (this.ToastType == 'delete') {
        this.ToastMessage = this.Message.delete;
        return;
      }
      if (this.ToastType == 'remove') {
        this.ToastMessage = this.Message.remove;
        return;
      }
      if (this.ToastType == 'edit') {
        this.ToastMessage = this.Message.edit;
        return;
      }
      if (this.ToastType == 'add') {
        this.ToastMessage = this.Message.add;

        return;
      }
      if (this.ToastType == 'approve') {
        this.ToastMessage = this.Message.approve;

        return;
      }
      if (this.ToastType == 'import') {
        this.ToastMessage = this.Message.import;

        return;
      }
      if (this.ToastType == 'export') {
        this.ToastMessage = this.Message.export;

        return;
      }
      if (this.ToastType == 'read') {
        this.ToastMessage = this.Message.read;
        return;
      }
      if (this.ToastType == 'error') {
        this.ToastMessage = this.Message.error;
        return;
      }
      if (this.ToastType == 'save') {
        this.ToastMessage = this.Message.save;
        return;
      }
      if (this.ToastType == 'exist') {
        this.ToastMessage = this.Message.exist;
        return;
      }
    });
  }

  CloseToast(e: any) {
    this.IsOpenToast = false;
  }
}
