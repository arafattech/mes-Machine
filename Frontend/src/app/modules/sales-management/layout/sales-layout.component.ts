import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from "@angular/router";
import { CommonService } from "@app/services/common-service/common.service";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { ToastService } from "@app/services/toast-service/toast.service";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  GridTableColumnDataType,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { Localization } from "@app/shared/utilities/localization";
import {
  SideNavigationComponent,
  SideNavigationGroupComponent,
  SideNavigationItemComponent,
  SideNavigationSubItemComponent,
} from "@ui5/webcomponents-ngx";
import { Ui5FioriModule, Ui5MainModule } from "@ui5/webcomponents-ngx";
import { Subscription } from "rxjs";
import { Permissions } from "@app/shared/enums/permissions";

interface SubItem {
  text: string;
  permission?: string;
  routerLink: string;
}

interface MenuItem {
  text: string;
  icon: string;
  slot?: string;
  expanded: boolean;
  permission?: string;
  routerLink?: string;
  subItems?: SubItem[];
}

interface SidebarGroup {
  text: string;
  expanded: boolean;
  permission?: string;
  items: MenuItem[];
}

@Component({
  selector: "app-hr-data-management-layout",
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    CommonModule,
    SideNavigationComponent,
    SideNavigationGroupComponent,
    SideNavigationItemComponent,
    RouterOutlet,
    SideNavigationSubItemComponent,
    Ui5FioriModule,
    Ui5MainModule,
    AgGridTableComponent,
  ],
  templateUrl: "./sales-layout.component.html",
  styleUrl: "./sales-layout.component.scss",
})
export class SalesLayout implements OnInit, OnDestroy {
  @ViewChild('planGridRef') planGridRef?: AgGridTableComponent;
  home = $localize`Home`;
  analytics = {
    name: $localize`Analytics`,
    route: "sales-analytics",
    permissions: Permissions.SALES_ANALYTICS,
  };
  forecast = {
    name: $localize`Forecast`,
    route: "sales-forecast",
  };
  isCollapsed = false;
  private sidenavToggleSubscription!: Subscription;
  public items: any[] = [];
  openPlan = false;
  permissions: { [key: string]: boolean } = {};
  public authUser: any;
  isWarning: boolean = false;
  warningMessage: string = "";
  public localization = Localization;

  columns: AgGridTableColumn<any>[] = [];

  planDataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };

  planToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Items`,
    showSearch: true,
    showRowCount: false,
    showNewButton: false,
    showDownload: false,
    showTableSettingBtn: false,
  };

  planDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: "calc(100vh - 550px)",
    alternateRowColors: false,
  };

  constructor(
    private rolePermissionService: RolePermissionService,
    private CommonService: CommonService,
    private toastService: ToastService,
    private router: Router
  ) {
    this.permissions = this.rolePermissionService.getAllPermissionsStatus();
    this.columns = this.buildColumns();
    this.checkEmployeePermission();
  }

  private fullSidebarMenu: SidebarGroup[] = [
    {
      text: `${$localize`Sales Management`}`,
      expanded: true,
      permission: Permissions.SALES_ADMIN,
      items: [
        {
          text: `${$localize`Pricing Plan`} `,
          icon: "my-view",
          permission: Permissions.SALES_PRICING_PLAN,
          routerLink: "pricing-plan",
          expanded: false,
        },
        {
          text: `${$localize`Sales Order`} `,
          icon: "sales-order",
          permission: Permissions.SALES_SALES_ORDERS,
          routerLink: "sales-orders",
          expanded: false,
        },
        {
          text: `${$localize`Sales Requests`} `,
          icon: "crm-sales",
          permission: Permissions.SALES_SALES_REQUESTS,
          routerLink: "sales-requests",
          expanded: false,
        },
        {
          text: `${$localize`Audit Trail`} `,
          icon: "customer-history",
          permission: Permissions.SALES_SALES_REQUESTS,
          routerLink: "audit-trail",
          expanded: false,
        },
        {
          text: `${$localize`Expired Orders`} `,
          icon: "explorer",
          permission: Permissions.SALES_EXPIRED_SALES_ORDERS,
          routerLink: "expired-sales-orders",
          expanded: false,
        },
        {
          text: `${$localize`Market Price History`} `,
          icon: "activity-items",
          permission: Permissions.SALES_MARKET_PRICE_HISTORY,
          routerLink: "market-price-history",
          expanded: false,
        },
      ],
    },
  ];

  sidebarMenu: SidebarGroup[] = [];

  ngOnInit(): void {
    this.sidebarMenu = this.filterMenuByPermissions(this.fullSidebarMenu);

    this.sidenavToggleSubscription = this.CommonService.sidenavToggle.subscribe(
      (isCollapsed: boolean) => {
        this.isCollapsed = isCollapsed;
      }
    );

    this.getAuthorization();
  }

  private filterMenuByPermissions(menu: SidebarGroup[]): SidebarGroup[] {
    return menu
      .map((group) => {
        if (group.permission && !this.permissions[group.permission]) {
          return null;
        }

        const filteredItems = group.items.filter((item) => {
          if (item.permission) {
            return !!this.permissions[item.permission];
          }
          return true;
        });

        if (filteredItems.length === 0) {
          return null;
        }
        return {
          ...group,
          items: filteredItems,
        };
      })
      .filter((group): group is SidebarGroup => group !== null);
  }

  ngOnDestroy(): void {
    if (this.sidenavToggleSubscription) {
      this.sidenavToggleSubscription.unsubscribe();
    }
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    return [
      {
        headerName: $localize`Item Code`,
        field: "item_code",
        width: 140,
      },
      {
        headerName: $localize`Name`,
        field: "product_name",
        flex: 1,
      },
      {
        headerName: $localize`Unit`,
        field: "uom",
        colId: "uom_name",
        width: 110,
        valueGetter: (params: any) => params.data?.uom?.name ?? "",
      },
      {
        headerName: $localize`Unit Price`,
        field: "unit_price",
        width: 130,
        valueFormatter: (params: any) => {
          const currency = params.data?.currency ?? "";
          const price = params.data?.unit_price ?? "";
          return `${currency} ${price}`.trim();
        },

      },
      {
        headerName: $localize`Market Price`,
        field: "market_price",
        width: 140,
        editable: false,
        inlineEditor: { type: "input" },
        dataType: GridTableColumnDataType.NumberField,
        minValue: 0,
      },
    ];
  }

  private readonly routePermissions: { [route: string]: string | null } = {
    "sales-analytics": Permissions.SALES_ANALYTICS,
    "pricing-plan": Permissions.SALES_PRICING_PLAN,
    "sales-orders": Permissions.SALES_SALES_ORDERS,
    "sales-requests": Permissions.SALES_SALES_REQUESTS,
    "audit-trail": Permissions.SALES_SALES_REQUESTS,
    "expired-sales-orders": Permissions.SALES_EXPIRED_SALES_ORDERS,
    "market-price-history": Permissions.SALES_MARKET_PRICE_HISTORY,
    "sales-forecast": null,
  };

  checkEmployeePermission() {
    const currentPath = this.router.url
      .replace("/sales-management/", "")
      .split("?")[0];

    const requiredPermission = this.routePermissions[currentPath];
    if (requiredPermission !== undefined) {
      const hasAccess =
        requiredPermission === null ||
        this.rolePermissionService.hasPermission(requiredPermission);
      if (hasAccess) {
        return;
      }
    }

    const fallbackRoute = Object.keys(this.routePermissions).find((route) => {
      const permission = this.routePermissions[route];
      return (
        permission === null || this.rolePermissionService.hasPermission(permission)
      );
    });

    if (fallbackRoute) {
      this.router.navigate([`/sales-management/${fallbackRoute}`]);
    }
  }

  NavigateToggle(event: any) {}

  toggleExpand(item: any) {
    item.expanded = !item.expanded;
    if (
      this.rolePermissionService.hasPermission(
        Permissions.SALES_MARKET_PRICE_ENTRY
      )
    ) {
      this.getSalesUserMarketPriceEntry();
    }
  }


  getAuthorization() {
    this.CommonService.get(`auth`, false).subscribe((res: any) => {
      this.authUser = res.user;
      if (
        this.rolePermissionService.hasPermission(
          Permissions.SALES_MARKET_PRICE_ENTRY
        )
      ) {
        this.getSalesUserMarketPriceEntry();
      }
    });
  }

  getSalesUserMarketPriceEntry() {
    this.CommonService.get(
      `sales/get-market-price-entry?user_id=${this.authUser.id}`,
      false
    ).subscribe((res: any) => {
      this.items = res.items;
      this.planDataSource = { type: 'odata', endpoint: '', staticData: true, data: this.items };
      if (this.items.length > 0) {
        this.openPlan = true;
      }
    });
  }

  onPlanCellEdited(event: { row: any; field: string; newValue: any }): void {
    const item = this.items.find((i: any) => i.id === event.row.id);
    if (item) {
      item[event.field] = event.newValue;
    }
  }

  savePlan() {
    this.planGridRef?.stopEditing();
    this.openPlan = true;

    const items = this.items;

    const hasInvalidPrice = items.some((item: any) => {
      if (!("market_price" in item)) {
        return true;
      }

      const price = Number(item.market_price);

      return (
        item.market_price === null ||
        item.market_price === undefined ||
        item.market_price === "" ||
        isNaN(price) ||
        price <= 0
      );
    });

    if (hasInvalidPrice) {
      this.warningMessage = $localize`Market price is required and must be greater than 0 for all items`;
      this.isWarning = true;
      return;
    }

    const batchPayload = {
      requests: items.map((item: any, index: number) => ({
        id: index,
        method: "POST",
        url: "/odata/MarketPrices",
        headers: {
          "Content-Type": "application/json",
        },
        body: {
          product_id: item.id,
          unit_price: item.market_price,
          created_by: this.authUser.id,
        },
      })),
    };

    this.CommonService.post("$batch", batchPayload, true).subscribe({
      next: (res: any) => {
        if (
          this.rolePermissionService.hasPermission(
            Permissions.SALES_MARKET_PRICE_ENTRY
          )
        ) {
          this.getSalesUserMarketPriceEntry();
        }
        this.ClosePlan();
        this.toastService.show("add");
      },
      error: (error: any) => {
        console.error("error", error);
      },
    });
  }

  ClosePlan() {
    this.openPlan = false;
  }
}
