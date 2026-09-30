import { Component, EventEmitter, Output } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { Localization } from '@app/shared/utilities/localization';
import { Permissions } from '@app/shared/enums/permissions';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { ValueState } from '@app/shared/utilities/value-state-wrapper';
import { YarnTransferAdvice, YarnTransferAdviceLine } from '@store-module/shared/model/yarnTransferAdvice';
import { YarnAdviceStatus } from '@store-module/shared/enum/yarn-advice-status';
import { getStatusStyle } from '@shared/utilities/statusStyles';

interface OptionRow {
  id: number;
  text: string;
}

interface LotCountOption extends OptionRow {
  countTypeName: string | null;
  lotNo: string | null;
}

@Component({
  selector: 'app-yarn-advice-form',
  templateUrl: './yarn-advice-form.component.html',
})
export class YarnAdviceFormComponent {
  @Output() RefreshTable = new EventEmitter<void>();

  open = false;
  loading = false;
  saving = false;
  isReadOnly = false;
  mode: 'create' | 'manage' = 'create';
  selectedTab: 'details' | 'lines' = 'details';

  advice: YarnTransferAdvice = new YarnTransferAdvice().deserialize({});
  cancelConfirmOpen = false;
  rejectConfirmOpen = false;
  rejectReason = '';

  halls: OptionRow[] = [];
  availableLotCounts: LotCountOption[] = [];
  private optionsLoaded = false;

  public localization = Localization;
  public permissions = Permissions;
  public adviceStatus = YarnAdviceStatus;
  valueStateOptions = {
    lots: ValueState.None,
    transferDate: ValueState.None,
  };

  constructor(
    private readonly commonService: CommonService,
    private readonly toastService: ToastService,
    public readonly rolePermissionService: RolePermissionService,
  ) {}

  openCreate(): void {
    this.mode = 'create';
    this.isReadOnly = false;
    this.advice = new YarnTransferAdvice().deserialize({ transfer_date: this.today() });
    this.selectedTab = 'details';
    this.resetValueStates();
    this.open = true;
    this.loadOptions();
  }

  openManage(advice: YarnTransferAdvice, isReadOnly = false): void {
    this.mode = 'manage';
    this.isReadOnly = isReadOnly;
    this.selectedTab = isReadOnly ? 'details' : 'lines';
    this.resetValueStates();
    this.open = true;
    this.loadOptions();
    this.reloadAdvice(advice.id!);
  }

  closeDialog(): void {
    this.open = false;
    this.saving = false;
  }

  onTabSelect(event: any): void {
    this.selectedTab = event.detail.tab.id;
  }

  onHallChange(event: any): void {
    const id = Number(event?.detail?.item?.value);
    this.advice.from_hall_id = Number.isFinite(id) ? id : null;
  }

  onLotSelectionChange(event: any): void {
    const items = event?.detail?.items ?? [];
    this.advice.production_lot_count_ids = items.map((item: any) => Number(item.id));
  }

  isLotSelected(countId: number): boolean {
    return this.advice.production_lot_count_ids.includes(countId);
  }

  get selectedHallText(): string {
    return this.halls.find((h) => h.id === this.advice.from_hall_id)?.text ?? '';
  }


  get isDraft(): boolean {
    return this.advice.status === this.adviceStatus.DRAFT;
  }

  get canCancel(): boolean {
    return this.mode === 'manage' && [this.adviceStatus.DRAFT, this.adviceStatus.HOD_APPROVED].includes(this.advice.status as YarnAdviceStatus);
  }

  get canApproveHod(): boolean {
    return (
      this.mode === 'manage' &&
      this.advice.status === this.adviceStatus.DRAFT &&
      this.rolePermissionService.hasPermission(this.permissions.STORE_YARN_ADVICE_APPROVE_HOD)
    );
  }

  get canApproveGm(): boolean {
    return (
      this.mode === 'manage' &&
      this.advice.status === this.adviceStatus.STORE_RECEIVED &&
      this.rolePermissionService.hasPermission(this.permissions.STORE_YARN_ADVICE_APPROVE_GM)
    );
  }

