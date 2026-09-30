import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { OperationManagementInfoFormComponent } from '@base-data-module/oparation-management/operation-management-info/operation-management-info-form/operation-management-info-form.component';
import { CommonService } from '@app/services/common-service/common.service';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { saveMode } from '@shared/enums/saveMode';
import { OperationPosition } from '@shared/model/oparationPosition';
import { Operation } from '@shared/model/operation';
import { Permissions } from '@app/shared/enums/permissions';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableRowAction,
  AgGridTableToolbarConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';
import { AgGridActionCellRendererComponent } from '@shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component';

@Component({
  selector: 'app-operation-management-info',
  templateUrl: './operation-management-info.component.html',
  styleUrl: './operation-management-info.component.scss',
})
export class OperationManagementInfoComponent implements OnInit {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<OperationPosition>;
  @ViewChild('operationInfoForm')
  operationInfoFormRef!: OperationManagementInfoFormComponent;

  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();

  IsLoading: boolean = false;
  operationId: number | undefined;
  oparations = new Operation();

  customId: string = $localize`Custom ID`;
  operationName: string = $localize`Operation Name`;
  operationCycle: string = $localize`Operation Cycle`;

  public saveMode: string = saveMode.POST;
  public permissions = Permissions;

  gridId = 'base-data-operation-info-list';
  columns: AgGridTableColumn<any>[] = [];
  dataSource!: AgGridTableODataSourceConfig<OperationPosition>;

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: 'Operations Positions',
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: 'New',
    showNewButton: false,
  };


  constructor(
    private route: ActivatedRoute,
    public rolePermissionService: RolePermissionService,
    private commonService: CommonService,
    private cdrf: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.operationId = Number(this.route.snapshot.paramMap.get('id'));
    this.toolbarConfig = {
      ...this.toolbarConfig,
      showNewButton: this.rolePermissionService.hasPermission(
        Permissions.BASE_DATA_OPERATION_INFO_CREATE,
      ),
    };
    this.dataSource = {
      type: 'odata',
      endpoint: 'OperationPositions',
      expand: 'machines,products',
      filter: `operation_id eq ${this.operationId}`,
      searchFields: ['name', 'custom_id'],
      pageSize: 40,
      scrollPagination: true,
    };
    this.columns = this.buildColumns();
    this.getOparationInfo();
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    const canEdit = this.rolePermissionService.hasPermission(
      Permissions.BASE_DATA_OPERATION_INFO_EDIT,
    );
    const canDelete = this.rolePermissionService.hasPermission(
      Permissions.BASE_DATA_OPERATION_INFO_DELETE,
    );

    const rowActions: AgGridTableRowAction<any>[] = [];
    if (canEdit) {
      rowActions.push({ id: 'edit', label: '', icon: 'edit', tooltip: $localize`Edit` });
    }
    if (canDelete) {
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
      },
      {
        field: 'custom_id',
        headerName: $localize`ID`,
        minWidth: 100,
        width: 110,
      },
      {
        field: 'name',
        headerName: $localize`Name`,
        minWidth: 180,
      },
      {
        colId: 'products_name',
        headerName: `${$localize`Item`} ${$localize`Name`}`,
        minWidth: 180,
        filter: false,
        sortable: false,
        valueGetter: (params: any) => params.data?.products?.product_name ?? '',
      },
      {
        colId: 'machines_name',
        headerName: `${$localize`Machine`} ${$localize`Name`}`,
        minWidth: 180,
        filter: false,
        sortable: false,
        valueGetter: (params: any) => params.data?.machines?.machine_name ?? '',
      },
      {
        field: 'created_at',
        headerName: $localize`Created On`,
        minWidth: 130,
        filter: false,
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
              case 'edit':
                this.editInfoOperation(row);
                break;
              case 'delete':
                this.IsDelete.emit(`OperationPositions/${row.id}`);
                break;
            }
          },
        },
      });
    }

    return cols;
  }

  getOparationInfo(): void {
    this.IsLoading = true;
    this.commonService.get(`Operations/${this.operationId}`, true).subscribe({
      next: (res: any) => {
        this.oparations = res;
        this.IsLoading = false;
      },
    });
  }

  newInfoOperation(): void {
    this.operationInfoFormRef.operationPosition.deserialize({});
    this.operationInfoFormRef.operationPosition.operation_id = this.operationId;
    this.operationInfoFormRef.open = true;
    this.operationInfoFormRef.saveMode = saveMode.POST;
    this.operationInfoFormRef.productTitle = '';
  }

  editInfoOperation(data: any): void {
    const op = new OperationPosition().deserialize(data);
    this.operationInfoFormRef.operationPosition = op;
    this.operationInfoFormRef.operationPosition.operation_id = this.operationId;

    const selectedProduct = this.operationInfoFormRef.products.find(
      (p) => p.id === op.product_id,
    );
    this.operationInfoFormRef.selectedProductId = op.product_id ?? null;
    this.operationInfoFormRef.productTitle = selectedProduct?.product_name ?? '';

    const selectedMachine = this.operationInfoFormRef.machines.find(
      (m) => m.id === op.machine_id,
    );
    this.operationInfoFormRef.selectedMachineId = op.machine_id ?? null;
    this.operationInfoFormRef.machineTitle = selectedMachine?.machine_name ?? '';
    this.operationInfoFormRef.open = true;
    this.operationInfoFormRef.saveMode = saveMode.PUT;
  }

  processData(event: any): void {
    this.refreshTable.emit();
    this.agGridRef?.refreshGridData(true);
    this.cdrf.detectChanges();
  }
}
