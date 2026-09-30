import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ILoadingOverlayAngularComp } from 'ag-grid-angular';
import { ILoadingOverlayParams } from 'ag-grid-community';

@Component({
  selector: 'app-ag-grid-skeleton-overlay',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <div style="width:100%;height:100%;overflow:hidden;">
      <div
        *ngFor="let row of rows; let i = index"
        class="skeleton-row"
        [style.height.px]="rowHeight"
      >
        <div
          *ngFor="let col of cols; let j = index"
          class="skeleton-cell"
          [style.flex]="col.flex"
          [style.animation-delay]="(i * 0.05 + j * 0.03) + 's'"
        ></div>
      </div>
    </div>
  `,
})
export class AgGridSkeletonOverlayComponent implements ILoadingOverlayAngularComp {
  rows: number[] = [];
  rowHeight = 40;
  cols = [
    { flex: '0 0 28px' },
    { flex: '1 1 0' },
    { flex: '1.4 1 0' },
    { flex: '1 1 0' },
    { flex: '0.8 1 0' },
    { flex: '0.6 1 0' },
  ];

  agInit(params: ILoadingOverlayParams & { rowCount?: number; rowHeight?: number }): void {
    this.rowHeight = params.rowHeight ?? 40;
    const count = params.rowCount ?? Math.ceil(400 / this.rowHeight);
    this.rows = Array.from({ length: count });
  }
}
