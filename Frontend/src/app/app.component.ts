import { CommonService } from '@app/services/common-service/common.service';
import { CommonModule } from '@angular/common';
import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { LayoutComponent } from '@app/shared/components/layout/layout.component';
import { AuthLayoutComponent } from '@app/shared/components/auth-layout/auth-layout.component';
import { AuthService } from '@app/services/auth-service/auth.service';
import { filter } from 'rxjs';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { ThemeService } from '@app/services/theme.service';
import { SocketService } from '@app/services/socket.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LayoutComponent, CommonModule, AuthLayoutComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppComponent implements OnInit {
  title = 'Manufacturing Execution System';
  permissionsLoaded: boolean = false;
  rememberToken: string | null = null;
  isLoggedIn = true;
  showLoginLayout = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private rolePermissionService: RolePermissionService,
    private CommonService: CommonService,
    private themeService: ThemeService,
    private socketService: SocketService
  ) {
    this.getUserPermissions();
    this.loadTheme();
  }

  ngOnInit() {
    this.authService.isLoggedIn$.subscribe((loggedIn) => {
      this.isLoggedIn = loggedIn;
      if (!loggedIn) {
        this.socketService.disconnect();
        this.router.navigate(['/login']);
        return;
      }

      this.socketService.connect();
    });
  }

  getUserPermissions() {
    this.permissionsLoaded = true;
    this.CommonService.get('auth', false).subscribe({
      next: (response: any) => {
        this.rolePermissionService.setPermissions(response.permissions);
        this.permissionsLoaded = false;
      },
      error: (error: any) => {
        console.log(error);
        this.permissionsLoaded = false;
      },
    });
  }

  loadTheme() {
    const savedTheme = localStorage.getItem('preferred_theme') || 'sap_fiori_3';
    this.themeService.setUI5Theme(savedTheme);
  }
}