  get canReject(): boolean {
    return (
      this.mode === 'manage' &&
      [this.adviceStatus.DRAFT, this.adviceStatus.HOD_APPROVED, this.adviceStatus.STORE_RECEIVED].includes(
        this.advice.status as YarnAdviceStatus,
      )
    );
  }

  get canResubmit(): boolean {
    return this.mode === 'manage' && this.advice.status === this.adviceStatus.REJECTED;
  }

  saveHeader(): void {
    if (this.mode === 'create' && !this.validateCreate()) return;

    this.saving = true;
    const request$ =
      this.mode === 'create'
        ? this.commonService.post<any>('store/yarn-advices', this.advice.toPayload(), false)
        : this.commonService.put<any>(`store/yarn-advices/${this.advice.id}`, this.advice.toPayload(), false);

    request$.subscribe({
      next: (res) => {
        this.saving = false;
        this.advice = new YarnTransferAdvice().deserialize(res);
        this.toastService.show(this.mode === 'create' ? 'add' : 'edit');
        this.RefreshTable.emit();
        if (this.mode === 'create') {
          this.mode = 'manage';
          this.selectedTab = 'lines';
        }
      },
      error: (error) => {
        this.saving = false;
        this.toastService.show('error', error?.error?.message);
      },
    });
  }

  lineBadgeStyle(status: string): { backgroundColor: string; color: string; label: string } {
    return getStatusStyle(status);
  }

  adviceBadgeStyle(status: string): { backgroundColor: string; color: string; label: string } {
    return getStatusStyle(status);
  }

  openCancelConfirm(): void {
    this.cancelConfirmOpen = true;
  }

  closeCancelConfirm(): void {
    this.cancelConfirmOpen = false;
  }

  confirmCancel(): void {
    this.cancelConfirmOpen = false;
    this.cancel();
  }

  private cancel(): void {
    this.saving = true;
    this.commonService.post<any>(`store/yarn-advices/${this.advice.id}/cancel`, {}, false).subscribe({
      next: (res) => {
        this.saving = false;
        this.advice = new YarnTransferAdvice().deserialize(res);
        this.toastService.show('edit');
        this.RefreshTable.emit();
      },
      error: (error) => {
        this.saving = false;
        this.toastService.show('error', error?.error?.message);
      },
    });
  }

  approveHod(): void {
    this.commonService.post<any>(`store/yarn-advices/${this.advice.id}/approve-hod`, {}, false).subscribe({
      next: (res) => {
        this.advice = new YarnTransferAdvice().deserialize(res);
        this.toastService.show('approve');
        this.RefreshTable.emit();
      },
      error: (error) => this.toastService.show('error', error?.error?.message),
    });
  }

  approveGm(): void {
    this.saving = true;
    this.commonService.post<any>(`store/yarn-advices/${this.advice.id}/approve-gm`, {}, false).subscribe({
      next: (res) => {
        this.saving = false;
        this.advice = new YarnTransferAdvice().deserialize(res);
        this.toastService.show('approve');
        this.RefreshTable.emit();
        this.closeDialog();
      },
      error: (error) => {
        this.saving = false;
        this.toastService.show('error', error?.error?.message);
      },
    });
  }

  openRejectConfirm(): void {
    this.rejectReason = '';
    this.rejectConfirmOpen = true;
  }

  closeRejectConfirm(): void {
    this.rejectConfirmOpen = false;
  }

  confirmReject(): void {
    this.rejectConfirmOpen = false;
    this.commonService.post<any>(`store/yarn-advices/${this.advice.id}/reject`, { reason: this.rejectReason || null }, false).subscribe({
      next: (res) => {
        this.advice = new YarnTransferAdvice().deserialize(res);
        this.toastService.show('edit');
        this.RefreshTable.emit();
      },
      error: (error) => this.toastService.show('error', error?.error?.message),
    });
  }

