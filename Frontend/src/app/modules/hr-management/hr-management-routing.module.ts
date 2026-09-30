import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AssetGroupListComponent } from '@app/modules/base-data-management/asset-management/asset-group/asset-group-list/asset-group-list.component';
import { AssetListComponent } from '@app/modules/base-data-management/asset-management/asset-list/asset-list.component';
import { EmployeeListComponent } from '@app/modules/base-data-management/employees-management/employee-list/employee-list.component';
import { DailyAttendanceListComponent } from '@app/modules/hr-management/employee-attendance/daily-attendance-list/daily-attendance-list.component';
import { EmployeeAttendanceListComponent } from '@app/modules/hr-management/employee-attendance/employee-attendance-list/employee-attendance-list.component';
import { EmployeeDashboardComponent } from '@app/modules/hr-management/employee-dashboard/employee-dashboard.component';
import { EmployeePayrollComponent } from '@app/modules/hr-management/employee-payroll/employee-payroll.component';
import { HrDataManagementLayoutComponent } from '@app/modules/hr-management/layout/hr-data-management-layout/hr-data-management-layout.component';
import { CalenderManagementComponent } from '@app/modules/hr-management/leave-management/calender-management/calender-management.component';
import { LeaveRequestComponent } from '@app/modules/hr-management/leave-management/leave-request/leave-request.component';
import { SalaryTypeListComponent } from '@app/modules/hr-management/salary-type/salary-type-list/salary-type-list.component';
import { ShiftManagementComponent } from '@app/modules/hr-management/shift-management/shift-management.component';
import { HolidayTypeManagementComponent } from '@app/modules/hr-management/holiday-type-management/holiday-type-management.component';
import { BlackListComponent } from '@app/modules/hr-management/black-list-management/black-list/black-list.component';
import { EmployeeGroupListComponent } from '@app/modules/base-data-management/employees-management/employee-group-list/employee-group-list.component';
import { PermissionGuard } from '@app/services/permission-guard/permission.guard';
import { PolicyListComponent } from '@app/modules/hr-management/policy-management/policy-list/policy-list.component';
import { PayrollProcessComponent } from '@app/modules/hr-management/employee-payroll/payroll-process/payroll-process.component';
import { HrmDashboardComponent } from '@app/modules/hr-management/hrm-dashboard/hrm-dashboard.component';
import { AssetsListComponent } from '@app/modules/hr-management/asset-management/assets-list/assets-list.component';
import { PayrollHistoryComponent } from '@app/modules/hr-management/employee-payroll/payroll-history/payroll-history.component';
import { LeaveTransferListComponent } from '@app/modules/hr-management/leave-management/leave-transfer/leave-transfer-list/leave-transfer-list.component';
import { LeaveTypeListComponent } from '@app/modules/hr-management/leave-management/leave-type/leave-type-list/leave-type-list.component';
import { RosterManagementComponent } from '@app/modules/hr-management/shift-management/roster-management/roster-management.component';
import { NoticeListComponent } from '@app/modules/hr-management/policy-management/notice-section/notice-list/notice-list.component';
import { ShiftReplacementComponent } from '@app/modules/hr-management/shift-management/shift-replacement/shift-replacement.component';
import { FaceRecognitionComponent } from '@app/modules/hr-management/face-recognition/face-recognition.component';

import { ShiftPlanningComponent } from '@app/modules/hr-management/shift-management/shift-planning/shift-planning.component';
import { Permissions } from '@app/shared/enums/permissions';
import { DesignationManagementComponent } from '@app/modules/hr-management/designation-management/designation-management.component';
import { EmployeeTypeManagementComponent } from '@app/modules/hr-management/employee-type-management/employee-type-management.component';
import { EmployeeSectionManagementComponent } from '@app/modules/hr-management/employee-section-management/employee-section-management.component';
import { PromotionManagementComponent } from '@app/modules/hr-management/promotion-management/promotion-management.component';
import { PromotionHistoryComponent } from '@app/modules/hr-management/promotion-management/promotion-history/promotion-history.component';
import { SideBillComponent } from '@app/modules/hr-management/side-bill-management/side-bill/side-bill.component';
import { TaxRuleManagementComponent } from '@app/modules/hr-management/tax-rule-management/tax-rule-management.component';
import { BiometricsDeviceConfigsComponent } from './biometrics-device-configs/biometrics-device-configs.component';
import { BonusConfigComponent } from '@app/modules/hr-management/bonus-config/bonus-config.component';
import { EmployeeOvertimeComponent } from '@app/modules/hr-management/employee-attendance/employee-overtime/employee-overtime.component';
import { EmployeeBonusesComponent } from '@app/modules/hr-management/employee-payroll/employee-bonuses/employee-bonuses.component';

