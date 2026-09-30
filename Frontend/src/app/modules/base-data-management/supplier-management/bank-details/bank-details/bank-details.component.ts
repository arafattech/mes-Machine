import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { SupplierBankInfo } from '@shared/model/supplier-bank-info';
import { DateFormatterService } from '@shared/utilities/date-format';
import { ToastService } from '@app/services/toast-service/toast.service';
import { ModeOfPayment } from '@shared/enums/mode-of-payment';
import { Localization } from '@shared/utilities/localization';

@Component({
  selector: 'app-bank-details',
  templateUrl: './bank-details.component.html',
  styleUrl: './bank-details.component.scss',
})
export class BankDetailsComponent implements OnChanges, OnInit {
  @Input() isOpen: EventEmitter<void> = new EventEmitter<void>();
  @Input() SupplierBankInfo: SupplierBankInfo = new SupplierBankInfo().deserialize({});
  @Input() approvedAt: string | null = null;
  @Input() createdBy: string | null = null;
  @Input() saveMode = 'POST';
  @Output() IsOpenToastAlert = new EventEmitter<void>();
  @Output() isSuccessChange = new EventEmitter<void>();
  SupplierBankinfo: SupplierBankInfo = new SupplierBankInfo();
  ToastType: 'add' | 'edit' | 'error' | 'approve' = 'add';
  BankDetails:string = $localize`Bank Details`;
  loading: boolean = false;
  open: boolean = false;
  odata: boolean;
  public ModeOfPayment = ModeOfPayment;
  public localization = Localization;

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
    private dateFormatter: DateFormatterService
  ) {
    this.odata = this.commonService.odata;
  }

  ngOnInit(): void {
    this.isOpen.subscribe(() => {
      this.open = true;
      if (this.SupplierBankInfo) {
        this.SupplierBankInfo = this.SupplierBankInfo;
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['SupplierBankInfo'] && this.SupplierBankInfo) {
      this.SupplierBankInfo = this.SupplierBankInfo;
      if (this.open) {
      }
    }
  }

  markAsApprove() {
    this.loading = true;

    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    const approved_by = userInfo.id || null;

    if (!approved_by) {
      console.error('User ID not found in localStorage');
      this.toastService.show(this.ToastType);
      this.IsOpenToastAlert.emit();
      this.CloseDialog();
      return;
    }

    const payload = {
      is_active: true,
      approved_at: new Date().toISOString(),
      approved_by,
    };

    this.commonService
      .put(`SupplierBankInfos/${this.SupplierBankInfo.id}`, payload, this.odata)
      .subscribe({
        next: (res: any) => {
          this.toastService.show('approve');
          this.isSuccessChange.emit();
          this.CloseDialog();
        },
        error: (err: any) => {
          console.error('Approval error:', err);
          this.CloseDialog();
        },
      });
  }

  CloseDialog() {
    this.open = false;
    this.loading = false;
  }
}
