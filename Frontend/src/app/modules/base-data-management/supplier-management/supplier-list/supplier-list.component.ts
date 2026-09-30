import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';
import { Supplier } from '@app/shared/model/supplier';
import { CommonService } from '@app/services/common-service/common.service';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { SupplierFormComponent } from '@app/modules/base-data-management/supplier-management/supplier-form/supplier-form.component.js';
import { saveMode } from '@app/shared/enums/saveMode';
import { ToastService } from '@app/services/toast-service/toast.service';
import { Localization } from '@app/shared/utilities/localization';
import { Permissions } from '@app/shared/enums/permissions';
import {
  AgGridTableComponent,
} from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import { AgGridActionCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';
import {
  AgGridTableCellEditEvent,
  AgGridTableColumn,
  AgGridTableRowAction,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';

@Component({
  selector: 'app-Supplier-management',
  templateUrl: './supplier-list.component.html',
  styleUrl: './supplier-list.component.scss',
})
export class SupplierListComponent implements OnInit {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<any>;
  @ViewChild('supplierForm') supplierFormRef!: SupplierFormComponent;

  @Output() refreshTable = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<any>();
  @Output() IsInsertXls = new EventEmitter<void>();
  @Output() IsExportXls = new EventEmitter<void>();

  headerTitle = `${$localize`Supplier`} ${$localize`List`}`;
  supplier = new Supplier();
  public saveMode: string = saveMode.POST;
  public localization = Localization;
  public permissions = Permissions;

  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: 'Suppliers',
    expand: 'bankInfos,supplierBanks,supplierCash',
    searchFields: ['custom_id', 'name'],
    pageSize: 40,
    sortBy: 'id',
    sortDirection: 'desc',
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Supplier`} ${$localize`List`}`,
    showRowCount: true,
    showSearch: true,
    showNewButton: false,
    addButtonText: $localize`New`,
    showDownload: true,
    showUpload: true,
    showSegmentButton: true,
    button1Text: $localize`All`,
    button2Text: $localize`Active`,
    button3Text: $localize`Inactive`,
  };

  constructor(
    private commonServices: CommonService,
    public rolePermissionService: RolePermissionService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.columns = this.buildColumns();
    this.toolbarConfig = {
      ...this.toolbarConfig,
      showNewButton: this.rolePermissionService.hasPermission(Permissions.BASE_DATA_SUPPLIER_CREATE),
    };
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    const rowActions: AgGridTableRowAction<any>[] = [];

    if (this.rolePermissionService.hasPermission(Permissions.BASE_DATA_SUPPLIER_EDIT)) {
      rowActions.push({
        id: 'edit',
        label: '',
        icon: 'edit',
        tooltip: $localize`Edit`,
        design: 'Transparent',
      });
    }

    if (this.rolePermissionService.hasPermission(Permissions.BASE_DATA_SUPPLIER_DELETE)) {
      rowActions.push({
        id: 'delete',
        label: '',
        icon: 'delete',
        tooltip: $localize`Delete`,
        design: 'Negative',
      });
    }

    const cols: AgGridTableColumn<any>[] = [
      {
        field: 'is_active',
        headerName: $localize`Active`,
        minWidth: 80,
        width: 90,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
        floatingFilter: false,
      },
      {
        field: 'custom_id',
        headerName: $localize`ID`,
        minWidth: 100,
        width: 130,
      },
      {
        field: 'name',
        headerName: $localize`Name`,
        minWidth: 180,
        flex: 1,
        editor: { type: "text" },
      },
      {
        field: 'created_at',
        headerName: $localize`Created At`,
        minWidth: 130,
        width: 150,
        filter: false,
        floatingFilter: false,
      },
    ];

    if (rowActions.length > 0) {
      cols.push({
        field: 'actions',
        headerName: $localize`Actions`,
        width: 140,
        minWidth: 140,
        pinned: 'right',
        lockPinned: true,
        sortable: false,
        filter: false,
        editable: false,
        cellRenderer: AgGridActionCellRendererComponent,
        cellRendererParams: {
          actions: rowActions,
          onAction: (actionId: string, row: any) => {
            switch (actionId) {
              case 'edit': this.editSupplier(row); break;
              case 'delete': this.IsDelete.emit(`Suppliers(${row.id})`); break;
            }
          },
        },
      });
    }

    return cols;
  }

  newSupplier(): void {
    this.supplier = new Supplier().deserialize({});
    this.supplierFormRef.resetForm();
    this.supplierFormRef.Supplier = this.supplier;
    this.supplierFormRef.open = true;
    this.supplierFormRef.saveMode = saveMode.POST;
  }

  editSupplier(data: any): void {
    this.supplierFormRef.resetForm();
    this.supplierFormRef.Supplier = new Supplier().deserialize(data);
    this.supplierFormRef.getCashAndBankInfo('CASH');
    this.supplierFormRef.getCashAndBankInfo('BANK');
    this.supplierFormRef.open = true;
    this.supplierFormRef.saveMode = saveMode.PUT;
  }

  onFormSaved(event: any): void {
    this.agGridRef?.refreshGridData(true);
    this.refreshTable.emit(event);
  }

  onDeleteSuccess(): void {
    this.agGridRef?.refreshGridData(true);
    this.refreshTable.emit();
  }

  downloadButtonClick(_event: any): void {
    this.IsExportXls.emit();
  }

  uploadButtonClick(_event: any): void {
    this.IsInsertXls.emit();
  }

  onCellEdited(event: AgGridTableCellEditEvent<any>): void {
    const row = event.row as any;
    if (!row?.id) return;
    this.commonServices
      .put<any>(`Suppliers(${row.id})`, { [event.field]: event.newValue })
      .subscribe({
        next: () => this.toastService.show('edit'),
        error: () => {
          this.toastService.show('error');
          this.agGridRef?.refreshGridData(true);
        },
      });
  }
}
