import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { Localization } from '@app/shared/utilities/localization';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  AgGridTableDisplayConfig,
  GridTableColumnDataType,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import moment from 'moment';

@Component({
  selector: 'app-purchese-home',
  templateUrl: './purchese-home.component.html',
  styleUrl: './purchese-home.component.scss',
})
export class PurcheseHomeComponent implements OnInit {
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();

  IsLoading = false;
  permissions: { [key: string]: boolean } = {};
  moment = moment;
  CountArray: any[] = [];
  SuppliersList: any[] = [];
  DepartmentList: any[] = [];
  selectedDeptId: any = null;
  selectedSupplierId: any = null;
  selectedDeptText = '';
  selectedSupplierText = '';
  start = moment().subtract(90, 'days').format('YYYY-MM-DD');
  end = moment().add(0, 'days').format('YYYY-MM-DD');
  momentInstance = moment;
  currentDate = moment().format('DD-MM-YYYY');
  dateRangeValue = '';
  purchaseInfo: any = {};
  pieChartInfo: any[] = [];
  departmentDistribution: Array<{ department_name: string; percentage: number }> = [];
  public barChartInfo: any[] = [];
  public localization = Localization;
  showFilter = false;

  latestPOColumns: AgGridTableColumn<any>[] = [
    {
      field: 'custom_id',
      headerName: $localize`Item Code`,
      width: 140,
    },
    {
      field: 'department_name',
      headerName: $localize`Department Name`,
      flex: 1,
    },
    {
      field: 'supplier_name',
      headerName: $localize`Supplier Name`,
      flex: 1,
    },
    {
      field: 'amount',
      headerName: $localize`Amount`,
      width: 110,
      dataType: GridTableColumnDataType.Number,
    },
  ];

  latestPODataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };

  latestPOToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Latest PO`,
    showSearch: true,
    showNewButton: false,
    showDownload: false,
    showSegmentButton: false,
  };

  latestPODisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(35vh - 56px)',
  };

  constructor(
    private commonServices: CommonService,
    private rolePermissionService: RolePermissionService,
  ) {}

  ngOnInit(): void {
    this.permissions = this.rolePermissionService.getAllPermissionsStatus();
    this.dateRangeValue = `${moment(this.start).format('DD/MM/YYYY')} - ${moment(this.end).format('DD/MM/YYYY')}`;
    this.getDepartments();
    this.getSuppliers();
    this.initPurchaseInfo();
    this.loadStaticBarData();
  }

  loadStaticBarData(): void {
    this.barChartInfo = [
      {
        label: 'Monthly Purchases',
        data: [
          { x: 'Aug', y: 450 },
          { x: 'Sep', y: 1200 },
          { x: 'Oct', y: 800 },
          { x: 'Nov', y: 1500 },
          { x: 'Dec', y: 3800 },
          { x: 'Jan', y: 600 },
        ],
      },
    ];
  }

  initPurchaseInfo(): void {
    let url = `purchase/analysis-data?startDate=${this.start}&endDate=${this.end}`;
    if (this.selectedDeptId) url += `&department_id=${this.selectedDeptId}`;
    if (this.selectedSupplierId) url += `&supplier_id=${this.selectedSupplierId}`;
    this.commonServices
      .get(url, false)
      .subscribe({
        next: (res: any) => {
          this.purchaseInfo = res.data;
          this.intPieChartInfo(res.data.department_wise_total);
        },
        error: () => {},
      });
  }

  intPieChartInfo(data: any): void {
    const source = Array.isArray(data) ? data : Object.values(data || {});
    const normalized = source.map((items: any) => ({
      department_name: items?.department_name ?? items?.name ?? '',
      percentage: Number(items?.percentage ?? items?.total_amount ?? 0) || 0,
    }));

    this.departmentDistribution = normalized.filter(item => item.department_name && item.percentage > 0);
    this.pieChartInfo = normalized;
    this.syncLatestPOGrid();
    this.refreshTable.emit();
  }

  syncLatestPOGrid(): void {
    this.latestPODataSource = {
      ...this.latestPODataSource,
      data: [...(this.purchaseInfo.latest_pos ?? [])],
    };
  }

  getSuppliers(): void {
    this.IsLoading = true;
    this.commonServices.get('Suppliers', true).subscribe((res: any) => {
      this.SuppliersList = res.value;
      this.IsLoading = false;
    });
  }

  getDepartments(): void {
    this.IsLoading = true;
    this.commonServices.get('Departments', true).subscribe((res: any) => {
      this.DepartmentList = res.value;
      this.IsLoading = false;
    });
  }

  onDepartmentChange(event: any): void {
    const item = event.detail?.item;
    if (item) {
      this.selectedDeptId = item.additionalText || item.value || null;
      this.selectedDeptText = item.text || '';
    }
  }

  onSupplierChange(event: any): void {
    const item = event.detail?.item;
    if (item) {
      this.selectedSupplierId = item.additionalText || item.value || null;
      this.selectedSupplierText = item.text || '';
    }
  }

  dateRangePickerChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    if (!value) return;
    const [startDate, endDate] = value.split(' - ');
    this.start = moment.utc(startDate, 'DD/MM/YYYY').startOf('day').format('YYYY-MM-DD');
    this.end = moment.utc(endDate, 'DD/MM/YYYY').endOf('day').format('YYYY-MM-DD');
    this.dateRangeValue = value;
  }

  dateRangeFlter(): void {
    if (!this.start || !this.end) return;
    this.refreshTable.emit();
    this.applyFilter();
  }

  applyFilter(): void {
    this.initPurchaseInfo();
    this.toggleFilter();
  }

  toggleFilter(): void {
    this.showFilter = !this.showFilter;
  }

  resetFilter(): void {
    this.start = moment().subtract(90, 'days').format('YYYY-MM-DD');
    this.end = moment().format('YYYY-MM-DD');
    this.dateRangeValue = `${moment(this.start).format('DD/MM/YYYY')} - ${moment(this.end).format('DD/MM/YYYY')}`;
    this.selectedDeptId = null;
    this.selectedSupplierId = null;
    this.selectedDeptText = '';
    this.selectedSupplierText = '';
    this.initPurchaseInfo();
  }

  openModal(_event: any): void {}
}
