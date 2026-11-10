import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@shared/shared.module';
import { ProductionRoutingModule } from '@production-module/production-routing.module';
import { StatusCardComponent } from '@production-module/shared/components/status-card/status-card.component';

import { MachineBoardComponent } from '@app/modules/production-management/machine-board/machine-board.component';
import { MachineStatusCardComponent } from '@production-module/shared/components/machine-status-card/machine-status-card.component';
import { MachineOverviewComponent } from '@production-module/shared/components/machine-overview/machine-overview.component';
import { MachineDetailsComponent } from '@production-module/shared/components/machine-details/machine-details.component';
import { QualityEfficiencyComponent } from '@production-module/shared/components/quality-efficiency/quality-efficiency.component';
import { ProductionOverviewComponent } from '@production-module/shared/components/production-overview/production-overview.component';
import { WorkOrderDetailComponent } from '@production-module/shared/components/work-order-detail/work-order-detail.component';
import { LogProductionEntryComponent } from '@production-module/shared/components/log-production-entry/log-production-entry.component';
import { MachineWorkOrdersComponent } from '@production-module/shared/components/machine-work-orders/machine-work-orders.component';
import { MachineWorkOrderOverviewComponent } from '@production-module/shared/components/machine-work-order-overview/machine-work-order-overview.component';
import { ProductionLogListComponent } from '@production-module/production-plan-log/Production-logs/production-log-list/production-log-list.component';
import { ProductionLogFormComponent } from '@production-module/production-plan-log/Production-logs/production-log-form/production-log-form.component';
import { LogWastageComponent } from '@production-module/production-plan-log/wastage-logs/log-wastage/log-wastage.component';
import {
  AgGridMachinesWastageTypesCellRendererComponent,
  WastageLogListComponent,
} from '@production-module/production-plan-log/wastage-logs/wastage-log-list/wastage-log-list.component';
import { WorkOrderListComponent } from '@production-module/production-plan-log/work-order-management/work-order-list/work-order-list.component';
import { WorkOrderFormComponent } from '@production-module/production-plan-log/work-order-management/work-order-form/work-order-form.component';
import { MachineMaintenanceListComponent } from '@production-module/machine-maintenance/machine-maintenance-list/machine-maintenance-list.component';
import { MachineMaintenanceFormComponent } from '@production-module/machine-maintenance/machine-maintenance-form/machine-maintenance-form.component';
import { ProductionLotListComponent } from '@production-module/production-plan-log/production-lot-management/production-lot-list/production-lot-list.component';
import { ProductionLotBatchFormComponent } from '@production-module/production-plan-log/production-lot-management/production-lot-batch-form/production-lot-batch-form.component';
import { DurationPipe } from '@production-module/shared/pipes/duration.pipe';
import { TimeAgoPipe } from '@production-module/shared/pipes/time-ago.pipe';
import { MachineStatesService } from './shared/services/machine-states.service';
import { AmActivityChartComponent } from '@production-module/shared/components/am-activity-chart/am-activity-chart.component';
import { AmDivergentStackedBarComponent } from '@production-module/shared/components/am-divergent-stacked-bar/am-divergent-stacked-bar.component';

import { MachineMaintenanceScheduleListComponent } from './machine-maintenance-schedule/machine-maintenance-schedule-list/machine-maintenance-schedule-list.component';
import { MachineMaintenanceScheduleFormComponent } from './machine-maintenance-schedule/machine-maintenance-schedule-form/machine-maintenance-schedule-form.component';
import { AngularEditorComponent } from '@app/shared/components/angular-editor/angular-editor.component';
import { OeeProductionDashboardComponent } from '@production-module/shared/components/machine-dashboard/oee-production-dashboard/oee-production-dashboard.component';
import { MachineDashboardHeaderComponent } from '@production-module/shared/components/machine-dashboard/machine-dashboard-header/machine-dashboard-header.component';
import { MachineConditionComponent } from '@production-module/shared/components/machine-dashboard/machine-condition/machine-condition.component';
import { MachineRuntimeDashboardComponent } from '@production-module/shared/components/machine-dashboard/machine-runtime-dashboard/machine-runtime-dashboard.component';
import { SapFioriMachineDashboardComponent } from '@production-module/shared/components/machine-dashboard/sap-fiori-machine-dashboard/sap-fiori-machine-dashboard.component';

@NgModule({
  declarations: [
    MachineBoardComponent,
    StatusCardComponent,
    MachineStatusCardComponent,
    MachineOverviewComponent,
    MachineDetailsComponent,
    QualityEfficiencyComponent,
    ProductionOverviewComponent,
    WorkOrderDetailComponent,
    LogProductionEntryComponent,
    MachineWorkOrdersComponent,
    MachineWorkOrderOverviewComponent,
    ProductionLogListComponent,
    ProductionLogFormComponent,
    LogWastageComponent,
    AgGridMachinesWastageTypesCellRendererComponent,
    WastageLogListComponent,
    WorkOrderListComponent,
    WorkOrderFormComponent,
    MachineMaintenanceListComponent,
    MachineMaintenanceFormComponent,
    ProductionLotListComponent,
    ProductionLotBatchFormComponent,
    MachineMaintenanceScheduleListComponent,
    MachineMaintenanceScheduleFormComponent,
    OeeProductionDashboardComponent,
  ],
  imports: [
    CommonModule,
    ProductionRoutingModule,
    SharedModule,
    DurationPipe,
    TimeAgoPipe,
    AmActivityChartComponent,
    AmDivergentStackedBarComponent,
    AngularEditorComponent,
    MachineDashboardHeaderComponent,
    MachineConditionComponent,
    MachineRuntimeDashboardComponent,
    SapFioriMachineDashboardComponent,
  ],
  exports: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ProductionModule {
  constructor(private stateService: MachineStatesService) {
    this.stateService.loadAll().subscribe();
  }
}
