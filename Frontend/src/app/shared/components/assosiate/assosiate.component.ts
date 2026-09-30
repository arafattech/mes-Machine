import { CommonService } from '@app/services/common-service/common.service';
import { CommonModule } from '@angular/common';
import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import {
  ListComponent,
  ListItemStandardComponent,
} from '@ui5/webcomponents-ngx';
import { FormsModule } from '@angular/forms';
import { Localization } from '@shared/utilities/localization';

@Component({
  selector: 'app-assosiate',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ListComponent,
    ListItemStandardComponent,
  ],
  templateUrl: './assosiate.component.html',
  styleUrl: './assosiate.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AssosiateComponent implements OnInit {
  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;
  @Output() close: EventEmitter<void> = new EventEmitter<void>();
  @Input() isOpen: EventEmitter<void> = new EventEmitter<void>();
  @Input() apiUrl: string = '';
  @Input() orderByColumn: string = 'created_at';
  @Input() openModal: boolean = false;
  @Output() dataSent = new EventEmitter<any>();
  @Output() selectedData: EventEmitter<any> = new EventEmitter();
  @Output() openDialog: EventEmitter<any> = new EventEmitter();
  @Input() getAssociateData: EventEmitter<any> = new EventEmitter();
  @Input() isMultiselect: boolean = true;
  @Input() isAddMore: boolean = false;
  @Output() addClicked = new EventEmitter<void>();
  @Output() IsInsert = new EventEmitter<any>();
  @Output() IsInsertCategory = new EventEmitter<any>();
  @Output() RefreshTable = new EventEmitter<any>();
  @Input() model: any;
  @Input() tableColumn: any;
  @Input() filterQuery: any;
  isOdata: boolean = true;
  loading: boolean = false;
  open: boolean = false;
  bindingData: any[] = [];
  Selectall: boolean = false;
  GetAssociateData: any[] = [];
  public localization = Localization;
  offset = 0;
  limit = 40;
  searchFilter: string = '';
  constructor(private CommonService: CommonService) {
    this.model = new Object();
  }
  private debounceTimeout: any = null;
  ngOnInit(): void {
    this.isOpen.subscribe(() => {
      this.open = true;
      this.offset = 0;
      this.GetAssociateData = [];
      this.resetSearch();
    });

    this.getAssociateData.subscribe((data: any) => {
      this.bindingData = data;
    });
  }

  onAddClick() {
    switch (this.apiUrl) {
      case 'ProductTypes?':
        this.IsInsert.emit();
        return;
      case 'ItemCategories?':
        this.IsInsertCategory.emit();
        return;
    }
  }

  onRefreshTable() {
    this.offset = 0;
    this.GetAssociateData = [];
    if (this.searchFilter) {
      this.filterData(this.searchFilter);
    } else {
      this.getInitialData();
    }
  }

  getInitialData() {
    this.loading = true;

    let queryParams: string[] = [];

    if (this.filterQuery) {
      queryParams.push(`$filter=${this.filterQuery}`);
    }

    queryParams.push(`$skip=${this.offset}`);
    queryParams.push(`$top=${this.limit}`);
    queryParams.push(`$orderby=${this.orderByColumn} desc`);

    const url = `${this.apiUrl}&${queryParams.join('&')}`;

    this.CommonService.get(url, true).subscribe({
      next: (response: any) => {
        if (Array.isArray(response.value)) {
          const data = response.value.map((item: any) =>
            new this.model().deserialize(item)
          );

          this.GetAssociateData = [...this.GetAssociateData, ...data];
          this.offset += this.limit;
        } else {
          console.error('Expected an array, but got:', response.value);
        }

        this.loading = false;
      },
      error: (error: any) => {
        this.loading = false;
        console.error(error);
      },
    });
  }

  onScroll(event: any) {
    if (this.searchFilter !== '') {
      this.filterData(this.searchFilter);
    } else {
      this.getInitialData();
    }
  }

  isSelected(item: any): boolean {
    if (this.bindingData && this.bindingData.length > 0) {
      return !!(
        item != null &&
        item.id !== undefined &&
        this.GetAssociateData &&
        this.bindingData.some((data) => data.id === item.id)
      );
    } else {
      return false;
    }
  }

  handleSearch(event: any) {
    clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(() => {
      const filter = event.target.value.toString();
      this.searchFilter = filter;
      this.filterData(filter);
    }, 400);
  }

  filterData(filter: string) {
    this.offset = 0;
    this.loading = true;
    this.searchFilter = filter;

    const filters: string[] = [];

    if (filter) {
      this.tableColumn.forEach((column: any) => {
        if (
          column.accessor &&
          column.accessor !== '.' &&
          column.accessor !== 'id' &&
          column.accessor.trim() !== ''
        ) {
          filters.push(`contains(${column.accessor}, '${filter}')`);
        }
      });
    }

    let finalFilter = '';

    if (filters.length && this.filterQuery) {
      finalFilter = `(${filters.join(' or ')}) and ${this.filterQuery}`;
    } else if (filters.length) {
      finalFilter = filters.join(' or ');
    } else if (this.filterQuery) {
      finalFilter = this.filterQuery;
    }

    const filterParam = finalFilter ? `&$filter=${finalFilter}` : '';
    const orderBy = '&$orderby=created_at desc';

    const apiUrl = `${this.apiUrl}${filterParam}&$skip=${this.offset}&$top=${this.limit}${orderBy}`;

    let url = '';
    if (this.isOdata) {
      url = apiUrl;
    } else {
      url = `${this.apiUrl}/${this.limit}/${this.offset}?filter=${filter}`;
    }

    console.log('filter url', url);
    this.CommonService.get(url, this.isOdata).subscribe({
      next: (response: any) => {
        const data = response.value.map((item: any) =>
          new this.model().deserialize(item)
        );

        this.GetAssociateData = data;
        this.offset += this.limit;
        this.loading = false;
      },
      error: (error: any) => {
        this.loading = false;
      },
    });
  }

  SelectionChange($event: any) {
    const visibleIds = new Set(
      this.GetAssociateData.map((item: any) => item.id)
    );
    const selectedVisible = $event.detail.selectedItems.map(
      (item: any) => item.value
    );
    const keptFromOutsideVisible = this.bindingData.filter(
      (item: any) => !visibleIds.has(item.id)
    );
    this.bindingData = [...keptFromOutsideVisible, ...selectedVisible];
  }

  SelectAll() {
    this.Selectall = false;
    setTimeout(() => {
      this.Selectall = true;
    }, 100);

    const visibleIds = new Set(
      this.GetAssociateData.map((item: any) => item.id)
    );
    const keptFromOutsideVisible = this.bindingData.filter(
      (item: any) => !visibleIds.has(item.id)
    );
    this.bindingData = [...keptFromOutsideVisible, ...this.GetAssociateData];
  }

  DselectAll() {
    this.Selectall = false;
    const visibleIds = new Set(
      this.GetAssociateData.map((item: any) => item.id)
    );
    this.bindingData = this.bindingData.filter(
      (item: any) => !visibleIds.has(item.id)
    );
  }

  Assign() {
    this.selectedData.emit(this.bindingData);
    this.closeDialog();
  }

  closeDialog() {
    this.open = false;
    this.Selectall = false;
    this.bindingData = [];
    this.resetSearch();
  }

  private resetSearch(): void {
    clearTimeout(this.debounceTimeout);
    this.searchFilter = '';
    if (this.searchInputRef?.nativeElement) {
      this.searchInputRef.nativeElement.value = '';
    }
  }
}
