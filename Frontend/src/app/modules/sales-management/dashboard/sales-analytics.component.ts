import { CommonModule, DatePipe } from '@angular/common';
import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { Router } from '@angular/router';
import { CommonService } from '@app/services/common-service/common.service';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { ActivityLog } from '@app/shared/model/activitylog';
import { Localization } from '@shared/utilities/localization';
import moment from 'moment';
import { SalesStatus } from '@sales-module/shared/enums/sales-status';
import { statusStyles } from '@app/shared/utilities/statusStyles';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  AgGridTableDisplayConfig,
  GridTableColumnDataType,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { DateFormatterService } from '@app/shared/utilities/date-format';
@Component({
  selector: 'app-hrm-dashboard',
  templateUrl: './sales-analytics.component.html',
  styleUrl: './sales-analytics.component.scss',
})
export class SalesDashboard implements OnInit {
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();

  latestOrdersDataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };
  overdueDataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };
  latestOrdersToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Latest Orders`,
    showNewButton: false,
    showSearch: true,
    showRowCount: false,
    showSegmentButton: false,
    showDownload: false,
  };
  overdueToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Overdue Orders`,
    showNewButton: false,
    showSearch: true,
    showRowCount: false,
    showSegmentButton: false,
    showDownload: false,
  };
  ordersDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: '50vh',
    fillEmptyRows: true,
  };

  monthlySales: any[] = [];
  donutColors: string[] = [];
  expenseBreakdown: any[] = [];
  topClients: any[] = [];
  overdueOrders: any[] = [];
  status = Object.values(SalesStatus);
  kpiData = {
    totalOrders: 0,
    totalSales: 0,
    totalRejection: 0,
    totalOrderAmount: 0,
    totalApprovedAmount: 0,
    totalDraftAmount: 0,
  };
  showFilter: boolean = false;
  localization = Localization;
  moment = moment;
  clientList: any[] = [];
  selectedClientId: number | null = null;
  statusTitle: string = '';
  SalesStatus = Object.values(SalesStatus);
  isStatusReadOnly: boolean = false;
  start = moment().subtract(90, 'days').format('DD-MM-YYYY');
  end = moment().format('DD-MM-YYYY');
  currentDate = moment().format('DD-MM-YYYY');
  dateRangeValue: string = '';
  loading: boolean = false;
  model = 'App\\Models\\SalesOrder';
  auditLoading: boolean = false;
  activityLogs: ActivityLog[] = [];
  odata: boolean;
  api: boolean;
  itemList: any[] = [];
  marketAnalysisData: any[] = [];
  selectedMarketItemId: string | null = null;
  filteredTopClients: any[] = [];
  clientSearchText: string = '';
  isClientSearchOpen: boolean = false;
  statusColors: { [key: string]: string } = {
    APPROVED: '#10B981',
    REJECTED: '#EF4444',
    PENDING: '#FBBF24',
    DRAFT: '#3B82F6',
  };

  constructor(
    private commonServices: CommonService,
    private rolePermissionService: RolePermissionService,
    private datePipe: DatePipe,
    private toastService: ToastService,
    private dateFormatter: DateFormatterService,
  ) {
    this.odata = this.commonServices.odata;
    this.api = this.commonServices.api;
  }

  ngOnInit(): void {
    this.setDefaultDateRange();
    this.getClients();
    this.getProductList();
    this.fetchDashboardData();
    this.getInitialActiveLog();
  }

  setDefaultDateRange() {
    const end = moment();
    const start = moment().startOf('month').subtract(5, 'months');
    this.start = start.format('YYYY-MM-DD');
    this.end = end.format('YYYY-MM-DD');
    this.dateRangeValue = `${start.format('DD/MM/YYYY')} - ${end.format(
      'DD/MM/YYYY',
    )}`;
  }

  fetchDashboardData() {
    this.loading = true;
    let backendStatus = this.mapStatusToBackend(this.statusTitle);

    let queryParams = `startDate=${this.start}&endDate=${this.end}`;
    if (this.selectedClientId)
      queryParams += `&clientId=${this.selectedClientId}`;
    if (backendStatus) queryParams += `&status=${backendStatus}`;

    this.commonServices
      .get(`sales/analytics-data?${queryParams}`, false)
      .subscribe({
        next: (res: any) => {
          if (res.success) {
            const data = res.data;
            this.kpiData = {
              totalOrders: data.kpi.total_orders,
              totalSales: data.kpi.total_sales,
              totalRejection: data.kpi.total_rejection,
              totalOrderAmount: data.kpi.total_order_amount,
              totalApprovedAmount: data.kpi.total_approved_amount,
              totalDraftAmount: data.kpi.total_draft_amount,
            };

            this.monthlySales = [...data.charts.monthly_sales];
            this.topClients = (data.top_clients || []).map((client: any) => ({
              ...client,
              initials: client.initials || this.getInitials(client.name),
            }));

            this.filteredTopClients = [...this.topClients];
            this.overdueOrders = data.overdue_orders || [];
            this.overdueDataSource = {
              ...this.overdueDataSource,
              data: this.overdueOrders,
            };
            const rawBreakdown = data.charts.status_breakdown || [];
            this.expenseBreakdown = (rawBreakdown || []).map((item: any) => {
              return {
                ...item,
                category: item.category,
                color: this.statusColors[item.category.toUpperCase()],
              };
            });
            this.donutColors = this.expenseBreakdown.map((item) => item.color);

            this.latestOrdersDataSource = {
              ...this.latestOrdersDataSource,
              data: data.latest_orders || [],
            };
          }
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
        },
      });
  }

  mapStatusToBackend(displayStatus: string): SalesStatus | '' {
    if (!displayStatus) return '';

    const status = displayStatus.toUpperCase().trim();

    switch (status) {
      case SalesStatus.APPROVED:
        return SalesStatus.APPROVED;

      case SalesStatus.REJECTED:
        return SalesStatus.REJECTED;

      case SalesStatus.DRAFT:
        return SalesStatus.DRAFT;

      case SalesStatus.PENDING:
        return SalesStatus.PENDING;

      default:
        return '';
    }
  }

  latestOrderColumns: AgGridTableColumn<any>[] = [
    {
      field: 'custom_id',
      headerName: $localize`Order No`,
      minWidth: 120,
      flex: 1,
    },
    {
      colId: 'client_name',
      headerName: $localize`Client`,
      minWidth: 150,
      flex: 1,
      valueGetter: (params: any) => params.data?.client?.name ?? '',
    },
    {
      field: 'status',
      headerName: $localize`Status`,
      minWidth: 120,
      filter: false,
      cellRenderer: (params: any) => this.renderStatusCell(params.value),
    },
    {
      field: 'subtotal',
      headerName: $localize`Amount`,
      minWidth: 110,
      dataType: GridTableColumnDataType.Number,
    },
  ];

  overdueOrderColumns: AgGridTableColumn<any>[] = [
    {
      field: 'custom_id',
      headerName: $localize`Order No`,
      minWidth: 120,
      flex: 1,
    },
    {
      colId: 'client_name',
      headerName: $localize`Client`,
      minWidth: 150,
      flex: 1,
      valueGetter: (params: any) => params.data?.client?.name ?? '',
    },
    {
      field: 'expected_delivery_date',
      headerName: $localize`Delivery Date`,
      minWidth: 140,
      filter: false,
      valueFormatter: (params: any) =>
        this.dateFormatter.formatDate(
          params.value,
          true,
          false,
          false,
          false,
          false,
        ),
    },
    {
      field: 'status',
      headerName: $localize`Status`,
      minWidth: 120,
      filter: false,
      cellRenderer: (params: any) => this.renderStatusCell(params.value),
    },
    {
      field: 'subtotal',
      headerName: $localize`Amount`,
      minWidth: 110,
      dataType: GridTableColumnDataType.Number,
    },
  ];

  private renderStatusCell(value: any): string {
    const s = value || 'DRAFT';
    const st =
      statusStyles[s] ||
      statusStyles['disconnected'] ||
      ({ backgroundColor: '', label: '' } as any);
    const bg = st.backgroundColor || '#e0e0e0';
    const label = st.label || value || 'Unknown';
    return `<div style="min-width:90px;height:25px;border-radius:5px;background:${bg};display:flex;justify-content:center;align-items:center;text-transform:uppercase"><span style="color:black;font-weight:500;font-size:.8rem">${label}</span></div>`;
  }

  toggleFilter() {
    this.showFilter = !this.showFilter;
  }

  applyFilter() {
    this.loading = true;
    setTimeout(() => {
      this.fetchDashboardData();
      this.getInitialActiveLog();
      this.fetchMarketAnalysis();
      this.showFilter = false;
      this.loading = false;
    }, 500);
  }

  dateRangePickerChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    if (!value) return;

    const [startStr, endStr] = value.split(' - ');
    const start = moment(startStr, 'DD/MM/YYYY');
    const end = moment(endStr, 'DD/MM/YYYY');

    this.start = start.format('YYYY-MM-DD');
    this.end = end.format('YYYY-MM-DD');
    this.dateRangeValue = value;
  }

  onMarketItemChange(event: any) {
    const item = event.detail.item;
    this.selectedMarketItemId = item ? item.getAttribute('id') : null;
  }

  fetchMarketAnalysis() {
    if (!this.selectedMarketItemId) return;

    this.loading = true;

    const queryParams = `product_id=${this.selectedMarketItemId}&start_date=${this.start}&end_date=${this.end}`;

    this.commonServices
      .get(`sales/market-prices?${queryParams}`, false)
      .subscribe({
        next: (res: any) => {
          if (res.success) {
            this.marketAnalysisData = res.data;
          }
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  getProductNameById(id: any): string {
    const product = this.itemList.find((item) => item.id == id);
    return product ? product.product_name : '';
  }

  getProductList() {
    this.commonServices
      .get('/Products?$filter=is_active eq true and is_sellable eq true', true)
      .subscribe({
        next: (res: any) => {
          this.itemList = res.value || res;
          if (this.itemList.length > 0 && !this.selectedMarketItemId) {
            this.selectedMarketItemId = this.itemList[0].id;
            this.fetchMarketAnalysis();
          }
        },
        error: (err) => console.error('Error fetching products:', err),
      });
  }

  getMarketPriceHistory() {
    this.commonServices.get('/MarketPrices', true).subscribe((res: any) => {
      this.itemList = res.value || [];
      if (this.itemList.length && !this.selectedMarketItemId) {
        this.selectedMarketItemId = this.itemList[0].id;
        this.fetchMarketAnalysis();
      }
    });
  }

  onClientChange(event: any) {
    const item = event.detail.item;
    this.selectedClientId = item ? item.id : null;
  }

  getClients() {
    this.commonServices.get('Clients', true).subscribe((res: any) => {
      this.clientList = res.value || res;
    });
  }

  toggleClientSearch() {
    this.isClientSearchOpen = !this.isClientSearchOpen;
    if (!this.isClientSearchOpen) {
      this.clientSearchText = '';
      this.filteredTopClients = [...this.topClients];
    }
  }

  filterTopClients() {
    const search = this.clientSearchText?.toLowerCase().trim();
    if (!search) {
      this.filteredTopClients = [...this.topClients];
      return;
    }
    this.filteredTopClients = this.topClients.filter(
      (c) =>
        c.name?.toLowerCase().includes(search) ||
        c.custom_id?.toLowerCase().includes(search),
    );
  }

  resetFilter() {
    this.setDefaultDateRange();
    this.selectedClientId = null;
    this.statusTitle = '';
    this.getInitialActiveLog();
    const datePicker: any = document.querySelector('ui5-daterange-picker');
    if (datePicker) datePicker.value = this.dateRangeValue;

    const clientCombo: any = document.querySelector(
      "ui5-combobox[placeholder='Select Client']",
    );
    if (clientCombo) clientCombo.value = '';

    const statusCombo: any = document.getElementById('status');
    if (statusCombo) statusCombo.value = '';
  }

  getInitials(name: string): string {
    const nameParts = name.split(' ');
    const firstNameInitial = nameParts[0].charAt(0).toUpperCase();
    const lastNameInitial =
      nameParts.length > 1 ? nameParts[1].charAt(0).toUpperCase() : '';
    return firstNameInitial + lastNameInitial;
  }

  formatDate(dateString: string): string {
    return this.datePipe.transform(dateString, 'dd/MM/yyyy HH:mm') || '';
  }

  getState(actionType: string): string {
    return actionType === 'delete' ? 'Critical' : 'Information';
  }

  getModelName(modelType: string | undefined): string {
    return modelType?.split('\\').pop() || 'Unknown Model';
  }

  getNotificationTitle(log: ActivityLog): string {
    const modelName = this.getModelName(log.model_type);
    if (log.action_type === 'insert') {
      return `New ${modelName} Added (ID: ${log.model_custom_id})`;
    } else if (log.action_type === 'delete') {
      return `${modelName} Deleted (ID: ${log.model_custom_id})`;
    } else {
      return `${modelName} Updated (ID: ${log.model_custom_id})`;
    }
  }

  getNotificationMessage(log: any): string {
    const modelName = this.getModelName(log.model_type);
    let statusText = '';
    let newStatus = this.getStatus(log);

    if (newStatus) {
      statusText = `to status "${newStatus}"`;
    } else {
      try {
        const oldValue = JSON.parse(log.old_value ?? '{}');
        const status = oldValue.status;
        if (status) {
          statusText = `(Previously "${status}")`;
        }
      } catch {}
    }

    const userName = log.user?.name || 'Unknown User';

    if (log.action_type === 'insert') {
      return `A new ${modelName} (${log.model_custom_id}) was created ${statusText} by ${userName}.`;
    } else if (log.action_type === 'delete') {
      return `The ${modelName} (${log.model_custom_id}) was deleted by ${userName}.`;
    } else {
      return `${modelName} (${log.model_custom_id}) was updated ${statusText} by ${userName}.`;
    }
  }

  onStatusChange(event: any) {
    this.statusTitle = event.detail.item.text;
  }

  getStatus(log: any) {
    try {
      const newValue = JSON.parse(log.new_value ?? '{}');
      return newValue.status ?? null;
    } catch {
      return null;
    }
  }

  getImportance(log: any) {
    return this.getStatus(log) === SalesStatus.DRAFT ? 'Important' : 'Standard';
  }

  RefreshLog() {
    this.auditLoading = true;
    this.getInitialActiveLog();
  }

  getInitialActiveLog() {
    this.auditLoading = true;

    let odataFilter = `model_type eq '${this.model}'`;

    if (this.start && this.end) {
      odataFilter += ` and created_at ge ${this.start}T00:00:00Z and created_at le ${this.end}T23:59:59Z`;
    }

    this.commonServices
      .get(
        `ActivityLogs?$expand=user&$filter=${odataFilter}&$orderby=created_at desc&$top=7`,
        true,
      )
      .subscribe({
        next: (response: any) => {
          this.activityLogs = response.value.map((item: any) =>
            (new ActivityLog() as any).deserialize(item),
          );
          this.auditLoading = false;
        },
        error: (error: any) => {
          console.error('Error fetching notifications:', error);
          this.auditLoading = false;
        },
      });
  }

  showAllLogs() {
    const url = 'base-data-management/activity-log';
    if (
      typeof window !== 'undefined' &&
      window.navigator &&
      window.navigator.userAgent
    ) {
      window.open(`/${url}`, '_blank');
    }
  }
}
