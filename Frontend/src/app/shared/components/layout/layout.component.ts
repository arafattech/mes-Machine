import { ActivityLog } from '@app/shared/model/activitylog';
import { LocalizeService } from '@app/services/localize-service/localize.service';
import {
  Component,
  AfterViewInit,
  ViewChild,
  ElementRef,
  OnInit,
  OnDestroy,
  Output,
  EventEmitter,
  Input,
  inject,
} from '@angular/core';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BarComponent } from '@ui5/webcomponents-ngx/main/bar';
import { PopoverComponent } from '@ui5/webcomponents-ngx/main/popover';
import { AvatarComponent } from '@ui5/webcomponents-ngx/main/avatar';
import { ButtonComponent } from '@ui5/webcomponents-ngx/main/button';
import { LabelComponent } from '@ui5/webcomponents-ngx/main/label';
import { SelectComponent } from '@ui5/webcomponents-ngx/main/select';
import { OptionComponent } from '@ui5/webcomponents-ngx/main/option';
import { AuthService } from '@app/services/auth-service/auth.service';
import { User } from '@app/shared/model/user';
import { CommonService } from '@app/services/common-service/common.service';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { Permissions } from '@shared/enums/permissions';
import { CommonModule, DatePipe } from '@angular/common';
import { NotificationComponent } from '@shared/components/notification/notification.component';
import { Localization } from '@shared/utilities/localization';
import { ToasterComponent } from '@shared/components/toaster/toaster.component';
import { TranslationComponent } from '../language-switch/language-switch.component';
import { ThemeService } from '@app/services/theme.service';
import { environment } from '@env/environment';
import { EmployeeShift } from '@app/modules/hr-management/shared/models/employeeShift';
import { ShiftResolverService } from '@app/modules/hr-management/shared/services/shiftResolver.service';
import { MediaService } from '@app/services/media-service';
import { PlantSelectionService } from '@production-module/shared/services/plant-selection.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-layout',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    CommonModule,
    PopoverComponent,
    ButtonComponent,
    LabelComponent,
    SelectComponent,
    OptionComponent,
    BarComponent,
    AvatarComponent,
    NotificationComponent,
    ToasterComponent,
    TranslationComponent,
  ],

  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
})
export class LayoutComponent implements OnInit, OnDestroy {
  @ViewChild('densityMenu', { static: false })
  menuRef!: ElementRef<HTMLElement>;
  @ViewChild('density', { static: false }) btnRef!: ElementRef<HTMLElement>;

  @Output() IsOpenNotification = new EventEmitter<void>();
  @Input() notificationCount: EventEmitter<number> = new EventEmitter<number>();
  public appLogo: string = '';
  selectedLanguageName = '';
  selectedDiction = '';
  selectedDensityCode = 'Cozy';
  densityList: any[] = [
    { code: 'Cozy', name: 'Cozy', icon: 'source-code' },
    { code: 'Compact', name: 'Compact', icon: 'collapse' },
  ];

  public localization = Localization;
  /** Shows the header plant selector (production routes only) and enables plant-scoped production data. */
  public readonly showPlantSelector = true;
  public readonly plantSelection = inject(PlantSelectionService);
  type: string | null = null;
  logUserInfo = new User().deserialize({});
  loginUserInformation: string = '';
  isLogout: boolean = false;
  isClearLog: boolean = false;
  loading: boolean = false;
  settingOpen: boolean = false;
  isCollapsed: boolean = false;
  isDashboardRoute: boolean = false;
  isProductionRoute: boolean = false;
  preferredLanguage: string = '';
  selectedTheme: string = 'sap_fiori_3';
  notificationCountNumber: number = 0;
  userImg: string = '';
  alertEnabled: boolean = true;
  currentDateTime: Date = new Date();
  currentShift: EmployeeShift | null = null;
  private clockTimer?: ReturnType<typeof setInterval>;
  private shiftTimer?: ReturnType<typeof setInterval>;
  private profileImageSubscription?: Subscription;

