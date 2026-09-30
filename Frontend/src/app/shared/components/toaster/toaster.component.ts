import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastComponent, MessageStripComponent } from '@ui5/webcomponents-ngx';
import {
  ToastService,
  ToastType,
} from '@app/services/toast-service/toast.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-toaster',
  standalone: true,
  imports: [ToastComponent, MessageStripComponent, CommonModule],
  templateUrl: './toaster.component.html',
  styleUrl: './toaster.component.scss',
})
export class ToasterComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  IsOpenToast = false;
  ToastMessage = '';
  Duration: number;
  type: string = '';

  Message = {
    save: $localize`Saved successfully`,
    delete: $localize`Deleted successfully`,
    remove: $localize`Removed successfully`,
    edit: $localize`Edited successfully`,
    add: $localize`Added successfully`,
    read: $localize`Marked as read`,
    error: $localize`Something went wrong`,
    approve: $localize`Approved successfully`,
    import: $localize`Imported successfully`,
    export: $localize`Exported successfully`,
    download: $localize`Download successfully`,
    password: $localize`Password changed successfully`,
    exist: $localize`Already exist`,
  };

  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  // ui5-toast auto-closes itself once its own [duration] elapses, independent of
  // hideTimer — while persisting we ignore that native close so a progress toast
  // can't disappear mid-sync.
  isPersisting = false;

  constructor(private toastService: ToastService) {
    this.Duration = 3000;
  }

  ngOnInit(): void {
    this.toastService.toast$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ type, message, persist }) => {
        if (this.hideTimer) clearTimeout(this.hideTimer);

        const applyToast = () => {
          this.ToastMessage = message || this.Message[type] || this.Message.error;
          this.type = type;
          this.isPersisting = !!persist;
          this.IsOpenToast = true;
          if (!persist) {
            this.hideTimer = setTimeout(() => {
              this.IsOpenToast = false;
            }, this.Duration);
          }
        };

        // ui5-toast reads [duration] only at the moment it opens — a
        // persisting toast (duration bound to 86400000) that's still open
        // when a final non-persist toast arrives won't pick up the new
        // (shorter) duration just from the binding changing underneath it.
        // Force a close/reopen so it actually restarts with the fresh value.
        if (this.IsOpenToast && this.isPersisting) {
          this.IsOpenToast = false;
          setTimeout(applyToast, 0);
        } else {
          applyToast();
        }
      });
  }

  ngOnDestroy(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.destroy$.next();
    this.destroy$.complete();
  }

  CloseToast(e: any) {
    if (this.isPersisting) return;
    this.IsOpenToast = false;
  }
}