const routes: Routes = [
  {
    path: '',
    title: 'HR Management',
    component: HrDataManagementLayoutComponent,
    canActivate: [PermissionGuard],
    data: { permission: Permissions.HR_EMPLOYEE_DASHBOARD },
    children: [
      // Dashboard
      { path: '', pathMatch: 'full', redirectTo: 'employee-profile' },
      {
        path: 'hr-analytics',
        component: HrmDashboardComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.HR_ANALYTICS },
      },

      // ================= Employee Management =================
      {
        path: 'employee-management',
        canActivate: [PermissionGuard],
        data: { permission: Permissions.HR_EMPLOYEE },
        children: [
          {
            path: 'employee-list',
            canActivate: [PermissionGuard],
            component: EmployeeListComponent,
            data: { permission: Permissions.HR_EMPLOYEE_LIST },
          },
          {
            path: 'employee-group',
            canActivate: [PermissionGuard],
            component: EmployeeGroupListComponent,
            data: { permission: Permissions.HR_EMPLOYEE_GROUP },
          },
          {
            path: 'designations',
            canActivate: [PermissionGuard],
            component: DesignationManagementComponent,
            data: { permission: Permissions.HR_DESIGNATION },
            },
            {
              path: 'employee-type',
              canActivate: [PermissionGuard],
              component: EmployeeTypeManagementComponent,
              data: { permission: Permissions.HR_EMPLOYEE_TYPE },
            },
            {
              path: 'employee-section',
              canActivate: [PermissionGuard],
              component: EmployeeSectionManagementComponent,
              data: { permission: Permissions.HR_EMPLOYEE_SECTION },
          },

        ],
      },
   // ================= Attendence Management =================
      {
        path: 'attendence-management',
        canActivate: [PermissionGuard],
        data: { permission: Permissions.HR_ATTENDANCE },
        children: [

          {
            path: 'employee-attendence',
            canActivate: [PermissionGuard],
            component: EmployeeAttendanceListComponent,
            data: { permission: Permissions.HR_ATTENDANCE_LIST },
          },
          {
            path: 'employee-daily-attendence',
            canActivate: [PermissionGuard],
            component: DailyAttendanceListComponent,
            data: { permission: Permissions.HR_DAILY_ATTENDANCE },
          },
          {
            path: 'employee-overtime',
            canActivate: [PermissionGuard],
            component: EmployeeOvertimeComponent,
            data: { permission: Permissions.HR_EMPLOYEE_OVERTIME },
          }
        ],
      },
      // ================= Shift Management =================
      {
        path: 'shift-management',
        canActivate: [PermissionGuard],
        data: { permission: Permissions.HR_SHIFT },
        children: [
          {
            path: 'shift-list',
            canActivate: [PermissionGuard],
            component: ShiftManagementComponent,
            data: { permission: Permissions.HR_SHIFT_LIST },
          },
          {
            path: 'roster-list',
            canActivate: [PermissionGuard],
            component: RosterManagementComponent,
            data: { permission: Permissions.HR_ROSTER },
          },
          {
            path: 'shift-replacement',
            canActivate: [PermissionGuard],
            component: ShiftReplacementComponent,
            data: { permission: Permissions.HR_SHIFT },
          },
        ],
      },

      // ================= Holiday Type Management =================
      {
        path: 'holiday-type-management',
        canActivate: [PermissionGuard],
        data: { permission: Permissions.HR_HOLIDAY_TYPE },
        children: [
          {
            path: 'holiday-type-list',
            canActivate: [PermissionGuard],
            component: HolidayTypeManagementComponent,
            data: { permission: Permissions.HR_HOLIDAY_TYPE_LIST },
          },
        ],
      },

      // ================= Payroll Management =================
      {
        path: 'payroll-management',
        canActivate: [PermissionGuard],
        data: { permission: Permissions.HR_PAYROLL },
        children: [
          {
            path: 'employee-payroll-process',
            component: PayrollProcessComponent,
            canActivate: [PermissionGuard],
            data: { permission: Permissions.HR_PAYROLL_PROCESS },
          },
          {
            path: 'employee-payroll',
            canActivate: [PermissionGuard],
            component: EmployeePayrollComponent,
            data: { permission: Permissions.HR_PAYROLL_LIST },
          },
          {
            path: 'employee-payroll-history',
            canActivate: [PermissionGuard],
            component: PayrollHistoryComponent,
            data: { permission: Permissions.HR_PAYROLL_HISTORY },
          },
          {
            path: 'salary-type',
            canActivate: [PermissionGuard],
            component: SalaryTypeListComponent,
            data: { permission: Permissions.HR_PAYROLL },
          },
          {
            path: 'side-bill',
            canActivate: [PermissionGuard],
            component: SideBillComponent,
            data: { permission: Permissions.HR_SIDE_BILL },
          },
          {
              path: 'employee-bonuses',
              canActivate: [PermissionGuard],
              component: EmployeeBonusesComponent,
              data: { permission: Permissions.HR_PAYROLL },
          },
          {
            path: 'tax-rules',
            canActivate: [PermissionGuard],
            component: TaxRuleManagementComponent,
            data: { permission: Permissions.HR_TAX_RULE },
          },
        ],
      },

      // ================= Employee Profile =================
      {
        path: 'employee-profile',
        component: EmployeeDashboardComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.HR_EMPLOYEE_DASHBOARD },
      },

      // ================= Leave Management =================
      {
        path: 'leave-management',
        canActivate: [PermissionGuard],
        data: { permission: Permissions.HR_LEAVE },
        children: [
          {
            path: 'leave-request',
            canActivate: [PermissionGuard],
            component: LeaveRequestComponent,
            data: { permission: Permissions.HR_LEAVE_REQUEST },
          },
          {
            path: 'leave-transfer',
            component: LeaveTransferListComponent,
            canActivate: [PermissionGuard],
            data: { permission: Permissions.HR_HOLIDAY_SWAP },
          },
          {
            path: 'leave-type',
            component: LeaveTypeListComponent,
            canActivate: [PermissionGuard],
            data: { permission: Permissions.HR_LEAVE_TYPE },
          },
          {
            path: 'calender',
            canActivate: [PermissionGuard],
            component: CalenderManagementComponent,
            data: { permission: Permissions.HR_CALENDAR },
          },
        ],
      },

      // ================= Blacklist Management =================
      {
        path: 'blacklist-management',
        canActivate: [PermissionGuard],
        data: { permission: Permissions.HR_BLACK_LIST },
        children: [
          {
            path: 'black-list',
            component: BlackListComponent,
            canActivate: [PermissionGuard],
            data: { permission: Permissions.HR_BLACK_LIST },
          },
        ],
      },

      // ================= Promotions Management =================
      {
        path: 'promotion-management',
        canActivate: [PermissionGuard],
        data: { permission: Permissions.HR_PROMOTION },
        children: [
            {
              path: 'promotions',
              component: PromotionManagementComponent,
              canActivate: [PermissionGuard],
              data: { permission: Permissions.HR_PROMOTION_LIST },
            },
            {
              path: 'promotion-history',
              component: PromotionHistoryComponent,
              canActivate: [PermissionGuard],
              data: { permission: Permissions.HR_PROMOTION_HISTORY },
            }
        ],
      },
      // ================= Face Recognition =================
      {
        path: 'biometric-configurations',
        component: BiometricsDeviceConfigsComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.HR_BIOMETRIC },
      },
      {
        path: 'employee-type',
        component: EmployeeTypeManagementComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.HR_EMPLOYEE_TYPE },
      },
      {
        path: 'employee-section',
        component: EmployeeSectionManagementComponent,
        canActivate: [PermissionGuard],
        data: { permission: Permissions.HR_EMPLOYEE_SECTION },
      },

      {
        path: 'face-recognition',
        canActivate: [PermissionGuard],
        data: { permission: Permissions.HR_FACE_RECOGNITION },
        component: FaceRecognitionComponent,
      },

      // ================= Asset Management =================
      {
        path: 'asset-management',
        canActivate: [PermissionGuard],
        data: { permission: Permissions.HR_ASSET },
        children: [
          {
            path: 'asset-list',
            canActivate: [PermissionGuard],
            component: AssetsListComponent,
            data: { permission: Permissions.HR_EMPLOYEE_ASSET_LIST },
          },
          {
            path: 'asset-group',
            canActivate: [PermissionGuard],
            component: AssetGroupListComponent,
            data: { permission: Permissions.BASE_DATA_ASSET_GROUP },
          },
        ],
      },

      // ================= Notice / Policy Management =================
      {
        path: 'notice-management',
        canActivate: [PermissionGuard],
        data: { permission: Permissions.HR_NOTICE },
        children: [
          {
            path: 'policy-list',
            canActivate: [PermissionGuard],
            component: PolicyListComponent,
            data: { permission: Permissions.HR_NOTICE_LIST },
          },
          {
            path: 'apply-notice',
            canActivate: [PermissionGuard],
            component: NoticeListComponent,
            data: { permission: Permissions.HR_NOTICE_LIST },
          },
        ],
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class HrDataManagementRoutingModule {}
