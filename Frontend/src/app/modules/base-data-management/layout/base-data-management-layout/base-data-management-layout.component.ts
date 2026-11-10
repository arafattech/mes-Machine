import { CommonService } from '@app/services/common-service/common.service';
import {
  Component,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  SideNavigationComponent,
  SideNavigationGroupComponent,
  SideNavigationItemComponent,
  SideNavigationSubItemComponent,
  PopoverComponent,
} from '@ui5/webcomponents-ngx';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
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
  items: MenuItem[];
}

import { SideNavNewTabDirective } from '@app/directives/side-nav-new-tab.directive';
import { keepActiveSidebarGroupOpen } from '@shared/utilities/sidebar-active';
import { SideNavActiveDirective } from '@app/directives/side-nav-active.directive';
@Component({
  selector: 'app-base-data-management-layout',
  standalone: true,
  imports: [
    RouterLink,
    SideNavNewTabDirective,
    SideNavActiveDirective,
    RouterLinkActive,
    CommonModule,
    SideNavigationComponent,
    SideNavigationGroupComponent,
    SideNavigationItemComponent,
    PopoverComponent,
    RouterOutlet,
    SideNavigationSubItemComponent,
  ],
  templateUrl: './base-data-management-layout.component.html',
  styleUrl: './base-data-management-layout.component.scss',
})
export class BaseDataManagementLayoutComponent implements OnInit, OnDestroy {
  /** Opens the group holding the current page — call after the menu is (re)built. */
  private readonly expandActiveGroups = keepActiveSidebarGroupOpen(() => this.sidebarMenu);


  dashboard = $localize`Dashboard`;
  home = $localize`Home`;
  isCollapsed = false;
  isOpened = false;
  private sidenavToggleSubscription!: Subscription;

  permissions: { [key: string]: boolean } = {};
  constructor(
    private rolePermissionService: RolePermissionService,
    private CommonService: CommonService
  ) {}
  public isMobileView: boolean = window.innerWidth <= 1100;

  @HostListener('window:resize')
  onResize() {
    this.isMobileView = window.innerWidth <= 1100;
  }

