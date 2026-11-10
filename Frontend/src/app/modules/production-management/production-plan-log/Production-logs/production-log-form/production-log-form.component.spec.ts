import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import '@ui5/webcomponents/dist/ComboBox.js';
import '@ui5/webcomponents/dist/ComboBoxItem.js';
import { Ui5FioriModule, Ui5MainModule } from '@ui5/webcomponents-ngx';
import { ProductionLogFormComponent } from './production-log-form.component';

const settle = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

describe('ProductionLogFormComponent reopening', () => {
  let fixture: ComponentFixture<ProductionLogFormComponent>;
  let http: HttpTestingController;

  const flushRequests = (): void => {
    for (const req of http.match(() => true)) {
      const url = req.request.urlWithParams;
      if (url.includes('WorkOrders?')) {
        req.flush({
          value: [
            { id: 1, custom_id: 'WO-0000001', product: { product_name: 'YERN' } },
            { id: 3, custom_id: 'WO-0000003', product: { product_name: 'Cotton Bud' } },
          ],
        });
      } else if (url.includes('shift')) {
        req.flush({ value: [{ id: 2, name: 'Shift B' }], data: [{ id: 2, name: 'Shift B' }] });
      } else {
        req.flush({});
      }
    }
  };

  const combobox = (id: string): HTMLElement & { value: string; items: unknown[] } =>
    fixture.nativeElement.querySelector(`#${id}`);

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ProductionLogFormComponent],
      imports: [CommonModule, FormsModule, HttpClientTestingModule, Ui5MainModule, Ui5FioriModule],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(ProductionLogFormComponent);
    http = TestBed.inject(HttpTestingController);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });

  afterEach(() => fixture.nativeElement.remove());

  it('still loads the production orders and shows an empty form after being reopened', async () => {
    const form = fixture.componentInstance;

    form.openDialog();
    flushRequests();
    fixture.detectChanges();
    await settle();
    expect(combobox('workOrder').items.length).toBe(2);

    // a previous submission left the order and shift picked
    combobox('workOrder').value = 'WO-0000001 · YERN';
    combobox('shift').value = 'Shift B';
    form.workOrderId = 1;
    form.shiftId = 2;
    form.closeDialog();

    form.openDialog();
    flushRequests();
    fixture.detectChanges();
    await settle();

    expect(form.workOrderId).toBeNull();
    expect(form.shiftId).toBeNull();
    expect(combobox('workOrder').value).toBe('');
    expect(combobox('shift').value).toBe('');
    expect(combobox('workOrder').items.length).toBe(2);
  });
});
