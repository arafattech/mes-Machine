import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { Observable } from 'rxjs';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { CommonService } from '@app/services/common-service/common.service';

@Injectable({
  providedIn: 'root',
})
export class PermissionGuard implements CanActivate {
  permissionsLoaded: boolean = true;
  seletedPermission: string = '';
  constructor(
    private rolePermissionService: RolePermissionService,
    private CommonService: CommonService,
    private router: Router
  ) {
    this.getUserPermissions();
  }

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    const requiredPermission = next.data['permission'];
    this.seletedPermission = requiredPermission;
    this.getUserPermissions();
    if (this.permissionsLoaded) {
      return true;
    }
    if (
      requiredPermission &&
      this.rolePermissionService.hasPermission(requiredPermission)
    ) {
      return true;
    } else {
      this.router.navigate(['/not-authorized']);
      return false;
    }
  }

  getUserPermissions() {
    this.CommonService.get('auth', false).subscribe({
      next: (response: any) => {
        this.rolePermissionService.setPermissions(response.permissions);
        if (this.rolePermissionService.hasPermission(this.seletedPermission)) {
          this.permissionsLoaded = false;
          return true;
        } else {
          setTimeout(() => {
            this.router.navigate(['/not-authorized']);
          }, 100);
          this.permissionsLoaded = false;
          return false;
        }
      },
      error: (error: any) => {
        console.error(error);
        this.permissionsLoaded = false;
      },
    });
  }
}