  resubmit(): void {
    this.commonService.post<any>(`store/yarn-advices/${this.advice.id}/resubmit`, {}, false).subscribe({
      next: (res) => {
        this.advice = new YarnTransferAdvice().deserialize(res);
        this.toastService.show('edit');
        this.RefreshTable.emit();
      },
      error: (error) => this.toastService.show('error', error?.error?.message),
    });
  }

  receiveLine(line: YarnTransferAdviceLine): void {
    if (line.qtyInDraft == null) {
      this.toastService.show('error', $localize`Enter the received cone count.`);
      return;
    }

    this.commonService
      .post<any>(
        `store/yarn-advices/${this.advice.id}/lines/${line.id}/receive`,
        {
          qty_in_cones: line.qtyInDraft,
          net_weight_kg_in: line.netWeightInDraft,
          remark: line.remarkDraft || null,
        },
        false,
      )
      .subscribe({
        next: (res) => {
          this.advice = new YarnTransferAdvice().deserialize(res);
          this.toastService.show('approve');
          this.RefreshTable.emit();
        },
        error: (error) => this.toastService.show('error', error?.error?.message),
      });
  }

  rejectLine(line: YarnTransferAdviceLine): void {
    this.commonService
      .post<any>(`store/yarn-advices/${this.advice.id}/lines/${line.id}/reject`, { remark: line.remarkDraft || null }, false)
      .subscribe({
        next: (res) => {
          this.advice = new YarnTransferAdvice().deserialize(res);
          this.toastService.show('edit');
          this.RefreshTable.emit();
        },
        error: (error) => this.toastService.show('error', error?.error?.message),
      });
  }

  reconcileLine(line: YarnTransferAdviceLine): void {
    this.commonService
      .post<any>(`store/yarn-advices/${this.advice.id}/lines/${line.id}/reconcile`, { remark: line.remarkDraft || null }, false)
      .subscribe({
        next: (res) => {
          this.advice = new YarnTransferAdvice().deserialize(res);
          this.toastService.show('approve');
          this.RefreshTable.emit();
        },
        error: (error) => this.toastService.show('error', error?.error?.message),
      });
  }

  onQtyInInput(line: YarnTransferAdviceLine, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    line.qtyInDraft = value ? Number(value) : null;
  }

  onNetWeightInInput(line: YarnTransferAdviceLine, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    line.netWeightInDraft = value ? Number(value) : null;
  }

  private reloadAdvice(id: number): void {
    this.loading = true;
    this.commonService
      .get<any>(
        // No trailing "s" — see yarn-transfer-list.component.ts for why.
        `YarnTransferAdvice(${id})?$expand=fromHall,preparedBy,hodApprovedBy,storeReceivedBy,gmApprovedBy,lines($expand=productionLotCount($expand=countType))`,
      )
      .subscribe({
        next: (res) => {
          this.advice = new YarnTransferAdvice().deserialize(res);
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.toastService.show('error');
        },
      });
  }

  private validateCreate(): boolean {
    let isValid = true;
    if (!this.advice.production_lot_count_ids.length) {
      this.valueStateOptions.lots = ValueState.Negative;
      isValid = false;
    }
    if (!this.advice.transfer_date) {
      this.valueStateOptions.transferDate = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  private resetValueStates(): void {
    this.valueStateOptions = { lots: ValueState.None, transferDate: ValueState.None };
  }

  private loadOptions(): void {
    if (this.optionsLoaded) return;
    this.optionsLoaded = true;

    this.commonService
      .get<{ value: { id: number; name: string }[] }>('Halls?$select=id,name')
      .subscribe((res) => {
        this.halls = (res.value ?? []).map((h) => ({ id: h.id, text: h.name }));
      });

    this.commonService
      .get<{ value: { id: number; custom_id: string; countType?: { name: string }; productionLot?: { lot_no: string | null } }[] }>(
        "ProductionLotCounts?$filter=status eq 'PACKED'&$expand=countType,productionLot",
      )
      .subscribe((res) => {
        this.availableLotCounts = (res.value ?? []).map((count) => ({
          id: count.id,
          text: count.custom_id,
          countTypeName: count.countType?.name ?? null,
          lotNo: count.productionLot?.lot_no ?? null,
        }));
      });
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
