import {
  Component,
  EventEmitter,
  Output,
  ViewChild,
} from '@angular/core';
import { SupplierBankInfo } from '@shared/model/supplier-bank-info';
import { DateFormatterService } from '@shared/utilities/date-format';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { Permissions } from '@app/shared/enums/permissions';
import { Localization } from '@app/shared/utilities/localization';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridCustomButton,
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';

@Component({
  selector: 'app-bank-details-list',
  templateUrl: './bank-details-list.component.html',
  styleUrl: './bank-details-list.component.scss',
})
export class BankDetailsListComponent {
  @ViewChild('agGridRef') agGridRef!: AgGridTableComponent<SupplierBankInfo>;
  @Output() IsApprove = new EventEmitter<void>();

  Supplier_Info = new SupplierBankInfo();
  createdBy: string | null = null;
  approvedAt: string | null = null;

  public readonly localization = Localization;

  columns: AgGridTableColumn<SupplierBankInfo>[] = [];

  dataSource: AgGridTableODataSourceConfig<SupplierBankInfo> = {
    type: 'odata',
    endpoint: 'SupplierBankInfos',
    expand: 'supplier,user,createdBy',
    pageSize: 40,
    scrollPagination: true,
    searchFields: ['bank_name', 'account_number'],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Supplier Bank Details`,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
  };

  segmentButtonItems = [
    { id: 'all',          name: $localize`All`,          defaultSelect: true, filter: '' },
    { id: 'verified',     name: $localize`Verified`,                          filter: 'approved_at ne null' },
    { id: 'non-verified', name: $localize`Non-Verified`,                      filter: 'approved_at eq null' },
  ];

  actionButtons: AgGridCustomButton[] = [
    {
      id: 'info',
      icon: 'information',
      design: 'Transparent',
      tooltip: $localize`View Details`,
      hide: () =>
        !this.rolePermissionService.hasPermission(
          Permissions.BASE_DATA_SUPPLIER_BANK_VERIFIED,
        ),
      onClick: (row: SupplierBankInfo) => this.HandleApproveInfo(row),
    },
  ];

  constructor(
    private dateFormatter: DateFormatterService,
    private rolePermissionService: RolePermissionService,
  ) {
    this.columns = this.buildColumns();
  }

  private buildColumns(): AgGridTableColumn<SupplierBankInfo>[] {
    return [
      {
        field: 'is_active',
        headerName: $localize`Status`,
        minWidth: 80,
        width: 90,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
      },
      {
        field: 'supplier_id',
        headerName: $localize`Supplier Name`,
        minWidth: 160,
        valueGetter: (params: any) => params.data?.supplier?.name ?? '',
      },
      {
        field: 'format_of_payment',
        headerName: $localize`Mode Of Payment`,
        minWidth: 140,
      },
      {
        field: 'bank_name',
        headerName: $localize`Bank Name`,
        minWidth: 130,
      },
      {
        field: 'account_number',
        headerName: $localize`Account Number`,
        minWidth: 140,
      },
      {
        field: 'approved_by',
        headerName: $localize`Verified By`,
        minWidth: 130,
        valueGetter: (params: any) => params.data?.user?.name ?? '',
      },
      {
        field: 'created_by',
        headerName: $localize`Created By`,
        minWidth: 130,
        valueGetter: (params: any) => params.data?.createdBy?.name ?? '',
      },
      {
        field: 'approved_at',
        headerName: $localize`Verified At`,
        minWidth: 140,
        filter: false,
        valueFormatter: ({ value }: any) =>
          value
            ? this.dateFormatter.formatDate(value, true, false, false, false, true)
            : '',
      },
      {
        field: 'created_at',
        headerName: $localize`Created At`,
        minWidth: 130,
        filter: false,
      },
    ];
  }

  HandleApproveInfo(supplier: SupplierBankInfo): void {
    this.IsApprove.emit();
    this.Supplier_Info.deserialize(supplier);

    if (this.Supplier_Info.createdBy?.name) {
      this.createdBy = this.Supplier_Info.createdBy.name;
    }

    this.approvedAt = this.dateFormatter.formatDate(
      this.Supplier_Info.approved_at ?? '',
      true,
      false,
      false,
      false,
      true,
    );
  }

  onSuccessChange(): void {
    this.agGridRef?.refreshGridData(true);
  }
}
