import { CommonModule } from '@angular/common';
import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { HrDataManagementRoutingModule } from '@app/modules/hr-management/hr-management-routing.module';
import { SharedModule } from '@app/shared/shared.module';
import { PolicyListComponent } from '@app/modules/hr-management/policy-management/policy-list/policy-list.component';
import { EmployeeAttendanceListComponent } from '@app/modules/hr-management/employee-attendance/employee-attendance-list/employee-attendance-list.component';
import { DailyAttendanceListComponent } from '@app/modules/hr-management/employee-attendance/daily-attendance-list/daily-attendance-list.component';
import { SalaryTypeListComponent } from '@app/modules/hr-management/salary-type/salary-type-list/salary-type-list.component';
import { LeaveSectionComponent } from '@app/modules/hr-management/employee-dashboard/leave-section/leave-section.component';
import { AssetSectionComponent } from '@app/modules/hr-management/employee-dashboard/asset-section/asset-section.component';
import { EmployeeDashboardComponent } from '@app/modules/hr-management/employee-dashboard/employee-dashboard.component';
import { ShiftManagementComponent } from '@app/modules/hr-management/shift-management/shift-management.component';
import { EmployeePayrollComponent } from '@app/modules/hr-management/employee-payroll/employee-payroll.component';
import { LeaveRequestComponent } from '@app/modules/hr-management/leave-management/leave-request/leave-request.component';
import { PayrollProcessComponent } from '@app/modules/hr-management/employee-payroll/payroll-process/payroll-process.component';
import { BlackListComponent } from '@app/modules/hr-management/black-list-management/black-list/black-list.component';
import { AngularEditorModule } from '@kolkov/angular-editor';
import { AngularEditorComponent } from '@app/shared/components/angular-editor/angular-editor.component';
import { HrmDashboardComponent } from '@app/modules/hr-management/hrm-dashboard/hrm-dashboard.component';
import { PayrollOverviewComponent } from '@app/modules/hr-management/employee-payroll/payroll-process/payroll-overview/payroll-overview.component.js';
import { PayrollHistoryComponent } from '@app/modules/hr-management/employee-payroll/payroll-history/payroll-history.component.js';
import { AssetsListComponent } from '@app/modules/hr-management/asset-management/assets-list/assets-list.component.js';
import { LeaveTransferListComponent } from '@app/modules/hr-management/leave-management/leave-transfer/leave-transfer-list/leave-transfer-list.component';
import { LeaveTransferFormComponent } from '@app/modules/hr-management/leave-management/leave-transfer/leave-transfer-form/leave-transfer-form.component';
import { LeaveTypeListComponent } from '@app/modules/hr-management/leave-management/leave-type/leave-type-list/leave-type-list.component';
import { LeaveTypeFormComponent } from '@app/modules/hr-management/leave-management/leave-type/leave-type-form/leave-type-form.component';
import { EmployeeSettingsComponent } from '@app/modules/hr-management/employee-dashboard/employee-settings/employee-settings.component';
import { RosterManagementComponent } from '@app/modules/hr-management/shift-management/roster-management/roster-management.component';
import { EmployeeGroupListComponent } from '@app/modules/base-data-management/employees-management/employee-group-list/employee-group-list.component';
import { EmployeeGroupFormComponent } from '@app/modules/base-data-management/employees-management/employee-group-list/employee-group-form/employee-group-form.component';
import { NoticeFormComponent } from '@app/modules/hr-management/policy-management/notice-section/notice-form/notice-form.component';
import { NoticeListComponent } from '@app/modules/hr-management/policy-management/notice-section/notice-list/notice-list.component';
import { ShiftReplacementComponent } from '@app/modules/hr-management/shift-management/shift-replacement/shift-replacement.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ShiftPlanningComponent } from '@app/modules/hr-management/shift-management/shift-planning/shift-planning.component.js';
import { ReplacementFormComponent } from '@app/modules/hr-management/shift-management/shift-replacement/replacement-form/replacement-form.component.js';
import { RosterTableComponent } from '@app/modules/hr-management/employee-dashboard/roster-table/roster-table.component';
import { MyCalendarComponent } from '@app/modules/hr-management/employee-dashboard/my-calendar/my-calendar.component';
import { FullCalendarModule } from '@fullcalendar/angular';
import { ViewApplyComponent } from '@app/modules/hr-management/employee-dashboard/leave-section/view-apply/view-apply.component';
import { HrmGroupPieComponent } from './shared/components/hrm-group-pie/hrm-group-pie.component';
import { BarAnalysisChartComponent } from './shared/components/bar-analysis-chart/bar-analysis-chart.component';
import { StoreManagementModule } from '@app/modules/store-management/store-management.module';
import { BaseDataManagementModule } from '@app/modules/base-data-management/base-data-management.module';
import { SalesManagementModule } from '../sales-management/sales.module';
import { HrPayrollNutComponent } from './shared/components/hr-payroll-nut/hr-payroll-nut.component';
import { DesignationManagementComponent } from '@app/modules/hr-management/designation-management/designation-management.component';
import { EmployeeTypeManagementComponent } from '@app/modules/hr-management/employee-type-management/employee-type-management.component';
import { EmployeeSectionManagementComponent } from '@app/modules/hr-management/employee-section-management/employee-section-management.component';
import { SharedDonutChartComponent } from '@shared/components/shared-donut-chart/shared-donut-chart.component';
import { PromotionManagementComponent } from '@app/modules/hr-management/promotion-management/promotion-management.component';
import { PromotionHistoryComponent } from '@app/modules/hr-management/promotion-management/promotion-history/promotion-history.component';
import { BiometricsDeviceConfigsComponent } from './biometrics-device-configs/biometrics-device-configs.component';
import { BonusConfigComponent } from '@app/modules/hr-management/bonus-config/bonus-config.component';
import { OvertimeModalComponent } from '@app/modules/hr-management/overtime-modal/overtime-modal.component';
import { EmployeeOvertimeComponent } from '@app/modules/hr-management/employee-attendance/employee-overtime/employee-overtime.component';
import { EmployeeBonusesComponent } from '@app/modules/hr-management/employee-payroll/employee-bonuses/employee-bonuses.component';
import { HolidayTypeManagementComponent } from '@app/modules/hr-management/holiday-type-management/holiday-type-management.component';
import { TaxRuleManagementComponent } from '@app/modules/hr-management/tax-rule-management/tax-rule-management.component';


