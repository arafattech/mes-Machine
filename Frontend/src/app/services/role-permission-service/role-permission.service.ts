import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { CommonService } from '@app/services/common-service/common.service';
import { ThemeService } from '@app/services/theme.service';
import { Permissions } from '@app/shared/enums/permissions';

const DEFAULT_THEME = 'sap_horizon';

export interface PermissionGroupItem {
  id: number;
  name: string;
}

export interface PermissionGroup {
  group: string;
  permissions: PermissionGroupItem[];
}

@Injectable({
  providedIn: 'root',
})
export class RolePermissionService {
  private permissions: string[] = [];

  constructor(
    private commonService: CommonService,
    private themeService: ThemeService,
  ) {}

  setPermissions(permissions: string[]): void {
    this.permissions = permissions;
    this.enforceThemeAccess();
  }

  // Without THEME_ENABLE the theme switcher is hidden, so a theme saved earlier
  // (or by another user on this browser) must not stick — pin the default light theme.
  private enforceThemeAccess(): void {
    if (this.hasPermission(Permissions.THEME_ENABLE)) return;
    if (this.themeService.getTheme() !== DEFAULT_THEME) {
      this.themeService.setUI5Theme(DEFAULT_THEME);
    }
  }

  getPermissions(): string[] {
    return this.permissions;
  }

  hasPermission(permission: string): boolean {
    return this.permissions.includes(permission);
  }

  hasAnyPermission(permissions: string[]): boolean {
    return permissions.some((perm) => this.permissions.includes(perm));
  }

  getAllPermissionsStatus(): { [key: string]: boolean } {
    return Object.fromEntries(this.permissions.map((p) => [p, true]));
  }

  fetchAllGrouped(): Observable<PermissionGroup[]> {
    return this.commonService.get('permissions/grouped', false).pipe(
      map((res: unknown) => (res as { data: PermissionGroup[] }).data ?? []),
    );
  }
}
