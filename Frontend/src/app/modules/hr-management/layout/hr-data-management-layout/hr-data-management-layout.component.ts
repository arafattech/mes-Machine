import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { CommonService } from '@app/services/common-service/common.service';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import {
  SideNavigationComponent,
  SideNavigationGroupComponent,
  SideNavigationItemComponent,
  SideNavigationSubItemComponent,
} from '@ui5/webcomponents-ngx';
import { Subscription } from 'rxjs';
import { Permissions } from '@app/shared/enums/permissions';
interface SubItem {
  text: string;
  permission?: string;
  routerLink: string;
}

interface MenuItem {
  text: string;
  icon: string;
  slot?: string;
  expanded: boolean;
  permission?: string;
  routerLink?: string;
  subItems?: SubItem[];
}

interface SidebarGroup {
  text: string;
  expanded: boolean;
  permission?: string;
  items: MenuItem[];
}

@Component({
  selector: 'app-hr-data-management-layout',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    CommonModule,
    SideNavigationComponent,
    SideNavigationGroupComponent,
    SideNavigationItemComponent,
    RouterOutlet,
    SideNavigationSubItemComponent,
  ],
  templateUrl: './hr-data-management-layout.component.html',
  styleUrl: './hr-data-management-layout.component.scss',
})
export class HrDataManagementLayoutComponent implements OnInit, OnDestroy {
  home = $localize`Home`;
  hrm = {
    name: $localize`Analytics`,
    route: 'hr-analytics',
    permissions: 'HR_ANALYTICS',
  };
  isCollapsed = false;
  private sidenavToggleSubscription!: Subscription;

  permissions: { [key: string]: boolean } = {};
  constructor(
    private rolePermissionService: RolePermissionService,
    private CommonService: CommonService,
    private router: Router,
  ) {
    this.permissions = this.rolePermissionService.getAllPermissionsStatus();
    this.checkEmployeePermission();
  }

