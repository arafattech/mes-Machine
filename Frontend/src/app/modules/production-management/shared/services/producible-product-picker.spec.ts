import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ToastService } from '@app/services/toast-service/toast.service';
import { ProductionLogService } from '@production-module/shared/services/production-log.service';
import { ProducibleProductPicker } from '@production-module/shared/services/producible-product-picker';

describe('ProducibleProductPicker', () => {
  let find: jasmine.Spy;

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-10-08T05:46:00Z'));
    find = jasmine.createSpy('findProducibleProducts').and.callFake((query: { search?: string; ids?: number[] }) =>
      of(query.ids ? query.ids.map((id) => ({ id, text: `Product ${id}` })) : [{ id: 1, text: 'Yarn 30s' }]),
    );
    TestBed.configureTestingModule({
      providers: [
        ProducibleProductPicker,
        { provide: ProductionLogService, useValue: { findProducibleProducts: find } },
        { provide: ToastService, useValue: { show: () => undefined } },
      ],
    });
  });

  afterEach(() => jasmine.clock().uninstall());

  const typed = (value: string) => ({ target: { value } }) as unknown as Event;

  it('loads nothing until opened, then the first page, remembering names', () => {
    const picker = TestBed.inject(ProducibleProductPicker);
    expect(find).not.toHaveBeenCalled();

    picker.reset();

    expect(picker.options()).toEqual([{ id: 1, text: 'Yarn 30s' }]);
    expect(picker.nameOf(1)).toBe('Yarn 30s');
  });

  it('resolves only unknown chosen products, once', () => {
    const picker = TestBed.inject(ProducibleProductPicker);
    picker.reset();

    picker.resolve([1, 7, 7, null]);
    picker.resolve([7]);

    expect(find).toHaveBeenCalledWith({ ids: [7] });
    expect(find.calls.allArgs().filter(([q]) => q.ids)).toHaveSize(1);
    expect(picker.nameOf(7)).toBe('Product 7');
  });

  it('debounces typing into one server search', () => {
    const picker = TestBed.inject(ProducibleProductPicker);
    find.calls.reset();

    picker.searchFrom(typed('y'));
    picker.searchFrom(typed('ya'));
    picker.searchFrom(typed(' yar '));
    jasmine.clock().tick(250);

    expect(find).toHaveBeenCalledOnceWith({ search: 'yar' });
  });
});
