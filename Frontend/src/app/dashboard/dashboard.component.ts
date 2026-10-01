import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from "@angular/core";
import { environment } from "@env/environment";

import {
  CardComponent,
  CardHeaderComponent,
  TextComponent,
  TitleComponent,
} from "@ui5/webcomponents-ngx";
import { RouterLink } from "@angular/router";
import { CommonModule } from "@angular/common";
import { Localization } from "@shared/utilities/localization";

type ModuleConfig = {
  title: string;
  url: string;
  icon: string;
  permissionGroup: string;
};

type ModuleCard = {
  title: string;
  url: string;
  icon: string;
  canAccess: boolean;
};
@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [
    CardComponent,
    RouterLink,
    CardHeaderComponent,
    TextComponent,
    TitleComponent,
    CommonModule,
  ],
  templateUrl: "./dashboard.component.html",
  styleUrl: "./dashboard.component.scss",
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class DashboardComponent implements OnInit {
  public localization = Localization;
  public appVersion = environment.appVersion;
  modules: ModuleCard[] = [];
  loading = true;
  currentYear = new Date().getFullYear();
  readonly skeletonItems = Array.from({ length: 8 });
  private permissionGroupMap = new Map<string, string[]>();

  constructor(private rolePermissionService: RolePermissionService) {}

  ngOnInit(): void {
    this.rolePermissionService.fetchAllGrouped().subscribe({
      next: (groups) => {
        this.permissionGroupMap = new Map(
          groups.map((g) => [g.group, g.permissions.map((p) => p.name)]),
        );
        this.getModules();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  moduleDatas: ModuleConfig[] = [
    {
      title: this.localization.baseDataManagement,
      url: "/base-data",
      icon: "database",
      permissionGroup: "BASE_DATA",
    },
    {
      title: this.localization.Production,
      url: "/production",
      icon: "vertical-bar-chart",
      permissionGroup: "PRODUCTION",
    },
    // {
    //   title: this.localization.HrManagement,
    //   url: "/coming-soon",
    //   icon: "family-protection",
    //   permissionGroup: "HR",
    // },
  ];

  getModules(): void {
    this.modules = this.moduleDatas
      .filter((config) => this.hasModuleAccess(config.permissionGroup))
      .map((config) => ({
        title: config.title,
        url: config.url,
        icon: config.icon,
        canAccess: this.hasModuleAccess(config.permissionGroup),
      }));
  }

  private hasModuleAccess(permissionGroup: string): boolean {
    const permissions = this.permissionGroupMap.get(permissionGroup) ?? [];
    return (
      permissions.length > 0 &&
      this.rolePermissionService.hasAnyPermission(permissions)
    );
  }

  checkModules(): boolean {
    return Array.isArray(this.modules) && this.modules.length > 0;
  }
}
