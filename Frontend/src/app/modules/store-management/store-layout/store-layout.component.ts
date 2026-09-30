import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { CommonService } from '@app/services/common-service/common.service';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { MenuItem, SidebarGroup } from '@app/shared/interfaces/SideNav';
import { Localization } from '@app/shared/utilities/localization';
import { el } from '@fullcalendar/core/internal-common';
import { Subscription } from 'rxjs';
import { Permissions } from '@app/shared/enums/permissions';
@Component({
  selector: 'app-store-layout',
  templateUrl: './store-layout.component.html',
  styleUrl: './store-layout.component.scss',
})
export class StoreLayoutComponent implements OnInit, OnDestroy {
  dashboard = Localization.Dashboard;
  home = Localization.Home;
  analytics = {
    name: $localize`Analytics`,
    route: 'store-analytics',
    permissions: Permissions.STORE_ANALYTICS,
  };
  isCollapsed = false;
  isOpened = false;
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
  public isMobileView: boolean = window.innerWidth <= 1100;

  @HostListener('window:resize')
  onResize() {
    this.isMobileView = window.innerWidth <= 1100;
  }

  private topMenuItems: MenuItem[] = [
        {
          text: `${$localize`Inventory`} `,
          icon: 'full-stacked-column-chart',
          permission: Permissions.STORE_ITEM_INVENTORY,
          routerLink: 'item-inventory',
          expanded: false,
        },
        // {
        //   text: `${$localize`Idle Inventory`} `,
        //   icon: 'crm-service-manager',
        //   permission: Permissions.STORE_IDLE_INVENTORY,
        //   routerLink: 'idle-inventory',
        //   expanded: false,
        // },
        {
          text: `${$localize`PI Order`} `,
          icon: 'filter-analytics',
          permission: Permissions.STORE_PURCHASE_ORDER,
          routerLink: 'purchase-order',
          expanded: false,
        },
        {
          text: `${$localize`Low Stock`} `,
          icon: 'warning2',
          permission: Permissions.STORE_LOW_STOCK,
          routerLink: 'low-stock',
          expanded: false,
        },
        {
          text: `${$localize`Stock Ledger`} `,
          icon: 'sales-order-item',
          routerLink: 'stock-ledger',
          expanded: false,
        },
        {
          text: `${$localize`Reminders`} `,
          icon: 'alert',
          permission: Permissions.STORE_REMINDERS,
          routerLink: 'reminders',
          expanded: false,
        },
        {
          text: `${$localize`Yarn Transfer (GTN)`} `,
          icon: 'box',
          permission: Permissions.STORE_YARN_GRN,
          routerLink: 'yarn-transfers',
          expanded: false,
        },
  ];

  private fullSidebarMenu: SidebarGroup[] = [
    {
      text: `${$localize`Inbound`}`,
      expanded: true,
      items: [
        {
          text: `${$localize`Indent`} `,
          icon: 'cart-approval',
          permission: Permissions.STORE_PURCHASE_REQUISITION,
          expanded: false,
          subItems: [
            {
              text: `${$localize`Indent Requests`} `,
              permission: Permissions.PURCHESE_SPR_REQUESTS,
              routerLink: 'spr-requests',
            },
            {
              text: `${$localize`Indent Requisition`} `,
              permission: Permissions.STORE_PURCHASE_REQUISITION,
              routerLink: 'purchase-requisition',
            },
          ],
        },
        {
          text: `${$localize`Local MRR`} `,
          icon: 'course-book',
          permission: Permissions.STORE_LOCAL_MRR,
          routerLink: 'local-material-receipt',
          expanded: false,
        },
        {
          text: `${$localize`Imported MRR`} `,
          icon: 'shipping-status',
          permission: Permissions.STORE_LOCAL_MRR,
          routerLink: 'imported-material-receipt',
          expanded: false,
        },
        {
          text: `${$localize`Raw Cotton Received`} `,
          icon: 'product',
          permission: Permissions.STORE_LOCAL_MRR,
          routerLink: 'raw-cotton-received',
          expanded: false,
        },
        {
          text: `${$localize`Return SR`} `,
          icon: 'sys-cancel-2',
          permission: Permissions.STORE_ITEM_RETURN,
          routerLink: 'item-return',
          expanded: false,
        },
      ],
    },
    {
      text: `${$localize`Outbound`}`,
      expanded: true,
      items: [
        {
          text: `${$localize`SR Management`} `,
          icon: 'bbyd-active-sales',
          permission: Permissions.STORE_STORE_REQUISITION,
          expanded: false,
          subItems: [
            {
              text: `${$localize`SR Request`} `,
              permission: Permissions.STORE_SR_REQUEST,
              routerLink: 'sr-requests',
            },
            {
              text: `${$localize`SR Requisition`} `,
              permission: Permissions.STORE_STORE_REQUISITION,
              routerLink: 'store-requisition',
            },
          ],
        },
        {
          text: `${$localize`Sales Dispatch`} `,
          icon: 'shipping-status',
          permission: Permissions.STORE_ITEM_INVENTORY,
          routerLink: 'sales-dispatch',
          expanded: false,
        },
        {
          text: `${$localize`Return MRR`} `,
          icon: 'undo',
          routerLink: 'return-mrr',
          expanded: false,
        },
        {
          text: `${$localize`Lots`} `,
          icon: 'product',
          routerLink: 'lots',
          expanded: false,
        },
      ],
    },
  ];