@NgModule({
  declarations: [
    PolicyListComponent,
    EmployeeAttendanceListComponent,
    DailyAttendanceListComponent,
    LeaveSectionComponent,
    EmployeeDashboardComponent,
    ShiftManagementComponent,
    EmployeePayrollComponent,
    LeaveRequestComponent,
    PayrollProcessComponent,
    BlackListComponent,
    HrmDashboardComponent,
    PayrollOverviewComponent,
    PayrollHistoryComponent,
    AssetsListComponent,
    LeaveTransferListComponent,
    LeaveTransferFormComponent,
    LeaveTypeListComponent,
    LeaveTypeFormComponent,
    EmployeeSettingsComponent,
    RosterManagementComponent,
    EmployeeGroupListComponent,
    EmployeeGroupFormComponent,
    ShiftReplacementComponent,
    ShiftPlanningComponent,
    NoticeFormComponent,
    NoticeListComponent,
    AssetSectionComponent,
    ShiftReplacementComponent,
    ReplacementFormComponent,
    RosterTableComponent,
    MyCalendarComponent,
    ViewApplyComponent,
    HrmGroupPieComponent,
    BarAnalysisChartComponent,
    HrPayrollNutComponent,
    EmployeeTypeManagementComponent,
    EmployeeSectionManagementComponent,
    DesignationManagementComponent,
    PromotionManagementComponent,
    PromotionHistoryComponent,
    BiometricsDeviceConfigsComponent,
    BonusConfigComponent,
    OvertimeModalComponent,
    EmployeeOvertimeComponent,
    EmployeeBonusesComponent,
    HolidayTypeManagementComponent,
    TaxRuleManagementComponent,
  ],
  imports: [
    HrDataManagementRoutingModule,
    SharedModule,
    SalaryTypeListComponent,
    CommonModule,
    AngularEditorModule,
    AngularEditorComponent,
    DragDropModule,
    StoreManagementModule,
    SalesManagementModule,
    BaseDataManagementModule,
    SharedDonutChartComponent,
    FullCalendarModule,
  ],
  exports: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class HrDataManagementModule {}
