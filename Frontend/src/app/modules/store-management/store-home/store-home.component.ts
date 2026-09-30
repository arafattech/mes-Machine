import { Component, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { CommonService } from "@app/services/common-service/common.service";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { ThemeService } from "@app/services/theme.service";
import { LineChartSeriesConfig } from "@shared/components/shared-line-chart/shared-line-chart.component";
import moment from "moment";

@Component({
  selector: "app-store-home",
  templateUrl: "./store-home.component.html",
  styleUrl: "./store-home.component.scss",
})
export class StoreHomeComponent implements OnInit {
  IsLoading = false;
  pageLoading = true;
  readonly skeletonTiles = Array.from({ length: 4 });
  private pendingInitialLoads = 4;
  SuppliersList: any[] = [];
  DepartmentList: any[] = [];
  selectedDeptId: any = null;
  selectedSupplierId: any = null;
  selectedDeptText = '';
  selectedSupplierText = '';
  start = moment().subtract(90, "days").format("YYYY-MM-DD");
  end = moment().add(0, "days").format("YYYY-MM-DD");
  currentDate = moment().format("DD-MM-YYYY");
  dateRangeValue = "";
  purchaseInfo: any = {};

  monthlySales: { month: string; count: number; inbound_count: number; outbound_count: number }[] = [];
  dailyPurchases: { date: string; count: number }[] = [];
  srDepartmentWise: { department_name: string; total_requests: number; percentage: number }[] = [];
  mrrStatusBreakdown: { status: string; count: number }[] = [];
  srStatusBreakdown: { status: string; count: number }[] = [];
  returnMrrBreakdown: { type: string; count: number }[] = [];

  // Official SAP chart palette (sap_horizon --sapChart_OrderedColor_1..6) — used instead
  // of arbitrary hex colors so charts follow the active SAP theme's brand order.
  readonly sapChartColors = ['#0070f2', '#c87b00', '#75980b', '#df1278', '#8b47d7', '#049f9a'];

  // Purchase Trend overlay series — green/red are a deliberate in/out convention, not the SAP palette.
  // `app-shared-line-chart` always renders its own `valueField`/`lineColor` as the
  // primary line — so Inbound is wired as the primary (see template), and only
  // Outbound goes here as the overlay series. Together that's exactly the two lines
  // wanted on the Purchase Trend card, no third "total" line.
  readonly purchaseTrendSeries: LineChartSeriesConfig[] = [
    { valueField: 'outbound_count', color: '#ef4444', name: $localize`Outbound` },
  ];

  // Computed once per data refresh (not a getter) — a getter re-evaluated on every change
  // detection cycle returns a brand-new array of new objects each time, so *ngFor's default
  // identity check sees "all new" and destroys/recreates every tile (icon included) on each
  // CD tick, which reads as the icons flickering/blinking in.
  statTiles: { label: string; value: number; icon: string; iconBg: string; iconColor: string }[] = [];

  // Icon accent/background derived from sapChartColors (not an arbitrary Tailwind
  // palette) so the stat tiles read as the same SAP brand order as the charts below.
  // iconBg is the same color at ~10% alpha for the badge backdrop.
  private buildStatTiles(): void {
    this.statTiles = [
      { label: $localize`Total P/O`, value: this.purchaseInfo.total_purchases ?? 0, icon: 'horizontal-combination-chart', iconBg: `${this.sapChartColors[0]}1a`, iconColor: this.sapChartColors[0] },
      { label: $localize`Total Indent`, value: this.purchaseInfo.total_spr ?? 0, icon: 'list', iconBg: `${this.sapChartColors[1]}1a`, iconColor: this.sapChartColors[1] },
      { label: $localize`Orders Received`, value: this.purchaseInfo.received_orders ?? 0, icon: 'shipping-status', iconBg: `${this.sapChartColors[2]}1a`, iconColor: this.sapChartColors[2] },
      { label: $localize`Pending SR`, value: this.purchaseInfo.pending_sr ?? 0, icon: 'pending', iconBg: `${this.sapChartColors[4]}1a`, iconColor: this.sapChartColors[4] },
    ];
  }

  trackByLabel(_index: number, tile: { label: string }): string {
    return tile.label;
  }

  private markInitialLoadComplete(): void {
    this.pendingInitialLoads = Math.max(0, this.pendingInitialLoads - 1);
    if (this.pendingInitialLoads === 0) {
      this.pageLoading = false;
    }
  }

  latestPos: any[] = [];

  // Card borders read too high-contrast against the SAP border token at full
  // strength — color-mix() dims whatever --sapList_BorderColor resolves to by
  // 70%, so it stays theme-correct (light or dark) without hand-picking a
  // separate override color per theme.
  readonly cardBorderColor = 'color-mix(in srgb, var(--sapList_BorderColor, #d9d9d9) 30%, transparent)';

  // Dark-family themes (ThemeService.isDarkTheme(): Aurora Black/Obsidian
  // Black/Lunar Black) render our dimmed color-mix() border far too bold —
  // color-mix against a dark --sapList_BorderColor doesn't fall to the same
  // visual weight it does on light themes. Rather than fight it, these
  // themes skip our custom wrapper border entirely (goes transparent) and
  // keep ui5-card's own native border/shadow (`border-none shadow-none` is
  // dropped), so the card chrome is exactly what UI5 itself renders for that
  // theme instead of a custom override.
  useNativeCardChrome = false;

  constructor(
    private commonServices: CommonService,
    private rolePermissionService: RolePermissionService,
    private themeService: ThemeService,
  ) {
    this.updateCardChromeMode();
    this.themeService.theme$.pipe(takeUntilDestroyed()).subscribe(() => this.updateCardChromeMode());
  }

  private updateCardChromeMode(): void {
    this.useNativeCardChrome = this.themeService.isDarkTheme();
  }

  ngOnInit(): void {
    this.dateRangeValue = `${moment(this.start).format("DD/MM/YYYY")} - ${moment(this.end).format("DD/MM/YYYY")}`;
    this.getDepartments();
    this.getSuppliers();
    this.initPurchaseInfo();
    this.loadMrrStatusBreakdown();
    this.loadSrStatusBreakdown();
    this.loadReturnMrrBreakdown();
  }

  loadSrStatusBreakdown(): void {
    const filters: string[] = [
      `type eq 'SR'`,
      `request_date ge ${this.start}`,
      `request_date le ${this.end}`,
    ];
    if (this.selectedDeptId) filters.push(`department_id eq ${this.selectedDeptId}`);
    const filterQuery = `&$filter=${filters.join(' and ')}`;

    // SR's raw workflow states (SUBMITTED/APPROVED/FINAL_APPROVAL/REJECTED) collapse to
    // the three business-facing buckets the chart shows: SUBMITTED reads as PENDING (not
    // yet acted on), APPROVED and FINAL_APPROVAL both count as APPROVED.
    const statusLabel: { [key: string]: string } = {
      SUBMITTED: 'PENDING',
      APPROVED: 'APPROVED',
      FINAL_APPROVAL: 'APPROVED',
      REJECTED: 'REJECTED',
    };

    this.commonServices.get(`PurchaseRequisitions?$select=status${filterQuery}&$top=5000`, true).subscribe({
      next: (res: any) => {
        const counts = new Map<string, number>();
        (res.value ?? []).forEach((row: any) => {
          const status = statusLabel[row.status] ?? row.status ?? 'UNKNOWN';
          counts.set(status, (counts.get(status) ?? 0) + 1);
        });
        this.srStatusBreakdown = Array.from(counts, ([status, count]) => ({ status, count }));
        this.markInitialLoadComplete();
      },
      error: () => {
        this.srStatusBreakdown = [];
        this.markInitialLoadComplete();
      },
    });
  }

  loadReturnMrrBreakdown(): void {
    const filters: string[] = [
      `return_date ge ${this.start}`,
      `return_date le ${this.end}`,
    ];
    if (this.selectedDeptId) filters.push(`materialReceipt/department_id eq ${this.selectedDeptId}`);
    if (this.selectedSupplierId) filters.push(`materialReceipt/supplier_id eq ${this.selectedSupplierId}`);
    const filterQuery = `&$filter=${filters.join(' and ')}`;

    this.commonServices.get(`MrrReturns?$select=return_type${filterQuery}&$top=5000`, true).subscribe({
      next: (res: any) => {
        const counts = new Map<string, number>();
        (res.value ?? []).forEach((row: any) => {
          const type = row.return_type ?? 'UNSPECIFIED';
          counts.set(type, (counts.get(type) ?? 0) + 1);
        });
        this.returnMrrBreakdown = Array.from(counts, ([type, count]) => ({ type, count }));
        this.markInitialLoadComplete();
      },
      error: () => {
        this.returnMrrBreakdown = [];
        this.markInitialLoadComplete();
      },
    });
  }

  loadMrrStatusBreakdown(): void {
    const filters: string[] = [
      `receipt_date ge ${this.start}`,
      `receipt_date le ${this.end}`,
    ];
    if (this.selectedDeptId) filters.push(`department_id eq ${this.selectedDeptId}`);
    if (this.selectedSupplierId) filters.push(`supplier_id eq ${this.selectedSupplierId}`);
    const filterQuery = `&$filter=${filters.join(' and ')}`;

    this.commonServices.get(`MaterialReceipts?$select=status${filterQuery}&$top=5000`, true).subscribe({
      next: (res: any) => {
        const counts = new Map<string, number>();
        (res.value ?? []).forEach((row: any) => {
          const status = row.status ?? 'UNKNOWN';
          counts.set(status, (counts.get(status) ?? 0) + 1);
        });
        this.mrrStatusBreakdown = Array.from(counts, ([status, count]) => ({ status, count }));
        this.markInitialLoadComplete();
      },
      error: () => {
        this.mrrStatusBreakdown = [];
        this.markInitialLoadComplete();
      },
    });
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
          this.buildStatTiles();
          this.latestPos = res.data?.latest_pos ?? [];
          this.monthlySales = (res.data?.monthly_trends ?? []).map((item: any) => ({
            month: moment(item.month, "YYYY-MM-DD").format("DD MMM"),
            count: item.order_count,
            inbound_count: item.inbound_count ?? 0,
            outbound_count: item.outbound_count ?? 0,
          }));
          this.dailyPurchases = (res.data?.monthly_trends ?? []).map((item: any) => ({
            date: item.month,
            count: item.order_count,
          }));
          this.srDepartmentWise = (res.data?.sr_department_wise ?? []).filter((item: any) => (item.percentage ?? 0) > 0);
          this.markInitialLoadComplete();
        },
        error: () => {
          this.markInitialLoadComplete();
        },
      });
  }

  getSuppliers(): void {
    this.IsLoading = true;
    this.commonServices.get("Suppliers", true).subscribe((res: any) => {
      this.SuppliersList = res.value;
      this.IsLoading = false;
    });
  }

  getDepartments(): void {
    this.IsLoading = true;
    this.commonServices.get("Departments", true).subscribe((res: any) => {
      this.DepartmentList = res.value;
      this.IsLoading = false;
    });
  }

  onDepartmentChange(event: any): void {
    const item = event.detail?.item;
    if (item) {
      this.selectedDeptId = item.additionalText || null;
      this.selectedDeptText = item.text || '';
    }
  }

  onSupplierChange(event: any): void {
    const item = event.detail?.item;
    if (item) {
      this.selectedSupplierId = item.additionalText || null;
      this.selectedSupplierText = item.text || '';
    }
  }

  dateRangePickerChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    if (!value) return;
    const [startDate, endDate] = value.split(" - ");
    this.start = moment.utc(startDate, "DD/MM/YYYY").startOf("day").format("YYYY-MM-DD");
    this.end = moment.utc(endDate, "DD/MM/YYYY").endOf("day").format("YYYY-MM-DD");
    this.dateRangeValue = value;
  }

  applyFilter(): void {
    this.initPurchaseInfo();
    this.loadMrrStatusBreakdown();
    this.loadSrStatusBreakdown();
    this.loadReturnMrrBreakdown();
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
    this.loadMrrStatusBreakdown();
    this.loadSrStatusBreakdown();
    this.loadReturnMrrBreakdown();
  }
}