  themes = [
    { label: 'Classic Glow', value: 'sap_fiori_3', icon: 'sap-icon://world' },
    { label: 'Classic Dark', value: 'sap_fiori_3_dark', icon: 'activate' },
    {
      label: 'Obsidian Black',
      value: 'sap_fiori_3_hcb',
      icon: 'sap-icon://shield',
    },
    {
      label: 'Crystal Light',
      value: 'sap_fiori_3_hcw',
      icon: 'sap-icon://display',
    },

    { label: 'Aurora Light', value: 'sap_horizon', icon: 'light-mode' },
    {
      label: 'Aurora Black',
      value: 'sap_horizon_dark',
      icon: 'master-task-triangle-2',
    },
    {
      label: 'Lunar Black',
      value: 'sap_horizon_hcb',
      icon: 'sap-icon://sap-ui5',
    },
    {
      label: 'Lunar White',
      value: 'sap_horizon_hcw',
      icon: 'sap-icon://lightbulb',
    },
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private commonService: CommonService,
    private activatedRoute: ActivatedRoute,
    private LocalizeService: LocalizeService,
    private themeService: ThemeService,
    private datePipe: DatePipe,
    private rolePermissionService: RolePermissionService,
    private shiftResolverService: ShiftResolverService,
    private mediaService: MediaService,
  ) {
    this.checkAppLogo();
    this.preferredLanguage = localStorage.getItem('preferred_language') || '';
    this.selectedTheme =
      localStorage.getItem('preferred_theme') || 'sap_fiori_3';
    this.selectedDensityCode = localStorage.getItem('currentDensity') || 'Cozy';
    this.selectedDiction = localStorage.getItem('currentDirection') || 'LTR';
    this.alertEnabled = localStorage.getItem('notification_alert_enabled') !== 'false';
  }

  get hasNotificationAccess(): boolean {
    return this.rolePermissionService.hasPermission(Permissions.NOTIFICATION_VIEW);
  }

  isDarkTheme(): boolean {
    const darkThemes = [
      'sap_fiori_3_dark',
      'sap_fiori_3_hcb',
      'sap_horizon_dark',
      'sap_horizon_hcb',
    ];

    const currentTheme = localStorage.getItem('preferred_theme');

    return darkThemes.includes(currentTheme || '');
  }
  ngOnInit(): void {
    this.logUserInfo = localStorage.getItem('userInfo')
      ? new User().deserialize(
          JSON.parse(localStorage.getItem('userInfo') || '{}'),
        )
      : new User().deserialize({});

    this.router.events.subscribe(() => {
      this.checkIfDashboardRoute();
      this.checkIfProductionRoute();
    });

    this.checkIfDashboardRoute();
    this.checkIfProductionRoute();
    if (this.showPlantSelector) {
      this.plantSelection.enable();
    }
    this.loadImg();
    this.profileImageSubscription = this.mediaService.profileImageUpdated$.subscribe((url) => {
      if (url) this.userImg = url;
    });

    this.clockTimer = setInterval(() => {
      this.currentDateTime = new Date();
    }, 1000);

    this.resolveCurrentShift();
    this.shiftTimer = setInterval(() => {
      this.resolveCurrentShift();
    }, 60000);
  }

