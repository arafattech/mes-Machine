import { CommonModule, DatePipe } from '@angular/common';
import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonService } from '@app/services/common-service/common.service';
import { AuthService } from '@app/services/auth-service/auth.service';
import { SocketService } from '@app/services/socket.service';
import { AppNotification } from '@shared/model/notification';
import { Localization } from '@shared/utilities/localization';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification.component.html',
  styleUrl: './notification.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class NotificationComponent implements OnInit {
  @Input() isOpen: EventEmitter<void> = new EventEmitter<void>();
  @Output() notificationCount = new EventEmitter<number>();

  isClearLog = false;
  loading = false;
  notifications: AppNotification[] = [];
  open = false;
  alertToast: { title: string; message: string; senderName: string } | null = null;

  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  public localization = Localization;

  private readonly api: boolean;
  private currentUserId: number | null = null;
  private readonly destroyRef = inject(DestroyRef);
  private audioCtx: AudioContext | null = null;
  private useCustomSound = true;

  constructor(
    private commonService: CommonService,
    private authService: AuthService,
    private socketService: SocketService,
    private datePipe: DatePipe,
    private rolePermissionService: RolePermissionService,
  ) {
    this.api = this.commonService.api;
    const user = this.authService.user();
    this.currentUserId = user?.id ?? null;
  }

  ngOnInit(): void {
    this.fetchNotifications();
    this.isOpen.subscribe(() => {
      this.open = true;
      this.markAllReadOnOpen();
    });
    this.listenForNewNotifications();
    document.addEventListener('click', () => this.unlockAudio(), { capture: true, once: true });
  }

  private unlockAudio(): void {
    this.audioCtx = new AudioContext();
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  private listenForNewNotifications(): void {
    this.socketService
      .on('notification:new')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((payload: unknown) => {
        const p = payload as { type?: string; title: string; message: string; sender_name: string; recipient_user_ids?: number[] };
        this.fetchNotifications();
        if (p.recipient_user_ids !== undefined) {
          if (this.currentUserId === null || !p.recipient_user_ids.includes(this.currentUserId)) {
            return;
          }
        } else if (p.type && !this.rolePermissionService.hasPermission(p.type)) {
          return;
        }
        if (localStorage.getItem('notification_alert_enabled') === 'false') {
          return;
        }
        this.playNotificationSound();
        this.showAlertToast(p.title, p.message, p.sender_name);
      });
  }

  showAlertToast(title: string, message: string, senderName: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.alertToast = { title, message, senderName };
    this.toastTimer = setTimeout(() => {
      this.alertToast = null;
    }, 12000);
  }

  dismissAlertToast(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.alertToast = null;
  }

  private playNotificationSound(): void {
    if (this.useCustomSound) {
      this.playCustomSound();
    } else {
      this.playDeviceSound();
    }
  }

  private playCustomSound(): void {
    if (!this.audioCtx) return;
    const play = () => {
      const notes = [
        { freq: 523.25, start: 0.0 },
        { freq: 659.25, start: 0.12 },
        { freq: 783.99, start: 0.24 },
      ];
      notes.forEach(({ freq, start }) => {
        const osc = this.audioCtx!.createOscillator();
        const gain = this.audioCtx!.createGain();
        osc.connect(gain);
        gain.connect(this.audioCtx!.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.audioCtx!.currentTime + start);
        gain.gain.setValueAtTime(0, this.audioCtx!.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.25, this.audioCtx!.currentTime + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx!.currentTime + start + 0.25);
        osc.start(this.audioCtx!.currentTime + start);
        osc.stop(this.audioCtx!.currentTime + start + 0.25);
      });
    };
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().then(play);
    } else {
      play();
    }
  }

  private playDeviceSound(): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      const n = new Notification('MES — New Notification', { silent: false });
      setTimeout(() => n.close(), 3000);
    }
  }

  onClosePopover(): void {
    this.open = false;
  }

  private markAllReadOnOpen(): void {
    const hasUnread = this.notifications.some((n) => !n.is_read);
    if (!hasUnread) return;
    this.commonService.post('notifications/read-all', {}, this.api).subscribe({
      next: () => this.fetchNotifications(),
    });
  }

  getInitials(name: string): string {
    const parts = name.split(' ');
    return (parts[0]?.charAt(0) ?? '') + (parts[1]?.charAt(0) ?? '');
  }

  formatDate(dateString: string): string {
    return this.datePipe.transform(dateString, 'dd/MM/yyyy') ?? '';
  }

  getState(actionType: string): string {
    return actionType === 'deleted' ? 'Critical' : 'Information';
  }

  isToday(dateString: string): boolean {
    if (!dateString) return false;
    const d = new Date(dateString);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
  }

  getUnreadBorderStyle(n: AppNotification): string {
    if (this.isToday(n.created_at ?? '') && !n.is_read)
      return 'background: var(--sapSuccessBackground, #f1fdf6);';
    if (!n.is_read)
      return 'background: var(--sapInformationBackground, #e8f4fe);';
    return '';
  }

  getNotificationTitle(n: AppNotification): string {
    return n.title;
  }

  getNotificationMessage(n: AppNotification): string {
    return n.message;
  }

  RefreshLog(): void {
    this.loading = true;
    this.fetchNotifications();
  }

  removeNotification(n: AppNotification): void {
    this.commonService.delete(`notifications/${n.id}`, null, this.api).subscribe({
      next: () => {
        this.notifications = this.notifications.filter((x) => x.id !== n.id);
        const unreadCount = this.notifications.filter((x) => !x.is_read).length;
        this.notificationCount.emit(unreadCount);
      },
    });
  }

  clearAllLogs(): void {
    this.loading = true;
    this.commonService.delete('notifications/clear-all', null, this.api).subscribe({
      next: () => {
        this.notifications = [];
        this.notificationCount.emit(0);
        this.loading = false;
        this.isClearLog = false;
      },
      error: () => {
        this.loading = false;
        this.isClearLog = false;
      },
    });
  }

  fetchNotifications(): void {
    if (!this.currentUserId) {
      this.loading = false;
      return;
    }
    const query = `Notifications?$expand=sender&$filter=recipient_id eq ${this.currentUserId}&$orderby=is_read asc,created_at desc`;
    this.commonService.get(query, true).subscribe({
      next: (response: unknown) => {
        const res = response as { value: unknown[] };
        this.notifications = (res.value ?? []).map((item) =>
          new AppNotification().deserialize(item),
        );
        this.loading = false;
        const unreadCount = this.notifications.filter((n) => !n.is_read).length;
        this.notificationCount.emit(unreadCount);
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  showAllLogs(): void {
    this.open = false;
    window.open(`${window.location.origin}/base-data/activity-log`, '_blank');
  }
}
