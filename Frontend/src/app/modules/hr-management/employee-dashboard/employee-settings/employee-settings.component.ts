import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@app/services/auth-service/auth.service';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { Localization } from '@app/shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';

@Component({
  selector: 'app-employee-settings',
  templateUrl: './employee-settings.component.html',
  styleUrl: './employee-settings.component.scss',
})
export class EmployeeSettingsComponent {
  localization = Localization;

  loading: boolean = false;
  open: boolean = false;
  isMessageStrip: boolean = false;
  api: boolean;
  public validationMessage = Localization.requiredField;
  MessageStrip: string = '';

  data = {
    current_password: '',
    password: '',
    password_confirmation: '',
  };
  valueStateOptions = {
    current_password: ValueState.None,
    password: ValueState.None,
    password_confirmation: ValueState.None,
  };
  passwordVisibility = {
    current_password: false,
    password: false,
    password_confirmation: false,
  };

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
    private authService: AuthService,
    private router: Router
  ) {
    this.api = commonService.api;
  }

  onInputChange(
    event: Event,
    field: 'current_password' | 'password' | 'password_confirmation'
  ) {
    const input = event.target as any;
    this.data[field] = input.value || input.typedInValue || '';

    if (!this.data[field].trim()) {
      this.valueStateOptions[field] = ValueState.Negative;
    } else {
      this.valueStateOptions[field] = ValueState.None;
    }
  }

  togglePasswordVisibility(
    field: 'current_password' | 'password' | 'password_confirmation'
  ) {
    this.passwordVisibility[field] = !this.passwordVisibility[field];
  }

  validateForm(): boolean {
    let isValid = true;

    if (!this.data.current_password?.trim()) {
      this.valueStateOptions.current_password = ValueState.Negative;
      isValid = false;
    }
    if (!this.data.password?.trim()) {
      this.valueStateOptions.password = ValueState.Negative;
      isValid = false;
    } else if (this.data.password.trim().length < 6) {
      this.valueStateOptions.password = ValueState.Negative;
      this.isMessageStrip = true;
      this.MessageStrip = 'Password must be at least 6 characters.';
      isValid = false;
    }
    if (!this.data.password_confirmation?.trim()) {
      this.valueStateOptions.password_confirmation = ValueState.Negative;
      isValid = false;
    }
    if (this.data.password !== this.data.password_confirmation) {
      this.valueStateOptions.password = ValueState.Negative;
      this.valueStateOptions.password_confirmation = ValueState.Negative;
      isValid = false;
      this.isMessageStrip = true;
      this.MessageStrip = 'New password and confirm password do not match.';
    }

    return isValid;
  }

  onChangePassword() {
    if (!this.validateForm()) {
      return;
    }

    this.loading = true;
    this.commonService
      .post(`user/change-password`, this.data, this.api)
      .subscribe({
        next: (res: any) => {
          this.toastService.show('password');
          this.loading = false;
          this.open = false;
          this.reset();
          this.onLogout();
        },
        error: (err: any) => {
          this.loading = false;
          this.toastService.show('error');
          console.error('Error changing password:', err);
          this.isMessageStrip = true;
          this.MessageStrip = err.error.error;
        },
      });
  }
  onLogout() {
    const remember_token = localStorage.getItem('remember_token');
    this.loading = true;
    if (remember_token) {
      this.authService.logout(remember_token).subscribe({
        next: () => {
          this.clearAuthStorage();
          this.router.navigate(['/login']);
          this.authService.logoutCheck();
          this.loading = false;
        },
        error: (error) => {
          console.log(error);
          this.clearAuthStorage();
          this.router.navigate(['/login']);
          this.authService.logoutCheck();
          this.loading = false;
        },
      });
    } else {
      this.clearAuthStorage();
      this.router.navigate(['/login']);
      this.authService.logoutCheck();
      this.loading = false;
    }
  }

  private clearAuthStorage(): void {
    localStorage.removeItem('remember_token');
    localStorage.removeItem('userInfo');
    localStorage.removeItem('roles');
    localStorage.removeItem('permissions');
    localStorage.removeItem('preferred_language');
    localStorage.removeItem('media');
    localStorage.removeItem('employee_id');
    localStorage.removeItem('department_id');
  }

  reset() {
    this.data = {
      current_password: '',
      password: '',
      password_confirmation: '',
    };
    this.valueStateOptions = {
      current_password: ValueState.None,
      password: ValueState.None,
      password_confirmation: ValueState.None,
    };
    this.passwordVisibility = {
      current_password: false,
      password: false,
      password_confirmation: false,
    };
  }
}
