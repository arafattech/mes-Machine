import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-purchese-order-list',
  templateUrl: './purchese-order-list.component.html',
  styleUrl: './purchese-order-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurcheseOrderListComponent {}
