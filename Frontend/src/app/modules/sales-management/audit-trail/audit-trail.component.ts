import { DatePipe } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { ActivityLog } from '@app/shared/model/activitylog';
import { Localization } from '@app/shared/utilities/localization';

@Component({
  selector: 'app-audit-trail',
  templateUrl: './audit-trail.component.html',
  styleUrl: './audit-trail.component.scss',
})
export class AuditTrailComponent {
  isClearLog: boolean = false;
  loading: boolean = false;
  activityLogs: ActivityLog[] = [];
  open: boolean = false;
  odata: boolean;
  api: boolean;
  model = 'App\\Models\\SalesOrder';
  public localization = Localization;
  ToastType: string = '';
  ngOnInit(): void {
    this.getInitialActiveLog();
  }

  constructor(
    private router: Router,
    private commonService: CommonService,
    private datePipe: DatePipe,
    private toastService: ToastService
  ) {
    this.odata = this.commonService.odata;
    this.api = this.commonService.api;
  }

  onClosePopover() {
    this.open = false;
  }
  getInitials(name: string): string {
    const nameParts = name.split(' ');
    const firstNameInitial = nameParts[0].charAt(0).toUpperCase();
    const lastNameInitial =
      nameParts.length > 1 ? nameParts[1].charAt(0).toUpperCase() : '';
    return firstNameInitial + lastNameInitial;
  }

  formatDate(dateString: string): string {
    return this.datePipe.transform(dateString, 'dd/MM/yyyy') || '';
  }

  getState(actionType: string): string {
    return actionType === 'delete' ? 'Critical' : 'Information';
  }

  getModelName(modelType: string | undefined): string {
    return modelType?.split('\\').pop() || 'Unknown Model';
  }

  getNotificationTitle(log: ActivityLog): string {
    const modelName = this.getModelName(log.model_type);
    if (log.action_type === 'insert') {
      return `New ${modelName} Added (ID: ${log.model_custom_id})`;
    } else if (log.action_type === 'delete') {
      return `${modelName} Deleted (ID: ${log.model_custom_id})`;
    } else {
      return `${modelName} Updated (ID: ${log.model_custom_id})`;
    }
  }

  getNotificationMessage(log: any): string {
    const modelName = this.getModelName(log.model_type);
    if (log.action_type === 'insert') {
      return `A new ${modelName}  (${log.model_custom_id}) has been ${
        JSON.parse(log.new_value).status
      }  by ${log.user?.name || 'Unknown User'}.`;
    } else if (log.action_type === 'delete') {
      return `The ${modelName} (${log.model_custom_id}) was deleted by ${
        log.user?.name || 'Unknown User'
      }.`;
    } else {
      return `${modelName} (${log.model_custom_id}) has been ${
        JSON.parse(log.new_value).status
          ? JSON.parse(log.new_value).status
          : JSON.parse(log.old_value).status
      } by ${log.user?.name || 'Unknown User'}.`;
    }
  }

  getStatus(log: any) {
    try {
      const newValue = JSON.parse(log.new_value ?? '{}');
      return newValue.status ?? null;
    } catch {
      return null;
    }
  }

  getImportance(log: any) {
    return this.getStatus(log) === 'DRAFT' ? 'Important' : 'Standard';
  }

  RefreshLog() {
    this.loading = true;
    this.getInitialActiveLog();
  }

  onCloseLog(logId?: number) {
    if (!logId) {
      return;
    }
    this.open = true;
    this.loading = true;
    const logInfo = { is_read: true };
    this.commonService
      .put(`ActivityLogs/${logId}`, logInfo, this.odata)
      .subscribe({
        next: () => {
          this.toastService.show('remove');
          this.getInitialActiveLog();
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  clearAllLogs() {
    this.loading = true;
    this.isClearLog = true;

    this.commonService.post('activity-logs/read', {}, this.api).subscribe({
      next: () => {
        this.toastService.show('remove');
        this.getInitialActiveLog();
        this.loading = false;
        this.isClearLog = false;
      },
      error: () => {
        this.loading = false;
        this.isClearLog = false;
      },
    });
  }

  getInitialActiveLog() {
    this.commonService
      .get(
        `ActivityLogs?$expand=user&$filter=model_type eq '${this.model}' &$orderby=created_at desc&$top=30`,
        true
      )
      .subscribe({
        next: (response: any) => {
          this.activityLogs = response.value.map((item: any) =>
            new ActivityLog().deserialize(item)
          );
          this.loading = false;
          const count = response['@count'] || response.value.length;
        },
        error: (error: any) => {
          console.error('Error fetching notifications:', error);
          this.loading = false;
        },
      });
  }

  showAllLogs() {
    this.open = false;
    const url = 'base-data-management/activity-log';
    if (
      typeof window !== 'undefined' &&
      window.navigator &&
      window.navigator.userAgent
    ) {
      window.open(`https://${window.location.host}/${url}`, '_blank');
    }
  }
}