  sidebarMenu: SidebarGroup[] = [
    {
      text: 'Base Data Management',
      expanded: true,
      items: [
        {
          text: `${$localize`Item`} ${$localize`Management`}`,
          icon: 'product',
          expanded: false,
          permission: Permissions.BASE_DATA_ITEM,
          subItems: [
            {
              text: `${$localize`Item`} ${$localize`List`}`,
              permission: Permissions.BASE_DATA_ITEM_LIST,
              routerLink: 'products',
            },
            {
              text: `${$localize`Item`} ${$localize`Type`}`,
              permission: Permissions.BASE_DATA_ITEM_TYPE,
              routerLink: 'product-type',
            },
            {
              text: `${$localize`UOM`} ${$localize`List`}`,
              permission: Permissions.BASE_DATA_UOM_LIST,
              routerLink: 'uom-list',
            },
          ],
        },

        // {
        //   text: `${$localize`Item`} ${$localize`Variants`}`,
        //   icon: 'product',
        //   expanded: false,
        //   permission: Permissions.BASE_DATA_ITEM_VARIANTS,
        //   subItems: [
        //     {
        //       text: `${$localize`Item`} ${$localize`Variants`} `,
        //       permission: Permissions.BASE_DATA_ITEM_VARIANTS_LIST,
        //       routerLink: 'item-variants',
        //     },
        //     {
        //       text: `${$localize`Variant`} ${$localize`Type`}`,
        //       permission: Permissions.BASE_DATA_VARIANT_TYPE_LIST,
        //       routerLink: 'product-type',
        //     },
        //   ],
        // },
        {
          text: `${$localize`Department`}`,
          icon: 'folder',
          expanded: false,
          permission: Permissions.BASE_DATA_DEPARTMENT,
          routerLink: 'departments',
        },
        {
          text: `${$localize`Count`} ${$localize`Type`}`,
          icon: 'number-sign',
          expanded: false,
          permission: Permissions.BASE_DATA_COUNT_TYPE,
          routerLink: 'count-types',
        },
        {
          text: `${$localize`Approver Management`}`,
          icon: 'permission',
          expanded: false,
          permission: Permissions.BASE_DATA_APPROVER,
          routerLink: 'approver-management',
        },
        {
          text: `${$localize`Origin`}`,
          icon: 'offsite-work',
          expanded: false,
          permission: Permissions.BASE_DATA_ORIGIN_LIST,
          routerLink: 'origin-list',
        },
        {
          text: `${$localize`Category`} ${$localize`Management`}`,
          icon: 'customize',
          permission: Permissions.BASE_DATA_CATEGORY,
          expanded: false,
          subItems: [
            {
              text: `${$localize`Category`} ${$localize`List`}`,
              permission: Permissions.BASE_DATA_CATEGORY,
              routerLink: 'item-categories',
            },
            {
              text: `${$localize`SubCategory`} ${$localize`List`}`,
              permission: Permissions.BASE_DATA_ITEM_SUBCATEGORIES,
              routerLink: 'item-subcategories',
            },
          ],
        },
        {
          text: `${$localize`Supplier`}`,
          icon: 'supplier',
          permission: Permissions.BASE_DATA_SUPPLIER,
          routerLink: 'supplier',
          expanded: false,
        },
        {
          text: `${$localize`Supplier`} ${$localize`Bank`} ${$localize`Details`}`,
          icon: 'wallet',
          permission: Permissions.BASE_DATA_SUPPLIER_BANK_DETAILS,
          routerLink: 'supplier-bank',
          expanded: false,
        },
        {
          text: `${$localize`Employee`}`,
          icon: 'employee',
          permission: Permissions.BASE_DATA_EMPLOYEE,
          routerLink: 'employees',
          expanded: false,
        },
        {
          text: `${$localize`Machines`} ${$localize`Management`}`,
          icon: 'action-settings',
          permission: Permissions.BASE_DATA_MACHINE,
          expanded: false,
          subItems: [
            {
              text: `${$localize`Machine`} ${$localize`List`}`,
              permission: Permissions.BASE_DATA_MACHINE_LIST,
              routerLink: 'machines',
            },
            {
              text: `${$localize`Machine`} ${$localize`Configuration`}`,
              permission: Permissions.BASE_DATA_MACHINE_CONFIG_LIST,
              routerLink: 'machine-config',
            },
            {
              text: `${$localize`Machine`} ${$localize`Group`}`,
              permission: Permissions.BASE_DATA_MACHINE_GROUP,
              routerLink: 'machine-group',
            },
            {
              text: `${$localize`Machine`} ${$localize`State`}`,
              permission: Permissions.BASE_DATA_MACHINE_STATE,
              routerLink: 'machine-state',
            },
            {
              text: `${$localize`Machine`} ${$localize`Wastage Type`}`,
              permission: Permissions.BASE_DATA_MACHINE_WASTAGE_TYPE,
              routerLink: 'machine-wastage-type',
            },
            {
              text: `${$localize`Machine`} ${$localize`Production Target`}`,
              permission: Permissions.BASE_DATA_MACHINE_PRODUCTION_TARGET,
              routerLink: 'machine-production-target',
            },
          ],
        },
        {
          text: $localize`Schedules Frequency`,
          icon: 'appointment-2',
          permission: Permissions.PRODUCTION_ADMIN,
          routerLink: 'schedule-frequency',
          expanded: false,
        },
        {
          text: `${$localize`Client`} ${$localize`Management`}`,
          icon: 'key-user-settings',
          permission: Permissions.BASE_DATA_CLIENT,
          expanded: false,
          subItems: [
            {
              text: `${$localize`Client`} ${$localize`List`}`,
              permission: Permissions.BASE_DATA_CLIENT_LIST,
              routerLink: 'client',
            },

            {
              text: `${$localize`Client`} ${$localize`Note`}`,
              permission: Permissions.BASE_DATA_CLIENT_NOTE,
              routerLink: 'client-note',
            },
            {
              text: `${$localize`Client`} ${$localize`Area`}`,
              permission: Permissions.BASE_DATA_CLIENT_AREAS,
              routerLink: 'client-area',
            },
          ],
        },
        {
          text: `${$localize`Plant`} ${$localize`Management`}`,
          icon: 'multi-select',
          permission: Permissions.BASE_DATA_PLANT,
          expanded: false,
          subItems: [
            {
              text: `${$localize`Plant`} ${$localize`List`}`,
              permission: Permissions.BASE_DATA_PLANT_LIST,
              routerLink: 'plants',
            },
            {
              text: `${$localize`Hall`} ${$localize`List`}`,
              permission: Permissions.BASE_DATA_HALL_LIST,
              routerLink: 'hall',
            },
          ],
        },
        {
          text: `${$localize`Capacities`}`,
          icon: 'Chart-Tree-Map',
          permission: Permissions.BASE_DATA_CAPACITY,
          routerLink: 'capacity',
          expanded: false,
        },
        {
          text: `${$localize`Storage`} ${$localize`Management`}`,
          icon: 'retail-store-manager',
          permission: Permissions.BASE_DATA_STORAGE,
          expanded: false,
          subItems: [
            {
              text: `${$localize`Storage`} ${$localize`Location`}`,
              permission: Permissions.BASE_DATA_STORAGE_LOCATION,
              routerLink: 'storage-location',
            },
          ],
        },
        {
          text: `${$localize`Asset`} ${$localize`Management`}`,
          icon: 'bbyd-dashboard',
          permission: Permissions.BASE_DATA_ASSET,
          expanded: false,
          subItems: [
            {
              text: `${$localize`Asset`} ${$localize`List`}`,
              routerLink: 'asset-list',
              permission: Permissions.BASE_DATA_ASSET,
            },
            {
              text: `${$localize`Asset`} ${$localize`Group`}`,
              routerLink: 'asset-group',
              permission: Permissions.BASE_DATA_ASSET_GROUP,
            },
          ],
        },
        {
          text: `${$localize`Operation`} ${$localize`Management`}`,
          icon: 'developer-settings',
          permission: Permissions.BASE_DATA_OPERATION,
          expanded: false,
          subItems: [
            {
              text: `${$localize`Operation`} ${$localize`Lists`}`,
              routerLink: 'operations',
              permission: Permissions.BASE_DATA_OPERATION,
            },
          ],
        },
        {
          text: `${$localize`Tools`} ${$localize`Management`}`,
          icon: 'technical-object',
          permission: Permissions.BASE_DATA_TOOLS,
          expanded: false,
          subItems: [
            {
              text: `${$localize`Handling`} ${$localize`Units`}`,
              routerLink: 'handling-units',
              permission: Permissions.BASE_DATA_HANDING_UNITS,
            },
          ],
        },
      ],
    },
    {
      text: 'Settings',
      expanded: true,
      items: [
        {
          text: $localize`Roles Permissions`,
          icon: 'permission',
          permission: Permissions.BASE_DATA_ROLE_PERMISSION,
          routerLink: 'roles-permissions',
          expanded: false,
        },
        {
          text: $localize`User Management`,
          icon: 'account',
          permission: Permissions.BASE_DATA_USER,
          routerLink: 'user-management',
          expanded: false,
        },
        {
          text: $localize`Recycle Bin`,
          icon: 'delete',
          permission: Permissions.BASE_DATA_USER_BIN,
          routerLink: 'user-bin',
          expanded: false,
        },
      ],
    },
  ];

  activityMenuItem: MenuItem = {
    text: $localize`Activity`,
    icon: 'history',
    expanded: false,
    subItems: [
      {
        text: $localize`Activity Log`,
        permission: Permissions.BASE_DATA_ACTIVITY_LOG,
        routerLink: 'activity-log',
      },
      {
        text: $localize`Login Activity`,
        permission: Permissions.BASE_DATA_USER_ACTIVITY,
        routerLink: 'user-activity',
      },
    ],
  };

  ngOnInit(): void {
    this.permissions = this.rolePermissionService.getAllPermissionsStatus();
    this.sidenavToggleSubscription = this.CommonService.sidenavToggle.subscribe(
      (isCollapsed: boolean) => {
        this.isCollapsed = isCollapsed;
        this.isOpened = !this.isOpened;
      }
    );
    this.expandActiveGroups();
  }

  ngOnDestroy(): void {
    if (this.sidenavToggleSubscription) {
      this.sidenavToggleSubscription.unsubscribe();
    }
  }

  NavigateToggle(event: any) {}

  toggleExpand(item: any) {
    item.expanded = !item.expanded;
  }

  onClosePopover() {
    this.isOpened = false;
  }
}
