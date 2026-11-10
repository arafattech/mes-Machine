import { CommonModule } from '@angular/common';
import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonService } from '@app/services/common-service/common.service';

/**
 * Server-side searchable dropdown — a fully custom panel (styled with SAP theme tokens so
 * it reads as a native UI5 control) instead of a wrapped `ui5-combobox`, because UI5's own
 * combobox doesn't expose a public scroll/load-more hook for real pagination and needs
 * fragile close/reopen tricks to refresh its popover after an async search.
 *
 * The panel is a plain light-DOM child positioned with `position: fixed`, computed from the
 * input's bounding rect. `fixed` escapes any ancestor's `overflow: hidden`/`auto` clipping
 * (routed-page containers, `ui5-dialog` content areas) and paints above UI5's own popup
 * layer without needing a body-portaled overlay to fight its self-assigned z-index.
 */
@Component({
  selector: 'app-server-dropdown',
  standalone: true,
  imports: [CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './server-dropdown.component.html',
})
export class ServerDropdownComponent implements OnChanges, OnDestroy {
  /** OData/REST endpoint, e.g. 'Employees' */
  @Input() url = '';
  /** true = /odata/*, false = /api/* */
  @Input() odata = true;
  /** Fields searched server-side, dot notation converted to '/' for nav properties */
  @Input() searchFields: string[] = [];
  /** Extra static OData $filter clause ANDed with the search clause */
  @Input() filterQuery = '';
  @Input() pageSize = 20;
  @Input() placeholder = '';
  @Input() disabled = false;
  /** Current display text shown in the input (single-select mode) */
  @Input() value = '';
  /** Builds the label shown for each item; defaults to item.name */
  @Input() labelFn: (item: any) => string = (item) => item?.name ?? '';
  /** Field holding each item's unique id; used to match/toggle selection */
  @Input() valueField = 'id';
  /** Enables checkbox multi-select instead of single-value select */
  @Input() multiple = false;
  /** Already-selected items (multi-select mode) — controlled by the parent */
  @Input() selectedItems: any[] = [];

  /** Single-select mode: emits the selected item (or null on clear). */
  @Output() selectionChange = new EventEmitter<any>();
  /** Multi-select mode: emits the full updated array of selected items. */
  @Output() selectionListChange = new EventEmitter<any[]>();

  items: any[] = [];
  loading = false;
  loadingMore = false;
  open = false;
  hasSearched = false;
  searchText = '';

  /** Fixed-position coords for the light-DOM panel — computed from the input's bounding
   * rect so the panel escapes any ancestor's `overflow` clipping instead of being cropped
   * by it, the way an `absolute`-positioned descendant would be. */
  panelStyle: { top?: string; bottom?: string; left: string; width: string } = { top: '0px', left: '0px', width: '0px' };
  /** Caps the scrollable item list so the panel never runs off the top/bottom of the
   * viewport — mirrors how UI5's own Popup flips/shrinks against available space. */
  panelMaxHeight = 420;

  private hasMore = true;
  private skip = 0;
  private term = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private sentinelObserver?: IntersectionObserver;

  @ViewChild('inputWrapper', { static: true }) inputWrapper!: ElementRef<HTMLElement>;

  @ViewChild('sentinel')
  set sentinelEl(el: ElementRef<HTMLElement> | undefined) {
    this.sentinelObserver?.disconnect();
    if (!el) return;
    this.sentinelObserver = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        this.ngZone.run(() => this.loadMore());
      }
    });
    this.sentinelObserver.observe(el.nativeElement);
  }

  constructor(
    private commonService: CommonService,
    private ngZone: NgZone,
    private host: ElementRef<HTMLElement>,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['url'] || changes['filterQuery']) {
      this.items = [];
      this.hasSearched = false;
    }
    if (changes['disabled'] && this.disabled) this.closePanel();
  }

  ngOnDestroy(): void {
    this.sentinelObserver?.disconnect();
    this.detachRepositioning();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open && !this.host.nativeElement.contains(event.target as Node)) {
      this.closePanel();
    }
  }

  private openPanel(): void {
    this.open = true;
    this.updatePanelPosition();
    this.attachRepositioning();
  }

  private closePanel(): void {
    this.open = false;
    this.detachRepositioning();
  }

  private updatePanelPosition = (): void => {
    const rect = this.inputWrapper.nativeElement.getBoundingClientRect();
    const gap = 4;
    const margin = 8;
    const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
    const spaceAbove = rect.top - gap - margin;
    const preferBelow = spaceBelow >= 150 || spaceBelow >= spaceAbove;

    this.panelMaxHeight = Math.max(120, Math.min(420, preferBelow ? spaceBelow : spaceAbove));
    this.panelStyle = preferBelow
      ? { top: `${rect.bottom + gap}px`, left: `${rect.left}px`, width: `${rect.width}px` }
      : { bottom: `${window.innerHeight - rect.top + gap}px`, left: `${rect.left}px`, width: `${rect.width}px` };
  };

  /** Window-level scroll (capture phase, so it also catches scrolling inside a scrollable
   * ancestor, e.g. a dialog's content area) and resize keep the fixed-position panel glued
   * to the input. */
  private attachRepositioning(): void {
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onViewportChange, true);
      window.addEventListener('resize', this.onViewportChange);
    });
  }

  private detachRepositioning(): void {
    window.removeEventListener('scroll', this.onViewportChange, true);
    window.removeEventListener('resize', this.onViewportChange);
  }

  private onViewportChange = (): void => {
    if (!this.open) return;
    this.ngZone.run(() => this.updatePanelPosition());
  };

  onInput(event: Event): void {
    const target = event.target as any;
    const typed = target?.value ?? '';
    this.openPanel();
    this.loading = true;
    if (this.multiple) {
      this.searchText = typed;
    } else {
      this.value = typed;
    }
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.search(typed), 300);
  }

  /** The list opens only from the arrow (or by typing), never on plain focus. Opening lists the
   * first page straight away, and re-fetches when the last load was a filtered search so
   * reopening never shows a stale result set for a cleared term. */
  toggleList(): void {
    if (this.disabled) return;
    if (this.open) {
      this.closePanel();
      return;
    }
    this.openPanel();
    if (this.multiple) this.searchText = '';
    if (!this.hasSearched || this.term) this.search('');
  }

  selectItem(item: any): void {
    if (this.multiple) {
      this.toggleItem(item);
      return;
    }
    this.value = this.labelFn(item);
    this.selectionChange.emit(item);
    this.closePanel();
  }

  isSelected(item: any): boolean {
    return this.selectedItems.some((selected) => selected[this.valueField] === item[this.valueField]);
  }

  private toggleItem(item: any): void {
    const updated = this.isSelected(item)
      ? this.selectedItems.filter((selected) => selected[this.valueField] !== item[this.valueField])
      : [...this.selectedItems, item];
    this.selectedItems = updated;
    this.selectionListChange.emit(updated);
  }

  get displayValue(): string {
    if (this.multiple) {
      if (this.open) return this.searchText;
      if (!this.selectedItems.length) return '';
      if (this.selectedItems.length === 1) return this.labelFn(this.selectedItems[0]);
      return `${this.selectedItems.length} selected`;
    }
    return this.value;
  }

  get hasValue(): boolean {
    return this.multiple ? this.selectedItems.length > 0 : !!this.value;
  }

  /** Single-select only: the icon toggles between "open" (arrow) and "clear" (decline) once a
   * value is picked. Multi-select has no such toggle — the icon must stay the arrow so the panel
   * can always be reopened to add more; removing entries is done per-item via their checkbox. */
  get showClearIcon(): boolean {
    return !this.multiple && this.hasValue;
  }

  clearValue(): void {
    if (this.disabled) return;
    this.value = '';
    this.searchText = '';
    this.selectedItems = [];
    this.selectionChange.emit(null);
    this.selectionListChange.emit([]);
  }

  private loadMore(): void {
    if (this.loading || this.loadingMore || !this.hasMore) return;
    this.loadingMore = true;
    this.fetchPage();
  }

  private search(term: string): void {
    this.term = term;
    this.skip = 0;
    this.items = [];
    this.hasMore = true;
    this.loading = true;
    this.hasSearched = true;
    this.fetchPage();
  }

  private fetchPage(): void {
    if (!this.url) return;
    this.commonService.get(this.buildUrl(), this.odata).subscribe({
      next: (res: any) => {
        const page: any[] = Array.isArray(res) ? res : (res?.value ?? res?.data ?? []);
        this.items = [...this.items, ...page];
        this.hasMore = page.length === this.pageSize;
        this.skip += this.pageSize;
        this.loading = false;
        this.loadingMore = false;
      },
      error: () => {
        this.hasMore = false;
        this.loading = false;
        this.loadingMore = false;
      },
    });
  }

  private buildUrl(): string {
    const filters: string[] = [];
    if (this.filterQuery) filters.push(this.filterQuery);

    const term = this.term.trim().toLowerCase().replace(/'/g, "''");
    if (term && this.searchFields.length) {
      const clause = this.searchFields
        .map((field) => `contains(tolower(${field.replace(/\./g, '/')}),'${term}')`)
        .join(' or ');
      filters.push(`(${clause})`);
    }

    const query = [`$top=${this.pageSize}`, `$skip=${this.skip}`, '$orderby=id asc'];
    if (filters.length) query.push(`$filter=${filters.join(' and ')}`);

    return `${this.url}?${query.join('&')}`;
  }
}