  private fullSidebarMenu: SidebarGroup[] = [
    {
      text: 'My Profile',
      expanded: true,
      permission: Permissions.HR_EMPLOYEE_DASHBOARD,
      items: [
        {
          text: `${$localize`Employee Dashboard`} `,
          icon: 'my-view',
          permission: Permissions.HR_EMPLOYEE_DASHBOARD,
          routerLink: 'employee-profile',
          expanded: false,
        },
      ],
    },
    // Employee Management Menu =============================
    {
      text: 'HR Management',
      permission: Permissions.HR_EMPLOYEE,
      expanded: true,
      items: [
        {
          text: `${$localize`Employee Management`} `,
          icon: 'employee',
          expanded: false,
          permission: Permissions.HR_EMPLOYEE,
          subItems: [
            {
              text: `${$localize`Employee`} ${$localize`List`}`,
              permission: Permissions.HR_EMPLOYEE_LIST,
              routerLink: 'employee-management/employee-list',
            },
            {
              text: `${$localize`Employee`} ${$localize`Group`} `,
              permission: Permissions.HR_EMPLOYEE_GROUP,
              routerLink: 'employee-management/employee-group',
            },
            {
              text: $localize`Designation`,
              permission: Permissions.HR_DESIGNATION,
              routerLink: 'employee-management/designations',
              },
              {
                text: `${$localize`Employee`} ${$localize`Type`}`,
                permission: Permissions.HR_EMPLOYEE_TYPE,
                routerLink: 'employee-management/employee-type',
              },
              {
                text: `${$localize`Employee`} ${$localize`Section`}`,
                permission: Permissions.HR_EMPLOYEE_SECTION,
                routerLink: 'employee-management/employee-section',
            }


          ],
        },

        // Attendance Management Menu ==============================

        {
          text: `${$localize`Attendance Management`} `,
          icon: 'end-user-experience-monitoring',
          expanded: false,
          permission: Permissions.HR_ATTENDANCE,
          subItems: [
            {
              text: `${$localize`Attendance`} ${$localize`List`} `,
              permission: Permissions.HR_ATTENDANCE_LIST,
              routerLink: 'attendence-management/employee-attendence',
            },

            {
              text: `${$localize`Daily`} ${$localize`Attendance`} `,
              permission: Permissions.HR_DAILY_ATTENDANCE,
              routerLink: 'attendence-management/employee-daily-attendence',
            },

            {
              text: `${$localize`Employee`} ${$localize`Overtime`} `,
              permission: Permissions.HR_EMPLOYEE_OVERTIME,
              routerLink: 'attendence-management/employee-overtime',
            }

          ],
        },


        // Payroll Management Menu ==============================

        {
          text: `${$localize`Payroll Management`} `,
          icon: 'money-bills',
          expanded: false,
          permission: Permissions.HR_PAYROLL,
          subItems: [
            {
              text: `${$localize`Payroll`} ${$localize`Process`}`,
              permission: Permissions.HR_PAYROLL_PROCESS,
              routerLink: 'payroll-management/employee-payroll-process',
            },
            {
              text: `${$localize`Payroll`} `,
              permission: Permissions.HR_PAYROLL_LIST,
              routerLink: 'payroll-management/employee-payroll',
            },
            {
              text: `${$localize`Payroll`} ${$localize`History`}`,
              permission: Permissions.HR_PAYROLL_HISTORY,
              routerLink: 'payroll-management/employee-payroll-history',
            },
            {
              text: `${$localize`Side`} ${$localize`Bill`}`,
              permission: Permissions.HR_SIDE_BILL,
              routerLink: 'payroll-management/side-bill',
            },
            {
              text: `${$localize`Employee`} ${$localize`Bonuses`}`,
              permission: Permissions.HR_EMPLOYEE_BONUSES,
              routerLink: 'payroll-management/employee-bonuses',
            },
            {
              text: `${$localize`Tax`} ${$localize`Rules`}`,
              permission: Permissions.HR_TAX_RULE,
              routerLink: 'payroll-management/tax-rules',
            }
          ],
        },

        // Leave Management Menu ==============================
        {
          text: `${$localize`Leave Management`} `,
          icon: 'enablement',
          permission: Permissions.HR_LEAVE,
          expanded: false,
          subItems: [
            {
              text: `${$localize`Leave Request`} `,
              permission: Permissions.HR_LEAVE_REQUEST,
              routerLink: 'leave-management/leave-request',
            },
            {
              text: `${$localize`Leave Type`} `,
              permission: Permissions.HR_LEAVE_TYPE,
              routerLink: 'leave-management/leave-type',
            },
            {
              text: `${$localize`Calendar Management`} `,
              permission: Permissions.HR_CALENDAR,
              routerLink: 'leave-management/calender',
            },
            {
              text: `${$localize`Holiday Type`}`,
              permission: Permissions.HR_HOLIDAY_TYPE_LIST,
              routerLink: 'holiday-type-management/holiday-type-list',
            },
            {
              text: `${$localize`Holiday Swap`} `,
              permission: Permissions.HR_HOLIDAY_SWAP,
              routerLink: 'leave-management/leave-transfer',
            },
          ],
        },

        // Asset Management Menu =============================
        {
          text: `${$localize`Asset`} ${$localize`Management`}`,
          icon: 'bbyd-dashboard',
          permission: Permissions.HR_ASSET,
          expanded: false,
          subItems: [
            {
              text: `${$localize`Asset`} ${$localize`List`}`,
              routerLink: 'asset-management/asset-list',
              permission: Permissions.HR_EMPLOYEE_ASSET_LIST,
            },
          ],
        },

        // shift Management Menu =============================

        {
          text: `${$localize`Shift`} ${$localize`Management`}`,
          icon: 'share',
          permission: Permissions.HR_SHIFT,
          expanded: false,
          subItems: [
            {
              text: `${$localize`Shift`} ${$localize`List`}`,
              routerLink: 'shift-management/shift-list',
              permission: Permissions.HR_SHIFT_LIST,
            },
            {
              text: `${$localize`Roster`}`,
              routerLink: 'shift-management/roster-list',
              permission: Permissions.HR_ROSTER,
            },
            {
              text: `${$localize`Shift`} ${$localize`Overrides Log`}`,
              routerLink: 'shift-management/shift-replacement',
              permission: Permissions.HR_SHIFT_OVERRIDES_LOG,
            },
          ],
        },

        // Blacklist Management Menu =============================

        {
          text: `${$localize`Black-List`} ${$localize`Management`}`,
          icon: 'fallback',
          permission: Permissions.HR_BLACK_LIST,
          expanded: false,
          subItems: [
            {
              text: `${$localize`Black`} ${$localize`List`}`,
              routerLink: 'blacklist-management/black-list',
              permission: Permissions.HR_BLACK_LIST,
            },
          ],
        },

         // Promotion Management Menu =============================
        {
          text: `${$localize`Promotion`} ${$localize`Management`}`,
          icon: 'group',
          permission: Permissions.HR_PROMOTION,
          expanded: false,
          subItems: [
            {
              text: `${$localize`Promotion`} ${$localize`List`}`,
              routerLink: 'promotion-management/promotions',
              permission: Permissions.HR_PROMOTION_LIST,
            },
            {
              text: `${$localize`Promotion`} ${$localize`History`}`,
              routerLink: 'promotion-management/promotion-history',
              permission: Permissions.HR_PROMOTION_HISTORY,
            },
          ],
        },
        // Face Recognition Management Menu =============================
        {
          text: `${$localize`Notice`} ${$localize`Management`}`,
          icon: 'decision',
          permission: Permissions.HR_NOTICE,
          expanded: false,
          subItems: [
            {
              text: `${$localize`Notices`}`,
              routerLink: 'notice-management/apply-notice',
              permission: Permissions.HR_NOTICE_LIST,
            },
          ],
        },
        {
          text: `${$localize`Face`} ${$localize`Recognition`}`,
          icon: 'biometric-face',
          expanded: false,
          permission: Permissions.HR_FACE_RECOGNITION,
          routerLink: 'face-recognition',
        },
      ],
    },

    // Policy Management Menu =============================

    {
      text: 'Settings',
      expanded: true,
      items: [
        {
          text: $localize`Biometric Device Config`,
          icon: 'badge',
          permission: Permissions.HR_BIOMETRIC,
          routerLink: 'biometric-configurations',
          expanded: false,
        },
      ],
    },
  ];