  ngOnDestroy(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }
    if (this.shiftTimer) {
      clearInterval(this.shiftTimer);
    }
    this.profileImageSubscription?.unsubscribe();
  }

  private async resolveCurrentShift(): Promise<void> {
    try {
      this.currentShift = await this.shiftResolverService.resolveCurrentShift();
    } catch (error) {
      console.error('Failed to resolve current shift:', error);
    }
  }

  handleNotificationCount(count: number) {
    this.notificationCountNumber = count;
  }

  changeTheme($event: any) {
    const theme = $event.detail.selectedOption.value;
    this.themeService.setUI5Theme(theme);
  }

  isMcoRoute(): boolean {
    return this.router.url.includes('production/mco');
  }
  isNotification() {
    this.IsOpenNotification.emit();
  }
  toggleSidenav(): void {
    this.isCollapsed = !this.isCollapsed;
    this.commonService.emitSidenavToggle(this.isCollapsed);
  }

  changeLanguage(language: string) {
    localStorage.setItem('preferred_language', language);
    this.preferredLanguage = localStorage.getItem('preferred_language') || '';
  }
  checkIfDashboardRoute() {
    const currentRoute = this.router.url;
    this.isDashboardRoute = currentRoute === '/';
  }
  checkIfProductionRoute() {
    this.isProductionRoute = this.router.url.startsWith('/production');
  }
  // UI5 `change` types as plain `Event` in this project's UI5 Angular wrapper — `event: any`
  // matches the other UI5 select handlers in this component.
  onPlantChange(event: any): void {
    const value = event?.detail?.selectedOption?.value;
    this.plantSelection.select(value ? Number(value) : null);
  }
  onLogout() {
    const remember_token = localStorage.getItem('remember_token');
    this.loading = true;
    if (remember_token) {
      this.authService.logout(remember_token).subscribe({
        next: () => {
          this.clearAuthStorage();
          this.router.navigate(['/login']);
          this.authService.logoutCheck();
          this.loading = false;
        },
        error: (error) => {
          console.log(error);
          this.clearAuthStorage();
          this.router.navigate(['/login']);
          this.authService.logoutCheck();
          this.loading = false;
        },
      });
    } else {
      this.clearAuthStorage();
      this.router.navigate(['/login']);
      this.authService.logoutCheck();
      this.loading = false;
    }
  }

  private clearAuthStorage(): void {
    localStorage.removeItem('remember_token');
    localStorage.removeItem('userInfo');
    localStorage.removeItem('roles');
    localStorage.removeItem('permissions');
    localStorage.removeItem('preferred_language');
    localStorage.removeItem('media');
    localStorage.removeItem('profile_image');
    localStorage.removeItem('employee_id');
    localStorage.removeItem('department_id');
  }

  getInitials(name: string): string {
    const nameParts = name.split(' ');
    const firstNameInitial = nameParts[0].charAt(0).toUpperCase();
    const lastNameInitial =
      nameParts.length > 1 ? nameParts[1].charAt(0).toUpperCase() : '';
    return firstNameInitial + lastNameInitial;
  }
  // Same resolution as the employee dashboard's own profile image (Employees/{id}
  // ?$expand=media) — a live fetch rather than the login-time localStorage cache,
  // so the header always reflects the employee record's current media.
  loadImg() {
    this.authService.getUser().subscribe({
      next: (res: any) => {
        const employeeId = res?.employee?.id;
        if (!employeeId) return;

        this.commonService.get(`Employees/${employeeId}?$expand=media`, true).subscribe({
          next: (employee: any) => {
            const media = (employee?.media ?? []).find((item: any) => item.is_standard === true);
            this.userImg = media
              ? `${environment.ServerApi}/storage/${media.id}/${media.file_name}`
              : '';
          },
          error: (error: any) => console.error('Error fetching profile image:', error),
        });
      },
      error: (error: any) => console.error('Error fetching current user:', error),
    });
  }
  onLoad(event: MouseEvent) {
    const theme = localStorage.getItem('preferred_theme') || 'sap_fiori_3';
    this.themeService.setUI5Theme(theme);

    // Ctrl/Cmd/middle-click → let the browser's native anchor behavior open a new tab.
    if (event.ctrlKey || event.metaKey) return;

    event.preventDefault();
    this.router.navigate(['/']);
  }
  onCloseSettingPopover() {
    this.settingOpen = false;
  }
  settingsOpen() {
    this.settingOpen = !this.settingOpen;
  }

  onMenuItemSelect(event: any): void {
    const itemEl = event?.detail?.item as HTMLElement | undefined;
    const name = itemEl?.getAttribute('text') ?? '';
    const found = this.densityList.find((l) => l.name === name);
    if (!found) return;

    this.selectedDensityCode = found.code;
  }

  onDensityMenuItemSelect(event: any): void {
    const itemEl = event?.detail.targetItem.id;
    this.selectedDensityCode = itemEl;
    localStorage.setItem('currentDensity', itemEl);
  }
  onDirectionMenuItemSelect(event: any): void {
    const itemEl = event?.detail.targetItem.id;
    this.selectedDiction = itemEl;
    localStorage.setItem('currentDirection', itemEl);
  }
  onAlertToggle(event: any): void {
    this.alertEnabled = event?.detail?.isOn ?? !this.alertEnabled;
    localStorage.setItem('notification_alert_enabled', String(this.alertEnabled));
  }

  onThemeMenuItemSelect(event: any): void {
    const theme = event?.detail.targetItem.id;
    this.selectedTheme = theme;
    this.themeService.setUI5Theme(theme);
  }

  checkAppLogo() {
    switch (environment.appLogo) {
      case 'HYBRITECH':
        this.appLogo = 'assets/logo/hybritech_logo.png';
        break;
      case 'BTL':
        this.appLogo = 'assets/logo/btl_logo.png';
        break;
      default:
        this.appLogo = 'assets/logo/hybritech_logo.png';
    }
  }
}
