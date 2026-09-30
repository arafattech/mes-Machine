import { Component, CUSTOM_ELEMENTS_SCHEMA, Input } from '@angular/core';
import { Localization } from '@shared/utilities/localization';

@Component({
  selector: 'app-payroll-overview',
  templateUrl: './payroll-overview.component.html',
  styleUrl: './payroll-overview.component.scss',
})
export class PayrollOverviewComponent {
  localization = Localization;
  isViewOpen = false;
  @Input() payrollData: any;
  get netSalary(): number {
    return Math.max(0, Number(this.payrollData?.net_salary ?? 0));
  }
  openDialog() {
    this.isViewOpen = true;
  }
  CloseDialog() {
    this.isViewOpen = false;
  }
}
