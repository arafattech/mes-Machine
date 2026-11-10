import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, catchError, debounceTime, merge, of, switchMap } from 'rxjs';
import type ComboBox from '@ui5/webcomponents/dist/ComboBox.js';
import { ToastService } from '@app/services/toast-service/toast.service';
import { ProductOption } from '@production-module/shared/interface/interface';
import { ProductionLogService } from '@production-module/shared/services/production-log.service';

/** The endpoint's upper bound for one id lookup. */
const MAX_IDS_PER_LOOKUP = 100;

/**
 * Server-searched producible-product options for one form (provide it in the component).
 * One option list per form: every product box on the form shows the latest search. Keeps every
 * name it has seen, so a chosen product still shows its name after a later search narrows the list.
 */
@Injectable()
export class ProducibleProductPicker {
  readonly options = signal<ProductOption[]>([]);

  private readonly service = inject(ProductionLogService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly names = signal<ReadonlyMap<number, string>>(new Map());
  private readonly pendingIds = new Set<number>();
  private readonly typed$ = new Subject<string>();
  private readonly reset$ = new Subject<string>();

  constructor() {
    merge(this.typed$.pipe(debounceTime(250)), this.reset$)
      .pipe(
        switchMap((search) => this.service.findProducibleProducts({ search }).pipe(catchError(() => this.failed()))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((options) => {
        this.remember(options);
        this.options.set(options);
      });
  }

  /** Call when the form opens: fetches the unfiltered first page. */
  reset(): void {
    this.reset$.next('');
  }

  /** Bind to a product combobox's `(input)`. */
  searchFrom(event: Event): void {
    this.typed$.next(((event.target as ComboBox).value ?? '').trim());
  }

  nameOf(id: number | null | undefined): string {
    return id == null ? '' : this.names().get(id) ?? '';
  }

  /** Loads names for chosen products that no response has named yet. */
  resolve(ids: Array<number | null | undefined>): void {
    const missing = [...new Set(ids)].filter(
      (id): id is number => id != null && !this.names().has(id) && !this.pendingIds.has(id),
    );
    for (let i = 0; i < missing.length; i += MAX_IDS_PER_LOOKUP) {
      const chunk = missing.slice(i, i + MAX_IDS_PER_LOOKUP);
      chunk.forEach((id) => this.pendingIds.add(id));
      this.service
        .findProducibleProducts({ ids: chunk })
        .pipe(catchError(() => this.failed()), takeUntilDestroyed(this.destroyRef))
        .subscribe((options) => {
          chunk.forEach((id) => this.pendingIds.delete(id));
          this.remember(options);
        });
    }
  }

  private remember(options: ProductOption[]): void {
    if (!options.length) return;
    this.names.update((names) => new Map([...names, ...options.map((o): [number, string] => [o.id, o.text])]));
  }

  private failed(): Observable<ProductOption[]> {
    this.toast.show('error');
    return of([]);
  }
}
