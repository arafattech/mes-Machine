import { Component, EventEmitter, Output } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { SocketService } from '@app/services/socket.service';
import { AuthService } from '@app/services/auth-service/auth.service';
import { User } from '@app/shared/model/user';
import { Localization } from '@shared/utilities/localization';
import '@ui5/webcomponents/dist/StepInput.js';

@Component({
  selector: 'app-receive-qty-form',
  templateUrl: './receive-qty-form.component.html',
})
export class ReceiveQtyFormComponent {
  @Output() saveEvent = new EventEmitter<void>();

  public open = false;
  public loading = false;
  public localization = Localization;

  public mrrLabel = '';
  public productName = '';
  public requiredQuantity = 0;
  public receivedQuantity = 0;
  public receivingQuantity = 0;

  // Lot editing — shown whenever the product being received already has a lot tied to
  // it (created at MRR creation time for raw cotton, see MRRFromComponent). Looked up by
  // mrr_item_id so the exact lot tied to this receipt item is edited, not just any lot
  // for the product.
  public hasLot = false;
  public lotNumber = '';
  public lotDraft = {
    bale_quantity: 0,
    gross_weight_kg: 0,
    tare_weight_kg: 0,
    net_weight_kg: 0,
    moisture_pct: 0,
    received_date: null as string | null,
    remarks: null as string | null,
    status: 'IN_STOCK',
  };

  private mrrId: number | null = null;
  private productId: number | null = null;
  private mrrCustomId = '';
  private lotId: number | null = null;
  private previousBaleQuantity = 0;
  private authUser: User = new User();

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
    private socketService: SocketService,
    private authService: AuthService,
  ) {
    this.authUser = this.authService.user();
  }

  get remainingQuantity(): number {
    return Math.max(0, this.requiredQuantity - this.receivedQuantity);
  }

  get isOverLimit(): boolean {
    return this.receivingQuantity > this.remainingQuantity;
  }

  get canSubmit(): boolean {
    return !this.loading && this.receivingQuantity > 0 && !this.isOverLimit;
  }

  get avgWeightPerBale(): string {
    const bales = this.previousBaleQuantity + (this.lotDraft.bale_quantity ?? 0);
    const net = this.lotDraft.net_weight_kg ?? 0;
    if (!bales || !net) return '0';
    return (net / bales).toFixed(2);
  }

  openFor(mrr: any, item: any): void {
    this.mrrId = mrr?.id ?? null;
    this.productId = item?.product_id != null ? Number(item.product_id) : null;
    this.mrrCustomId = mrr?.custom_id ?? '';
    this.mrrLabel = mrr?.custom_id ?? '';
    this.productName = item?.product?.product_name ?? '';
    this.requiredQuantity = Number(item?.required_quantity ?? 0);
    this.receivedQuantity = Number(item?.received_quantity ?? 0);
    this.receivingQuantity = 0;
    this.open = true;

    this.hasLot = false;
    this.lotId = null;
    this.lotNumber = '';
    this.previousBaleQuantity = 0;
    this.resetLotDraft();

    const mrrItemId = item?.mrr_item_id != null ? Number(item.mrr_item_id) : null;
    if (mrrItemId || this.productId) {
      this.loadLot(mrrItemId, this.productId);
    }
  }

  private resetLotDraft(): void {
    this.lotDraft = {
      bale_quantity: 0,
      gross_weight_kg: 0,
      tare_weight_kg: 0,
      net_weight_kg: 0,
      moisture_pct: 0,
      received_date: null,
      remarks: null,
      status: 'IN_STOCK',
    };
  }

  // Prefer the lot tied to this exact receipt item; older receipts (created before lots
  // carried mrr_item_id) fall back to the most recent lot for the product.
  private loadLot(mrrItemId: number | null, productId: number | null): void {
    const filter = mrrItemId
      ? `mrr_item_id eq ${mrrItemId}`
      : `product_id eq ${productId}`;
    this.commonService.get(`Lots?$filter=${filter}&$orderby=id desc&$top=1`).subscribe({
      next: (res: any) => {
        const lot = (res.value ?? [])[0];
        if (lot) {
          this.applyLot(lot);
          return;
        }
        if (mrrItemId && productId) {
          this.loadLot(null, productId);
        }
      },
      error: (error: any) => console.error('Error occurred while loading lot:', error),
    });
  }

  private applyLot(lot: any): void {
    this.hasLot = true;
    this.lotId = lot.id;
    this.lotNumber = lot.lot_number ?? '';
    this.previousBaleQuantity = Number(lot.bale_quantity ?? 0);
    this.lotDraft = {
      // Entered fresh per receiving event and added to previousBaleQuantity on save —
      // not pre-filled with the cumulative total (see previousBaleQuantity above).
      bale_quantity: 0,
      gross_weight_kg: Number(lot.gross_weight_kg ?? 0),
      tare_weight_kg: Number(lot.tare_weight_kg ?? 0),
      net_weight_kg: Number(lot.net_weight_kg ?? 0),
      moisture_pct: Number(lot.moisture_pct ?? 0),
      received_date: lot.received_date ?? null,
      remarks: lot.remarks ?? null,
      status: lot.status ?? 'IN_STOCK',
    };
  }

  onReceivingQuantityChange(event: Event): void {
    const value = Math.round(Number((event.target as any)?.value ?? 0));
    this.receivingQuantity = Number.isFinite(value) && value > 0 ? value : 0;
  }

  save(): void {
    if (!this.canSubmit) return;
    if (!this.mrrId || !this.productId) return;

    this.loading = true;
    this.commonService
      .post(
        `store/material-receipts/${this.mrrId}/receive`,
        {
          product_id: this.productId,
          receiving_quantity: this.receivingQuantity,
        },
        false,
      )
      .subscribe({
        next: () => {
          if (this.hasLot && this.lotId) {
            const gross = Number(this.lotDraft.gross_weight_kg ?? 0) + this.receivingQuantity;
            const tare = Number(this.lotDraft.tare_weight_kg ?? 0);
            const bale = this.previousBaleQuantity + Number(this.lotDraft.bale_quantity ?? 0);
            this.commonService.put(
              `Lots(${this.lotId})`,
              {
                ...this.lotDraft,
                bale_quantity: bale,
                gross_weight_kg: gross,
                net_weight_kg: Math.max(0, gross - tare),
              },
              true,
            ).subscribe({
              error: (error: any) => console.error('Error occurred while updating lot:', error),
            });
          }
          this.loading = false;
          this.toastService.show('edit');
          this.triggerNotification();
          this.closeDialog();
          this.saveEvent.emit();
        },
        error: (err: any) => {
          this.loading = false;
          this.toastService.show('error');
          console.error('Error receiving quantity', err);
        },
      });
  }

  closeDialog(): void {
    this.open = false;
  }

  private triggerNotification(): void {
    if (!this.mrrId) return;
    this.socketService.emit('store-mrr:received', {
      model_id: this.mrrId,
      model_custom_id: this.mrrCustomId || this.mrrId,
      sender_id: this.authUser.id,
      sender_name: this.authUser.name,
    });
  }
}
