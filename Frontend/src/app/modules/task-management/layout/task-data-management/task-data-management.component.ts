import { CommonService } from '@app/services/common-service/common.service';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  SideNavigationComponent,
  SideNavigationGroupComponent,
  SideNavigationItemComponent,
  SideNavigationSubItemComponent,
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
@Component({
  selector: 'app-task-data-management',
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
  templateUrl: './task-data-management.component.html',
  styleUrl: './task-data-management.component.scss',
})
export class TaskDataManagementComponent {
  isCollapsed = false;
  private sidenavToggleSubscription!: Subscription;

  permissions: { [key: string]: boolean } = {};
  constructor(
    private rolePermissionService: RolePermissionService,
    private CommonService: CommonService
  ) {}

  sidebarMenu: SidebarGroup[] = [
    {
      text: 'Task Data Management',
      expanded: true,
      items: [
        {
          text: 'My Task',
          icon: 'task',
          permission: Permissions.TASK_ADMIN,
          routerLink: 'my-tasks',
          expanded: false,
        },
        {
          text: 'Assigned Task',
          icon: 'task',
          permission: Permissions.TASK_ADMIN,
          routerLink: 'my-tasks',
          expanded: false,
        },
      ],
    },
  ];

  ngOnInit(): void {
    this.permissions = this.rolePermissionService.getAllPermissionsStatus();
    this.sidenavToggleSubscription = this.CommonService.sidenavToggle.subscribe(
      (isCollapsed: boolean) => {
        this.isCollapsed = isCollapsed;
      }
    );
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
}
