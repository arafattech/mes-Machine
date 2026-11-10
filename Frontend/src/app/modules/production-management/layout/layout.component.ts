import { CommonService } from '@app/services/common-service/common.service';
import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  SideNavigationComponent,
  SideNavigationGroupComponent,
  SideNavigationItemComponent,
  SideNavigationSubItemComponent,
} from '@ui5/webcomponents-ngx';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { ProductionService } from '@production-module/shared/services/production.service';
import { Subscription } from 'rxjs';
import {
  SidebarGroup,
  MenuItem,
  SubItem,
} from '@production-module/shared/interface/interface';
import { Hall } from '@shared/model/hall';
import { Machine } from '@shared/model/machine';
import { Permissions } from '@app/shared/enums/permissions';
import { SideNavNewTabDirective } from '@app/directives/side-nav-new-tab.directive';
import { keepActiveSidebarGroupOpen } from '@shared/utilities/sidebar-active';
import { SideNavActiveDirective } from '@app/directives/side-nav-active.directive';
@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    SideNavigationComponent,
    SideNavigationGroupComponent,
    SideNavigationItemComponent,
    SideNavigationSubItemComponent,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
 
    SideNavNewTabDirective,
    SideNavActiveDirective,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent {
  /** Opens the group holding the current page — call after the menu is (re)built. */
  private readonly expandActiveGroups = keepActiveSidebarGroupOpen(() => this.sidebarMenu);

  home = $localize`Home`;
  isCollapsed = false;
  isHide = false;
  public hallList: Hall[] = [];
  public machines: Machine[] = [];
  public sidebarMenu: SidebarGroup[] = [];
  private sidenavToggleSubscription!: Subscription;
  private sidenavHiddenSubscription!: Subscription;

  permissions: { [key: string]: boolean } = {};
  constructor(
    private rolePermissionService: RolePermissionService,
    private CommonService: CommonService,
    public productionService: ProductionService
  ) {
    this.productionService.loadMachines('all-machines');
  }

  buildNavItems() {
    this.sidebarMenu = [
      {
        text: 'All Machines',
        expanded: true,
        items: [
          {
            text: $localize`All Machines`,
            icon: 'machine',
            permission: Permissions.PRODUCTION_DASHBOARD,
            routerLink: 'production',
            expanded: false,
            type: 'all-machines',
          },
        ],
      },
      {
        text: 'Plans & Production Logs',
        expanded: true,
        items: [
          {
            text: $localize`Log Production`,
            icon: 'add-activity',
            permission: Permissions.PRODUCTION_LOG,
            routerLink: 'production-log',
            expanded: false,
          },
          {
            text: $localize`Wastage Log`,
            icon: 'delete',
            permission: Permissions.WASTAGE_LOG,
            routerLink: 'wastage-log',
            expanded: false,
          },
          {
            text: $localize`Production Orders`,
            icon: 'product',
            permission: Permissions.BASE_DATA_WORK_ORDER,
            routerLink: 'work-orders',
            expanded: false,
          },
          {
            text: $localize`Machine Maintenance`,
            icon: 'wrench',
            permission: Permissions.PRODUCTION_ADMIN,
            expanded: false,
            subItems: [
              {
                text: $localize`Machine Maintenance List`,
                permission: Permissions.PRODUCTION_ADMIN,
                routerLink: 'machine-maintenance',
              },
              {
                text: $localize`Machine Schedules`,
                permission: Permissions.PRODUCTION_ADMIN,
                routerLink: 'machine-maintenance-schedule',
              },
            ],
          },
          // {
          //   text: $localize`Yarn Lots`,
          //   icon: 'energy-saving-lightbulb',
          //   permission: Permissions.PRODUCTION_LOT,
          //   routerLink: 'production-lots',
          //
          //   expanded: false,
          // },
        ],
      },
      {
        text: 'Halls',
        expanded: true,
        items: [
          ...this.hallList.map((hall) => ({
            text: hall.name,
            icon: 'factory',
            permission: Permissions.PRODUCTION_ADMIN,
            routerLink: `production`,
            type: `${hall.id}`,
            expanded: false,
          })),
        ],
      },
    ];
    this.expandActiveGroups();
  }

  ngOnInit(): void {
    this.permissions = this.rolePermissionService.getAllPermissionsStatus();
      this.checkScreenWidth(window.innerWidth);
    this.sidenavToggleSubscription = this.CommonService.sidenavToggle.subscribe(
      (isCollapsed: boolean) => {
        this.isCollapsed = isCollapsed;
      }
    );
    this.sidenavHiddenSubscription = this.CommonService.sidenavHidden.subscribe(
      (isHidden: boolean) => {
        this.isHide = isHidden;
      }
    );

    // Load halls and build menu

    this.productionService.hallList$.subscribe((halls) => {
      this.hallList = halls;
      this.buildNavItems();
    });
  }
  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.checkScreenWidth(event.target.innerWidth);
  }

  private checkScreenWidth(width: number) {
    if (width < 1020) {
      this.isCollapsed = true; 
    } else {
      this.isCollapsed = false; 
    }
  }

  ngOnDestroy(): void {
    if (this.sidenavToggleSubscription) {
      this.sidenavToggleSubscription.unsubscribe();
    }
  }

  toggleExpand(item: any) {
    item.expanded = !item.expanded;
    if (item.type !== undefined) {
      this.productionService.loadMachines(item.type);
    }
  }
}
