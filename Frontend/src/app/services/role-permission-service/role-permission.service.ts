import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { CommonService } from '@app/services/common-service/common.service';

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

  constructor(private commonService: CommonService) {}

  setPermissions(permissions: string[]): void {
    this.permissions = permissions;
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
