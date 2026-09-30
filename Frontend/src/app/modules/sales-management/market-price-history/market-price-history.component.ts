import { Component, ViewChild } from "@angular/core";
import { CommonService } from "@app/services/common-service/common.service";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableFilterOptionInput,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  GridTableColumnDataType,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { DateFormatterService } from "@app/shared/utilities/date-format";

@Component({
  selector: "app-market-price-history",
  templateUrl: "./market-price-history.component.html",
  styleUrl: "./market-price-history.component.scss",
})
export class MarketPriceHistoryComponent {
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent;

  private itemOptions: AgGridTableFilterOptionInput[] = [];
  private userOptions: AgGridTableFilterOptionInput[] = [];

  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: "odata",
    endpoint: "MarketPrices",
    expand: "createdBy,product($expand=uom)",
    sortDirection: "desc",
    searchFields: ["product.item_code", "product.product_name", "createdBy.name"],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Market Price`,
    showSearch: true,
    showRowCount: true,
    showNewButton: false,
  };

  displayConfig: AgGridTableDisplayConfig = {
    gridHeight: "calc(100vh - 50px)",
  };

  constructor(
    private commonService: CommonService,
    private dateFormatter: DateFormatterService
  ) {
    this.columns = this.buildColumns();
    this.getInitialData();
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    return [
      {
        colId: "product.item_code",
        headerName: $localize`Item Code`,
        minWidth: 140,
        width: 140,
        valueGetter: (params: any) => params.data?.product?.item_code ?? "",
      },
      {
        colId: "product.product_name",
        headerName: $localize`Name`,
        flex: 1,
        minWidth: 150,
        valueGetter: (params: any) => params.data?.product?.product_name ?? "",
        filterControl: {
          type: "multiSelect",
          options: this.itemOptions,
          placeholder: $localize`Filter by item...`,
        },
      },
      {
        colId: "product.uom.name",
        headerName: $localize`Unit`,
        width: 110,
        minWidth: 110,
        valueGetter: (params: any) => params.data?.product?.uom?.name ?? "",
        filter: false,
        sortable: false,
      },
      {
        field: "unit_price",
        headerName: $localize`Market Price`,
        minWidth: 120,
        dataType: GridTableColumnDataType.Number,
      },
      {
        colId: "createdBy.name",
        headerName: $localize`Created By`,
        minWidth: 150,
        width: 150,
        valueGetter: (params: any) => params.data?.createdBy?.name ?? "",
        filterControl: {
          type: "multiSelect",
          options: this.userOptions,
          placeholder: $localize`Filter by user...`,
        },
      },
      {
        field: "created_at",
        headerName: $localize`Date`,
        minWidth: 150,
        dataType: GridTableColumnDataType.UI5DateRangePicker,
        valueFormatter: (params: any) =>
          this.dateFormatter.formatDate(
            params.value,
            true,
            false,
            false,
            false,
            false
          ),
      },
    ];
  }

  private getInitialData(): void {
    const batchRequests = {
      requests: [
        {
          id: "1",
          method: "GET",
          url: "Products?$filter=is_active eq true and is_sellable eq true",
        },
        {
          id: "2",
          method: "GET",
          url: "Users?$filter=is_active eq true",
        },
      ],
    };

    this.commonService
      .post("$batch", batchRequests, true)
      .subscribe((res: any) => {
        const productRes = res.responses?.find((r: any) => r.id === "1");
        const userRes = res.responses?.find((r: any) => r.id === "2");

        if (productRes?.status === 200) {
          this.itemOptions = (productRes.body?.value ?? []).map((item: any) => ({
            value: item.product_name,
            label: item.product_name,
          }));
        }

        if (userRes?.status === 200) {
          this.userOptions = (userRes.body?.value ?? []).map((item: any) => ({
            value: item.name,
            label: item.name,
          }));
        }

        this.columns = this.buildColumns();
      });
  }
}
