import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '@app/shared/shared.module';
import { SupplierFormComponent } from '@base-data-module/supplier-management/supplier-form/supplier-form.component';
import { CardInfoComponent } from '@base-data-module/supplier-management/card-info/card-info.component';
import { CashFormComponent } from '@base-data-module/supplier-management/cash-form/cash-form.component';
import { BankFormComponent } from '@base-data-module/supplier-management/bank-form/bank-form.component';

/**
 * Bundles the supplier create/edit dialog and its sub-forms so it can be reused
 * across feature modules (base-data supplier list + store-management MRR forms)
 * without pulling in base-data's routes.
 */
@NgModule({
  declarations: [
    SupplierFormComponent,
    CardInfoComponent,
    CashFormComponent,
    BankFormComponent,
  ],
  imports: [CommonModule, FormsModule, SharedModule],
  exports: [SupplierFormComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SupplierFormModule {}