  sidebarMenu: SidebarGroup[] = [];

  ngOnInit(): void {
    this.sidebarMenu = this.filterMenuByPermissions(this.fullSidebarMenu);

    this.sidenavToggleSubscription = this.CommonService.sidenavToggle.subscribe(
      (isCollapsed: boolean) => {
        this.isCollapsed = isCollapsed;
      },
    );
  }

  private filterMenuByPermissions(menu: SidebarGroup[]): SidebarGroup[] {
    return menu
      .map((group) => {
        if (group.permission && !this.permissions[group.permission]) {
          return null;
        }

        const filteredItems = group.items.filter((item) => {
          if (item.permission) {
            return !!this.permissions[item.permission];
          }
          return true;
        });

        if (filteredItems.length === 0) {
          return null;
        }
        return {
          ...group,
          items: filteredItems,
        };
      })
      .filter((group): group is SidebarGroup => group !== null);
  }
  ngOnDestroy(): void {
    if (this.sidenavToggleSubscription) {
      this.sidenavToggleSubscription.unsubscribe();
    }
  }

  checkEmployeePermission() {
    const permissions = this.permissions;
    const currentPath = this.router.url
      .replace('/hr-management/', '')
      .split('?')[0];

    if (permissions[Permissions.HR_EMPLOYEE_DASHBOARD]) {
      if (
        currentPath === '/hr-management' ||
        currentPath === '/hr-management/'
      ) {
        this.router.navigate(['/hr-management/employee-profile']);
      }
    }
  }

  NavigateToggle(event: any) {}

  toggleExpand(item: any) {
    item.expanded = !item.expanded;
  }
}