  sidebarMenu: SidebarGroup[] = [];
  topMenu: MenuItem[] = [];

  ngOnInit(): void {
    this.topMenu = this.topMenuItems.filter(
      (item) => !item.permission || !!this.permissions[item.permission],
    );
    this.sidebarMenu = this.filterMenuByPermissions(this.fullSidebarMenu);

    this.sidenavToggleSubscription = this.CommonService.sidenavToggle.subscribe(
      (isCollapsed: boolean) => {
        this.isCollapsed = isCollapsed;
        this.isOpened = !this.isOpened;
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
      { name: 'store-analytics', permission: Permissions.STORE_ANALYTICS },
      { name: 'purchase-order', permission: Permissions.STORE_PURCHASE_ORDER },
      {
        name: 'local-material-receipt',
        permission: Permissions.STORE_LOCAL_MRR,
      },
      {
        name: 'imported-material-receipt',
        permission: Permissions.STORE_LOCAL_MRR,
      },
      {
        name: 'raw-cotton-received',
        permission: Permissions.STORE_LOCAL_MRR,
      },
      {
        name: 'purchase-requisition',
        permission: Permissions.STORE_PURCHASE_REQUISITION,
      },
      {
        name: 'store-requisition',
        permission: Permissions.STORE_STORE_REQUISITION,
      },
      { name: 'sr-requests', permission: Permissions.STORE_SR_REQUEST },
      { name: 'item-inventory', permission: Permissions.STORE_ITEM_INVENTORY },
      { name: 'idle-inventory', permission: Permissions.STORE_IDLE_INVENTORY },
      { name: 'low-stock', permission: Permissions.STORE_LOW_STOCK },
      { name: 'sales-dispatch', permission: Permissions.STORE_ITEM_INVENTORY },
      { name: 'spr-requests', permission: Permissions.PURCHESE_SPR_REQUESTS },
      { name: 'item-return', permission: Permissions.STORE_ITEM_RETURN },
      { name: 'reminders', permission: Permissions.STORE_REMINDERS },
      { name: 'yarn-transfers', permission: Permissions.STORE_YARN_GRN },
    ];

    const currentPath = this.router.url.split('?')[0];

    // Routes with no permission gate of their own (no `canActivate`/`data.permission`
    // in the routing module) — always valid to stay on, so refreshing there must never
    // fall through to the permission-based redirect below.
    const ungatedPages = ['stock-ledger', 'return-mrr', 'lots'];
    if (ungatedPages.some((name) => currentPath === `/store-management/${name}`)) {
      return;
    }

    const currentPage = pages.find(
      (page) => currentPath === `/store-management/${page.name}`,
    );
    if (currentPage) {
      if (this.permissions?.[currentPage.permission]) return;
    }

    const firstAllowed = pages.find(
      (page) => this.permissions?.[page.permission],
    );
    if (firstAllowed) {
      this.router.navigate([`/store-management/${firstAllowed.name}`]);
      return;
    }
  }

  NavigateToggle(event: any) {}

  toggleExpand(item: any) {
    item.expanded = !item.expanded;
  }
  onLoad() {
    window.location.href = '/';
  }
  onClosePopover() {
    this.isOpened = false;
  }
}
