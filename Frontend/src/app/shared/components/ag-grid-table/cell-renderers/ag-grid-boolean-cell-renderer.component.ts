import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { Ui5MainModule } from '@ui5/webcomponents-ngx';

@Component({
  selector: 'app-ag-grid-boolean-cell-renderer',
  standalone: true,
  imports: [Ui5MainModule],
  template: `
    <div class="boolean-cell">
      @if(value) {
        <ui5-icon name="accept"></ui5-icon>
      }@else {
        <ui5-icon name="decline"></ui5-icon>
      }
    </div>    
  `,
})
export class AgGridBooleanCellRendererComponent implements ICellRendererAngularComp {
  value = false;

  agInit(params: ICellRendererParams): void {
    this.value = this.parseBoolean(params.value);
  }

  refresh(params: ICellRendererParams): boolean {
    this.value = this.parseBoolean(params.value);
    return true;
  }

  private parseBoolean(value: unknown): boolean {
    return (
      value === true ||
      value === 1 ||
      value === '1' ||
      value === 'true' ||
      value === 'Y'
    );
  }
}
