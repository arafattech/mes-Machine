import { Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { CommonService } from '@app/services/common-service/common.service';
import { MachineDashboardViewType } from '@shared/enums/machine-dashboard-view';
import { ProductionLogFormComponent } from '@production-module/production-plan-log/Production-logs/production-log-form/production-log-form.component';
import { MachineDashboardStore } from '@production-module/shared/services/machine-dashboard.store';

/**
 * `/production/mco` host. Resolves the machine's configured `dashboard_view` and renders exactly
 * one dashboard (OEE & Production · Runtime & Status · SAP Fiori). Owns the page-scoped
 * `MachineDashboardStore` and the shared "Log Production" dialog. Only the selected view is
 * instantiated, so the others issue no requests and build no charts.
 *
 * Default change detection on purpose: the OEE view, the log-production dialog and the work-order
 * tab are field-based Default-CD subtrees, which an OnPush host would stop refreshing.
 */
@Component({
  selector: 'app-machine-overview',
  templateUrl: './machine-overview.component.html',
  providers: [MachineDashboardStore],
  host: { class: 'block h-full' },
})
export class MachineOverviewComponent implements OnInit {
  @ViewChild('logFormRef') logFormRef!: ProductionLogFormComponent;

  protected readonly store = inject(MachineDashboardStore);
  protected readonly ViewType = MachineDashboardViewType;
  private readonly commonService = inject(CommonService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.commonService.sidenavHidden.emit(true);

    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const key = params['machineId'] != null ? String(params['machineId']) : null;
      this.store.setMachine(key, { customId: params['id'] ?? '', name: params['name'] ?? '' });
    });
  }

  openLogProductionForm(): void {
    this.logFormRef.openDialog();
  }

  onProductionLogged(): void {
    this.store.notifyProductionLogged();
  }
}
