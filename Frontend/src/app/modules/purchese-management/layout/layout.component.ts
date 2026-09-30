import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonService } from '@app/services/common-service/common.service';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { SidebarGroup } from '@app/shared/interfaces/SideNav';
import { Localization } from '@app/shared/utilities/localization';
import { Subscription } from 'rxjs';
import { Permissions } from '@app/shared/enums/permissions';
@Component({
  selector: 'app-store-layout',
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent implements OnInit, OnDestroy {
  home = Localization.Home;
  isCollapsed = false;
  private sidenavToggleSubscription!: Subscription;

  analytics = {
    name: $localize`Analytics`,
    route: 'purchase-analytics',
    permissions: Permissions.PURCHESE_ANALYTICS,
  };
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
      text: `${$localize`Purchase Management`}`,
      expanded: true,
      permission: Permissions.PURCHESE_ADMIN,
      items: [
        {
          text: `${$localize`Indent Requests`} `,
          icon: 'course-book',
          permission: Permissions.PURCHESE_SPR_REQUESTS,
          routerLink: 'spr-requests',
          expanded: false,
        },
        {
          text: `${$localize`RFQ`} `,
          icon: 'document',
          permission: Permissions.PURCHESE_ADMIN,
          routerLink: 'rf-quotations',
          expanded: false,
        },
        {
          text: `${$localize`Comparative Study`} `,
          icon: 'filter-analytics',
          permission: Permissions.PURCHESE_ADMIN,
          routerLink: 'comparative-study',
          expanded: false,
        },
        {
          text: `${$localize`Purchase Orders`} `,
          icon: 'sales-order',
          permission: Permissions.PURCHESE_ADMIN,
          routerLink: 'purchase-orders',
          expanded: false,
        },
        {
          text: `${$localize`Vendor List`} `,
          icon: 'supplier',
          permission: Permissions.PURCHESE_ADMIN,
          routerLink: 'supplier-list',
          expanded: false,
        },
        {
          text: `${$localize`Reminders`} `,
          icon: 'alert',
          permission: Permissions.STORE_REMINDERS,
          routerLink: 'reminders',
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
    const pages = [
      {
        name: 'purchase-analytics',
        permission: Permissions.PURCHESE_ANALYTICS,
      },
      { name: 'spr-requests', permission: Permissions.PURCHESE_SPR_REQUESTS },
      { name: 'sr-requests', permission: Permissions.PURCHESE_SR_REQUEST },
      { name: 'purchase-orders', permission: Permissions.PURCHESE_ADMIN },
      { name: 'supplier-list', permission: Permissions.PURCHESE_ADMIN },
      { name: 'reminders', permission: Permissions.STORE_REMINDERS },
    ];

    const currentPath = this.router.url
      .split('?')[0]
      .replace('/hr-management', '');

    const currentPage = pages.find(
      (page) => currentPath === `/purchase-management/${page.name}`,
    );
    if (currentPage) {
      if (this.permissions?.[currentPage.permission]) return;
    }

    const firstAllowed = pages.find(
      (page) => this.permissions?.[page.permission],
    );
    if (firstAllowed) {
      this.router.navigate([`/purchase-management/${firstAllowed.name}`]);
      return;
    }
  }

  NavigateToggle(event: any) {}

  toggleExpand(item: any) {
    item.expanded = !item.expanded;
  }
}
